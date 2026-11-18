/**
 * Copies Clicksy data from the local MySQL (.env) to the cloud database (.env.tidb).
 *
 *   npm run db:copy            → dry run: shows what would be copied, writes nothing
 *   npm run db:copy -- --yes   → copies
 *
 * Safe by design:
 *  - The local database is only READ.
 *  - In the cloud database it only creates missing tables and INSERTs rows whose id
 *    is not there yet (INSERT IGNORE). It never DELETEs, UPDATEs or DROPs anything.
 *  - Sign-in codes and login sessions are temporary, so they are not copied
 *    (everyone simply signs in again on the new site).
 */
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { applySchema, createDbPool, describeServer, explainDbError } from './db.js'

const SOURCE_FILE = '.env'
const TARGET_FILE = '.env.tidb'
const TABLES = ['users', 'bookings'] // parent table first
const write = process.argv.includes('--yes')

function dbFrom(file) {
  if (!existsSync(file)) {
    console.error(`✗ ${file} not found. Copy .env.example to ${file} and fill in the ${file === TARGET_FILE ? 'TiDB' : 'local'} values.`)
    process.exit(1)
  }
  const e = parseEnv(readFileSync(file, 'utf8'))
  return {
    host: e.DB_HOST || 'localhost',
    port: Number(e.DB_PORT || 3306),
    user: e.DB_USER,
    password: e.DB_PASSWORD || '',
    database: e.DB_NAME || 'clicksy',
    ssl: /^(1|true|yes)$/i.test(e.DB_SSL || '') ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  }
}

const sourceDb = dbFrom(SOURCE_FILE)
const targetDb = dbFrom(TARGET_FILE)
if (sourceDb.host === targetDb.host && sourceDb.port === targetDb.port && sourceDb.database === targetDb.database) {
  console.error('✗ .env and .env.tidb point at the same database — nothing to copy.')
  process.exit(1)
}

const source = createDbPool(sourceDb)
const target = createDbPool(targetDb)

async function connect(pool, db, label) {
  try {
    const flavor = await describeServer(pool)
    console.log(`${label}: ${flavor} — ${db.user}@${db.host}:${db.port}/${db.database}${db.ssl ? ' (TLS)' : ''}`)
  } catch (err) {
    console.error(`✗ ${label}: ${explainDbError(err, db)}`)
    process.exit(1)
  }
}

try {
  await connect(source, sourceDb, 'From (local)')
  await connect(target, targetDb, 'To   (cloud)')
  console.log(write ? '\nMode: COPY\n' : '\nMode: dry run (add -- --yes to copy)\n')

  if (write) await applySchema(target)

  // Local user ids that belong to a DIFFERENT person in the cloud: never attach their bookings.
  const clashingUserIds = new Set()

  for (const table of TABLES) {
    const [rows] = await source.query(`SELECT * FROM \`${table}\` ORDER BY id`)
    let existing = new Set()
    try {
      const [ids] = await target.query(`SELECT id FROM \`${table}\``)
      existing = new Set(ids.map((r) => r.id))
    } catch {
      /* table not created yet (dry run) — everything would be new */
    }
    if (table === 'users' && existing.size) {
      const [cloudUsers] = await target.query('SELECT id, email FROM users')
      const byId = new Map(cloudUsers.map((u) => [u.id, u.email]))
      for (const r of rows) if (byId.has(r.id) && byId.get(r.id) !== r.email) clashingUserIds.add(r.id)
      if (clashingUserIds.size) console.log(`⚠ user id(s) ${[...clashingUserIds].join(', ')} are used by someone else in the cloud — their bookings are skipped`)
    }
    const fresh = rows.filter(
      (r) => !existing.has(r.id) && !(table === 'bookings' && clashingUserIds.has(r.user_id)),
    )
    // Same email already in the cloud under another id (e.g. the owner created by the server):
    // keep the cloud row, skip the local one.
    if (table === 'users' && fresh.length) {
      try {
        const [emails] = await target.query('SELECT email FROM users')
        const taken = new Set(emails.map((r) => r.email))
        for (let i = fresh.length - 1; i >= 0; i--) if (taken.has(fresh[i].email)) fresh.splice(i, 1)
      } catch {
        /* dry run before tables exist */
      }
    }

    let inserted = 0
    if (write) {
      for (const row of fresh) {
        const cols = Object.keys(row)
        const [res] = await target.query(
          `INSERT IGNORE INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (?)`,
          [cols.map((c) => row[c])],
        )
        inserted += res.affectedRows
      }
    }
    console.log(
      `${table.padEnd(9)} local ${String(rows.length).padStart(3)} · already in cloud ${String(rows.length - fresh.length).padStart(3)} · ${write ? `copied ${inserted}` : `would copy ${fresh.length}`}`,
    )
  }

  if (write) {
    const [[orphans]] = await target.query(
      'SELECT COUNT(*) AS n FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE u.id IS NULL',
    )
    console.log(orphans.n === 0 ? '\n✓ Every booking belongs to a user in the cloud database.' : `\n⚠ ${orphans.n} booking(s) have no matching user.`)
  }
  console.log('\nThe local database was only read. Nothing was deleted anywhere.')
} catch (err) {
  console.error(`\n✗ ${explainDbError(err)}`)
  process.exitCode = 1
} finally {
  await source.end()
  await target.end()
}
