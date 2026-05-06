'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchSiteAccessMatrixOverrides,
  rowsToPatchMap,
  type SiteAccessPatchMap,
} from '@/lib/site-access-matrix-overrides'

export type SiteAccessMatrixPatchContextValue = {
  patchMap: SiteAccessPatchMap
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const SiteAccessMatrixPatchContext = createContext<SiteAccessMatrixPatchContextValue | null>(null)

export function SiteAccessMatrixPatchProvider({ children }: { children: React.ReactNode }) {
  const [patchMap, setPatchMap] = useState<SiteAccessPatchMap>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { rows, error: fetchErr } = await fetchSiteAccessMatrixOverrides(supabase)
    if (fetchErr) {
      setError(fetchErr)
      setPatchMap(new Map())
    } else {
      setError(null)
      setPatchMap(rowsToPatchMap(rows))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
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
