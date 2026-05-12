'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export interface UpdaterEvent {
  type: 'checking' | 'available' | 'none' | 'progress' | 'downloaded' | 'error'
  version?: string
  percent?: number
  bytesPerSecond?: number
  message?: string
}

/**
 * Assina eventos do electron-updater (main process) e exibe toasts no
 * renderer. Sem efeito quando rodando em browser puro (sem `window.ecm`).
 */
export function useUpdater(): { lastEvent: UpdaterEvent | null; check: () => void } {
  const [lastEvent, setLastEvent] = useState<UpdaterEvent | null>(null)

  useEffect(() => {
    const ecm = (window as any).ecm
    if (!ecm?.updater) return
    const off = ecm.updater.onEvent((ev: UpdaterEvent) => {
      setLastEvent(ev)
      switch (ev.type) {
        case 'available':
          toast.success(`Atualização ${ev.version} disponível — baixando…`)
          break
        case 'downloaded':
          toast.success(`Atualização ${ev.version} pronta — reinicie para aplicar.`)
          break
        case 'error':
          if (!isBenignUpdaterError(ev.message)) {
            toast.error(`Atualizador: ${ev.message ?? 'erro desconhecido'}`)
          }
          break
        // checking, none, progress: silenciosos
      }
    })
    return off
  }, [])

  function check() {
    const ecm = (window as any).ecm
    if (!ecm?.updater) {
      toast.error('Atualizador disponível apenas no app desktop.')
      return
    }
    ecm.updater.check().then((r: any) => {
      if (!r.ok) {
        if (isBenignUpdaterError(r.error)) {
          toast.success('Você está na versão mais recente.')
        } else {
          toast.error(`Falha ao checar: ${r.error}`)
        }
      } else if (!r.version) {
        toast.success('Você está na versão mais recente.')
      }
    })
  }

  return { lastEvent, check }
}

/**
 * Erros esperados quando ainda não há release publicado no GitHub
 * (build portátil/dev/pré-publicação). Não mostrar toast vermelho ao user.
 */
function isBenignUpdaterError(msg?: string): boolean {
  if (!msg) return false
  const m = msg.toLowerCase()
  return (
    m.includes('no published versions') ||
    m.includes('not found') ||
    m.includes('404')
  )
}
