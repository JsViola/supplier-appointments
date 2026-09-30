'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
    delivery_terms: '',
    tentative_delivery_date: '',
    contact_number: '',
  })
  const [items, setItems] = useState([{ ...emptyItem }])
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
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
      delivery_terms: '',
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Book a delivery appointment</h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="P.O. Number" name="po_number" value={form.po_number} onChange={handleChange} required />
          <Field label="Supplier" name="supplier" value={form.supplier} onChange={handleChange} required />
          <Field label="Delivery terms per P.O." name="delivery_terms" value={form.delivery_terms} onChange={handleChange} />
          <Field label="Tentative delivery date" name="tentative_delivery_date" type="date" value={form.tentative_delivery_date} onChange={handleChange} required />

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

          <button
            type="submit"
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 font-medium hover:bg-gray-800 transition"
          >
            Submit request
          </button>
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