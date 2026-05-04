import type { TaskWithContact } from '@/types/database'
import TaskItem from './TaskItem'
import { format } from 'date-fns'

export default function TaskSection({
  title,
  dateLabel,
  tasks,
  emptyLabel,
}: {
  title: string
  dateLabel?: string
  tasks: TaskWithContact[]
  emptyLabel?: string
}) {
  if (tasks.length === 0 && !emptyLabel) return null
  if (tasks.length === 0 && emptyLabel) {
    return (
      <div className="mb-8">
        <div
          className="flex items-baseline justify-between pb-2.5 mb-1"
          style={{ borderBottom: '1px solid #ECE6D9' }}
        >
          <h2
            className="text-xl"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            {title}
          </h2>
          {dateLabel && (
            <span className="text-xs uppercase tracking-wider" style={{ color: '#8A929C', letterSpacing: '0.06em' }}>
              {dateLabel}
            </span>
          )}
        </div>
        <p className="py-3 text-sm" style={{ color: '#B5BBC4' }}>{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div
        className="flex items-baseline justify-between pb-2.5 mb-1"
        style={{ borderBottom: '1px solid #ECE6D9' }}
      >
        <h2
          className="text-xl"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        {dateLabel && (
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: '#8A929C', letterSpacing: '0.06em' }}
          >
            {dateLabel}
          </span>
        )}
      </div>
      <div>
        {tasks.map(task => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
