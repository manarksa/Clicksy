import { createHash, randomBytes, randomInt } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { config } from './config.js'
import { pool } from './db.js'
import { codeEmail } from './mailer.js'

const COOKIE = 'clicksy_session'
const SESSION_DAYS = 7
const CODE_MINUTES = 10
const MAX_CODE_ATTEMPTS = 5
const RESEND_SECONDS = 60

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const normEmail = (value) => String(value ?? '').trim().toLowerCase()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function publicUser(row) {
  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  }
}

/** Tiny in-memory limiter: at most `max` hits per key per window. */
const hits = new Map()
function limited(key, max = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs })
    return false
  }
  entry.count += 1
  return entry.count > max
}

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function setSessionCookie(res, token) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 24 * 3600}`,
  ]
  if (config.production) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

/** Attaches req.user when the session cookie is valid. */
export async function loadUser(req, _res, next) {
  try {
    const token = readCookie(req, COOKIE)
    if (token) {
      const [rows] = await pool.query(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()`,
        [sha256(token)],
      )
      if (rows[0]) req.user = rows[0]
    }
    next()
  } catch (err) {
    next(err)
  }
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' })
  next()
}

export function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' })
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
  next()
}

async function issueCode(user) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await pool.query('UPDATE email_codes SET used = 1 WHERE user_id = ? AND used = 0', [user.id])
  await pool.query(
    `INSERT INTO email_codes (user_id, code_hash, expires_at)
     VALUES (?, ?, NOW() + INTERVAL ${CODE_MINUTES} MINUTE)`,
    [user.id, sha256(code)],
  )
  try {
    await codeEmail(user.email, user.name, code)
    return true
  } catch {
    return false // logged by the mailer; the route answers 'mailFailed'
  }
}

export const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  const name = String(req.body.name ?? '').trim().slice(0, 120)
  const email = normEmail(req.body.email)
  const phone = String(req.body.phone ?? '').trim().slice(0, 40)
  const password = String(req.body.password ?? '')

  if (!name || !email) return res.status(400).json({ error: 'required' })
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'badEmail' })
  if (password.length < 6) return res.status(400).json({ error: 'short' })
  if (limited(`reg:${req.ip}`)) return res.status(429).json({ error: 'tooMany' })

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email])
  const existing = rows[0]
  if (existing?.email_verified) return res.status(409).json({ error: 'exists' })

  const hash = await bcrypt.hash(password, 12)
  let user
  if (existing) {
    // Never verified: let them retry sign-up with fresh details.
    await pool.query('UPDATE users SET name = ?, phone = ?, password_hash = ? WHERE id = ?', [
      name,
      phone,
      hash,
      existing.id,
    ])
    user = { ...existing, name, phone }
  } else {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [name, email, phone, hash],
    )
    user = { id: result.insertId, name, email, phone }
  }
  if (!(await issueCode(user))) return res.status(502).json({ error: 'mailFailed' })
  res.json({ pending: true, email })
})

authRouter.post('/login', async (req, res) => {
  const email = normEmail(req.body.email)
  const password = String(req.body.password ?? '')
  if (!email || !password) return res.status(400).json({ error: 'required' })
  if (limited(`login:${email}`) || limited(`login-ip:${req.ip}`, 30)) {
    return res.status(429).json({ error: 'tooMany' })
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email])
  const user = rows[0]
  // Same answer for "no account" and "wrong password" so emails can't be probed.
  const ok = user && (await bcrypt.compare(password, user.password_hash))
  if (!ok) return res.status(401).json({ error: 'invalid' })

  if (!(await issueCode(user))) return res.status(502).json({ error: 'mailFailed' })
  res.json({ pending: true, email })
})

authRouter.post('/verify', async (req, res) => {
  const email = normEmail(req.body.email)
  const code = String(req.body.code ?? '').replace(/\D/g, '')
  if (!email || code.length !== 6) return res.status(400).json({ error: 'badCode' })

  const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email])
  const user = users[0]
  if (!user) return res.status(400).json({ error: 'badCode' })

  const [codes] = await pool.query(
    `SELECT *, expires_at < NOW() AS expired FROM email_codes
     WHERE user_id = ? AND used = 0 ORDER BY id DESC LIMIT 1`,
    [user.id],
  )
  const entry = codes[0]
  if (!entry) return res.status(400).json({ error: 'expired' })
  if (entry.expired) return res.status(400).json({ error: 'expired' })
  if (entry.attempts >= MAX_CODE_ATTEMPTS) return res.status(429).json({ error: 'tooMany' })

  if (entry.code_hash !== sha256(code)) {
    await pool.query('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?', [entry.id])
    return res.status(400).json({ error: 'badCode' })
  }

  await pool.query('UPDATE email_codes SET used = 1 WHERE id = ?', [entry.id])
  await pool.query('UPDATE users SET email_verified = 1 WHERE id = ?', [user.id])
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()')

  const token = randomBytes(32).toString('hex')
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES (?, ?, NOW() + INTERVAL ${SESSION_DAYS} DAY)`,
    [sha256(token), user.id],
  )
  setSessionCookie(res, token)
  res.json({ user: publicUser(user) })
})

authRouter.post('/resend', async (req, res) => {
  const email = normEmail(req.body.email)
  const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email])
  const user = users[0]
  if (!user) return res.json({ ok: true })

  // Only resend when this person already passed the password step recently.
  const [codes] = await pool.query(
    `SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM email_codes
     WHERE user_id = ? AND created_at > NOW() - INTERVAL 30 MINUTE
     ORDER BY id DESC LIMIT 1`,
    [user.id],
  )
  if (!codes[0]) return res.status(400).json({ error: 'expired' })
  if (codes[0].age < RESEND_SECONDS) return res.status(429).json({ error: 'wait' })

  if (!(await issueCode(user))) return res.status(502).json({ error: 'mailFailed' })
  res.json({ ok: true })
})

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' })
  res.json({ user: publicUser(req.user) })
})

authRouter.post('/logout', async (req, res) => {
  const token = readCookie(req, COOKIE)
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)])
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  res.json({ ok: true })
})
