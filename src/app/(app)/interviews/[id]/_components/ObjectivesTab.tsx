'use client'

import { useState } from 'react'
import { formatPaise } from '@/lib/ai/cost'
import {
  previewObjectivesPrompt,
  generateObjectiveFindings,
  type ObjectivesData,
  type ObjectivesRequest,
  type ObjectiveFindingView,
} from '../objectives/actions'
import type { ReflectionSource } from '@/types/database'
import type { Objective, FindingCategory } from '@/db/schema/analysis'
import ObjectivesMatrixView from './ObjectivesMatrixView'

type Props = {
  interviewId: string
  hasTranslation: boolean
  estimatedPaise: number
  initial: ObjectivesData
  onSeek: (seconds: number) => void
}

type SourceOption = { value: ReflectionSource; label: string; hint?: string; needsTranslation?: boolean }
const SOURCE_OPTIONS: SourceOption[] = [
  { value: 'cleaned', label: 'Cleaned transcript', hint: 'recommended' },
  { value: 'raw', label: 'Original AI transcript' },
  { value: 'translation', label: 'English translation', needsTranslation: true },
  { value: 'mixed', label: 'Both Telugu + English', needsTranslation: true },
]

const OBJECTIVE_META: Record<Objective, { label: string; short: string; color: string; bg: string; border: string; lightBg: string }> = {
  objective_1: {
    label: 'Objective 1 — Early Detection',
    short: 'Early Detection',
    color: '#92600A',
    bg: '#FEF3C7',
    border: '#F0E4BC',
    lightBg: '#FFFBEB',
  },
  objective_2: {
    label: 'Objective 2 — Diagnosis & Treatment Initiation',
    short: 'Diagnosis & Treatment',
    color: '#065F46',
    bg: '#D1FAE5',
    border: '#A7F3D0',
    lightBg: '#ECFDF5',
  },
  objective_3: {
    label: 'Objective 3 — Continuity of Care & Follow-Up',
    short: 'Continuity & Follow-Up',
    color: '#1E40AF',
    bg: '#DBEAFE',
    border: '#BFDBFE',
    lightBg: '#EFF6FF',
  },
}

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function ObjectivesTab({
  interviewId,
  hasTranslation,
  estimatedPaise,
  initial,
  onSeek,
}: Props) {
  const [data, setData] = useState<ObjectivesData>(initial)
  const [source, setSource] = useState<ReflectionSource>(hasTranslation ? 'translation' : 'cleaned')
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<ObjectivesRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards')
  const hasFindings = data.run !== null
  const sourceOptions = SOURCE_OPTIONS.filter(o => hasTranslation || !o.needsTranslation)

  async function runPreview() {
    setPreviewing(true)
    setError(null)
    try {
      setPreview(await previewObjectivesPrompt(interviewId, source))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build prompt')
    } finally {
      setPreviewing(false)
    }
  }

  async function runGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateObjectiveFindings(interviewId, source)
      setData(result)
      setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // Group findings by objective
  const byObjective = (['objective_1', 'objective_2', 'objective_3'] as const).map(obj => {
    const findings = data.findings.filter(f => f.objective === obj)
    return {
      objective: obj,
      meta: OBJECTIVE_META[obj],
      facilitators: findings.filter(f => f.category === 'facilitator'),
      barriers: findings.filter(f => f.category === 'barrier'),
    }
  })

  return (
    <div className={viewMode === 'matrix' ? '' : 'max-w-3xl'}>
      {/* Controls */}
      <div className="rounded-[14px] p-5 mb-6" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
        <label className="block text-xs font-medium mb-1.5" style={{ color: '#4A5263', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
          Source for analysis
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={source}
            onChange={e => { setSource(e.target.value as ReflectionSource); setPreview(null) }}
            disabled={generating || previewing}
            className="text-sm rounded-lg px-3 py-2"
            style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#1A1F2C', minWidth: 220 }}
          >
            {sourceOptions.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}{o.hint ? ` (${o.hint})` : ''}
              </option>
            ))}
          </select>

          <button
            onClick={runPreview}
            disabled={generating || previewing}
            className="text-sm font-medium rounded-lg px-4 py-2 transition-all disabled:opacity-60"
            style={{ background: '#0E5C5C', color: '#FAF7F2' }}
          >
            {previewing ? 'Building prompt…' : hasFindings ? 'Preview prompt to regenerate' : 'Preview prompt'}
          </button>

          <span className="text-xs" style={{ color: '#8A929C' }}>
            ~{formatPaise(estimatedPaise)} · ~40 seconds · nothing is sent until you confirm
          </span>
        </div>

        {error && (
          <p className="text-xs mt-3" style={{ color: '#B8456D' }}>{error}</p>
        )}
        {hasFindings && data.run?.costInrPaise != null && (
          <p className="text-xs mt-3" style={{ color: '#8A929C' }}>
            Last run cost {formatPaise(data.run.costInrPaise)}
            {data.run.generatedAt
              ? ` · ${new Date(data.run.generatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : ''}
            {' · '}{data.findings.length} finding{data.findings.length === 1 ? '' : 's'} extracted
          </p>
        )}
      </div>

      {preview && !generating && (
        <PromptPreview req={preview} onSend={runGenerate} onCancel={() => setPreview(null)} />
      )}

      {generating && <GeneratingState />}

      {!preview && !generating && !hasFindings && (
        <div className="rounded-[14px] p-8 text-center" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
          <p className="text-sm" style={{ color: '#4A5263' }}>
            No objectives analysis yet. This will extract every statement relevant to the three study
            objectives (Early Detection, Diagnosis & Treatment, Continuity of Care), classifying each
            as a facilitator or barrier with verbatim excerpts.
          </p>
        </div>
      )}

      {/* View mode toggle — shown only when findings exist */}
      {!generating && hasFindings && (
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex gap-0.5 w-fit"
            style={{ background: '#F5F1E9', padding: 3, borderRadius: 8, border: '1px solid #ECE6D9' }}
          >
            <button
              onClick={() => setViewMode('cards')}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md transition-all"
              style={{
                background: viewMode === 'cards' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'cards' ? '#1A1F2C' : '#8A929C',
                boxShadow: viewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.04)' : undefined,
              }}
            >
              Card view
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md transition-all"
              style={{
                background: viewMode === 'matrix' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'matrix' ? '#1A1F2C' : '#8A929C',
                boxShadow: viewMode === 'matrix' ? '0 1px 2px rgba(0,0,0,0.04)' : undefined,
              }}
            >
              Matrix view
            </button>
          </div>
        </div>
      )}

      {/* Matrix view */}
      {!generating && hasFindings && viewMode === 'matrix' && (
        <ObjectivesMatrixView interviewId={interviewId} singleInterview />
      )}

      {!generating && hasFindings && viewMode === 'cards' && (
        <div className="flex flex-col gap-6">
          {/* Summary strip */}
          <div className="flex gap-3 flex-wrap">
            {byObjective.map(({ objective, meta, facilitators, barriers }) => (
              <div
                key={objective}
                className="flex-1 min-w-[180px] rounded-xl px-4 py-3"
                style={{ background: meta.lightBg, border: `1px solid ${meta.border}` }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: meta.color }}>{meta.short}</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: '#065F46' }}>
                    <span className="font-medium">{facilitators.length}</span>{' '}
                    <span className="text-xs" style={{ color: meta.color }}>facilitator{facilitators.length !== 1 ? 's' : ''}</span>
                  </span>
                  <span className="text-sm" style={{ color: '#991B1B' }}>
                    <span className="font-medium">{barriers.length}</span>{' '}
                    <span className="text-xs" style={{ color: meta.color }}>barrier{barriers.length !== 1 ? 's' : ''}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Per-objective sections */}
          {byObjective.map(({ objective, meta, facilitators, barriers }) => (
            <ObjectiveSection
              key={objective}
              meta={meta}
              facilitators={facilitators}
              barriers={barriers}
              onSeek={onSeek}
            />
          ))}
        </div>
      )}
    </div>
  )
}


function ObjectiveSection({
  meta,
  facilitators,
  barriers,
  onSeek,
}: {
  meta: typeof OBJECTIVE_META[Objective]
  facilitators: ObjectiveFindingView[]
  barriers: ObjectiveFindingView[]
  onSeek: (s: number) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const total = facilitators.length + barriers.length

  if (total === 0) {
    return (
      <div className="rounded-[14px] px-5 py-4" style={{ background: meta.lightBg, border: `1px solid ${meta.border}` }}>
        <p className="text-sm font-medium" style={{ color: meta.color }}>{meta.label}</p>
        <p className="text-xs mt-1" style={{ color: '#8A929C' }}>No relevant statements found in this transcript.</p>
      </div>
    )
  }

  return (
    <div className="rounded-[14px] overflow-hidden" style={{ border: `1px solid ${meta.border}` }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        style={{ background: meta.bg }}
      >
        <div className="flex items-center gap-2.5">
          <span
            style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0, opacity: 0.7 }}
          />
          <span className="text-sm font-medium" style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${meta.color}15`, color: meta.color }}>
            {total} finding{total !== 1 ? 's' : ''}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ color: meta.color, transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 py-4" style={{ background: meta.lightBg }}>
          {/* Facilitators */}
          {facilitators.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7h12" stroke="#065F46" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-medium" style={{ color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Facilitators ({facilitators.length})
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {facilitators.map(f => (
                  <FindingCard key={f.id} finding={f} accentColor="#065F46" onSeek={onSeek} />
                ))}
              </div>
            </div>
          )}

          {/* Barriers */}
          {barriers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8" stroke="#991B1B" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-medium" style={{ color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Barriers ({barriers.length})
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {barriers.map(f => (
                  <FindingCard key={f.id} finding={f} accentColor="#991B1B" onSeek={onSeek} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FindingCard({
  finding,
  accentColor,
  onSeek,
}: {
  finding: ObjectiveFindingView
  accentColor: string
  onSeek: (s: number) => void
}) {
  const [showExcerpt, setShowExcerpt] = useState(false)

  return (
    <div className="rounded-xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span
            style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }}
          />
          <span className="text-sm font-medium" style={{ color: '#1A1F2C' }}>{finding.label}</span>
        </div>
        {finding.timestamps.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {finding.timestamps.map((t, i) => (
              <button
                key={i}
                onClick={() => onSeek(t)}
                className="text-xs px-2 py-0.5 rounded-md transition-all"
                style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#0E5C5C', fontFamily: 'var(--font-mono)' }}
                title="Jump to this moment"
              >
                {mmss(t)}
              </button>
            ))}
          </div>
        )}
      </div>

      {finding.rationale && (
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#8A929C' }}>{finding.rationale}</p>
      )}

      {finding.excerpt && (
        <div className="mt-2">
          <button
            onClick={() => setShowExcerpt(e => !e)}
            className="text-xs transition-all"
            style={{ color: accentColor }}
          >
            {showExcerpt ? '▾ Hide excerpt' : '▸ Show excerpt'}
          </button>
          {showExcerpt && (
            <blockquote
              className="mt-1.5 text-xs leading-relaxed px-3 py-2 rounded-lg italic"
              style={{ background: '#FAF7F2', borderLeft: `3px solid ${accentColor}`, color: '#4A5263' }}
            >
              &ldquo;{finding.excerpt}&rdquo;
            </blockquote>
          )}
        </div>
      )}
    </div>
  )
}

function PromptPreview({
  req,
  onSend,
  onCancel,
}: {
  req: ObjectivesRequest
  onSend: () => void
  onCancel: () => void
}) {
  return (
    <div className="rounded-[14px] p-5 mb-6" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Prompt preview — nothing has been sent</p>
          <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
            {req.model} · {req.segmentCount} segments · {req.redactionCount} value{req.redactionCount === 1 ? '' : 's'} redacted · est. {formatPaise(req.estimatedPaise)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSend}
            className="text-sm font-medium rounded-lg px-4 py-2 transition-all"
            style={{ background: '#0E5C5C', color: '#FAF7F2' }}
          >
            Send to Claude
          </button>
          <button
            onClick={onCancel}
            className="text-sm rounded-lg px-3 py-2 transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#8A929C' }}
          >
            Cancel
          </button>
        </div>
      </div>
      <PromptBlock label="System prompt" text={req.system} />
      <PromptBlock label="User prompt (redacted transcript)" text={req.user} defaultOpen />
    </div>
  )
}

function PromptBlock({ label, text, defaultOpen = false }: { label: string; text: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-xs font-medium"
          style={{ color: '#B8842A', textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {open ? '▾' : '▸'} {label} · {text.length.toLocaleString()} chars
        </button>
        <button
          onClick={copy}
          className="text-xs px-2 py-0.5 rounded-md transition-all"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {open && (
        <pre
          className="mt-1.5 text-xs rounded-lg p-3 overflow-auto"
          style={{
            background: '#FFFFFF',
            border: '1px solid #ECE6D9',
            color: '#1A1F2C',
            maxHeight: 280,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.5,
          }}
        >
          {text}
        </pre>
      )}
    </div>
  )
}

function GeneratingState() {
  return (
    <div className="rounded-[14px] p-6 flex items-center gap-4" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
      <svg className="animate-spin shrink-0" width="28" height="28" viewBox="0 0 32 32" fill="none" style={{ color: '#0E5C5C' }}>
        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Analyzing objectives…</p>
        <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
          Extracting facilitators and barriers for all three study objectives. Names are redacted before anything is sent.
        </p>
      </div>
    </div>
  )
}
