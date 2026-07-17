import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import { formatWeekLabel } from '../../lib/dates.js'
import StatusBadge from '../../components/StatusBadge.jsx'

export default function History() {
  const { profile } = useAuth()
  const [rows, setRows] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: sheets } = await supabase.from('timesheets').select('*')
      .eq('employee_id', profile.id).order('week_start_date', { ascending: false })

    const withTotals = await Promise.all((sheets || []).map(async (ts) => {
      const { data: entries } = await supabase.from('timesheet_entries').select('hours').eq('timesheet_id', ts.id)
      const total = (entries || []).reduce((s, e) => s + Number(e.hours), 0)
      return { ...ts, total }
    }))
    setRows(withTotals)
  }

  if (!rows) return <p className="text-slate font-mono text-sm">Loading…</p>

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">History</h1>
      {rows.length === 0 && <p className="text-slate text-sm">No timesheets yet.</p>}
      <div className="space-y-2">
        {rows.map((ts) => (
          <div key={ts.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{formatWeekLabel(ts.week_start_date)}</p>
              <p className="text-xs text-slate font-mono mt-0.5">{ts.total} hrs</p>
              {ts.status === 'rejected' && ts.rejection_reason && (
                <p className="text-xs text-rust mt-1">{ts.rejection_reason}</p>
              )}
            </div>
            <StatusBadge status={ts.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
