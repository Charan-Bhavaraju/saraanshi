import { db } from '@/db'
import { tasks, contacts } from '@/db/schema'
import { isNull, eq, asc } from 'drizzle-orm'
import type { TaskWithContact } from '@/types/database'
import TasksClient from './_components/TasksClient'

export const dynamic = 'force-dynamic'

async function getTasks(): Promise<TaskWithContact[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      contactId: tasks.contactId,
      location: tasks.location,
      dueAt: tasks.dueAt,
      remindAt: tasks.remindAt,
      remindedAt: tasks.remindedAt,
      status: tasks.status,
      priority: tasks.priority,
      recurrence: tasks.recurrence,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      deletedAt: tasks.deletedAt,
      contact: {
        id: contacts.id,
        displayName: contacts.displayName,
        organization: contacts.organization,
        type: contacts.type,
      },
    })
    .from(tasks)
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .where(isNull(tasks.deletedAt))
    .orderBy(asc(tasks.dueAt), asc(tasks.createdAt))

  return rows.map(r => ({
    ...r,
    contact: r.contact?.id ? r.contact : null,
  })) as TaskWithContact[]
}

export default async function TasksPage() {
  const allTasks = await getTasks()

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pb-32">
      <div className="flex items-baseline justify-between mb-8">
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
        >
          Tasks
        </h1>
        <span className="text-sm" style={{ color: '#8A929C' }}>
          {allTasks.filter(t => t.status === 'todo').length} remaining
        </span>
      </div>

      <TasksClient tasks={allTasks} />
    </div>
  )
}
