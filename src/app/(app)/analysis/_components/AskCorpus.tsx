'use client'

import { useState } from 'react'
import Link from 'next/link'
import { verifyQuotes } from '@/lib/ai/verify-quotes'
import { indexCorpus, saveAnalysisSession } from '../actions'
import type { IndexStatus } from '@/lib/rag/indexing'
import type { ChatMessage, ChatSource } from '@/types/database'

type StreamSource = ChatSource & { content: string }

function mmss(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function AskCorpus({ indexStatus }: { indexStatus: IndexStatus }) {
  const [status, setStatus] = useState(indexStatus)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [saved, setSaved] = useState(false)

  async function reindex() {
    setIndexing(true)
    try {
      const r = await indexCorpus()
      setStatus(s => ({
        ...s,
        indexedInterviews: r.indexedInterviews || s.indexedInterviews,
        totalChunks: s.totalChunks + r.totalChunks,
        stale: false,
      }))
    } finally {
      setIndexing(false)
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
          onClick={reindex}
          disabled={indexing}
          className="text-sm font-medium rounded-lg px-3.5 py-1.5 transition-all disabled:opacity-60"
          style={{
            background: status.stale || status.totalChunks === 0 ? '#0E5C5C' : '#FFFFFF',
            color: status.stale || status.totalChunks === 0 ? '#FAF7F2' : '#4A5263',
            border: status.stale || status.totalChunks === 0 ? 'none' : '1px solid #ECE6D9',
          }}
        >
          {indexing ? 'Indexing…' : status.totalChunks === 0 ? 'Index corpus' : 'Re-index'}
        </button>
      </div>

      {/* Conversation */}
      <div className="flex flex-col gap-4 mb-4">
        {messages.length === 0 && (
          <div className="rounded-[14px] p-8 text-center" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
            <p className="text-sm" style={{ color: '#4A5263', lineHeight: 1.6 }}>
              Ask a question across all indexed transcripts — e.g. &ldquo;What do patients say about
              the cost of treatment?&rdquo; Answers cite verbatim passages with participant code and
              timestamp; unverifiable quotes are removed automatically.
            </p>
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

      {messages.length > 0 && (
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
