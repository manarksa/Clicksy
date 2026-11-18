import { createApp } from './app.js'
import { config, envFile } from './config.js'
import { dbFlavor, explainDbError, initDb } from './db.js'
import { mailProvider } from './mailer.js'

try {
  await initDb()
} catch (err) {
  console.error(`\n✗ Database: ${explainDbError(err)}\n`)
  process.exit(1)
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
