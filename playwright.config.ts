import { defineConfig } from '@playwright/test'

/**
 * Smoke E2E para o renderer Next.js (browser).
 * O renderer dev server precisa estar rodando em http://localhost:3000.
 * Use `cd renderer && npm run dev` em outro terminal antes de `npx playwright test`.
 *
 * Para testar o app Electron empacotado, ver `e2e/electron.spec.ts.example`
 * (não automatizado por padrão — requer GUI/WSLg).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
