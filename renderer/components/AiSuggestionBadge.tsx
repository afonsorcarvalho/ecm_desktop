'use client'

import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { EcmFileSummary } from '@/lib/ecm-api'

interface Props {
  file: Pick<EcmFileSummary, 'ai_state' | 'current_suggestion_id'>
  onClick?: () => void
  className?: string
}

const STYLES: Record<NonNullable<EcmFileSummary['ai_state']>, { bg: string; ring: string; text: string; label: string }> = {
  none: { bg: '', ring: '', text: '', label: '' },
  pending: {
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-500/40',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'Aguardando IA',
  },
  processing: {
    bg: 'bg-sky-500/15',
    ring: 'ring-sky-500/40',
    text: 'text-sky-700 dark:text-sky-300',
    label: 'Classificando…',
  },
  done: {
    bg: 'bg-violet-500/15',
    ring: 'ring-violet-500/40',
    text: 'text-violet-700 dark:text-violet-300',
    label: 'Sugestão IA',
  },
  failed: {
    bg: 'bg-rose-500/15',
    ring: 'ring-rose-500/40',
    text: 'text-rose-700 dark:text-rose-300',
    label: 'IA falhou',
  },
  skipped: { bg: '', ring: '', text: '', label: '' },
}

export function AiSuggestionBadge({ file, onClick, className }: Props) {
  const state = file.ai_state || 'none'
  if (state === 'none' || state === 'skipped') return null
  const s = STYLES[state]

  const Icon = state === 'processing'
    ? Loader2
    : state === 'failed'
      ? AlertCircle
      : state === 'done'
        ? Sparkles
        : CheckCircle2

  const clickable = !!onClick && (state === 'done' || state === 'failed')

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={s.label}
      className={[
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1',
        s.bg, s.ring, s.text,
        clickable ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
        className || '',
      ].join(' ')}
    >
      <Icon size={11} className={state === 'processing' ? 'animate-spin' : undefined} />
      <span>{s.label}</span>
    </button>
  )
}
