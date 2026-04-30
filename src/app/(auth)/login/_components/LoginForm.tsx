'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

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
  const router = useRouter()

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()

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
        <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>
          Check your email
        </p>
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

  return (
    <div>
      {/* Mode tabs */}
      <div
        className="flex gap-0.5 mb-6"
        style={{
          background: '#F5F1E9',
          padding: 3,
          borderRadius: 8,
          border: '1px solid #ECE6D9',
        }}
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

        <AuthInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />

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
