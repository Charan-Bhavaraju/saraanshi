'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Props = { interviewId: string }

const POLL_INTERVAL_MS = 6000

export default function TranscribingPoller({ interviewId }: Props) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let stopped = false

    async function poll() {
      if (stopped) return
      try {
        const res = await fetch(`/api/interviews/${interviewId}/transcription-status`)
        // Parse json regardless of ok status — the route returns jobState in both
        // success and error responses so we can distinguish transient vs definitive.
        const data = await res.json().catch(() => ({}))
        if (data.jobState === 'Completed') {
          router.refresh()
          return
        }
        if (data.jobState === 'Failed') {
          router.refresh() // page reverts to 'uploaded' state
          return
        }
      } catch {
        // Network blip — keep polling
      }
      if (!stopped) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)

    return () => {
      stopped = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [interviewId, router])

  return null
}
