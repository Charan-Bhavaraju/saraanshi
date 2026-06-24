'use client'

import { useState, useEffect } from 'react'
import {
  loadAllClusters,
  runClustering,
  type ClusteredTypeData,
  type ClusterView,
} from '../objectives-matrix/cluster-actions'
import type { Objective } from '@/db/schema/analysis'

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

// ─── Compact cluster row (table-like) ───────────────────────────────────

function ClusterRow({ cluster }: { cluster: ClusterView }) {
  const [open, setOpen] = useState(false)
  const isFac = cluster.category === 'facilitator'
  const ratio = cluster.totalInterviews > 0 ? cluster.interviewCount / cluster.totalInterviews : 0
  const badgeBg = ratio >= 0.8 ? '#22C55E' : ratio >= 0.5 ? '#F59E0B' : ratio >= 0.3 ? '#EF4444' : '#D1D5DB'

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        className="transition-all cursor-pointer"
        style={{ background: open ? (isFac ? '#F0FDF4' : '#FEF2F2') : undefined }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = '' }}
      >
        <td className="py-2 px-3 text-xs" style={{ color: '#4A5263', width: '45%' }}>
          <div className="flex items-center gap-2">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFac ? '#22C55E' : '#EF4444', flexShrink: 0 }} />
            <span className="font-medium">{cluster.clusterName}</span>
          </div>
        </td>
        <td className="py-2 px-3 text-center" style={{ width: '15%' }}>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: badgeBg, color: '#FFF', fontSize: 10 }}>
            {cluster.interviewCount}/{cluster.totalInterviews}
          </span>
        </td>
        <td className="py-2 px-3 text-center" style={{ width: '15%' }}>
          <span className="text-xs" style={{ color: isFac ? '#166534' : '#991B1B', fontWeight: 500, fontSize: 10 }}>
            {isFac ? 'Facilitator' : 'Barrier'}
          </span>
        </td>
        <td className="py-2 px-3 text-xs text-right" style={{ color: '#B5BBC4', width: '10%' }}>
          {cluster.findings.length}
        </td>
        <td className="py-2 px-2 text-right" style={{ width: '5%' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: '#B5BBC4' }}>
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="px-3 pb-3 pt-1">
            <div className="rounded-lg p-3 flex flex-col gap-1.5" style={{ background: '#FAF7F2', border: '1px solid #ECE6D9' }}>
              {cluster.findings.map(f => (
                <div key={f.id} className="flex items-start gap-2">
                  <span className="text-xs font-medium px-1 py-0.5 rounded shrink-0" style={{ background: '#E2EEEC', color: '#0E5C5C', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    {f.participantCode ?? f.interviewId.slice(0, 6)}
                  </span>
                  <span className="text-xs" style={{ color: '#4A5263' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Collapsible type accordion ─────────────────────────────────────────

function TypeAccordion({
  data,
  isOpen,
  onToggle,
  onRecluster,
  clustering,
}: {
  data: ClusteredTypeData
  isOpen: boolean
  onToggle: () => void
  onRecluster: (type: string) => void
  clustering: boolean
}) {
  const typeCfg = TYPE_COLORS[data.type] ?? TYPE_COLORS.other
  const [objFilter, setObjFilter] = useState<Objective | 'all'>('all')
  const [catFilter, setCatFilter] = useState<'all' | 'facilitator' | 'barrier'>('all')

  const filtered = data.clusters
    .filter(c => objFilter === 'all' || c.objective === objFilter)
    .filter(c => catFilter === 'all' || c.category === catFilter)
    .sort((a, b) => b.interviewCount - a.interviewCount)

  const facCount = data.clusters.filter(c => c.category === 'facilitator').length
  const barCount = data.clusters.filter(c => c.category === 'barrier').length

  return (
    <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid #ECE6D9' }}>
      {/* Accordion header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 text-left transition-all"
        style={{ background: typeCfg.bg }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold" style={{ color: typeCfg.color }}>{typeCfg.label}</span>
          <span className="text-xs" style={{ color: '#8A929C' }}>{data.totalInterviews} interviews</span>
          {data.run && (
            <span className="text-xs" style={{ color: '#B5BBC4' }}>
              · {data.run.clusterCount} clusters
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.clusters.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#22C55E20', color: '#166534', fontSize: 10 }}>
              +{facCount}
            </span>
          )}
          {data.clusters.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#EF444420', color: '#991B1B', fontSize: 10 }}>
              −{barCount}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', color: '#8A929C' }}>
            <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div style={{ borderTop: '1px solid #ECE6D9' }}>
          {data.clusters.length === 0 ? (
            <div className="px-5 py-6 flex items-center justify-between">
              <p className="text-xs" style={{ color: '#8A929C' }}>No clusters yet.</p>
              <button
                onClick={(e) => { e.stopPropagation(); onRecluster(data.type) }}
                disabled={clustering}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
                style={{ background: typeCfg.color, color: '#FFFFFF' }}
              >
                {clustering ? 'Clustering…' : 'Cluster objectives'}
              </button>
            </div>
          ) : (
            <>
              {/* Filter bar */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#FAF7F2', borderBottom: '1px solid #ECE6D9' }}>
                <div className="flex items-center gap-1.5">
                  {/* Objective filter */}
                  <select
                    value={objFilter}
                    onChange={e => setObjFilter(e.target.value as Objective | 'all')}
                    className="text-xs rounded-md px-2 py-1"
                    style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
                  >
                    <option value="all">All objectives</option>
                    {OBJECTIVES.map(o => <option key={o.key} value={o.key}>{o.short}</option>)}
                  </select>
                  {/* Category filter */}
                  <select
                    value={catFilter}
                    onChange={e => setCatFilter(e.target.value as 'all' | 'facilitator' | 'barrier')}
                    className="text-xs rounded-md px-2 py-1"
                    style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#4A5263' }}
                  >
                    <option value="all">All types</option>
                    <option value="facilitator">Facilitators</option>
                    <option value="barrier">Barriers</option>
                  </select>
                  <span className="text-xs ml-2" style={{ color: '#B5BBC4' }}>{filtered.length} clusters</span>
                </div>
                <button
                  onClick={() => onRecluster(data.type)}
                  disabled={clustering}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md disabled:opacity-40"
                  style={{ background: typeCfg.color, color: '#FFFFFF' }}
                >
                  {clustering ? (
                    <>
                      <svg className="animate-spin" width="10" height="10" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                        <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Clustering…
                    </>
                  ) : 'Re-cluster'}
                </button>
              </div>

              {/* Table */}
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ECE6D9' }}>
                      <th className="text-left text-xs font-medium py-2 px-3 uppercase" style={{ color: '#8A929C', fontSize: 9, letterSpacing: '0.06em' }}>Cluster</th>
                      <th className="text-center text-xs font-medium py-2 px-3 uppercase" style={{ color: '#8A929C', fontSize: 9, letterSpacing: '0.06em' }}>Coverage</th>
                      <th className="text-center text-xs font-medium py-2 px-3 uppercase" style={{ color: '#8A929C', fontSize: 9, letterSpacing: '0.06em' }}>Type</th>
                      <th className="text-right text-xs font-medium py-2 px-3 uppercase" style={{ color: '#8A929C', fontSize: 9, letterSpacing: '0.06em' }}>Findings</th>
                      <th style={{ width: 28 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => <ClusterRow key={c.id} cluster={c} />)}
                  </tbody>
                </table>
              </div>
            </>
          )}
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
  const [openType, setOpenType] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    loadAllClusters().then(d => {
      setAllData(d)
      // Auto-open first type that has clusters
      const first = d.find(t => t.clusters.length > 0)
      if (first) setOpenType(first.type)
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
        const order = ['doctor', 'patient', 'survivor', 'other']
        next.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
        return next
      })
      setOpenType(type)
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
    <div className="flex flex-col gap-3">
      {/* Compact header */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: '#8A929C' }}>
          Semantically similar findings clustered across interviews. Click a row to expand.
        </p>
        <a
          href="/api/interviews/export-objectives?mode=clustered"
          download
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{ background: '#0E5C5C', color: '#FFFFFF' }}
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3 5l3 4 3-4M1.5 10h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Export CSV
        </a>
      </div>

      {/* Type accordions */}
      {allData.map(d => (
        <TypeAccordion
          key={d.type}
          data={d}
          isOpen={openType === d.type}
          onToggle={() => setOpenType(prev => prev === d.type ? null : d.type)}
          onRecluster={handleCluster}
          clustering={clusteringType === d.type}
        />
      ))}
    </div>
  )
}
