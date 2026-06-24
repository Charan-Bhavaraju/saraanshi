import { db } from '@/db'
import { usageLog } from '@/db/schema'

export type UsageOperation =
  | 'insights'
  | 'objectives'
  | 'embedding'
  | 'theme_naming'
  | 'rag_chat'
  | 'findings_draft'
  | 'objective_clustering'

export type UsageEntry = {
  interviewId?: string | null
  provider: 'anthropic' | 'gemini'
  operation: UsageOperation
  model?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  costInrPaise?: number | null
  requestId?: string | null
}

// Records one AI call to usage_log. Best-effort: a logging failure must never
// break the user-facing operation, so errors are swallowed (and surfaced in logs).
export async function logUsage(e: UsageEntry): Promise<void> {
  try {
    await db.insert(usageLog).values({
      interviewId: e.interviewId ?? null,
      provider: e.provider,
      operation: e.operation,
      model: e.model ?? null,
      inputTokens: e.inputTokens ?? null,
      outputTokens: e.outputTokens ?? null,
      costInrPaise: e.costInrPaise ?? 0,
      requestId: e.requestId ?? null,
    })
  } catch (err) {
    console.error('[usage] failed to log AI call', err)
  }
}
