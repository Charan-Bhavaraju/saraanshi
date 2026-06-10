// TranscriptionProvider — swap Sarvam for Whisper by writing a new class that
// implements this interface. Callers only import this file, never sarvam.ts.

export type TranscriptSegment = {
  start: number           // seconds from audio start
  end: number             // seconds from audio start
  speaker: string         // 'SPEAKER_1' | 'SPEAKER_2' | custom label
  text: string
  edited: boolean
  editedByHuman: boolean
}

export type TranscriptionResult = {
  segments: TranscriptSegment[]
  fullText: string
  wordCount: number
  language: string
  rawResponse: unknown     // keep raw provider payload for re-processing
  requestId: string        // provider-assigned job ID — used as idempotency key
  durationSeconds: number  // audio duration inferred from last segment end
  estimatedCostInrPaise: number
}

export type TranscriptionParams = {
  // Presigned GET URL to the audio file in R2.
  // Provider downloads directly — audio never passes through Vercel.
  audioUrl: string
  language: 'en' | 'te' | 'hi' | 'mixed'
  // Zero-data-retention mode — pass true for production to prevent provider
  // from using audio/transcripts for model training.
  // Sarvam enterprise tier supports this; default false is acceptable for dev.
  zeroRetention?: boolean
}

export interface TranscriptionProvider {
  readonly name: string
  transcribe(params: TranscriptionParams): Promise<TranscriptionResult>
}
