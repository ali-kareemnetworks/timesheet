import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'

export default function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    (async () => {
      const [{ count: pending }, { count: employees }, { count: codes }] = await Promise.all([
        supabase.from('timesheets').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee').eq('active', true),
        supabase.from('project_codes').select('*', { count: 'exact', head: true }).eq('active', true),
      ])
      setStats({ pending, employees, codes })
    })()
  }, [])

  const cards = [
    { label: 'Awaiting review', value: stats?.pending, to: '/employer/review', accent: 'text-gold' },
    { label: 'Active employees', value: stats?.employees, to: '/employer/employees', accent: 'text-navy' },
    { label: 'Active project codes', value: stats?.codes, to: '/employer/project-codes', accent: 'text-navy' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-semibold text-navy">Overview</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="card p-5 block hover:border-gold transition">
            <p className={`font-mono text-3xl font-semibold ${c.accent}`}>{c.value ?? '–'}</p>
            <p className="text-xs text-slate mt-1 uppercase tracking-wide font-semibold">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
