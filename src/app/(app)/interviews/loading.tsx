export default function InterviewsLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-20">
      <div className="flex items-end justify-between mb-8 gap-4">
        <div className="animate-pulse space-y-2">
          <div className="h-10 w-36 rounded-xl" style={{ background: '#ECE6D9' }} />
          <div className="h-4 w-56 rounded" style={{ background: '#ECE6D9' }} />
        </div>
        <div className="h-10 w-32 rounded-xl animate-pulse" style={{ background: '#ECE6D9' }} />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 animate-pulse">
        {[60, 44, 52, 72, 68, 56].map((w, i) => (
          <div key={i} className="h-7 rounded-full" style={{ background: '#ECE6D9', width: w }} />
        ))}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-5 py-4 rounded-[14px]"
            style={{ border: '1px solid #ECE6D9', opacity: 1 - i * 0.1 }}
          >
            <div className="h-10 w-14 rounded-lg shrink-0" style={{ background: '#E2EEEC' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded" style={{ background: '#ECE6D9' }} />
              <div className="h-3 w-64 rounded" style={{ background: '#ECE6D9' }} />
            </div>
            <div className="h-6 w-20 rounded-full shrink-0" style={{ background: '#ECE6D9' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
