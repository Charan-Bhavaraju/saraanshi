'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup' | 'forgot'

function AuthInput({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: '#4A5263' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
        style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C' }}
        onFocus={e => {
          e.target.style.borderColor = '#0E5C5C'
          e.target.style.boxShadow = '0 0 0 3px #E2EEEC'
        }}
        onBlur={e => {
          e.target.style.borderColor = '#ECE6D9'
          e.target.style.boxShadow = 'none'
        }}
      />
    </div>
  )
}

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpDone, setSignUpDone] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const router = useRouter()

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirmPassword('')
    setSignUpDone(false)
    setResetDone(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const supabase = createClient()

    if (mode === 'forgot') {
      setLoading(true)
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password` },
      )
      setLoading(false)
      if (err) setError(err.message)
      else setResetDone(true)
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    if (mode === 'signin') {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      setLoading(false)
      if (err) {
        setError(err.message)
      } else {
        router.push('/today')
        router.refresh()
      }
    } else {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      setLoading(false)
      if (err) {
        setError(err.message)
      } else {
        setSignUpDone(true)
      }
    }
  }

  // ── Success states ──────────────────────────────────────────────────────────

  if (signUpDone) {
    return (
      <div className="text-center py-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: '#E2EEEC' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9.5L7 13.5L15 5.5" stroke="#0E5C5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Check your email</p>
        <p className="text-sm mt-1" style={{ color: '#8A929C' }}>
          Confirmation link sent to{' '}
          <span style={{ color: '#1A1F2C' }}>{email}</span>.
          <br />Click it to activate your account.
        </p>
        <button
          onClick={() => { setSignUpDone(false); switchMode('signin') }}
          className="mt-5 text-sm font-medium"
          style={{ color: '#0E5C5C' }}
        >
          Back to sign in
        </button>
      </div>
    )
  }

  if (resetDone) {
    return (
      <div className="text-center py-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: '#E2EEEC' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v8M9 13h.01" stroke="#0E5C5C" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Reset link sent</p>
        <p className="text-sm mt-1" style={{ color: '#8A929C' }}>
          Check <span style={{ color: '#1A1F2C' }}>{email}</span> for a password
          reset link. It expires in 1 hour.
        </p>
        <button
          onClick={() => switchMode('signin')}
          className="mt-5 text-sm font-medium"
          style={{ color: '#0E5C5C' }}
        >
          Back to sign in
        </button>
      </div>
    )
  }

  // ── Forms ───────────────────────────────────────────────────────────────────

  if (mode === 'forgot') {
    return (
      <div>
        <button
          type="button"
          onClick={() => switchMode('signin')}
          className="flex items-center gap-1.5 text-sm mb-5"
          style={{ color: '#8A929C' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to sign in
        </button>

        <p className="text-sm font-medium mb-1" style={{ color: '#1A1F2C' }}>Reset your password</p>
        <p className="text-sm mb-5" style={{ color: '#8A929C' }}>
          Enter your email and we&apos;ll send a reset link.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <AuthInput
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="sravya@iiphg.ac.in"
            autoComplete="email"
          />

          {error && (
            <p className="text-sm px-3 py-2.5 rounded-lg" style={{ background: '#F7E5EB', color: '#B8456D' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 mt-1"
            style={{ background: '#0E5C5C', color: '#FFFFFF' }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      {/* Mode tabs */}
      <div
        className="flex gap-0.5 mb-6"
        style={{ background: '#F5F1E9', padding: 3, borderRadius: 8, border: '1px solid #ECE6D9' }}
      >
        {(['signin', 'signup'] as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className="flex-1 py-1.5 text-sm font-medium rounded-md transition-all"
            style={{
              background: mode === m ? '#FFFFFF' : 'transparent',
              color: mode === m ? '#1A1F2C' : '#4A5263',
              boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
            }}
          >
            {m === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <AuthInput
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="sravya@iiphg.ac.in"
          autoComplete="email"
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium" style={{ color: '#4A5263' }}>
              Password
            </label>
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs"
                style={{ color: '#0E5C5C' }}
              >
                Forgot password?
              </button>
            )}
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{ border: '1px solid #ECE6D9', background: '#FFFFFF', color: '#1A1F2C' }}
            onFocus={e => {
              e.target.style.borderColor = '#0E5C5C'
              e.target.style.boxShadow = '0 0 0 3px #E2EEEC'
            }}
            onBlur={e => {
              e.target.style.borderColor = '#ECE6D9'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        {mode === 'signup' && (
          <AuthInput
            id="confirm-password"
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        )}

        {error && (
          <p className="text-sm px-3 py-2.5 rounded-lg" style={{ background: '#F7E5EB', color: '#B8456D' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim() || !password}
          className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 mt-1"
          style={{ background: '#0E5C5C', color: '#FFFFFF', border: '1px solid #0E5C5C' }}
        >
          {loading
            ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
            : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
