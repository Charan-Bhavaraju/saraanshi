'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { InterviewStatus } from '@/types/database'

type Props = {
  interviewId: string
  currentStatus: InterviewStatus
}

// Status transitions that should trigger a page refresh to show new UI
const REFRESH_ON: InterviewStatus[] = ['uploaded', 'transcribed']

export default function RealtimeStatusWatcher({ interviewId, currentStatus }: Props) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`interview-${interviewId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interviews',
          filter: `id=eq.${interviewId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: InterviewStatus }).status
          if (REFRESH_ON.includes(newStatus)) {
            // Hard refresh to pull new server-rendered data (transcript, status badge)
            router.refresh()
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [interviewId, router])

  return null // render nothing — just a side-effect component
}
