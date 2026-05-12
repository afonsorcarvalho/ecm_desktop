import { app, BrowserWindow, ipcMain, shell, dialog, Notification, Tray, Menu, nativeImage, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { registerWatcherIpc } from './services/watcher'
import { registerCredentialsIpc } from './services/credentials'
import { setupUpdater } from './services/updater'

const isDev = process.env.NODE_ENV === 'development'
const RENDERER_DEV_URL = 'http://localhost:3000'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let tray: Tray | null = null

const SPLASH_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>AFR ECM</title>
<style>
  html,body{margin:0;height:100%;background:linear-gradient(135deg,#1b1230 0%,#0b0d12 100%);
    color:#fff;font-family:system-ui,Segoe UI,sans-serif;display:grid;place-items:center;
    -webkit-app-region:drag;user-select:none;overflow:hidden}
  .box{text-align:center}
  .logo{width:78px;height:78px;margin:0 auto 18px;border-radius:18px;
    background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:grid;place-items:center;
    box-shadow:0 8px 30px rgba(139,92,246,.4);font-weight:700;font-size:42px}
  h1{margin:0;font-size:18px;letter-spacing:.5px;font-weight:600}
  p{margin:6px 0 24px;font-size:12px;opacity:.65;letter-spacing:.4px;text-transform:uppercase}
  .bar{width:180px;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin:0 auto}
  .bar > span{display:block;width:40%;height:100%;background:#8b5cf6;border-radius:2px;
    animation:slide 1.1s ease-in-out infinite}
  @keyframes slide{0%{margin-left:-40%}100%{margin-left:100%}}
</style></head>
<body><div class="box">
  <div class="logo">E</div>
  <h1>AFR ECM Desktop</h1>
  <p>Inicializando…</p>
  <div class="bar"><span></span></div>
</div></body></html>`

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 360,
    height: 280,
    frame: false,
    resizable: false,
    movable: true,
    show: true,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH_HTML))
  splashWindow.on('closed', () => { splashWindow = null })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0b0d12',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'resources', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Em prod (file://), o renderer faz JSON-RPC direto pro Odoo
      // (sem proxy Next.js). Desativa same-origin policy do Chromium
      // pra evitar bloqueio CORS — aceitável em desktop app, requests
      // só atingem o servidor configurado pelo usuário.
      webSecurity: isDev,
      allowRunningInsecureContent: !isDev,
    },
  })

  if (isDev) {
    mainWindow.loadURL(RENDERER_DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'out', 'index.html'))
    // Habilita DevTools em prod também (F12 / Ctrl+Shift+I). Ajuda diagnosticar
    // tela em branco. Pode esconder por padrão removendo openDevTools.
    if (process.env.ECM_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  }

  // Log de erros do renderer pra main process (visível em terminal/console
  // do Windows quando rodar via cmd; útil pra diagnosticar tela preta).
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer crashed]', details)
  })
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[renderer fail-load]', code, desc, url)
  })
  mainWindow.webContents.on('console-message', (_e, level, message, line, src) => {
    if (level >= 2) console.warn('[renderer console]', message, src + ':' + line)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close()
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // links externos abrem no browser default
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Bloqueia navegação por drag-drop de arquivos do Explorer.
  // Sem isso, Electron tenta navegar para file:///C:/... ao soltar arquivo,
  // substituindo o app pelo conteúdo do arquivo.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedDev = isDev && url.startsWith(RENDERER_DEV_URL)
    const allowedProd = !isDev && url.startsWith('file://')
    if (!allowedDev && !allowedProd) {
      event.preventDefault()
    }
  })
}

function createTray() {
  // Em prod (asar) `__dirname` = app.asar/dist-electron. resources/ está
  // no nível acima (dentro do .asar também — está no `files` glob do builder).
  // tenta .ico (Windows nativo) → fallback .png
  const base = path.join(__dirname, '..', 'resources')
  const candidates = [
    path.join(base, 'tray-icon.ico'),
    path.join(base, 'tray-icon.png'),
    path.join(base, 'icon.ico'),
    path.join(base, 'icon.png'),
  ]
  let icon = nativeImage.createEmpty()
  for (const p of candidates) {
    try {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) { icon = img; break }
    } catch { /* skip */ }
  }
  tray = new Tray(icon)
  tray.setToolTip('AFR ECM Desktop')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Sair', click: () => { app.quit() } },
  ]))
  tray.on('click', () => mainWindow?.show())
}

app.whenReady().then(() => {
  registerCredentialsIpc()
  registerWatcherIpc(() => mainWindow)

  // Em prod (file://), todos os XHR pro Odoo são cross-origin e Chromium
  // dispara preflight OPTIONS que Odoo não responde (Odoo controllers
  // de /web/* só aceitam GET/POST). Resultado: request fica pending
  // forever. Removemos o header Origin antes de enviar pra rede —
  // Chromium trata como same-origin "simple request" e pula preflight.
  // Mantém webSecurity:false já setado pra não bloquear no renderer.
  if (!isDev) {
    // Session cookie capturado do response do Odoo (mapeado por host).
    // Chromium não persiste cookies pra origin file:// cross-site, mesmo
    // sem SameSite/Secure. Workaround: capturamos session_id manualmente
    // e injetamos em requests subsequentes do mesmo host.
    const cookieStore = new Map<string, string>()  // host → "session_id=…"

    // 1) Captura Set-Cookie de respostas Odoo
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      try {
        const url = new URL(details.url)
        const host = url.host
        const headers = details.responseHeaders || {}
        const cookieKey = Object.keys(headers).find((k) => k.toLowerCase() === 'set-cookie')
        if (cookieKey) {
          const list = headers[cookieKey] as string[]
          for (const c of list) {
            const m = c.match(/session_id=([^;]+)/i)
            if (m) cookieStore.set(host, `session_id=${m[1]}`)
          }
        }
      } catch {}
      callback({ responseHeaders: details.responseHeaders })
    })

    // 2) Antes de enviar: remove Origin (skip preflight) + injeta Cookie capturado
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const headers = { ...details.requestHeaders }
      delete headers.Origin
      delete headers.origin
      try {
        const url = new URL(details.url)
        const stored = cookieStore.get(url.host)
        if (stored) {
          const existing = (headers.Cookie || headers.cookie || '').toString()
          // garante session_id presente (sem duplicar)
          if (!/session_id=/i.test(existing)) {
            headers.Cookie = existing ? `${existing}; ${stored}` : stored
          }
        }
      } catch {}
      callback({ requestHeaders: headers })
    })
  }

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:openExternal', async (_e, url: string) => {
    await shell.openExternal(url)
  })
  ipcMain.handle('app:notify', async (_e, opts: { title: string; body?: string }) => {
    new Notification({ title: opts.title, body: opts.body }).show()
  })
  ipcMain.handle('app:pickFolder', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })

  // ---- File system bridge (acesso restrito a arquivos do watch folder) ----
  ipcMain.handle('fs:readBase64', async (_e, { filePath }: { filePath: string }) => {
    const buf = await fs.readFile(filePath)
    return buf.toString('base64')
  })
  ipcMain.handle('fs:size', async (_e, { filePath }: { filePath: string }) => {
    const stat = await fs.stat(filePath)
    return stat.size
  })
  ipcMain.handle('fs:moveTo', async (_e, { src, destDir }: { src: string; destDir: string }) => {
    await fs.mkdir(destDir, { recursive: true })
    const base = path.basename(src)
    const target = path.join(destDir, base)
    try {
      await fs.rename(src, target)
    } catch {
      // cross-device: copia+remove
      const data = await fs.readFile(src)
      await fs.writeFile(target, data)
      await fs.unlink(src)
    }
    return target
  })
  ipcMain.handle('fs:unlink', async (_e, { filePath }: { filePath: string }) => {
    await fs.unlink(filePath)
  })

  createSplash()
  createMainWindow()
  createTray()
  setupUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
