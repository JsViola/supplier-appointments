'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import format from 'date-fns/format'
import parse from 'date-fns/parse'
import startOfWeek from 'date-fns/startOfWeek'
import getDay from 'date-fns/getDay'
import { toast } from 'sonner'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '@/lib/supabaseClient'
import { getHoliday } from '@/lib/holidays'
import { findClosure } from '@/lib/scheduling'
import HospitalHeader from '@/components/HospitalHeader'
import ClosureManager from '@/components/ClosureManager'
import './calendar.css'

const locales = {}
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })

// One place for status colours: the calendar blocks, the list dots, and
// the legend all read from here.
const STATUS_STYLE = {
  pending: { bg: '#fcd34d', fg: '#1b1400', label: 'Pending' },
  delivered: { bg: '#166534', fg: '#ffffff', label: 'Delivered' },
  confirmed: { bg: '#166534', fg: '#ffffff', label: 'Confirmed' },
  cancelled: { bg: '#b42318', fg: '#ffffff', label: 'Cancelled' },
}
const STATUS_FALLBACK = { bg: '#475569', fg: '#ffffff', label: 'Unknown' }
const statusStyle = (status) => STATUS_STYLE[status] || STATUS_FALLBACK

// "Oct 25, 2026 · 3:42 PM", in the viewer's local time
function formatSubmitted(ts) {
  return ts ? format(new Date(ts), 'MMM d, yyyy · h:mm a') : 'n/a'
}

// "Wed, Oct 14, 2026" from a plain YYYY-MM-DD string
function formatDay(dateStr) {
  return dateStr ? format(new Date(`${dateStr}T00:00:00`), 'EEE, MMM d, yyyy') : 'n/a'
}

// A full delivery is saved as one item named "Full delivery"; partial items
// carry an item_number. Older appointments have neither, so no label.
function getDeliveryType(appt) {
  const first = (appt.items || [])[0]
  if (!first) return null
  if (first.item_name === 'Full delivery') return 'Full delivery'
  if (first.item_number) return 'Partial delivery'
  return null
}

// Date number in each month cell, plus the holiday name when there is one.
// react-big-calendar passes `isOffRange` for days of the neighbouring months.
function makeDateHeader(closures) {
  return function CustomDateHeader({ date, label, isOffRange }) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const holiday = getHoliday(dateStr)
    const closure = findClosure(dateStr, closures)
    return (
      <div className="cal-date">
        <span className={isOffRange ? 'cal-num cal-num-off' : 'cal-num'}>{label}</span>
        {holiday && <span className="cal-holiday" title={holiday.name}>{holiday.name}</span>}
        {closure && <span className="cal-closed" title={closure.reason}>{closure.reason}</span>}
      </div>
    )
  }
}

// Replaces react-big-calendar's toolbar: month name on the left, three
// buttons on the right, one tight row. Full control, nothing to fight.
function CustomToolbar({ label, onNavigate }) {
  return (
    <div className="cal-toolbar">
      <h2 className="cal-month">{label}</h2>
      <div className="cal-nav">
        <button type="button" onClick={() => onNavigate('TODAY')}>Today</button>
        <button type="button" aria-label="Previous month" onClick={() => onNavigate('PREV')}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <button type="button" aria-label="Next month" onClick={() => onNavigate('NEXT')}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// Supplier and P.O. number inside a calendar block
function CustomEvent({ event }) {
  const a = event.resource
  return (
    <span>
      {a.supplier} <span className="evt-po">· {a.po_number}</span>
    </span>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [events, setEvents] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [moreEvents, setMoreEvents] = useState(null) // { date, events }
  const [panelOpen, setPanelOpen] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const [listQuery, setListQuery] = useState('')
  const [closures, setClosures] = useState([])
  const [closuresOpen, setClosuresOpen] = useState(false)
  // Rebuilt only when closures change, so the calendar's date cells are not remounted on every render.
  const dateHeader = useMemo(() => makeDateHeader(closures), [closures])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function loadAppointments() {
      const { data, error } = await supabase.from('appointments').select('*')

      if (error) {
        console.error(error)
        toast.error('Could not load the appointments. Please refresh the page.')
        return
      }

      setEvents(
        data.map((appt) => {
          const start = new Date(`${appt.tentative_delivery_date}T00:00:00`)
          return {
            title: `${appt.supplier} — PO ${appt.po_number}`,
            start,
            end: start,
            allDay: true,
            resource: appt,
          }
        })
      )
    }

    loadAppointments()
  }, [])

  useEffect(() => {
    async function loadClosures() {
      const { data, error } = await supabase.from('date_closures').select('*').order('start_date')
      if (error) {
        console.error(error)
        toast.error('Could not load the blocked dates. Please refresh the page.')
        return
      }
      setClosures(data)
    }
    loadClosures()
  }, [])

  function openAppt(appt) {
    setConfirmingDelete(false)
    setSelectedAppt(appt)
  }

  function closeAppt() {
    setSelectedAppt(null)
    setConfirmingDelete(false)
  }

  // Escape closes whatever is on top: popup, then day list, then side panel.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (closuresOpen) return // the closure dialog handles its own Escape
      if (selectedAppt) closeAppt()
      else if (moreEvents) setMoreEvents(null)
      else if (panelOpen) setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedAppt, moreEvents, panelOpen, closuresOpen])

  // Stop the page behind a popup from scrolling.
  useEffect(() => {
    if (!selectedAppt && !moreEvents) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [selectedAppt, moreEvents])

  // Deletes the row, then removes it from local state so the calendar
  // updates at once. The "are you sure" step is the two-button row in the popup.
  async function handleDelete(apptId) {
    const { error } = await supabase.from('appointments').delete().eq('id', apptId)

    if (error) {
      console.error(error)
      toast.error('Could not delete this appointment. Please try again.')
      return
    }

    setEvents((prev) => prev.filter((e) => e.resource.id !== apptId))
    closeAppt()
    toast.success('Appointment deleted')
  }

  // Saves the new status, then updates the calendar and the open popup.
  async function handleStatusChange(apptId, newStatus) {
    if (selectedAppt?.status === newStatus) return

    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', apptId)

    if (error) {
      console.error(error)
      toast.error('Could not update the status. Please try again.')
      return
    }

    setEvents((prev) =>
      prev.map((e) =>
        e.resource.id === apptId ? { ...e, resource: { ...e.resource, status: newStatus } } : e
      )
    )
    setSelectedAppt((prev) => (prev ? { ...prev, status: newStatus } : prev))
    toast.success(`Marked as ${statusStyle(newStatus).label.toLowerCase()}`)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center text-soft">Checking login…</div>
    )
  }

  // Every appointment, ordered by when it was submitted. map() makes a copy,
  // so sorting never touches the calendar's own data.
  const sortedAppts = events
    .map((e) => e.resource)
    .sort((a, b) =>
      newestFirst
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    )

  // Matches the P.O. number or the supplier name, case-insensitively.
  // Trimmed so a trailing space from a phone keyboard doesn't hide everything.
  const query = listQuery.trim().toLowerCase()
  const visibleAppts = query
    ? sortedAppts.filter(
        (a) =>
          a.po_number?.toLowerCase().includes(query) ||
          a.supplier?.toLowerCase().includes(query)
      )
    : sortedAppts

  const pendingCount = events.filter((e) => e.resource.status === 'pending').length

  return (
    <div className={`min-h-[100dvh] ${panelOpen ? 'lg:pr-[24rem]' : ''}`}>
      <HospitalHeader>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPanelOpen((open) => !open)}>
          {panelOpen ? 'Hide list' : <><span className="sm:hidden">List</span><span className="hidden sm:inline">Appointment list</span></>}
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setClosuresOpen(true)}>
          Block date
        </button>
        <button type="button" className="navlink" onClick={handleLogout}>Log out</button>
      </HospitalHeader>

      <main className="shell pb-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-5 pt-2">
          <h1 className="title">Delivery appointments</h1>
          <p className="small text-soft">
            {events.length} {events.length === 1 ? 'appointment' : 'appointments'} · {pendingCount} pending
          </p>
        </div>

        <div className="panel" style={{ padding: 'clamp(0.75rem, 2vw, 1.5rem)' }}>
          <div style={{ height: 'clamp(30rem, 78dvh, 48rem)' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              views={['month']}
              defaultView="month"
              date={currentDate}
              onNavigate={(newDate) => setCurrentDate(newDate)}
              components={{ month: { dateHeader }, event: CustomEvent, toolbar: CustomToolbar }}
              dayPropGetter={(date) => {
                const dateStr = format(date, 'yyyy-MM-dd')
                const holiday = getHoliday(dateStr)
                const day = date.getDay() // 0 = Sun, 6 = Sat
                if (findClosure(dateStr, closures)) return { style: { backgroundColor: '#fde8c8' } }
                if (holiday) return { style: { backgroundColor: '#fbe3e0' } }
                if (day === 0 || day === 6) return { style: { backgroundColor: '#e9eeea' } }
                return {}
              }}
              eventPropGetter={(event) => {
                const s = statusStyle(event.resource.status)
                return { style: { backgroundColor: s.bg, color: s.fg } }
              }}
              onSelectEvent={(event) => openAppt(event.resource)}
              onShowMore={(dayEvents, date) => setMoreEvents({ date, events: dayEvents })}
            />
          </div>
        </div>

        <div className="legend small text-soft mt-4">
          <span className="inline-flex items-center"><span className="dot" style={{ background: STATUS_STYLE.pending.bg }} />Pending</span>
          <span className="inline-flex items-center"><span className="dot" style={{ background: STATUS_STYLE.delivered.bg }} />Delivered</span>
          <span className="inline-flex items-center"><span className="dot" style={{ background: '#e9eeea', boxShadow: 'inset 0 0 0 1px #b9c4bc' }} />Weekend</span>
          <span className="inline-flex items-center"><span className="dot" style={{ background: '#fbe3e0', boxShadow: 'inset 0 0 0 1px #e8b4ad' }} />Holiday</span>
          <span className="inline-flex items-center"><span className="dot" style={{ background: '#fde8c8', boxShadow: 'inset 0 0 0 1px #e6bd80' }} />Blocked by admin</span>
        </div>
      </main>

      {/* Appointment popup */}
      {selectedAppt && (
        <div className="backdrop" onClick={closeAppt}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="appt-title"
            className="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head">
              <div className="min-w-0">
                <h2 id="appt-title" className="h2">PO {selectedAppt.po_number}</h2>
                <p className="small text-soft mt-1 break-words">{selectedAppt.supplier}</p>
              </div>
              <button type="button" className="icon-btn" onClick={closeAppt} aria-label="Close">×</button>
            </div>

            <div className="dialog-body">
              <div>
                <p className="label">Status</p>
                <div role="radiogroup" aria-label="Status" className="seg">
                  {['pending', 'delivered'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      data-status={s}
                      aria-checked={selectedAppt.status === s}
                      onClick={() => handleStatusChange(selectedAppt.id, s)}
                    >
                      {STATUS_STYLE[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <dl className="facts">
                <div className="fact"><dt>Delivery date</dt><dd>{formatDay(selectedAppt.tentative_delivery_date)}</dd></div>
                <div className="fact"><dt>Scheduling</dt><dd>{selectedAppt.supplier_type === 'extension' ? 'Extension (open schedule)' : 'Regular'}</dd></div>
                {getDeliveryType(selectedAppt) && (
                  <div className="fact"><dt>Delivery type</dt><dd>{getDeliveryType(selectedAppt)}</dd></div>
                )}
                <div className="fact">
                  <dt>Delivery terms</dt>
                  <dd>
                    {selectedAppt.delivery_terms ? `${selectedAppt.delivery_terms} days` : 'n/a'}
                    {selectedAppt.count_type &&
                      ` · ${selectedAppt.count_type === 'working' ? 'Working days' : 'Calendar days'}`}
                  </dd>
                </div>
                <div className="fact"><dt>Confirmation P.O. date</dt><dd>{selectedAppt.confirmation_po_date ? formatDay(selectedAppt.confirmation_po_date) : 'n/a'}</dd></div>
                <div className="fact"><dt>Contact</dt><dd>{selectedAppt.contact_number || 'n/a'}</dd></div>
                <div className="fact"><dt>Submitted</dt><dd>{formatSubmitted(selectedAppt.created_at)}</dd></div>
              </dl>

              <div>
                <p className="label">Items</p>
                {(selectedAppt.items || []).length === 0 ? (
                  <p className="small text-soft">No items were listed.</p>
                ) : (
                  <ul className="grid gap-2">
                    {selectedAppt.items.map((it, i) => (
                      <li key={i} className="item-row">
                        <strong>{it.item_name}{it.brand ? ` (${it.brand})` : ''}</strong>
                        <span className="small text-soft">
                          {it.quantity ? `Qty: ${it.quantity} ${it.unit_of_measurement || ''} · ` : ''}
                          Boxes: {it.number_of_boxes || '-'}
                          {it.box_size ? ` · Size: ${it.box_size}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="dialog-foot">
              {confirmingDelete ? (
                <>
                  <p className="small font-semibold" role="alert">Delete this appointment? This cannot be undone.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" className="btn btn-quiet" onClick={() => setConfirmingDelete(false)}>Keep</button>
                    <button type="button" className="btn btn-danger" onClick={() => handleDelete(selectedAppt.id)}>Delete</button>
                  </div>
                </>
              ) : (
                <button type="button" className="btn btn-danger-quiet" onClick={() => setConfirmingDelete(true)}>
                  Delete appointment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {closuresOpen && (
        <ClosureManager
          closures={closures}
          appointments={events.map((e) => e.resource)}
          onChange={setClosures}
          onClose={() => setClosuresOpen(false)}
        />
      )}

      {/* "+N more" list for a busy day */}
      {moreEvents && (
        <div className="backdrop" onClick={() => setMoreEvents(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-title"
            className="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head">
              <h2 id="day-title" className="h2 min-w-0">{format(moreEvents.date, 'MMMM d, yyyy')}</h2>
              <button type="button" className="icon-btn" onClick={() => setMoreEvents(null)} aria-label="Close">×</button>
            </div>
            <ul className="dialog-body" style={{ gap: '0.5rem' }}>
              {moreEvents.events.map((event, i) => {
                const s = statusStyle(event.resource.status)
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className="drawer-row"
                      style={{ background: 'var(--ground)' }}
                      onClick={() => {
                        setMoreEvents(null)
                        openAppt(event.resource)
                      }}
                    >
                      <span className="flex items-center font-semibold">
                        <span className="dot" style={{ background: s.bg }} />
                        <span className="break-words">{event.title}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Side panel: every appointment, by when it was submitted */}
      {panelOpen && <div className="drawer-scrim" onClick={() => setPanelOpen(false)} />}
      <aside className="drawer" data-open={panelOpen} aria-label="All appointments" inert={!panelOpen}>
        <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-4">
          <div>
            <h2 className="h2">All appointments</h2>
            <p className="small text-soft mt-1">
              {query ? `${visibleAppts.length} of ${sortedAppts.length}` : `${sortedAppts.length} total`}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setPanelOpen(false)} aria-label="Close list">×</button>
        </div>

        <div className="px-5 pb-3 grid gap-2.5">
          <button type="button" className="btn btn-quiet btn-sm w-fit" onClick={() => setNewestFirst((v) => !v)}>
            {newestFirst ? 'Newest first ↓' : 'Oldest first ↑'}
          </button>

          <div className="relative">
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
              placeholder="Search P.O. number or supplier"
              aria-label="Search appointments by P.O. number or supplier"
              className="input"
              style={{ paddingRight: listQuery ? '2.5rem' : undefined }}
            />
            {listQuery && (
              <button
                type="button"
                onClick={() => setListQuery('')}
                aria-label="Clear search"
                className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn"
                style={{ width: '2rem', height: '2rem', fontSize: '1.25rem' }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="drawer-list">
          {sortedAppts.length === 0 && <p className="small text-soft px-5 py-4">No appointments yet.</p>}
          {sortedAppts.length > 0 && visibleAppts.length === 0 && (
            <p className="small text-soft px-5 py-4">No appointments match &ldquo;{listQuery.trim()}&rdquo;.</p>
          )}
          {visibleAppts.map((a) => {
            const s = statusStyle(a.status)
            return (
              <button key={a.id} type="button" className="drawer-row" onClick={() => openAppt(a)}>
                <span className="block font-semibold break-words">{a.supplier} · PO {a.po_number}</span>
                <span className="small text-soft mt-0.5 block">Submitted {formatSubmitted(a.created_at)}</span>
                <span className="small text-soft mt-0.5 flex items-center">
                  <span className="dot" style={{ background: s.bg }} />
                  {s.label} · Delivery {a.tentative_delivery_date}
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}