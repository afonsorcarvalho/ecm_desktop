'use client'

import { useMemo } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { BookOpen, Folder } from 'lucide-react'
import type { EcmDirectory } from '../lib/ecm-api'

interface Props {
  directory: EcmDirectory
}

export function DirectoryManualPanel({ directory }: Props) {
  const safeHtml = useMemo(() => {
    if (!directory.description) return null
    return DOMPurify.sanitize(directory.description, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'b', 'i', 'u', 's', 'mark',
        'ul', 'ol', 'li',
        'blockquote', 'code', 'pre',
        'a', 'span', 'div',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class'],
    })
  }, [directory.description])

  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-ink-muted mb-2">Pasta</div>
      <h3 className="font-medium mb-3 break-words flex items-center gap-2">
        <Folder size={16} className="text-accent shrink-0" />
        <span>{directory.name}</span>
      </h3>

      <div className="text-xs text-ink-dim mb-4">
        {directory.count_files} arquivo{directory.count_files === 1 ? '' : 's'} direto
        {directory.count_files === 1 ? '' : 's'} na pasta
      </div>

      {safeHtml ? (
        <div className="rounded-lg border border-line bg-bg-muted/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-bg-muted/60 text-xs font-medium text-ink-muted">
            <BookOpen size={13} />
            Manual da Pasta
          </div>
          <div
            className="ecm-manual-content px-3 py-3 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line bg-bg-muted/20 px-3 py-4 text-xs text-ink-dim text-center">
          <BookOpen size={16} className="mx-auto mb-1.5 opacity-60" />
          Pasta sem manual cadastrado.
          <div className="mt-1 text-[11px]">
            Edite a pasta no Odoo → aba "Manual da Pasta" para descrever escopo, normas e onde inserir documentos.
          </div>
        </div>
      )}
    </div>
  )
}
