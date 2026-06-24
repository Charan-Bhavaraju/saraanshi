'use server'

import { db } from '@/db'
import {
  interviews,
  objectiveFindings,
  objectiveClusters,
  objectiveClusterRuns,
} from '@/db/schema'
import { eq, isNull, inArray, and } from 'drizzle-orm'
import { callJSON, MODELS } from '@/lib/ai/anthropic'
import { CLUSTERING_SYSTEM, buildClusteringUser, MAX_TOKENS } from '@/lib/ai/prompts'
import type { Objective, FindingCategory } from '@/db/schema/analysis'

// ─── Types ─────────────────────────────────────────────────────────────

type ClusterLLMResponse = {
  clusters: {
    name: string
    objective: string
    category: string
    finding_ids: string[]
  }[]
}

export type ClusterView = {
  id: string
  clusterName: string
  objective: Objective
  category: FindingCategory
  findings: {
    id: string
    label: string
    excerpt: string | null
    interviewId: string
    participantCode: string | null
  }[]
  interviewCount: number
  totalInterviews: number
}

export type ClusteredTypeData = {
  type: string
  typeLabel: string
  totalInterviews: number
  clusters: ClusterView[]
  run: {
    generatedAt: string
    findingCount: number
    clusterCount: number
    costInrPaise: number | null
  } | null
}

const TYPE_LABELS: Record<string, string> = {
  doctor: 'Doctors',
  patient: 'Patients',
  survivor: 'Survivors',
  other: 'Others',
}

// ─── Run clustering for a single participant type ──────────────────────

export async function runClustering(type: string): Promise<ClusteredTypeData> {
  // 1. Get all interviews of this type
  const typeInterviews = await db
    .select({ id: interviews.id, participantCode: interviews.participantCode })
    .from(interviews)
    .where(and(eq(interviews.type, type as any), isNull(interviews.deletedAt)))

  if (typeInterviews.length === 0) {
    return {
      type,
      typeLabel: TYPE_LABELS[type] ?? type,
      totalInterviews: 0,
      clusters: [],
      run: null,
    }
  }

  const interviewIds = typeInterviews.map(iv => iv.id)
  const pcMap = Object.fromEntries(typeInterviews.map(iv => [iv.id, iv.participantCode]))

  // 2. Get all findings for these interviews
  const findings = await db
    .select({
      id: objectiveFindings.id,
      interviewId: objectiveFindings.interviewId,
      objective: objectiveFindings.objective,
      category: objectiveFindings.category,
      label: objectiveFindings.label,
      excerpt: objectiveFindings.excerpt,
    })
    .from(objectiveFindings)
    .where(inArray(objectiveFindings.interviewId, interviewIds))

  if (findings.length === 0) {
    return {
      type,
      typeLabel: TYPE_LABELS[type] ?? type,
      totalInterviews: typeInterviews.length,
      clusters: [],
      run: null,
    }
  }

  // 3. Delete old clusters + clear cluster_id for this type
  const oldClusters = await db
    .select({ id: objectiveClusters.id })
    .from(objectiveClusters)
    .where(eq(objectiveClusters.type, type))

  if (oldClusters.length > 0) {
    const oldIds = oldClusters.map(c => c.id)
    for (const oldId of oldIds) {
      await db
        .update(objectiveFindings)
        .set({ clusterId: null })
        .where(eq(objectiveFindings.clusterId, oldId))
    }
    await db.delete(objectiveClusters).where(eq(objectiveClusters.type, type))
  }

  // 4. Cluster in chunks: one LLM call per (objective × category) combo
  //    This keeps each call small — even with 16+ interviews the token
  //    count stays well under limits.
  const OBJECTIVES: Objective[] = ['objective_1', 'objective_2', 'objective_3']
  const CATEGORIES: FindingCategory[] = ['facilitator', 'barrier']

  const clusterViews: ClusterView[] = []
  let totalCostPaise = 0
  let lastModel = ''

  for (const obj of OBJECTIVES) {
    for (const cat of CATEGORIES) {
      const chunk = findings.filter(f => f.objective === obj && f.category === cat)
      if (chunk.length === 0) continue

      // If ≤2 findings in this combo, just make each its own cluster (no LLM needed)
      if (chunk.length <= 2) {
        for (const f of chunk) {
          const [inserted] = await db
            .insert(objectiveClusters)
            .values({ type, objective: obj, category: cat, clusterName: f.label })
            .returning({ id: objectiveClusters.id })

          await db.update(objectiveFindings).set({ clusterId: inserted.id }).where(eq(objectiveFindings.id, f.id))

          clusterViews.push({
            id: inserted.id,
            clusterName: f.label,
            objective: obj,
            category: cat,
            findings: [{ id: f.id, label: f.label, excerpt: f.excerpt, interviewId: f.interviewId, participantCode: pcMap[f.interviewId] ?? null }],
            interviewCount: 1,
            totalInterviews: typeInterviews.length,
          })
        }
        continue
      }

      const llmInput = chunk.map(f => ({
        id: f.id,
        objective: f.objective,
        category: f.category,
        label: f.label,
        participantCode: pcMap[f.interviewId] ?? null,
      }))

      const result = await callJSON<ClusterLLMResponse>({
        model: MODELS.haiku,
        system: CLUSTERING_SYSTEM,
        user: buildClusteringUser(TYPE_LABELS[type] ?? type, llmInput),
        operation: 'objective_clustering',
        maxTokens: MAX_TOKENS.clustering,
      })

      totalCostPaise += result.costInrPaise
      lastModel = result.model

      for (const llmCluster of result.data.clusters) {
        const [inserted] = await db
          .insert(objectiveClusters)
          .values({ type, objective: obj, category: cat, clusterName: llmCluster.name })
          .returning({ id: objectiveClusters.id })

        const validFindingIds = llmCluster.finding_ids.filter(fid => chunk.some(f => f.id === fid))

        if (validFindingIds.length > 0) {
          await db.update(objectiveFindings).set({ clusterId: inserted.id }).where(inArray(objectiveFindings.id, validFindingIds))
        }

        const clusterFindings = chunk
          .filter(f => validFindingIds.includes(f.id))
          .map(f => ({ id: f.id, label: f.label, excerpt: f.excerpt, interviewId: f.interviewId, participantCode: pcMap[f.interviewId] ?? null }))

        const uniqueIvIds = new Set(clusterFindings.map(f => f.interviewId))

        clusterViews.push({
          id: inserted.id,
          clusterName: llmCluster.name,
          objective: obj,
          category: cat,
          findings: clusterFindings,
          interviewCount: uniqueIvIds.size,
          totalInterviews: typeInterviews.length,
        })
      }
    }
  }

  // 5. Upsert cluster run record
  await db
    .insert(objectiveClusterRuns)
    .values({
      type,
      llmModel: lastModel,
      costInrPaise: totalCostPaise,
      findingCount: findings.length,
      clusterCount: clusterViews.length,
    })
    .onConflictDoUpdate({
      target: objectiveClusterRuns.type,
      set: {
        llmModel: lastModel,
        costInrPaise: totalCostPaise,
        findingCount: findings.length,
        clusterCount: clusterViews.length,
        generatedAt: new Date(),
      },
    })

  return {
    type,
    typeLabel: TYPE_LABELS[type] ?? type,
    totalInterviews: typeInterviews.length,
    clusters: clusterViews,
    run: {
      generatedAt: new Date().toISOString(),
      findingCount: findings.length,
      clusterCount: clusterViews.length,
      costInrPaise: totalCostPaise,
    },
  }
}

// ─── Load existing clusters (no LLM call) ──────────────────────────────

export async function loadClusters(type: string): Promise<ClusteredTypeData> {
  const typeInterviews = await db
    .select({ id: interviews.id, participantCode: interviews.participantCode })
    .from(interviews)
    .where(and(eq(interviews.type, type as any), isNull(interviews.deletedAt)))

  if (typeInterviews.length === 0) {
    return { type, typeLabel: TYPE_LABELS[type] ?? type, totalInterviews: 0, clusters: [], run: null }
  }

  const interviewIds = typeInterviews.map(iv => iv.id)
  const pcMap = Object.fromEntries(typeInterviews.map(iv => [iv.id, iv.participantCode]))

  // Get clusters for this type
  const clusters = await db
    .select()
    .from(objectiveClusters)
    .where(eq(objectiveClusters.type, type))

  if (clusters.length === 0) {
    return { type, typeLabel: TYPE_LABELS[type] ?? type, totalInterviews: typeInterviews.length, clusters: [], run: null }
  }

  const clusterIds = clusters.map(c => c.id)

  // Get findings assigned to these clusters
  const findings = await db
    .select({
      id: objectiveFindings.id,
      interviewId: objectiveFindings.interviewId,
      objective: objectiveFindings.objective,
      category: objectiveFindings.category,
      label: objectiveFindings.label,
      excerpt: objectiveFindings.excerpt,
      clusterId: objectiveFindings.clusterId,
    })
    .from(objectiveFindings)
    .where(
      and(
        inArray(objectiveFindings.interviewId, interviewIds),
        inArray(objectiveFindings.clusterId, clusterIds),
      )
    )

  // Get run info
  const [run] = await db
    .select()
    .from(objectiveClusterRuns)
    .where(eq(objectiveClusterRuns.type, type))

  const clusterViews: ClusterView[] = clusters.map(c => {
    const clusterFindings = findings
      .filter(f => f.clusterId === c.id)
      .map(f => ({
        id: f.id,
        label: f.label,
        excerpt: f.excerpt,
        interviewId: f.interviewId,
        participantCode: pcMap[f.interviewId] ?? null,
      }))
    const uniqueInterviewIds = new Set(clusterFindings.map(f => f.interviewId))

    return {
      id: c.id,
      clusterName: c.clusterName,
      objective: c.objective as Objective,
      category: c.category as FindingCategory,
      findings: clusterFindings,
      interviewCount: uniqueInterviewIds.size,
      totalInterviews: typeInterviews.length,
    }
  })

  return {
    type,
    typeLabel: TYPE_LABELS[type] ?? type,
    totalInterviews: typeInterviews.length,
    clusters: clusterViews,
    run: run
      ? {
          generatedAt: run.generatedAt?.toISOString() ?? new Date().toISOString(),
          findingCount: run.findingCount,
          clusterCount: run.clusterCount,
          costInrPaise: run.costInrPaise,
        }
      : null,
  }
}

// ─── Load clusters for all types ───────────────────────────────────────

export async function loadAllClusters(): Promise<ClusteredTypeData[]> {
  const types = ['doctor', 'patient', 'survivor', 'other']
  const results = await Promise.all(types.map(loadClusters))
  return results.filter(r => r.totalInterviews > 0)
}
