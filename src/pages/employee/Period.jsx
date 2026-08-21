import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import { startOfPeriod, prevPeriodStart, nextPeriodStart, toISODate, periodDays, formatPeriodLabel, shortDayLabel } from '../../lib/dates.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { ChevronLeft, ChevronRight, AlertTriangle, Copy } from 'lucide-react'

export default function Period() {
  const { profile } = useAuth()
  const [periodStart, setPeriodStart] = useState(toISODate(startOfPeriod()))
  const [codes, setCodes] = useState([])
  const [timesheet, setTimesheet] = useState(null) // null = not created yet
  const [hours, setHours] = useState({}) // key: `${codeId}|${day}` -> string
  const [baseline, setBaseline] = useState({}) // last-saved hours, same shape as `hours`
  const [justifications, setJustifications] = useState({}) // day -> string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const days = useMemo(() => periodDays(periodStart), [periodStart])
  const editable = !timesheet || timesheet.status === 'draft' || timesheet.status === 'rejected'

  useEffect(() => { load() }, [periodStart])

  async function load() {
    setLoading(true)
    setMessage('')

    const { data: assigned } = await supabase
      .from('employee_project_codes')
      .select('project_codes(*)')
      .eq('employee_id', profile.id)
    const codeData = (assigned || [])
      .map((a) => a.project_codes)
      .filter((c) => c && c.active)
      .sort((a, b) => a.code.localeCompare(b.code))
    setCodes(codeData)

    const { data: ts } = await supabase.from('timesheets').select('*')
      .eq('employee_id', profile.id).eq('period_start_date', periodStart).maybeSingle()
    setTimesheet(ts || null)

    const h = {}
    if (ts) {
      const { data: entries } = await supabase.from('timesheet_entries').select('*').eq('timesheet_id', ts.id)
      for (const e of entries || []) h[`${e.project_code_id}|${e.day_date}`] = String(e.hours)
    }
    setHours(h)
    setBaseline(h) // what's currently saved — any further edits away from this need justification
    setJustifications({})
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
  const periodTotal = codes.reduce((sum, c) => sum + codeTotal(c.id), 0)

  // Which cells changed from their last-saved value, grouped by day.
  // Only cells that HAD a prior saved value count as "adjustments" —
  // filling in a previously-empty cell for the first time doesn't.
  const changedCellsByDay = useMemo(() => {
    const map = {}
    for (const c of codes) {
      for (const d of days) {
        const key = `${c.id}|${d}`
        if (baseline[key] === undefined) continue
        const prev = parseFloat(baseline[key]) || 0
        const curr = parseFloat(hours[key]) || 0
        if (prev !== curr) {
          if (!map[d]) map[d] = []
          map[d].push({ code: c, prev, curr })
        }
      }
    }
    return map
  }, [hours, baseline, codes, days])

  const changedDays = Object.keys(changedCellsByDay).sort()
  const allJustified = changedDays.every((d) => (justifications[d] || '').trim().length > 0)
  const needsJustification = changedDays.length > 0

  function setJustification(day, val) {
    setJustifications((prev) => ({ ...prev, [day]: val }))
  }

  function copyToAllDays(sourceDay) {
    const text = justifications[sourceDay] || ''
    if (!text.trim()) return
    setJustifications((prev) => {
      const next = { ...prev }
      for (const d of changedDays) next[d] = text
      return next
    })
  }

  async function ensureTimesheet() {
    if (timesheet) return timesheet
    const { data, error } = await supabase.from('timesheets')
      .insert({ employee_id: profile.id, period_start_date: periodStart, status: 'draft' })
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

  async function logAdjustments(ts) {
    const rows = []
    for (const d of changedDays) {
      const justification = (justifications[d] || '').trim()
      if (!justification) continue
      for (const { code, prev, curr } of changedCellsByDay[d]) {
        rows.push({
          timesheet_id: ts.id,
          employee_id: profile.id,
          project_code_id: code.id,
          day_date: d,
          previous_hours: prev,
          new_hours: curr,
          justification,
        })
      }
    }
    if (rows.length) {
      const { error } = await supabase.from('timesheet_adjustments').insert(rows)
      if (error) throw error
    }
  }

  async function handleSaveDraft() {
    if (needsJustification && !allJustified) {
      setMessage('Please provide a justification for every changed day before saving.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const ts = await ensureTimesheet()
      await saveEntries(ts)
      await logAdjustments(ts)
      setBaseline(hours)
      setJustifications({})
      setMessage('Draft saved.')
    } catch (e) {
      setMessage('Could not save: ' + e.message)
    }
    setSaving(false)
  }

  async function handleSubmit() {
    if (needsJustification && !allJustified) {
      setMessage('Please provide a justification for every changed day before submitting.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const ts = await ensureTimesheet()
      await saveEntries(ts)
      await logAdjustments(ts)
      const { data, error } = await supabase.from('timesheets')
        .update({ status: 'submitted', submitted_at: new Date().toISOString(), rejection_reason: null })
        .eq('id', ts.id).select().single()
      if (error) throw error
      setTimesheet(data)
      setBaseline(hours)
      setJustifications({})
      setMessage('Timesheet submitted for approval.')
    } catch (e) {
      setMessage('Could not submit: ' + e.message)
    }
    setSaving(false)
  }

  if (loading) return <p className="text-slate font-mono text-sm">Loading…</p>

  const tableMinWidth = Math.max(640, 220 + days.length * 64)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">My Timesheet</h1>
        {timesheet && <StatusBadge status={timesheet.status} />}
      </div>

      <div className="flex items-center justify-between card px-3 py-2">
        <button className="p-2" onClick={() => setPeriodStart(prevPeriodStart(periodStart))} aria-label="Previous period">
          <ChevronLeft size={18} />
        </button>
        <span className="font-mono text-sm font-medium">{formatPeriodLabel(periodStart)}</span>
        <button className="p-2" onClick={() => setPeriodStart(nextPeriodStart(periodStart))} aria-label="Next period">
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

      {codes.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-slate">
            You haven't been assigned any project codes yet. Ask your employer to assign one from the Project Codes page.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
            <thead>
              <tr className="border-b border-line">
                <th className="text-left font-semibold text-slate px-3 py-2.5 sticky left-0 bg-white">Code</th>
                {days.map((d) => (
                  <th key={d} className={`text-center font-semibold px-2 py-2.5 font-mono text-xs ${changedCellsByDay[d] ? 'text-gold' : 'text-slate'}`}>
                    {shortDayLabel(d)}
                  </th>
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
                  {days.map((d) => {
                    const key = `${c.id}|${d}`
                    const changed = baseline[key] !== undefined && (parseFloat(baseline[key]) || 0) !== (parseFloat(hours[key]) || 0)
                    return (
                      <td key={d} className="px-1.5 py-1.5">
                        <input
                          type="text" inputMode="decimal"
                          className={`hour-cell ${changed ? 'border-gold bg-gold/5' : ''}`}
                          placeholder="0"
                          disabled={!editable}
                          value={hours[key] || ''}
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
                <td className="px-3 py-2.5 font-semibold sticky left-0 bg-white">Daily total</td>
                {days.map((d) => (
                  <td key={d} className="px-2 py-2.5 text-center font-mono text-xs text-slate">{dayTotal(d) || ''}</td>
                ))}
                <td className="px-3 py-2.5 text-center font-mono font-semibold text-navy">{periodTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {needsJustification && (
        <div className="card p-4 border-gold bg-gold/5 space-y-3">
          <div className="flex gap-3">
            <AlertTriangle className="text-gold shrink-0" size={20} />
            <div>
              <p className="font-semibold text-sm text-navy">Justification required</p>
              <p className="text-xs text-slate mt-0.5">
                You changed hours that were already saved (highlighted above). Explain why for each day below before saving.
              </p>
            </div>
          </div>

          {changedDays.map((d) => (
            <div key={d} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-navy">{shortDayLabel(d)}</label>
                <button
                  type="button"
                  className="text-[11px] text-slate flex items-center gap-1 hover:text-navy"
                  onClick={() => copyToAllDays(d)}
                  disabled={!(justifications[d] || '').trim()}
                >
                  <Copy size={12} /> Use for all days
                </button>
              </div>
              <p className="text-[11px] text-slate font-mono">
                {changedCellsByDay[d].map(({ code, prev, curr }) => `${code.code}: ${prev} → ${curr}`).join('  ·  ')}
              </p>
              <textarea
                className="input" rows={2} placeholder="Why did these hours change?"
                value={justifications[d] || ''}
                onChange={(e) => setJustification(d, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {message && <p className="text-sm text-slate">{message}</p>}

      {editable && codes.length > 0 && (
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" disabled={saving || (needsJustification && !allJustified)} onClick={handleSaveDraft}>
            Save draft
          </button>
          <button className="btn-primary flex-1" disabled={saving || (needsJustification && !allJustified)} onClick={handleSubmit}>
            {timesheet?.status === 'rejected' ? 'Resubmit' : 'Submit for approval'}
          </button>
        </div>
      )}
      {!editable && (
        <p className="text-sm text-slate">
          This timesheet is <strong>{timesheet.status}</strong> and can no longer be edited.
        </p>
      )}
    </div>
  )
}
