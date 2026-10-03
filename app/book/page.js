'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { supabase } from '@/lib/supabaseClient'
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

const emptyItem = {
  item_name: '',
  brand: '',
  unit_of_measurement: '',
  quantity: '',
  number_of_boxes: '',
  box_size: '',
}

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
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

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

  function handleItemChange(index, e) {
    const updated = [...items]
    updated[index] = { ...updated[index], [e.target.name]: e.target.value }
    setItems(updated)
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

    const { error } = await supabase.from('appointments').insert([{ ...form, items }])

    if (error) {
      setError('Something went wrong. Please try again.')
      console.error(error)
    } else {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
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
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-sm p-8">
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
            <p className="text-xs text-gray-400 mt-1">The date the P.O. was confirmed — this is when the delivery countdown starts, not today's date.</p>
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
              Calendar Days counts every day, weekends and holidays included. Working Days counts Monday–Thursday only.
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
                  ? ' (Monday–Thursday only, holidays excluded)'
                  : ' (any day, weekends and holidays included)'}
              </p>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Items</h2>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 font-medium hover:text-blue-700"
              >
                + Add item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4 relative">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-xs font-medium text-gray-400 mb-3">Item {index + 1}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Field
                        label="Item name"
                        name="item_name"
                        value={item.item_name}
                        onChange={(e) => handleItemChange(index, e)}
                        required
                      />
                    </div>
                    <Field
                      label="Brand (optional)"
                      name="brand"
                      value={item.brand}
                      onChange={(e) => handleItemChange(index, e)}
                    />
                    <Field
                      label="Unit of measurement"
                      name="unit_of_measurement"
                      value={item.unit_of_measurement}
                      onChange={(e) => handleItemChange(index, e)}
                      placeholder="e.g. pcs, kg"
                    />
                    <Field
                      label="Quantity"
                      name="quantity"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, e)}
                      required
                    />
                    <Field
                      label="Number of boxes"
                      name="number_of_boxes"
                      type="number"
                      value={item.number_of_boxes}
                      onChange={(e) => handleItemChange(index, e)}
                    />
                    <div className="col-span-2">
                      <Field
                        label="Size of boxes"
                        name="box_size"
                        value={item.box_size}
                        onChange={(e) => handleItemChange(index, e)}
                        placeholder="e.g. 12x12x12 in"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Contact number" name="contact_number" value={form.contact_number} onChange={handleChange} required />

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