import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { interviews, contacts, objectiveFindings } from '@/db/schema'
import { isNull, inArray, eq, and } from 'drizzle-orm'
import type { Objective, FindingCategory } from '@/db/schema/analysis'

export const maxDuration = 30

const OBJECTIVE_LABELS: Record<string, string> = {
  objective_1: 'Obj 1 — Early Detection',
  objective_2: 'Obj 2 — Diagnosis & Treatment',
  objective_3: 'Obj 3 — Continuity & Follow-Up',
}

const TYPE_LABELS: Record<string, string> = {
  patient: 'Patient', doctor: 'Doctor', survivor: 'Survivor', other: 'Other',
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

export async function GET(req: NextRequest) {
  const singleId = req.nextUrl.searchParams.get('interviewId')

  // Fetch interviews
  const allInterviews = singleId
    ? await db
        .select({
          id: interviews.id,
          participantCode: interviews.participantCode,
          type: interviews.type,
          contactId: interviews.contactId,
        })
        .from(interviews)
        .where(and(eq(interviews.id, singleId), isNull(interviews.deletedAt)))
    : await db
        .select({
          id: interviews.id,
          participantCode: interviews.participantCode,
          type: interviews.type,
          contactId: interviews.contactId,
        })
        .from(interviews)
        .where(isNull(interviews.deletedAt))
        .orderBy(interviews.type, interviews.participantCode)

  if (allInterviews.length === 0) {
    return NextResponse.json({ error: 'No interviews found' }, { status: 404 })
  }

  // Get contacts
  const contactIds = [...new Set(allInterviews.flatMap(r => r.contactId ? [r.contactId] : []))]
  const allContacts = contactIds.length > 0
    ? await db
        .select({ id: contacts.id, displayName: contacts.displayName })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : []
  const contactMap = Object.fromEntries(allContacts.map(c => [c.id, c.displayName]))

  // Get findings
  const interviewIds = allInterviews.map(r => r.id)
  const allFindings = interviewIds.length > 0
    ? await db
        .select({
          id: objectiveFindings.id,
          interviewId: objectiveFindings.interviewId,
          objective: objectiveFindings.objective,
          category: objectiveFindings.category,
          label: objectiveFindings.label,
          excerpt: objectiveFindings.excerpt,
          rationale: objectiveFindings.rationale,
        })
        .from(objectiveFindings)
        .where(inArray(objectiveFindings.interviewId, interviewIds))
    : []

  // Group by interview
  const findingsMap = new Map<string, typeof allFindings>()
  for (const f of allFindings) {
    const list = findingsMap.get(f.interviewId) ?? []
    list.push(f)
    findingsMap.set(f.interviewId, list)
  }

  // Build the matrix CSV
  // Headers: Participant | Type | Obj 1 Facilitators | Obj 1 Barriers | Obj 2 Facilitators | Obj 2 Barriers | Obj 3 Facilitators | Obj 3 Barriers
  const objectives = ['objective_1', 'objective_2', 'objective_3'] as const
  const categories = ['facilitator', 'barrier'] as const

  const headers = [
    'Participant Code',
    'Type',
    'Contact Name',
  ]
  for (const obj of objectives) {
    headers.push(`${OBJECTIVE_LABELS[obj]} — Facilitators`)
    headers.push(`${OBJECTIVE_LABELS[obj]} — Barriers`)
  }

  const rows: string[][] = [headers]

  for (const iv of allInterviews) {
    const findings = findingsMap.get(iv.id) ?? []
    if (findings.length === 0) continue

    // Find max rows needed for this interview (to handle multi-line cells)
    const cellsByObjCat: Record<string, string[]> = {}
    for (const obj of objectives) {
      for (const cat of categories) {
        const key = `${obj}_${cat}`
        cellsByObjCat[key] = findings
          .filter(f => f.objective === obj && f.category === cat)
          .map(f => f.label)
      }
    }

    const maxItems = Math.max(1, ...Object.values(cellsByObjCat).map(a => a.length))

    for (let i = 0; i < maxItems; i++) {
      const row: string[] = [
        i === 0 ? (iv.participantCode ?? iv.id.slice(0, 8)) : '',
        i === 0 ? (TYPE_LABELS[iv.type] ?? iv.type) : '',
        i === 0 ? (iv.contactId ? (contactMap[iv.contactId] ?? '') : '') : '',
      ]
      for (const obj of objectives) {
        for (const cat of categories) {
          const key = `${obj}_${cat}`
          row.push(cellsByObjCat[key][i] ?? '')
        }
      }
      rows.push(row)
    }

    // Add empty separator row between interviews
    rows.push(Array(headers.length).fill(''))
  }

  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\r\n')
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = singleId ? `objectives-${dateStr}.csv` : `objectives-matrix-${dateStr}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
