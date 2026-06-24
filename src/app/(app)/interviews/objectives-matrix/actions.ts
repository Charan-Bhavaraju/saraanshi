'use server'

import { db } from '@/db'
import { interviews, contacts, objectiveFindings } from '@/db/schema'
import { isNull, inArray } from 'drizzle-orm'
import type { Objective, FindingCategory } from '@/db/schema/analysis'

// ─── Types for the matrix view ────────────────────────────────────────────

export type MatrixFinding = {
  id: string
  objective: Objective
  category: FindingCategory
  label: string
  excerpt: string | null
  rationale: string | null
}

export type MatrixInterview = {
  id: string
  participantCode: string | null
  type: string // 'patient' | 'doctor' | 'survivor' | 'other'
  contactName: string | null
  findings: MatrixFinding[]
}

export type ObjectivesMatrixData = {
  interviews: MatrixInterview[]
}

// ─── Load all interviews + their objective findings for the matrix ────────

export async function loadObjectivesMatrix(): Promise<ObjectivesMatrixData> {
  // Get all non-deleted interviews
  const allInterviews = await db
    .select({
      id: interviews.id,
      participantCode: interviews.participantCode,
      type: interviews.type,
      contactId: interviews.contactId,
    })
    .from(interviews)
    .where(isNull(interviews.deletedAt))
    .orderBy(interviews.type, interviews.participantCode)

  if (allInterviews.length === 0) return { interviews: [] }

  // Get contacts
  const contactIds = [...new Set(allInterviews.flatMap(r => r.contactId ? [r.contactId] : []))]
  const allContacts = contactIds.length > 0
    ? await db
        .select({ id: contacts.id, displayName: contacts.displayName })
        .from(contacts)
        .where(inArray(contacts.id, contactIds))
    : []
  const contactMap = Object.fromEntries(allContacts.map(c => [c.id, c.displayName]))

  // Get all findings
  const interviewIds = allInterviews.map(r => r.id)
  const allFindings = await db
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

  // Group findings by interview
  const findingsMap = new Map<string, MatrixFinding[]>()
  for (const f of allFindings) {
    const list = findingsMap.get(f.interviewId) ?? []
    list.push({
      id: f.id,
      objective: f.objective as Objective,
      category: f.category as FindingCategory,
      label: f.label,
      excerpt: f.excerpt,
      rationale: f.rationale,
    })
    findingsMap.set(f.interviewId, list)
  }

  // Only include interviews that have findings
  const result: MatrixInterview[] = allInterviews
    .filter(iv => findingsMap.has(iv.id))
    .map(iv => ({
      id: iv.id,
      participantCode: iv.participantCode,
      type: iv.type,
      contactName: iv.contactId ? (contactMap[iv.contactId] ?? null) : null,
      findings: findingsMap.get(iv.id) ?? [],
    }))

  return { interviews: result }
}

// Load matrix for a single interview (used in interview-level objectives tab)
export async function loadSingleInterviewMatrix(interviewId: string): Promise<ObjectivesMatrixData> {
  const { eq, and } = await import('drizzle-orm')
  const [iv] = await db
    .select({
      id: interviews.id,
      participantCode: interviews.participantCode,
      type: interviews.type,
      contactId: interviews.contactId,
    })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), isNull(interviews.deletedAt)))

  if (!iv) return { interviews: [] }

  const contactName = iv.contactId
    ? (await db
        .select({ displayName: contacts.displayName })
        .from(contacts)
        .where(inArray(contacts.id, [iv.contactId]))
        .then(rows => rows[0]?.displayName ?? null))
    : null

  const findings = await db
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
    .where(inArray(objectiveFindings.interviewId, [interviewId]))

  if (findings.length === 0) return { interviews: [] }

  return {
    interviews: [{
      id: iv.id,
      participantCode: iv.participantCode,
      type: iv.type,
      contactName,
      findings: findings.map(f => ({
        id: f.id,
        objective: f.objective as Objective,
        category: f.category as FindingCategory,
        label: f.label,
        excerpt: f.excerpt,
        rationale: f.rationale,
      })),
    }],
  }
}
