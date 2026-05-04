export default function InterviewDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
      {/* Back link */}
      <div className="h-4 w-20 rounded mb-6 animate-pulse" style={{ background: '#ECE6D9' }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 animate-pulse">
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-lg" style={{ background: '#ECE6D9' }} />
            <div className="h-7 w-20 rounded-lg" style={{ background: '#ECE6D9' }} />
          </div>
          <div className="h-9 w-64 rounded-xl" style={{ background: '#ECE6D9' }} />
          <div className="h-4 w-48 rounded" style={{ background: '#ECE6D9' }} />
        </div>
        <div className="h-9 w-24 rounded-xl" style={{ background: '#ECE6D9' }} />
      </div>

      {/* Metadata strip */}
      <div
        className="flex gap-6 mb-6 px-5 py-3 rounded-xl animate-pulse"
        style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}
      >
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-12 rounded" style={{ background: '#ECE6D9' }} />
            <div className="h-4 w-16 rounded" style={{ background: '#ECE6D9' }} />
          </div>
        ))}
      </div>

      {/* Viewer skeleton */}
      <div
        className="rounded-[14px] overflow-hidden animate-pulse"
        style={{ border: '1px solid #ECE6D9', height: 480 }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1fr_1.5fr_1fr] h-full">
          <div className="p-5" style={{ background: '#F5F1E9', borderRight: '1px solid #ECE6D9' }}>
            <div className="h-3 w-10 rounded mb-4" style={{ background: '#DDD4C2' }} />
            <div className="h-16 rounded-xl" style={{ background: '#DDD4C2' }} />
            <div className="flex justify-center gap-3 mt-5">
              <div className="h-9 w-12 rounded-lg" style={{ background: '#DDD4C2' }} />
              <div className="h-12 w-12 rounded-full" style={{ background: '#DDD4C2' }} />
              <div className="h-9 w-12 rounded-lg" style={{ background: '#DDD4C2' }} />
            </div>
          </div>
          <div className="p-5" style={{ borderRight: '1px solid #ECE6D9' }}>
            <div className="h-3 w-16 rounded mb-4" style={{ background: '#ECE6D9' }} />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="mb-3">
                <div className="h-3 w-24 rounded mb-1" style={{ background: '#ECE6D9', opacity: 1 - i * 0.1 }} />
                <div className="h-4 w-full rounded" style={{ background: '#ECE6D9', opacity: 1 - i * 0.1 }} />
              </div>
            ))}
          </div>
          <div className="hidden xl:block p-5" style={{ background: '#FDFCF9' }}>
            <div className="h-3 w-14 rounded mb-4" style={{ background: '#ECE6D9' }} />
          </div>
        </div>
      </div>
    </div>
  )
}
