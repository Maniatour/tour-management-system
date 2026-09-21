'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import type { AdminGoogleReviewRow } from '@/lib/googleReviewAdmin'
import {
  mergeOtaPlatformWithLocalCheck,
  writeOtaReviewLocalCheck,
  type OtaReviewManualCheckStatus,
  type OtaReviewPlatformStatus,
  type ReviewClassificationOtaSource,
} from '@/lib/reviewClassificationTodo'

type QueueResponse = {
  ok?: boolean
  todayKey?: string
  googleReviews?: AdminGoogleReviewRow[]
  platforms?: OtaReviewPlatformStatus[]
  workCount?: number
  error?: string
}

type CheckResponse = {
  ok?: boolean
  check?: {
    source: ReviewClassificationOtaSource
    checkStatus: OtaReviewManualCheckStatus
    checkedAt: string
    checkedByEmail: string
  }
  error?: string
}

export function useReviewClassificationQueue(enabled = true) {
  const [googleReviews, setGoogleReviews] = useState<AdminGoogleReviewRow[]>([])
  const [platforms, setPlatforms] = useState<OtaReviewPlatformStatus[]>([])
  const [todayKey, setTodayKey] = useState(() => todayInLasVegas())
  const [loading, setLoading] = useState(false)
  const [savingSource, setSavingSource] = useState<ReviewClassificationOtaSource | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setGoogleReviews([])
      setPlatforms([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApiWithAuth('/api/admin/todo/review-classification')
      const data = (await res.json()) as QueueResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'queue_failed')
      }
      setTodayKey(data.todayKey || todayInLasVegas())
      setGoogleReviews(data.googleReviews ?? [])
      setPlatforms((data.platforms ?? []).map(mergeOtaPlatformWithLocalCheck))
    } catch (err) {
      console.error('[useReviewClassificationQueue]', err)
      setError(err instanceof Error ? err.message : 'queue_failed')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  const markOtaCheck = useCallback(
    async (source: ReviewClassificationOtaSource, status: OtaReviewManualCheckStatus) => {
      setSavingSource(source)
      try {
        const res = await fetchApiWithAuth('/api/admin/todo/review-classification/ota-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, status }),
        })
        const data = (await res.json()) as CheckResponse
        const fallbackAt = new Date().toISOString()
        const next = {
          checkStatus: data.check?.checkStatus ?? status,
          checkedAt: data.check?.checkedAt ?? fallbackAt,
          checkedByEmail: data.check?.checkedByEmail ?? null,
        }
        writeOtaReviewLocalCheck(source, next)
        setPlatforms((prev) =>
          prev.map((platform) =>
            platform.source === source
              ? {
                  ...platform,
                  ...next,
                }
              : platform
          )
        )
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'check_failed')
        }
      } finally {
        setSavingSource(null)
      }
    },
    []
  )

  const removeGoogleReview = useCallback((reviewId: string) => {
    setGoogleReviews((prev) => prev.filter((review) => review.id !== reviewId))
  }, [])

  const patchGoogleReview = useCallback((review: AdminGoogleReviewRow) => {
    setGoogleReviews((prev) =>
      prev.map((row) => (row.id === review.id ? review : row)).filter((row) => !row.tourId && !row.excludeStaffRating)
    )
  }, [])

  return {
    googleReviews,
    platforms,
    todayKey,
    loading,
    savingSource,
    error,
    reload,
    markOtaCheck,
    removeGoogleReview,
    patchGoogleReview,
  }
}
