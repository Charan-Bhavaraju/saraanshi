import type { InterviewStatus } from '@/types/database'

const CONFIG: Record<InterviewStatus, { label: string; bg: string; color: string; pulse?: boolean }> = {
  draft:        { label: 'Draft',        bg: '#F5F1E9', color: '#8A929C' },
  created:      { label: 'No audio',     bg: '#F5F1E9', color: '#8A929C' },
  uploading:    { label: 'Uploading',    bg: '#F5EBD3', color: '#B8842A', pulse: true },
  uploaded:     { label: 'Audio ready',  bg: '#F5EBD3', color: '#B8842A' },
  transcribing: { label: 'Transcribing', bg: '#F5EBD3', color: '#B8842A', pulse: true },
  transcribed:  { label: 'Transcribed',  bg: '#E2EEEC', color: '#0E5C5C' },
  reviewed:     { label: 'Reviewed',     bg: '#E0E5DA', color: '#4A5C3A' },
  analyzed:     { label: 'Analyzed',     bg: '#EFEAF8', color: '#5A3F8F' },
}

export default function StatusBadge({ status }: { status: InterviewStatus }) {
  const cfg = CONFIG[status] ?? CONFIG.draft
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full uppercase"
      style={{ background: cfg.bg, color: cfg.color, letterSpacing: '0.04em', fontSize: 10 }}
    >
      {cfg.pulse && (
        <span
          className="inline-block rounded-full animate-pulse shrink-0"
          style={{ width: 6, height: 6, background: cfg.color }}
        />
      )}
      {cfg.label}
    </span>
  )
}
