'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/today'), 2000)
    }
  }

  const inputStyle = {
    border: '1px solid #ECE6D9',
    background: '#FFFFFF',
    color: '#1A1F2C',
  }

  function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#0E5C5C'
    e.target.style.boxShadow = '0 0 0 3px #E2EEEC'
  }
  function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#ECE6D9'
    e.target.style.boxShadow = 'none'
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#FAF7F2' }}
    >
      {/* Brand mark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
          style={{ background: '#0E5C5C', fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, fontStyle: 'italic' }}
        >
          S
        </div>
        <div className="text-center">
          <h1 className="text-2xl tracking-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}>
            Saaranshi
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8A929C' }}>Research companion</p>
        </div>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: '#FFFFFF',
          border: '1px solid #ECE6D9',
          boxShadow: '0 1px 0 rgb(26 31 44 / 0.03), 0 8px 24px rgb(26 31 44 / 0.06)',
        }}
      >
        {done ? (
          <div className="text-center py-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: '#E2EEEC' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9.5L7 13.5L15 5.5" stroke="#0E5C5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Password updated</p>
            <p className="text-sm mt-1" style={{ color: '#8A929C' }}>Redirecting you to the app…</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: '#1A1F2C' }}>Set a new password</p>
            <p className="text-sm mb-5" style={{ color: '#8A929C' }}>Choose a strong password for your account.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium" style={{ color: '#4A5263' }}>
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm" className="text-sm font-medium" style={{ color: '#4A5263' }}>
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                  className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
              </div>

              {error && (
                <p className="text-sm px-3 py-2.5 rounded-lg" style={{ background: '#F7E5EB', color: '#B8456D' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all disabled:opacity-50 mt-1"
                style={{ background: '#0E5C5C', color: '#FFFFFF' }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
