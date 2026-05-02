import type { TranscriptionProvider, TranscriptionParams, TranscriptionResult, TranscriptSegment } from './types'

// Sarvam AI pricing (pay-as-you-go as of 2025):
// ~₹1.5 per minute of audio = 150 paise/min = 2.5 paise/second
const COST_PAISE_PER_SECOND = 2.5

// Sarvam language codes
const LANG_MAP: Record<string, string> = {
  en: 'en-IN',
  te: 'te-IN',
  mixed: 'te-IN', // use Telugu as primary hint; Sarvam handles code-switching automatically
}

type SarvamWord = {
  word: string
  start: number
  end: number
}

type SarvamSegment = {
  start: number
  end: number
  text: string
  words?: SarvamWord[]
}

type SarvamDiarizationSegment = {
  speaker: string
  start: number
  end: number
}

type SarvamResponse = {
  transcript?: string
  language_code?: string
  // v1 API: time_stamps array
  time_stamps?: Array<{ start_time: number; end_time: number; word: string }>
  // v2 API: segments with optional diarization
  segments?: SarvamSegment[]
  diarization?: { segments?: SarvamDiarizationSegment[] }
  request_id?: string
}

export class SarvamProvider implements TranscriptionProvider {
  readonly name = 'sarvam'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async transcribe(params: TranscriptionParams): Promise<TranscriptionResult> {
    const { audioUrl, language, zeroRetention = false } = params
    const languageCode = LANG_MAP[language] ?? 'te-IN'

    // Sarvam accepts audio_url directly — no need to proxy through Vercel
    const body = JSON.stringify({
      audio_url: audioUrl,
      language_code: languageCode,
      model: 'saaras:v2',
      with_diarization: true,
      with_timestamps: true,
      // Zero-retention opt-in for production:
      // On Sarvam enterprise, setting this prevents audio/transcripts being
      // used for model training. Confirm with Sarvam before going live.
      ...(zeroRetention ? { data_retention: false } : {}),
    })

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': this.apiKey,
      },
      body,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText)
      // If JSON body approach fails (older API that needs multipart), try multipart
      if (res.status === 415 || res.status === 422) {
        return this.transcribeMultipart(params)
      }
      throw new Error(`Sarvam API error ${res.status}: ${errorText}`)
    }

    const raw: SarvamResponse = await res.json()
    const requestId = raw.request_id ?? `sarvam-${Date.now()}`

    const segments = this.parseSegments(raw)
    const fullText = segments.map(s => s.text).join(' ')
    const wordCount = fullText.split(/\s+/).filter(Boolean).length
    const durationSeconds = segments.length > 0 ? segments[segments.length - 1].end : 0

    return {
      segments,
      fullText,
      wordCount,
      language: raw.language_code ?? languageCode,
      rawResponse: raw,
      requestId,
      durationSeconds,
      estimatedCostInrPaise: Math.ceil(durationSeconds * COST_PAISE_PER_SECOND),
    }
  }

  // Fallback: send audio as multipart form data (for Sarvam API versions that
  // don't accept audio_url). Downloads the file server-side — only used as fallback.
  private async transcribeMultipart(params: TranscriptionParams): Promise<TranscriptionResult> {
    const { audioUrl, language } = params
    const languageCode = LANG_MAP[language] ?? 'te-IN'

    // Fetch the audio from R2 presigned URL
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error(`Failed to fetch audio from R2: ${audioRes.status}`)

    const audioBuffer = await audioRes.arrayBuffer()
    const contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg'
    const ext = contentType.includes('mp4') || contentType.includes('m4a') ? 'm4a'
      : contentType.includes('wav') ? 'wav'
      : contentType.includes('webm') ? 'webm'
      : 'mp3'

    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: contentType }), `audio.${ext}`)
    formData.append('language_code', languageCode)
    formData.append('model', 'saaras:v2')
    formData.append('with_diarization', 'true')
    formData.append('with_timestamps', 'true')

    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': this.apiKey },
      body: formData,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText)
      throw new Error(`Sarvam multipart error ${res.status}: ${errorText}`)
    }

    const raw: SarvamResponse = await res.json()
    const requestId = raw.request_id ?? `sarvam-${Date.now()}`
    const segments = this.parseSegments(raw)
    const fullText = segments.map(s => s.text).join(' ')
    const wordCount = fullText.split(/\s+/).filter(Boolean).length
    const durationSeconds = segments.length > 0 ? segments[segments.length - 1].end : 0

    return {
      segments,
      fullText,
      wordCount,
      language: raw.language_code ?? languageCode,
      rawResponse: raw,
      requestId,
      durationSeconds,
      estimatedCostInrPaise: Math.ceil(durationSeconds * COST_PAISE_PER_SECOND),
    }
  }

  // Parse whichever response shape Sarvam returns into our canonical segment format.
  // Merges diarization (speaker labels) with transcript segments.
  private parseSegments(raw: SarvamResponse): TranscriptSegment[] {
    // v2: segments array with diarization
    if (raw.segments && raw.segments.length > 0) {
      const diarSegments = raw.diarization?.segments ?? []

      return raw.segments.map(seg => {
        const speaker = this.speakerAt(seg.start, diarSegments)
        return {
          start: seg.start,
          end: seg.end,
          speaker,
          text: seg.text.trim(),
          edited: false,
          editedByHuman: false,
        }
      })
    }

    // v1: flat transcript with word-level time_stamps — group into ~sentence chunks
    if (raw.time_stamps && raw.time_stamps.length > 0) {
      return this.groupWordsIntoSegments(
        raw.time_stamps.map(w => ({ word: w.word, start: w.start_time, end: w.end_time })),
      )
    }

    // Minimal fallback: single segment from full transcript text
    if (raw.transcript) {
      return [{
        start: 0,
        end: 0,
        speaker: 'SPEAKER_1',
        text: raw.transcript.trim(),
        edited: false,
        editedByHuman: false,
      }]
    }

    return []
  }

  // Find the speaker label active at a given timestamp
  private speakerAt(ts: number, diarSegments: SarvamDiarizationSegment[]): string {
    const match = diarSegments.find(d => ts >= d.start && ts < d.end)
    if (!match) return 'SPEAKER_1'
    // Normalise Sarvam's speaker labels (SPEAKER_00, SPEAKER_01…) to 1-indexed
    const idx = parseInt(match.speaker.replace(/\D/g, ''), 10)
    return `SPEAKER_${isNaN(idx) ? 1 : idx + 1}`
  }

  // Group flat word list into sentence-sized segments (~10-15 words or pause gap > 1s)
  private groupWordsIntoSegments(words: SarvamWord[]): TranscriptSegment[] {
    if (words.length === 0) return []

    const segments: TranscriptSegment[] = []
    let group: SarvamWord[] = [words[0]]

    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1]
      const curr = words[i]
      const gap = curr.start - prev.end
      const endsWithPunct = /[.?!,]$/.test(prev.word)

      if (gap > 1.0 || endsWithPunct || group.length >= 15) {
        segments.push({
          start: group[0].start,
          end: group[group.length - 1].end,
          speaker: 'SPEAKER_1',
          text: group.map(w => w.word).join(' '),
          edited: false,
          editedByHuman: false,
        })
        group = [curr]
      } else {
        group.push(curr)
      }
    }

    if (group.length > 0) {
      segments.push({
        start: group[0].start,
        end: group[group.length - 1].end,
        speaker: 'SPEAKER_1',
        text: group.map(w => w.word).join(' '),
        edited: false,
        editedByHuman: false,
      })
    }

    return segments
  }
}

// Singleton for use in API routes — avoids constructing a new client per request
let _provider: SarvamProvider | null = null
export function getSarvamProvider(): SarvamProvider {
  if (!_provider) {
    const key = process.env.SARVAM_API_KEY
    if (!key) throw new Error('SARVAM_API_KEY env var not set')
    _provider = new SarvamProvider(key)
  }
  return _provider
}
