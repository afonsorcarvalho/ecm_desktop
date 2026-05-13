import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface TocEntry {
  title: string
  page: number
  level: number
  children: TocEntry[]
}

export interface TocResult {
  source: 'outline' | 'heuristic'
  entries: TocEntry[]
  flat: TocEntry[]
}

type RawOutlineItem = {
  title: string
  dest: string | any[] | null
  items?: RawOutlineItem[]
}

async function resolvePage(pdf: PDFDocumentProxy, dest: string | any[] | null): Promise<number> {
  if (!dest) return 0
  try {
    const resolved = typeof dest === 'string' ? await pdf.getDestination(dest) : dest
    if (!resolved || !Array.isArray(resolved) || !resolved[0]) return 0
    const idx = await pdf.getPageIndex(resolved[0])
    return idx + 1
  } catch {
    return 0
  }
}

async function walkOutline(
  pdf: PDFDocumentProxy,
  items: RawOutlineItem[],
  level: number,
): Promise<TocEntry[]> {
  const out: TocEntry[] = []
  for (const it of items) {
    const page = await resolvePage(pdf, it.dest ?? null)
    const children = it.items && it.items.length ? await walkOutline(pdf, it.items, level + 1) : []
    out.push({
      title: (it.title || '').trim() || 'Sem título',
      page,
      level,
      children,
    })
  }
  return out
}

export async function extractOutline(pdf: PDFDocumentProxy): Promise<TocResult | null> {
  let raw: RawOutlineItem[] | null = null
  try {
    raw = (await pdf.getOutline()) as RawOutlineItem[] | null
  } catch {
    return null
  }
  if (!raw || raw.length === 0) return null
  const entries = await walkOutline(pdf, raw, 0)
  return { source: 'outline', entries, flat: flattenToc(entries) }
}

export async function extractHeuristic(
  pdf: PDFDocumentProxy,
  opts: { maxPages?: number; maxItems?: number; timeoutMs?: number } = {},
): Promise<TocResult> {
  const maxPages = Math.min(opts.maxPages ?? 50, pdf.numPages)
  const maxItems = opts.maxItems ?? 30
  const timeoutMs = opts.timeoutMs ?? 8000
  const start = Date.now()

  type Cand = { page: number; text: string; size: number; bold: boolean }
  const candidates: Cand[] = []

  for (let p = 1; p <= maxPages; p += 5) {
    if (Date.now() - start > timeoutMs) break
    const batch: Promise<void>[] = []
    for (let q = p; q < p + 5 && q <= maxPages; q++) {
      batch.push(
        (async () => {
          try {
            const page = await pdf.getPage(q)
            const tc = await page.getTextContent()
            for (const it of tc.items as any[]) {
              const text = (it.str || '').trim()
              if (text.length < 3) continue
              const size = Math.round((it.transform?.[3] ?? it.height ?? 0) * 100) / 100
              const fontName = (it.fontName || '').toLowerCase()
              const bold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy')
              if (size <= 0) continue
              candidates.push({ page: q, text, size, bold })
            }
          } catch {
            // ignora página que falha
          }
        })(),
      )
    }
    await Promise.all(batch)
  }

  if (candidates.length === 0) {
    return { source: 'heuristic', entries: [], flat: [] }
  }

  const uniqueSizes = Array.from(new Set(candidates.map((c) => c.size))).sort((a, b) => b - a)
  const topSizes = uniqueSizes.slice(0, 3)
  if (topSizes.length === 0) {
    return { source: 'heuristic', entries: [], flat: [] }
  }
  const sizeRank = new Map<number, number>(topSizes.map((s, i) => [s, i]))
  const minSize = topSizes[topSizes.length - 1]

  candidates.sort((a, b) => (a.page - b.page) || (b.size - a.size))

  const entries: TocEntry[] = []
  const recent: string[] = []
  for (const c of candidates) {
    if (entries.length >= maxItems) break
    const isHeading = c.size >= minSize || (c.bold && c.size >= minSize * 0.85)
    if (!isHeading) continue
    if (recent.includes(c.text)) continue
    recent.push(c.text)
    if (recent.length > 3) recent.shift()
    const level = sizeRank.get(c.size) ?? 2
    entries.push({ title: c.text, page: c.page, level, children: [] })
  }

  return { source: 'heuristic', entries, flat: entries.slice() }
}

export function flattenToc(entries: TocEntry[]): TocEntry[] {
  const out: TocEntry[] = []
  function walk(items: TocEntry[]) {
    for (const it of items) {
      out.push(it)
      if (it.children.length) walk(it.children)
    }
  }
  walk(entries)
  return out
}
