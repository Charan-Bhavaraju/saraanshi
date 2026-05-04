import { db } from '@/db'
import { contacts, tasks, interviews } from '@/db/schema'
import { isNull, eq, and, gte, lt, inArray, desc } from 'drizzle-orm'
import { startOfDay, endOfDay, addDays, getGreeting, formatDayHeader } from '@/lib/utils'
import Link from 'next/link'
import TodayTaskList from './_components/TodayTaskList'
import StatusBadge from '../interviews/[id]/_components/StatusBadge'

// Page-level ISR: serve from Vercel edge cache, bust immediately via revalidatePath('/today')
// called from task/interview server actions. 60s TTL is a safety-net for anything missed.
export const revalidate = 60

async function getStats() {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  // Phase 1: all independent queries in parallel (saves ~3 sequential round-trips)
  const [allContacts, todoTasks, doneTasks, tasksDueCount] = await Promise.all([
    db.select({ id: contacts.id, status: contacts.status })
      .from(contacts)
      .where(isNull(contacts.deletedAt)),

    db.select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, status: tasks.status, contactId: tasks.contactId })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'todo'), gte(tasks.dueAt, todayStart), lt(tasks.dueAt, todayEnd)))
      .limit(8),

    db.select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, status: tasks.status, contactId: tasks.contactId })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'done'), gte(tasks.dueAt, todayStart), lt(tasks.dueAt, todayEnd)))
      .limit(8),

    db.select({ id: tasks.id })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), eq(tasks.status, 'todo'), gte(tasks.dueAt, todayStart), lt(tasks.dueAt, endOfDay(addDays(now, 1))))),
  ])

  // Phase 2: task contacts (depends on phase 1 results)
  const taskContactIds = [...todoTasks, ...doneTasks].flatMap(t => t.contactId ? [t.contactId] : [])
  const taskContacts = taskContactIds.length > 0
    ? await db.select({ id: contacts.id, displayName: contacts.displayName, organization: contacts.organization })
        .from(contacts)
        .where(inArray(contacts.id, taskContactIds))
    : []

  const contactMap = Object.fromEntries(taskContacts.map(c => [c.id, c]))
  function attachContact<T extends { contactId: string | null }>(t: T) {
    return { ...t, contact: t.contactId ? contactMap[t.contactId] ?? null : null }
  }

  return {
    total: allContacts.length,
    inConversation: allContacts.filter(c => ['contacted', 'interested', 'scheduled'].includes(c.status)).length,
    interviewed: allContacts.filter(c => ['interviewed', 'done'].includes(c.status)).length,
    tasksDueToday: tasksDueCount.length,
    todayTodoTasks: todoTasks.map(attachContact),
    todayDoneTasks: doneTasks.map(attachContact),
  }
}

async function getRecentInterviews() {
  return db
    .select({
      id: interviews.id,
      participantCode: interviews.participantCode,
      status: interviews.status,
      conductedAt: interviews.conductedAt,
      contactName: contacts.displayName,
    })
    .from(interviews)
    .leftJoin(contacts, eq(interviews.contactId, contacts.id))
    .where(isNull(interviews.deletedAt))
    .orderBy(desc(interviews.createdAt))
    .limit(4)
}

function getWelcomeMessage(interviewed: number, inConversation: number): string {
  if (interviewed >= 30) return 'You\'ve reached your interview goal — incredible work, Sravya!'
  if (interviewed > 0) return `${interviewed} interview${interviewed === 1 ? '' : 's'} completed — you\'re building something meaningful.`
  if (inConversation > 0) return `${inConversation} active conversation${inConversation === 1 ? '' : 's'} in progress — keep the momentum going.`
  return 'Every conversation you start brings your research one step closer to impact.'
}

export default async function TodayPage() {
  const [stats, recentInterviews] = await Promise.all([getStats(), getRecentInterviews()])
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
        <p className="mt-2 text-sm" style={{ color: '#4A5263' }}>
          {getWelcomeMessage(stats.interviewed, stats.inConversation)}
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
          className="rounded-[14px] p-5 min-h-[260px]"
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

          <TodayTaskList
            todoTasks={stats.todayTodoTasks}
            doneTasks={stats.todayDoneTasks}
          />
        </div>

        {/* Recent interviews */}
        <div
          className="rounded-[14px] p-5 flex flex-col min-h-[260px]"
          style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
        >
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="text-lg"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Recent interviews
            </h2>
            <Link href="/interviews" className="text-sm" style={{ color: '#0E5C5C', fontSize: 13 }}>
              View all →
            </Link>
          </div>
          {recentInterviews.length === 0 ? (
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
                <p className="text-xs mt-1" style={{ color: '#8A929C' }}>Start logging your fieldwork</p>
              </div>
              <Link
                href="/interviews/new"
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: '#E2EEEC', color: '#0E5C5C' }}
              >
                New interview →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {recentInterviews.map(interview => (
                <Link
                  key={interview.id}
                  href={`/interviews/${interview.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[#F5F1E9]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {interview.participantCode && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded shrink-0"
                        style={{ background: '#E2EEEC', color: '#0E5C5C', fontFamily: 'var(--font-mono)' }}
                      >
                        {interview.participantCode}
                      </span>
                    )}
                    <span className="text-sm truncate" style={{ color: '#1A1F2C' }}>
                      {interview.contactName ?? 'Unknown participant'}
                    </span>
                  </div>
                  <StatusBadge status={interview.status} />
                </Link>
              ))}
            </div>
          )}
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
