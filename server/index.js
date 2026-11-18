import { createApp } from './app.js'
import { config } from './config.js'
import { explainDbError, initDb } from './db.js'
import { mailEnabled } from './mailer.js'

try {
  await initDb()
} catch (err) {
  console.error(`\n✗ MySQL: ${explainDbError(err)}\n`)
  process.exit(1)
}

createApp().listen(config.port, () => {
  console.log(`✓ MySQL connected as "${config.db.user}" (database "${config.db.database}")`)
  console.log(`✓ API running on http://localhost:${config.port}`)
  console.log(
    mailEnabled
      ? `✓ Emails are sent from ${config.mail.user}`
      : '⚠  Email not configured — sign-in codes will be printed in this terminal.',
  )
})
