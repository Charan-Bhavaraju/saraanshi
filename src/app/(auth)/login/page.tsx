import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoginForm from './_components/LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/today')

  const params = await searchParams
  const errorMessage =
    params.error === 'auth_callback_failed'
      ? 'Email confirmation failed. Please try signing in again.'
      : null

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#FAF7F2' }}
    >
      {/* Brand mark */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
          style={{
            background: '#0E5C5C',
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
            fontSize: 24,
            fontStyle: 'italic',
          }}
        >
          S
        </div>
        <div className="text-center">
          <h1
            className="text-2xl tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
          >
            Saaranshi
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8A929C' }}>
            Research companion
          </p>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: '#FFFFFF',
          border: '1px solid #ECE6D9',
          boxShadow: '0 1px 0 rgb(26 31 44 / 0.03), 0 8px 24px rgb(26 31 44 / 0.06)',
        }}
      >
        {errorMessage && (
          <div
            className="mb-5 px-4 py-3 rounded-lg text-sm"
            style={{ background: '#F7E5EB', color: '#B8456D', border: '1px solid #F0C8D4' }}
          >
            {errorMessage}
          </div>
        )}

        <LoginForm />
      </div>

      <p className="mt-8 text-xs" style={{ color: '#B5BBC4' }}>
        Single-user research app · IEC-compliant
      </p>
    </div>
  )
}
