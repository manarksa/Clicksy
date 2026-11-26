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
  packages: ['package_id', 'name', 'description_en', 'description_ar', 'price', 'duration', 'is_popular', 'is_active'],
  package_features: ['feature_id', 'package_id', 'feature_name_en', 'feature_name_ar', 'sort_order'],
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
  await runSqlFile(target, 'schema.sql')
  await checkColumns(target)
}

/** Runs every statement of a .sql file next to this one (statements end with ";" at line end). */
export async function runSqlFile(target, name) {
  const text = readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')
  const statements = text
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean)
  const results = []
  for (const sql of statements) results.push((await target.query(sql))[0])
  return results
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
  if (config.readOnly) guardReadOnly(pool)
  dbFlavor = await describeServer(pool)
  if (config.readOnly) {
    // Maintenance: only check the tables, never create or change anything (not even the owner).
    await checkColumns(pool)
  } else {
    await applySchema(pool)
    await ensureOwner()
  }
  const [[active]] = await pool.query('SELECT COUNT(*) AS n FROM packages WHERE is_active = 1')
  activePackages = Number(active.n)
}

/** Bookable packages found at start (0 = run `npm run db:seed`). Set by initDb(). */
export let activePackages = 0

const READ_SQL = /^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i

/**
 * READ_ONLY safety net under the routes: any statement that is not a read fails, whichever code
 * sends it. MySQL/Aiven also enforce it in the database itself (TiDB does not support that).
 */
function guardReadOnly(target) {
  const block = (sql) => {
    const text = typeof sql === 'string' ? sql : sql?.sql
    if (!READ_SQL.test(String(text ?? ''))) {
      throw Object.assign(new Error('READ_ONLY is on: write refused'), { code: 'READ_ONLY' })
    }
  }
  for (const method of ['query', 'execute']) {
    const original = target[method].bind(target)
    target[method] = (sql, ...rest) => {
      block(sql)
      return original(sql, ...rest)
    }
  }
  target.pool.on('connection', (conn) => {
    conn.query('SET SESSION transaction_read_only = 1', () => {}) // ignored where unsupported (TiDB)
  })
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
  const [rows] = await pool.query('SELECT id, password_hash, role, email_verified FROM users WHERE email = ?', [email])
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
  if (same && rows[0].role === 'admin' && rows[0].email_verified) return // nothing to change
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
