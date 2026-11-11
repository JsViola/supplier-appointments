// Philippine regular holidays for 2026, per Proclamation No. 1006
// (signed Sept 3, 2025). A few of these move every year — Eid'l Fitr
// and Eid'l Adha are confirmed separately once the Islamic calendar
// dates are set, and Eid'l Adha for 2026 has not been proclaimed yet
// as of this writing. Update this list at the start of each year once
// the next proclamation is published.
export const PH_REGULAR_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-03-20', name: "Eid'l Fitr" },
  { date: '2026-04-02', name: 'Maundy Thursday' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-09', name: 'Araw ng Kagitingan' },
  { date: '2026-05-01', name: 'Labor Day' },
  { date: '2026-06-12', name: 'Independence Day' },
  { date: '2026-08-31', name: 'National Heroes Day' },
  { date: '2026-11-30', name: 'Bonifacio Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-30', name: 'Rizal Day' },
]

// 2027 and 2028. The fixed-date holidays and the Easter-based ones
// (Maundy Thursday, Good Friday) are certain. National Heroes Day is the
// last Monday of August. The two Eid dates are ESTIMATES from the Islamic
// calendar: the government confirms the real dates by proclamation, so
// check them against the proclamation and correct them here when it is out.
export const PH_REGULAR_HOLIDAYS_2027 = [
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-03-10', name: "Eid'l Fitr" },
  { date: '2027-03-25', name: 'Maundy Thursday' },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-04-09', name: 'Araw ng Kagitingan' },
  { date: '2027-05-01', name: 'Labor Day' },
  { date: '2027-05-17', name: "Eid'l Adha" },
  { date: '2027-06-12', name: 'Independence Day' },
  { date: '2027-08-30', name: 'National Heroes Day' },
  { date: '2027-11-30', name: 'Bonifacio Day' },
  { date: '2027-12-25', name: 'Christmas Day' },
  { date: '2027-12-30', name: 'Rizal Day' },
]

export const PH_REGULAR_HOLIDAYS_2028 = [
  { date: '2028-01-01', name: "New Year's Day" },
  { date: '2028-02-26', name: "Eid'l Fitr" },
  { date: '2028-04-09', name: 'Araw ng Kagitingan' },
  { date: '2028-04-13', name: 'Maundy Thursday' },
  { date: '2028-04-14', name: 'Good Friday' },
  { date: '2028-05-01', name: 'Labor Day' },
  { date: '2028-05-05', name: "Eid'l Adha" },
  { date: '2028-06-12', name: 'Independence Day' },
  { date: '2028-08-28', name: 'National Heroes Day' },
  { date: '2028-11-30', name: 'Bonifacio Day' },
  { date: '2028-12-25', name: 'Christmas Day' },
  { date: '2028-12-30', name: 'Rizal Day' },
]

const ALL_HOLIDAYS = [
  ...PH_REGULAR_HOLIDAYS_2026,
  ...PH_REGULAR_HOLIDAYS_2027,
  ...PH_REGULAR_HOLIDAYS_2028,
]

// Returns the holiday object for a given 'YYYY-MM-DD' string, or null.
export function getHoliday(dateString) {
  return ALL_HOLIDAYS.find((h) => h.date === dateString) || null
}

// Monday through Thursday only. JavaScript's getDay() returns
// 0 = Sunday, 1 = Monday, ... 6 = Saturday.
export function isWorkingDay(dateString) {
  if (!dateString) return true
  const day = new Date(`${dateString}T00:00:00`).getDay()
  return day >= 1 && day <= 5
}

// True only if the date is a working weekday AND not a holiday.
export function isValidDeliveryDate(dateString) {
  return Boolean(dateString) && isWorkingDay(dateString) && !getHoliday(dateString)
}

// --- Delivery window: confirmation date + delivery terms + count type ---

// True if a date is NOT a working day — either a weekend (Fri/Sat/Sun)
// or a regular holiday. Used only when counting "working days."
function isNonWorkingDate(dateString) {
  return !isWorkingDay(dateString) || Boolean(getHoliday(dateString))
}

// Adds `days` calendar days to a 'YYYY-MM-DD' string, returns a new
// 'YYYY-MM-DD' string.
function addCalendarDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Computes the selectable delivery date window from a confirmation
// date, a term length in days, and a count type ('calendar' or
// 'working'). Returns { start, end } as 'YYYY-MM-DD' strings, or null
// if the inputs aren't ready yet.
//
// Day 1 is always the day right after the confirmation date.
// - 'calendar': every day counts, so Day 1 is that very next day no
//   matter what weekday it falls on, and the window runs for
//   `termDays` days straight.
// - 'working': only working days count. If the day right after
//   confirmation isn't a working day, Day 1 moves forward until it
//   lands on one. The window then keeps walking forward, skipping
//   weekends and holidays, until `termDays` qualifying days have
//   been counted — the last one is the window's end.
// Safety cap: no realistic input should ever need this many loop
// iterations. If something unexpected does (a corrupted holiday entry,
// an absurd term length typed into a free input), the loop below stops
// and logs an error instead of running indefinitely and freezing the
// page.
const MAX_ITERATIONS = 2000

export function getDeliveryWindow(confirmationDate, termDays, countType) {
  if (!confirmationDate || !termDays || termDays <= 0) return null

  let day1 = addCalendarDays(confirmationDate, 1)

  if (countType === 'working') {
    let guard = 0
    while (isNonWorkingDate(day1)) {
      day1 = addCalendarDays(day1, 1)
      guard++
      if (guard > MAX_ITERATIONS) {
        console.error('getDeliveryWindow: could not find a starting working day within a reasonable number of days — check the holiday list for a bad entry.')
        return null
      }
    }
  }

  let end = day1

  if (countType === 'calendar') {
    end = addCalendarDays(day1, termDays - 1)
  } else {
    let counted = 1
    let cursor = day1
    let guard = 0
    while (counted < termDays) {
      cursor = addCalendarDays(cursor, 1)
      if (!isNonWorkingDate(cursor)) counted++
      guard++
      if (guard > MAX_ITERATIONS) {
        console.error('getDeliveryWindow: exceeded the safety limit — check delivery_terms for an unreasonably large value.')
        return null
      }
    }
    end = cursor
  }

  return { start: day1, end }
}

// Is `dateString` actually pickable, given the computed window and
// count type? 'calendar' terms allow any date in the window —
// weekends and holidays included, since the contract explicitly
// counts every day. 'working' terms only allow working days within
// that same window.
export function isSelectableDeliveryDate(dateString, window, countType) {
  if (!window || !dateString) return false
  if (dateString < window.start || dateString > window.end) return false
  if (countType === 'working') return !isNonWorkingDate(dateString)
  return true
}