# Parte B — Testes UI ecm_desktop

**Data:** 2026-05-17
**Build:** `release/win-unpacked/AFR ECM Desktop.exe` (v0.1.0, portable)
**Backend:** Odoo 16 @ `localhost:8083` (WSL2 forward)

## Credenciais

```
URL:    http://localhost:8083
DB:     odoo_ecm_desktop_test
User:   admin
Senha:  admin
```

## Seed inicial (criado via odoo-mcp)

| Recurso | Detalhes |
|---|---|
| Storage | `ECM Desktop Storage` (save_type=file) |
| Pastas root | `Contratos`, `Procedimentos`, `Relatórios` |
| Pastas filhas | `Contratos/2025`, `Contratos/2026`, `Procedimentos/POPs` |
| Tags | `Urgente`, `Auditoria` |
| Tipos | `Contrato` (CONTR, restricted, OCR), `POP` (POP, internal, OCR+approval), `Relatório Técnico` (RT, internal) |
| Files | `README-teste.txt` em `Procedimentos` |
| Manual da pasta | `Procedimentos/POPs` tem descrição HTML — testar B10 |

## Como reportar

- Marca cada `- [ ]` → `- [x]` ao passar.
- Falha: troca `- [ ]` → `- [F]` + adiciona nota indentada.
- Erro com texto: copia toast/console exato em bloco `> ...`.
- Após cada bloco (B2, B3 ...) avisa "B3 OK" ou "B3 falha em XYZ".

---

## B1 — Login & boot ✅ (já feito)

- [x] Splash 360×280.
- [x] Tela login: 4 campos visíveis + Entrar.
- [x] Login com credenciais corretas → entra.
- [x] Árvore carregou após restart container.

## B2 — Layout & navegação ✅

- [x] Sidebar visível com árvore.
- [x] Splitter arrastável.
- [x] Double-click splitter reset.
- [x] Click "Todos" → grid mostra README-teste.txt.
- [x] Click pasta → breadcrumb topo.

## B3 — CRUD de pastas ✅

- [x] Ctrl+N / "Nova pasta" → modal.
- [x] Criar pasta raiz → aparece árvore.
- [x] Hover Pencil / F2 → rename modal.
- [x] Renomear + confirma.
- [x] Double-click no nome → rename também.
- [x] Shift+Del pasta vazia → exclui.

## B4 — Upload + ClassifyWizard 🔴

**Fix aplicado:** chown filestore odoo:odoo (permission denied 13 corrigido).

- [x] Selecionar pasta "Contratos / 2026".
- [x] Click "Upload" → escolhe **PDF qualquer**.
- [x] ClassifyWizard abre: tipo "Contrato", tags ["Urgente"], OCR ON.
- [x] Confirma → progress bar rodapé.
- [x] Notif Windows "Upload concluído".
- [x] Aguarda ~30-60s → notif "OCR concluído".
- [x] Repetir com 1 **imagem** (.jpg/.png) em "Relatórios" — thumbnail aparece.
- [x] Drag PDF do Explorer → grid (Win nativo, sem aviso WSLg).

## B5 — Preview PDF + TOC

- [x] Enter / click no PDF → modal preview abre.
- [x] Setas ← → navegam páginas.
- [x] Ctrl+ / Ctrl- zoom.
- [x] **Ctrl+B** → painel "Sumário" lateral aparece.
- [x] Aba "Sumário" mostra outline OU heurística (fonte+bold).
- [x] Click item sumário → pula pra página correta.
- [x] Aba "OCR" mostra texto extraído.
- [x] Esc fecha modal.
- [x] Dark/light: alterna tema → preview mantém fundo correto.

## B6 — Multi-select + Bulk

- [x] Ctrl+Click 2-3 arquivos → BulkActionBar topo aparece.
    - mas não aparece no topo e sim no bottom
- [x] Botões: Mover / Tipo / Tags / Lixeira.
- [x] "Mover" → seleciona "Procedimentos / POPs" → arquivos somem da origem.
    - mas não aparece em mover os diretorios aninhados como um a arvore, é bom colocar com uma melhoria a fazer.
- [x] "Tags" batch → adiciona "Auditoria" em todos.
- [x] Esc → limpa seleção.
- [x] Drag multi (selecionar 2 + arrastar) entre pastas → move.

## B7 — Lixeira

- [x] Selecionar 1 arquivo, Del → some.
- [x] Click "Lixeira" rodapé sidebar → modo trash.
- [x] Arquivo deletado aparece.
- [x] BulkActionBar muda pra "Restaurar" / "Excluir permanente".
- [x] Restaurar → volta origem.
- [x] Sair lixeira.

## B8 — Search + Filtros

- [x] Ctrl+K → search bar foca.
- [x] Digita palavra do PDF com OCR → debounce ~300ms, snippet aparece.
- [x] FilterChips: tipo "Contrato", tag "Urgente", "Com OCR".
- [x] Combinar 2 filtros → resultados intersectam.
- [x] Limpa filtros.

## B9 — FilePropertiesEditor

- [x] Selecionar README-teste.txt → painel direito.
- [x] Click "Editar" canto sup direito painel.
- [x] Trocar Tipo: "POP".
- [x] Trocar Pasta: "Contratos / 2025".
    - Novamente tem que ter a possibilidade de ver as pastas aninhadas para que usuario saiba com está a arvore de diretorios
- [x] Trocar Confid: "Restrito".
- [x] Toggle OCR ON.
- [x] Vencimento: data futura.
- [x] Save → refresh, valores ficam.
- [x] Click "Reproc." → notif OCR rodou.
    - rodou, mas como o arquivo já é um txt ele disse que não tem OCR suportado

## B10 — DirectoryManualPanel

- [x] Click pasta "Procedimentos / POPs".
- [x] Painel mostra **manual** com texto: "Procedimentos Operacionais Padrão... Nomenclatura POP-{setor}-{seq}... Retenção 5 anos".
- [x] Click pasta "Contratos" (sem manual) → painel some/placeholder.

## B11 — Share link

- [x] Selecionar PDF → painel direito → "Compartilhar link".
- [x] Copia URL (formato `http://localhost:8083/ecm/share/<id>/<token>?db=odoo_ecm_desktop_test`).
- [x] Cola em Edge InPrivate / Chrome Incognito → baixa arquivo.
    - deu Internal server Error

## B12 — Watch folder

- [x] Avatar (canto sup direito) → dropdown.
- [x] "Configurações" → /settings.
- [x] Define pasta watched (ex `C:\Users\Afonso\Downloads\watch-test\` — criar dir).
- [x] Pasta destino: "Relatórios".
- [x] Salvar. Voltar pra home.
    - o botao é inicia sincronização
- [x] Copia arquivo pra `watch-test\` no Explorer → upload auto + notif.
    - não apareceu notificação, mas quando eu sai da pasata no ecm_desktop e voltei o arquvco apareceu.

## B13 — UserMenu + Tema + Updater

- [x] Avatar → dropdown.
- [x] Toggle tema dark↔light → instant.
- [x] "Verificar atualizações" → mostra "No published versions" silenciado OU sem toast (benign).
    - não apareceu nada sem toast
- [x] "Sair" → volta login. Re-login OK.

## B14 — Atalhos completos

- [x] Ctrl+N nova pasta
- [x] F2 rename pasta selecionada
- [x] Enter preview arquivo
- [x] Del lixeira (arquivo)
- [x] Shift+Del delete pasta
- [x] Esc clear multi-select / fecha modal
- [x] Ctrl+K search foco
- [x] Ctrl+B toggle Sumário PDF
- [x] Ctrl+/- zoom preview
- [x] ← → navegar páginas preview

---

## Notas / bugs encontrados

<!-- adicionar conforme aparecem -->

### Bug 1 — Upload permission denied [RESOLVIDO]

- Sintoma: `13 Permission denied` em upload.
- Causa: filestore `/var/lib/odoo/filestore/odoo_ecm_desktop_test/` criado pelo container ephemeral do init como `1000:1000`. Live container roda uid `odoo` (101) sem write.
- Fix: `docker exec --user root odoo_engenapp-web-1 chown -R odoo:odoo /var/lib/odoo/filestore/odoo_ecm_desktop_test`.

### Bug 2 — OCR jobs pendentes infinitos [RESOLVIDO]

- Sintoma: jobs OCR stuck em `pending`, nunca processam.
- Causa raíz: cron `Queue Job Runner` pulava DB com warning `Skipping database ... because of modules to install/upgrade/remove`. `_check_version` em `ir_cron.py:164-168` dispara `BadModuleState` se `ir_module_module.latest_version IS NULL` pra `base`. Init `-i afr_ecm` em DB novo deixou `base.latest_version=NULL` (não fez full bootstrap).
- Fix SQL: `UPDATE ir_module_module SET latest_version='16.0.1.3' WHERE name='base';`
- Para futuros DB novos do zero: usar `-i base,afr_ecm` em vez de só `-i afr_ecm` (ou `-u base -i afr_ecm`).

### Bug 3 — Share link Internal Server Error [BACKLOG — não resolvido]

- Sintoma: GET `/ecm/share/<id>/<token>?db=odoo_ecm_desktop_test` → HTTP 500.
- Tentativa 1 (parcial): arquivo `engenapp/engc_os/models/hr_employee_public.py` estava deletado no working tree → restaurado via `git checkout HEAD --`. Web container restartado. **Mas erro persiste no app.**
- Pendente investigar: novo trace dos logs após restart, possível causa em controller `addons/afr_ecm/controllers/share.py` ou token mismatch, ou outro path no engc_os ainda quebrado.

### Bug 4 — BulkActionBar posição [BACKLOG]

- B6: BulkActionBar aparece no **bottom**, não topo como checklist sugeria.
- Verificar se é intencional. Se sim, ajustar doc; se não, mover pra topo.

### Bug 5 — Pasta picker sem árvore aninhada [UX BACKLOG]

- B6 "Mover" e B9 "Trocar Pasta" mostram lista flat de pastas, sem hierarquia visual.
- Solução: render TreePicker com indent + ícones folder ou caminho completo (`Contratos / 2025`).

### Bug 6 — Watch folder sem notif + sem auto-refresh [UX BUG]

- B12: arquivo copiado pra pasta watched faz upload OK, mas:
  - Nenhuma notificação OS aparece.
  - Grid não atualiza automaticamente — precisa sair da pasta e voltar.
- Provável: faltam invalidar React Query cache + chamar `showNotification` no callback `useWatchFolder`.

### Bug 7 — Updater sem feedback visual [UX BUG]

- B13: "Verificar atualizações" não mostra nada (nem toast "Já atualizado", nem "No published versions").
- Solução: adicionar toast informativo no `useUpdater.checkForUpdates()` callback de sucesso/no-update.
