import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import { formatPeriodLabel } from '../../lib/dates.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function History() {
  const { profile } = useAuth()
  const [rows, setRows] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [adjustments, setAdjustments] = useState({}) // timesheetId -> array

  useEffect(() => { load() }, [])

  async function load() {
    const { data: sheets } = await supabase.from('timesheets').select('*')
      .eq('employee_id', profile.id).order('period_start_date', { ascending: false })

    const withTotals = await Promise.all((sheets || []).map(async (ts) => {
      const { data: entries } = await supabase.from('timesheet_entries').select('hours').eq('timesheet_id', ts.id)
      const total = (entries || []).reduce((s, e) => s + Number(e.hours), 0)
      return { ...ts, total }
    }))
    setRows(withTotals)
  }

  async function toggleExpand(ts) {
    if (expanded === ts.id) { setExpanded(null); return }
    setExpanded(ts.id)
    if (!adjustments[ts.id]) {
      const { data } = await supabase.from('timesheet_adjustments')
        .select('*, project_codes(code)').eq('timesheet_id', ts.id).order('changed_at')
      setAdjustments((prev) => ({ ...prev, [ts.id]: data || [] }))
    }
  }

  if (!rows) return <p className="text-slate font-mono text-sm">Loading…</p>

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">History</h1>
      {rows.length === 0 && <p className="text-slate text-sm">No timesheets yet.</p>}
      <div className="space-y-2">
        {rows.map((ts) => (
          <div key={ts.id} className="card p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpand(ts)}>
              <div>
                <p className="font-medium text-sm">{formatPeriodLabel(ts.period_start_date)}</p>
                <p className="text-xs text-slate font-mono mt-0.5">{ts.total} hrs</p>
                {ts.status === 'rejected' && ts.rejection_reason && (
                  <p className="text-xs text-rust mt-1">{ts.rejection_reason}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ts.status} />
                {expanded === ts.id ? <ChevronUp size={16} className="text-slate" /> : <ChevronDown size={16} className="text-slate" />}
              </div>
            </div>

            {expanded === ts.id && (
              <div className="mt-3 pt-3 border-t border-line">
                <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Change log</p>
                {!adjustments[ts.id] && <p className="text-xs text-slate">Loading…</p>}
                {adjustments[ts.id]?.length === 0 && (
                  <p className="text-xs text-slate">No hours were changed after first being entered.</p>
                )}
                <div className="space-y-2">
                  {adjustments[ts.id]?.map((a) => (
                    <div key={a.id} className="bg-paper rounded-md p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-navy">
                          {a.project_codes?.code} · {a.day_date}
                        </span>
                        <span className="text-xs font-mono text-slate">{a.previous_hours} → {a.new_hours}</span>
                      </div>
                      <p className="text-xs text-slate mt-1">{a.justification}</p>
                      <p className="text-[10px] text-slate/70 mt-1">{new Date(a.changed_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
