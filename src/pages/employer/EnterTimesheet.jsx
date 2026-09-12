import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import { startOfPeriod, prevPeriodStart, nextPeriodStart, toISODate, periodDays, formatPeriodLabel, shortDayLabel } from '../../lib/dates.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function codeValidOnDay(code, day) {
  if (code.start_date && day < code.start_date) return false
  if (code.end_date && day > code.end_date) return false
  return true
}

export default function EnterTimesheet() {
  const { profile } = useAuth()
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [periodStart, setPeriodStart] = useState(toISODate(startOfPeriod()))
  const [codes, setCodes] = useState([])
  const [timesheet, setTimesheet] = useState(null)
  const [hours, setHours] = useState({})
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const days = useMemo(() => periodDays(periodStart), [periodStart])

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('role', 'employee').eq('active', true).order('full_name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  useEffect(() => {
    if (employeeId) load()
  }, [employeeId, periodStart])

  async function load() {
    setLoading(true)
    setMessage('')

    const { data: assigned } = await supabase
      .from('employee_project_codes')
      .select('project_codes(*)')
      .eq('employee_id', employeeId)
    const codeData = (assigned || [])
      .map((a) => a.project_codes)
      .filter((c) => c && c.active)
      .sort((a, b) => a.code.localeCompare(b.code))
    setCodes(codeData)

    const { data: ts } = await supabase.from('timesheets').select('*')
      .eq('employee_id', employeeId).eq('period_start_date', periodStart).maybeSingle()
    setTimesheet(ts || null)

    const h = {}
    if (ts) {
      const { data: entries } = await supabase.from('timesheet_entries').select('*').eq('timesheet_id', ts.id)
      for (const e of entries || []) h[`${e.project_code_id}|${e.day_date}`] = String(e.hours)
    }
    setHours(h)

    const { data: recentSheets } = await supabase.from('timesheets').select('*')
      .eq('employee_id', employeeId).order('period_start_date', { ascending: false }).limit(8)
    setRecent(recentSheets || [])

    setLoading(false)
  }

  function setCell(codeId, day, val) {
    if (!/^\d*\.?\d*$/.test(val)) return
    setHours((prev) => ({ ...prev, [`${codeId}|${day}`]: val }))
  }

  function codeTotal(codeId) {
    return days.reduce((sum, d) => sum + (parseFloat(hours[`${codeId}|${d}`]) || 0), 0)
  }
  const periodTotal = codes.reduce((sum, c) => sum + codeTotal(c.id), 0)

  async function ensureTimesheet() {
    if (timesheet) return timesheet
    const { data, error } = await supabase.from('timesheets')
      .insert({ employee_id: employeeId, period_start_date: periodStart, status: 'draft', entered_by: profile.id })
      .select().single()
    if (error) throw error
    setTimesheet(data)
    return data
  }

  async function saveEntries(ts) {
    const rows = []
    for (const c of codes) {
      for (const d of days) {
        const v = parseFloat(hours[`${c.id}|${d}`])
        if (v > 0) rows.push({ timesheet_id: ts.id, project_code_id: c.id, day_date: d, hours: v })
      }
    }
    await supabase.from('timesheet_entries').delete().eq('timesheet_id', ts.id)
    if (rows.length) {
      const { error } = await supabase.from('timesheet_entries').insert(rows)
      if (error) throw error
    }
  }

  // If editing a timesheet that's already submitted or approved, saving
  // reopens it: status drops to pending_acknowledgment, certification is
  // cleared (the employee needs to re-confirm), and if it was approved,
  // this status change automatically reverses its PTO postings via the
  // existing trigger — fresh postings get made when it's re-approved.
  function needsReopenConfirm() {
    return timesheet && (timesheet.status === 'submitted' || timesheet.status === 'approved')
  }

  async function handleSave({ sendForReview }) {
    if (needsReopenConfirm()) {
      const ok = window.confirm(
        `This timesheet is already ${timesheet.status}. Saving changes will reopen it: it goes back to ` +
        `"needs employee review", their prior certification is cleared, and if it was approved, its PTO ` +
        `postings for this period will be reversed until it's re-approved.\n\nContinue?`
      )
      if (!ok) return
    }

    setSaving(true)
    setMessage('')
    try {
      const ts = await ensureTimesheet()
      await saveEntries(ts)

      const shouldMoveToPending = sendForReview || needsReopenConfirm() || ts.status === 'draft'
      const updates = { entered_by: profile.id }
      if (shouldMoveToPending) {
        updates.status = 'pending_acknowledgment'
        updates.certified_at = null
        updates.certification_text = null
      }

      const { data, error } = await supabase.from('timesheets').update(updates).eq('id', ts.id).select().single()
      if (error) throw error
      setTimesheet(data)

      if (sendForReview || shouldMoveToPending) {
        supabase.functions.invoke('notify-employee-acknowledgment', {
          body: { employee_id: employeeId, period_label: formatPeriodLabel(periodStart) },
        }).catch(() => {})
      }

      setMessage(shouldMoveToPending ? 'Saved and sent to employee for review.' : 'Saved.')
      load()
    } catch (e) {
      setMessage('Could not save: ' + e.message)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">Enter Timesheet</h1>
      <p className="text-sm text-slate">
        Enter hours on an employee's behalf — useful for backfilling history or making a correction. They'll be
        asked to review and confirm before it goes to your normal approval queue.
      </p>

      <div className="card p-4">
        <label className="label">Employee</label>
        <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
          <option value="">Select an employee…</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {employeeId && (
        <>
          <div className="flex items-center justify-between card px-3 py-2">
            <button className="p-2" onClick={() => setPeriodStart(prevPeriodStart(periodStart))} aria-label="Previous period">
              <ChevronLeft size={18} />
            </button>
            <span className="font-mono text-sm font-medium">{formatPeriodLabel(periodStart)}</span>
            <button className="p-2" onClick={() => setPeriodStart(nextPeriodStart(periodStart))} aria-label="Next period">
              <ChevronRight size={18} />
            </button>
          </div>

          {timesheet && (
            <div className="flex items-center gap-2">
              <StatusBadge status={timesheet.status} />
              {timesheet.certified_at && (
                <span className="text-xs text-slate">Certified by employee {new Date(timesheet.certified_at).toLocaleDateString()}</span>
              )}
            </div>
          )}

          {loading ? (
            <p className="text-slate font-mono text-sm">Loading…</p>
          ) : codes.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm text-slate">This employee has no project codes assigned yet.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: `${Math.max(640, 220 + days.length * 64)}px` }}>
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left font-semibold text-slate px-3 py-2.5 sticky left-0 bg-white">Code</th>
                    {days.map((d) => (
                      <th key={d} className="text-center font-semibold text-slate px-2 py-2.5 font-mono text-xs">{shortDayLabel(d)}</th>
                    ))}
                    <th className="text-center font-semibold text-slate px-3 py-2.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 sticky left-0 bg-white">
                        <span className="font-mono text-xs font-semibold text-navy">{c.code}</span>
                      </td>
                      {days.map((d) => {
                        const validDay = codeValidOnDay(c, d)
                        return (
                          <td key={d} className="px-1.5 py-1.5">
                            <input
                              type="text" inputMode="decimal"
                              className={`hour-cell ${!validDay ? 'bg-slate/10 cursor-not-allowed' : ''}`}
                              placeholder={validDay ? '0' : '—'}
                              disabled={!validDay}
                              value={hours[`${c.id}|${d}`] || ''}
                              onChange={(e) => setCell(c.id, d, e.target.value)}
                            />
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center font-mono text-sm">{codeTotal(c.id) || ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-navy/20">
                    <td className="px-3 py-2.5 font-semibold sticky left-0 bg-white" colSpan={days.length + 1}>Period total</td>
                    <td className="px-3 py-2.5 text-center font-mono font-semibold text-navy">{periodTotal}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {message && <p className="text-sm text-slate">{message}</p>}

          {codes.length > 0 && (
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" disabled={saving} onClick={() => handleSave({ sendForReview: false })}>
                Save
              </button>
              <button className="btn-primary flex-1" disabled={saving} onClick={() => handleSave({ sendForReview: true })}>
                Save & send to employee for review
              </button>
            </div>
          )}

          {recent.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate uppercase tracking-wide mb-2">Recent timesheets</h2>
              <div className="space-y-2">
                {recent.map((r) => (
                  <button
                    key={r.id}
                    className="card p-3 flex items-center justify-between w-full text-left hover:border-gold"
                    onClick={() => setPeriodStart(r.period_start_date)}
                  >
                    <span className="text-sm">{formatPeriodLabel(r.period_start_date)}</span>
                    <StatusBadge status={r.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
