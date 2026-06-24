'use client'

import { useState, useEffect } from 'react'
import {
  loadAllClusters,
  runClustering,
  type ClusteredTypeData,
  type ClusterView,
} from '../objectives-matrix/cluster-actions'
import type { Objective, FindingCategory } from '@/db/schema/analysis'

const OBJECTIVES: { key: Objective; short: string; color: string; bg: string; border: string }[] = [
  { key: 'objective_1', short: 'Early Detection', color: '#92600A', bg: '#FEF3C7', border: '#F0E4BC' },
  { key: 'objective_2', short: 'Diagnosis & Treatment', color: '#065F46', bg: '#D1FAE5', border: '#A7F3D0' },
  { key: 'objective_3', short: 'Continuity & Follow-Up', color: '#1E40AF', bg: '#DBEAFE', border: '#BFDBFE' },
]

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  doctor: { bg: '#E2EEEC', color: '#0E5C5C', label: 'Doctors' },
  patient: { bg: '#FDF0F4', color: '#B8456D', label: 'Patients' },
  survivor: { bg: '#FFF3E0', color: '#B8842A', label: 'Survivors' },
  other: { bg: '#F5F1E9', color: '#8A929C', label: 'Others' },
}

function CountBadge({ count, total }: { count: number; total: number }) {
  const ratio = total > 0 ? count / total : 0
  const bg = ratio >= 0.8 ? '#22C55E' : ratio >= 0.5 ? '#F59E0B' : ratio >= 0.3 ? '#EF4444' : '#D1D5DB'
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: bg, color: '#FFFFFF', fontSize: 10 }}
    >
      {count}/{total}
    </span>
  )
}

function ClusterCard({
  cluster,
}: {
  cluster: ClusterView
}) {
  const [expanded, setExpanded] = useState(false)
  const isFac = cluster.category === 'facilitator'
  const objMeta = OBJECTIVES.find(o => o.key === cluster.objective) ?? OBJECTIVES[0]

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${isFac ? '#BBF7D0' : '#FECACA'}`,
        background: '#FFFFFF',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:opacity-80"
        style={{ background: isFac ? '#F0FDF4' : '#FEF2F2' }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: isFac ? '#22C55E' : '#EF4444',
            flexShrink: 0,
          }}
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium" style={{ color: isFac ? '#166534' : '#991B1B' }}>
            {cluster.clusterName}
          </span>
        </div>
        <CountBadge count={cluster.interviewCount} total={cluster.totalInterviews} />
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ background: objMeta.bg, color: objMeta.color, border: `1px solid ${objMeta.border}`, fontSize: 9 }}
        >
          {objMeta.short}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: '#8A929C' }}
        >
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded: individual findings */}
      {expanded && (
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${isFac ? '#BBF7D0' : '#FECACA'}` }}>
          {cluster.findings.map(f => (
            <div key={f.id} className="flex items-start gap-2">
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded shrink-0"
                style={{ background: '#E2EEEC', color: '#0E5C5C', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              >
                {f.participantCode ?? f.interviewId.slice(0, 8)}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs" style={{ color: '#4A5263' }}>{f.label}</span>
                {f.excerpt && (
                  <span className="block text-xs italic mt-0.5" style={{ color: '#8A929C' }}>
                    &ldquo;{f.excerpt}&rdquo;
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TypeSection({
  data,
  onRecluster,
  clustering,
}: {
  data: ClusteredTypeData
  onRecluster: (type: string) => void
  clustering: boolean
}) {
  const typeCfg = TYPE_COLORS[data.type] ?? TYPE_COLORS.other
  const [selectedObjective, setSelectedObjective] = useState<Objective | 'all'>('all')

  const filteredClusters = selectedObjective === 'all'
    ? data.clusters
    : data.clusters.filter(c => c.objective === selectedObjective)

  // Sort: most-mentioned first
  const sortedClusters = [...filteredClusters].sort((a, b) => b.interviewCount - a.interviewCount)

  // Split by category
  const facilitators = sortedClusters.filter(c => c.category === 'facilitator')
  const barriers = sortedClusters.filter(c => c.category === 'barrier')

  return (
    <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid #ECE6D9' }}>
      {/* Type header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: typeCfg.bg, borderBottom: '1px solid #ECE6D9' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold" style={{ color: typeCfg.color }}>
            {typeCfg.label}
          </span>
          <span className="text-xs" style={{ color: '#8A929C' }}>
            {data.totalInterviews} interview{data.totalInterviews !== 1 ? 's' : ''}
          </span>
          {data.run && (
            <span className="text-xs" style={{ color: '#B5BBC4' }}>
              · {data.run.clusterCount} clusters from {data.run.findingCount} findings
            </span>
          )}
        </div>
        <button
          onClick={() => onRecluster(data.type)}
          disabled={clustering}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          style={{ background: typeCfg.color, color: '#FFFFFF' }}
        >
          {clustering ? (
            <>
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Clustering…
            </>
          ) : data.clusters.length > 0 ? (
            <>Re-cluster</>
          ) : (
            <>Cluster objectives</>
          )}
        </button>
      </div>

      {data.clusters.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm" style={{ color: '#8A929C' }}>
            No clusters yet. Click &ldquo;Cluster objectives&rdquo; to group similar findings across all {typeCfg.label.toLowerCase()} interviews.
          </p>
        </div>
      ) : (
        <div className="p-4">
          {/* Objective filter */}
          <div className="flex items-center gap-1.5 mb-4">
            <button
              onClick={() => setSelectedObjective('all')}
              className="px-2.5 py-1 text-xs rounded-md transition-all"
              style={{
                background: selectedObjective === 'all' ? '#1A1F2C' : '#F5F1E9',
                color: selectedObjective === 'all' ? '#FFFFFF' : '#8A929C',
                fontWeight: selectedObjective === 'all' ? 500 : 400,
              }}
            >
              All
            </button>
            {OBJECTIVES.map(obj => (
              <button
                key={obj.key}
                onClick={() => setSelectedObjective(obj.key)}
                className="px-2.5 py-1 text-xs rounded-md transition-all"
                style={{
                  background: selectedObjective === obj.key ? obj.bg : '#F5F1E9',
                  color: selectedObjective === obj.key ? obj.color : '#8A929C',
                  fontWeight: selectedObjective === obj.key ? 500 : 400,
                  border: selectedObjective === obj.key ? `1px solid ${obj.border}` : '1px solid transparent',
                }}
              >
                {obj.short}
              </button>
            ))}
          </div>

          {/* Two-column layout: facilitators | barriers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Facilitators */}
            <div>
              <h4
                className="text-xs font-medium mb-2 uppercase"
                style={{ color: '#166534', letterSpacing: '0.06em', fontSize: 10 }}
              >
                + Facilitators ({facilitators.length})
              </h4>
              <div className="flex flex-col gap-2">
                {facilitators.length === 0 ? (
                  <p className="text-xs" style={{ color: '#D1D5DB' }}>None for this filter</p>
                ) : (
                  facilitators.map(c => <ClusterCard key={c.id} cluster={c} />)
                )}
              </div>
            </div>

            {/* Barriers */}
            <div>
              <h4
                className="text-xs font-medium mb-2 uppercase"
                style={{ color: '#991B1B', letterSpacing: '0.06em', fontSize: 10 }}
              >
                − Barriers ({barriers.length})
              </h4>
              <div className="flex flex-col gap-2">
                {barriers.length === 0 ? (
                  <p className="text-xs" style={{ color: '#D1D5DB' }}>None for this filter</p>
                ) : (
                  barriers.map(c => <ClusterCard key={c.id} cluster={c} />)
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────

export default function ClusteredObjectivesView() {
  const [allData, setAllData] = useState<ClusteredTypeData[]>([])
  const [loading, setLoading] = useState(true)
  const [clusteringType, setClusteringType] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    loadAllClusters().then(d => {
      setAllData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function handleCluster(type: string) {
    setClusteringType(type)
    try {
      const result = await runClustering(type)
      setAllData(prev => {
        const next = prev.filter(d => d.type !== type)
        next.push(result)
        // Keep consistent order
        const order = ['doctor', 'patient', 'survivor', 'other']
        next.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
        return next
      })
    } catch (err) {
      console.error('Clustering failed:', err)
    } finally {
      setClusteringType(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 justify-center">
        <svg className="animate-spin" width="20" height="20" viewBox="0 0 32 32" fill="none" style={{ color: '#0E5C5C' }}>
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
          <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-sm" style={{ color: '#8A929C' }}>Loading clustered objectives…</span>
      </div>
    )
  }

  if (allData.length === 0) {
    return (
      <div className="rounded-[14px] p-8 text-center" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
        <p className="text-sm" style={{ color: '#4A5263' }}>
          No interviews with objective findings found. Generate objectives for your interviews first.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1A1F2C' }}>
            Clustered Objectives Overview
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#8A929C' }}>
            Semantically similar findings grouped together across interviews, by participant type.
            Counts show how many interviews mention each cluster.
          </p>
        </div>
        <a
          href="/api/interviews/export-objectives?mode=clustered"
          download
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-all"
          style={{ background: '#0E5C5C', color: '#FFFFFF' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3 5l3 4 3-4M1.5 10h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export CSV
        </a>
      </div>

      {/* Per-type sections */}
      {allData.map(d => (
        <TypeSection
          key={d.type}
          data={d}
          onRecluster={handleCluster}
          clustering={clusteringType === d.type}
        />
      ))}
    </div>
  )
}
