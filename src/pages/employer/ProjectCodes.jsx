import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Plus, X } from 'lucide-react'

const BLANK = { code: '', customer_name: '', contract_task: '', labor_category: '', code_type: 'CLIENT_SITE' }
const TYPES = ['CLIENT_SITE', 'HOLIDAY', 'VACATION', 'INTERNAL', 'OTHER']

export default function ProjectCodes() {
  const [codes, setCodes] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('project_codes').select('*').order('code_type').order('code')
    setCodes(data || [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.from('project_codes').insert(form)
    setBusy(false)
    if (error) { setError(error.message); return }
    setForm(BLANK)
    setShowForm(false)
    load()
  }

  async function toggleActive(c) {
    await supabase.from('project_codes').update({ active: !c.active }).eq('id', c.id)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-navy">Project Codes</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Add</button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">New project code</h2>
            <button type="button" onClick={() => setShowForm(false)}><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Code</label>
              <input required className="input font-mono" placeholder="e.g. DOD-4471"
                value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.code_type} onChange={(e) => setForm({ ...form, code_type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Government customer</label>
              <input className="input" value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Contract / task order</label>
              <input className="input" value={form.contract_task}
                onChange={(e) => setForm({ ...form, contract_task: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Labor category</label>
              <input className="input" value={form.labor_category}
                onChange={(e) => setForm({ ...form, labor_category: e.target.value })} />
            </div>
          </div>
          {error && <p className="text-rust text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save code'}</button>
        </form>
      )}

      <div className="space-y-2">
        {codes === null && <p className="text-slate text-sm">Loading…</p>}
        {codes?.map((c) => (
          <div key={c.id} className="card p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-semibold text-navy">{c.code} <span className="text-[11px] font-body font-normal text-slate">· {c.code_type}</span></p>
              {c.customer_name && <p className="text-xs text-slate mt-1">Customer: {c.customer_name}</p>}
              {c.contract_task && <p className="text-xs text-slate">Contract/task: {c.contract_task}</p>}
              {c.labor_category && <p className="text-xs text-slate">Labor category: {c.labor_category}</p>}
            </div>
            <button className="text-xs text-slate underline shrink-0" onClick={() => toggleActive(c)}>
              {c.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
