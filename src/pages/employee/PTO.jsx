import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../lib/AuthContext.jsx'

export default function PTO() {
  const { profile } = useAuth()
  const [ledger, setLedger] = useState(null)
  const [balance, setBalance] = useState(0)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('pto_ledger').select('*')
      .eq('employee_id', profile.id).order('entry_date', { ascending: false })
    setLedger(data || [])
    setBalance((data || []).reduce((s, r) => s + Number(r.hours), 0))
  }

  const negative = balance < 0

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">PTO Balance</h1>

      <div className="card p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-slate font-semibold">Current balance</p>
        <p className={`font-mono text-4xl font-semibold mt-2 ${negative ? 'text-rust' : 'text-navy'}`}>
          {balance} <span className="text-lg font-normal">hrs</span>
        </p>
        <p className="text-xs text-slate mt-2">
          Yearly allotment: <span className="font-mono">{profile.yearly_vacation_hours}</span> hrs
        </p>
        {negative && (
          <p className="text-xs text-rust mt-3 max-w-xs mx-auto">
            You're in a negative balance. You can still submit VACATION hours on your timesheet —
            they'll continue to be tracked here for your employer to reconcile.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate uppercase tracking-wide mb-2">History</h2>
        {ledger === null && <p className="text-slate text-sm">Loading…</p>}
        {ledger?.length === 0 && <p className="text-slate text-sm">No PTO activity yet.</p>}
        <div className="space-y-2">
          {ledger?.map((r) => (
            <div key={r.id} className="card p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium capitalize">{r.entry_type}</p>
                <p className="text-xs text-slate">{r.entry_date} {r.note ? `— ${r.note}` : ''}</p>
              </div>
              <span className={`font-mono text-sm font-semibold ${r.hours < 0 ? 'text-rust' : 'text-leaf'}`}>
                {r.hours > 0 ? '+' : ''}{r.hours}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
