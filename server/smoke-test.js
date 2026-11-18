/**
 * Real end-to-end check against your MySQL:  npm run test:db
 *
 * Starts the real API, then — through HTTP like the website does — creates a test client,
 * signs in with an email code, saves a booking, reads it back, and checks the rows in MySQL.
 * Emails are printed instead of sent. At the end it deletes ONLY the test client it created
 * (and that client's codes, sessions, and booking). Nothing else is touched.
 */
import { createHash } from 'node:crypto'

const { config } = await import('./config.js')
config.mail.user = '' // print emails instead of sending them during the test
const db = await import('./db.js')
try {
  await db.initDb()
} catch (err) {
  console.error(`\n✗ MySQL: ${db.explainDbError(err)}\n`)
  process.exit(1)
}
const { pool } = db // set by initDb()
const { createApp } = await import('./app.js')

const sha256 = (v) => createHash('sha256').update(v).digest('hex')
const server = createApp().listen(0)
await new Promise((r) => server.once('listening', r))
const base = `http://127.0.0.1:${server.address().port}/api`

let failures = 0
const check = (ok, label, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures += 1
}

function client() {
  let cookie = ''
  return async (path, { method, body } = {}) => {
    const res = await fetch(base + path, {
      method: method ?? (body ? 'POST' : 'GET'),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    return { status: res.status, data: await res.json().catch(() => ({})) }
  }
}

/** The real code was emailed (printed). The test swaps in a known one so it can type it. */
async function setKnownCode(userId, code = '123456') {
  await pool.query('UPDATE email_codes SET code_hash = ? WHERE user_id = ? AND used = 0', [sha256(code), userId])
  return code
}

const email = `smoke-${Date.now()}@test.clicksy.local`
const password = 'Sm0ke-test-pass'
let testUserId = null

try {
  console.log(`\nMySQL: ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}\n`)

  console.log('1) Create account')
  const c = client()
  let r = await c('/auth/register', { body: { name: 'Smoke Test', email, phone: '+966500000001', password } })
  check(r.status === 200 && r.data.pending, 'register asks for an email code', `HTTP ${r.status}`)
  const [[row]] = await pool.query('SELECT * FROM users WHERE email = ?', [email])
  testUserId = row?.id
  check(Boolean(row), 'user row saved in MySQL', row ? `users.id = ${row.id}` : 'missing')
  check(row?.password_hash.startsWith('$2') && !row.password_hash.includes(password), 'password stored as bcrypt hash, not plain text')
  check(row?.role === 'user' && row?.email_verified === 0, 'new account is a client, not verified yet')

  console.log('\n2) Email code')
  r = await c('/auth/verify', { body: { email, code: '000000' } })
  check(r.status === 400 && r.data.error === 'badCode', 'wrong code is rejected')
  r = await c('/auth/verify', { body: { email, code: await setKnownCode(testUserId) } })
  check(r.status === 200 && r.data.user?.role === 'user', 'right code signs the client in', `HTTP ${r.status}`)
  r = await c('/auth/me')
  check(r.status === 200 && r.data.user?.email === email, 'session cookie works (/auth/me)')
  const [[verified]] = await pool.query('SELECT email_verified FROM users WHERE id = ?', [testUserId])
  check(verified.email_verified === 1, 'email marked verified in MySQL')

  console.log('\n3) Save a booking')
  const nextYear = new Date().getFullYear() + 1
  r = await c('/bookings', {
    body: {
      packageId: 'signature', eventTypeId: 'wedding', hours: 5,
      eventDate: `${nextYear}-03-12`, location: 'Riyadh — test venue', notes: 'smoke test',
      totalPrice: 1, // the server must ignore this and compute 750 × 5
    },
  })
  check(r.status === 201, 'booking created', `HTTP ${r.status}`)
  check(r.data.booking?.totalPrice === 3750, 'price computed by the server, not the browser', `got ${r.data.booking?.totalPrice}`)
  const bookingId = r.data.booking?.id
  const [[saved]] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId])
  check(saved?.user_id === testUserId && saved?.event_date === `${nextYear}-03-12`, 'booking row saved in MySQL', `bookings.id = ${bookingId}`)

  console.log('\n4) Read it back')
  r = await c('/bookings')
  check(r.data.bookings?.some((b) => b.id === bookingId), 'client sees the booking from MySQL')
  r = await c(`/bookings/${bookingId}`, { method: 'PATCH', body: { status: 'confirmed' } })
  check(r.status === 403, 'client cannot change the status (owner only)')
  r = await c(`/bookings/${bookingId}`, { method: 'DELETE' })
  check(r.status === 403, 'client cannot delete a booking (owner only)')

  console.log('\n5) Sign out, sign in again')
  await c('/auth/logout', { method: 'POST' })
  r = await c('/auth/me')
  check(r.status === 401, 'signed out')
  r = await c('/auth/login', { body: { email, password: 'wrong-password' } })
  check(r.status === 401 && r.data.error === 'invalid', 'wrong password rejected')
  r = await c('/auth/login', { body: { email: "' OR 1=1 -- ", password: "' OR '1'='1" } })
  check(r.status === 401, 'SQL-injection style input rejected (parameterised queries)')
  r = await c('/auth/login', { body: { email, password } })
  check(r.status === 200 && r.data.pending, 'right password asks for a code')
  r = await c('/auth/verify', { body: { email, code: await setKnownCode(testUserId, '654321') } })
  check(r.status === 200, 'signed in again with the new code')
  r = await c('/bookings')
  check(r.data.bookings?.length === 1, 'booking still there after signing in again')

  console.log('\n6) Owner')
  if (!config.owner.email || !config.owner.password) {
    console.log('  – skipped: set OWNER_EMAIL and OWNER_PASSWORD in .env to test the owner desk')
  } else {
    const o = client()
    r = await o('/auth/login', { body: { email: config.owner.email, password: config.owner.password } })
    check(r.status === 200, 'owner password accepted', `HTTP ${r.status}`)
    const [[owner]] = await pool.query('SELECT id FROM users WHERE email = ?', [config.owner.email])
    r = await o('/auth/verify', { body: { email: config.owner.email, code: await setKnownCode(owner.id) } })
    check(r.data.user?.role === 'admin', 'owner is recognised as owner (role admin)')
    r = await o('/bookings')
    check(r.data.bookings?.some((b) => b.id === bookingId && b.packageName === 'Signature'), "owner sees the client's booking and package")
    r = await o('/clients')
    check(r.data.clients?.some((x) => x.email === email && x.bookingCount === 1), 'owner sees the client list')
    // Three identical confirms at once (double click / retry): only one may change the row and email.
    const many = await Promise.all(
      [1, 2, 3].map(() => o(`/bookings/${bookingId}`, { method: 'PATCH', body: { status: 'confirmed' } })),
    )
    const changedCount = many.filter((x) => x.data.changed).length
    const [[after]] = await pool.query('SELECT status FROM bookings WHERE id = ?', [bookingId])
    check(many.every((x) => x.status === 200) && after.status === 'confirmed', 'owner confirmed it — saved in MySQL')
    check(changedCount === 1, 'repeated confirm changes it once → one email only', `${changedCount} of 3 changed`)
    r = await o('/bookings/999999999', { method: 'PATCH', body: { status: 'confirmed' } })
    check(r.status === 404, 'confirming a missing booking fails cleanly')
    r = await o(`/bookings/${bookingId}`, { method: 'DELETE' })
    const [[gone]] = await pool.query('SELECT COUNT(*) n FROM bookings WHERE id = ?', [bookingId])
    check(r.status === 200 && gone.n === 0, 'owner deleted it — removed from MySQL')
    await o('/auth/logout', { method: 'POST' })
  }
} catch (err) {
  failures += 1
  console.error('\n✗ Test crashed:', err.message)
} finally {
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = ? AND email LIKE ?', [testUserId, 'smoke-%@test.clicksy.local'])
    console.log('\nCleanup: removed only the test client and its booking/codes/sessions.')
  }
  server.close()
  await pool.end()
  console.log(failures ? `\n✗ ${failures} check(s) failed\n` : '\n✓ All checks passed — the site is really connected to MySQL.\n')
  process.exit(failures ? 1 : 0)
}
