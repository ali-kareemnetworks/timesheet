import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext.jsx'
import { useCompanyLogo } from '../lib/branding.js'
import { supabase } from '../lib/supabase.js'
import { ClipboardList } from 'lucide-react'

export default function Login() {
  const { session, profile, signIn, loading } = useAuth()
  const { logoUrl } = useCompanyLogo()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [mode, setMode] = useState('signin') // 'signin' | 'forgot'
  const [resetSent, setResetSent] = useState(false)

  if (!loading && session && profile) {
    return <Navigate to={profile.role === 'employer' ? '/employer' : '/employee'} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setError('Email or password is incorrect.')
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/',
    })
    setBusy(false)
    // Always show success, whether or not the email exists — this avoids
    // leaking which emails have accounts.
    if (!error) setResetSent(true)
    else setError('Something went wrong. Please try again.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {logoUrl ? (
            <img src={logoUrl} alt="Company logo" className="max-h-16 max-w-[220px] object-contain mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-navy text-paper grid place-items-center mb-3">
              <ClipboardList size={24} />
            </div>
          )}
          <h1 className="font-display text-2xl font-semibold text-navy">Timekeep</h1>
          <p className="text-slate text-sm mt-1">{mode === 'signin' ? 'Sign in to your account' : 'Reset your password'}</p>
        </div>

        {mode === 'signin' ? (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required autoComplete="username" className="input"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" required autoComplete="current-password" className="input"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-rust text-sm font-medium">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" className="text-xs text-slate underline block mx-auto"
              onClick={() => { setMode('forgot'); setError(''); setResetSent(false) }}>
              Forgot password?
            </button>
          </form>
        ) : (
          <div className="card p-6 space-y-4">
            {resetSent ? (
              <>
                <p className="text-sm text-leaf font-medium">
                  If an account exists for that email, a password reset link is on its way. Check your inbox (and spam folder).
                </p>
                <button type="button" className="text-xs text-slate underline block mx-auto"
                  onClick={() => { setMode('signin'); setResetSent(false) }}>
                  Back to sign in
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="label" htmlFor="reset-email">Email</label>
                  <input id="reset-email" type="email" required autoComplete="username" className="input"
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {error && <p className="text-rust text-sm font-medium">{error}</p>}
                <button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
                <button type="button" className="text-xs text-slate underline block mx-auto"
                  onClick={() => { setMode('signin'); setError('') }}>
                  Back to sign in
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-xs text-slate text-center mt-6">
          Accounts are created by your employer. Contact them if you need access.
        </p>
      </div>
    </div>
  )
}
