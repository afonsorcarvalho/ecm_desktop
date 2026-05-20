'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { X, Download, Loader2 } from 'lucide-react'
import { FileIcon } from './FileIcon'
import { ecmApi } from '@/lib/ecm-api'
import { ShareButton } from './ShareButton'
import { PdfTocPanel } from './PdfTocPanel'
import { AiSuggestionPane } from './AiSuggestionPane'
import type { TocResult } from '@/lib/pdf-toc'

const PdfRenderer = dynamic(() => import('./PdfRenderer'), { ssr: false })

interface Props {
  fileId: number | null
  fileName?: string
  mimetype?: string
  initialTab?: 'ocr' | 'toc' | 'ai'
  onClose: () => void
}

export function FilePreviewModal({ fileId, fileName, mimetype, initialTab, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pages, setPages] = useState(0)
  const [pageNum, setPageNum] = useState(1)
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [canDownload, setCanDownload] = useState<boolean>(true)
  const [toc, setToc] = useState<TocResult | null>(null)
  const [tocLoading, setTocLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'ocr' | 'toc' | 'ai'>(initialTab || 'ocr')

  const isPdf = useMemo(
    () => (mimetype || '').toLowerCase().includes('pdf') || (fileName || '').toLowerCase().endsWith('.pdf'),
    [mimetype, fileName],
  )
  const isImage = useMemo(
    () => (mimetype || '').toLowerCase().startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileName || ''),
    [mimetype, fileName],
  )

  useEffect(() => {
    let cancelled = false
    let createdBlob: string | null = null
    setBlobUrl(null); setError(null); setLoading(true); setPages(0); setPageNum(1); setOcrText(null); setCanDownload(true)
    setToc(null); setTocLoading(false); setActiveTab(initialTab || 'ocr')
    if (!fileId) return

    async function load(id: number) {
      try {
        // dev/browser: proxy /api/odoo evita CORS; prod file:// → URL direta pro Odoo
        const url = ecmApi.fileContentUrl(id, { download: false, cacheBust: true })
        const isProxy = url.startsWith('/api/odoo')
        const r = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          headers: isProxy
            ? { 'X-Odoo-Target': odooTarget(), 'Cache-Control': 'no-cache' }
            : { 'Cache-Control': 'no-cache' },
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const ct = r.headers.get('content-type') || ''
        console.log('[FilePreview] content-type:', ct, 'status:', r.status, 'url:', url)
        const blob = await r.blob()
        if (ct.includes('text/html')) {
          throw new Error('Servidor retornou HTML (provavelmente sessão expirada). Faça login novamente.')
        }
        if (cancelled) return
        createdBlob = URL.createObjectURL(blob)
        setBlobUrl(createdBlob)

        try {
          const f = await ecmApi.readFile(id, ['ocr_text', 'ocr_state', 'can_download'])
          if (!cancelled) {
            setOcrText(f.ocr_text || null)
            setCanDownload(f.can_download !== false)
          }
        } catch {}
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao baixar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load(fileId)
    return () => {
      cancelled = true
      if (createdBlob) URL.revokeObjectURL(createdBlob)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (isPdf && e.key === 'ArrowLeft') setPageNum((p) => Math.max(1, p - 1))
      if (isPdf && e.key === 'ArrowRight') setPageNum((p) => Math.min(pages || 1, p + 1))
      if (isPdf && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setActiveTab((t) => (t === 'toc' ? 'ocr' : 'toc'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, isPdf, pages])

  if (!fileId) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10 text-white">
        <FileIcon
          fileId={fileId ?? undefined}
          name={fileName}
          mimetype={mimetype}
          size={20}
          thumbnail={false}
        />
        <p className="text-sm truncate flex-1 text-white">{fileName || `Arquivo #${fileId}`}</p>
        {!canDownload && (
          <span className="text-xs px-2 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
            Download restrito
          </span>
        )}
        {fileId && canDownload && (
          <ShareButton
            fileId={fileId}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 hover:border-accent text-white"
          />
        )}
        {blobUrl && canDownload && (
          <a href={blobUrl} download={fileName || `arquivo_${fileId}`}
             className="text-sm px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 hover:border-accent text-white flex items-center gap-1.5">
            <Download size={14} /> Baixar
          </a>
        )}
        <button
          onClick={onClose}
          className="p-2 rounded text-white hover:bg-white/10"
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_360px] overflow-hidden">
        <div className="overflow-hidden bg-bg/80 flex flex-col">
          {loading && (
            <div className="m-auto text-ink-muted flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" /> Carregando…
            </div>
          )}
          {error && <p className="m-auto text-red-300">{error}</p>}
          {!loading && !error && blobUrl && isPdf && (
            <PdfRenderer
              url={blobUrl}
              pageNum={pageNum}
              totalPages={pages}
              onPageChange={setPageNum}
              onPagesLoaded={setPages}
              onTocLoadStart={() => setTocLoading(true)}
              onTocLoaded={(t) => {
                setToc(t)
                setTocLoading(false)
                const multiPage = t.flat.some((e) => e.page > 1)
                if (t.source === 'outline' && t.entries.length > 0 && multiPage) {
                  setActiveTab('toc')
                }
              }}
            />
          )}
          {!loading && !error && blobUrl && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={blobUrl} alt={fileName || ''} className="max-w-full max-h-full object-contain" />
          )}
          {!loading && !error && blobUrl && !isPdf && !isImage && (
            <div className="text-ink-muted text-center">
              <p>Pré-visualização indisponível para este formato.</p>
              <p className="text-xs mt-1">Use o botão "Baixar" no topo.</p>
            </div>
          )}
        </div>

        <aside className="border-l border-line bg-bg-soft flex flex-col overflow-hidden">
          <div className="flex border-b border-line shrink-0">
            {(isPdf ? (['toc', 'ocr', 'ai'] as const) : (['ocr', 'ai'] as const)).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-1.5
                  ${activeTab === tab
                    ? (tab === 'ai'
                        ? 'text-violet-500 border-b-2 border-violet-500 bg-bg'
                        : 'text-accent border-b-2 border-accent bg-bg')
                    : 'text-ink-muted hover:bg-bg-muted border-b-2 border-transparent'}`}
                title={tab === 'toc' ? 'Sumário (Ctrl+B)' : tab === 'ai' ? 'Sugestão IA' : 'Texto OCR'}
              >
                {tab === 'ai' && <span className="text-[10px]">✨</span>}
                <span>{tab === 'ocr' ? 'OCR' : tab === 'toc' ? 'Sumário' : 'IA'}</span>
              </button>
            ))}
          </div>
          {activeTab === 'ocr' && <OcrPane ocrText={ocrText} />}
          {activeTab === 'toc' && isPdf && (
            <PdfTocPanel
              toc={toc}
              loading={tocLoading}
              pageNum={pageNum}
              onPageChange={setPageNum}
            />
          )}
          {activeTab === 'ai' && (
            <AiSuggestionPane fileId={fileId} fileName={fileName} active={activeTab === 'ai'} />
          )}
        </aside>
      </div>
    </div>
  )
}

function OcrPane({ ocrText }: { ocrText: string | null }) {
  return ocrText ? (
    <pre className="flex-1 p-4 text-xs whitespace-pre-wrap text-ink-muted leading-relaxed overflow-y-auto">
      {ocrText}
    </pre>
  ) : (
    <p className="p-4 text-xs text-ink-dim">
      Nenhum texto OCR disponível para este arquivo.
    </p>
  )
}

function odooTarget(): string {
  try {
    const raw = localStorage.getItem('ecm-auth')
    if (!raw) return ''
    const { state } = JSON.parse(raw)
    return state?.baseUrl || ''
  } catch { return '' }
}
