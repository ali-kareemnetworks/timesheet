import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { formatPeriodLabel, toISODate, startOfPeriod, prevPeriodStart } from '../../lib/dates.js'
import { Download } from 'lucide-react'

export default function Reports() {
  const [from, setFrom] = useState(() => prevPeriodStart(prevPeriodStart(toISODate(startOfPeriod()))))
  const [to, setTo] = useState(() => toISODate(startOfPeriod()))
  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState('')
  const [rows, setRows] = useState(null)

  useEffect(() => {
    supabase.from('profiles').select('id, full_name').eq('role', 'employee').order('full_name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  async function runReport() {
    setRows(null)
    let query = supabase.from('timesheets')
      .select('*, profiles!timesheets_employee_id_fkey(full_name), timesheet_entries(hours, day_date, project_codes(code, code_type, customer_name, contract_task, labor_category))')
      .eq('status', 'approved')
      .gte('period_start_date', from)
      .lte('period_start_date', to)
    if (employeeId) query = query.eq('employee_id', employeeId)
    const { data, error } = await query
    if (error) { console.error(error); setRows([]); return }

    const flat = []
    for (const ts of data) {
      for (const e of ts.timesheet_entries) {
        flat.push({
          employee: ts.profiles.full_name,
          period: formatPeriodLabel(ts.period_start_date),
          day: e.day_date,
          code: e.project_codes.code,
          type: e.project_codes.code_type,
          customer: e.project_codes.customer_name || '',
          contract: e.project_codes.contract_task || '',
          laborCategory: e.project_codes.labor_category || '',
          hours: Number(e.hours),
        })
      }
    }
    flat.sort((a, b) => a.employee.localeCompare(b.employee) || a.day.localeCompare(b.day))
    setRows(flat)
  }

  function downloadCSV() {
    const headers = ['Employee', 'Period', 'Day', 'Code', 'Type', 'Customer', 'Contract/Task', 'Labor Category', 'Hours']
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push([r.employee, r.period, r.day, r.code, r.type, r.customer, r.contract, r.laborCategory, r.hours]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheet-report-${from}_to_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalHours = rows?.reduce((s, r) => s + r.hours, 0) || 0

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">Reports</h1>

      <div className="card p-4 grid sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="label">From (period starting)</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To (period starting)</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Employee</label>
          <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={runReport}>Run report</button>
      </div>

      {rows && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate">{rows.length} entries · <span className="font-mono font-semibold text-navy">{totalHours}</span> total hours</p>
            <button className="btn-secondary" onClick={downloadCSV} disabled={rows.length === 0}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-line text-left text-slate">
                  <th className="px-3 py-2">Employee</th><th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Code</th><th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Contract/Task</th><th className="px-3 py-2">Labor Cat.</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{r.employee}</td>
                    <td className="px-3 py-2 font-mono">{r.day}</td>
                    <td className="px-3 py-2 font-mono">{r.code}</td>
                    <td className="px-3 py-2">{r.customer}</td>
                    <td className="px-3 py-2">{r.contract}</td>
                    <td className="px-3 py-2">{r.laborCategory}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

