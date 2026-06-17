'use client'

import { useState } from 'react'
import {
  recomputeSuggestedThemes,
  promoteCluster,
  dismissCluster,
  type SuggestedTheme,
  type ClusterStatus,
} from '../actions'

export default function SuggestedThemes({
  initial,
  status,
}: {
  initial: SuggestedTheme[]
  status: ClusterStatus
}) {
  const [suggestions, setSuggestions] = useState<SuggestedTheme[]>(initial)
  const [stale, setStale] = useState(status.stale)
  const [recomputing, setRecomputing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const newCount =
    status.lastClusteredCount === null
      ? status.openCount
      : Math.max(0, status.openCount - status.lastClusteredCount)

  async function recompute() {
    setRecomputing(true)
    setError(null)
    try {
      const result = await recomputeSuggestedThemes()
      setSuggestions(result)
      setStale(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clustering failed')
    } finally {
      setRecomputing(false)
    }
  }

  async function promote(id: string) {
    setBusyId(id)
    try {
      await promoteCluster(id)
      setSuggestions(s => s.filter(x => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  async function dismiss(id: string) {
    setBusyId(id)
    try {
      await dismissCluster(id)
      setSuggestions(s => s.filter(x => x.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Recompute banner */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5 rounded-xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
        <p className="text-xs" style={{ color: '#8A929C' }}>
          {stale
            ? status.lastClusteredCount === null
              ? `${status.openCount} focus point${status.openCount === 1 ? '' : 's'} ready to cluster.`
              : `${newCount} new focus point${newCount === 1 ? '' : 's'} since last clustering.`
            : 'Clusters are up to date.'}
        </p>
        <button
          onClick={recompute}
          disabled={recomputing}
          className="text-sm font-medium rounded-lg px-3.5 py-1.5 transition-all disabled:opacity-60"
          style={{
            background: stale ? '#0E5C5C' : '#FFFFFF',
            color: stale ? '#FAF7F2' : '#4A5263',
            border: stale ? 'none' : '1px solid #ECE6D9',
          }}
        >
          {recomputing ? 'Clustering…' : stale ? 'Recompute suggestions' : 'Recompute'}
        </button>
      </div>

      {error && <p className="text-xs mb-4" style={{ color: '#B8456D' }}>{error}</p>}

      {suggestions.length === 0 ? (
        <div className="rounded-[14px] p-8 text-center" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
          <p className="text-sm" style={{ color: '#4A5263', lineHeight: 1.6 }}>
            No suggested clusters yet. Generate insights on a few interviews to produce focus points,
            then recompute — groupings of 3+ related focus points across interviews will surface here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suggestions.map(s => (
            <div key={s.id} className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', opacity: busyId === s.id ? 0.6 : 1 }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>{s.name ?? 'Unnamed cluster'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
                    {s.memberCount} focus points · {s.interviewCount} interview{s.interviewCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => promote(s.id)}
                    disabled={busyId === s.id}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
                    style={{ background: '#0E5C5C', color: '#FAF7F2' }}
                  >
                    Promote to theme
                  </button>
                  <button
                    onClick={() => dismiss(s.id)}
                    disabled={busyId === s.id}
                    className="text-xs px-2.5 py-1 rounded-lg transition-all"
                    style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#8A929C' }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              {s.examplePhrases.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  {s.examplePhrases.map((p, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#4A5263' }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
