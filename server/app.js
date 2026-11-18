import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { authRouter, loadUser } from './auth.js'
import { bookingsRouter } from './bookings.js'
import { config } from './config.js'
import { pool } from './db.js'

/** The Express app with every route. index.js starts it; smoke-test.js tests it. */
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  // Behind Render's proxy: use the visitor's real IP (the login rate limit depends on it).
  if (config.production) app.set('trust proxy', 1)
  app.use(express.json({ limit: '50kb' }))

  // Render's health check: is the app up and can it reach the database?
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ ok: true })
    } catch {
      res.status(503).json({ ok: false })
    }
  })

  app.use('/api', loadUser)
  app.use('/api/auth', authRouter)
  app.use('/api', bookingsRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'notFound' }))

  // After `npm run build`, the same server hands out the website: one link for site + API.
  const dist = fileURLToPath(new URL('../dist', import.meta.url))
  if (existsSync(dist)) {
    // Vite file names contain a content hash, so they can be cached for a year.
    app.use('/assets', express.static(join(dist, 'assets'), { immutable: true, maxAge: '1y' }))
    app.use(express.static(dist, { index: false }))
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile('index.html', { root: dist })
    })
  } else if (config.production) {
    console.warn('⚠  dist/ is missing — run `npm run build` before `npm start`.')
  }

  app.use((err, _req, res, _next) => {
    console.error('✗', err.message)
    res.status(500).json({ error: 'server' })
  })
  return app
}
