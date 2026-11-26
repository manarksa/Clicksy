/**
 * Puts the photography packages into the database and links bookings to them.
 *
 *   npm run db:seed             → dry run: shows what would happen, changes nothing
 *   npm run db:seed -- --yes    → does it
 *   (add  --env .env.tidb  to pick another settings file)
 *
 * Steps with --yes (each one safe to run again):
 *  1. Creates missing tables from schema.sql (CREATE TABLE IF NOT EXISTS — nothing is dropped).
 *  2. Inserts the packages and features from seed-packages.sql with INSERT IGNORE
 *     (rows that already exist are left as they are).
 *  3. Adds the foreign key bookings.package_id → packages.package_id if it is not there yet,
 *     but only after checking that every existing booking points to a real package.
 * It never deletes or changes existing bookings, users or prices.
 */
import { applySchema, createDbPool, describeServer, explainDbError, runSqlFile } from './db.js'
import { config } from './config.js'

const write = process.argv.includes('--yes')
const pool = createDbPool()
const FK = 'fk_bookings_package'

const count = async (sql, params) => {
  try {
    const [[row]] = await pool.query(sql, params)
    return Number(row.n)
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return null
    throw err
  }
}
const hasFk = async () =>
  (await count(
    `SELECT COUNT(*) AS n FROM information_schema.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND CONSTRAINT_NAME = ?`,
    [FK],
  )) > 0

try {
  console.log(`Database: ${await describeServer(pool)} — ${config.db.user}@${config.db.host}/${config.db.database}`)
  console.log(write ? 'Mode: WRITE\n' : 'Mode: dry run (add -- --yes to apply)\n')

  const before = {
    packages: await count('SELECT COUNT(*) AS n FROM packages'),
    features: await count('SELECT COUNT(*) AS n FROM package_features'),
    bookings: await count('SELECT COUNT(*) AS n FROM bookings'),
  }
  console.log(`Now: packages ${before.packages ?? 'no table'} · features ${before.features ?? 'no table'} · bookings ${before.bookings ?? 'no table'} · FK ${(await hasFk()) ? 'present' : 'missing'}`)
  if (!write) {
    console.log('\nWould: create missing tables, insert 3 packages + 15 features (INSERT IGNORE), add the bookings → packages FK.')
    process.exit(0)
  }

  await applySchema(pool)
  const results = await runSqlFile(pool, 'seed-packages.sql')
  console.log(`Inserted: ${results[0].affectedRows} packages, ${results[1].affectedRows} features (existing rows kept as they are)`)

  if (await hasFk()) {
    console.log(`FK ${FK}: already present`)
  } else {
    const [orphans] = await pool.query(
      `SELECT DISTINCT b.package_id FROM bookings b LEFT JOIN packages p ON p.package_id = b.package_id
       WHERE p.package_id IS NULL`,
    )
    if (orphans.length) {
      console.error(`✗ Bookings use unknown packages (${orphans.map((o) => o.package_id).join(', ')}) — FK not added, nothing else changed.`)
      process.exit(1)
    }
    await pool.query(
      `ALTER TABLE bookings ADD CONSTRAINT ${FK} FOREIGN KEY (package_id)
       REFERENCES packages(package_id) ON DELETE RESTRICT ON UPDATE CASCADE`,
    )
    console.log(`FK ${FK}: added (every existing booking points to a real package)`)
  }
  const after = {
    packages: await count('SELECT COUNT(*) AS n FROM packages'),
    features: await count('SELECT COUNT(*) AS n FROM package_features'),
    bookings: await count('SELECT COUNT(*) AS n FROM bookings'),
  }
  console.log(`After: packages ${after.packages} · features ${after.features} · bookings ${after.bookings} (unchanged: ${after.bookings === before.bookings ? 'yes' : 'NO'})`)
} catch (err) {
  console.error(`\n✗ ${explainDbError(err)}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
