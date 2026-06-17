import { db } from '@/db'
import { usageLog } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { formatPaise } from '@/lib/ai/cost'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const OPERATION_LABELS: Record<string, string> = {
  transcription: 'Transcription (Sarvam)',
  translation: 'Translation',
  insights: 'Per-interview insights',
  embedding: 'Embeddings (Gemini)',
  theme_naming: 'Theme naming',
  rag_chat: 'Corpus chat',
  findings_draft: 'Findings drafts',
}

type OpRow = { operation: string; total: number; calls: number }
type DayRow = { day: string; total: number }

async function getCostData() {
  // All-time total
  const [allTime] = await db
    .select({ total: sql<number>`coalesce(sum(${usageLog.costInrPaise}), 0)` })
    .from(usageLog)

  // This calendar month
  const [thisMonth] = await db
    .select({ total: sql<number>`coalesce(sum(${usageLog.costInrPaise}), 0)` })
    .from(usageLog)
    .where(sql`${usageLog.createdAt} >= date_trunc('month', now())`)

  // Breakdown by operation (this month)
  const byOp = (await db.execute(sql`
    SELECT operation, coalesce(sum(cost_inr_paise), 0)::int AS total, count(*)::int AS calls
    FROM usage_log
    WHERE created_at >= date_trunc('month', now())
    GROUP BY operation
    ORDER BY total DESC
  `)) as unknown as OpRow[]

  // Daily trend (this month)
  const byDay = (await db.execute(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
           coalesce(sum(cost_inr_paise), 0)::int AS total
    FROM usage_log
    WHERE created_at >= date_trunc('month', now())
    GROUP BY 1 ORDER BY 1
  `)) as unknown as DayRow[]

  return {
    allTime: Number(allTime?.total ?? 0),
    thisMonth: Number(thisMonth?.total ?? 0),
    byOp: byOp.map(r => ({ operation: r.operation, total: Number(r.total), calls: Number(r.calls) })),
    byDay: byDay.map(r => ({ day: r.day, total: Number(r.total) })),
  }
}

// Project budget ceiling: ~$15 over the dissertation. At ~₹88/$ ≈ ₹1,320 = 132000 paise.
const BUDGET_PAISE = 132000

export default async function CostDashboardPage() {
  const { allTime, thisMonth, byOp, byDay } = await getCostData()
  const pctOfBudget = Math.min(100, Math.round((allTime / BUDGET_PAISE) * 100))
  const maxDay = Math.max(1, ...byDay.map(d => d.total))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20">
      <Link href="/today" className="inline-flex items-center gap-1.5 text-sm mb-6" style={{ color: '#8A929C' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </Link>

      <h1 className="text-3xl tracking-tight mb-1" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}>
        AI spend
      </h1>
      <p className="text-sm mb-6" style={{ color: '#8A929C' }}>
        Every AI call is logged. Estimates use ~₹88/$ — a guide, not an invoice.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Stat label="This month" value={formatPaise(thisMonth)} />
        <Stat label="All time" value={formatPaise(allTime)} />
      </div>

      {/* Budget bar */}
      <div className="rounded-[14px] p-5 mb-6" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: '#4A5263', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
            Against ~₹1,320 project budget
          </span>
          <span className="text-xs" style={{ color: pctOfBudget > 80 ? '#B8456D' : '#8A929C' }}>{pctOfBudget}%</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#F5F1E9' }}>
          <div className="h-full rounded-full" style={{ width: `${pctOfBudget}%`, background: pctOfBudget > 80 ? '#B8456D' : '#0E5C5C' }} />
        </div>
      </div>

      {/* Breakdown by operation */}
      <div className="rounded-[14px] p-5 mb-6" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
        <h2 className="text-sm font-medium mb-4" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
          This month by operation
        </h2>
        {byOp.length === 0 ? (
          <p className="text-sm" style={{ color: '#8A929C' }}>No AI calls yet this month.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {byOp.map(r => (
              <div key={r.operation} className="flex items-center justify-between text-sm">
                <span style={{ color: '#1A1F2C' }}>{OPERATION_LABELS[r.operation] ?? r.operation}</span>
                <span style={{ color: '#8A929C' }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{r.calls}</span> calls · <span style={{ color: '#1A1F2C', fontWeight: 500 }}>{formatPaise(r.total)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily trend */}
      {byDay.length > 0 && (
        <div className="rounded-[14px] p-5" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
          <h2 className="text-sm font-medium mb-4" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
            Daily this month
          </h2>
          <div className="flex items-end gap-1" style={{ height: 100 }}>
            {byDay.map(d => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end" title={`${d.day}: ${formatPaise(d.total)}`}>
                <div className="w-full rounded-t" style={{ height: `${Math.max(2, (d.total / maxDay) * 90)}px`, background: '#0E5C5C', opacity: 0.8 }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] p-5" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
      <p className="text-xs" style={{ color: '#8A929C', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{label}</p>
      <p className="text-2xl mt-1" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, color: '#1A1F2C' }}>{value}</p>
    </div>
  )
}
