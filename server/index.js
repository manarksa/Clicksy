import { createApp } from './app.js'
import { config, envFile } from './config.js'
import { dbFlavor, explainDbError, initDb, pool } from './db.js'
import { mailProvider } from './mailer.js'

// A cloud database can be briefly unreachable while a new server boots (network warm-up).
// Retry those network errors a few times; wrong passwords etc. still stop at once.
const NETWORK_ERRORS = new Set([
  'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN',
  'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST',
])
const ATTEMPTS = 6
for (let attempt = 1; ; attempt++) {
  try {
    await initDb()
    break
  } catch (err) {
    await pool?.end().catch(() => {})
    const retry = NETWORK_ERRORS.has(err.code) && attempt < ATTEMPTS
    console.error(`\n✗ Database (attempt ${attempt}/${ATTEMPTS}): ${explainDbError(err)}`)
    if (!retry) process.exit(1)
    const wait = attempt * 5
    console.error(`  …trying again in ${wait}s`)
    await new Promise((r) => setTimeout(r, wait * 1000))
  }
}

const mail = {
  brevo: '✓ Emails are sent with Brevo (HTTPS API)',
  smtp: `✓ Emails are sent by SMTP as ${config.mail.user}`,
  console: '⚠  Email not configured — sign-in codes will be printed in this terminal.',
}

// Render (and most hosts) give the port in PORT and expect the app on all interfaces.
createApp().listen(config.port, '0.0.0.0', () => {
  console.log(`✓ ${dbFlavor} connected as "${config.db.user}" (database "${config.db.database}"${config.db.ssl ? ', TLS' : ''})`)
  console.log(`✓ Running on port ${config.port}${config.production ? ' (production)' : ''} · settings: ${process.env.RENDER ? 'host environment' : envFile}`)
  console.log(mail[mailProvider()])
})
