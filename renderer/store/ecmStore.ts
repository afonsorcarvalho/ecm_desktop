import { create } from 'zustand'

export type ViewMode = 'normal' | 'trash'

interface EcmState {
  currentDirectoryId: number | null
  selectedFileId: number | null
  /** Conjunto de seleção múltipla. Sempre inclui selectedFileId quando há um. */
  selectedIds: Set<number>
  /** Último file clicado (pivot pra Shift+click range). */
  anchorId: number | null
  /** Modo de visualização: pastas normais vs. lixeira (archived). */
  viewMode: ViewMode

  setCurrentDirectory(id: number | null): void
  /** Substitui seleção por um único id (ou limpa). */
  selectFile(id: number | null): void
  /** Adiciona/remove id do conjunto (Ctrl+click). */
  toggleSelected(id: number): void
  /** Seleciona range entre anchor e id (Shift+click). Lista ordenada precisa
   *  vir do consumer (sortedFiles). */
  selectRange(orderedIds: number[], id: number): void
  /** Limpa toda seleção. */
  clearSelection(): void
  /** Alterna entre 'normal' (pastas) e 'trash' (archived). */
  setViewMode(mode: ViewMode): void
}

export const useEcmStore = create<EcmState>((set, get) => ({
  currentDirectoryId: null,
  selectedFileId: null,
  selectedIds: new Set<number>(),
  anchorId: null,
  viewMode: 'normal',

  setCurrentDirectory: (id) => set({
    currentDirectoryId: id,
    selectedFileId: null,
    selectedIds: new Set(),
    anchorId: null,
    viewMode: 'normal',
  }),

  selectFile: (id) => set({
    selectedFileId: id,
    selectedIds: id != null ? new Set([id]) : new Set(),
    anchorId: id,
  }),

  toggleSelected: (id) => {
    const cur = new Set(get().selectedIds)
    if (cur.has(id)) cur.delete(id)
    else cur.add(id)
    const last = cur.size > 0 ? Array.from(cur).at(-1) ?? null : null
    set({
      selectedIds: cur,
      selectedFileId: cur.has(id) ? id : last,
      anchorId: id,
    })
  },

  selectRange: (orderedIds, id) => {
    const anchor = get().anchorId ?? id
    const a = orderedIds.indexOf(anchor)
    const b = orderedIds.indexOf(id)
    if (a < 0 || b < 0) {
      set({ selectedIds: new Set([id]), selectedFileId: id, anchorId: id })
      return
    }
    const [lo, hi] = a < b ? [a, b] : [b, a]
    const range = new Set(orderedIds.slice(lo, hi + 1))
    set({ selectedIds: range, selectedFileId: id })
  },

  clearSelection: () => set({ selectedIds: new Set(), selectedFileId: null, anchorId: null }),

  setViewMode: (mode) => set({
    viewMode: mode,
    currentDirectoryId: mode === 'trash' ? null : get().currentDirectoryId,
    selectedFileId: null,
    selectedIds: new Set(),
    anchorId: null,
  }),
}))
