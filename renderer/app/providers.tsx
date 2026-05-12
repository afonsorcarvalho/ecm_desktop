'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { odoo } from '@/lib/odoo-client'

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  )

  // Configura OdooClient assim que o authStore hidratar (persisted baseUrl).
  // Necessário em hard-navigation entre .html (file:// build) — sem isso,
  // useQuery em outras páginas (settings) falhava porque odoo client estava
  // sem baseURL.
  useEffect(() => {
    const baseUrl = useAuthStore.getState().baseUrl
    if (baseUrl && !odoo.getBaseUrl()) {
      odoo.configure(baseUrl)
    }
    const unsub = useAuthStore.subscribe((s) => {
      if (s.baseUrl && s.baseUrl !== odoo.getBaseUrl()) {
        odoo.configure(s.baseUrl)
      }
    })
    return unsub
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={qc}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: '!bg-bg-soft !text-ink !border !border-line',
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
