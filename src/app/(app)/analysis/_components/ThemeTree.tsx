'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  getThemeCodes,
  updateTheme,
  deleteTheme,
  type ThemeNode,
  type ThemeCodeView,
} from '../actions'

const SWATCHES = ['#0E5C5C', '#B8456D', '#B8842A', '#4A5263', '#3E7C59', '#7A5AA8', '#C2603B', '#2D6E8E']

export default function ThemeTree({ initial }: { initial: ThemeNode[] }) {
  const [themes, setThemes] = useState<ThemeNode[]>(initial)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [codes, setCodes] = useState<ThemeCodeView[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)

  const { roots, childrenOf } = useMemo(() => buildTree(themes), [themes])
  const selected = themes.find(t => t.id === selectedId) ?? null

  async function select(id: string) {
    setSelectedId(id)
    setLoadingCodes(true)
    try {
      setCodes(await getThemeCodes(id))
    } finally {
      setLoadingCodes(false)
    }
  }

  function applyLocal(updated: ThemeNode) {
    setThemes(ts => ts.map(t => (t.id === updated.id ? updated : t)))
  }
  function removeLocal(id: string) {
    setThemes(ts => ts.filter(t => t.id !== id).map(t => (t.parentId === id ? { ...t, parentId: null } : t)))
    if (selectedId === id) { setSelectedId(null); setCodes([]) }
  }

  if (themes.length === 0) {
    return (
      <div className="rounded-[14px] p-8 text-center max-w-3xl" style={{ background: '#FFF8E8', border: '1px solid #F0E4BC' }}>
        <p className="text-sm" style={{ color: '#4A5263', lineHeight: 1.6 }}>
          No themes yet. Promote a suggested cluster, or code a passage in the transcript editor, and
          your themes will appear here as an organizable tree.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
      {/* Tree */}
      <div className="rounded-[14px] p-3" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', alignSelf: 'start' }}>
        {roots.map(node => (
          <ThemeRow key={node.id} node={node} childrenOf={childrenOf} depth={0} selectedId={selectedId} onSelect={select} />
        ))}
      </div>

      {/* Detail */}
      <div>
        {selected ? (
          <ThemeDetail
            key={selected.id}
            theme={selected}
            allThemes={themes}
            childrenOf={childrenOf}
            codes={codes}
            loadingCodes={loadingCodes}
            onSaved={applyLocal}
            onDeleted={removeLocal}
          />
        ) : (
          <div className="rounded-[14px] p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9' }}>
            <p className="text-sm" style={{ color: '#8A929C' }}>Select a theme to see its coded passages and edit it.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ThemeRow({
  node,
  childrenOf,
  depth,
  selectedId,
  onSelect,
}: {
  node: ThemeNode
  childrenOf: Map<string, ThemeNode[]>
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const kids = childrenOf.get(node.id) ?? []
  return (
    <div>
      <button
        onClick={() => onSelect(node.id)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
        style={{
          marginLeft: depth * 14,
          background: selectedId === node.id ? '#E2EEEC' : 'transparent',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: node.color ?? '#B5BBC4', flexShrink: 0 }} />
        <span className="text-sm flex-1 truncate" style={{ color: '#1A1F2C' }}>{node.name}</span>
        <span className="text-xs" style={{ color: '#8A929C', fontFamily: 'var(--font-mono)' }}>{node.codeCount}</span>
      </button>
      {kids.map(k => (
        <ThemeRow key={k.id} node={k} childrenOf={childrenOf} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ThemeDetail({
  theme,
  allThemes,
  childrenOf,
  codes,
  loadingCodes,
  onSaved,
  onDeleted,
}: {
  theme: ThemeNode
  allThemes: ThemeNode[]
  childrenOf: Map<string, ThemeNode[]>
  codes: ThemeCodeView[]
  loadingCodes: boolean
  onSaved: (t: ThemeNode) => void
  onDeleted: (id: string) => void
}) {
  const [name, setName] = useState(theme.name)
  const [definition, setDefinition] = useState(theme.definition ?? '')
  const [color, setColor] = useState(theme.color ?? SWATCHES[0])
  const [parentId, setParentId] = useState<string | null>(theme.parentId)
  const [pending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Exclude self + descendants from parent options to prevent cycles.
  const descendants = useMemo(() => collectDescendants(theme.id, childrenOf), [theme.id, childrenOf])
  const parentOptions = allThemes.filter(t => t.id !== theme.id && !descendants.has(t.id))

  function save() {
    startTransition(async () => {
      await updateTheme(theme.id, { name: name.trim() || theme.name, definition: definition || null, color, parentId })
      onSaved({ ...theme, name: name.trim() || theme.name, definition: definition || null, color, parentId })
    })
  }
  function remove() {
    startTransition(async () => {
      await deleteTheme(theme.id)
      onDeleted(theme.id)
    })
  }

  return (
    <div className="rounded-[14px] p-5" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', opacity: pending ? 0.7 : 1 }}>
      {/* Edit form */}
      <div className="flex flex-col gap-3 pb-5 mb-5" style={{ borderBottom: '1px solid #ECE6D9' }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="text-lg rounded-lg px-3 py-2"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#1A1F2C' }}
        />
        <textarea
          value={definition}
          onChange={e => setDefinition(e.target.value)}
          rows={2}
          placeholder="Definition / inclusion criterion…"
          className="text-sm rounded-lg px-3 py-2 resize-y"
          style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#1A1F2C', lineHeight: 1.5 }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            {SWATCHES.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                style={{
                  width: 20, height: 20, borderRadius: '50%', background: c,
                  border: color === c ? '2px solid #1A1F2C' : '2px solid transparent',
                  outline: color === c ? '1px solid #FFFFFF' : 'none',
                }}
              />
            ))}
          </div>
          <select
            value={parentId ?? ''}
            onChange={e => setParentId(e.target.value || null)}
            className="text-sm rounded-lg px-2.5 py-1.5"
            style={{ background: '#FAF7F2', border: '1px solid #ECE6D9', color: '#1A1F2C' }}
          >
            <option value="">— Top level</option>
            {parentOptions.map(t => (
              <option key={t.id} value={t.id}>Under: {t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={pending} className="text-sm font-medium rounded-lg px-4 py-2" style={{ background: '#0E5C5C', color: '#FAF7F2' }}>Save</button>
          {confirmDelete ? (
            <>
              <button onClick={remove} disabled={pending} className="text-sm rounded-lg px-3 py-2" style={{ background: '#B8456D', color: '#FFFFFF' }}>Confirm delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-sm rounded-lg px-3 py-2" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#8A929C' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-sm rounded-lg px-3 py-2" style={{ background: '#FFFFFF', border: '1px solid #ECE6D9', color: '#B8456D' }}>Delete</button>
          )}
          <span className="text-xs ml-auto" style={{ color: '#8A929C' }}>
            {theme.codeCount} passages · {theme.interviewCount} interview{theme.interviewCount === 1 ? '' : 's'}
            {theme.createdBy === 'cluster' ? ' · from cluster' : ''}
          </span>
        </div>
      </div>

      {/* Coded passages */}
      <h4 className="text-xs font-medium mb-3" style={{ color: '#4A5263', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Coded passages (chronological)
      </h4>
      {loadingCodes ? (
        <p className="text-sm" style={{ color: '#8A929C' }}>Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-sm" style={{ color: '#8A929C' }}>No coded passages yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {codes.map(c => (
            <div key={c.id} className="rounded-lg px-3 py-2.5" style={{ background: '#FAF7F2', border: '1px solid #ECE6D9' }}>
              <div className="flex items-center gap-2 mb-1">
                {c.participantCode && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#E2EEEC', color: '#0E5C5C', fontFamily: 'var(--font-mono)' }}>{c.participantCode}</span>
                )}
                {c.conductedAt && (
                  <span className="text-xs" style={{ color: '#8A929C' }}>{new Date(c.conductedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                )}
              </div>
              {c.excerpt && <p className="text-sm" style={{ color: '#1A1F2C', lineHeight: 1.6 }}>{c.excerpt}</p>}
              {c.memo && <p className="text-xs mt-1" style={{ color: '#8A929C' }}>{c.memo}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function buildTree(themes: ThemeNode[]) {
  const ids = new Set(themes.map(t => t.id))
  const childrenOf = new Map<string, ThemeNode[]>()
  const roots: ThemeNode[] = []
  for (const t of themes) {
    if (t.parentId && ids.has(t.parentId)) {
      const arr = childrenOf.get(t.parentId) ?? []
      arr.push(t)
      childrenOf.set(t.parentId, arr)
    } else {
      roots.push(t)
    }
  }
  return { roots, childrenOf }
}

function collectDescendants(id: string, childrenOf: Map<string, ThemeNode[]>): Set<string> {
  const out = new Set<string>()
  const stack = [...(childrenOf.get(id) ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    out.add(n.id)
    stack.push(...(childrenOf.get(n.id) ?? []))
  }
  return out
}
