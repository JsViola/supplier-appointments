import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDeliveryWindow, isSelectableDeliveryDate } from '@/lib/holidays'

// This file runs only on the server. It is the only place that talks to
// Supabase with the service role key, which bypasses Row Level Security.
// That key must never be given a NEXT_PUBLIC_ prefix and must never be
// used in a file that starts with 'use client'.

const PO_RE = /^\d{4}-\d{2}-\d{4}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PH_PHONE_RE = /^\+639\d{9}$/
const INTL_PHONE_RE = /^\+[1-9]\d{7,14}$/

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// Trims a value if it is a string, otherwise returns an empty string.
function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

// True only for a real calendar date in YYYY-MM-DD form (rejects 2026-02-31).
function isRealDate(s) {
  if (!DATE_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

// Asks Cloudflare whether the bot-check token is genuine and unused.
async function verifyTurnstile(token, ip) {
  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    })
    if (ip) body.append('remoteip', ip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    console.error('Turnstile verification request failed', err)
    return false
  }
}

// Checks every line and returns only the fields we expect, trimmed.
// A full delivery is a single line labeled "Full delivery". A partial
// delivery is one line per item number (1 to 50, each used once). Labels
// are rebuilt here so nobody can send a made-up item name.
function validateItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 50) {
    return { error: 'Please add between 1 and 50 lines.' }
  }

  const isFull =
    rawItems.length === 1 && clean(rawItems[0]?.item_name) === 'Full delivery'
  const seen = new Set()
  const items = []

  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i] || {}
    const n = i + 1

    const number_of_boxes = clean(String(it.number_of_boxes ?? ''))
    const box_size = clean(it.box_size)

    if (
      !number_of_boxes ||
      number_of_boxes.length > 20 ||
      !Number.isFinite(Number(number_of_boxes)) ||
      Number(number_of_boxes) <= 0
    ) {
      return { error: `Line ${n}: enter the number of boxes (more than 0).` }
    }
    if (box_size.length > 50) return { error: `Line ${n}: box size is too long.` }

    if (isFull) {
      items.push({ item_name: 'Full delivery', number_of_boxes, box_size })
      continue
    }

    const num = Number(clean(String(it.item_number ?? '')))
    if (!Number.isInteger(num) || num < 1 || num > 50) {
      return { error: `Line ${n}: choose an item number from 1 to 50.` }
    }
    if (seen.has(num)) {
      return { error: `Line ${n}: item number ${num} is used more than once.` }
    }
    seen.add(num)

    items.push({
      item_name: `Item ${num}`,
      item_number: String(num),
      number_of_boxes,
      box_size,
    })
  }
  return { items }
}

// Sends a short plain-text alert to the admin mailbox through Resend's
// web API (no extra package needed). Plain text on purpose, so nothing a
// supplier typed can be treated as formatting or a link. Only the P.O.
// number, supplier name, delivery date, and type are included; the contact
// number is left out so less personal data leaves the system.
// Skipped quietly if the email settings are missing.
async function sendAdminEmail({ po_number, supplier, tentative_delivery_date, items }) {
  if (!process.env.RESEND_API_KEY || !process.env.ADMIN_ALERT_EMAIL) {
    console.warn('api/book: email alert skipped, RESEND_API_KEY or ADMIN_ALERT_EMAIL is not set')
    return
  }

  const isFull = items.length === 1 && items[0].item_name === 'Full delivery'
  const deliveryType = isFull
    ? 'Full delivery'
    : `Partial delivery (${items.length} ${items.length === 1 ? 'item' : 'items'})`
  const submitted = new Date().toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const siteUrl = process.env.SITE_URL || 'https://lpgh-mms-deliveries.vercel.app'

  const text = [
    'A new delivery appointment was submitted.',
    '',
    `P.O. number: ${po_number}`,
    `Supplier: ${supplier.replace(/[\r\n]+/g, ' ')}`,
    `Delivery date: ${tentative_delivery_date}`,
    `Delivery type: ${deliveryType}`,
    `Submitted: ${submitted}`,
    '',
    `Review it: ${siteUrl}/admin`,
  ].join('\n')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LPGH Deliveries <onboarding@resend.dev>',
      to: [process.env.ADMIN_ALERT_EMAIL],
      subject: `New delivery appointment: PO ${po_number}`,
      text,
    }),
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) {
    console.error('api/book: Resend responded with', res.status, await res.text())
  }
}

export async function POST(request) {
  if (
    !process.env.TURNSTILE_SECRET_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL
  ) {
    console.error('api/book: a required environment variable is missing')
    return fail('The server is not set up correctly. Please contact the Materials Management Section.', 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return fail('Invalid request.')
  }
  if (!body || typeof body !== 'object') return fail('Invalid request.')

  // ---- Field checks: the same rules the form enforces, repeated here ----
  // because anything in the browser can be bypassed.
  const po_number = clean(body.po_number)
  if (!PO_RE.test(po_number)) return fail('P.O. number must look like 2026-10-0613.')

  const supplier = clean(body.supplier)
  if (!supplier || supplier.length > 150) return fail('Please enter the supplier name (150 characters at most).')

  const contact_number = clean(body.contact_number)
  const phoneOk = contact_number.startsWith('+63')
    ? PH_PHONE_RE.test(contact_number)
    : INTL_PHONE_RE.test(contact_number)
  if (!phoneOk) return fail('Please enter a valid contact number.')

  const confirmation_po_date = clean(body.confirmation_po_date)
  const tentative_delivery_date = clean(body.tentative_delivery_date)
  if (!isRealDate(confirmation_po_date) || !isRealDate(tentative_delivery_date)) {
    return fail('Please enter valid dates.')
  }

  const termDays = Number(body.delivery_terms)
  if (!Number.isInteger(termDays) || termDays < 1 || termDays > 365) {
    return fail('Delivery terms must be a whole number of days from 1 to 365.')
  }

  const count_type = clean(body.count_type)
  if (count_type !== 'calendar' && count_type !== 'working') {
    return fail('Please choose Calendar Days or Working Days.')
  }

  // Same delivery window logic the form uses (lib/holidays.js)
  const window = getDeliveryWindow(confirmation_po_date, termDays, count_type)
  if (!window || !isSelectableDeliveryDate(tentative_delivery_date, window, count_type)) {
    return fail('The delivery date is outside the allowed delivery period.')
  }

  const { items, error: itemsError } = validateItems(body.items)
  if (itemsError) return fail(itemsError)

  // ---- Bot check last, so a typo does not use up the token ----
  const token = clean(body.turnstileToken)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (!token || !(await verifyTurnstile(token, ip))) {
    return fail('Verification failed. Please try again.', 403)
  }

  // ---- Save. Only these fields are written; status is always pending ----
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await supabaseAdmin.from('appointments').insert([
    {
      po_number,
      supplier,
      confirmation_po_date,
      delivery_terms: String(termDays),
      count_type,
      tentative_delivery_date,
      contact_number,
      items,
      status: 'pending',
    },
  ])

  if (error) {
    console.error('api/book insert failed', error)
    return fail('Could not save the appointment. Please try again.', 500)
  }

  // Alert the admin. A failed email must never fail the booking, which is
  // already saved at this point.
  try {
    await sendAdminEmail({ po_number, supplier, tentative_delivery_date, items })
  } catch (err) {
    console.error('api/book: admin alert email failed', err)
  }

  return NextResponse.json({ ok: true })
}