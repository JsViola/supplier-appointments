'use client'
 
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './datepicker.css'
import { toast } from 'sonner'
import HospitalHeader from '@/components/HospitalHeader'
import { Turnstile } from '@marsidev/react-turnstile'
import { getDeliveryWindow, isSelectableDeliveryDate } from '@/lib/holidays'
 
// react-datepicker works with real Date objects, but we store dates as
// plain 'YYYY-MM-DD' strings everywhere else (form state, Supabase).
// These two convert between the two without the timezone shift that
// `new Date('2026-10-15')` on its own can cause.
function parseDate(str) {
  return str ? new Date(`${str}T00:00:00`) : null
}
 
function formatDate(date) {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
 
// Country calling codes offered in the contact number field. `min` and
// `max` are the allowed digit counts AFTER the country code. +63 is
// strict (Philippine mobile numbers are exactly 10 digits and start
// with 9). The others are typical lengths, deliberately a little wide so
// real numbers are not rejected; adjust any line, or add new ones, as
// needed.
const COUNTRY_CODES = [
  { code: '+63', label: 'PH +63', min: 10, max: 10 },
  { code: '+1', label: 'US/CA +1', min: 10, max: 10 },
  { code: '+44', label: 'UK +44', min: 9, max: 10 },
  { code: '+61', label: 'AU +61', min: 9, max: 9 },
  { code: '+65', label: 'SG +65', min: 8, max: 8 },
  { code: '+852', label: 'HK +852', min: 8, max: 8 },
  { code: '+86', label: 'CN +86', min: 11, max: 11 },
  { code: '+81', label: 'JP +81', min: 9, max: 10 },
  { code: '+82', label: 'KR +82', min: 9, max: 10 },
  { code: '+91', label: 'IN +91', min: 10, max: 10 },
  { code: '+60', label: 'MY +60', min: 9, max: 10 },
  { code: '+62', label: 'ID +62', min: 9, max: 12 },
  { code: '+66', label: 'TH +66', min: 8, max: 9 },
  { code: '+84', label: 'VN +84', min: 9, max: 10 },
  { code: '+886', label: 'TW +886', min: 9, max: 9 },
  { code: '+971', label: 'AE +971', min: 8, max: 9 },
  { code: '+966', label: 'SA +966', min: 9, max: 9 },
  { code: '+49', label: 'DE +49', min: 10, max: 12 },
  { code: '+33', label: 'FR +33', min: 9, max: 9 },
]
 
const emptyItem = {
  item_number: '',
  number_of_boxes: '',
  box_size: '',
}
 
// Item numbers the client can pick from in a partial delivery
const ITEM_NUMBERS = Array.from({ length: 50 }, (_, i) => String(i + 1))
 
export default function BookPage() {
  const [form, setForm] = useState({
    po_number: '',
    supplier: '',
    confirmation_po_date: '',
    delivery_terms: '',
    count_type: '',
    tentative_delivery_date: '',
    contact_number: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])
  const [deliveryType, setDeliveryType] = useState('') // '' | 'full' | 'partial'
  // Item numbers already used, so each number can only be picked once
  const usedNumbers = items.map((it) => it.item_number).filter(Boolean)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [countryCode, setCountryCode] = useState('+63')
  const [turnstileToken, setTurnstileToken] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const turnstileRef = useRef(null)
 
  // Small screens and touch devices get the calendar as a centered sheet,
  // and no keyboard. Follows the window if it is resized.
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse), (max-width: 40rem)')
    const update = () => setCoarse(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode)
 
  // Recalculates automatically whenever confirmation date, terms, or
  // count type change — null until all three are filled in.
  const deliveryWindow = getDeliveryWindow(
    form.confirmation_po_date,
    Number(form.delivery_terms),
    form.count_type
  )
 
  // If the client already picked a delivery date and then goes back and
  // changes the confirmation date, terms, or count type, the previously
  // picked date can fall outside the new window. Clear it automatically
  // rather than leaving a now-invalid date sitting in the field.
  useEffect(() => {
    if (
      form.tentative_delivery_date &&
      (!deliveryWindow || !isSelectableDeliveryDate(form.tentative_delivery_date, deliveryWindow, form.count_type))
    ) {
      setForm((f) => ({ ...f, tentative_delivery_date: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.confirmation_po_date, form.delivery_terms, form.count_type])
 
  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }
 
  // Keeps the P.O. Number locked to YYYY-MM-XXXX as the client types:
  // strips anything that isn't a digit, caps it at 10 digits total,
  // and inserts the two dashes automatically.
  function handlePoChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    let formatted = digits
    if (digits.length > 4) formatted = digits.slice(0, 4) + '-' + digits.slice(4)
    if (digits.length > 6) formatted = digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6)
    setForm({ ...form, po_number: formatted })
  }
 
  // Keeps the contact number digits-only and within the allowed length.
  // For +63 it also strips a pasted "63" or a leading 0, so typing or
  // pasting 09267405329 or +639267405329 both become 9267405329.
  function handleContactChange(e) {
    let digits = e.target.value.replace(/\D/g, '')
    if (countryCode === '+63') {
      if (digits.startsWith('63')) digits = digits.slice(2)
      if (digits.startsWith('0')) digits = digits.slice(1)
    }
    setForm({ ...form, contact_number: digits.slice(0, selectedCountry.max) })
  }
 
  function handleCountryChange(e) {
    const newCode = e.target.value
    const country = COUNTRY_CODES.find((c) => c.code === newCode)
    setCountryCode(newCode)
    setForm({ ...form, contact_number: form.contact_number.slice(0, country.max) })
  }
 
  function isContactValid() {
    const n = form.contact_number
    if (n.length < selectedCountry.min || n.length > selectedCountry.max) return false
    if (countryCode === '+63' && !n.startsWith('9')) return false
    return true
  }
 
  function handleItemChange(index, e) {
    const updated = [...items]
    updated[index] = { ...updated[index], [e.target.name]: e.target.value }
    setItems(updated)
  }
 
  // Switching between full and partial starts the items section fresh,
  // so numbers typed for one type never carry over into the other.
  function handleDeliveryTypeChange(e) {
    setDeliveryType(e.target.value)
    setItems([{ ...emptyItem }])
  }
 
  function addItem() {
    setItems([...items, { ...emptyItem }])
  }
 
  function removeItem(index) {
    setItems(items.filter((_, i) => i !== index))
  }
 
  function resetForm() {
    setForm({
      po_number: '',
      supplier: '',
      confirmation_po_date: '',
      delivery_terms: '',
      count_type: '',
      tentative_delivery_date: '',
      contact_number: '',
    })
    setItems([{ ...emptyItem }])
    setDeliveryType('')
    setCountryCode('+63')
    setError(null)
    setSubmitted(false)
    // Ask the bot check for a fresh token, since the old one may be used up
    setTurnstileToken(null)
    turnstileRef.current?.reset()
  }
 
  // "Are you sure" for Clear, as a toast with two buttons
  function askClear() {
    toast('Clear everything you entered?', {
      duration: 8000,
      action: { label: 'Clear', onClick: () => resetForm() },
      cancel: { label: 'Keep', onClick: () => {} },
    })
  }
 
  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
 
    if (!deliveryWindow || !isSelectableDeliveryDate(form.tentative_delivery_date, deliveryWindow, form.count_type)) {
      setError('Please choose a valid delivery date, within range and matching your selected count type.')
      return
    }
 
    if (!deliveryType) {
      setError('Please choose Full Delivery or Partial Delivery.')
      return
    }
 
    if (!isContactValid()) {
      setError(
        countryCode === '+63'
          ? 'Please enter a valid Philippine mobile number: 10 digits starting with 9.'
          : `Please enter a valid contact number (${selectedCountry.min}-${selectedCountry.max} digits).`
      )
      return
    }
 
    // A full delivery is saved as one item labeled "Full delivery". A partial
    // delivery saves one entry per line, sorted by item number, each with an
    // "Item N" label so the current admin popup still shows a readable name.
    const itemsToSave =
      deliveryType === 'full'
        ? [{
            item_name: 'Full delivery',
            number_of_boxes: items[0].number_of_boxes,
            box_size: items[0].box_size,
          }]
        : [...items]
            .sort((a, b) => Number(a.item_number) - Number(b.item_number))
            .map((it) => ({
              item_name: `Item ${it.item_number}`,
              item_number: it.item_number,
              number_of_boxes: it.number_of_boxes,
              box_size: it.box_size,
            }))
 
    if (!turnstileToken) {
      setError('Please wait for the verification check to finish, then try again.')
      return
    }
 
    // The form no longer talks to Supabase directly. It sends everything to
    // /api/book, which re-checks every rule on the server, verifies the bot
    // check, saves the appointment, and emails the admin. The contact number
    // is sent as one string with the country code, for example +639267405329.
    setSubmitting(true)
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          contact_number: `${countryCode}${form.contact_number}`,
          items: itemsToSave,
          turnstileToken,
        }),
      })
      const result = await res.json().catch(() => ({}))
 
      if (!res.ok) {
        setError(result.error || 'Something went wrong. Please try again.')
        // A used or failed token cannot be reused, so get a new one
        setTurnstileToken(null)
        turnstileRef.current?.reset()
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      console.error(err)
      setError('Could not reach the server. Please check your connection and try again.')
      setTurnstileToken(null)
      turnstileRef.current?.reset()
    } finally {
      setSubmitting(false)
    }
  }
 
  const prettyDate = (s) =>
    parseDate(s)?.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
 
  if (submitted) {
    return (
      <>
        <HospitalHeader>
          <Link href="/" className="navlink">Home</Link>
        </HospitalHeader>
        <main className="shell success">
          <h1 className="title rise" style={{ '--i': 0 }}>Request received</h1>
          <p className="lead text-soft rise" style={{ '--i': 1 }}>
            Your delivery appointment was saved. The Materials Management Section can now see it on the delivery calendar.
          </p>
          <div className="success-actions rise" style={{ '--i': 2 }}>
            <button type="button" className="btn btn-primary" onClick={resetForm}>Book another delivery</button>
            <Link href="/" className="btn btn-quiet">Back to home</Link>
          </div>
        </main>
      </>
    )
  }
 
  return (
    <>
      <HospitalHeader>
        <Link href="/" className="navlink">Home</Link>
      </HospitalHeader>
 
      <main className="shell form-page">
        <div className="form-intro">
          <h1 className="title rise" style={{ '--i': 0 }}>Book a delivery appointment</h1>
          <p className="lead text-soft rise" style={{ '--i': 1 }}>
            Copy the details from your purchase order. Every field is required unless it says optional.
          </p>
        </div>
 
        <form onSubmit={handleSubmit} className="stack">
          {/* Purchase order */}
          <section className="panel rise" style={{ '--i': 2 }} aria-labelledby="sec-po">
            <h2 id="sec-po" className="h2">Purchase order</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="P.O. number" htmlFor="po_number" hint="Year, month, then four digits. Dashes are added for you.">
                <input
                  id="po_number"
                  name="po_number"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  maxLength={12}
                  placeholder="2026-10-0613"
                  pattern="\d{4}-\d{2}-\d{4}"
                  title="Format: YYYY-MM-XXXX, for example 2026-10-0613"
                  value={form.po_number}
                  onChange={handlePoChange}
                  aria-describedby="po_number-hint"
                />
              </Field>
              <Field label="Supplier" htmlFor="supplier">
                <input
                  id="supplier"
                  name="supplier"
                  className="input"
                  type="text"
                  autoComplete="organization"
                  required
                  maxLength={150}
                  value={form.supplier}
                  onChange={handleChange}
                />
              </Field>
            </div>
          </section>
 
          {/* Delivery terms and the live window */}
          <section className="panel rise" style={{ '--i': 3 }} aria-labelledby="sec-terms">
            <h2 id="sec-terms" className="h2">Delivery terms</h2>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Confirmation P.O. date" htmlFor="confirmation_po_date" hint="Counting starts the day after.">
                <input
                  id="confirmation_po_date"
                  name="confirmation_po_date"
                  className="input"
                  type="date"
                  required
                  value={form.confirmation_po_date}
                  onChange={handleChange}
                  aria-describedby="confirmation_po_date-hint"
                />
              </Field>
              <Field label="Delivery terms (days)" htmlFor="delivery_terms" hint="The days stated on the P.O.">
                <input
                  id="delivery_terms"
                  name="delivery_terms"
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="365"
                  required
                  placeholder="30"
                  value={form.delivery_terms}
                  onChange={handleChange}
                  aria-describedby="delivery_terms-hint"
                />
              </Field>
              <Field label="Count type" htmlFor="count_type">
                <select
                  id="count_type"
                  name="count_type"
                  className="input"
                  required
                  value={form.count_type}
                  onChange={handleChange}
                >
                  <option value="">Select</option>
                  <option value="calendar">Calendar days</option>
                  <option value="working">Working days</option>
                </select>
              </Field>
            </div>
 
            <div className="notice" aria-live="polite">
              {deliveryWindow ? (
                <>
                  <p className="notice-title">
                    You can deliver from {prettyDate(deliveryWindow.start)} to {prettyDate(deliveryWindow.end)}.
                  </p>
                  <p className="small text-soft mt-1">
                    {form.count_type === 'working'
                      ? 'Working days: Monday to Friday count. Weekends and Philippine regular holidays are skipped, and you can only pick a working day.'
                      : 'Calendar days: every day counts, including weekends and holidays, and you can pick any day in the window.'}
                  </p>
                </>
              ) : (
                <p className="small">
                  Enter the confirmation date, the delivery terms, and the count type to see your delivery window.
                </p>
              )}
            </div>
          </section>
 
          {/* Delivery date */}
          <section className="panel rise" style={{ '--i': 4 }} aria-labelledby="sec-date">
            <h2 id="sec-date" className="h2">Delivery date</h2>
            <Field
              label="Tentative delivery date"
              htmlFor="tentative_delivery_date"
              hint={
                deliveryWindow
                  ? 'Days you cannot pick are greyed out.'
                  : 'Available once the delivery terms above are filled in.'
              }
            >
              <DatePicker
                id="tentative_delivery_date"
                selected={parseDate(form.tentative_delivery_date)}
                onChange={(date) => setForm({ ...form, tentative_delivery_date: formatDate(date) })}
                minDate={deliveryWindow ? parseDate(deliveryWindow.start) : null}
                maxDate={deliveryWindow ? parseDate(deliveryWindow.end) : null}
                filterDate={(date) =>
                  deliveryWindow ? isSelectableDeliveryDate(formatDate(date), deliveryWindow, form.count_type) : false
                }
                openToDate={deliveryWindow ? parseDate(deliveryWindow.start) : undefined}
                disabled={!deliveryWindow}
                required
                withPortal={coarse}
                customInput={<input inputMode={coarse ? 'none' : 'text'} />}
                autoComplete="off"
                placeholderText={deliveryWindow ? 'Choose a date' : 'Fill in the terms first'}
                dateFormat="MMM d, yyyy"
                className="input"
                wrapperClassName="dp-wrap"
              />
            </Field>
          </section>
 
          {/* Items */}
          <section className="panel rise" style={{ '--i': 5 }} aria-labelledby="sec-items">
            <h2 id="sec-items" className="h2">What you are delivering</h2>
            <Field label="Delivery type" htmlFor="delivery_type">
              <select
                id="delivery_type"
                className="input"
                required
                value={deliveryType}
                onChange={handleDeliveryTypeChange}
              >
                <option value="">Select delivery type</option>
                <option value="full">Full delivery</option>
                <option value="partial">Partial delivery</option>
              </select>
            </Field>
 
            {deliveryType === 'full' && (
              <div className="line">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Number of boxes" htmlFor="full_boxes">
                    <input
                      id="full_boxes"
                      name="number_of_boxes"
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      required
                      value={items[0].number_of_boxes}
                      onChange={(e) => handleItemChange(0, e)}
                    />
                  </Field>
                  <Field label="Size of boxes" htmlFor="full_size" optional>
                    <input
                      id="full_size"
                      name="box_size"
                      className="input"
                      type="text"
                      maxLength={50}
                      placeholder="small, medium, large, XL"
                      value={items[0].box_size}
                      onChange={(e) => handleItemChange(0, e)}
                    />
                  </Field>
                </div>
              </div>
            )}
 
            {deliveryType === 'partial' && (
              <div>
                <ul className="grid gap-3">
                  {items.map((item, index) => (
                    <li key={index} className="line">
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto]">
                        <Field label="Item number" htmlFor={`item_number_${index}`}>
                          <select
                            id={`item_number_${index}`}
                            name="item_number"
                            className="input"
                            required
                            value={item.item_number}
                            onChange={(e) => handleItemChange(index, e)}
                          >
                            <option value="">Select</option>
                            {ITEM_NUMBERS.filter((n) => n === item.item_number || !usedNumbers.includes(n)).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Number of boxes" htmlFor={`boxes_${index}`}>
                          <input
                            id={`boxes_${index}`}
                            name="number_of_boxes"
                            className="input"
                            type="number"
                            inputMode="numeric"
                            min="1"
                            required
                            value={item.number_of_boxes}
                            onChange={(e) => handleItemChange(index, e)}
                          />
                        </Field>
                        <div className="col-span-2 sm:col-span-1">
                          <Field label="Size of boxes" htmlFor={`size_${index}`} optional>
                            <input
                              id={`size_${index}`}
                              name="box_size"
                              className="input"
                              type="text"
                              maxLength={50}
                              placeholder="small, medium, large, XL"
                              value={item.box_size}
                              onChange={(e) => handleItemChange(index, e)}
                            />
                          </Field>
                        </div>
                        {index > 0 && (
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm col-span-2 sm:col-span-1 sm:self-end"
                            onClick={() => removeItem(index)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
 
                <button
                  type="button"
                  className="btn btn-quiet mt-4"
                  onClick={addItem}
                  disabled={items.length >= ITEM_NUMBERS.length}
                >
                  Add another item
                </button>
              </div>
            )}
          </section>
 
          {/* Contact */}
          <section className="panel rise" style={{ '--i': 6 }} aria-labelledby="sec-contact">
            <h2 id="sec-contact" className="h2">Contact</h2>
            <Field label="Mobile number" htmlFor="contact_number">
              <div className="flex gap-2">
                <select
                  aria-label="Country code"
                  className="input input-code"
                  value={countryCode}
                  onChange={handleCountryChange}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  id="contact_number"
                  name="contact_number"
                  className="input input-grow"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                  maxLength={selectedCountry.max}
                  placeholder={countryCode === '+63' ? '9XXXXXXXXX' : 'Phone number'}
                  value={form.contact_number}
                  onChange={handleContactChange}
                  aria-describedby="contact_number-hint"
                />
              </div>
              {countryCode === '+63' && form.contact_number && !form.contact_number.startsWith('9') ? (
                <p id="contact_number-hint" className="hint" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                  Philippine mobile numbers start with 9, for example 9267405329.
                </p>
              ) : (
                <p id="contact_number-hint" className="hint">
                  Digits only, no leading 0. {form.contact_number.length} of {selectedCountry.max} digits
                  {form.contact_number && ` · saved as ${countryCode}${form.contact_number}`}
                </p>
              )}
            </Field>
          </section>
 
          {/* Submit */}
          <div className="grid gap-4 rise" style={{ '--i': 7 }}>
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
              />
            </div>
 
            {error && <p className="error" role="alert">{error}</p>}
 
            <div className="actions">
              <button type="submit" className="btn btn-primary" disabled={submitting || !turnstileToken}>
                {submitting ? 'Submitting...' : 'Submit request'}
              </button>
              <button type="button" className="btn btn-quiet" onClick={askClear}>Clear form</button>
            </div>
          </div>
        </form>
      </main>
    </>
  )
}
 
// Label, the field itself, and an optional hint underneath
function Field({ label, htmlFor, hint, optional, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="label">
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      {children}
      {hint && <p id={`${htmlFor}-hint`} className="hint">{hint}</p>}
    </div>
  )
}
 