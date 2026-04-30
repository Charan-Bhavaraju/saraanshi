import { db } from '@/db'
import { contacts, tasks } from '@/db/schema'
import { isNull, eq, and, gte, lt, inArray } from 'drizzle-orm'
import { startOfDay, endOfDay, addDays, formatDateLabel, getGreeting, formatDayHeader } from '@/lib/utils'
import Link from 'next/link'

async function getStats() {
  const allContacts = await db
    .select({ id: contacts.id, status: contacts.status })
    .from(contacts)
    .where(isNull(contacts.deletedAt))

  const total = allContacts.length
  const inConversation = allContacts.filter(c =>
    ['contacted', 'interested', 'scheduled'].includes(c.status),
  ).length
  const interviewed = allContacts.filter(c =>
    ['interviewed', 'done'].includes(c.status),
  ).length

  const now = new Date()
  const todayTasks = await db
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, status: tasks.status, contactId: tasks.contactId })
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        eq(tasks.status, 'todo'),
        gte(tasks.dueAt, startOfDay(now)),
        lt(tasks.dueAt, endOfDay(now)),
      ),
    )
    .limit(6)

  const taskContactIds = todayTasks.flatMap(t => t.contactId ? [t.contactId] : [])
  const taskContacts =
    taskContactIds.length > 0
      ? await db
          .select({ id: contacts.id, displayName: contacts.displayName, organization: contacts.organization })
          .from(contacts)
          .where(inArray(contacts.id, taskContactIds))
      : []

  const contactMap = Object.fromEntries(taskContacts.map(c => [c.id, c]))

  const tasksDueCount = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        eq(tasks.status, 'todo'),
        gte(tasks.dueAt, startOfDay(now)),
        lt(tasks.dueAt, endOfDay(addDays(now, 1))),
      ),
    )

  return {
    total,
    inConversation,
    interviewed,
    tasksDueToday: tasksDueCount.length,
    todayTasks: todayTasks.map(t => ({
      ...t,
      contact: t.contactId ? contactMap[t.contactId] ?? null : null,
    })),
  }
}

export default async function TodayPage() {
  const stats = await getStats()
  const greeting = getGreeting()
  const dayLabel = formatDayHeader()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* Greeting */}
      <div className="mb-8">
        <h1
          className="text-4xl tracking-tight leading-tight"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          {greeting},{' '}
          <em className="not-italic" style={{ color: '#0E5C5C', fontWeight: 500 }}>
            Sravya
          </em>
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: '#8A929C' }}>
          {dayLabel} · {stats.tasksDueToday === 0
            ? 'No tasks due today'
            : `${stats.tasksDueToday} task${stats.tasksDueToday === 1 ? '' : 's'} today`}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Total leads" value={stats.total} />
        <StatCard label="In conversation" value={stats.inConversation} />
        <StatCard label="Interviewed" value={stats.interviewed} suffix="/30" trend="of 30 target" />
        <StatCard label="Tasks today" value={stats.tasksDueToday} />
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Today's plan */}
        <div
          className="rounded-[14px] p-5"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="text-lg"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Today&apos;s plan
            </h2>
            <Link href="/tasks" className="text-sm" style={{ color: '#0E5C5C', fontSize: 13 }}>
              View all →
            </Link>
          </div>

          {stats.todayTasks.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: '#8A929C' }}>
              No tasks due today.{' '}
              <Link href="/tasks" style={{ color: '#0E5C5C' }}>Add one →</Link>
            </p>
          ) : (
            <div>
              {stats.todayTasks.map((task, i) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 py-2.5"
                  style={{ borderBottom: i < stats.todayTasks.length - 1 ? '1px solid #ECE6D9' : 'none' }}
                >
                  <div
                    className="shrink-0 rounded mt-0.5"
                    style={{ width: 18, height: 18, minWidth: 18, minHeight: 18, border: '1.5px solid #B5BBC4' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A1F2C' }}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {task.dueAt && (
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: '#F5F1E9', color: '#4A5263' }}
                        >
                          {formatDateLabel(task.dueAt)}
                        </span>
                      )}
                      {task.contact && (
                        <>
                          <span style={{ width: 3, height: 3, background: '#B5BBC4', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
                          <span className="text-xs truncate" style={{ color: '#0E5C5C' }}>
                            {task.contact.displayName}
                            {task.contact.organization ? ` · ${task.contact.organization}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent interviews — Phase 2 placeholder */}
        <div
          className="rounded-[14px] p-5 flex flex-col"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="text-lg"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Recent interviews
            </h2>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: '#F5F1E9', color: '#8A929C', fontSize: 11 }}
            >
              Phase 2
            </span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 44, height: 44, minWidth: 44, minHeight: 44, background: '#F5F1E9' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4h12v8a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" stroke="#B5BBC4" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M7 8h6M7 11h4" stroke="#B5BBC4" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: '#4A5263' }}>No interviews yet</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#8A929C' }}>
                Audio upload and transcription<br />coming in Phase 2
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  trend,
}: {
  label: string
  value: number
  suffix?: string
  trend?: string
}) {
  return (
    <div
      className="rounded-[10px] px-4 py-4"
      style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
    >
      <p
        className="text-xs font-medium uppercase"
        style={{ color: '#8A929C', letterSpacing: '0.06em' }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 leading-none"
        style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: '-0.02em',
          color: '#1A1F2C',
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 18, fontWeight: 400, color: '#8A929C' }}>{suffix}</span>
        )}
      </p>
      {trend && (
        <p className="text-xs mt-1" style={{ color: '#8A929C' }}>{trend}</p>
      )}
    </div>
  )
}
