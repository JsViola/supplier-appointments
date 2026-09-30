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
import './calendar.css'

const locales = {}
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

export default function AdminPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [events, setEvents] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())

  // Runs once when the page loads: confirms someone is logged in
  // before showing any appointment data. Sends anyone not logged
  // in straight to the login page.
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

  // Runs once when the page loads: fetches every appointment row
  // and converts each into an event object the calendar understands.
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

  // While the login check above is still running, show this instead
  // of the calendar, so appointment data never briefly flashes on
  // screen before the redirect happens.
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Checking login…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">Delivery appointments</h1>
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
      <div style={{ height: 650 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={['month']}
          defaultView="month"
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          eventPropGetter={(event) => {
            const colors = {
              pending: '#f59e0b',
              confirmed: '#16a34a',
              cancelled: '#dc2626',
            }
            return {
              style: {
                backgroundColor: colors[event.resource.status] || '#2563eb',
              },
            }
          }}
          onSelectEvent={(event) => {
            const a = event.resource
            const itemLines = (a.items || [])
              .map((it, i) =>
                `  ${i + 1}. ${it.item_name}${it.brand ? ' (' + it.brand + ')' : ''} — ` +
                `Qty: ${it.quantity || '-'} ${it.unit_of_measurement || ''}, ` +
                `Boxes: ${it.number_of_boxes || '-'} @ ${it.box_size || 'n/a'}`
              )
              .join('\n')

            alert(
              `PO Number: ${a.po_number}\n` +
              `Supplier: ${a.supplier}\n` +
              `Delivery terms: ${a.delivery_terms || 'n/a'}\n` +
              `Items:\n${itemLines}\n` +
              `Contact: ${a.contact_number}\n` +
              `Status: ${a.status}`
            )
          }}
        />
      </div>
    </div>
  )
}