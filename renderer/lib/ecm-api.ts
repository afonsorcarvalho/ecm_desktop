import { odoo } from './odoo-client'

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID()
  }
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface EcmDirectory {
  id: number
  name: string
  parent_id: [number, string] | false
  is_root_directory: boolean
  count_files: number
  description?: string | false
}

export interface EcmFileSummary {
  id: number
  name: string
  display_name?: string
  mimetype?: string
  size?: number
  create_date?: string
  write_date?: string
  directory_id: [number, string] | false
  document_type_id?: [number, string] | false
  confidentiality?: 'public' | 'internal' | 'restricted' | 'confidential'
  expiration_date?: string | false
  expiration_status?: string
  ocr_state?: string
  approval_state?: string
  can_download?: boolean
  tag_ids?: number[]
  permission_write?: boolean
  permission_unlink?: boolean
  ocr_enabled?: boolean
  ai_state?: 'none' | 'pending' | 'processing' | 'done' | 'failed' | 'skipped'
  current_suggestion_id?: [number, string] | false
  keywords?: string | false
}

export type EcmAiSuggestionState =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'ignored'
  | 'failed'

export interface EcmAiSuggestionAlt {
  id: number
  suggestion_id: [number, string]
  directory_id: [number, string]
  score: number
  rationale?: string
}

export interface EcmAiSuggestion {
  id: number
  document_id: [number, string]
  state: EcmAiSuggestionState
  model_used?: string
  confidence?: number
  reasoning?: string
  suggested_directory_id?: [number, string] | false
  suggested_doc_type_id?: [number, string] | false
  suggested_tag_ids?: number[]
  propose_new_directory?: boolean
  new_directory_name?: string | false
  new_directory_parent_id?: [number, string] | false
  new_directory_manual?: string | false
  keywords?: string | false
  tokens_in?: number
  tokens_out?: number
  latency_ms?: number
  create_date?: string
  applied_at?: string | false
  applied_by_user_id?: [number, string] | false
  previous_directory_id?: [number, string] | false
  failure_reason?: string | false
  alt_directory_ids?: EcmAiSuggestionAlt[]
}

export interface AiSuggestionOverrides {
  directory_id?: number
  document_type_id?: number
  tag_ids?: number[]
  create_new_directory?: boolean
  new_directory_name?: string
  new_directory_parent_id?: number
  new_directory_manual?: string
}

export interface EcmDocumentType {
  id: number
  name: string
  code: string
  default_confidentiality: string
  requires_approval: boolean
  ocr_enabled: boolean
}

export interface EcmTag {
  id: number
  name: string
  color?: number
  category_id?: [number, string] | false
}

const FILE_FIELDS: (keyof EcmFileSummary)[] = [
  'id', 'name', 'mimetype', 'size', 'create_date', 'write_date', 'directory_id',
  'document_type_id', 'confidentiality', 'expiration_date', 'expiration_status',
  'ocr_state', 'approval_state', 'can_download', 'tag_ids',
  'permission_write', 'permission_unlink', 'ocr_enabled',
  'ai_state', 'current_suggestion_id', 'keywords',
]

export const ecmApi = {
  // ---- Directories ----
  async listDirectories(): Promise<EcmDirectory[]> {
    return odoo.callKw<EcmDirectory[]>('dms.directory', 'search_read', [
      [],
      ['id', 'name', 'parent_id', 'is_root_directory', 'count_files', 'description'],
    ], { order: 'name' })
  },

  async createDirectory(args: {
    name: string
    parentId?: number
    storageId?: number
    groupIds?: number[]
  }): Promise<number> {
    const vals: Record<string, unknown> = { name: args.name }
    if (args.parentId) {
      vals.parent_id = args.parentId
    } else {
      vals.is_root_directory = true
      if (args.storageId) vals.storage_id = args.storageId
      if (args.groupIds && args.groupIds.length) {
        vals.group_ids = [[6, 0, args.groupIds]]
      }
    }
    return odoo.callKw<number>('dms.directory', 'create', [vals])
  },

  async listStorages(): Promise<{ id: number; name: string; save_type: string }[]> {
    return odoo.callKw<{ id: number; name: string; save_type: string }[]>(
      'dms.storage', 'search_read', [[], ['id', 'name', 'save_type']],
      { order: 'id', limit: 20 },
    )
  },

  async listAccessGroups(): Promise<{ id: number; name: string }[]> {
    return odoo.callKw<{ id: number; name: string }[]>(
      'dms.access.group', 'search_read', [[], ['id', 'name']],
      { order: 'id', limit: 50 },
    )
  },

  async renameDirectory(id: number, name: string): Promise<boolean> {
    return odoo.callKw<boolean>('dms.directory', 'write', [[id], { name }])
  },

  async deleteDirectory(id: number): Promise<boolean> {
    return odoo.callKw<boolean>('dms.directory', 'unlink', [[id]])
  },

  async moveDirectory(id: number, parentId: number): Promise<boolean> {
    return odoo.callKw<boolean>('dms.directory', 'write', [[id], {
      parent_id: parentId,
      is_root_directory: false,
    }])
  },

  async moveFile(id: number, directoryId: number): Promise<boolean> {
    return odoo.callKw<boolean>('dms.file', 'write', [[id], { directory_id: directoryId }])
  },

  // ---- Files ----
  async listFiles(directoryId?: number, limit = 200): Promise<EcmFileSummary[]> {
    const domain: unknown[] = []
    if (directoryId) domain.push(['directory_id', '=', directoryId])
    return odoo.callKw<EcmFileSummary[]>('dms.file', 'search_read', [
      domain, FILE_FIELDS as unknown as string[],
    ], { limit, order: 'write_date desc' })
  },

  async searchFiles(
    query: string,
    opts: { limit?: number; withOcrText?: boolean } = {},
  ): Promise<(EcmFileSummary & { ocr_text?: string })[]> {
    const limit = opts.limit ?? 50
    // backend já busca name OR ocr_text via _name_search (afr_ecm)
    const ids = await odoo.callKw<[number, string][]>('dms.file', 'name_search', [], {
      name: query, args: [], limit,
    })
    if (!ids.length) return []
    const fields = [...FILE_FIELDS] as string[]
    if (opts.withOcrText) fields.push('ocr_text')
    return odoo.callKw<(EcmFileSummary & { ocr_text?: string })[]>('dms.file', 'read', [
      ids.map((p) => p[0]), fields,
    ])
  },

  async readFile(id: number, fields?: string[]): Promise<EcmFileSummary & { ocr_text?: string }> {
    const f = fields || [...FILE_FIELDS, 'ocr_text']
    const rows = await odoo.callKw<any[]>('dms.file', 'read', [[id], f])
    return rows[0]
  },

  async uploadFile(args: {
    name: string
    directoryId: number
    contentBase64: string
    documentTypeId?: number
    tagIds?: number[]
    ocrEnabled?: boolean
  }): Promise<number> {
    const vals: Record<string, unknown> = {
      name: args.name,
      directory_id: args.directoryId,
      content: args.contentBase64,
    }
    if (args.documentTypeId) vals.document_type_id = args.documentTypeId
    if (args.tagIds && args.tagIds.length) {
      vals.tag_ids = [[6, 0, args.tagIds]]
    }
    if (typeof args.ocrEnabled === 'boolean') vals.ocr_enabled = args.ocrEnabled
    return odoo.callKw<number>('dms.file', 'create', [vals])
  },

  // ---- Tags ----
  async listTags(): Promise<EcmTag[]> {
    return odoo.callKw<EcmTag[]>('dms.tag', 'search_read', [
      [['active', '=', true]],
      ['id', 'name', 'color', 'category_id'],
    ], { order: 'name' })
  },

  fileDownloadUrl(id: number, download = true): string {
    return `${odoo.getBaseUrl()}/web/content?model=dms.file&id=${id}&field=content&download=${download}`
  },

  /** URL pra fetch/img tag carregar binário de dms.file. Em dev/browser HTTP usa
   *  proxy /api/odoo (Next.js route, evita CORS). Em prod file:// (Electron)
   *  monta URL absoluta direto pro Odoo (main process injeta Cookie). */
  fileContentUrl(id: number, opts: { download?: boolean; cacheBust?: boolean } = {}): string {
    const dl = opts.download ? 'true' : 'false'
    const ts = opts.cacheBust !== false ? `&_t=${Date.now()}` : ''
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      return `${odoo.getBaseUrl()}/web/content?model=dms.file&id=${id}&field=content&download=${dl}${ts}`
    }
    // browser/dev HTTP: usa proxy (img tag não envia X-Odoo-Target → ?__t=)
    return `/api/odoo/web/content?model=dms.file&id=${id}&field=content&download=${dl}&__t=${encodeURIComponent(odoo.getBaseUrl())}${ts}`
  },

  async deleteFile(id: number): Promise<boolean> {
    return odoo.callKw<boolean>('dms.file', 'unlink', [[id]])
  },

  /** Soft-delete: active=false (vai pra lixeira). */
  async archiveFiles(ids: number[]): Promise<boolean> {
    if (!ids.length) return true
    return odoo.callKw<boolean>('dms.file', 'write', [ids, { active: false }])
  },

  /** Restaura arquivos da lixeira (active=true). Precisa context
   *  active_test=false pra encontrar/escrever em archived. */
  async restoreFiles(ids: number[]): Promise<boolean> {
    if (!ids.length) return true
    return odoo.callKw<boolean>('dms.file', 'write', [ids, { active: true }], {
      context: { active_test: false },
    })
  },

  /** Lista arquivos archivados (lixeira). */
  async listArchivedFiles(limit = 200): Promise<EcmFileSummary[]> {
    return odoo.callKw<EcmFileSummary[]>('dms.file', 'search_read', [
      [['active', '=', false]],
      FILE_FIELDS as unknown as string[],
    ], { limit, order: 'write_date desc', context: { active_test: false } })
  },

  async updateFile(id: number, vals: Record<string, unknown>): Promise<boolean> {
    return odoo.callKw<boolean>('dms.file', 'write', [[id], vals])
  },

  async updateFiles(ids: number[], vals: Record<string, unknown>): Promise<boolean> {
    if (!ids.length) return true
    return odoo.callKw<boolean>('dms.file', 'write', [ids, vals])
  },

  async deleteFiles(ids: number[]): Promise<boolean> {
    if (!ids.length) return true
    return odoo.callKw<boolean>('dms.file', 'unlink', [ids])
  },

  async reprocessOcr(id: number): Promise<unknown> {
    return odoo.callKw('dms.file', 'action_reprocess_ocr', [[id]])
  },

  /** Garante access_token no dms.file e retorna URL pública. */
  async getShareUrl(id: number): Promise<string> {
    const rows = await odoo.callKw<{ access_token: string | false }[]>('dms.file', 'read', [
      [id], ['access_token'],
    ])
    let token = rows[0]?.access_token || ''
    if (!token) {
      token = uuidv4()
      await odoo.callKw('dms.file', 'write', [[id], { access_token: token }])
    }
    const cfg = await odoo.callKw<{ value: string }[]>('ir.config_parameter', 'search_read', [
      [['key', '=', 'web.base.url']], ['value'],
    ], { limit: 1 })
    const base = cfg[0]?.value || odoo.getBaseUrl()
    const info = await odoo.sessionInfo()
    const db = (info as any)?.db || ''
    const dbParam = db ? `?db=${encodeURIComponent(db)}` : ''
    return `${base.replace(/\/+$/, '')}/ecm/share/${id}/${token}${dbParam}`
  },

  // ---- Company ----
  async getCurrentCompany(): Promise<{ id: number; name: string; logo: string | null }> {
    const info = await odoo.sessionInfo()
    const cid = (info as any)?.user_companies?.current_company || (info as any)?.company_id || 1
    const rows = await odoo.callKw<{ id: number; name: string; logo: string | false }[]>(
      'res.company', 'read', [[cid], ['id', 'name', 'logo']],
    )
    const r = rows[0]
    return { id: r.id, name: r.name, logo: r.logo ? (r.logo as string) : null }
  },

  // ---- Document Types ----
  async listDocumentTypes(): Promise<EcmDocumentType[]> {
    return odoo.callKw<EcmDocumentType[]>('afr.ecm.document.type', 'search_read', [
      [['active', '=', true]],
      ['id', 'name', 'code', 'default_confidentiality', 'requires_approval', 'ocr_enabled'],
    ], { order: 'sequence, name' })
  },

  // ---- IA / Classificação ----
  async aiClassifyNow(ids: number[], force = false): Promise<{ queued: number[]; skipped: number[] }> {
    return odoo.callKw<{ queued: number[]; skipped: number[] }>(
      'dms.file', 'ai_classify_now', [ids], { force },
    )
  },

  async aiApplySuggestion(
    suggestionId: number,
    overrides?: AiSuggestionOverrides,
  ): Promise<{ ok: boolean; document_id: number; directory_id?: number }> {
    return odoo.callKw('dms.file', 'ai_apply_suggestion', [suggestionId, overrides || {}])
  },

  async aiRejectSuggestion(suggestionId: number, reason?: string): Promise<{ ok: boolean }> {
    return odoo.callKw('dms.file', 'ai_reject_suggestion', [suggestionId, reason || ''])
  },

  async aiIgnoreSuggestion(suggestionId: number): Promise<{ ok: boolean }> {
    return odoo.callKw('dms.file', 'ai_ignore_suggestion', [suggestionId])
  },

  async listAiSuggestions(documentIds: number[]): Promise<EcmAiSuggestion[]> {
    if (!documentIds.length) return []
    return odoo.callKw<EcmAiSuggestion[]>('dms.file', 'ai_list_suggestions', [documentIds])
  },
}
