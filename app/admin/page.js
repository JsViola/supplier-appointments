'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '@/lib/supabaseClient'
import { getHoliday } from '@/lib/holidays'
import './calendar.css'

const locales = {}
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

// Replaces the plain date number in each month-view cell. Sets its own
// text color directly (rather than relying on calendar.css, which only
// targets the default button element this component replaces) and adds
// a small red label underneath when the date is a regular holiday.
// react-big-calendar passes `isOffRange` for dates belonging to the
// previous/next month that spill into the grid.
function CustomDateHeader({ date, label, isOffRange }) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const holiday = getHoliday(dateStr)

  return (
    <div className="text-right">
      <span className={`text-sm font-medium ${isOffRange ? 'text-gray-300' : 'text-gray-900'}`}>
        {label}
      </span>
      {holiday && (
        <div
          className="text-[9px] text-red-600 font-medium leading-tight truncate"
          title={holiday.name}
        >
          {holiday.name}
        </div>
      )}
    </div>
  )
}

const STATUS_COLORS = {
  pending: '#f59e0b',
  delivered: '#16a34a',
  confirmed: '#16a34a',
  cancelled: '#dc2626',
}

// "Oct 25, 2026 · 3:42 PM", shown in the viewer's local time
function formatSubmitted(ts) {
  return ts ? format(new Date(ts), 'MMM d, yyyy · h:mm a') : 'n/a'
}

// A full delivery is saved as one item named "Full delivery"; partial
// items carry an item_number. Older appointments have neither, so they
// get no label.
function getDeliveryType(appt) {
  const first = (appt.items || [])[0]
  if (!first) return null
  if (first.item_name === 'Full delivery') return 'Full delivery'
  if (first.item_number) return 'Partial delivery'
  return null
}

export default function AdminPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [events, setEvents] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [moreEvents, setMoreEvents] = useState(null) // { date, events }
  const [panelOpen, setPanelOpen] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/admin/login')
      } else {
        setCheckingAuth(false)
      }
    }
    checkAuth()
  }, [])

  useEffect(() => {
    async function loadAppointments() {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')

      if (error) {
        console.error(error)
        return
      }

      const mapped = data.map((appt) => {
        const start = new Date(`${appt.tentative_delivery_date}T00:00:00`)

        return {
          title: `${appt.supplier} — PO ${appt.po_number}`,
          start,
          end: start,
          allDay: true,
          resource: appt,
        }
      })

      setEvents(mapped)
    }

    loadAppointments()
  }, [])

  // Confirms with the admin, deletes the row from Supabase, then removes
  // it from local state so the calendar updates immediately without a
  // full page reload.
  async function handleDelete(apptId) {
    const confirmed = window.confirm('Delete this appointment? This cannot be undone.')
    if (!confirmed) return

    const { error } = await supabase.from('appointments').delete().eq('id', apptId)

    if (error) {
      console.error(error)
      alert('Something went wrong deleting this appointment. Please try again.')
      return
    }

    setEvents((prev) => prev.filter((e) => e.resource.id !== apptId))
    setSelectedAppt(null)
  }

  // Saves the new status to Supabase, then updates both the calendar
  // events and the open popup so the color and the dropdown change
  // immediately without a reload.
  async function handleStatusChange(apptId, newStatus) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', apptId)

    if (error) {
      console.error(error)
      alert('Could not update the status. Please try again.')
      return
    }

    setEvents((prev) =>
      prev.map((e) =>
        e.resource.id === apptId
          ? { ...e, resource: { ...e.resource, status: newStatus } }
          : e
      )
    )
    setSelectedAppt((prev) => (prev ? { ...prev, status: newStatus } : prev))
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Checking login…
      </div>
    )
  }

  // Every appointment ordered by when it was submitted. map() makes a copy,
  // so sorting never changes the calendar's own data.
  const sortedAppts = events
    .map((e) => e.resource)
    .sort((a, b) =>
      newestFirst
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    )

  return (
    <div
      className={`min-h-screen bg-gray-50 p-3 sm:p-6 transition-[padding] duration-200 ${
        panelOpen ? 'lg:pr-[26rem]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Delivery appointments</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPanelOpen((open) => !open)}
            className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50"
          >
            {panelOpen ? 'Hide list' : 'Appointment list'}
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/admin/login')
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ height: 650, minWidth: 700 }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            views={['month']}
            defaultView="month"
            date={currentDate}
            onNavigate={(newDate) => setCurrentDate(newDate)}
            components={{
              month: {
                dateHeader: CustomDateHeader,
              },
            }}
            dayPropGetter={(date) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const holiday = getHoliday(dateStr)
              const day = date.getDay() // 0 = Sun, 6 = Sat
              const isWeekend = day === 0 || day === 6

              if (holiday) {
                return { style: { backgroundColor: '#fee2e2' } } // light red
              }
              if (isWeekend) {
                return { style: { backgroundColor: '#f3f4f6' } } // grey
              }
              return {}
            }}
            eventPropGetter={(event) => {
              return {
                style: {
                  backgroundColor: STATUS_COLORS[event.resource.status] || '#2563eb',
                },
              }
            }}
            onSelectEvent={(event) => setSelectedAppt(event.resource)}
            onShowMore={(events, date) => setMoreEvents({ date, events })}
          />
        </div>
      </div>

      {selectedAppt && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedAppt(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">PO {selectedAppt.po_number}</h2>
              <button
                onClick={() => setSelectedAppt(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <p><span className="font-medium text-gray-900">Supplier:</span> {selectedAppt.supplier}</p>
              <p><span className="font-medium text-gray-900">Confirmation P.O. date:</span> {selectedAppt.confirmation_po_date || 'n/a'}</p>
              <p>
                <span className="font-medium text-gray-900">Delivery terms:</span>{' '}
                {selectedAppt.delivery_terms ? `${selectedAppt.delivery_terms} days` : 'n/a'}
                {selectedAppt.count_type &&
                  ` · ${selectedAppt.count_type === 'working' ? 'Working Days' : 'Calendar Days'}`}
              </p>
              <p><span className="font-medium text-gray-900">Delivery date:</span> {selectedAppt.tentative_delivery_date}</p>
              {getDeliveryType(selectedAppt) && (
                <p><span className="font-medium text-gray-900">Delivery type:</span> {getDeliveryType(selectedAppt)}</p>
              )}
              <p><span className="font-medium text-gray-900">Contact:</span> {selectedAppt.contact_number}</p>
              <p><span className="font-medium text-gray-900">Submitted:</span> {formatSubmitted(selectedAppt.created_at)}</p>

              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">Status:</span>
                <select
                  value={selectedAppt.status}
                  onChange={(e) => handleStatusChange(selectedAppt.id, e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div>
                <p className="font-medium text-gray-900 mb-2">Items</p>
                <div className="space-y-2">
                  {(selectedAppt.items || []).map((it, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <p className="font-medium text-gray-900">
                        {it.item_name}{it.brand ? ` (${it.brand})` : ''}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {it.quantity ? `Qty: ${it.quantity} ${it.unit_of_measurement || ''} · ` : ''}
                        Boxes: {it.number_of_boxes || '-'}
                        {it.box_size ? ` · Size: ${it.box_size}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleDelete(selectedAppt.id)}
                className="w-full mt-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50 transition"
              >
                Delete appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {moreEvents && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setMoreEvents(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {format(moreEvents.date, 'MMMM d, yyyy')}
              </h2>
              <button
                onClick={() => setMoreEvents(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-2">
              {moreEvents.events.map((event, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedAppt(event.resource)
                    setMoreEvents(null)
                  }}
                  className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  {event.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Side panel: every appointment, by when it was submitted */}
      {panelOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setPanelOpen(false)}
        />
      )}
      <aside
        aria-hidden={!panelOpen}
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col transition-transform duration-200 ${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">All appointments</h2>
            <p className="text-xs text-gray-500">{sortedAppts.length} total</p>
          </div>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Close list"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-100">
          <button
            onClick={() => setNewestFirst((v) => !v)}
            className="text-sm text-blue-600 font-medium hover:text-blue-700"
          >
            {newestFirst ? 'Newest first ↓' : 'Oldest first ↑'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {sortedAppts.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No appointments yet.</p>
          )}
          {sortedAppts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAppt(a)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50"
            >
              <p className="text-sm font-medium text-gray-900">
                {a.supplier} · PO {a.po_number}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Submitted {formatSubmitted(a.created_at)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: STATUS_COLORS[a.status] || '#2563eb' }}
                />
                {a.status} · Delivery {a.tentative_delivery_date}
              </p>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
