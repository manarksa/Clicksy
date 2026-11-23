/**
 * Compare two Clicksy databases row by row, and (with --apply) bring the target up to date.
 *
 *   npm run db:verify                      compare .env.tidb (source) with .env (target) — changes nothing
 *   npm run db:sync                        sync source → target (see the safety rules below)
 *   node server/db-sync.js --baseline      remember the target as it is now (start point for conflict checks)
 *   node server/db-sync.js --from A --to B any two settings files (e.g. --from .env --to .env.tidb to roll back)
 *
 * Safety rules for --apply
 *  - The source is only read. Before writing, the whole target is saved to backups/ (git-ignored).
 *  - Nothing is deleted, unless --apply-deletes is given; even then only rows that were deleted on the
 *    source after the last sync AND are unchanged in the target since then.
 *  - Newer changes in the target are never overwritten: the tool keeps a snapshot of the target from
 *    the last sync (backups/db-sync-state.json). A row that changed in the target since then is a
 *    CONFLICT and is left alone (shown for a person to decide). --prefer-source overrides that.
 *  - --expect-quiet: the source must not change while syncing (proves that writes are really paused,
 *    e.g. no old server is still running). It is checked before and after; any change stops the move.
 *  - Sign-in sessions are copied (nobody is logged out). Sign-in codes are not (they last 10 minutes).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { applySchema, createDbPool, describeServer, explainDbError } from './db.js'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback
}
const has = (flag) => process.argv.includes(flag)
const FROM = arg('--from', '.env.tidb')
const TO = arg('--to', '.env')
const APPLY = has('--apply')
const APPLY_DELETES = has('--apply-deletes')
const PREFER_SOURCE = has('--prefer-source')
const EXPECT_QUIET = has('--expect-quiet')
const BASELINE = has('--baseline')
const QUIET_SECONDS = Number(arg('--quiet-seconds', '30'))
const STATE_FILE = 'backups/db-sync-state.json'

const TABLES = [
  { name: 'users', key: 'id', where: '' },
  { name: 'bookings', key: 'id', where: '' },
  { name: 'sessions', key: 'token_hash', where: '' },
]

function dbFrom(file) {
  if (!existsSync(file)) {
    console.error(`✗ ${file} not found.`)
    process.exit(1)
  }
  const e = parseEnv(readFileSync(file, 'utf8'))
  return {
    host: e.DB_HOST || 'localhost',
    port: Number(e.DB_PORT || 3306),
    user: e.DB_USER,
    password: e.DB_PASSWORD || '',
    database: e.DB_NAME || 'clicksy',
    ssl: /^(1|true|yes)$/i.test(e.DB_SSL || '')
      ? { minVersion: 'TLSv1.2', rejectUnauthorized: true, verifyIdentity: true, ...(e.DB_SSL_CA ? { ca: readFileSync(e.DB_SSL_CA) } : {}) }
      : undefined,
  }
}

const sourceDb = dbFrom(FROM)
const targetDb = dbFrom(TO)
if (sourceDb.host === targetDb.host && sourceDb.port === targetDb.port && sourceDb.database === targetDb.database) {
  console.error(`✗ ${FROM} and ${TO} point at the same database.`)
  process.exit(1)
}
const source = createDbPool(sourceDb)
const target = createDbPool(targetDb)
const targetId = `${targetDb.host}:${targetDb.port}/${targetDb.database}`

const norm = (v) => (v === null || v === undefined ? null : String(v))
const rowHash = (row) =>
  createHash('sha256').update(JSON.stringify(Object.keys(row).sort().map((k) => [k, norm(row[k])]))).digest('hex')
const short = (v) => (v === null ? 'NULL' : String(v).length > 24 ? String(v).slice(0, 21) + '…' : String(v))

async function rows(pool, t) {
  try {
    const [r] = await pool.query(`SELECT * FROM \`${t.name}\` ${t.where}`)
    return r
  } catch {
    return [] // table not created yet
  }
}

/** Fingerprint of every table (codes too): if it changes, someone is still writing. */
async function fingerprint(pool) {
  const h = createHash('sha256')
  for (const name of ['users', 'bookings', 'sessions', 'email_codes']) {
    const [r] = await pool.query(`SELECT * FROM \`${name}\``)
    const keyed = r.map((x) => rowHash(x)).sort()
    h.update(name + keyed.join(''))
  }
  return h.digest('hex')
}

async function snapshot(pool) {
  const snap = {}
  for (const t of TABLES) snap[t.name] = Object.fromEntries((await rows(pool, t)).map((r) => [String(r[t.key]), rowHash(r)]))
  return snap
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))[targetId] ?? null
  } catch {
    return null
  }
}
function saveState(snap) {
  mkdirSync('backups', { recursive: true })
  let all = {}
  try {
    all = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    /* first time */
  }
  all[targetId] = { savedAt: new Date().toISOString(), tables: snap }
  writeFileSync(STATE_FILE, JSON.stringify(all, null, 1))
}

let problems = 0
try {
  for (const [label, pool, db, file] of [['From', source, sourceDb, FROM], ['To  ', target, targetDb, TO]]) {
    try {
      console.log(`${label}: ${await describeServer(pool)} — ${db.host}/${db.database}${db.ssl ? ' (TLS)' : ''}  [${file}]`)
    } catch (err) {
      console.error(`✗ ${label.trim()} (${file}): ${explainDbError(err, db)}`)
      process.exit(1)
    }
  }

  if (BASELINE) {
    saveState(await snapshot(target))
    console.log(`\n✓ Baseline saved: the target as it is now is the starting point for conflict checks.`)
    process.exit(0)
  }

  const state = loadState()
  const base = state?.tables ?? null
  console.log(
    `\nMode: ${APPLY ? 'SYNC' : 'compare only (nothing is changed)'}` +
      `${APPLY_DELETES ? ' + deletes' : ''}${PREFER_SOURCE ? ' + prefer source' : ''}` +
      ` · last sync: ${state ? state.savedAt : 'none (differences count as conflicts)'}\n`,
  )

  let before
  if (EXPECT_QUIET) {
    const a = await fingerprint(source)
    process.stdout.write(`Checking that the source is quiet for ${QUIET_SECONDS}s … `)
    await new Promise((r) => setTimeout(r, QUIET_SECONDS * 1000))
    before = await fingerprint(source)
    if (a !== before) {
      console.log('✗ it changed. Something is still writing (an old server?). Nothing was synced.')
      process.exit(1)
    }
    console.log('✓ no writes')
  }

  if (APPLY) {
    mkdirSync('backups', { recursive: true })
    const dump = {}
    for (const t of [...TABLES, { name: 'email_codes', where: '' }]) dump[t.name] = await rows(target, t)
    const file = `backups/target-before-sync-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    writeFileSync(file, JSON.stringify({ target: targetId, tables: dump }))
    console.log(`Backup of the target: ${file}\n`)
    await applySchema(target)
  }

  // Same e-mail under a different id would break the unique e-mail rule: report, never touch.
  const blockedUsers = new Set()
  {
    const src = await rows(source, TABLES[0])
    const idByEmail = new Map((await rows(target, TABLES[0])).map((u) => [u.email, u.id]))
    for (const u of src) {
      const other = idByEmail.get(u.email)
      if (other !== undefined && other !== u.id) {
        blockedUsers.add(u.id)
        console.log(`⚠ users: the e-mail of id ${u.id} belongs to id ${other} in the target — skipped, needs a decision`)
        problems++
      }
    }
  }

  for (const t of TABLES) {
    const src = await rows(source, t)
    const dst = await rows(target, t)
    const dstBy = new Map(dst.map((r) => [String(r[t.key]), r]))
    const srcKeys = new Set(src.map((r) => String(r[t.key])))
    const was = base?.[t.name] ?? {}
    const blocked = (row) => (t.name === 'users' ? blockedUsers.has(row.id) : blockedUsers.has(row.user_id))

    const write = [] // insert or update from source
    const conflicts = []
    const deletes = [] // deleted on the source since last sync, untouched in target
    const keepOnlyTarget = []

    for (const row of src) {
      const k = String(row[t.key])
      const other = dstBy.get(k)
      if (blocked(row)) continue
      if (!other) {
        if (was[k]) conflicts.push({ k, why: 'deleted in the target after the last sync' })
        else write.push({ row, kind: 'new' })
        continue
      }
      const cols = Object.keys(row).filter((c) => norm(row[c]) !== norm(other[c]))
      if (!cols.length) continue
      const untouched = was[k] && was[k] === rowHash(other)
      const detail = cols.map((c) => (/hash/.test(c) ? `${c} (hash)` : `${c}: ${short(other[c])} → ${short(row[c])}`)).join(', ')
      if (untouched || PREFER_SOURCE) write.push({ row, kind: 'update', detail })
      else conflicts.push({ k, why: `changed in the target too (${detail})` })
    }
    for (const other of dst) {
      const k = String(other[t.key])
      if (srcKeys.has(k)) continue
      if (was[k] && was[k] === rowHash(other)) deletes.push(other)
      else keepOnlyTarget.push(other)
    }

    const news = write.filter((w) => w.kind === 'new').length
    console.log(
      `${t.name.padEnd(9)} source ${String(src.length).padStart(3)} · target ${String(dst.length).padStart(3)} · ` +
        `new ${news} · updated on source ${write.length - news} · conflicts ${conflicts.length} · ` +
        `deleted on source ${deletes.length} · only in target ${keepOnlyTarget.length}`,
    )
    for (const w of write.filter((x) => x.kind === 'update').slice(0, 10)) console.log(`    update ${t.key} ${short(w.row[t.key])}: ${w.detail}`)
    for (const c of conflicts.slice(0, 10)) console.log(`    ⚠ conflict ${t.key} ${short(c.k)}: ${c.why} — left as is`)
    for (const d of deletes.slice(0, 10)) console.log(`    deleted on source: ${t.key} ${short(d[t.key])}${APPLY && APPLY_DELETES ? ' — deleting' : ' — kept (use --apply-deletes)'}`)
    for (const x of keepOnlyTarget.slice(0, 10)) console.log(`    only in target (created there): ${t.key} ${short(x[t.key])} — kept`)
    problems += conflicts.length

    if (APPLY) {
      for (const { row } of write) {
        const cols = Object.keys(row)
        const updates = cols.filter((c) => c !== t.key).map((c) => `\`${c}\` = VALUES(\`${c}\`)`)
        await target.query(
          `INSERT INTO \`${t.name}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (?) ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
          [cols.map((c) => row[c])],
        )
      }
      if (APPLY_DELETES && deletes.length) {
        // A deleted user takes its bookings/sessions with it (ON DELETE CASCADE), as on the source.
        for (const d of deletes) await target.query(`DELETE FROM \`${t.name}\` WHERE \`${t.key}\` = ?`, [d[t.key]])
      }
      console.log(`    → written ${write.length}${APPLY_DELETES ? `, deleted ${deletes.length}` : ''}`)
    } else {
      problems += write.length
    }
  }

  if (EXPECT_QUIET && (await fingerprint(source)) !== before) {
    console.log('\n✗ The source changed DURING the sync: something is still writing. Do not switch over; run again once it is quiet.')
    problems++
  }

  if (APPLY) {
    saveState(await snapshot(target))
    let left = 0
    for (const t of TABLES) {
      const s = new Map((await rows(source, t)).map((r) => [String(r[t.key]), rowHash(r)]))
      const d = new Map((await rows(target, t)).map((r) => [String(r[t.key]), rowHash(r)]))
      for (const [k, h] of s) if (d.get(k) !== h) left++
    }
    console.log(left === 0 ? '\n✓ Every source row is now in the target, identical.' : `\n⚠ ${left} row(s) still differ (conflicts or blocked rows above).`)
    if (left) problems++
  } else {
    console.log(problems === 0 ? '\n✓ Identical: the target matches the source.' : `\n${problems} difference(s). Nothing was changed.`)
  }
  console.log(`The source (${FROM}) was only read.`)
} catch (err) {
  console.error(`\n✗ ${explainDbError(err)}`)
  problems++
} finally {
  await source.end()
  await target.end()
  process.exitCode = problems ? 1 : 0
}
