import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const env = process.env

export const config = {
  port: Number(env.PORT || 4000),
  production: env.NODE_ENV === 'production',
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'clicksy',
  },
  owner: {
    name: env.OWNER_NAME || 'Studio Owner',
    email: (env.OWNER_EMAIL || '').trim().toLowerCase(),
    password: env.OWNER_PASSWORD || '',
  },
  mail: {
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || 'Clicksy <no-reply@clicksy.local>',
  },
}
