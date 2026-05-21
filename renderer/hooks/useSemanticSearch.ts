'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { semanticSearch, SemanticSearchHit } from '@/lib/ecm-api'

const MIN_CHARS = 2
const DEBOUNCE_MS = 400

export function useSemanticSearch(query: string, enabled: boolean) {
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const active = enabled && debounced.length >= MIN_CHARS

  const q = useQuery({
    queryKey: ['semantic-search', debounced],
    queryFn: () => semanticSearch(debounced, true),
    enabled: active,
    staleTime: 30_000,
  })

  return {
    query: debounced,
    isActive: active,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    hits: (q.data?.results ?? []) as SemanticSearchHit[],
    error: q.error ?? (q.data?.error ? new Error(q.data.error) : null),
  }
}
