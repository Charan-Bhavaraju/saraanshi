'use client'

import { useState } from 'react'
import SuggestedThemes from './SuggestedThemes'
import ThemeTree from './ThemeTree'
import SaturationTracker from './SaturationTracker'
import AskCorpus from './AskCorpus'
import type { SuggestedTheme, ClusterStatus, ThemeNode, SaturationPoint } from '../actions'
import type { IndexStatus } from '@/lib/rag/indexing'

type View = 'suggested' | 'tree' | 'saturation' | 'ask'

const VIEWS: { id: View; label: string }[] = [
  { id: 'suggested', label: 'Suggested themes' },
  { id: 'tree', label: 'Theme tree' },
  { id: 'saturation', label: 'Saturation' },
  { id: 'ask', label: 'Ask the corpus' },
]

export default function AnalysisWorkspace({
  initialSuggestions,
  status,
  themes,
  saturation,
  indexStatus,
}: {
  initialSuggestions: SuggestedTheme[]
  status: ClusterStatus
  themes: ThemeNode[]
  saturation: SaturationPoint[]
  indexStatus: IndexStatus
}) {
  const [view, setView] = useState<View>('suggested')

  return (
    <div>
      <nav
        className="flex gap-0.5 mb-6 w-fit"
        style={{ background: '#F5F1E9', padding: 3, borderRadius: 8, border: '1px solid #ECE6D9' }}
      >
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className="px-4 py-1.5 text-sm font-medium rounded-md transition-all"
            style={{
              background: view === v.id ? '#FFFFFF' : 'transparent',
              color: view === v.id ? '#1A1F2C' : '#4A5263',
              boxShadow: view === v.id ? '0 1px 2px rgba(0,0,0,0.04)' : undefined,
            }}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === 'suggested' && <SuggestedThemes initial={initialSuggestions} status={status} />}
      {view === 'tree' && <ThemeTree initial={themes} />}
      {view === 'saturation' && <SaturationTracker data={saturation} />}
      {view === 'ask' && <AskCorpus indexStatus={indexStatus} />}
    </div>
  )
}
