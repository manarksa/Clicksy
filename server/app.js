import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { authRouter, loadUser } from './auth.js'
import { bookingsRouter } from './bookings.js'

/** The Express app with every route. index.js starts it; smoke-test.js tests it. */
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '50kb' }))
  app.use('/api', loadUser)
  app.use('/api/auth', authRouter)
  app.use('/api', bookingsRouter)
  app.use('/api', (_req, res) => res.status(404).json({ error: 'notFound' }))

  // After `npm run build`, the same server also hands out the website (npm start → http://localhost:4000).
  const dist = fileURLToPath(new URL('../dist', import.meta.url))
  if (existsSync(dist)) {
    app.use(express.static(dist))
    app.get('/{*splat}', (_req, res) => res.sendFile('index.html', { root: dist }))
  }

  app.use((err, _req, res, _next) => {
    console.error('✗', err.message)
    res.status(500).json({ error: 'server' })
  })
  return app
}
