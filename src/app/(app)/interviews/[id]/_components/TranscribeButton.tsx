'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  interviewId: string
  disabled?: boolean
}

type State = 'idle' | 'submitting' | 'error'

function Spinner() {
  return (
    <svg
      className="animate-spin shrink-0"
      width="15" height="15" viewBox="0 0 15 15" fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M7.5 1.5a6 6 0 0 1 6 6"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      />
    </svg>
  )
}

export default function TranscribeButton({ interviewId, disabled }: Props) {
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  async function handleClick() {
    if (state === 'submitting' || disabled) return
    setState('submitting')
    setErrorMsg('')

    try {
      const res = await fetch(`/api/interviews/${interviewId}/transcribe`, { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({ error: 'Submission failed' }))
        setErrorMsg(data.error ?? 'Submission failed')
        setState('error')
      }
    } catch {
      setErrorMsg('Network error — check your connection')
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleClick}
        disabled={disabled || state === 'submitting'}
        className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60 w-fit"
        style={{ background: '#0E5C5C', color: '#FFFFFF' }}
      >
        {state === 'submitting' ? (
          <>
            <Spinner />
            Uploading to Sarvam…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 4h10M2 7h8M2 10h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Transcribe with Sarvam AI
          </>
        )}
      </button>

      {state === 'submitting' && (
        <div className="flex items-start gap-2.5 px-1">
          <div className="flex gap-0.5 mt-0.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="inline-block rounded-full"
                style={{
                  width: 4, height: 4,
                  background: '#B8842A',
                  animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#8A929C' }}>
            Downloading from R2 and uploading to Sarvam. Usually takes 10–30s depending on file size.
          </p>
        </div>
      )}

      {state === 'error' && (
        <p className="text-xs px-1" style={{ color: '#B8456D' }}>
          {errorMsg}{' '}
          <button className="underline font-medium" onClick={handleClick}>Retry</button>
        </p>
      )}

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
