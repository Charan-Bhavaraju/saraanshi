import { cn } from '@/lib/utils'
import type { ContactType } from '@/types/database'

const STYLES: Record<ContactType, { bg: string; color: string; label: string }> = {
  hospital:     { bg: '#EFEAF8', color: '#5A3F8F', label: 'Hospital' },
  doctor:       { bg: '#E2EEEC', color: '#0E5C5C', label: 'Doctor' },
  patient:      { bg: '#F7E5EB', color: '#B8456D', label: 'Patient' },
  receptionist: { bg: '#F5F1E9', color: '#4A5263', label: 'Staff' },
  other:        { bg: '#F5F1E9', color: '#4A5263', label: 'Other' },
}

export default function TypePill({
  type,
  className,
}: {
  type: ContactType
  className?: string
}) {
  const { bg, color, label } = STYLES[type] ?? STYLES.other
  return (
    <span
      className={cn(
        'inline-block text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded',
        className,
      )}
      style={{ background: bg, color, letterSpacing: '0.06em', fontSize: 10 }}
    >
      {label}
    </span>
  )
}
