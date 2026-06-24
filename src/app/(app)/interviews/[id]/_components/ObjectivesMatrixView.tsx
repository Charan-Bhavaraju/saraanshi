'use client'

import { useState, useEffect } from 'react'
import { loadObjectivesMatrix, type ObjectivesMatrixData, type MatrixInterview, type MatrixFinding } from '../../objectives-matrix/actions'
import type { Objective, FindingCategory } from '@/db/schema/analysis'

type Props = {
  interviewId: string
  singleInterview?: boolean
}

const OBJECTIVES: { key: Objective; label: string; short: string; color: string; bg: string; border: string }[] = [
  { key: 'objective_1', label: 'Obj 1 — Early Detection', short: 'Early Detection', color: '#92600A', bg: '#FEF3C7', border: '#F0E4BC' },
  { key: 'objective_2', label: 'Obj 2 — Diagnosis & Treatment', short: 'Diagnosis & Treatment', color: '#065F46', bg: '#D1FAE5', border: '#A7F3D0' },
  { key: 'objective_3', label: 'Obj 3 — Continuity & Follow-Up', short: 'Continuity & Follow-Up', color: '#1E40AF', bg: '#DBEAFE', border: '#BFDBFE' },
]

const TYPE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  patient: { bg: '#FDF0F4', color: '#B8456D', label: 'Patient' },
  doctor: { bg: '#E2EEEC', color: '#0E5C5C', label: 'Doctor' },
  survivor: { bg: '#FFF3E0', color: '#B8842A', label: 'Survivor' },
  other: { bg: '#F5F1E9', color: '#8A929C', label: 'Other' },
}

function getFindings(
  findings: MatrixFinding[],
  objective: Objective,
  category: FindingCategory,
): MatrixFinding[] {
  return findings.filter(f => f.objective === objective && f.category === category)
}

// ─── Editable label chip ────────────────────────────────────────────────

function FindingChip({
  finding,
  category,
  onRemove,
}: {
  finding: MatrixFinding
  category: FindingCategory
  onRemove: (id: string) => void
}) {
  const [showFull, setShowFull] = useState(false)
  const isFac = category === 'facilitator'

  return (
    <div
      className="group relative flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs leading-relaxed transition-all"
      style={{
        background: isFac ? '#F0FDF4' : '#FEF2F2',
        border: `1px solid ${isFac ? '#BBF7D0' : '#FECACA'}`,
        color: isFac ? '#166534' : '#991B1B',
      }}
    >
      <span
        style={{
          width: 5, height: 5, borderRadius: '50%',
          background: isFac ? '#22C55E' : '#EF4444',
          flexShrink: 0, marginTop: 4,
        }}
      />
      <span
        className="flex-1 cursor-default"
        onClick={() => setShowFull(f => !f)}
        title={finding.excerpt ?? finding.rationale ?? undefined}
      >
        {finding.label}
        {showFull && finding.excerpt && (
          <span className="block mt-1 text-xs italic" style={{ color: '#6B7280', fontWeight: 400 }}>
            &ldquo;{finding.excerpt}&rdquo;
          </span>
        )}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(finding.id) }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded p-0.5"
        style={{ color: isFac ? '#166534' : '#991B1B' }}
        title="Remove from view"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

// ─── Cell for one objective × category within an interview row ──────────

function MatrixCell({
  findings,
  category,
  onRemove,
  objColor,
}: {
  findings: MatrixFinding[]
  category: FindingCategory
  onRemove: (id: string) => void
  objColor: string
}) {
  if (findings.length === 0) {
    return (
      <div className="px-3 py-3 text-center">
        <span className="text-xs" style={{ color: '#D1D5DB' }}>—</span>
      </div>
    )
  }

  return (
    <div className="px-2.5 py-2.5 flex flex-col gap-1.5">
      {findings.map(f => (
        <FindingChip key={f.id} finding={f} category={category} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────

export default function ObjectivesMatrixView({ interviewId, singleInterview }: Props) {
  const [data, setData] = useState<ObjectivesMatrixData | null>(null)
  const [loading, setLoading] = useState(true)
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    loadObjectivesMatrix().then(d => {
      setData(d)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function handleRemove(id: string) {
    setRemovedIds(prev => new Set([...prev, id]))
  }

  function handleRestore() {
    setRemovedIds(new Set())
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8">
        <svg className="animate-spin" width="20" height="20" viewBox="0 0 32 32" fill="none" style={{ color: '#0E5C5C' }}>
          <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
          <path d="M16 3a13 13 0 0 1 13 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-sm" style={{ color: '#8A929C' }}>Loading objectives matrix…</span>
      </div>
    )
  }

  if (!data || data.interviews.length === 0) {
    return (
      <div className="rounded-[14px] p-6 text-center" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
        <p className="text-sm" style={{ color: '#4A5263' }}>
          No objective findings generated yet. Generate objectives for interviews first, then come back to see the matrix view.
        </p>
      </div>
    )
  }

  // Filter out interviews to show: if singleInterview mode, only show current
  const interviewsToShow = singleInterview
    ? data.interviews.filter(iv => iv.id === interviewId)
    : data.interviews

  // Group by type
  const byType = new Map<string, MatrixInterview[]>()
  for (const iv of interviewsToShow) {
    const list = byType.get(iv.type) ?? []
    list.push(iv)
    byType.set(iv.type, list)
  }
  const typeOrder = ['doctor', 'patient', 'survivor', 'other']
  const sortedTypes = typeOrder.filter(t => byType.has(t))

  // Filter findings by removed
  function filterFindings(findings: MatrixFinding[]): MatrixFinding[] {
    return findings.filter(f => !removedIds.has(f.id))
  }

  const exportUrl = singleInterview
    ? `/api/interviews/export-objectives?interviewId=${interviewId}`
    : '/api/interviews/export-objectives'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium" style={{ color: '#1A1F2C' }}>
            Objectives Matrix
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F5F1E9', color: '#8A929C' }}>
            {interviewsToShow.length} interview{interviewsToShow.length !== 1 ? 's' : ''}
          </span>
          {removedIds.size > 0 && (
            <button
              onClick={handleRestore}
              className="text-xs px-2 py-0.5 rounded-md transition-all"
              style={{ background: '#FEF3C7', color: '#92600A', border: '1px solid #F0E4BC' }}
            >
              Restore {removedIds.size} removed
            </button>
          )}
        </div>
        <a
          href={exportUrl}
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

      {/* Matrix table */}
      <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid #ECE6D9' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 900, borderCollapse: 'collapse' }}>
            {/* Header row 1: Objective names */}
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="text-left text-xs font-medium px-4 py-2.5 sticky left-0 z-10"
                  style={{ background: '#FAF7F2', color: '#4A5263', borderBottom: '1px solid #ECE6D9', borderRight: '1px solid #ECE6D9', minWidth: 140 }}
                >
                  Participant
                </th>
                {OBJECTIVES.map(obj => (
                  <th
                    key={obj.key}
                    colSpan={2}
                    className="text-center text-xs font-medium px-3 py-2"
                    style={{ background: obj.bg, color: obj.color, borderBottom: `1px solid ${obj.border}`, borderRight: '1px solid #ECE6D9' }}
                  >
                    {obj.short}
                  </th>
                ))}
              </tr>
              {/* Header row 2: Facilitators / Barriers */}
              <tr>
                {OBJECTIVES.map(obj => (
                  <>
                    <th
                      key={`${obj.key}_fac`}
                      className="text-center text-xs px-3 py-1.5"
                      style={{
                        background: '#F0FDF4',
                        color: '#166534',
                        borderBottom: '1px solid #ECE6D9',
                        borderRight: '1px solid #F0F0F0',
                        fontWeight: 500,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      + Facilitators
                    </th>
                    <th
                      key={`${obj.key}_bar`}
                      className="text-center text-xs px-3 py-1.5"
                      style={{
                        background: '#FEF2F2',
                        color: '#991B1B',
                        borderBottom: '1px solid #ECE6D9',
                        borderRight: '1px solid #ECE6D9',
                        fontWeight: 500,
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      − Barriers
                    </th>
                  </>
                ))}
              </tr>
            </thead>

            <tbody>
              {sortedTypes.map(type => {
                const typeIvs = byType.get(type) ?? []
                const typeCfg = TYPE_COLORS[type] ?? TYPE_COLORS.other

                return (
                  <>
                    {/* Type group header */}
                    <tr key={`group-${type}`}>
                      <td
                        colSpan={1 + OBJECTIVES.length * 2}
                        className="px-4 py-2"
                        style={{ background: typeCfg.bg, borderBottom: '1px solid #ECE6D9' }}
                      >
                        <span className="text-xs font-medium" style={{ color: typeCfg.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {typeCfg.label}s ({typeIvs.length})
                        </span>
                      </td>
                    </tr>

                    {typeIvs.map(iv => {
                      const filtered = filterFindings(iv.findings)
                      return (
                        <tr
                          key={iv.id}
                          style={{ borderBottom: '1px solid #F5F1E9' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAF8' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                        >
                          {/* Participant cell */}
                          <td
                            className="px-4 py-3 align-top sticky left-0 z-10"
                            style={{ background: 'inherit', borderRight: '1px solid #ECE6D9', minWidth: 140 }}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded inline-block w-fit"
                                style={{ background: '#E2EEEC', color: '#0E5C5C', fontFamily: 'var(--font-mono)' }}
                              >
                                {iv.participantCode ?? iv.id.slice(0, 8)}
                              </span>
                              {iv.contactName && (
                                <span className="text-xs" style={{ color: '#8A929C' }}>{iv.contactName}</span>
                              )}
                            </div>
                          </td>

                          {/* Objective cells */}
                          {OBJECTIVES.map(obj => (
                            <>
                              <td
                                key={`${iv.id}_${obj.key}_fac`}
                                className="align-top"
                                style={{ borderRight: '1px solid #F5F1E9', verticalAlign: 'top' }}
                              >
                                <MatrixCell
                                  findings={getFindings(filtered, obj.key, 'facilitator')}
                                  category="facilitator"
                                  onRemove={handleRemove}
                                  objColor={obj.color}
                                />
                              </td>
                              <td
                                key={`${iv.id}_${obj.key}_bar`}
                                className="align-top"
                                style={{ borderRight: '1px solid #ECE6D9', verticalAlign: 'top' }}
                              >
                                <MatrixCell
                                  findings={getFindings(filtered, obj.key, 'barrier')}
                                  category="barrier"
                                  onRemove={handleRemove}
                                  objColor={obj.color}
                                />
                              </td>
                            </>
                          ))}
                        </tr>
                      )
                    })}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
