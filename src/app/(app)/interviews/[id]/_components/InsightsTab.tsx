'use client'

import { useState, useTransition } from 'react'
import { formatPaise } from '@/lib/ai/cost'
import {
  previewInsightsPrompt,
  generateInsights,
  saveReflection,
  promoteFocusPoint,
  dismissFocusPoint,
  convertQuestionToTask,
  type InsightsData,
  type InsightsRequest,
  type FocusPointView,
} from '../insights/actions'
import type { ReflectionSource, NotableMoment } from '@/types/database'

type Props = {
  interviewId: string
  hasTranslation: boolean
  estimatedPaise: number
  initial: InsightsData
  // Switch to the Transcript tab and seek the audio to `seconds`.
  onSeek: (seconds: number) => void
}

type SourceOption = { value: ReflectionSource; label: string; hint?: string; needsTranslation?: boolean }
const SOURCE_OPTIONS: SourceOption[] = [
  { value: 'cleaned', label: 'Cleaned transcript', hint: 'recommended' },
  { value: 'raw', label: 'Original AI transcript' },
  { value: 'translation', label: 'English translation', needsTranslation: true },
  { value: 'mixed', label: 'Both Telugu + English', needsTranslation: true },
]

function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const CONFIDENCE_STYLE: Record<string, { bg: string; fg: string }> = {
  high: { bg: '#E2EEEC', fg: '#0E5C5C' },
  medium: { bg: '#F5EBD3', fg: '#B8842A' },
  low: { bg: '#F0EFEA', fg: '#8A929C' },
}

export default function InsightsTab({
  interviewId,
  hasTranslation,
  estimatedPaise,
  initial,
  onSeek,
}: Props) {
  const [data, setData] = useState<InsightsData>(initial)
  const [source, setSource] = useState<ReflectionSource>(hasTranslation ? 'translation' : 'cleaned')
  const [generating, setGenerating] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState<InsightsRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hasInsights = data.reflection !== null
  const sourceOptions = SOURCE_OPTIONS.filter(o => hasTranslation || !o.needsTranslation)

  // Step 1 — build & redact the prompt locally; NO LLM call.
  async function runPreview() {
    setPreviewing(true)
    setError(null)
    try {
      setPreview(await previewInsightsPrompt(interviewId, source))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build prompt')
    } finally {
      setPreviewing(false)
    }
  }

  // Step 2 — explicit, controlled LLM hit.
  async function runGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const result = await generateInsights(interviewId, source)
      setData(result)
      setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl">
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
            {previewing ? 'Building prompt…' : hasInsights ? 'Preview prompt to regenerate' : 'Preview prompt'}
          </button>

          <span className="text-xs" style={{ color: '#8A929C' }}>
            ~{formatPaise(estimatedPaise)} · ~25 seconds · nothing is sent until you confirm
          </span>
        </div>

        {error && (
          <p className="text-xs mt-3" style={{ color: '#B8456D' }}>{error}</p>
        )}
        {hasInsights && data.reflection?.costInrPaise != null && (
          <p className="text-xs mt-3" style={{ color: '#8A929C' }}>
            Last run cost {formatPaise(data.reflection.costInrPaise)}
            {data.reflection.generatedAt
              ? ` · ${new Date(data.reflection.generatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </p>
        )}
      </div>

      {preview && !generating && (
        <PromptPreview
          req={preview}
          onSend={runGenerate}
          onCancel={() => setPreview(null)}
        />
      )}

      {generating && <GeneratingState />}

      {!preview && !generating && !hasInsights && (
        <div className="rounded-[14px] p-8 text-center" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
          <p className="text-sm" style={{ color: '#4A5263' }}>
            No insights yet. Pick a source and generate descriptive observations — focus points,
            notable moments, and open questions you can act on.
          </p>
        </div>
      )}

      {!generating && hasInsights && data.reflection && (
        <div className="flex flex-col gap-7">
          {/* 1. Summary */}
          {data.reflection.summary && (
            <Section title="Summary">
              <p className="text-sm leading-relaxed" style={{ color: '#1A1F2C', lineHeight: 1.7 }}>
                {data.reflection.summary}
              </p>
            </Section>
          )}

          {/* 2. Focus points */}
          {data.focusPoints.length > 0 && (
            <Section title="Focus points" subtitle="AI-suggested. You decide what becomes a theme.">
              <div className="flex flex-col gap-3">
                {data.focusPoints.map(fp => (
                  <FocusPointCard
                    key={fp.id}
                    fp={fp}
                    interviewId={interviewId}
                    onSeek={onSeek}
                    onChange={updated =>
                      setData(d => ({
                        ...d,
                        focusPoints:
                          updated === null
                            ? d.focusPoints.filter(p => p.id !== fp.id)
                            : d.focusPoints.map(p => (p.id === fp.id ? updated : p)),
                      }))
                    }
                  />
                ))}
              </div>
            </Section>
          )}

          {/* 3. Notable moments */}
          {data.reflection.notableMoments.length > 0 && (
            <Section title="Notable moments" subtitle="Worth re-listening to.">
              <div className="flex flex-col gap-2">
                {data.reflection.notableMoments.map((m, i) => (
                  <NotableMomentRow key={i} moment={m} onSeek={onSeek} />
                ))}
              </div>
            </Section>
          )}

          {/* 4. Open questions */}
          {data.reflection.openQuestions.length > 0 && (
            <Section title="Open questions" subtitle="Alluded to, but not explored.">
              <div className="flex flex-col gap-2">
                {data.reflection.openQuestions.map((q, i) => (
                  <OpenQuestionRow key={i} question={q} interviewId={interviewId} />
                ))}
              </div>
            </Section>
          )}

          {/* 5. My reflections */}
          <MyReflections interviewId={interviewId} initial={data.reflection.userReflection ?? ''} />
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-lg mb-0.5" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      {subtitle && <p className="text-xs mb-3" style={{ color: '#8A929C' }}>{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  )
}

function FocusPointCard({
  fp,
  interviewId,
  onSeek,
  onChange,
}: {
  fp: FocusPointView
  interviewId: string
  onSeek: (s: number) => void
  onChange: (updated: FocusPointView | null) => void
}) {
  const [pending, startTransition] = useTransition()
  const conf = CONFIDENCE_STYLE[fp.confidence] ?? CONFIDENCE_STYLE.medium

  function promote() {
    startTransition(async () => {
      const { themeId } = await promoteFocusPoint(fp.id, interviewId)
      onChange({ ...fp, promotedToThemeId: themeId })
    })
  }
  function dismiss() {
    startTransition(async () => {
      await dismissFocusPoint(fp.id)
      onChange(null)
    })
  }

  return (
    <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', opacity: pending ? 0.6 : 1 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium" style={{ color: '#1A1F2C' }}>{fp.phrase}</span>
          <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: conf.bg, color: conf.fg, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {fp.confidence}
          </span>
        </div>
        {fp.timestamps.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {fp.timestamps.map((t, i) => (
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
      {fp.rationale && (
        <p className="text-xs mt-2 leading-relaxed" style={{ color: '#8A929C' }}>{fp.rationale}</p>
      )}
      <div className="flex items-center gap-2 mt-3">
        {fp.promotedToThemeId ? (
          <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: '#E2EEEC', color: '#0E5C5C' }}>
            ✓ Promoted to theme
          </span>
        ) : (
          <>
            <button
              onClick={promote}
              disabled={pending}
              className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
              style={{ background: '#0E5C5C', color: '#FAF7F2' }}
            >
              Promote to theme
            </button>
            <button
              onClick={dismiss}
              disabled={pending}
              className="text-xs px-2.5 py-1 rounded-lg transition-all"
              style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#8A929C' }}
            >
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function NotableMomentRow({ moment, onSeek }: { moment: NotableMoment; onSeek: (s: number) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
      <button
        onClick={() => onSeek(moment.seconds)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md shrink-0 transition-all"
        style={{ background: '#1A1F2C', color: '#FAF7F2', fontFamily: 'var(--font-mono)' }}
        title="Listen to this moment"
      >
        <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5l10 5.5-10 5.5V2.5z" /></svg>
        {mmss(moment.seconds)}
      </button>
      <p className="text-sm" style={{ color: '#4A5263', lineHeight: 1.6 }}>{moment.reason}</p>
    </div>
  )
}

function OpenQuestionRow({ question, interviewId }: { question: string; interviewId: string }) {
  const [pending, startTransition] = useTransition()
  const [added, setAdded] = useState(false)

  function convert() {
    startTransition(async () => {
      await convertQuestionToTask(interviewId, question)
      setAdded(true)
    })
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
      <p className="text-sm" style={{ color: '#1A1F2C', lineHeight: 1.6 }}>{question}</p>
      {added ? (
        <span className="text-xs shrink-0 px-2.5 py-1 rounded-lg" style={{ background: '#E2EEEC', color: '#0E5C5C' }}>✓ Added to tasks</span>
      ) : (
        <button
          onClick={convert}
          disabled={pending}
          className="text-xs font-medium shrink-0 px-2.5 py-1 rounded-lg transition-all"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#0E5C5C' }}
        >
          Convert to task
        </button>
      )}
    </div>
  )
}

function MyReflections({ interviewId, initial }: { interviewId: string; initial: string }) {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(false)

  function onBlur() {
    if (value === initial) return
    saveReflection(interviewId, value).then(() => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }

  return (
    <Section title="My reflections">
      <textarea
        value={value}
        onChange={e => { setValue(e.target.value); setSaved(false) }}
        onBlur={onBlur}
        placeholder="What did you take away from this conversation?"
        rows={4}
        autoComplete="off"
        spellCheck={false}
        className="w-full text-sm rounded-xl px-4 py-3 resize-y"
        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#1A1F2C', lineHeight: 1.6 }}
      />
      {saved && <p className="text-xs mt-1.5" style={{ color: '#0E5C5C' }}>Saved</p>}
    </Section>
  )
}

function PromptPreview({
  req,
  onSend,
  onCancel,
}: {
  req: InsightsRequest
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
        <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Reading the transcript…</p>
        <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
          Generating descriptive observations. Names are redacted before anything is sent.
        </p>
      </div>
    </div>
  )
}
