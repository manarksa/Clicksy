import nodemailer from 'nodemailer'
import { config } from './config.js'

const { host, port, user, pass, from } = config.mail
const transport = user
  ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
  : null

export const mailEnabled = Boolean(transport)

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#fbf6f2;font-family:Arial,Helvetica,sans-serif;color:#4a2f38">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="font-size:22px;font-weight:700;color:#6b3a47;margin-bottom:20px">Clicksy</div>
    <div style="background:#fff;border:1px solid #ebdcd8;border-radius:18px;padding:28px">
      <h1 style="margin:0 0 14px;font-size:20px;color:#6b3a47">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="font-size:12px;color:#8a6a72;margin-top:18px">Clicksy Studio · Riyadh · Jeddah · Dammam</p>
  </div></body></html>`
}

/** Sends an email. Without SMTP settings it prints the message in the terminal instead. */
export async function sendMail({ to, subject, text, html }) {
  if (!transport) {
    console.log(`\n📧 [email not configured — printed here instead]\n   To: ${to}\n   Subject: ${subject}\n   ${text.replaceAll('\n', '\n   ')}\n`)
    return
  }
  try {
    await transport.sendMail({ from, to, subject, text, html })
  } catch (err) {
    console.error('✗ Email failed:', err.message)
    throw err
  }
}

export function codeEmail(to, name, code) {
  return sendMail({
    to,
    subject: `رمز الدخول ${code} — Clicksy sign-in code`,
    text: `مرحبًا ${name}\nرمز الدخول: ${code}\nصالح لمدة 10 دقائق.\n\nHi ${name}, your Clicksy code is ${code}. It expires in 10 minutes.\nIf this wasn't you, ignore this email.`,
    html: layout(
      'رمز الدخول · Sign-in code',
      `<p style="margin:0 0 6px">مرحبًا ${escape(name)} 👋</p>
       <p style="margin:0 0 18px;color:#8a6a72">Use this code to finish signing in. It expires in 10 minutes.</p>
       <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#5a2a3a;background:#f1e4e1;border-radius:14px;padding:16px;text-align:center">${code}</div>
       <p style="margin:18px 0 0;font-size:13px;color:#8a6a72">إذا لم تطلبوا هذا الرمز تجاهلوا الرسالة · If this wasn't you, ignore this email.</p>`,
    ),
  })
}

const statusAr = { pending: 'قيد المراجعة', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغى' }

function bookingRows(b) {
  const rows = [
    ['الباقة · Package', b.packageName],
    ['المناسبة · Event', b.eventTypeName],
    ['التاريخ · Date', b.eventDate],
    ['الساعات · Hours', b.hours],
    ['الموقع · Location', b.location],
    ['الإجمالي · Total', `${Number(b.totalPrice).toLocaleString('en-US')} SAR`],
  ]
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ebdcd8;color:#8a6a72">${k}</td><td style="padding:8px 0;border-bottom:1px solid #ebdcd8;font-weight:700;text-align:right">${escape(v)}</td></tr>`,
    )
    .join('')}</table>`
}

export function bookingReceivedEmail(b) {
  return sendMail({
    to: b.userEmail,
    subject: 'تم استلام حجزكم — Clicksy booking received',
    text: `Hi ${b.userName}, we received your booking for ${b.eventDate} (${b.packageName}). The studio will confirm soon.`,
    html: layout(
      'تم استلام حجزكم · Booking received',
      `<p style="margin:0 0 16px">سيراجع الاستوديو الحجز ويؤكده قريبًا. The studio will review and confirm shortly.</p>${bookingRows(b)}`,
    ),
  })
}

export function newBookingOwnerEmail(ownerEmail, b) {
  return sendMail({
    to: ownerEmail,
    subject: `حجز جديد من ${b.userName} — New booking`,
    text: `New booking from ${b.userName} (${b.userEmail}, ${b.userPhone || 'no phone'}) on ${b.eventDate}: ${b.packageName}, ${b.hours}h, ${b.location}. Notes: ${b.notes || '—'}`,
    html: layout(
      'حجز جديد · New booking',
      `<p style="margin:0 0 16px"><b>${escape(b.userName)}</b> · ${escape(b.userEmail)} · ${escape(b.userPhone || '—')}</p>${bookingRows(b)}
       ${b.notes ? `<p style="margin:16px 0 0;background:#f1e4e1;border-radius:10px;padding:10px"><b>ملاحظات · Notes:</b> ${escape(b.notes)}</p>` : ''}`,
    ),
  })
}

export function statusEmail(b) {
  return sendMail({
    to: b.userEmail,
    subject: `حالة الحجز: ${statusAr[b.status]} — Booking ${b.status}`,
    text: `Hi ${b.userName}, your booking on ${b.eventDate} is now ${b.status}.`,
    html: layout(
      `حالة الحجز: ${statusAr[b.status]} · ${b.status}`,
      `<p style="margin:0 0 16px">تم تحديث حالة حجزكم. Your booking status changed.</p>${bookingRows(b)}`,
    ),
  })
}
