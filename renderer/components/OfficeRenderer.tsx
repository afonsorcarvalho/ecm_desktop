'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, FileWarning } from 'lucide-react'

type OfficeKind = 'docx' | 'xlsx'

interface Props {
  url: string
  kind: OfficeKind
}

interface SheetData {
  name: string
  html: string
}

export function OfficeRenderer({ url, kind }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheets, setSheets] = useState<SheetData[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const docxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setSheets([])
    setActiveSheet(0)

    async function render() {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const buf = await resp.arrayBuffer()
        if (cancelled) return

        if (kind === 'docx') {
          const { renderAsync } = await import('docx-preview')
          if (cancelled || !docxRef.current) return
          docxRef.current.innerHTML = ''
          await renderAsync(buf, docxRef.current, undefined, {
            className: 'docx-preview',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            experimental: true,
          })
        } else {
          const XLSX = await import('xlsx')
          const wb = XLSX.read(buf, { type: 'array' })
          const out: SheetData[] = wb.SheetNames.map((name) => ({
            name,
            html: XLSX.utils.sheet_to_html(wb.Sheets[name], { id: 'xlsx-sheet' }),
          }))
          if (cancelled) return
          setSheets(out)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Falha ao renderizar documento')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    render()
    return () => { cancelled = true }
  }, [url, kind])

  if (error) {
    return (
      <div className="m-auto text-center text-ink-muted">
        <FileWarning size={32} className="mx-auto mb-2 text-amber-400" />
        <p className="text-sm">Não foi possível renderizar o documento.</p>
        <p className="text-xs text-ink-dim mt-1">{error}</p>
        <p className="text-xs text-ink-dim mt-1">Use "Baixar" para abrir no app nativo.</p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full overflow-auto bg-white">
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-bg/60 z-10">
          <span className="flex items-center gap-2 text-ink-muted">
            <Loader2 size={18} className="animate-spin" /> Renderizando…
          </span>
        </div>
      )}

      {kind === 'docx' && (
        <div ref={docxRef} className="office-docx mx-auto py-4" />
      )}

      {kind === 'xlsx' && sheets.length > 0 && (
        <div className="flex flex-col h-full">
          {sheets.length > 1 && (
            <div className="flex gap-0.5 border-b border-gray-300 bg-gray-100 shrink-0 overflow-x-auto">
              {sheets.map((s, i) => (
                <button
                  key={s.name}
                  onClick={() => setActiveSheet(i)}
                  className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                    i === activeSheet
                      ? 'bg-white text-gray-900 border-b-2 border-emerald-500 font-medium'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div
            className="office-xlsx flex-1 overflow-auto p-2 text-gray-900 text-xs"
            dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html || '' }}
          />
        </div>
      )}
    </div>
  )
}
