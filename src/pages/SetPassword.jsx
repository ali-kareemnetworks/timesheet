import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { ClipboardList } from 'lucide-react'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) { setError(error.message); return }

    // Clear the invite tokens out of the URL, then send them into the app.
    window.history.replaceState(null, '', window.location.pathname)
    setDone(true)
    setTimeout(() => window.location.assign('/'), 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-navy text-paper grid place-items-center mb-3">
            <ClipboardList size={24} />
          </div>
          <h1 className="font-display text-2xl font-semibold text-navy">Welcome to Timekeep</h1>
          <p className="text-slate text-sm mt-1 text-center">Set a password to finish creating your account.</p>
        </div>

        {done ? (
          <p className="text-center text-leaf font-medium text-sm">Password set — taking you in…</p>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label className="label" htmlFor="password">New password</label>
              <input id="password" type="password" required autoComplete="new-password" className="input"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirm password</label>
              <input id="confirm" type="password" required autoComplete="new-password" className="input"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-rust text-sm font-medium">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
