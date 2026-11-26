/**
 * Creates (or refreshes) the read-only views in team-views.sql and lets the shared
 * Workbench account read them.   node server/team-views.js   [--env .env.tidb]
 * Changes no data and no table: views only, plus SELECT on those views for clicksy_team.
 */
import { createDbPool, explainDbError, runSqlFile } from './db.js'
import { config } from './config.js'

const VIEWS = ['team_users', 'team_bookings', 'team_sessions', 'team_email_codes']
// TiDB Cloud Starter puts a cluster prefix in front of every user name ("abc123.root").
const prefix = config.db.user.includes('.') ? config.db.user.split('.')[0] + '.' : ''
const TEAM = `${prefix}clicksy_team`
const pool = createDbPool()

try {
  await runSqlFile(pool, 'team-views.sql')
  console.log(`✓ views ready: ${VIEWS.join(', ')}`)
  const [[team]] = await pool.query('SELECT COUNT(*) AS n FROM mysql.user WHERE User = ?', [TEAM])
  if (!team.n) {
    console.log('– no clicksy_team account here: views created, no grants needed')
  } else {
    for (const v of VIEWS) await pool.query(`GRANT SELECT ON \`${config.db.database}\`.\`${v}\` TO ?@'%'`, [TEAM])
    console.log('✓ clicksy_team can read the views (read-only)')
  }
} catch (err) {
  console.error(`✗ ${explainDbError(err)}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
