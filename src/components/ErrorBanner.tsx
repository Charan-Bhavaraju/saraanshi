'use client'

export default function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={{ background: '#FDF0F4', border: '1px solid #F0C8D4', color: '#B8456D' }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
        <path
          d="M8 5v4M8 11h.01M2.5 13.5l5.5-10 5.5 10H2.5z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="flex-1 leading-relaxed">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  )
}
