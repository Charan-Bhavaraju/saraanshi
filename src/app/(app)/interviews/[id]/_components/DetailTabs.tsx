'use client'

import { useState } from 'react'
import InsightsTab from './InsightsTab'
import ObjectivesTab from './ObjectivesTab'
import type { InsightsData } from '../insights/actions'
import type { ObjectivesData } from '../objectives/actions'

type Props = {
  // Server-rendered transcript viewer (audio + editor). Stays mounted so the
  // audio player can receive cross-tab seek events from the Insights tab.
  transcript: React.ReactNode
  insightsEnabled: boolean
  insightsProps: {
    interviewId: string
    hasTranslation: boolean
    estimatedPaise: number
    initial: InsightsData
  }
  objectivesProps: {
    interviewId: string
    hasTranslation: boolean
    estimatedPaise: number
    initial: ObjectivesData
  }
}

type Tab = 'transcript' | 'insights' | 'objectives'

export default function DetailTabs({ transcript, insightsEnabled, insightsProps, objectivesProps }: Props) {
  const [tab, setTab] = useState<Tab>('transcript')

  function handleSeek(seconds: number) {
    setTab('transcript')
    // AudioPlayer (mounted in the transcript panel) listens for this.
    window.dispatchEvent(new CustomEvent('saaranshi:seek', { detail: { seconds } }))
  }

  return (
    <div>
      {insightsEnabled && (
        <nav
          className="flex gap-0.5 mb-6 w-fit"
          style={{ background: '#F5F1E9', padding: 3, borderRadius: 8, border: '1px solid #ECE6D9' }}
        >
          <TabButton active={tab === 'transcript'} onClick={() => setTab('transcript')}>Transcript</TabButton>
          <TabButton active={tab === 'insights'} onClick={() => setTab('insights')}>Insights</TabButton>
          <TabButton active={tab === 'objectives'} onClick={() => setTab('objectives')}>Objectives</TabButton>
        </nav>
      )}

      {/* All panels stay mounted; inactive ones are hidden so audio/wavesurfer state survives. */}
      <div className={tab === 'transcript' ? '' : 'hidden'}>{transcript}</div>
      {insightsEnabled && (
        <div className={tab === 'insights' ? '' : 'hidden'}>
          <InsightsTab {...insightsProps} onSeek={handleSeek} />
        </div>
      )}
      {insightsEnabled && (
        <div className={tab === 'objectives' ? '' : 'hidden'}>
          <ObjectivesTab {...objectivesProps} onSeek={handleSeek} />
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
      style={{
        background: active ? '#FFFFFF' : 'transparent',
        color: active ? '#1A1F2C' : '#4A5263',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : undefined,
      }}
    >
      {children}
    </button>
  )
}
