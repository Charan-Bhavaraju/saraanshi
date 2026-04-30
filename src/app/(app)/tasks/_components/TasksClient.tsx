import type { TaskWithContact } from '@/types/database'
import { getTaskGroup, addDays, endOfWeek } from '@/lib/utils'
import { format } from 'date-fns'
import TaskSection from './TaskSection'
import FAB from './FAB'
import Link from 'next/link'

type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'no_date' | 'done'

export default function TasksClient({ tasks }: { tasks: TaskWithContact[] }) {
  const now = new Date()

  const groups: Record<GroupKey, TaskWithContact[]> = {
    overdue: [], today: [], tomorrow: [], this_week: [],
    later: [], no_date: [], done: [],
  }

  for (const task of tasks) {
    if (task.status === 'done') {
      groups.done.push(task)
    } else if (task.status === 'snoozed' || task.status === 'cancelled') {
      // skip in default view
    } else {
      const group = getTaskGroup(task.dueAt)
      groups[group as Exclude<GroupKey, 'done'>].push(task)
    }
  }

  const hasAny = Object.entries(groups)
    .filter(([k]) => k !== 'done')
    .some(([, v]) => v.length > 0)

  return (
    <div className="relative">
      {!hasAny && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: '#F5F1E9' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 5h14M4 11h10M4 17h7" stroke="#B5BBC4" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: '#4A5263' }}>
            No tasks yet
          </p>
          <p className="text-xs text-center" style={{ color: '#8A929C' }}>
            Tap the + button below to add your first task.
          </p>
        </div>
      )}

      {groups.overdue.length > 0 && (
        <TaskSection
          title="Overdue"
          dateLabel="Past due"
          tasks={groups.overdue}
        />
      )}

      <TaskSection
        title="Today"
        dateLabel={format(now, 'EEE d MMM').toUpperCase()}
        tasks={groups.today}
      />

      <TaskSection
        title="Tomorrow"
        dateLabel={format(addDays(now, 1), 'EEE d MMM').toUpperCase()}
        tasks={groups.tomorrow}
      />

      {(groups.this_week.length > 0 || groups.later.length > 0 || groups.no_date.length > 0) && (
        <TaskSection
          title="Later this week"
          tasks={[...groups.this_week, ...groups.later, ...groups.no_date]}
        />
      )}

      {groups.done.length > 0 && (
        <details className="mb-8">
          <summary
            className="cursor-pointer text-sm mb-3 select-none"
            style={{ color: '#8A929C' }}
          >
            {groups.done.length} completed task{groups.done.length !== 1 ? 's' : ''}
          </summary>
          <TaskSection title="Completed" tasks={groups.done} />
        </details>
      )}

      <FAB />
    </div>
  )
}
