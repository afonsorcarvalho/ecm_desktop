'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Folder, Loader2, AlertCircle, Check, ChevronRight, FileType2, Tag as TagIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { ecmApi, type EcmAiSuggestion, type EcmFileSummary } from '@/lib/ecm-api'

interface Props {
  fileId: number
  fileName?: string
  aiState?: EcmFileSummary['ai_state']
  onOpenDetails: () => void
  onChanged?: () => void
}

export function AiSuggestionSummary({ fileId, fileName, aiState, onOpenDetails, onChanged }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<EcmAiSuggestion[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setSuggestions(await ecmApi.listAiSuggestions([fileId]))
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (aiState && aiState !== 'none' && aiState !== 'skipped') {
      load()
    } else {
      setSuggestions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, aiState])

  const current = (() => {
    const order: EcmAiSuggestion['state'][] = ['pending', 'accepted', 'rejected', 'ignored', 'failed']
    return [...suggestions].sort((a, b) => {
      const d = order.indexOf(a.state) - order.indexOf(b.state)
      return d !== 0 ? d : (b.create_date || '').localeCompare(a.create_date || '')
    })[0]
  })()

  async function handleClassify() {
    setBusy(true)
    try {
      const res = await toast.promise(
        ecmApi.aiClassifyNow([fileId], true),
        {
          loading: 'Classificando com IA…',
          success: (r) => r.queued.length ? 'Classificação enfileirada' : 'Não elegível (sem OCR)',
          error: (e: any) => e?.message || 'Falha',
        },
      )
      if (res.queued.length) onChanged?.()
      setTimeout(load, 1500)
    } catch {
      // toast
    } finally {
      setBusy(false)
    }
  }

  async function handleApply() {
    if (!current) return
    setBusy(true)
    try {
      await toast.promise(
        ecmApi.aiApplySuggestion(current.id),
        {
          loading: 'Remanejando…',
          success: `Movido para "${current.suggested_directory_id ? current.suggested_directory_id[1] : '?'}"`,
          error: (e: any) => e?.message || 'Falha',
        },
        { duration: 5000 },
      )
      onChanged?.()
    } catch {
      // toast
    } finally {
      setBusy(false)
    }
  }

  const state = aiState || 'none'

  // Sem classificação ainda
  if (state === 'none' || state === 'skipped') {
    return (
      <div className="mt-3 p-3 rounded-lg border border-violet-500/30 bg-violet-500/5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-300 mb-2">
          <Sparkles size={13} /> Classificação IA
        </div>
        <button
          onClick={handleClassify}
          disabled={busy}
          className="w-full text-xs px-2.5 py-1.5 rounded-md bg-violet-500/15 ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-300 hover:brightness-110 flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Classificar com IA
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 p-3 rounded-lg border border-violet-500/30 bg-violet-500/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-300">
          <Sparkles size={13} /> Classificação IA
        </div>
        <button
          onClick={onOpenDetails}
          className="text-[11px] text-ink-muted hover:text-violet-500 flex items-center gap-0.5"
        >
          detalhes <ChevronRight size={11} />
        </button>
      </div>

      {loading && (
        <div className="text-xs text-ink-muted flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> Carregando…
        </div>
      )}

      {!loading && (state === 'processing' || state === 'pending' && !current) && (
        <div className="text-xs text-ink-muted flex items-center gap-1.5">
          <Loader2 size={12} className="animate-spin" /> IA processando…
        </div>
      )}

      {!loading && current && current.state === 'failed' && (
        <div className="text-xs text-rose-400 flex items-start gap-1.5">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          <span className="truncate">{current.failure_reason || 'falha'}</span>
        </div>
      )}

      {!loading && current && current.state === 'pending' && (
        <>
          {current.confidence != null && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${Math.min(100, (current.confidence || 0) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-ink-dim">
                {Math.round((current.confidence || 0) * 100)}%
              </span>
            </div>
          )}

          {current.suggested_directory_id && (
            <div className="mb-1.5">
              <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Pasta</div>
              <div className="flex items-center gap-1.5 text-xs">
                <Folder size={12} className="text-accent shrink-0" />
                <span className="truncate">{current.suggested_directory_id[1]}</span>
              </div>
            </div>
          )}

          {current.suggested_doc_type_id && (
            <div className="mb-1.5">
              <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Tipo</div>
              <div className="flex items-center gap-1.5 text-xs">
                <FileType2 size={12} className="text-accent shrink-0" />
                <span className="truncate">{current.suggested_doc_type_id[1]}</span>
              </div>
            </div>
          )}

          {current.suggested_tag_ids && current.suggested_tag_ids.length > 0 && (
            <div className="mb-1.5">
              <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Tags</div>
              <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                <TagIcon size={12} className="text-accent shrink-0" />
                <span>{current.suggested_tag_ids.length} tag(s) sugerida(s)</span>
              </div>
            </div>
          )}

          {current.reasoning && (
            <div className="mb-2">
              <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Justificativa</div>
              <p className="text-[11px] text-ink-muted leading-snug">{current.reasoning}</p>
            </div>
          )}

          {current.alt_directory_ids && current.alt_directory_ids.length > 0 && (
            <div className="mb-2">
              <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Alternativas</div>
              <ul className="space-y-0.5">
                {current.alt_directory_ids.map((alt) => (
                  <li key={alt.id} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <Folder size={10} className="shrink-0" />
                    <span className="truncate">{alt.directory_id[1]}</span>
                    <span className="ml-auto font-mono">{Math.round(alt.score * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {current.propose_new_directory && (
            <div className="text-[11px] text-amber-600 dark:text-amber-300 mb-2 p-1.5 rounded bg-amber-500/10 ring-1 ring-amber-500/30">
              Propõe nova pasta: <b>{current.new_directory_name}</b>
              {current.new_directory_parent_id && (
                <span className="block text-ink-dim">em: {current.new_directory_parent_id[1]}</span>
              )}
            </div>
          )}

          <button
            onClick={handleApply}
            disabled={busy || current.propose_new_directory}
            title={current.propose_new_directory ? 'Criar pasta requer admin IA — abra detalhes' : ''}
            className="w-full text-xs px-2.5 py-1.5 rounded-md bg-violet-500 text-white hover:bg-violet-600 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Aceitar sugestão
          </button>
        </>
      )}

      {!loading && current && current.state === 'accepted' && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-2">
            <Check size={13} /> Sugestão aceita
          </div>
          {current.previous_directory_id && current.suggested_directory_id && (
            <div className="text-[11px] mb-1.5">
              <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Histórico</div>
              <div className="flex items-center gap-1 text-ink-muted flex-wrap">
                <span className="line-through opacity-70">{current.previous_directory_id[1]}</span>
                <ChevronRight size={11} className="shrink-0" />
                <span className="text-emerald-600 dark:text-emerald-400">{current.suggested_directory_id[1]}</span>
              </div>
            </div>
          )}
          {current.applied_at && (
            <div className="text-[10px] text-ink-dim mb-2">
              Aplicada em {current.applied_at.replace('T', ' ').slice(0, 16)}
              {current.applied_by_user_id && ` por ${current.applied_by_user_id[1]}`}
            </div>
          )}
          <button
            onClick={handleClassify}
            disabled={busy}
            className="w-full text-xs px-2.5 py-1.5 rounded-md ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Reclassificar
          </button>
        </div>
      )}

      {!loading && current && ['rejected', 'ignored'].includes(current.state) && (
        <div className="text-xs text-ink-muted">
          {current.state === 'rejected' && 'Sugestão rejeitada.'}
          {current.state === 'ignored' && 'Sugestão ignorada.'}
          <button
            onClick={handleClassify}
            disabled={busy}
            className="mt-2 w-full text-xs px-2.5 py-1.5 rounded-md ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Reclassificar
          </button>
        </div>
      )}
    </div>
  )
}
