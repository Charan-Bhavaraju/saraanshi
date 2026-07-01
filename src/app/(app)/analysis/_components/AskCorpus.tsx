'use client'

import { useState } from 'react'
import Link from 'next/link'
import { verifyQuotes } from '@/lib/ai/verify-quotes'
import { saveAnalysisSession } from '../actions'
import type { SavedSession } from '../actions'
import type { IndexStatus } from '@/lib/rag/indexing'
import type { ChatMessage, ChatSource } from '@/types/database'

type StreamSource = ChatSource & { content: string }

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

const EXAMPLE_GROUPS: { label: string; prompts: string[] }[] = [
  {
    label: 'Theme exploration',
    prompts: [
      'What do patients say about not recognizing early symptoms of breast cancer?',
      'How do participants describe the role of family support during treatment?',
      'What financial barriers to treatment do patients and survivors mention?',
      'What patterns exist around delayed diagnosis due to fear or stigma?',
    ],
  },
  {
    label: 'Compare perspectives',
    prompts: [
      'Compare what patients vs doctors say about communication during diagnosis',
      'How do survivors describe follow-up care differently from current patients?',
      'What do doctors identify as the biggest barriers to early detection?',
    ],
  },
  {
    label: 'Deep dive',
    prompts: [
      'What coping mechanisms do survivors describe for dealing with treatment side effects?',
      'How do participants describe the role of government schemes and financial aid in accessing treatment?',
      'What do participants say about psychosocial support and mental health during the care journey?',
      'Describe the patterns around treatment adherence — what helps and what hinders?',
    ],
  },
]

export default function AskCorpus({ indexStatus, savedSessions }: { indexStatus: IndexStatus; savedSessions: SavedSession[] }) {
  const [status, setStatus] = useState(indexStatus)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [viewingSession, setViewingSession] = useState<SavedSession | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Reindex modal state
  const [showReindexModal, setShowReindexModal] = useState(false)
  const [reindexPhase, setReindexPhase] = useState<'confirm' | 'deleting' | 'indexing' | 'done' | 'error'>('confirm')
  const [reindexProgress, setReindexProgress] = useState({ completed: 0, total: 0, totalChunks: 0, current: '' })
  const [reindexError, setReindexError] = useState('')

  function openReindexModal() {
    setReindexPhase('confirm')
    setReindexProgress({ completed: 0, total: 0, totalChunks: 0, current: '' })
    setReindexError('')
    setShowReindexModal(true)
  }

  async function startReindex() {
    setReindexPhase('deleting')
    try {
      const res = await fetch('/api/analysis/reindex', { method: 'POST' })
      if (!res.ok || !res.body) {
        setReindexPhase('error')
        setReindexError('Failed to start re-indexing.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''
        for (const block of lines) {
          const dataLine = block.trim().replace(/^data: /, '')
          if (!dataLine) continue
          try {
            const ev = JSON.parse(dataLine)
            if (ev.phase === 'deleting') setReindexPhase('deleting')
            else if (ev.phase === 'deleted') setReindexPhase('indexing')
            else if (ev.phase === 'indexing') {
              setReindexPhase('indexing')
              setReindexProgress({
                completed: ev.completed,
                total: ev.total,
                totalChunks: ev.totalChunks,
                current: ev.current ?? '',
              })
            } else if (ev.phase === 'done') {
              setReindexPhase('done')
              setReindexProgress(p => ({ ...p, completed: ev.total, totalChunks: ev.totalChunks }))
              setStatus(s => ({
                ...s,
                indexedInterviews: ev.total,
                totalChunks: ev.totalChunks,
                stale: false,
              }))
            } else if (ev.phase === 'error') {
              setReindexPhase('error')
              setReindexError(ev.message)
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      setReindexPhase('error')
      setReindexError(err instanceof Error ? err.message : 'Connection lost')
    }
  }

  async function send() {
    const q = input.trim()
    if (!q || busy) return
    setInput('')
    setSaved(false)
    setMessages(m => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setBusy(true)

    const setAssistant = (content: string, sources?: ChatSource[]) =>
      setMessages(m => {
        const last = m[m.length - 1]
        if (!last || last.role !== 'assistant') return m
        return [...m.slice(0, -1), { ...last, content, sources: sources ?? last.sources }]
      })

    try {
      const res = await fetch('/api/analysis/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (!res.ok || !res.body) {
        setAssistant('Could not reach the analysis service.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let raw = ''
      let sourcesParsed = false
      let streamSources: StreamSource[] = []

      // Strip full chunk content before storing sources on the message.
      const toChatSources = (ss: StreamSource[]): ChatSource[] =>
        ss.map(({ chunkId, interviewId, participantCode, startSeconds, preview }) => ({
          chunkId,
          interviewId,
          participantCode,
          startSeconds,
          preview,
        }))

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream: true })
        if (!sourcesParsed) {
          const nl = raw.indexOf('\n')
          if (nl === -1) continue
          try {
            streamSources = (JSON.parse(raw.slice(0, nl)).sources ?? []) as StreamSource[]
          } catch {
            streamSources = []
          }
          sourcesParsed = true
        }
        const nl = raw.indexOf('\n')
        setAssistant(raw.slice(nl + 1), toChatSources(streamSources))
      }

      // Backstop: strip any quote that isn't verbatim in the retrieved chunks.
      const nl = raw.indexOf('\n')
      const answer = nl === -1 ? raw : raw.slice(nl + 1)
      const verified = verifyQuotes(answer, streamSources.map(s => s.content))
      setAssistant(verified.text, toChatSources(streamSources))
    } catch {
      setAssistant('Something went wrong generating the answer.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    const firstQ = messages.find(m => m.role === 'user')?.content ?? 'Analysis session'
    await saveAnalysisSession(firstQ, messages)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-3xl">
      {/* Index status */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5 rounded-xl px-4 py-3" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
        <p className="text-xs" style={{ color: '#8A929C' }}>
          {status.totalChunks > 0
            ? `${status.indexedInterviews} interview${status.indexedInterviews === 1 ? '' : 's'} indexed · ${status.totalChunks} passages`
            : 'No interviews indexed yet.'}
          {status.stale && ' · some reviewed interviews need indexing'}
        </p>
        <button
          onClick={openReindexModal}
          className="text-sm font-medium rounded-lg px-3.5 py-1.5 transition-all"
          style={{
            background: status.stale || status.totalChunks === 0 ? '#0E5C5C' : '#FFFFFF',
            color: status.stale || status.totalChunks === 0 ? '#FAF7F2' : '#4A5263',
            border: status.stale || status.totalChunks === 0 ? 'none' : '1px solid #ECE6D9',
          }}
        >
          {status.totalChunks === 0 ? 'Index corpus' : 'Re-index'}
        </button>
      </div>

      {/* Reindex modal */}
      {showReindexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="rounded-2xl p-6 w-full max-w-md shadow-xl" style={{ background: '#FAF7F2', border: '1px solid #ECE6D9' }}>
            {reindexPhase === 'confirm' && (
              <>
                <h3 className="text-base font-semibold mb-2" style={{ color: '#1A1F2C' }}>Delete & Re-index Corpus</h3>
                <p className="text-sm mb-1" style={{ color: '#4A5263', lineHeight: 1.6 }}>
                  This will <strong>delete all {status.totalChunks} existing chunks</strong> and re-index every reviewed interview from scratch using English translations and 80-word passages.
                </p>
                <p className="text-xs mb-5" style={{ color: '#8A929C' }}>
                  {status.reviewedInterviews} interview{status.reviewedInterviews === 1 ? '' : 's'} will be re-indexed. This may take a few minutes.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowReindexModal(false)}
                    className="text-sm rounded-lg px-4 py-2 transition-all"
                    style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startReindex}
                    className="text-sm font-medium rounded-lg px-4 py-2 transition-all"
                    style={{ background: '#B91C1C', color: '#FFFFFF' }}
                  >
                    Delete & Re-index
                  </button>
                </div>
              </>
            )}

            {reindexPhase === 'deleting' && (
              <div className="text-center py-4">
                <div className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: '#0E5C5C', borderTopColor: 'transparent' }} />
                <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Deleting existing chunks…</p>
                <p className="text-xs mt-1" style={{ color: '#8A929C' }}>Clearing the old index</p>
              </div>
            )}

            {reindexPhase === 'indexing' && (
              <div className="py-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: '#1A1F2C' }}>Indexing interviews…</p>
                  <p className="text-xs font-mono" style={{ color: '#0E5C5C' }}>
                    {reindexProgress.completed}/{reindexProgress.total}
                  </p>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden mb-2" style={{ background: '#ECE6D9' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      background: '#0E5C5C',
                      width: reindexProgress.total > 0 ? `${(reindexProgress.completed / reindexProgress.total) * 100}%` : '0%',
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs" style={{ color: '#8A929C' }}>
                    Processing {reindexProgress.current}
                  </p>
                  <p className="text-xs" style={{ color: '#8A929C' }}>
                    {reindexProgress.totalChunks} chunks created
                  </p>
                </div>
              </div>
            )}

            {reindexPhase === 'done' && (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-sm font-medium mb-1" style={{ color: '#1A1F2C' }}>Re-indexing complete</p>
                <p className="text-xs mb-4" style={{ color: '#8A929C' }}>
                  {reindexProgress.completed} interviews · {reindexProgress.totalChunks} passages
                </p>
                <button
                  onClick={() => setShowReindexModal(false)}
                  className="text-sm font-medium rounded-lg px-4 py-2 transition-all"
                  style={{ background: '#0E5C5C', color: '#FAF7F2' }}
                >
                  Done
                </button>
              </div>
            )}

            {reindexPhase === 'error' && (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✕</div>
                <p className="text-sm font-medium mb-1" style={{ color: '#B91C1C' }}>Re-indexing failed</p>
                <p className="text-xs mb-4" style={{ color: '#8A929C' }}>{reindexError}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setShowReindexModal(false)}
                    className="text-sm rounded-lg px-4 py-2 transition-all"
                    style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
                  >
                    Close
                  </button>
                  <button
                    onClick={startReindex}
                    className="text-sm font-medium rounded-lg px-4 py-2 transition-all"
                    style={{ background: '#0E5C5C', color: '#FAF7F2' }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div className="flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <div className="rounded-[14px] p-6" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
            <p className="text-sm mb-4" style={{ color: '#4A5263', lineHeight: 1.6 }}>
              Ask a question across all indexed transcripts. Answers cite verbatim passages with
              participant code and timestamp.
            </p>
            <div className="flex flex-col gap-3">
              {EXAMPLE_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-xs font-medium mb-1.5" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.prompts.map(prompt => (
                      <button
                        key={prompt}
                        onClick={() => { setInput(prompt) }}
                        className="text-xs text-left rounded-lg px-3 py-2 transition-all hover:shadow-sm"
                        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263', lineHeight: 1.45 }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          rows={2}
          placeholder="Ask across the corpus…"
          disabled={busy}
          className="flex-1 text-sm rounded-xl px-4 py-3 resize-none"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#1A1F2C', lineHeight: 1.5 }}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="text-sm font-medium rounded-xl px-4 py-3 transition-all disabled:opacity-50"
          style={{ background: '#0E5C5C', color: '#FAF7F2' }}
        >
          {busy ? '…' : 'Ask'}
        </button>
      </div>

      {messages.length > 0 && !viewingSession && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={save}
            disabled={busy}
            className="text-xs rounded-lg px-3 py-1.5 transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
          >
            Save as session
          </button>
          {saved && <span className="text-xs" style={{ color: '#0E5C5C' }}>Saved</span>}
        </div>
      )}

      {viewingSession && (
        <div className="mt-3">
          <button
            onClick={() => { setViewingSession(null); setMessages([]) }}
            className="text-xs font-medium rounded-lg px-3 py-1.5 transition-all"
            style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
          >
            ← Back to new conversation
          </button>
        </div>
      )}

      {/* Saved sessions */}
      {savedSessions.length > 0 && (
        <div className="mt-6 pt-5" style={{ borderTop: '1px solid #ECE6D9' }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            className="text-xs font-medium mb-3"
            style={{ color: '#8A929C' }}
          >
            {showHistory ? '▾' : '▸'} Past sessions ({savedSessions.length})
          </button>
          {showHistory && (
            <div className="flex flex-col gap-1.5">
              {savedSessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setViewingSession(s)
                    setMessages(s.messages)
                    setSaved(false)
                  }}
                  className="text-left rounded-lg px-3.5 py-2.5 transition-all hover:shadow-sm"
                  style={{
                    background: viewingSession?.id === s.id ? '#E2EEEC' : '#FFFFFF',
                    border: `1px solid ${viewingSession?.id === s.id ? '#C5DDD8' : '#ECE6D9'}`,
                  }}
                >
                  <p className="text-sm truncate" style={{ color: '#1A1F2C' }}>{s.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
                    {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{s.messages.filter(m => m.role === 'user').length} question{s.messages.filter(m => m.role === 'user').length === 1 ? '' : 's'}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showSources, setShowSources] = useState(false)
  const isUser = message.role === 'user'

  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'stretch', maxWidth: isUser ? '85%' : '100%', marginLeft: isUser ? 'auto' : 0 }}>
      <div
        className="rounded-[14px] px-4 py-3"
        style={{
          background: isUser ? '#E2EEEC' : '#FFFFFF',
          border: `1px solid ${isUser ? '#C5DDD8' : '#ECE6D9'}`,
        }}
      >
        <p className="text-sm whitespace-pre-wrap" style={{ color: '#1A1F2C', lineHeight: 1.65 }}>
          {message.content || (isUser ? '' : '…')}
        </p>
      </div>

      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowSources(s => !s)}
            className="text-xs font-medium"
            style={{ color: '#0E5C5C' }}
          >
            {showSources ? '▾' : '▸'} Sources used ({message.sources.length})
          </button>
          {showSources && (
            <div className="flex flex-col gap-1.5 mt-2">
              {message.sources.map((s, i) => (
                <Link
                  key={i}
                  href={`/interviews/${s.interviewId}`}
                  className="block rounded-lg px-3 py-2 transition-all"
                  style={{ background: '#FAF7F2', border: '1px solid #ECE6D9' }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#E2EEEC', color: '#0E5C5C', fontFamily: 'var(--font-mono)' }}>
                      {s.participantCode ?? '?'} · {mmss(s.startSeconds)}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: '#8A929C', lineHeight: 1.5 }}>{s.preview}…</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
