import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import { config } from './config.js'

export let pool
/** e.g. "MySQL 8.0.46" or "TiDB v8.5.0" — set by initDb(). */
export let dbFlavor = ''

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

/** A connection pool that also suits cloud databases that drop idle connections. */
export function createDbPool(db = config.db) {
  return mysql.createPool({
    ...db,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    connectTimeout: 15_000,
    dateStrings: true, // DATE columns come back as 'YYYY-MM-DD'
    charset: 'utf8mb4',
  })
}

/** Creates missing tables (CREATE TABLE IF NOT EXISTS — never drops or empties anything). */
export async function applySchema(target) {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  const statements = schema
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean)
  for (const sql of statements) await target.query(sql)
  await checkColumns(target)
}

export async function describeServer(target) {
  const [[row]] = await target.query('SELECT VERSION() AS v')
  const tidb = String(row.v).match(/TiDB-(v[\d.]+)/)
  return tidb ? `TiDB ${tidb[1]}` : `MySQL ${row.v}`
}

/**
 * Connects to DB_NAME, creates any missing tables, checks the columns,
 * then makes sure the owner account exists.
 */
export async function initDb() {
  pool = createDbPool()
  dbFlavor = await describeServer(pool)
  await applySchema(pool)
  await ensureOwner()
}

async function checkColumns(target) {
  const [rows] = await target.query(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)`,
    [Object.keys(REQUIRED)],
  )
  const have = new Set(rows.map((r) => `${String(r.t).toLowerCase()}.${String(r.c).toLowerCase()}`))
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
    console.warn('⚠  OWNER_EMAIL / OWNER_PASSWORD are not set — no owner account yet.')
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
    console.log('✓ Owner account created')
    return
  }
  // The env settings are the source of truth for the owner: keep role and password in sync.
  const same = await bcrypt.compare(password, rows[0].password_hash)
  const hash = same ? rows[0].password_hash : await bcrypt.hash(password, 12)
  await pool.query(
    `UPDATE users SET role = 'admin', email_verified = 1, password_hash = ? WHERE id = ?`,
    [hash, rows[0].id],
  )
}

/** Turns database error codes into a next step the person can actually take. */
export function explainDbError(err, db = config.db) {
  const { host, port, user, database } = db
  switch (err.code) {
    case 'ECONNREFUSED':
      return `Nothing is answering on ${host}:${port}. Locally: start the MySQL80 service. TiDB: check DB_HOST and DB_PORT (4000).`
    case 'ENOTFOUND':
      return `Host "${host}" was not found. Copy DB_HOST exactly from the TiDB "Connect" dialog.`
    case 'ETIMEDOUT':
      return `Timed out reaching ${host}:${port}. Check the host/port, and that the network allows outbound connections.`
    case 'ER_ACCESS_DENIED_ERROR':
      return `The database refused user "${user}". Check DB_USER / DB_PASSWORD (TiDB users look like "xxxx.root").`
    case 'ER_BAD_DB_ERROR':
      return `Database "${database}" does not exist. Locally: run server/setup-root.sql. TiDB: run CREATE DATABASE ${database};`
    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_TABLEACCESS_DENIED_ERROR':
      return `"${user}" has no permission on "${database}". Run the GRANT lines in server/setup-root.sql as root.`
    case 'HANDSHAKE_SSL_ERROR':
    case 'HANDSHAKE_NO_SSL_SUPPORT':
      return 'Secure connection failed. For TiDB set DB_SSL=true; for local MySQL leave DB_SSL empty.'
    case 'SCHEMA_MISMATCH':
      return err.message
    default:
      if (/insecure transport|SSL|TLS/i.test(err.message)) {
        return 'The server requires an encrypted connection. Set DB_SSL=true (TiDB Cloud needs it).'
      }
      return `${err.code ?? ''} ${err.message}`.trim()
  }
}
