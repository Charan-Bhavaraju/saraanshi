'use client'

import type { SaturationPoint } from '../actions'

// Rolling average over the trailing `window` points (inclusive).
function rollingAvg(counts: number[], window: number): number[] {
  return counts.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = counts.slice(start, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

const W = 720
const H = 260
const PAD = { top: 20, right: 16, bottom: 44, left: 32 }

export default function SaturationTracker({ data }: { data: SaturationPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded-[14px] p-8 text-center max-w-3xl" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
        <p className="text-sm" style={{ color: '#4A5263', lineHeight: 1.6 }}>
          Saturation needs at least two analyzed interviews. Generate insights across more interviews
          and the trend of new focus points per interview will appear here — when it trends toward
          zero, that&apos;s defensible saturation evidence.
        </p>
      </div>
    )
  }

  const counts = data.map(d => d.count)
  const avg = rollingAvg(counts, 3)
  const maxY = Math.max(4, ...counts)

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH

  const line = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const yTicks = Array.from({ length: maxY + 1 }, (_, i) => i).filter(t => maxY <= 8 || t % Math.ceil(maxY / 6) === 0)

  return (
    <div className="max-w-3xl">
      <div className="rounded-[14px] p-5" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          <Legend color="#B8456D" label="New focus points" />
          <Legend color="#0E5C5C" label="3-interview rolling average" />
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
          {/* y gridlines + labels */}
          {yTicks.map(t => (
            <g key={t}>
              <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="#ECE6D9" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#B5BBC4" fontFamily="var(--font-mono)">{t}</text>
            </g>
          ))}

          {/* rolling average (teal) */}
          <polyline points={line(avg)} fill="none" stroke="#0E5C5C" strokeWidth="2" strokeLinejoin="round" />
          {/* actual counts (rose) */}
          <polyline points={line(counts)} fill="none" stroke="#B8456D" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />

          {/* points + x labels */}
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={x(i)} cy={y(counts[i])} r="3" fill="#B8456D" />
              <circle cx={x(i)} cy={y(avg[i])} r="2.5" fill="#0E5C5C" />
              {(data.length <= 16 || i % Math.ceil(data.length / 16) === 0) && (
                <text
                  x={x(i)}
                  y={H - PAD.bottom + 16}
                  textAnchor="end"
                  fontSize="9"
                  fill="#8A929C"
                  fontFamily="var(--font-mono)"
                  transform={`rotate(-45 ${x(i)} ${H - PAD.bottom + 16})`}
                >
                  {d.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <p className="text-xs mt-3" style={{ color: '#8A929C' }}>
        Each point is one analyzed interview in chronological order. As the rolling average flattens
        toward zero, new interviews are surfacing fewer novel focus points — the signal of saturation.
      </p>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ width: 14, height: 3, background: color, borderRadius: 2, display: 'inline-block' }} />
      <span className="text-xs" style={{ color: '#4A5263' }}>{label}</span>
    </div>
  )
}
