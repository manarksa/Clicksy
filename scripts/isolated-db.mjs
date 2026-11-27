// node scripts/isolated-db.mjs prep|drop — creates (empty, with the six tables + packages) or removes
// the throw-away database clicksy_test on the same server as .env. Never touches the real database.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { parseEnv } from 'node:util'
import mysql from 'mysql2/promise'

const TEST = 'clicksy_test'
const e = parseEnv(readFileSync('.env', 'utf8'))
const c = await mysql.createConnection({
  host: e.DB_HOST, port: Number(e.DB_PORT), user: e.DB_USER, password: e.DB_PASSWORD,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true, verifyIdentity: true },
})
if (process.argv[2] === 'prep') {
  await c.query(`DROP DATABASE IF EXISTS ${TEST}`)
  await c.query(`CREATE DATABASE ${TEST}`)
  const seed = spawnSync(process.execPath, ['server/seed-packages.js', '--yes'], { env: { ...process.env, DB_NAME: TEST }, encoding: 'utf8' })
  if (seed.status !== 0 || !seed.stdout.includes(`/${TEST}`)) { console.error('could not prepare the test database'); process.exit(1) }
} else if (process.argv[2] === 'drop') {
  await c.query(`DROP DATABASE IF EXISTS ${TEST}`)
}
await c.end()
