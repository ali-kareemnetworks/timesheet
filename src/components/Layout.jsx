import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import {
  ClipboardList, LayoutGrid, ClipboardCheck, Users, Tag, BarChart3,
  CalendarDays, History, PalmtreeIcon, LogOut,
} from 'lucide-react'

const EMPLOYER_NAV = [
  { to: '/employer', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/employer/review', label: 'Review', icon: ClipboardCheck },
  { to: '/employer/employees', label: 'Employees', icon: Users },
  { to: '/employer/project-codes', label: 'Codes', icon: Tag },
  { to: '/employer/reports', label: 'Reports', icon: BarChart3 },
]

const EMPLOYEE_NAV = [
  { to: '/employee', label: 'My Week', icon: CalendarDays, end: true },
  { to: '/employee/history', label: 'History', icon: History },
  { to: '/employee/pto', label: 'PTO', icon: PalmtreeIcon },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const nav = profile?.role === 'employer' ? EMPLOYER_NAV : EMPLOYEE_NAV

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-navy text-paper min-h-screen p-4">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <ClipboardList size={22} />
          <span className="font-display text-lg font-semibold">Timekeep</span>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition ${
                  isActive ? 'bg-white/10 text-white' : 'text-paper/70 hover:bg-white/5 hover:text-paper'
                }`
              }>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-3 mt-3">
          <p className="px-3 text-xs text-paper/50 truncate mb-2">{profile?.full_name}</p>
          <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-paper/70 hover:bg-white/5 hover:text-paper w-full">
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-navy text-paper sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <ClipboardList size={20} />
          <span className="font-display text-base font-semibold">Timekeep</span>
        </div>
        <button onClick={signOut} aria-label="Sign out" className="p-2 -mr-2">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-line flex z-10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-navy' : 'text-slate/60'
              }`
            }>
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
