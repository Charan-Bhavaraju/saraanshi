'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import type { TaskWithContact } from '@/types/database'
import { formatDateLabel } from '@/lib/utils'
import { toggleTaskDone } from '../actions'

const PRIORITY_COLORS = ['#B5BBC4', '#B8842A', '#B8456D', '#B8456D'] as const

export default function TaskItem({ task }: { task: TaskWithContact }) {
  const [isPending, startTransition] = useTransition()
  const done = task.status === 'done'

  function handleToggle() {
    startTransition(() => toggleTaskDone(task.id, !done))
  }

  return (
    <div
      className="flex items-start gap-3 py-3.5"
      style={{ borderBottom: '1px solid #ECE6D9', opacity: isPending ? 0.6 : 1 }}
    >
      {/* Priority dot */}
      <div
        className="shrink-0 rounded-full mt-1"
        style={{
          width: 8,
          height: 8,
          background: done ? '#B5BBC4' : PRIORITY_COLORS[Math.min(task.priority, 3)],
          marginTop: 6,
        }}
      />

      {/* Checkbox */}
      <button
        onClick={handleToggle}
        className="shrink-0 rounded flex items-center justify-center transition-all"
        style={{
          width: 18,
          height: 18,
          border: done ? 'none' : '1.5px solid #B5BBC4',
          background: done ? '#0E5C5C' : 'transparent',
          minWidth: 18,
          minHeight: 18,
          marginTop: 1,
        }}
        aria-label={done ? 'Mark as todo' : 'Mark as done'}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium"
          style={{
            color: done ? '#8A929C' : '#1A1F2C',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.dueAt && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                background: '#F5F1E9',
                color: '#4A5263',
              }}
            >
              {formatDateLabel(task.dueAt)}
            </span>
          )}
          {task.contact && (
            <>
              <span
                className="rounded-full"
                style={{ width: 3, height: 3, background: '#B5BBC4', display: 'inline-block' }}
              />
              <Link
                href={`/contacts/${task.contact.id}`}
                className="text-xs transition-colors"
                style={{ color: '#0E5C5C' }}
              >
                {task.contact.displayName}
                {task.contact.organization ? ` · ${task.contact.organization}` : ''}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
