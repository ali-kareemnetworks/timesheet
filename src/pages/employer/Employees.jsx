import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { UserPlus, X } from 'lucide-react'

const BLANK = { full_name: '', email: '', phone: '', home_address: '', position: '', yearly_vacation_hours: 80 }

export default function Employees() {
  const [employees, setEmployees] = useState(null)
  const [balances, setBalances] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
  }

  async function handleAdd(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { data, error } = await supabase.functions.invoke('create-employee', { body: form })
    setBusy(false)
    if (error || data?.error) {
      setError(data?.error || error.message)
      return
    }
    setForm(BLANK)
    setShowForm(false)
    load()
  }

  async function toggleActive(emp) {
    await supabase.from('profiles').update({ active: !emp.active }).eq('id', emp.id)
    load()
  }

  async function updateAllotment(emp, value) {
    await supabase.from('profiles').update({ yearly_vacation_hours: value }).eq('id', emp.id)
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
        {employees?.map((emp) => (
          <div key={emp.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{emp.full_name} {!emp.active && <span className="text-xs text-rust ml-1">(inactive)</span>}</p>
                <p className="text-xs text-slate">{emp.email} · {emp.phone || 'no phone'}</p>
                <p className="text-xs text-slate">{emp.position || 'No position set'}</p>
                <p className="text-xs text-slate">{emp.home_address}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-semibold">{balances[emp.id] ?? 0} hrs</p>
                <p className="text-[11px] text-slate">PTO balance</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-line">
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

              <button className="text-xs text-slate underline ml-auto" onClick={() => toggleActive(emp)}>
                {emp.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
