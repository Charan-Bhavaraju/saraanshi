'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { TaskWithContact } from '@/types/database'
import { formatDateLabel } from '@/lib/utils'
import { toggleTaskDone, deleteTask, updateTask } from '../actions'

const PRIORITY_COLORS = ['#B5BBC4', '#B8842A', '#B8456D', '#B8456D'] as const

// Convert a Date to the value format expected by datetime-local input (local time)
function toDatetimeLocal(d: Date | null | undefined): string {
  if (!d) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function TaskItem({ task }: { task: TaskWithContact }) {
  const [isPending, startTransition] = useTransition()
  const [hovering, setHovering] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDueAt, setEditDueAt] = useState(toDatetimeLocal(task.dueAt ? new Date(task.dueAt) : null))
  const done = task.status === 'done'

  function handleToggle() {
    startTransition(() => toggleTaskDone(task.id, !done))
  }

  function handleDelete() {
    startTransition(() => deleteTask(task.id))
  }

  function openEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditTitle(task.title)
    setEditDueAt(toDatetimeLocal(task.dueAt ? new Date(task.dueAt) : null))
    setEditing(true)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = editTitle.trim()
    if (!trimmed) return
    setEditing(false)
    startTransition(async () => {
      await updateTask({
        id: task.id,
        title: trimmed,
        dueAt: editDueAt ? new Date(editDueAt).toISOString() : null,
      })
    })
  }

  function handleCancel() {
    setEditing(false)
    setEditTitle(task.title)
    setEditDueAt(toDatetimeLocal(task.dueAt ? new Date(task.dueAt) : null))
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="py-3.5"
        style={{ borderBottom: '1px solid #ECE6D9' }}
      >
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          autoFocus
          className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none mb-2"
          style={{ border: '1px solid #0E5C5C', boxShadow: '0 0 0 3px #E2EEEC', color: '#1A1F2C' }}
          onKeyDown={e => e.key === 'Escape' && handleCancel()}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="datetime-local"
            value={editDueAt}
            onChange={e => setEditDueAt(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg outline-none"
            style={{ border: '1px solid #ECE6D9', color: '#4A5263', fontFamily: 'var(--font-mono)' }}
          />
          <button
            type="submit"
            disabled={!editTitle.trim()}
            className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
            style={{ background: '#0E5C5C', color: '#FFFFFF' }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: '#F5F1E9', color: '#4A5263' }}
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div
      className="flex items-start gap-3 py-3.5"
      style={{ borderBottom: '1px solid #ECE6D9', opacity: isPending ? 0.6 : 1 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Priority dot */}
      <div
        className="shrink-0 rounded-full"
        style={{
          width: 8,
          height: 8,
          background: done ? '#B5BBC4' : PRIORITY_COLORS[Math.min(task.priority, 3)],
          marginTop: 6,
          flexShrink: 0,
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
              style={{ fontFamily: 'var(--font-mono)', background: '#F5F1E9', color: '#4A5263' }}
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
                onClick={e => e.stopPropagation()}
              >
                {task.contact.displayName}
                {task.contact.organization ? ` · ${task.contact.organization}` : ''}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Actions — edit always visible on hover; delete only for done tasks */}
      <div className="flex items-center gap-1 shrink-0">
        {!done && hovering && (
          <button
            onClick={openEdit}
            disabled={isPending}
            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ color: '#B5BBC4' }}
            title="Edit task"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#F5F1E9'
              ;(e.currentTarget as HTMLElement).style.color = '#4A5263'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = '#B5BBC4'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
              <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {done && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ color: '#B5BBC4' }}
            title="Delete task"
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#FDF0F4'
              ;(e.currentTarget as HTMLElement).style.color = '#B8456D'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.color = '#B5BBC4'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10.5 3.5l-.6 7a.5.5 0 0 1-.5.5H3.6a.5.5 0 0 1-.5-.5l-.6-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
