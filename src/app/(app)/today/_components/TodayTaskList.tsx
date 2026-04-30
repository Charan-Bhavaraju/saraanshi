'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { formatDateLabel } from '@/lib/utils'
import { toggleTaskDone } from '@/app/(app)/tasks/actions'

type TaskItem = {
  id: string
  title: string
  dueAt: Date | string | null
  status: string
  contact: { displayName: string; organization: string | null } | null
}

type TaskState = { todo: TaskItem[]; done: TaskItem[] }

function applyToggle(
  state: TaskState,
  action: { taskId: string; makeDone: boolean },
): TaskState {
  if (action.makeDone) {
    const task = state.todo.find(t => t.id === action.taskId)
    if (!task) return state
    return {
      todo: state.todo.filter(t => t.id !== action.taskId),
      done: [...state.done, { ...task, status: 'done' }],
    }
  } else {
    const task = state.done.find(t => t.id === action.taskId)
    if (!task) return state
    return {
      done: state.done.filter(t => t.id !== action.taskId),
      todo: [...state.todo, { ...task, status: 'todo' }],
    }
  }
}

export default function TodayTaskList({
  todoTasks,
  doneTasks,
}: {
  todoTasks: TaskItem[]
  doneTasks: TaskItem[]
}) {
  const [, startTransition] = useTransition()
  const [optimistic, addOptimistic] = useOptimistic<TaskState, { taskId: string; makeDone: boolean }>(
    { todo: todoTasks, done: doneTasks },
    applyToggle,
  )

  function handleToggle(taskId: string, makeDone: boolean) {
    startTransition(async () => {
      addOptimistic({ taskId, makeDone })
      await toggleTaskDone(taskId, makeDone)
    })
  }

  const totalCount = optimistic.todo.length + optimistic.done.length

  if (totalCount === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: '#8A929C' }}>
        No tasks due today.{' '}
        <Link href="/tasks" style={{ color: '#0E5C5C' }}>Add one →</Link>
      </p>
    )
  }

  return (
    <div>
      {optimistic.todo.map((task, i) => (
        <TaskRow
          key={task.id}
          task={task}
          done={false}
          isLast={i === optimistic.todo.length - 1 && optimistic.done.length === 0}
          onToggle={() => handleToggle(task.id, true)}
        />
      ))}

      {optimistic.done.length > 0 && (
        <>
          <div
            className="flex items-center gap-2 py-2"
            style={{ borderTop: optimistic.todo.length > 0 ? '1px solid #ECE6D9' : 'none' }}
          >
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 16, height: 16, background: '#0E5C5C' }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4l1.5 1.5L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-xs font-medium" style={{ color: '#0E5C5C' }}>
              {optimistic.done.length} of {totalCount} completed
            </p>
          </div>
          {optimistic.done.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              done={true}
              isLast={i === optimistic.done.length - 1}
              onToggle={() => handleToggle(task.id, false)}
            />
          ))}
        </>
      )}
    </div>
  )
}

function TaskRow({
  task,
  done,
  isLast,
  onToggle,
}: {
  task: TaskItem
  done: boolean
  isLast: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="flex items-start gap-3 py-2.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid #ECE6D9' }}
    >
      <button
        onClick={onToggle}
        className="shrink-0 rounded flex items-center justify-center transition-all mt-0.5"
        style={{
          width: 18,
          height: 18,
          minWidth: 18,
          minHeight: 18,
          border: done ? 'none' : '1.5px solid #B5BBC4',
          background: done ? '#0E5C5C' : 'transparent',
          cursor: 'pointer',
        }}
        aria-label={done ? 'Mark as todo' : 'Mark as done'}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5.5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: done ? '#B5BBC4' : '#1A1F2C',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.dueAt && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                background: '#F5F1E9',
                color: done ? '#B5BBC4' : '#4A5263',
              }}
            >
              {formatDateLabel(task.dueAt)}
            </span>
          )}
          {task.contact && (
            <>
              <span
                style={{ width: 3, height: 3, background: '#B5BBC4', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
              />
              <span className="text-xs truncate" style={{ color: done ? '#B5BBC4' : '#0E5C5C' }}>
                {task.contact.displayName}
                {task.contact.organization ? ` · ${task.contact.organization}` : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
