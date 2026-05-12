import { test, expect } from '@playwright/test'

/**
 * Smoke test do renderer Next.js. Garante que a página de login carrega
 * sem erros JS e que os campos essenciais estão presentes.
 *
 * Pré-requisito: `cd renderer && npm run dev` rodando em localhost:3000.
 */

test.describe('login screen', () => {
  test('renderiza campos URL, DB, usuário, senha e botão Entrar', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/login')

    await expect(page.getByText('AFR ECM Desktop')).toBeVisible()
    await expect(page.getByText(/URL do servidor/i)).toBeVisible()
    await expect(page.getByText(/Banco de dados/i)).toBeVisible()
    await expect(page.getByText(/Usuário/i)).toBeVisible()
    await expect(page.getByText(/Senha/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Entrar/i })).toBeEnabled()

    // permite warnings, mas não erros críticos como "Failed to compile"
    const critical = consoleErrors.filter((e) => /failed to compile|uncaught/i.test(e))
    expect(critical, `Erros críticos no console: ${critical.join(' | ')}`).toHaveLength(0)
  })

  test('toast Network Error quando credenciais invalidas + servidor inacessível', async ({ page }) => {
    await page.goto('/login')
    // não muda URL servidor — assume inacessível na CI
    await page.getByLabel(/Banco de dados/i).fill('odoo_inexistente_test')
    await page.getByLabel(/Usuário/i).fill('admin')
    await page.getByLabel(/Senha/i).fill('senha-errada')
    await page.getByRole('button', { name: /Entrar/i }).click()
    // aguarda toast aparecer (react-hot-toast renderiza role status)
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 8_000 })
  })
})
