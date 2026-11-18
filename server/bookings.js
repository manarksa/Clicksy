import { Router } from 'express'
import { estimateTotal, eventTypes, packages } from '../src/data/catalog.ts'
import { config } from './config.js'
import { pool } from './db.js'
import { bookingReceivedEmail, newBookingOwnerEmail, statusEmail } from './mailer.js'
import { requireOwner, requireUser } from './auth.js'

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']
const MAX_HOURS = 16

const SELECT = `
  SELECT b.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
  FROM bookings b JOIN users u ON u.id = b.user_id`

function toBooking(r) {
  const event = eventTypes.find((e) => e.id === r.event_type_id)
  return {
    id: String(r.id),
    userId: String(r.user_id),
    userName: r.user_name,
    userEmail: r.user_email,
    userPhone: r.user_phone,
    packageId: r.package_id,
    packageName: r.package_name,
    eventTypeId: r.event_type_id,
    eventTypeName: r.custom_event_name || event?.name || r.event_type_id,
    customEventName: r.custom_event_name || undefined,
    hours: r.hours,
    eventDate: r.event_date,
    location: r.location,
    notes: r.notes || '',
    totalPrice: r.total_price,
    status: r.status,
    createdAt: r.created_at,
  }
}

async function findBooking(id) {
  const [rows] = await pool.query(`${SELECT} WHERE b.id = ?`, [id])
  return rows[0] ? toBooking(rows[0]) : null
}

/** Email failures must never lose a booking — log and move on. */
const quietly = (promise) => promise.catch(() => {})

export const bookingsRouter = Router()

bookingsRouter.get('/bookings', requireUser, async (req, res) => {
  const owner = req.user.role === 'admin'
  const [rows] = await pool.query(
    `${SELECT} ${owner ? '' : 'WHERE b.user_id = ?'} ORDER BY b.created_at DESC, b.id DESC`,
    owner ? [] : [req.user.id],
  )
  res.json({ bookings: rows.map(toBooking) })
})

bookingsRouter.post('/bookings', requireUser, async (req, res) => {
  if (req.user.role === 'admin') return res.status(403).json({ error: 'forbidden' })
  const body = req.body ?? {}

  // Prices come from the server's catalog, never from the browser.
  const pkg = packages.find((p) => p.id === body.packageId)
  const event = eventTypes.find((e) => e.id === body.eventTypeId)
  const custom = String(body.customEventName ?? '').trim().slice(0, 80)
  const hours = Math.round(Number(body.hours))
  const eventDate = String(body.eventDate ?? '')
  const location = String(body.location ?? '').trim().slice(0, 200)
  const notes = String(body.notes ?? '').trim().slice(0, 2000)
  const today = new Date().toISOString().slice(0, 10)

  if (!pkg || !event || (event.id === 'other' && !custom)) {
    return res.status(400).json({ error: 'invalid' })
  }
  if (!Number.isFinite(hours) || hours < pkg.minHours || hours > MAX_HOURS) {
    return res.status(400).json({ error: 'invalid' })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < today || !location) {
    return res.status(400).json({ error: 'needDetails' })
  }

  const [result] = await pool.query(
    `INSERT INTO bookings (user_id, package_id, package_name, event_type_id, custom_event_name,
       hours, event_date, location, notes, total_price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      pkg.id,
      pkg.name,
      event.id,
      event.id === 'other' ? custom : null,
      hours,
      eventDate,
      location,
      notes,
      estimateTotal(pkg.hourlyRate, hours),
    ],
  )
  const booking = await findBooking(result.insertId)
  quietly(bookingReceivedEmail(booking))
  if (config.owner.email) quietly(newBookingOwnerEmail(config.owner.email, booking))
  res.status(201).json({ booking })
})

bookingsRouter.patch('/bookings/:id', requireOwner, async (req, res) => {
  const status = String(req.body?.status ?? '')
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid' })
  const before = await findBooking(req.params.id)
  if (!before) return res.status(404).json({ error: 'notFound' })

  await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id])
  const booking = { ...before, status }
  if (before.status !== status) quietly(statusEmail(booking))
  res.json({ booking })
})

bookingsRouter.get('/clients', requireOwner, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, COUNT(b.id) AS booking_count
     FROM users u LEFT JOIN bookings b ON b.user_id = u.id
     WHERE u.role = 'user' AND u.email_verified = 1
     GROUP BY u.id ORDER BY u.created_at DESC`,
  )
  res.json({
    clients: rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      email: r.email,
      phone: r.phone,
      role: r.role,
      bookingCount: Number(r.booking_count),
    })),
  })
})
