'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Folder, Tag as TagIcon, FileType2, Check, Trash2, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { ecmApi, type EcmAiSuggestion } from '@/lib/ecm-api'

interface Props {
  fileId: number | null
  fileName?: string
  active?: boolean
  onApplied?: () => void
}

export function AiSuggestionPane({ fileId, fileName, active = true, onApplied }: Props) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<EcmAiSuggestion[]>([])
  const [busy, setBusy] = useState<'apply' | 'reject' | 'classify' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!fileId) return
    setLoading(true)
    setError(null)
    try {
      const sugs = await ecmApi.listAiSuggestions([fileId])
      setSuggestions(sugs)
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar sugestões.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (active && fileId) load()
  }, [active, fileId])

  const current = (() => {
    const order: EcmAiSuggestion['state'][] = ['pending', 'accepted', 'rejected', 'ignored', 'failed']
    const sorted = [...suggestions].sort((a, b) => {
      const pa = order.indexOf(a.state)
      const pb = order.indexOf(b.state)
      if (pa !== pb) return pa - pb
      return (b.create_date || '').localeCompare(a.create_date || '')
    })
    return sorted[0]
  })()
  const latest = suggestions
    .slice()
    .sort((a, b) => (b.create_date || '').localeCompare(a.create_date || ''))[0]
  const latestFailedWhilePending =
    latest && current && latest.id !== current.id && latest.state === 'failed' && current.state === 'pending'

  const displayName = fileName || (fileId ? `arquivo #${fileId}` : 'arquivo')

  async function handleApply() {
    if (!current) return
    setBusy('apply')
    setError(null)
    const dirName = current.suggested_directory_id ? current.suggested_directory_id[1] : '(pasta)'
    const typeName = current.suggested_doc_type_id ? current.suggested_doc_type_id[1] : null
    const tagCount = current.suggested_tag_ids?.length || 0
    try {
      await toast.promise(
        ecmApi.aiApplySuggestion(current.id),
        {
          loading: `Remanejando "${displayName}"…`,
          success: () => {
            const parts = [`"${displayName}" movido para "${dirName}"`]
            if (typeName) parts.push(`• tipo: ${typeName}`)
            if (tagCount > 0) parts.push(`• ${tagCount} tag${tagCount > 1 ? 's' : ''}`)
            return parts.join(' ')
          },
          error: (e: any) => e?.message || 'Falha ao aplicar sugestão',
        },
        { duration: 5000 },
      )
      onApplied?.()
      await load()
    } catch (e: any) {
      setError(e?.message || 'Falha ao aplicar sugestão.')
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    if (!current) return
    setBusy('reject')
    setError(null)
    try {
      await toast.promise(
        ecmApi.aiRejectSuggestion(current.id, 'Rejeitada pelo usuário'),
        {
          loading: 'Rejeitando sugestão…',
          success: 'Sugestão rejeitada',
          error: (e: any) => e?.message || 'Falha ao rejeitar',
        },
      )
      await load()
    } catch (e: any) {
      setError(e?.message || 'Falha ao rejeitar.')
    } finally {
      setBusy(null)
    }
  }

  async function handleClassifyNow() {
    if (!fileId) return
    setBusy('classify')
    setError(null)
    try {
      const res = await toast.promise(
        ecmApi.aiClassifyNow([fileId], true),
        {
          loading: `Classificando "${displayName}" com IA…`,
          success: (r) => r.queued.length
            ? `Classificação enfileirada — aguarde resposta da IA`
            : `Documento não elegível (sem OCR ou pasta excluída)`,
          error: (e: any) => e?.message || 'Falha ao enfileirar',
        },
      )
      if (!res.queued.length) {
        setError('Documento não elegível (sem OCR ou pasta excluída).')
      }
      setTimeout(load, 1500)
    } catch (e: any) {
      setError(e?.message || 'Falha ao enfileirar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="text-ink-muted text-sm flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </div>
        )}

        {!loading && !current && (
          <div className="text-sm text-ink-muted">
            <p className="mb-3">Sem sugestão para este arquivo.</p>
            <button
              onClick={handleClassifyNow}
              disabled={busy !== null}
              className="w-full px-3 py-2 rounded-md bg-violet-500/15 ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-300 hover:brightness-110 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={14} /> Classificar com IA
            </button>
          </div>
        )}

        {!loading && current && (
          <>
            {current.state === 'accepted' && (
              <div className="p-2 rounded bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
                  <Check size={13} /> Sugestão aceita
                </div>
                {current.previous_directory_id && current.suggested_directory_id && (
                  <div className="text-[11px]">
                    <div className="text-[9px] uppercase tracking-wide text-ink-dim mb-0.5">Histórico de movimentação</div>
                    <div className="flex items-center gap-1 flex-wrap text-ink-muted">
                      <span className="line-through opacity-70">{current.previous_directory_id[1]}</span>
                      <span className="shrink-0">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{current.suggested_directory_id[1]}</span>
                    </div>
                  </div>
                )}
                {current.applied_at && (
                  <div className="text-[10px] text-ink-dim mt-1">
                    {current.applied_at.replace('T', ' ').slice(0, 16)}
                    {current.applied_by_user_id && ` • ${current.applied_by_user_id[1]}`}
                  </div>
                )}
              </div>
            )}

            {current.state === 'failed' && (
              <div className="text-xs text-rose-400 flex items-start gap-2 p-2 rounded bg-rose-500/10 ring-1 ring-rose-500/30">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Falha</div>
                  <div className="opacity-80">{current.failure_reason || 'erro desconhecido'}</div>
                </div>
              </div>
            )}

            {latestFailedWhilePending && (
              <div className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 p-2 rounded bg-amber-500/10 ring-1 ring-amber-500/30">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">Última reclassificação falhou</div>
                  <div className="opacity-80">{latest!.failure_reason || 'erro'}. Mostrando sugestão anterior.</div>
                </div>
              </div>
            )}

            {current.confidence != null && current.state === 'pending' && (
              <div>
                <div className="flex items-center justify-between text-xs text-ink-dim mb-1">
                  <span>Confiança</span>
                  <span className="font-mono">{Math.round((current.confidence || 0) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: `${Math.min(100, Math.max(0, (current.confidence || 0) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {current.suggested_directory_id && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-1">Pasta</div>
                <div className="flex items-center gap-2 text-sm">
                  <Folder size={14} className="text-accent shrink-0" />
                  <span className="truncate">{current.suggested_directory_id[1]}</span>
                </div>
              </div>
            )}

            {current.propose_new_directory && (
              <div className="p-3 rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 text-sm">
                <div className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-300 mb-1">
                  Nova pasta proposta
                </div>
                <div className="font-medium">{current.new_directory_name}</div>
                {current.new_directory_parent_id && (
                  <div className="text-xs text-ink-dim mt-1">
                    em: {current.new_directory_parent_id[1]}
                  </div>
                )}
                <div className="text-xs text-ink-muted mt-2 italic">
                  Criação requer admin IA.
                </div>
              </div>
            )}

            {current.suggested_doc_type_id && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-1">Tipo</div>
                <div className="flex items-center gap-2 text-sm">
                  <FileType2 size={14} className="text-accent shrink-0" />
                  <span>{current.suggested_doc_type_id[1]}</span>
                </div>
              </div>
            )}

            {current.suggested_tag_ids && current.suggested_tag_ids.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-1">Tags</div>
                <div className="flex items-center gap-2 text-sm">
                  <TagIcon size={14} className="text-accent shrink-0" />
                  <span className="text-ink-muted">{current.suggested_tag_ids.length} tag(s)</span>
                </div>
              </div>
            )}

            {current.alt_directory_ids && current.alt_directory_ids.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-1">Alternativas</div>
                <ul className="space-y-1 text-sm">
                  {current.alt_directory_ids.map((alt) => (
                    <li key={alt.id} className="flex items-center gap-2 text-ink-muted">
                      <Folder size={12} className="shrink-0" />
                      <span className="truncate">{alt.directory_id[1]}</span>
                      <span className="ml-auto font-mono text-xs">{Math.round(alt.score * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {current.reasoning && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-1">Justificativa</div>
                <p className="text-xs text-ink-muted leading-relaxed">{current.reasoning}</p>
              </div>
            )}

            <div className="text-[10px] text-ink-dim grid grid-cols-3 gap-2 pt-2 border-t border-line">
              <div>
                <div>Modelo</div>
                <div className="font-mono truncate">{current.model_used || '—'}</div>
              </div>
              <div>
                <div>Tokens</div>
                <div className="font-mono">{(current.tokens_in || 0) + (current.tokens_out || 0)}</div>
              </div>
              <div>
                <div>Latência</div>
                <div className="font-mono">{current.latency_ms}ms</div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="text-xs text-rose-400 p-2 rounded bg-rose-500/10 ring-1 ring-rose-500/30">{error}</div>
        )}
      </div>

      {current && current.state === 'pending' && (
        <footer className="border-t border-line p-3 grid grid-cols-2 gap-2">
          <button
            onClick={handleReject}
            disabled={busy !== null}
            className="px-3 py-2 rounded-md ring-1 ring-line text-ink-muted hover:bg-bg-muted flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
          >
            <Trash2 size={14} /> Rejeitar
          </button>
          <button
            onClick={handleApply}
            disabled={busy !== null || current.propose_new_directory}
            title={current.propose_new_directory ? 'Criação de nova pasta requer admin IA' : ''}
            className="px-3 py-2 rounded-md bg-violet-500 text-white hover:bg-violet-600 flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
          >
            <Check size={14} /> Aceitar
          </button>
        </footer>
      )}

      {current && current.state !== 'pending' && (
        <footer className="border-t border-line p-3">
          <button
            onClick={handleClassifyNow}
            disabled={busy !== null}
            className="w-full px-3 py-2 rounded-md ring-1 ring-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
          >
            <Sparkles size={14} /> Reclassificar
          </button>
        </footer>
      )}
    </div>
  )
}
