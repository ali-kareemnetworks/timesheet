// Timesheets run in semi-monthly periods: the 1st–15th, and the 16th–end
// of month. All periods are identified by their start date (always the
// 1st or the 16th), stored as an ISO date string (YYYY-MM-DD).

export function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

export function startOfPeriod(date = new Date()) {
  const d = new Date(date)
  const day = d.getDate()
  return new Date(d.getFullYear(), d.getMonth(), day <= 15 ? 1 : 16)
}

export function endOfPeriod(periodStartISO) {
  const start = new Date(periodStartISO + 'T00:00:00')
  if (start.getDate() === 1) {
    return toISODate(new Date(start.getFullYear(), start.getMonth(), 15))
  }
  // Day 0 of next month = last day of this month.
  return toISODate(new Date(start.getFullYear(), start.getMonth() + 1, 0))
}

export function periodDays(periodStartISO) {
  const start = new Date(periodStartISO + 'T00:00:00')
  const end = new Date(endOfPeriod(periodStartISO) + 'T00:00:00')
  const days = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(toISODate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

export function nextPeriodStart(periodStartISO) {
  const start = new Date(periodStartISO + 'T00:00:00')
  if (start.getDate() === 1) {
    return toISODate(new Date(start.getFullYear(), start.getMonth(), 16))
  }
  return toISODate(new Date(start.getFullYear(), start.getMonth() + 1, 1))
}

export function prevPeriodStart(periodStartISO) {
  const start = new Date(periodStartISO + 'T00:00:00')
  if (start.getDate() === 16) {
    return toISODate(new Date(start.getFullYear(), start.getMonth(), 1))
  }
  return toISODate(new Date(start.getFullYear(), start.getMonth() - 1, 16))
}

export function formatPeriodLabel(periodStartISO) {
  const start = new Date(periodStartISO + 'T00:00:00')
  const end = new Date(endOfPeriod(periodStartISO) + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`
}

export function shortDayLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}
