'use client'

import { useEffect, useState } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '@/lib/supabaseClient'
import 'react-big-calendar/lib/css/react-big-calendar.css'
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
  const [events, setEvents] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900">Delivery appointments</h1>
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
