'use client'

import { useState, useCallback } from 'react'

type AuditRow = {
  code: string
  id: string
  status: string
  insights: boolean
  objectives: boolean
  chunks: number
  hasTranslation: boolean
}

type LogEntry = { msg: string; ok: boolean }

export default function BackfillButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [audit, setAudit] = useState<AuditRow[] | null>(null)
  const [missing, setMissing] = useState({ insights: 0, objectives: 0, embeddings: 0 })
  const [log, setLog] = useState<LogEntry[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const runAudit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/backfill')
      const data = await res.json()
      setAudit(data.rows)
      setMissing(data.missing)
    } catch {
      setLog([{ msg: 'Failed to fetch audit', ok: false }])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setLog([])
    setProgress({ done: 0, total: 0 })
    runAudit()
  }, [runAudit])

  const runBackfill = useCallback(async () => {
    if (!audit) return
    setRunning(true)
    setLog([])

    // Build task list: insights → objectives → embeddings
    const tasks: Array<{ id: string; code: string; op: string; hasTranslation: boolean }> = []
    for (const r of audit) {
      if (!r.insights) tasks.push({ id: r.id, code: r.code, op: 'insights', hasTranslation: r.hasTranslation })
    }
    for (const r of audit) {
      if (!r.objectives) tasks.push({ id: r.id, code: r.code, op: 'objectives', hasTranslation: r.hasTranslation })
    }
    for (const r of audit) {
      if (r.chunks === 0) tasks.push({ id: r.id, code: r.code, op: 'embeddings', hasTranslation: r.hasTranslation })
    }

    setProgress({ done: 0, total: tasks.length })

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      setLog(prev => [...prev, { msg: `⏳ ${t.op} for ${t.code}...`, ok: true }])
      try {
        const res = await fetch('/api/backfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: t.id, op: t.op, hasTranslation: t.hasTranslation }),
        })
        const data = await res.json()
        if (data.ok) {
          const suffix = data.fallback ? ' (cleaned fallback)' : ''
          setLog(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { msg: `✅ ${t.op} for ${t.code}${suffix}`, ok: true }
            return copy
          })
        } else {
          setLog(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { msg: `❌ ${t.op} for ${t.code}: ${data.error}`, ok: false }
            return copy
          })
        }
      } catch (e) {
        setLog(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { msg: `❌ ${t.op} for ${t.code}: network error`, ok: false }
          return copy
        })
      }
      setProgress({ done: i + 1, total: tasks.length })
    }

    setRunning(false)
    // Refresh audit
    await runAudit()
  }, [audit, runAudit])

  const totalMissing = missing.insights + missing.objectives + missing.embeddings

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
        style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#4A5263' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12a9 9 0 11-6.22-8.56" />
          <path d="M21 3v5h-5" />
        </svg>
        Backfill AI
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div
            className="rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#ECE6D9' }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: '#1A1F2C' }}>Backfill AI Analysis</h2>
                <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
                  Generate missing insights, objectives &amp; embeddings
                </p>
              </div>
              <button
                onClick={() => { setOpen(false); setAudit(null) }}
                className="text-lg px-2 py-1 rounded-lg hover:bg-gray-100"
                style={{ color: '#8A929C' }}
                disabled={running}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {loading && !audit && (
                <p className="text-sm text-center py-6" style={{ color: '#8A929C' }}>Auditing interviews...</p>
              )}

              {audit && (
                <>
                  {/* Summary */}
                  <div className="rounded-xl p-4" style={{ background: '#FAF7F2', border: '1px solid #ECE6D9' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#1A1F2C' }}>
                      {audit.length} eligible interviews
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold" style={{ color: missing.insights > 0 ? '#D97706' : '#059669' }}>
                          {missing.insights}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: '#8A929C' }}>Need insights</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold" style={{ color: missing.objectives > 0 ? '#D97706' : '#059669' }}>
                          {missing.objectives}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: '#8A929C' }}>Need objectives</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold" style={{ color: missing.embeddings > 0 ? '#D97706' : '#059669' }}>
                          {missing.embeddings}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: '#8A929C' }}>Need embeddings</p>
                      </div>
                    </div>
                  </div>

                  {/* Per-interview table */}
                  <div className="text-xs space-y-1">
                    {audit.map(r => (
                      <div key={r.id} className="flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: '#FAFAF8' }}>
                        <span className="font-medium w-16 shrink-0" style={{ color: '#1A1F2C' }}>{r.code}</span>
                        <span style={{ color: r.insights ? '#059669' : '#D97706' }}>{r.insights ? '✅' : '❌'} ins</span>
                        <span style={{ color: r.objectives ? '#059669' : '#D97706' }}>{r.objectives ? '✅' : '❌'} obj</span>
                        <span style={{ color: r.chunks > 0 ? '#059669' : '#D97706' }}>{r.chunks > 0 ? '✅' : '❌'} emb</span>
                        <span className="ml-auto" style={{ color: '#B5BBC4' }}>
                          {r.hasTranslation ? 'EN' : 'raw'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  {running && progress.total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs mb-1" style={{ color: '#8A929C' }}>
                        <span>Processing...</span>
                        <span>{progress.done}/{progress.total}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#ECE6D9' }}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${(progress.done / progress.total) * 100}%`, background: '#0E5C5C' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Log */}
                  {log.length > 0 && (
                    <div
                      className="rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5"
                      style={{ background: '#1A1F2C', color: '#E5E7EB' }}
                    >
                      {log.map((l, i) => (
                        <div key={i} style={{ color: l.ok ? '#A7F3D0' : '#FCA5A5' }}>{l.msg}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: '#ECE6D9' }}>
              <button
                onClick={() => { setOpen(false); setAudit(null) }}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#4A5263' }}
                disabled={running}
              >
                Close
              </button>
              <button
                onClick={runBackfill}
                disabled={running || totalMissing === 0 || !audit}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: '#0E5C5C', color: '#FFFFFF' }}
              >
                {running
                  ? `Running ${progress.done}/${progress.total}...`
                  : totalMissing === 0
                    ? 'All up to date ✓'
                    : `Run backfill (${totalMissing} tasks)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
