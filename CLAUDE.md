# CLAUDE.md — ecm_desktop

## Repositório

Este diretório é um **git submodule** referenciado pelo monorepo
`odoo_engenapp` em `ecm_desktop/`.

| Item | Valor |
|---|---|
| Repo standalone | `https://github.com/afonsorcarvalho/ecm_desktop.git` |
| Branch padrão | `main` |
| Path no monorepo | `ecm_desktop` |
| Conversão para submodule | 2026-05-12 (commit monorepo `b2bc229`) |

## Regras de Commit / Push (CRÍTICO)

**Commits e pushes deste cliente SEMPRE de dentro deste diretório.** Nunca
operar via path do monorepo (`ecm_desktop/...`).

```bash
cd /home/afonso/docker/odoo_engenapp/ecm_desktop
git add <paths-relativos-ao-módulo>     # ex: renderer/app/page.tsx
git commit -m "feat(ecm_desktop): ..."
git push origin main
```

Após push, opcionalmente atualizar pointer no monorepo:
```bash
cd /home/afonso/docker/odoo_engenapp
git add ecm_desktop
git commit -m "chore: bump ecm_desktop submodule"
git push
```

**Agentes (haiku):** invocar `git-commit-push` com `cwd` apontando pra
ESTE dir, não pro monorepo.

## Stack

- Electron 31 (main) + Next.js 14 (renderer) + TypeScript
- Tailwind CSS + Radix UI + Zustand + React Query + next-themes
- `react-pdf` (versão pinada em `pdfjs-dist@4.8.69` — não atualizar sem testar)
- Backend Odoo (afr_ecm + OCA dms) consumido via JSON-RPC

## Comandos

```bash
# Dev (renderer apenas, browser)
cd renderer && npm run dev      # http://localhost:3000

# Dev completo (Electron + Next.js — precisa WSLg/GUI)
npm run dev

# Build distribuível Windows (NSIS)
npm run dist
```

## Gotchas críticos (memória completa em
`~/.claude/projects/.../memory/project_ecm_desktop.md`)

1. **`react-pdf` precisa `pdfjs-dist@4.8.69`** exato; outras versões
   quebram com "API/Worker version mismatch". Worker em
   `renderer/public/pdf.worker.min.mjs` (postinstall copia).

2. **Fetch `/web/content`** precisa `cache: 'no-store'` + cache-buster
   `?_t=Date.now()` pra evitar 304 com body vazio na 2ª abertura.

3. **Proxy `/api/odoo/[...path]/route.ts`** evita CORS. Aceita target
   via header `X-Odoo-Target` OU query `?__t=...` (img tag não envia
   headers).

4. **Share URL precisa `?db=<dbname>`** porque Odoo serve múltiplas DBs
   sem dbfilter.

5. **Tailwind config com CSS vars** precisa dev server restart se mudou
   config após dev rodando — HMR não pega.

6. **Drag-drop interno** usa MIME custom (`application/x-ecm-file`,
   `application/x-ecm-dir`); `UploadDropzone` global só intercepta tipo
   `Files` externo — sem conflito.

7. **Drag-drop Windows Explorer → Electron WSL (WSLg) NÃO funciona.**
   Wayland/WSLg não transfere bytes de arquivos do host Windows pro
   guest Linux. O drop event chega no renderer mas `dataTransfer.files`
   vem vazio. UploadDropzone mostra toast explicando. Alternativas:
   (a) botão "Upload" (input file picker), (b) Watch folder (`/settings`),
   (c) build Windows nativo via `npm run dist` (gera .exe que roda no
   Windows host onde drag funciona normalmente).

8. **VSCode integrated terminal exporta `ELECTRON_RUN_AS_NODE=1`** (pro
   JS debug bootloader). Isso faz Electron rodar como Node puro, e
   `require("electron")` retorna `undefined`. Sintoma:
   `TypeError: Cannot read properties of undefined (reading 'whenReady')`
   em `main.js`. Fix: script `dev:electron` prefixa
   `cross-env ELECTRON_RUN_AS_NODE=` pra limpar a var. Se rodar manual,
   use `unset ELECTRON_RUN_AS_NODE` antes. Confirme com
   `node_modules/.bin/electron --version` (deve mostrar `v31.x.x`, NÃO
   `v20.x.x` que é a versão Node embutida).

## Convenções

- Componentes em `renderer/components/`
- Hooks em `renderer/hooks/`
- Stores Zustand em `renderer/store/`
- API wrappers em `renderer/lib/ecm-api.ts`
- Atalhos globais em `renderer/app/page.tsx` useEffect onKey:
  Ctrl+N (nova pasta), F2 (renomear), Enter (preview), Del (lixeira
  arquivo), Shift+Del (lixeira pasta)
