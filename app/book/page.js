'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from '@/lib/supabaseClient'
import HospitalHeader from '@/components/HospitalHeader'
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

// Shared look for the compact one-line item fields
const labelClass = 'block text-xs font-medium text-gray-700 mb-1'
const inputClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'

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

    // Saved as one string with the country code, for example +639267405329
    const { error } = await supabase
      .from('appointments')
      .insert([{ ...form, contact_number: `${countryCode}${form.contact_number}`, items: itemsToSave }])

    if (error) {
      setError('Something went wrong. Please try again.')
      console.error(error)
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-3 sm:px-4 py-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-6 sm:p-8 text-center">
          <HospitalHeader />
          <hr className="my-5 sm:my-6 border-gray-200" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Request received</h1>
          <p className="text-gray-500 mb-6">We'll confirm your delivery appointment shortly.</p>
          <button
            onClick={resetForm}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Submit another appointment
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-3 sm:px-4 py-6 sm:py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-5 sm:p-8">
        <HospitalHeader />
        <hr className="my-5 sm:my-6 border-gray-200" />
        <Link
          href="/"
          className="inline-block text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          ← Back to home
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Book a delivery appointment</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">P.O. Number</label>
            <input
              name="po_number"
              type="text"
              inputMode="numeric"
              value={form.po_number}
              onChange={handlePoChange}
              required
              maxLength={12}
              placeholder="2026-10-0613"
              pattern="\d{4}-\d{2}-\d{4}"
              title="Format: YYYY-MM-XXXX, e.g. 2026-10-0613"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Format: YYYY-MM-XXXX (e.g. 2026-10-0613)</p>
          </div>
          <Field label="Supplier" name="supplier" value={form.supplier} onChange={handleChange} required />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmation P.O. Date</label>
            <input
              name="confirmation_po_date"
              type="date"
              required
              value={form.confirmation_po_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">The date the P.O. was confirmed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms (days)</label>
            <input
              name="delivery_terms"
              type="number"
              min="1"
              max="365"
              required
              value={form.delivery_terms}
              onChange={handleChange}
              placeholder="e.g. 30"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Enter the number of days stated in your P.O. contract.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Count Type</label>
            <select
              name="count_type"
              required
              value={form.count_type}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Select type</option>
              <option value="calendar">Calendar Days</option>
              <option value="working">Working Days</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Calendar Days counts every day, weekends and holidays included. Working Days counts Monday–Friday only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tentative delivery date</label>
            <DatePicker
              selected={parseDate(form.tentative_delivery_date)}
              onChange={(date) => setForm({ ...form, tentative_delivery_date: formatDate(date) })}
              minDate={deliveryWindow ? parseDate(deliveryWindow.start) : null}
              maxDate={deliveryWindow ? parseDate(deliveryWindow.end) : null}
              filterDate={(date) =>
                deliveryWindow ? isSelectableDeliveryDate(formatDate(date), deliveryWindow, form.count_type) : false
              }
              disabled={!deliveryWindow}
              required
              placeholderText={deliveryWindow ? 'Select a date' : 'Fill in the fields above first'}
              dateFormat="yyyy-MM-dd"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
            />
            {deliveryWindow && (
              <p className="text-xs text-gray-400 mt-1">
                Pickable range: {deliveryWindow.start} to {deliveryWindow.end}
                {form.count_type === 'working'
                  ? ' (Monday–Friday only, holidays excluded)'
                  : ' (any day, weekends and holidays included)'}
              </p>
            )}
          </div>

          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery type</label>
            <select
              value={deliveryType}
              onChange={handleDeliveryTypeChange}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Select delivery type</option>
              <option value="full">Full Delivery</option>
              <option value="partial">Partial Delivery</option>
            </select>

            {deliveryType === 'full' && (
              <div className="border border-gray-200 rounded-xl p-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Number of boxes"
                    name="number_of_boxes"
                    type="number"
                    value={items[0].number_of_boxes}
                    onChange={(e) => handleItemChange(0, e)}
                    required
                  />
                  <Field
                    label="Size of boxes"
                    name="box_size"
                    value={items[0].box_size}
                    onChange={(e) => handleItemChange(0, e)}
                    placeholder="e.g. small,medium,large,XL"
                  />
                </div>
              </div>
            )}

            {deliveryType === 'partial' && (
              <div className="mt-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Items</h2>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="relative border border-gray-200 rounded-xl p-3 sm:p-4">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="absolute -top-2.5 right-3 bg-white px-2 text-xs text-gray-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      )}

                      {/* Phones: item number and boxes on row one, box size below. Larger screens: one line of three. */}
                      <div className="grid grid-cols-2 sm:grid-cols-[5.5rem_6rem_1fr] gap-3">
                        <div>
                          <label className={labelClass}>Item number</label>
                          <select
                            name="item_number"
                            required
                            value={item.item_number}
                            onChange={(e) => handleItemChange(index, e)}
                            className={inputClass}
                          >
                            <option value="">Select</option>
                            {ITEM_NUMBERS.filter(
                              (n) => n === item.item_number || !usedNumbers.includes(n)
                            ).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>Number of boxes</label>
                          <input
                            name="number_of_boxes"
                            type="number"
                            min="1"
                            required
                            value={item.number_of_boxes}
                            onChange={(e) => handleItemChange(index, e)}
                            className={inputClass}
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className={labelClass}>Size of boxes</label>
                          <input
                            name="box_size"
                            value={item.box_size}
                            onChange={(e) => handleItemChange(index, e)}
                            placeholder="e.g. small,medium,large,XL"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={items.length >= ITEM_NUMBERS.length}
                  className="mt-4 text-sm text-blue-600 font-medium hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  + Add item
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact number</label>
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={handleCountryChange}
                className="w-28 flex-shrink-0 border border-gray-300 rounded-lg px-2 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                name="contact_number"
                type="tel"
                inputMode="numeric"
                required
                value={form.contact_number}
                onChange={handleContactChange}
                maxLength={selectedCountry.max}
                placeholder={countryCode === '+63' ? '9XXXXXXXXX' : 'Phone number'}
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            {countryCode === '+63' && form.contact_number && !form.contact_number.startsWith('9') ? (
              <p className="text-xs text-red-600 mt-1">Philippine mobile numbers start with 9 and has only 11 digits.</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                {form.contact_number && ` · will be saved as ${countryCode}${form.contact_number}`}
              </p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear everything you\'ve entered and start over?')) {
                  resetForm()
                }
              }}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 font-medium hover:bg-gray-50 transition"
            >
              Clear
            </button>
            <button
              type="submit"
              className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 font-medium hover:bg-gray-800 transition"
            >
              Submit request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', required = false, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
      />
    </div>
  )
}