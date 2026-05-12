'use client'

import { useRouter } from 'next/navigation'

/**
 * Hook de navegação compatível com Next `output: export` rodando em file://
 * (Electron prod build).
 *
 * Em browser/dev HTTP: usa next/navigation router.replace/push normal.
 * Em file:// (build estático): `router.replace('/login')` resolveria pra
 * `file:///C:/login/` (root drive) e falharia com "Not allowed to load
 * local resource". Aqui calculamos um caminho RELATIVO baseado em
 * `window.location.pathname` apontando pro index.html da rota destino.
 */
export function useNav() {
  const router = useRouter()

  function go(target: string, mode: 'push' | 'replace' = 'push') {
    if (typeof window === 'undefined') return
    if (window.location.protocol === 'file:') {
      const targetClean = '/' + target.replace(/^\/+/, '').replace(/\/+$/, '')
      // pathname atual: ".../renderer/out/" ou ".../renderer/out/login/index.html"
      // base: tudo antes do segmento de rota. Achamos "renderer/out/" como âncora.
      const here = window.location.pathname
      const idx = here.indexOf('/renderer/out/')
      const base = idx >= 0
        ? here.slice(0, idx + '/renderer/out/'.length)
        : here.replace(/[^/]+\/?$/, '')
      // trailingSlash:false → '/' = index.html, outras = <route>.html
      const dest = targetClean === '/'
        ? base + 'index.html'
        : base + targetClean.slice(1) + '.html'
      const fullUrl = window.location.origin + dest
      if (mode === 'replace') window.location.replace(fullUrl)
      else window.location.href = fullUrl
      return
    }
    if (mode === 'replace') router.replace(target)
    else router.push(target)
  }

  return {
    push: (t: string) => go(t, 'push'),
    replace: (t: string) => go(t, 'replace'),
    back: () => {
      if (typeof window === 'undefined') return
      if (window.history.length > 1) window.history.back()
      else go('/', 'replace')
    },
  }
}
