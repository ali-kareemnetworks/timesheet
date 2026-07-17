import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import { formatWeekLabel } from '../../lib/dates.js'
import { notifyRejection } from '../../lib/notify.js'
import StatusBadge from '../../components/StatusBadge.jsx'
import { Check, X } from 'lucide-react'

export default function Review() {
  const { profile } = useAuth()
  const [sheets, setSheets] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [entries, setEntries] = useState({})
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('timesheets')
      .select('*, profiles!timesheets_employee_id_fkey(full_name, email)')
      .eq('status', 'submitted')
      .order('submitted_at')
    setSheets(data || [])
  }

  async function expand(ts) {
    if (expanded === ts.id) { setExpanded(null); return }
    setExpanded(ts.id)
    if (!entries[ts.id]) {
      const { data } = await supabase.from('timesheet_entries')
        .select('*, project_codes(code, code_type)').eq('timesheet_id', ts.id)
      setEntries((prev) => ({ ...prev, [ts.id]: data || [] }))
    }
  }

  async function approve(ts) {
    setBusy(true)
    await supabase.from('timesheets').update({
      status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: profile.id,
    }).eq('id', ts.id)
    setBusy(false)
    load()
  }

  async function reject(ts) {
    if (!reason.trim()) return
    setBusy(true)
    await supabase.from('timesheets').update({
      status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: profile.id,
    }).eq('id', ts.id)
    await notifyRejection({
      toEmail: ts.profiles.email, toName: ts.profiles.full_name,
      weekStart: formatWeekLabel(ts.week_start_date), reason,
    })
    setRejecting(null)
    setReason('')
    setBusy(false)
    load()
  }

  function total(ts) {
    return (entries[ts.id] || []).reduce((s, e) => s + Number(e.hours), 0)
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">Review Timesheets</h1>
      {sheets === null && <p className="text-slate text-sm">Loading…</p>}
      {sheets?.length === 0 && <p className="text-slate text-sm">Nothing waiting for review.</p>}

      <div className="space-y-3">
        {sheets?.map((ts) => (
          <div key={ts.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => expand(ts)}>
              <div>
                <p className="font-medium text-sm">{ts.profiles.full_name}</p>
                <p className="text-xs text-slate">{formatWeekLabel(ts.week_start_date)}</p>
              </div>
              <StatusBadge status={ts.status} />
            </div>

            {expanded === ts.id && (
              <div className="mt-3 pt-3 border-t border-line space-y-2">
                {(entries[ts.id] || []).length === 0 && <p className="text-xs text-slate">No hours logged.</p>}
                {Object.entries(
                  (entries[ts.id] || []).reduce((acc, e) => {
                    const k = e.project_codes.code
                    acc[k] = (acc[k] || 0) + Number(e.hours)
                    return acc
                  }, {})
                ).map(([code, hrs]) => (
                  <div key={code} className="flex justify-between text-sm font-mono">
                    <span>{code}</span><span>{hrs} hrs</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-line">
                  <span>Total</span><span className="font-mono">{total(ts)} hrs</span>
                </div>

                {rejecting === ts.id ? (
                  <div className="space-y-2 pt-2">
                    <textarea className="input" rows={2} placeholder="What needs to be corrected?"
                      value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button className="btn-danger flex-1" disabled={busy} onClick={() => reject(ts)}>Send back</button>
                      <button className="btn-secondary" onClick={() => setRejecting(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2">
                    <button className="btn-approve flex-1" disabled={busy} onClick={() => approve(ts)}>
                      <Check size={16} /> Approve
                    </button>
                    <button className="btn-danger flex-1" disabled={busy} onClick={() => setRejecting(ts.id)}>
                      <X size={16} /> Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
