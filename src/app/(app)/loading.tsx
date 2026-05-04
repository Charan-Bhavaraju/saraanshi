export default function AppLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-xl" style={{ background: '#ECE6D9' }} />
        <div className="h-4 w-72 rounded-lg" style={{ background: '#ECE6D9' }} />
        <div className="mt-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-[14px]" style={{ background: '#ECE6D9', opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
