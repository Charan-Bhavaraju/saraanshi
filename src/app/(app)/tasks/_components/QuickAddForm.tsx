'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { quickAddTask } from '../actions'

export default function QuickAddForm({ onDone }: { onDone?: () => void }) {
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      await quickAddTask({
        title: title.trim(),
        dueAt: dueDate ? new Date(dueDate).toISOString() : null,
      })
      setTitle('')
      setDueDate('')
      onDone?.()
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-4"
      style={{
        background: '#FFFFFF',
        border: '1px solid #ECE6D9',
        boxShadow: '0 8px 24px rgb(26 31 44 / 0.1)',
      }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div
            className="shrink-0 rounded"
            style={{ width: 18, height: 18, border: '1.5px solid #B5BBC4', minWidth: 18, minHeight: 18 }}
          />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs to get done?"
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: '#1A1F2C' }}
            onKeyDown={e => {
              if (e.key === 'Escape') onDone?.()
            }}
          />
        </div>

        <div
          className="pl-7 pt-2"
          style={{ borderTop: '1px solid #ECE6D9' }}
        >
          <input
            type="datetime-local"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full text-xs outline-none bg-transparent mb-3"
            style={{
              color: dueDate ? '#4A5263' : '#B5BBC4',
              fontFamily: 'var(--font-mono)',
            }}
          />
          <div className="flex gap-2 justify-end">
            {onDone && (
              <button
                type="button"
                onClick={onDone}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ color: '#4A5263', border: '1px solid #ECE6D9', background: '#FFFFFF' }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              style={{ background: '#1A1F2C', color: '#FAF7F2', border: '1px solid #1A1F2C' }}
            >
              {isPending ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
