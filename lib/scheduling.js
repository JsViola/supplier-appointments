// Scheduling rules that sit NEXT TO the regular-supplier logic in
// lib/holidays.js. Nothing here changes getDeliveryWindow or
// isSelectableDeliveryDate; the regular flow still uses them as before.
//
// Two scheduling types:
//   'regular'   - delivery terms + count type + computed window (lib/holidays.js)
//   'extension' - open schedule: any Monday-Friday date that is not a
//                 Philippine holiday, not in the past, and not closed.
// Admin date closures apply to BOTH types.

import { getHoliday, isWorkingDay } from '@/lib/holidays'

export const SUPPLIER_TYPES = ['regular', 'extension']

// Today's date in the Philippines as 'YYYY-MM-DD', regardless of the
// server's or the visitor's own time zone.
export function todayInManila() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// Returns the closure that covers `dateString`, or null. A closure is
// { start_date, end_date, reason } with 'YYYY-MM-DD' strings, both ends
// inclusive. String comparison is safe for zero-padded ISO dates.
export function findClosure(dateString, closures) {
  if (!dateString || !Array.isArray(closures)) return null
  return (
    closures.find((c) => c.start_date <= dateString && dateString <= c.end_date) || null
  )
}

// Extension rule. Returns null when the date can be booked, otherwise a
// short reason string that is safe to show the user.
export function getExtensionBlockReason(dateString, closures) {
  if (!dateString) return 'Please choose a delivery date.'
  if (dateString <= todayInManila()) return 'Please choose a date after today.'
  if (!isWorkingDay(dateString)) return 'Deliveries are accepted Monday to Friday only.'
  const holiday = getHoliday(dateString)
  if (holiday) return `Closed for ${holiday.name}.`
  const closure = findClosure(dateString, closures)
  if (closure) return `Closed: ${closure.reason}.`
  return null
}

export function isSelectableExtensionDate(dateString, closures) {
  return getExtensionBlockReason(dateString, closures) === null
}
