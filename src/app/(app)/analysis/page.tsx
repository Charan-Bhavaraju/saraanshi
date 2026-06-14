import {
  getCachedSuggestedThemes,
  getClusterStatus,
  getThemes,
  getSaturationData,
} from './actions'
import AnalysisWorkspace from './_components/AnalysisWorkspace'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage() {
  const [suggestions, status, themes, saturation] = await Promise.all([
    getCachedSuggestedThemes(),
    getClusterStatus(),
    getThemes(),
    getSaturationData(),
  ])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
      <div className="mb-6">
        <h1
          className="text-3xl tracking-tight"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, letterSpacing: '-0.02em' }}
        >
          Analysis
        </h1>
        <p className="text-sm mt-1" style={{ color: '#8A929C' }}>
          Cross-interview theme discovery. Focus points cluster by meaning — you decide what becomes a theme.
        </p>
      </div>

      {/* Desktop-only notice */}
      <div
        className="md:hidden rounded-[14px] p-6 text-center"
        style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}
      >
        <p className="text-sm" style={{ color: '#4A5263', lineHeight: 1.6 }}>
          The analysis workspace is built for a larger screen. Open Saaranshi on your laptop to
          cluster themes, review coded passages, and track saturation.
        </p>
      </div>

      <div className="hidden md:block">
        <AnalysisWorkspace
          initialSuggestions={suggestions}
          status={status}
          themes={themes}
          saturation={saturation}
        />
      </div>
    </div>
  )
}
