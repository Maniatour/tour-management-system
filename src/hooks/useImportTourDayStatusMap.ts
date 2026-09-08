import { useEffect, useMemo, useRef, useState } from 'react'
import { isAbortLikeError } from '@/lib/supabase'
import { fetchImportTourDayStatusMap } from '@/lib/fetchImportTourDayStatus'
import {
  importTourDayStatusKey,
  parseImportTourDate,
  type ImportTourDayStatusLookupKey,
  type ImportTourDayStatusSummary,
} from '@/lib/importTourDayStatus'

function serializeKeys(keys: ImportTourDayStatusLookupKey[]): string {
  const unique = new Set<string>()
  for (const key of keys) {
    const productId = String(key.productId || '').trim()
    const tourDate = parseImportTourDate(key.tourDate)
    if (!productId || !tourDate) continue
    unique.add(importTourDayStatusKey(productId, tourDate))
  }
  return [...unique].sort().join('|')
}

export function useImportTourDayStatusMap(keys: ImportTourDayStatusLookupKey[]) {
  const [byKey, setByKey] = useState<Map<string, ImportTourDayStatusSummary>>(new Map())
  const [loading, setLoading] = useState(() => serializeKeys(keys).length > 0)
  const cacheRef = useRef<Map<string, ImportTourDayStatusSummary>>(new Map())
  const keySig = serializeKeys(keys)

  const lookupKeys = useMemo(() => {
    const seen = new Set<string>()
    const out: ImportTourDayStatusLookupKey[] = []
    for (const key of keys) {
      const productId = String(key.productId || '').trim()
      const tourDate = parseImportTourDate(key.tourDate)
      if (!productId || !tourDate) continue
      const mapKey = importTourDayStatusKey(productId, tourDate)
      if (seen.has(mapKey)) continue
      seen.add(mapKey)
      out.push({ productId, tourDate })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keySig is the stable serialization
  }, [keySig])

  useEffect(() => {
    let cancelled = false
    const missing = lookupKeys.filter((key) => !cacheRef.current.has(importTourDayStatusKey(key.productId, key.tourDate)))
    if (missing.length === 0) {
      setByKey(new Map(cacheRef.current))
      setLoading(false)
      return
    }

    setLoading(true)
    void fetchImportTourDayStatusMap(missing)
      .then((next) => {
        if (cancelled) return
        next.forEach((value, mapKey) => cacheRef.current.set(mapKey, value))
        setByKey(new Map(cacheRef.current))
      })
      .catch((err: unknown) => {
        if (cancelled || isAbortLikeError(err)) return
        console.error('해당일 투어 현황 조회 실패', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [lookupKeys])

  return { byKey, loading }
}
