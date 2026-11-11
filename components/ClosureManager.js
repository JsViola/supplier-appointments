'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'

// Admin dialog for date closures (work suspensions and similar). Lists,
// adds, edits and deletes rows in public.date_closures using the signed-in
// admin's session; row level security allows only authenticated users.
// `closures` and `onChange` live in the admin page so the calendar behind
// the dialog updates at once.

const REASON_MAX = 200

function prettyDay(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function rangeLabel(c) {
  return c.start_date === c.end_date
    ? prettyDay(c.start_date)
    : `${prettyDay(c.start_date)} to ${prettyDay(c.end_date)}`
}

const emptyForm = { start_date: '', end_date: '', reason: '' }

export default function ClosureManager({ closures, appointments, onChange, onClose }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null) // row showing the "are you sure" step
  const [error, setError] = useState(null)

  // Escape closes the dialog; the page behind it stops scrolling.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  function handleField(e) {
    const { name, value } = e.target
    setForm((f) => {
      const next = { ...f, [name]: value }
      // Picking a start date after the end date moves the end date along,
      // and a single-day closure only needs the start date.
      if (name === 'start_date' && (!next.end_date || next.end_date < value)) next.end_date = value
      return next
    })
  }

  function startEdit(c) {
    setEditingId(c.id)
    setDeletingId(null)
    setError(null)
    setForm({ start_date: c.start_date, end_date: c.end_date, reason: c.reason })
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
    setForm(emptyForm)
  }

  // Existing appointments that sit inside the dates being saved. They are
  // not cancelled; the admin is only told so they can follow up.
  const affected =
    form.start_date && form.end_date && form.end_date >= form.start_date
      ? appointments.filter(
          (a) => a.tentative_delivery_date >= form.start_date && a.tentative_delivery_date <= form.end_date
        ).length
      : 0

  async function handleSave(e) {
    e.preventDefault()
    if (saving) return
    setError(null)

    const reason = form.reason.trim()
    if (!form.start_date || !form.end_date) return setError('Choose a start date and an end date.')
    if (form.end_date < form.start_date) return setError('The end date cannot be before the start date.')
    if (!reason) return setError('Enter a reason, for example Work Suspension.')
    if (reason.length > REASON_MAX) return setError(`The reason must be ${REASON_MAX} characters or fewer.`)

    setSaving(true)
    const payload = { start_date: form.start_date, end_date: form.end_date, reason }

    const query = editingId
      ? supabase.from('date_closures').update(payload).eq('id', editingId)
      : supabase.from('date_closures').insert([payload])
    const { data, error: saveError } = await query.select().single()
    setSaving(false)

    if (saveError) {
      console.error(saveError)
      setError('Could not save the blocked date. Please try again.')
      return
    }

    onChange(editingId ? closures.map((c) => (c.id === editingId ? data : c)) : [...closures, data])
    toast.success(editingId ? 'Blocked date updated' : 'Date blocked')
    cancelEdit()
  }

  async function handleDelete(id) {
    const { error: deleteError } = await supabase.from('date_closures').delete().eq('id', id)
    if (deleteError) {
      console.error(deleteError)
      toast.error('Could not delete this blocked date. Please try again.')
      return
    }
    onChange(closures.filter((c) => c.id !== id))
    setDeletingId(null)
    if (editingId === id) cancelEdit()
    toast.success('Blocked date deleted')
  }

  const sorted = [...closures].sort((a, b) => a.start_date.localeCompare(b.start_date))

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="closures-title"
        className="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <div className="min-w-0">
            <h2 id="closures-title" className="h2">Block date</h2>
            <p className="small text-soft mt-1">
              Blocked dates are unavailable to every supplier, Extension included.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="dialog-body">
          <form onSubmit={handleSave} className="grid gap-4" noValidate>
            <p className="label">{editingId ? 'Edit blocked date' : 'Block a date'}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="closure_start" className="label">Start date</label>
                <input
                  id="closure_start"
                  name="start_date"
                  type="date"
                  className="input"
                  required
                  value={form.start_date}
                  onChange={handleField}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor="closure_end" className="label">End date</label>
                <input
                  id="closure_end"
                  name="end_date"
                  type="date"
                  className="input"
                  required
                  min={form.start_date || undefined}
                  value={form.end_date}
                  onChange={handleField}
                />
              </div>
            </div>
            <div className="min-w-0">
              <label htmlFor="closure_reason" className="label">Reason</label>
              <input
                id="closure_reason"
                name="reason"
                type="text"
                className="input"
                required
                maxLength={REASON_MAX}
                placeholder="Work Suspension"
                value={form.reason}
                onChange={handleField}
              />
            </div>

            {affected > 0 && (
              <p className="small font-semibold" role="status">
                {affected} existing {affected === 1 ? 'appointment falls' : 'appointments fall'} on these dates.
                {' '}They are not cancelled or moved.
              </p>
            )}
            {error && <p className="error" role="alert">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
              </button>
              {editingId ? (
                <button type="button" className="btn btn-quiet" onClick={cancelEdit}>Cancel</button>
              ) : (
                <span />
              )}
            </div>
          </form>

          <div>
            <p className="label">Blocked dates ({sorted.length})</p>
            {sorted.length === 0 ? (
              <p className="small text-soft">No blocked dates yet.</p>
            ) : (
              <ul className="grid gap-2">
                {sorted.map((c) => (
                  <li key={c.id} className="item-row">
                    <strong className="break-words">{rangeLabel(c)}</strong>
                    <span className="small text-soft break-words">{c.reason}</span>
                    {deletingId === c.id ? (
                      <div className="grid gap-2 mt-2">
                        <p className="small font-semibold" role="alert">Delete this blocked date? Suppliers can book these dates again.</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setDeletingId(null)}>Keep</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => startEdit(c)}>Edit</button>
                        <button type="button" className="btn btn-danger-quiet btn-sm" onClick={() => { setDeletingId(c.id); setError(null) }}>Delete</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}