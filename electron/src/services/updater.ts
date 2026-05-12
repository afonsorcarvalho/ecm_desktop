import { app, ipcMain, Notification, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

let initialized = false

function send(window: BrowserWindow | null, channel: string, payload?: unknown) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
}

export function setupUpdater(getWindow: () => BrowserWindow | null) {
  if (initialized) return
  initialized = true

  // Configurações conservadoras: avisa, baixa em background, instala no quit.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    send(getWindow(), 'updater:event', { type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    send(getWindow(), 'updater:event', { type: 'available', version: info.version })
    new Notification({
      title: 'Atualização disponível',
      body: `Versão ${info.version} sendo baixada em segundo plano.`,
    }).show()
  })

  autoUpdater.on('update-not-available', () => {
    send(getWindow(), 'updater:event', { type: 'none' })
  })

  autoUpdater.on('download-progress', (progress) => {
    send(getWindow(), 'updater:event', {
      type: 'progress',
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', async (info) => {
    send(getWindow(), 'updater:event', { type: 'downloaded', version: info.version })
    const r = await dialog.showMessageBox({
      type: 'info',
      title: 'Atualização pronta',
      message: `AFR ECM Desktop ${info.version} foi baixado.`,
      detail: 'Reiniciar agora para aplicar?',
      buttons: ['Reiniciar', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1,
    })
    if (r.response === 0) {
      autoUpdater.quitAndInstall()
    }
  })

  autoUpdater.on('error', (err) => {
    send(getWindow(), 'updater:event', { type: 'error', message: err?.message || String(err) })
  })

  // Manual check via IPC (UI button)
  ipcMain.handle('updater:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, version: result?.updateInfo?.version ?? null }
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) }
    }
  })

  // Check inicial após 8s (não bloqueia startup). Skip em dev.
  if (!app.isPackaged) return
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(() => { /* silencioso */ })
  }, 8_000)
}
