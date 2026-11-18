import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import { config } from './config.js'

export let pool

/** Columns the code relies on. Used to spot an older/different table instead of failing later. */
const REQUIRED = {
  users: ['id', 'name', 'email', 'phone', 'password_hash', 'role', 'email_verified', 'created_at'],
  email_codes: ['id', 'user_id', 'code_hash', 'expires_at', 'attempts', 'used', 'created_at'],
  sessions: ['token_hash', 'user_id', 'expires_at'],
  bookings: [
    'id', 'user_id', 'package_id', 'package_name', 'event_type_id', 'custom_event_name',
    'hours', 'event_date', 'location', 'notes', 'total_price', 'status', 'created_at',
  ],
}

/**
 * Connects as DB_USER to DB_NAME, creates any missing tables (never drops or empties anything),
 * checks the columns, then makes sure the owner account exists.
 */
export async function initDb() {
  pool = mysql.createPool({
    ...config.db,
    connectionLimit: 10,
    dateStrings: true, // DATE columns come back as 'YYYY-MM-DD'
    charset: 'utf8mb4',
  })

  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  const statements = schema
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean)
  for (const sql of statements) await pool.query(sql)

  await checkColumns()
  await ensureOwner()
}

async function checkColumns() {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [Object.keys(REQUIRED)],
  )
  const have = new Set(rows.map((r) => `${r.t}.${r.c}`))
  const missing = Object.entries(REQUIRED).flatMap(([t, cols]) =>
    cols.filter((c) => !have.has(`${t}.${c}`)).map((c) => `${t}.${c}`),
  )
  if (missing.length) {
    throw Object.assign(
      new Error(
        `These tables already existed with a different shape. Missing columns: ${missing.join(', ')}. ` +
          'Nothing was changed. Rename the old tables (or send the SHOW CREATE TABLE output) and restart.',
      ),
      { code: 'SCHEMA_MISMATCH' },
    )
  }
}

async function ensureOwner() {
  const { name, email, password } = config.owner
  if (!email || !password) {
    console.warn('⚠  OWNER_EMAIL / OWNER_PASSWORD are not set in .env — no owner account yet.')
    return
  }
  const [rows] = await pool.query('SELECT id, password_hash FROM users WHERE email = ?', [email])
  if (rows.length === 0) {
    const hash = await bcrypt.hash(password, 12)
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified)
       VALUES (?, ?, ?, 'admin', 1)`,
      [name, email, hash],
    )
    console.log(`✓ Owner account created: ${email}`)
    return
  }
  // .env is the source of truth for the owner: keep role and password in sync.
  const same = await bcrypt.compare(password, rows[0].password_hash)
  const hash = same ? rows[0].password_hash : await bcrypt.hash(password, 12)
  await pool.query(
    `UPDATE users SET role = 'admin', email_verified = 1, password_hash = ? WHERE id = ?`,
    [hash, rows[0].id],
  )
}

/** Turns MySQL error codes into a next step the person can actually take. */
export function explainDbError(err) {
  const { host, port, user, database } = config.db
  switch (err.code) {
    case 'ECONNREFUSED':
      return `MySQL is not answering on ${host}:${port}. Start the MySQL80 service (Windows: Services → MySQL80 → Start).`
    case 'ER_ACCESS_DENIED_ERROR':
      return `MySQL refused "${user}". Check DB_USER / DB_PASSWORD in .env (no spaces or quotes around the password).`
    case 'ER_BAD_DB_ERROR':
      return `Database "${database}" does not exist. Run server/setup-root.sql once as root.`
    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_TABLEACCESS_DENIED_ERROR':
      return `"${user}" has no permission on "${database}". Run the GRANT lines in server/setup-root.sql as root.`
    case 'SCHEMA_MISMATCH':
      return err.message
    default:
      return `${err.code ?? ''} ${err.message}`.trim()
  }
}
