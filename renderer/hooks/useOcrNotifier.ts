'use client'

import { useEffect, useRef } from 'react'
import type { EcmFileSummary } from '@/lib/ecm-api'

function notifyOS(title: string, body?: string) {
  const ecm = (typeof window !== 'undefined' ? (window as any).ecm : null)
  if (ecm?.app?.notify) {
    ecm.app.notify(title, body).catch(() => { /* silent */ })
  }
}

/**
 * Compara estado OCR dos files entre renders. Quando algum file passa de
 * pending|processing → done|failed, dispara Notification do OS via
 * window.ecm.app.notify (Electron) — silencioso em browser.
 *
 * Ignora estado inicial: só notifica transições que ocorreram dentro da
 * sessão (não toda vez que a lista é (re)carregada).
 */
export function useOcrNotifier(files: EcmFileSummary[] | undefined) {
  const prevRef = useRef<Map<number, string | undefined>>(new Map())
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!files) return
    const prev = prevRef.current
    const next = new Map<number, string | undefined>()
    for (const f of files) next.set(f.id, f.ocr_state)

    if (!initializedRef.current) {
      // 1ª passagem: só popular cache, sem notificar
      prevRef.current = next
      initializedRef.current = true
      return
    }

    for (const f of files) {
      const before = prev.get(f.id)
      const now = f.ocr_state
      if (!before || before === now) continue
      const wasInFlight = before === 'pending' || before === 'processing'
      if (!wasInFlight) continue
      if (now === 'done') {
        notifyOS('OCR concluído', f.name)
      } else if (now === 'failed') {
        notifyOS('OCR falhou', f.name)
      }
    }
    prevRef.current = next
  }, [files])
}
