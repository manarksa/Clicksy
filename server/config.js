import { existsSync, readFileSync } from 'node:fs'

// Which env file to read: `--env .env.tidb` on the command line, else ENV_FILE, else .env.
// Variables already set by the host (Render) always win over the file.
const flag = process.argv.indexOf('--env')
export const envFile = flag > 0 ? process.argv[flag + 1] : process.env.ENV_FILE || '.env'
if (existsSync(envFile)) process.loadEnvFile(envFile)

const env = process.env
const on = (value) => /^(1|true|yes)$/i.test(String(value ?? ''))

/** "Clicksy <hello@x.com>" → { name: 'Clicksy', email: 'hello@x.com' } */
function parseAddress(value) {
  const m = String(value ?? '').match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  return m ? { name: m[1] || 'Clicksy', email: m[2] } : { name: 'Clicksy', email: String(value ?? '').trim() }
}

const from = env.MAIL_FROM || env.SMTP_USER || 'Clicksy <no-reply@clicksy.local>'

// A private-CA host (e.g. Aiven) needs its CA file. Fail loudly if the path is wrong,
// instead of a vague "self-signed certificate" error later.
if (on(env.DB_SSL) && env.DB_SSL_CA && !existsSync(env.DB_SSL_CA)) {
  console.error(`✗ DB_SSL_CA points to "${env.DB_SSL_CA}", but that file does not exist.`)
  process.exit(1)
}

export const config = {
  port: Number(env.PORT || 4000),
  /** READ_ONLY=true pauses every change (sign-up, sign-in, booking) — used while moving databases. */
  readOnly: on(env.READ_ONLY),
  /** Optional key for hashing email codes (see auth.js). Unset = derived from DB_PASSWORD. */
  codeSecret: env.CODE_SECRET || '',
  production: env.NODE_ENV === 'production',
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'clicksy',
    // TiDB Cloud (and most hosted MySQL) only accepts encrypted connections.
    ssl: on(env.DB_SSL)
      ? {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
          verifyIdentity: true, // also check the certificate is for DB_HOST (mysql2 skips this by default)
          ...(env.DB_SSL_CA ? { ca: readFileSync(env.DB_SSL_CA) } : {}),
        }
      : undefined,
  },
  owner: {
    name: env.OWNER_NAME || 'Studio Owner',
    email: (env.OWNER_EMAIL || '').trim().toLowerCase(),
    password: env.OWNER_PASSWORD || '',
  },
  mail: {
    /** brevo (HTTPS API) | smtp (e.g. Gmail) | console (print in terminal). Auto-detected if empty. */
    provider: (env.MAIL_PROVIDER || (env.BREVO_API_KEY ? 'brevo' : env.SMTP_USER ? 'smtp' : 'console')).toLowerCase(),
    from,
    sender: parseAddress(from),
    brevoKey: env.BREVO_API_KEY || '',
    brevoUrl: env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email',
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    /** MAIL_DISABLED=1 prints emails instead of sending (used by tests). */
    disabled: on(env.MAIL_DISABLED),
  },
}
