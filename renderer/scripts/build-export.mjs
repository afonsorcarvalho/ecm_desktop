#!/usr/bin/env node
/**
 * Build estático do renderer pro Electron prod.
 *
 * Move temporariamente `app/api/` pra fora antes de rodar `next build`
 * porque API routes com `dynamic = 'force-dynamic'` (proxy /api/odoo)
 * são incompatíveis com `output: 'export'`. Em produção Electron, o
 * renderer carrega via file:// e `OdooClient` faz fetch direto pro
 * Odoo (sem proxy), então a rota não é necessária no bundle final.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const API_DIR = path.join(ROOT, 'app', 'api')
const STASH_DIR = path.join(ROOT, '.api-stash')

function stash() {
  if (fs.existsSync(API_DIR)) {
    fs.renameSync(API_DIR, STASH_DIR)
    console.log('[build-export] stashed app/api → .api-stash')
  }
}

function restore() {
  if (fs.existsSync(STASH_DIR)) {
    if (fs.existsSync(API_DIR)) fs.rmSync(API_DIR, { recursive: true, force: true })
    fs.renameSync(STASH_DIR, API_DIR)
    console.log('[build-export] restored .api-stash → app/api')
  }
}

// Safety: restaura no exit (incluindo erro)
process.on('exit', restore)
process.on('SIGINT', () => { restore(); process.exit(130) })
process.on('SIGTERM', () => { restore(); process.exit(143) })

try {
  stash()
  execSync('cross-env ELECTRON_EXPORT=1 next build', {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env, ELECTRON_EXPORT: '1' },
  })
} catch (err) {
  restore()
  process.exit(typeof err?.status === 'number' ? err.status : 1)
}
