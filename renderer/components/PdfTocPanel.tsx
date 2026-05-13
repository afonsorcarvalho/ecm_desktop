'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import type { TocEntry, TocResult } from '@/lib/pdf-toc'

interface Props {
  toc: TocResult | null
  loading: boolean
  pageNum: number
  onPageChange: (n: number) => void
}

const MAX_DEPTH = 3
const MAX_CHILDREN_INLINE = 20

export function PdfTocPanel({ toc, loading, pageNum, onPageChange }: Props) {
  const activePage = useMemo(() => {
    if (!toc || !toc.flat.length) return 0
    let best = 0
    for (const e of toc.flat) {
      if (e.page > 0 && e.page <= pageNum && e.page >= best) best = e.page
    }
    return best
  }, [toc, pageNum])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-muted text-xs gap-2 p-4">
        <Loader2 size={14} className="animate-spin" /> Extraindo sumário…
      </div>
    )
  }

  if (!toc || toc.entries.length === 0) {
    return (
      <p className="p-4 text-xs text-ink-dim">
        Sem sumário detectado neste PDF.
      </p>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wide text-ink-dim">
        {toc.source === 'outline' ? 'Sumário do documento' : 'Sumário (inferido)'}
      </div>
      <ul className="px-1 pb-3">
        {toc.entries.map((e, i) => (
          <TocItem
            key={`${i}-${e.title}`}
            entry={e}
            activePage={activePage}
            onPageChange={onPageChange}
            depth={0}
            defaultOpen={true}
          />
        ))}
      </ul>
    </div>
  )
}

interface ItemProps {
  entry: TocEntry
  activePage: number
  onPageChange: (n: number) => void
  depth: number
  defaultOpen: boolean
}

function TocItem({ entry, activePage, onPageChange, depth, defaultOpen }: ItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = entry.children.length > 0
  const truncatedChildren = depth + 1 >= MAX_DEPTH && hasChildren
  const collapsedOverflow = entry.children.length > MAX_CHILDREN_INLINE
  const isActive = entry.page > 0 && entry.page === activePage
  const disabled = entry.page <= 0

  return (
    <li>
      <div
        className={`flex items-start gap-1 rounded text-xs leading-snug
          ${isActive ? 'bg-accent/10 text-accent border-l-2 border-accent' : 'border-l-2 border-transparent'}
          ${disabled ? 'opacity-40 cursor-default' : 'hover:bg-bg-muted cursor-pointer'}`}
        style={{ paddingLeft: depth * 12 + 6 }}
      >
        {hasChildren && !truncatedChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 p-1 -ml-1 text-ink-muted hover:text-ink"
            title={open ? 'Recolher' : 'Expandir'}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="shrink-0 w-[18px]" />
        )}
        <button
          onClick={() => !disabled && onPageChange(entry.page)}
          disabled={disabled}
          className="flex-1 text-left py-1.5 pr-2 truncate"
          title={`${entry.title}${entry.page > 0 ? ` — pág. ${entry.page}` : ''}`}
        >
          <span className="truncate">{entry.title}</span>
        </button>
        {entry.page > 0 && (
          <span className="shrink-0 text-[10px] text-ink-dim pr-2 pt-1.5">{entry.page}</span>
        )}
      </div>

      {hasChildren && open && !truncatedChildren && (
        <ul>
          {entry.children.slice(0, MAX_CHILDREN_INLINE).map((c, i) => (
            <TocItem
              key={`${i}-${c.title}`}
              entry={c}
              activePage={activePage}
              onPageChange={onPageChange}
              depth={depth + 1}
              defaultOpen={depth + 1 <= 1}
            />
          ))}
          {collapsedOverflow && (
            <li
              className="text-[10px] text-ink-dim italic px-2 py-1"
              style={{ paddingLeft: (depth + 1) * 12 + 24 }}
            >
              +{entry.children.length - MAX_CHILDREN_INLINE} itens
            </li>
          )}
        </ul>
      )}

      {truncatedChildren && (
        <p
          className="text-[10px] text-ink-dim italic py-1"
          style={{ paddingLeft: (depth + 1) * 12 + 24 }}
        >
          +{entry.children.length} subitens
        </p>
      )}
    </li>
  )
}
