import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Plus, X, ChevronDown, ChevronUp, Check } from 'lucide-react'

const BLANK = { code: '', customer_name: '', contract_task: '', labor_category: '', code_type: 'CLIENT_SITE' }
const TYPES = ['CLIENT_SITE', 'HOLIDAY', 'VACATION', 'INTERNAL', 'OTHER']

function sameSet(a, b) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

export default function ProjectCodes() {
  const [codes, setCodes] = useState(null)
  const [employees, setEmployees] = useState([])
  const [assignments, setAssignments] = useState({}) // codeId -> Set of employeeIds (saved state)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [pending, setPending] = useState(new Set()) // checkbox state for the open panel, unsaved
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: codeData }, { data: empData }, { data: assignData }] = await Promise.all([
      supabase.from('project_codes').select('*').order('code_type').order('code'),
      supabase.from('profiles').select('id, full_name').eq('role', 'employee').order('full_name'),
      supabase.from('employee_project_codes').select('employee_id, project_code_id'),
    ])
    setCodes(codeData || [])
    setEmployees(empData || [])
    const map = {}
    for (const a of assignData || []) {
      if (!map[a.project_code_id]) map[a.project_code_id] = new Set()
      map[a.project_code_id].add(a.employee_id)
    }
    setAssignments(map)
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

  function openAssignPanel(codeId) {
    if (expanded === codeId) {
      setExpanded(null)
      return
    }
    setExpanded(codeId)
    setPending(new Set(assignments[codeId] || []))
    setSaveMsg('')
  }

  function toggleCheckbox(employeeId) {
    setPending((prev) => {
      const next = new Set(prev)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
    setSaveMsg('')
  }

  async function handleSaveAssignments(codeId) {
    const original = assignments[codeId] || new Set()
    const toAdd = [...pending].filter((id) => !original.has(id))
    const toRemove = [...original].filter((id) => !pending.has(id))

    setBusy(true)
    try {
      if (toAdd.length) {
        const { error } = await supabase.from('employee_project_codes')
          .insert(toAdd.map((employee_id) => ({ employee_id, project_code_id: codeId })))
        if (error) throw error
      }
      if (toRemove.length) {
        const { error } = await supabase.from('employee_project_codes')
          .delete().eq('project_code_id', codeId).in('employee_id', toRemove)
        if (error) throw error
      }
      setAssignments((prev) => ({ ...prev, [codeId]: new Set(pending) }))
      setSaveMsg('Saved.')
    } catch (e) {
      setSaveMsg('Could not save: ' + e.message)
    }
    setBusy(false)
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
          <p className="text-xs text-slate">You can assign employees to this code right after saving it, below.</p>
        </form>
      )}

      <div className="space-y-2">
        {codes === null && <p className="text-slate text-sm">Loading…</p>}
        {codes?.map((c) => {
          const savedSet = assignments[c.id] || new Set()
          const isOpen = expanded === c.id
          const isUniversal = c.code_type === 'HOLIDAY' || c.code_type === 'VACATION'
          const dirty = isOpen && !sameSet(pending, savedSet)
          return (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
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

              <div className="mt-3 pt-3 border-t border-line">
                <button
                  className="flex items-center gap-1.5 text-xs font-semibold text-navy"
                  onClick={() => openAssignPanel(c.id)}
                >
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Assign employees
                  <span className="text-slate font-normal">
                    ({isUniversal ? 'everyone — HOLIDAY/VACATION are automatic' : `${savedSet.size} assigned`})
                  </span>
                </button>

                {isOpen && !isUniversal && (
                  <div className="mt-3 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2">
                      {employees.length === 0 && <p className="text-xs text-slate">No employees yet.</p>}
                      {employees.map((emp) => (
                        <label key={emp.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox" checked={pending.has(emp.id)}
                            onChange={() => toggleCheckbox(emp.id)}
                          />
                          {emp.full_name}
                        </label>
                      ))}
                    </div>

                    {employees.length > 0 && (
                      <div className="flex items-center gap-3">
                        <button
                          className="btn-primary !py-1.5 !px-3 text-xs"
                          disabled={!dirty || busy}
                          onClick={() => handleSaveAssignments(c.id)}
                        >
                          <Check size={14} /> {busy ? 'Saving…' : 'Save assignments'}
                        </button>
                        {dirty && !busy && <span className="text-xs text-gold">Unsaved changes</span>}
                        {saveMsg && !dirty && <span className="text-xs text-leaf">{saveMsg}</span>}
                      </div>
                    )}
                  </div>
                )}
                {isOpen && isUniversal && (
                  <p className="text-xs text-slate mt-2">
                    HOLIDAY and VACATION are given to every employee automatically and can't be unassigned individually.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
