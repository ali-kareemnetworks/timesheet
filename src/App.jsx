import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext.jsx'
import Login from './pages/Login.jsx'
import SetPassword from './pages/SetPassword.jsx'
import Layout from './components/Layout.jsx'

import EmployerDashboard from './pages/employer/Dashboard.jsx'
import EmployerReview from './pages/employer/Review.jsx'
import EmployerEmployees from './pages/employer/Employees.jsx'
import EmployerProjectCodes from './pages/employer/ProjectCodes.jsx'
import EmployerReports from './pages/employer/Reports.jsx'

import EmployeeWeek from './pages/employee/Week.jsx'
import EmployeeHistory from './pages/employee/History.jsx'
import EmployeePTO from './pages/employee/PTO.jsx'

function Splash() {
  return <div className="min-h-screen grid place-items-center text-slate font-mono text-sm">Loading…</div>
}

function Protected({ role, children }) {
  const { session, profile, loading } = useAuth()
  if (loading || (session && !profile)) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (role && profile?.role !== role) {
    return <Navigate to={profile?.role === 'employer' ? '/employer' : '/employee'} replace />
  }
  return children
}

export default function App() {
  const { session, profile, loading } = useAuth()

  // Invite and password-reset links land here with #...&type=invite (or recovery)
  // in the URL. Catch that before any normal routing kicks in.
  const hash = window.location.hash
  if (hash.includes('type=invite') || hash.includes('type=recovery')) {
    return <SetPassword />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/employer" element={<Protected role="employer"><Layout /></Protected>}>
        <Route index element={<EmployerDashboard />} />
        <Route path="review" element={<EmployerReview />} />
        <Route path="employees" element={<EmployerEmployees />} />
        <Route path="project-codes" element={<EmployerProjectCodes />} />
        <Route path="reports" element={<EmployerReports />} />
      </Route>

      <Route path="/employee" element={<Protected role="employee"><Layout /></Protected>}>
        <Route index element={<EmployeeWeek />} />
        <Route path="history" element={<EmployeeHistory />} />
        <Route path="pto" element={<EmployeePTO />} />
      </Route>

      <Route
        path="/"
        element={
          loading ? <Splash /> :
          !session ? <Navigate to="/login" replace /> :
          !profile ? <Splash /> :
          <Navigate to={profile.role === 'employer' ? '/employer' : '/employee'} replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
