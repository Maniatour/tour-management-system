'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Loader2, Star } from 'lucide-react'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { GuideLinkedReviewRow, GuideReviewSummary } from '@/lib/guideReviews'
import { getReviewSourceLabel, isReviewSource } from '@/lib/reviewSources'
import { formatLasVegasDate } from '@/lib/dailyReport/dateUtils'
import { useAuth } from '@/contexts/AuthContext'
import {
  detectGuidePreferredLanguage,
  type SupportedLocale,
} from '@/lib/guideLanguageDetection'
import { supabase } from '@/lib/supabase'

type Props = {
  userEmail: string | null | undefined
  locale: string
  onReviewsRead?: () => void
}

type ApiResponse = {
  ok?: boolean
  summary?: GuideReviewSummary
  reviews?: GuideLinkedReviewRow[]
  error?: string
}

export function GuideReviewNotificationLayer({
  userEmail,
  locale,
  onReviewsRead,
}: Props) {
  const { isInitialized, isSimulating, simulatedUser } = useAuth()
  const [guideLocale, setGuideLocale] = useState<SupportedLocale>(
    locale === 'en' ? 'en' : 'ko'
  )
  const [queue, setQueue] = useState<GuideLinkedReviewRow[]>([])
  const [acknowledging, setAcknowledging] = useState(false)

  const emailKey = (isSimulating && simulatedUser?.email
    ? simulatedUser.email
    : userEmail || '').toLowerCase()
  const isKo = guideLocale === 'ko'

  useEffect(() => {
    if (!emailKey) {
      setGuideLocale(locale === 'en' ? 'en' : 'ko')
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('team')
        .select('languages')
        .ilike('email', emailKey)
        .maybeSingle()
      if (cancelled) return
      setGuideLocale(detectGuidePreferredLanguage(data, emailKey))
    })()
    return () => {
      cancelled = true
    }
  }, [emailKey, locale])

  const loadUnread = useCallback(async () => {
    if (!emailKey || !isInitialized) {
      setQueue([])
      return
    }

    try {
      const headers: Record<string, string> = {}
      if (isSimulating && simulatedUser?.email) {
        headers['x-simulated-user-email'] = simulatedUser.email
      }

      const res = await fetchApiWithAuth('/api/guide/reviews', { headers })
      const data = (await res.json()) as ApiResponse
      if (!res.ok || !data.ok) return

      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      const unread = (data.reviews ?? []).filter((review) => {
        if (review.isRead) return false
        const importedMs = new Date(review.importedAt).getTime()
        if (Number.isNaN(importedMs)) return true
        return importedMs >= thirtyDaysAgo
      })
      setQueue(unread)
    } catch (e) {
      console.error('GuideReviewNotificationLayer', e)
    }
  }, [emailKey, isInitialized, isSimulating, simulatedUser?.email])

  useEffect(() => {
    if (!emailKey || !isInitialized) return
    void loadUnread()
    const interval = window.setInterval(() => void loadUnread(), 60000)
    return () => window.clearInterval(interval)
  }, [emailKey, isInitialized, loadUnread])

  const current = queue[0] ?? null

  const handleAcknowledge = async () => {
    if (!current) return
    setAcknowledging(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (isSimulating && simulatedUser?.email) {
        headers['x-simulated-user-email'] = simulatedUser.email
      }

      const res = await fetchApiWithAuth('/api/guide/reviews/read', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reviewIds: [current.id] }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'ack_failed')
      }

      setQueue((prev) => prev.filter((review) => review.id !== current.id))
      window.dispatchEvent(new CustomEvent('guide-reviews-refresh'))
      onReviewsRead?.()
    } catch (e) {
      console.error('GuideReviewNotificationLayer ack', e)
      alert(
        isKo
          ? '확인 처리에 실패했습니다.'
          : 'Failed to mark review as read.'
      )
    } finally {
      setAcknowledging(false)
    }
  }

  if (!emailKey || !current) return null

  const sourceLabel = isReviewSource(current.reviewSource)
    ? getReviewSourceLabel(current.reviewSource, guideLocale)
    : current.reviewSource
  const productName = isKo
    ? current.productNameKo || current.productNameEn
    : current.productNameEn || current.productNameKo

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Bell className="h-5 w-5 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-gray-900">
            {isKo ? '새 리뷰가 연결되었습니다' : 'New review linked to you'}
          </h2>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < current.rating ? 'fill-current' : 'text-muted-foreground/30'
                  }`}
                  aria-hidden
                />
              ))}
            </div>
            <span className="text-sm font-medium text-foreground">
              {current.authorName || (isKo ? '고객' : 'Guest')}
            </span>
            {current.reviewCreatedAt ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatLasVegasDate(current.reviewCreatedAt, guideLocale)}
              </span>
            ) : null}
            <span className="text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {sourceLabel}
            </span>
          </div>

          {productName ? (
            <p className="text-sm text-muted-foreground">{productName}</p>
          ) : null}
          {current.tourDate ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {isKo ? '투어일' : 'Tour'}: {current.tourDate}
            </p>
          ) : null}

          {current.comment ? (
            <GoogleReviewCommentPreview comment={current.comment} isKo={isKo} />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isKo ? '리뷰 내용 없음' : 'No review text'}
            </p>
          )}

          {queue.length > 1 ? (
            <p className="text-xs text-muted-foreground">
              {isKo
                ? `추가 ${queue.length - 1}건의 새 리뷰가 있습니다.`
                : `${queue.length - 1} more new review(s) waiting.`}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end border-t px-5 py-4">
          <button
            type="button"
            disabled={acknowledging}
            onClick={() => void handleAcknowledge()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {acknowledging ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            {isKo ? '확인' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
