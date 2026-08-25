import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { UserPlus, X, UserMinus, RotateCcw } from 'lucide-react'

const BLANK = { full_name: '', email: '', phone: '', home_address: '', position: '', yearly_vacation_hours: 80, start_date: '' }

export default function Employees() {
  const [employees, setEmployees] = useState(null)
  const [balances, setBalances] = useState({})
  const [earliestTimesheet, setEarliestTimesheet] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [offboardBusy, setOffboardBusy] = useState(null)
  const [grantFor, setGrantFor] = useState(null)
  const [grantAmount, setGrantAmount] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'employee').order('full_name')
    setEmployees(data || [])
    const { data: bal } = await supabase.from('pto_balances').select('*')
    const map = {}
    for (const b of bal || []) map[b.employee_id] = b.balance
    setBalances(map)

    const { data: sheets } = await supabase.from('timesheets').select('employee_id, period_start_date')
    const earliest = {}
    for (const s of sheets || []) {
      if (!earliest[s.employee_id] || s.period_start_date < earliest[s.employee_id]) {
        earliest[s.employee_id] = s.period_start_date
      }
    }
    setEarliestTimesheet(earliest)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.functions.invoke('create-employee', { body: form })
    setBusy(false)
    if (error) {
      let msg = error.message
      try {
        if (error.context && typeof error.context.json === 'function') {
          const body = await error.context.json()
          if (body?.error) msg = body.error
        }
      } catch { /* fall back to the generic message */ }
      setError(msg)
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }
    setForm(BLANK)
    setShowForm(false)
    load()
  }

  async function updateAllotment(emp, value) {
    await supabase.from('profiles').update({ yearly_vacation_hours: value }).eq('id', emp.id)
    load()
  }

  async function updateStartDate(emp, value, inputEl) {
    const original = emp.start_date || ''
    if (value === original) return

    const earliest = earliestTimesheet[emp.id]
    let message = null

    if (earliest && value && value > earliest) {
      message =
        `${emp.full_name} already has a submitted timesheet for the period starting ${earliest}, ` +
        `which is now BEFORE the new start date (${value}) you're setting. This will make their ` +
        `records look inconsistent in reports and history.\n\nChange it anyway?`
    } else if (earliest) {
      message =
        `${emp.full_name} already has submitted timesheets (earliest: period starting ${earliest}). ` +
        `Changing their start date won't modify any existing timesheets, but double check this is intentional.\n\nContinue?`
    }

    if (message && !window.confirm(message)) {
      if (inputEl) inputEl.value = original
      return
    }

    await supabase.from('profiles').update({ start_date: value || null }).eq('id', emp.id)
    load()
  }

  async function submitGrant(emp) {
    const hrs = parseFloat(grantAmount)
    if (!hrs) return
    await supabase.from('pto_ledger').insert({
      employee_id: emp.id, hours: hrs, entry_type: 'allotment', note: 'Manual grant by employer',
    })
    setGrantFor(null)
    setGrantAmount('')
    load()
  }

  async function handleOffboard(emp) {
    const confirmMsg =
      `Offboard ${emp.full_name}?\n\n` +
      `They will immediately lose the ability to sign in. All their historical timesheets, ` +
      `PTO history, and reports stay fully intact — nothing is deleted. You can reactivate ` +
      `them later if needed.`
    if (!window.confirm(confirmMsg)) return

    setOffboardBusy(emp.id)
    const { data, error } = await supabase.functions.invoke('offboard-employee', {
      body: { employee_id: emp.id, offboard: true },
    })
    setOffboardBusy(null)
    if (error || data?.error) {
      alert('Could not offboard: ' + (data?.error || error.message))
      return
    }
    load()
  }

  async function handleReactivate(emp) {
    setOffboardBusy(emp.id)
    const { data, error } = await supabase.functions.invoke('offboard-employee', {
      body: { employee_id: emp.id, offboard: false },
    })
    setOffboardBusy(null)
    if (error || data?.error) {
      alert('Could not reactivate: ' + (data?.error || error.message))
      return
    }
    load()
  }

  const activeEmployees = employees?.filter((e) => e.active) || []
  const offboardedEmployees = employees?.filter((e) => !e.active) || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Employees</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          <UserPlus size={16} /> Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">New employee</h2>
            <button type="button" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input required className="input" value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input required type="email" className="input" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Position</label>
              <input className="input" value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Home address</label>
              <input className="input" value={form.home_address}
                onChange={(e) => setForm({ ...form, home_address: e.target.value })} />
            </div>
            <div>
              <label className="label">Start date</label>
              <input type="date" className="input" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Yearly vacation hours</label>
              <input type="number" className="input" value={form.yearly_vacation_hours}
                onChange={(e) => setForm({ ...form, yearly_vacation_hours: Number(e.target.value) })} />
            </div>
          </div>
          {error && <p className="text-rust text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Sending invite…' : 'Create account & send invite'}
          </button>
          <p className="text-xs text-slate">The employee gets an email to set their own password.</p>
        </form>
      )}

      <div className="space-y-2">
        {employees === null && <p className="text-slate text-sm">Loading…</p>}
        {activeEmployees.map((emp) => (
          <div key={emp.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{emp.full_name}</p>
                <p className="text-xs text-slate">{emp.email} · {emp.phone || 'no phone'}</p>
                <p className="text-xs text-slate">{emp.position || 'No position set'}</p>
                <p className="text-xs text-slate">{emp.home_address}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-semibold">{Number(balances[emp.id] ?? 0).toFixed(2)} hrs</p>
                <p className="text-[11px] text-slate">PTO balance</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-line">
              <label className="text-xs text-slate flex items-center gap-1.5">
                Start date
                <input type="date" className="input !py-1 !w-36 text-xs"
                  defaultValue={emp.start_date || ''}
                  onBlur={(e) => updateStartDate(emp, e.target.value, e.target)} />
              </label>

              <label className="text-xs text-slate flex items-center gap-1.5">
                Allotment/yr
                <input type="number" className="input !py-1 !w-20 text-xs"
                  defaultValue={emp.yearly_vacation_hours}
                  onBlur={(e) => updateAllotment(emp, Number(e.target.value))} />
              </label>

              {grantFor === emp.id ? (
                <div className="flex items-center gap-1.5">
                  <input type="number" placeholder="hrs" className="input !py-1 !w-20 text-xs"
                    value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} />
                  <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => submitGrant(emp)}>Post</button>
                  <button className="text-xs text-slate" onClick={() => setGrantFor(null)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => setGrantFor(emp.id)}>Grant PTO hours</button>
              )}

              <button
                className="text-xs text-rust underline ml-auto flex items-center gap-1"
                disabled={offboardBusy === emp.id}
                onClick={() => handleOffboard(emp)}
              >
                <UserMinus size={12} /> {offboardBusy === emp.id ? 'Offboarding…' : 'Offboard'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {offboardedEmployees.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate uppercase tracking-wide pt-2">Offboarded</h2>
          {offboardedEmployees.map((emp) => (
            <div key={emp.id} className="card p-4 bg-paper/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm text-slate">{emp.full_name}</p>
                  <p className="text-xs text-slate">{emp.email}</p>
                  {emp.offboarded_at && (
                    <p className="text-xs text-slate mt-1">Offboarded {new Date(emp.offboarded_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-slate">{Number(balances[emp.id] ?? 0).toFixed(2)} hrs</p>
                  <p className="text-[11px] text-slate">Final PTO balance</p>
                </div>
              </div>
              <div className="flex justify-end mt-3 pt-3 border-t border-line">
                <button
                  className="text-xs text-navy underline flex items-center gap-1"
                  disabled={offboardBusy === emp.id}
                  onClick={() => handleReactivate(emp)}
                >
                  <RotateCcw size={12} /> {offboardBusy === emp.id ? 'Reactivating…' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
