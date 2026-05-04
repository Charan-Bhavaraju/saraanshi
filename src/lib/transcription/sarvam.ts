import { SarvamAIClient } from 'sarvamai'
import { writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { TranscriptionProvider, TranscriptionParams, TranscriptionResult, TranscriptSegment } from './types'

const COST_PAISE_PER_SECOND = 2.5

const LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  te: 'te-IN',
  mixed: 'unknown',
}

function log(msg: string) {
  console.log(`[sarvam] ${new Date().toISOString().substring(11, 23)}  ${msg}`)
}

function makeClient(): SarvamAIClient {
  const key = process.env.SARVAM_API_KEY
  if (!key) throw new Error('SARVAM_API_KEY env var not set')
  return new SarvamAIClient({ apiSubscriptionKey: key })
}

export type BatchSubmitResult = { jobId: string }

export class SarvamProvider implements TranscriptionProvider {
  readonly name = 'sarvam'

  // Not used directly — present to satisfy the interface
  async transcribe(params: TranscriptionParams): Promise<TranscriptionResult> {
    const { jobId } = await this.submitBatchJob(params.audioUrl, params.language, 'sync')
    const job = makeClient().speechToTextJob.getJob(jobId)
    await job.waitUntilComplete(5, 600)
    return this.downloadAndParse(jobId)
  }

  // ── Submit: download from R2 → write temp file → SDK upload → start ───────

  async submitBatchJob(
    audioUrl: string,
    language: string,
    interviewId: string,
  ): Promise<BatchSubmitResult> {
    const langCode = LANG_MAP[language] ?? 'unknown'
    log(`Creating batch job  language=${langCode}`)

    const client = makeClient()
    const job = await client.speechToTextJob.createJob({
      model: 'saaras:v3',
      mode: 'transcribe',
      languageCode: langCode as never,
      withTimestamps: true,
      withDiarization: true,
      numSpeakers: 2,
    })

    log(`Job created  job_id=${job.jobId}`)

    // Download from R2 and save to a local temp file — SDK needs a file path
    const tempAudio = join(tmpdir(), `saaranshi-${interviewId}.mp3`)
    log(`Fetching audio from R2...`)

    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error(`Failed to fetch audio from R2: ${audioRes.status}`)
    const buf = await audioRes.arrayBuffer()
    writeFileSync(tempAudio, Buffer.from(buf))
    log(`Saved to temp  size=${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`)

    try {
      log(`Uploading to Sarvam...`)
      await job.uploadFiles([tempAudio])
      log(`Upload complete — starting job`)
      await job.start()
      log(`Job started  job_id=${job.jobId}`)
    } finally {
      try { rmSync(tempAudio) } catch { /* ignore */ }
    }

    return { jobId: job.jobId }
  }

  // ── Poll: check status, download output JSON and parse when done ──────────

  async checkBatchJob(jobId: string): Promise<TranscriptionResult | null> {
    const job = makeClient().speechToTextJob.getJob(jobId)
    const complete = await job.isComplete()
    log(`Polled  job_id=${jobId}  complete=${complete}`)

    if (!complete) return null

    if (await job.isFailed()) {
      throw new Error(`Sarvam batch job failed  job_id=${jobId}`)
    }

    return this.downloadAndParse(jobId)
  }

  // ── Download output JSON and parse into TranscriptionResult ───────────────

  private async downloadAndParse(jobId: string): Promise<TranscriptionResult> {
    const job = makeClient().speechToTextJob.getJob(jobId)
    const outputDir = join(tmpdir(), `saaranshi-out-${jobId}`)
    log(`Downloading output  dir=${outputDir}`)

    try {
      await job.downloadOutputs(outputDir)

      // SDK names output as {inputBasename}.json — find it dynamically
      // since the input filename includes the interview ID
      const { readdirSync } = await import('fs')
      const files = existsSync(outputDir) ? readdirSync(outputDir) : []
      const jsonFile = files.find(f => f.endsWith('.json'))
      if (!jsonFile) {
        throw new Error(`No output JSON in dir. Contents: [${files.join(', ')}]`)
      }
      const outputPath = join(outputDir, jsonFile)
      log(`Reading output file  name=${jsonFile}`)

      const raw = JSON.parse(readFileSync(outputPath, 'utf-8')) as Record<string, unknown>
      log(`Raw transcript length=${String(raw.transcript ?? '').length}  lang=${raw.language_code ?? '?'}`)

      return this.parseOutput(raw)
    } finally {
      try { rmSync(outputDir, { recursive: true }) } catch { /* ignore */ }
    }
  }

  // ── Parse output JSON ─────────────────────────────────────────────────────

  private parseOutput(raw: Record<string, unknown>): TranscriptionResult {
    const transcript = String(raw.transcript ?? '').trim()
    const langCode = String(raw.language_code ?? 'unknown')
    const requestId = String(raw.request_id ?? `sarvam-${Date.now()}`)
    const metrics = raw.metrics as { audio_duration?: number } | undefined
    const durationSeconds = Math.ceil(metrics?.audio_duration ?? 0)

    const segments = this.parseSegments(raw, transcript)
    const wordCount = transcript.split(/\s+/).filter(Boolean).length

    log(`Parsed  segments=${segments.length}  words=${wordCount}  duration=${durationSeconds}s  cost=₹${(Math.ceil(durationSeconds * COST_PAISE_PER_SECOND) / 100).toFixed(2)}`)

    return {
      segments,
      fullText: transcript,
      wordCount,
      language: langCode,
      rawResponse: raw,
      requestId,
      durationSeconds,
      estimatedCostInrPaise: Math.ceil(durationSeconds * COST_PAISE_PER_SECOND),
    }
  }

  private parseSegments(raw: Record<string, unknown>, fallback: string): TranscriptSegment[] {
    // 1. Diarized transcript: {entries: [{transcript, start_time_seconds, end_time_seconds, speaker_id}]}
    type Entry = { transcript?: string; start_time_seconds?: number; end_time_seconds?: number; speaker_id?: string | number }
    const diarObj = raw.diarized_transcript as { entries?: Entry[] } | null | undefined
    const entries = diarObj?.entries
    if (entries && entries.length > 0) {
      log(`Using diarized entries  count=${entries.length}`)
      return entries.map(e => ({
        start: e.start_time_seconds ?? 0,
        end: e.end_time_seconds ?? 0,
        speaker: this.normaliseSpeaker(e.speaker_id),
        text: (e.transcript ?? '').trim(),
        edited: false,
        editedByHuman: false,
      }))
    }

    // 2. Word-level timestamps: {words: string[], start_time_seconds: number[], end_time_seconds: number[]}
    type TsObj = { words?: string[]; start_time_seconds?: number[]; end_time_seconds?: number[] }
    const ts = raw.timestamps as TsObj | null | undefined
    if (ts?.words && ts.words.length > 0) {
      log(`Using word timestamps  count=${ts.words.length}`)
      return this.groupWords(ts.words, ts.start_time_seconds ?? [], ts.end_time_seconds ?? [])
    }

    // 3. Single-segment fallback from full transcript text
    if (fallback) {
      log(`Using single-segment fallback`)
      return [{ start: 0, end: 0, speaker: 'SPEAKER_1', text: fallback, edited: false, editedByHuman: false }]
    }

    return []
  }

  private normaliseSpeaker(id: string | number | undefined): string {
    const n = parseInt(String(id ?? '0'), 10)
    return `SPEAKER_${isNaN(n) ? 1 : n + 1}`
  }

  private groupWords(words: string[], starts: number[], ends: number[]): TranscriptSegment[] {
    if (!words.length) return []
    const segments: TranscriptSegment[] = []
    let group = [{ word: words[0], start: starts[0] ?? 0, end: ends[0] ?? 0 }]

    for (let i = 1; i < words.length; i++) {
      const gap = (starts[i] ?? 0) - (ends[i - 1] ?? 0)
      const punct = /[.?!]$/.test(words[i - 1])
      if (gap > 1.0 || punct || group.length >= 15) {
        segments.push(this.makeSegment(group))
        group = [{ word: words[i], start: starts[i] ?? 0, end: ends[i] ?? 0 }]
      } else {
        group.push({ word: words[i], start: starts[i] ?? 0, end: ends[i] ?? 0 })
      }
    }
    if (group.length) segments.push(this.makeSegment(group))
    return segments
  }

  private makeSegment(group: { word: string; start: number; end: number }[]): TranscriptSegment {
    return {
      start: group[0].start,
      end: group[group.length - 1].end,
      speaker: 'SPEAKER_1',
      text: group.map(w => w.word).join(' '),
      edited: false,
      editedByHuman: false,
    }
  }
}

let _provider: SarvamProvider | null = null
export function getSarvamProvider(): SarvamProvider {
  if (!_provider) _provider = new SarvamProvider()
  return _provider
}
