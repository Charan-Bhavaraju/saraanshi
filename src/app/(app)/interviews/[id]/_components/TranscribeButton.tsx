'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  interviewId: string
  disabled?: boolean
}

type State = 'idle' | 'loading' | 'error'

export default function TranscribeButton({ interviewId, disabled }: Props) {
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  async function handleClick() {
    if (state === 'loading' || disabled) return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch(`/api/interviews/${interviewId}/transcribe`, { method: 'POST' })
      if (res.ok) {
        // Realtime will push the status update; force a router refresh as fallback
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({ error: 'Transcription failed' }))
        setErrorMsg(data.error ?? 'Transcription failed')
        setState('error')
      }
    } catch {
      setErrorMsg('Network error — check your connection')
      setState('error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={disabled || state === 'loading'}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60"
        style={{ background: '#0E5C5C', color: '#FFFFFF', border: '1px solid #0E5C5C' }}
      >
        {state === 'loading' ? (
          <>
            <div
              className="w-4 h-4 rounded-full border-2 animate-spin shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF' }}
            />
            Transcribing…
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

      {state === 'error' && (
        <p className="text-xs px-1" style={{ color: '#B8456D' }}>
          {errorMsg} — <button className="underline" onClick={handleClick}>retry</button>
        </p>
      )}

      {state === 'loading' && (
        <p className="text-xs px-1" style={{ color: '#8A929C' }}>
          Processing in background. This usually takes 30–60s for a 30-min interview.
        </p>
      )}
    </div>
  )
}
