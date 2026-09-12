import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Account() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) { setError(error.message); return }
    setPassword('')
    setConfirm('')
    setMessage('Password updated.')
  }

  return (
    <div className="space-y-5 max-w-sm">
      <h1 className="font-display text-2xl font-semibold text-navy">Account</h1>
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <h2 className="font-semibold text-sm text-navy">Change password</h2>
        <div>
          <label className="label" htmlFor="new-password">New password</label>
          <input id="new-password" type="password" required autoComplete="new-password" className="input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" required autoComplete="new-password" className="input"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="text-rust text-sm">{error}</p>}
        {message && <p className="text-leaf text-sm">{message}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </div>
  )
}
