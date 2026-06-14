'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchSiteAccessMatrixOverrides,
  rowsToPatchMap,
  type SiteAccessPatchMap,
} from '@/lib/site-access-matrix-overrides'
import { readSiteAccessPatchCache, writeSiteAccessPatchCache } from '@/lib/siteAccessPatchCache'
import { scheduleDeferredWork } from '@/lib/scheduleDeferredWork'

export type SiteAccessMatrixPatchContextValue = {
  patchMap: SiteAccessPatchMap
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const SiteAccessMatrixPatchContext = createContext<SiteAccessMatrixPatchContextValue | null>(null)

function initialPatchState(): { patchMap: SiteAccessPatchMap; hasCache: boolean } {
  const cachedRows = readSiteAccessPatchCache()
  return {
    patchMap: cachedRows ? rowsToPatchMap(cachedRows) : new Map(),
    hasCache: cachedRows !== null,
  }
}

export function SiteAccessMatrixPatchProvider({ children }: { children: React.ReactNode }) {
  const initial = initialPatchState()
  const hadCacheOnMount = useRef(initial.hasCache)
  const [patchMap, setPatchMap] = useState<SiteAccessPatchMap>(initial.patchMap)
  const [loading, setLoading] = useState(!initial.hasCache)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (!hadCacheOnMount.current) {
      setLoading(true)
    }
    const { rows, error: fetchErr } = await fetchSiteAccessMatrixOverrides(supabase)
    if (fetchErr) {
      setError(fetchErr)
      setPatchMap((prev) => (prev.size > 0 ? prev : new Map()))
    } else {
      setError(null)
      setPatchMap(rowsToPatchMap(rows))
      writeSiteAccessPatchCache(rows)
    }
    hadCacheOnMount.current = false
    setLoading(false)
  }, [])

  useEffect(() => {
    return scheduleDeferredWork(() => {
      void refetch()
    })
  }, [refetch])

  const value = useMemo(
    () => ({ patchMap, loading, error, refetch }),
    [patchMap, loading, error, refetch]
  )

  return (
    <SiteAccessMatrixPatchContext.Provider value={value}>{children}</SiteAccessMatrixPatchContext.Provider>
  )
}

/** Provider 밖에서는 빈 맵·no-op refetch(레거시 경로) */
export function useSiteAccessMatrixPatchContext(): SiteAccessMatrixPatchContextValue {
  const v = useContext(SiteAccessMatrixPatchContext)
  if (!v) {
    return {
      patchMap: new Map(),
      loading: false,
      error: null,
      refetch: async () => {},
    }
  }
  return v
}
