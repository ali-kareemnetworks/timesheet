import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import { startOfWeek, addDays, toISODate, weekDays, formatWeekLabel, shortDayLabel } from '../../lib/dates.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'

export default function Week() {
  const { profile } = useAuth()
  const [weekStart, setWeekStart] = useState(toISODate(startOfWeek()))
  const [codes, setCodes] = useState([])
  const [timesheet, setTimesheet] = useState(null) // null = not created yet
  const [hours, setHours] = useState({}) // key: `${codeId}|${day}` -> string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const days = useMemo(() => weekDays(weekStart), [weekStart])
  const editable = !timesheet || timesheet.status === 'draft' || timesheet.status === 'rejected'

  useEffect(() => { load() }, [weekStart])

  async function load() {
    setLoading(true)
    setMessage('')
    const { data: codeData } = await supabase.from('project_codes').select('*').eq('active', true).order('code')
    setCodes(codeData || [])

    const { data: ts } = await supabase.from('timesheets').select('*')
      .eq('employee_id', profile.id).eq('week_start_date', weekStart).maybeSingle()
    setTimesheet(ts || null)

    const h = {}
    if (ts) {
      const { data: entries } = await supabase.from('timesheet_entries').select('*').eq('timesheet_id', ts.id)
      for (const e of entries || []) h[`${e.project_code_id}|${e.day_date}`] = String(e.hours)
    }
    setHours(h)
    setLoading(false)
  }

  function setCell(codeId, day, val) {
    if (!/^\d*\.?\d*$/.test(val)) return
    setHours((prev) => ({ ...prev, [`${codeId}|${day}`]: val }))
  }

  function dayTotal(day) {
    return codes.reduce((sum, c) => sum + (parseFloat(hours[`${c.id}|${day}`]) || 0), 0)
  }
  function codeTotal(codeId) {
    return days.reduce((sum, d) => sum + (parseFloat(hours[`${codeId}|${d}`]) || 0), 0)
  }
  const weekTotal = codes.reduce((sum, c) => sum + codeTotal(c.id), 0)

  async function ensureTimesheet() {
    if (timesheet) return timesheet
    const { data, error } = await supabase.from('timesheets')
      .insert({ employee_id: profile.id, week_start_date: weekStart, status: 'draft' })
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
    // Replace all entries for this timesheet
    await supabase.from('timesheet_entries').delete().eq('timesheet_id', ts.id)
    if (rows.length) {
      const { error } = await supabase.from('timesheet_entries').insert(rows)
      if (error) throw error
    }
  }

  async function handleSaveDraft() {
    setSaving(true)
    setMessage('')
    try {
      const ts = await ensureTimesheet()
      await saveEntries(ts)
      setMessage('Draft saved.')
    } catch (e) {
      setMessage('Could not save: ' + e.message)
    }
    setSaving(false)
  }

  async function handleSubmit() {
    setSaving(true)
    setMessage('')
    try {
      const ts = await ensureTimesheet()
      await saveEntries(ts)
      const { data, error } = await supabase.from('timesheets')
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), rejection_reason: null })
        .eq('id', ts.id).select().single()
      if (error) throw error
      setTimesheet(data)
      setMessage('Timesheet submitted for approval.')
    } catch (e) {
      setMessage('Could not submit: ' + e.message)
    }
    setSaving(false)
  }

  if (loading) return <p className="text-slate font-mono text-sm">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">My Week</h1>
        {timesheet && <StatusBadge status={timesheet.status} />}
      </div>

      <div className="flex items-center justify-between card px-3 py-2">
        <button className="p-2" onClick={() => setWeekStart(toISODate(addDays(new Date(weekStart), -7)))} aria-label="Previous week">
          <ChevronLeft size={18} />
        </button>
        <span className="font-mono text-sm font-medium">{formatWeekLabel(weekStart)}</span>
        <button className="p-2" onClick={() => setWeekStart(toISODate(addDays(new Date(weekStart), 7)))} aria-label="Next week">
          <ChevronRight size={18} />
        </button>
      </div>

      {timesheet?.status === 'rejected' && (
        <div className="card p-4 border-rust bg-rust/5 flex gap-3">
          <AlertTriangle className="text-rust shrink-0" size={20} />
          <div>
            <p className="font-semibold text-rust text-sm">Sent back for correction</p>
            <p className="text-sm text-ink/80 mt-1">{timesheet.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Mobile: stacked day cards. Desktop: grid table. */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
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
                  {c.customer_name && c.code_type === 'CLIENT_SITE' && (
                    <div className="text-[11px] text-slate">{c.customer_name}</div>
                  )}
                </td>
                {days.map((d) => (
                  <td key={d} className="px-1.5 py-1.5">
                    <input
                      type="text" inputMode="decimal" className="hour-cell" placeholder="0"
                      disabled={!editable}
                      value={hours[`${c.id}|${d}`] || ''}
                      onChange={(e) => setCell(c.id, d, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-mono text-sm">{codeTotal(c.id) || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-navy/20">
              <td className="px-3 py-2.5 font-semibold sticky left-0 bg-white">Daily total</td>
              {days.map((d) => (
                <td key={d} className="px-2 py-2.5 text-center font-mono text-xs text-slate">{dayTotal(d) || ''}</td>
              ))}
              <td className="px-3 py-2.5 text-center font-mono font-semibold text-navy">{weekTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {message && <p className="text-sm text-slate">{message}</p>}

      {editable ? (
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" disabled={saving} onClick={handleSaveDraft}>Save draft</button>
          <button className="btn-primary flex-1" disabled={saving} onClick={handleSubmit}>
            {timesheet?.status === 'rejected' ? 'Resubmit' : 'Submit for approval'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate">
          This timesheet is <strong>{timesheet.status}</strong> and can no longer be edited.
        </p>
      )}
    </div>
  )
}
