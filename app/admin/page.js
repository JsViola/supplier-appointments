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

export default function AdminPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [events, setEvents] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [moreEvents, setMoreEvents] = useState(null) // { date, events }

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

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Delivery appointments</h1>
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
              const day = date.getDay() // 0 = Sun, 5 = Fri, 6 = Sat
              const isWeekend = day === 0 || day === 5 || day === 6

              if (holiday) {
                return { style: { backgroundColor: '#fee2e2' } } // light red
              }
              if (isWeekend) {
                return { style: { backgroundColor: '#f3f4f6' } } // grey
              }
              return {}
            }}
            eventPropGetter={(event) => {
              const colors = {
                pending: '#f59e0b',
                delivered: '#16a34a',
                confirmed: '#16a34a',
                cancelled: '#dc2626',
              }
              return {
                style: {
                  backgroundColor: colors[event.resource.status] || '#2563eb',
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
              <p>
                <span className="font-medium text-gray-900">Delivery terms:</span>{' '}
                {selectedAppt.delivery_terms ? `${selectedAppt.delivery_terms} days` : 'n/a'}
                {selectedAppt.count_type &&
                  ` · ${selectedAppt.count_type === 'working' ? 'Working Days' : 'Calendar Days'}`}
              </p>
              <p><span className="font-medium text-gray-900">Delivery date:</span> {selectedAppt.tentative_delivery_date}</p>
              <p><span className="font-medium text-gray-900">Contact:</span> {selectedAppt.contact_number}</p>

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
                        Qty: {it.quantity || '-'} {it.unit_of_measurement || ''} ·
                        {' '}Boxes: {it.number_of_boxes || '-'} @ {it.box_size || 'n/a'}
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
    </div>
  )
}