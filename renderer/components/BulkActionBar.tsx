'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderInput, Trash2, Tag as TagIcon, FileType2, X, Loader2, ArchiveRestore, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { ecmApi, EcmDirectory } from '@/lib/ecm-api'

interface Props {
  selectedIds: number[]
  directories: EcmDirectory[]
  onClear: () => void
  /** quando true, mostra Restaurar + Excluir permanente em vez das ações normais */
  trash?: boolean
}

type Modal = null | 'move' | 'type' | 'tag'

export function BulkActionBar({ selectedIds, directories, onClear, trash }: Props) {
  const qc = useQueryClient()
  const [modal, setModal] = useState<Modal>(null)
  const [busy, setBusy] = useState(false)
  const count = selectedIds.length

  const types = useQuery({
    queryKey: ['document-types'],
    queryFn: () => ecmApi.listDocumentTypes(),
    enabled: modal === 'type',
    staleTime: 5 * 60_000,
  })

  const tags = useQuery({
    queryKey: ['tags'],
    queryFn: () => ecmApi.listTags(),
    enabled: modal === 'tag',
    staleTime: 5 * 60_000,
  })

  function invalidateAfter() {
    qc.invalidateQueries({ queryKey: ['files'] })
    qc.invalidateQueries({ queryKey: ['directories'] })
  }

  async function bulkArchive() {
    if (!confirm(`Mover ${count} arquivo(s) para a lixeira?`)) return
    setBusy(true)
    try {
      await ecmApi.archiveFiles(selectedIds)
      toast.success(`${count} arquivo(s) na lixeira`)
      invalidateAfter()
      onClear()
    } catch (e: any) {
      toast.error(e?.message || 'Falha em mover pra lixeira')
    } finally { setBusy(false) }
  }

  async function bulkPermanentDelete() {
    if (!confirm(`Excluir DEFINITIVAMENTE ${count} arquivo(s)?\n\nAção irreversível.`)) return
    setBusy(true)
    try {
      await ecmApi.deleteFiles(selectedIds)
      toast.success(`${count} arquivo(s) excluído(s)`)
      invalidateAfter()
      onClear()
    } catch (e: any) {
      toast.error(e?.message || 'Falha em excluir alguns')
    } finally { setBusy(false) }
  }

  async function bulkRestore() {
    setBusy(true)
    try {
      await ecmApi.restoreFiles(selectedIds)
      toast.success(`${count} arquivo(s) restaurado(s)`)
      invalidateAfter()
      onClear()
    } catch (e: any) {
      toast.error(e?.message || 'Falha em restaurar')
    } finally { setBusy(false) }
  }

  async function bulkMove(directoryId: number) {
    setBusy(true)
    try {
      await ecmApi.updateFiles(selectedIds, { directory_id: directoryId })
      toast.success(`${count} arquivo(s) movido(s)`)
      invalidateAfter()
      setModal(null)
      onClear()
    } catch (e: any) {
      toast.error(e?.message || 'Falha em mover')
    } finally { setBusy(false) }
  }

  async function bulkType(typeId: number | null) {
    setBusy(true)
    try {
      await ecmApi.updateFiles(selectedIds, { document_type_id: typeId || false })
      toast.success(`Tipo aplicado a ${count} arquivo(s)`)
      invalidateAfter()
      setModal(null)
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao mudar tipo')
    } finally { setBusy(false) }
  }

  async function bulkClassifyAi() {
    setBusy(true)
    try {
      const res = await toast.promise(
        ecmApi.aiClassifyNow(selectedIds, false),
        {
          loading: `Enfileirando ${count} arquivo(s) pra classificação IA…`,
          success: (r) => {
            const parts: string[] = []
            if (r.queued.length) parts.push(`${r.queued.length} enfileirado(s)`)
            if (r.skipped.length) parts.push(`${r.skipped.length} ignorado(s) (sem OCR ou pasta excluída)`)
            return parts.join(' • ') || 'Nada a fazer'
          },
          error: (e: any) => e?.message || 'Falha ao enfileirar',
        },
      )
      // refresh imediato pra mostrar ai_state=pending; polling cuida do resto
      if (res.queued.length) invalidateAfter()
    } catch {
      // toast já mostra
    } finally { setBusy(false) }
  }

  async function bulkAddTags(tagIds: number[]) {
    if (!tagIds.length) { setModal(null); return }
    setBusy(true)
    try {
      // 4 = link, append múltiplos
      const ops = tagIds.map((t) => [4, t, 0])
      await ecmApi.updateFiles(selectedIds, { tag_ids: ops })
      toast.success(`Tags aplicadas a ${count} arquivo(s)`)
      invalidateAfter()
      setModal(null)
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao aplicar tags')
    } finally { setBusy(false) }
  }

  if (count === 0) return null

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 glass rounded-2xl px-4 py-2 flex items-center gap-3 shadow-2xl border border-accent/30 max-w-[90vw]">
        <button
          onClick={onClear}
          className="p-1 rounded hover:bg-bg-muted text-ink-muted"
          title="Limpar seleção (Esc)"
        >
          <X size={16} />
        </button>
        <span className="text-sm font-medium">{count} selecionado(s)</span>
        <span className="text-ink-dim">·</span>
        {trash ? (
          <>
            <BulkBtn onClick={bulkRestore} disabled={busy} success>
              <ArchiveRestore size={14} /> Restaurar
            </BulkBtn>
            <BulkBtn onClick={bulkPermanentDelete} disabled={busy} danger>
              <Trash2 size={14} /> Excluir permanente
            </BulkBtn>
          </>
        ) : (
          <>
            <BulkBtn onClick={() => setModal('move')} disabled={busy}>
              <FolderInput size={14} /> Mover
            </BulkBtn>
            <BulkBtn onClick={() => setModal('type')} disabled={busy}>
              <FileType2 size={14} /> Tipo
            </BulkBtn>
            <BulkBtn onClick={() => setModal('tag')} disabled={busy}>
              <TagIcon size={14} /> Tags
            </BulkBtn>
            <BulkBtn onClick={bulkClassifyAi} disabled={busy} ai>
              <Sparkles size={14} /> Classificar IA
            </BulkBtn>
            <BulkBtn onClick={bulkArchive} disabled={busy} danger>
              <Trash2 size={14} /> Lixeira
            </BulkBtn>
          </>
        )}
        {busy && <Loader2 size={14} className="animate-spin text-ink-muted" />}
      </div>

      {modal === 'move' && (
        <PickModal title={`Mover ${count} arquivo(s) para...`} onClose={() => setModal(null)}>
          <ul className="max-h-72 overflow-y-auto -mx-2">
            {directories.map((d) => (
              <li key={d.id}>
                <button
                  disabled={busy}
                  onClick={() => bulkMove(d.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-bg-muted text-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <FolderInput size={14} className="text-ink-muted" /> {d.name}
                </button>
              </li>
            ))}
          </ul>
        </PickModal>
      )}

      {modal === 'type' && (
        <PickModal title={`Definir tipo para ${count} arquivo(s)`} onClose={() => setModal(null)}>
          <ul className="max-h-72 overflow-y-auto -mx-2">
            <li>
              <button
                disabled={busy}
                onClick={() => bulkType(null)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-bg-muted text-sm text-ink-muted disabled:opacity-50"
              >
                — Sem tipo —
              </button>
            </li>
            {types.data?.map((t) => (
              <li key={t.id}>
                <button
                  disabled={busy}
                  onClick={() => bulkType(t.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-bg-muted text-sm disabled:opacity-50"
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>
        </PickModal>
      )}

      {modal === 'tag' && (
        <TagPicker
          allTags={tags.data || []}
          loading={tags.isLoading}
          onCancel={() => setModal(null)}
          onApply={bulkAddTags}
          busy={busy}
        />
      )}
    </>
  )
}

function BulkBtn({
  onClick, disabled, danger, success, ai, children,
}: { onClick: () => void; disabled?: boolean; danger?: boolean; success?: boolean; ai?: boolean; children: React.ReactNode }) {
  let palette = 'bg-bg-soft hover:bg-bg border border-line hover:border-accent'
  if (danger) palette = 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30'
  if (success) palette = 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
  if (ai) palette = 'bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 border border-violet-500/40'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition disabled:opacity-50 ${palette}`}
    >
      {children}
    </button>
  )
}

function PickModal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[55] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="glass max-w-md w-full rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-bg-muted"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TagPicker({
  allTags, loading, busy, onCancel, onApply,
}: {
  allTags: { id: number; name: string }[]
  loading: boolean
  busy: boolean
  onCancel: () => void
  onApply: (ids: number[]) => void
}) {
  const [picked, setPicked] = useState<number[]>([])
  function toggle(id: number) {
    setPicked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }
  return (
    <PickModal title="Adicionar tags" onClose={onCancel}>
      {loading && <p className="text-xs text-ink-dim">Carregando tags…</p>}
      {!loading && allTags.length === 0 && (
        <p className="text-xs text-ink-dim">Nenhuma tag cadastrada.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((t) => {
          const active = picked.includes(t.id)
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`text-xs px-2 py-1 rounded-full border transition ${
                active
                  ? 'bg-accent text-white border-accent'
                  : 'bg-bg-soft border-line hover:border-accent text-ink-muted'
              }`}
            >
              #{t.name}
            </button>
          )
        })}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3 py-1.5 rounded bg-bg-muted hover:bg-bg text-xs">
          Cancelar
        </button>
        <button
          onClick={() => onApply(picked)}
          disabled={busy || picked.length === 0}
          className="px-3 py-1.5 rounded bg-accent hover:bg-accent-soft text-xs font-medium disabled:opacity-40 flex items-center gap-1"
        >
          {busy && <Loader2 size={12} className="animate-spin" />}
          Aplicar
        </button>
      </div>
    </PickModal>
  )
}
