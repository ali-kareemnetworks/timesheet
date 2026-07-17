// All weeks run Monday -> Sunday, stored as ISO date strings (YYYY-MM-DD).

export function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function weekDays(weekStartISO) {
  const start = new Date(weekStartISO + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)))
}

export function formatWeekLabel(weekStartISO) {
  const start = new Date(weekStartISO + 'T00:00:00')
  const end = addDays(start, 6)
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}, ${end.getFullYear()}`
}

export function shortDayLabel(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
}
