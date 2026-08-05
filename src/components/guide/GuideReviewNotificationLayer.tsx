'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, ChevronLeft, ChevronRight, Loader2, Star } from 'lucide-react'
import GoogleReviewCommentPreview from '@/components/admin/google-reviews/GoogleReviewCommentPreview'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { GuideLinkedReviewRow, GuideReviewSummary } from '@/lib/guideReviews'
import { getReviewSourceLabel, isReviewSource } from '@/lib/reviewSources'
import { formatLasVegasDate, todayInLasVegas, toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
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
  const [activeIndex, setActiveIndex] = useState(0)
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
      setActiveIndex(0)
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

      // 오늘(LV) 이후 업로드된 미확인 리뷰만 알림 모달 대상
      const todayYmd = todayInLasVegas()
      const unread = (data.reviews ?? []).filter((review) => {
        if (review.isRead) return false
        const importedYmd = toLasVegasDateKey(review.importedAt)
        if (!importedYmd) return false
        return importedYmd >= todayYmd
      })
      setQueue(unread)
      setActiveIndex((idx) =>
        unread.length === 0 ? 0 : Math.min(idx, unread.length - 1)
      )
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

  const current = queue[activeIndex] ?? null
  const canGoPrev = activeIndex > 0
  const canGoNext = activeIndex < queue.length - 1

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

      const nextQueue = queue.filter((review) => review.id !== current.id)
      setQueue(nextQueue)
      setActiveIndex((idx) =>
        nextQueue.length === 0 ? 0 : Math.min(idx, nextQueue.length - 1)
      )
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
      <div className="flex w-full max-w-lg max-h-[min(90dvh,920px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-5 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {isKo ? '새로운 리뷰가 접수 되었습니다.' : 'A new review has been received.'}
            </h2>
          </div>
          {queue.length > 1 ? (
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {activeIndex + 1} / {queue.length}
            </span>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
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
            <GoogleReviewCommentPreview
              key={current.id}
              comment={current.comment}
              isKo={isKo}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {isKo ? '리뷰 내용 없음' : 'No review text'}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-4">
          <button
            type="button"
            disabled={!canGoPrev || acknowledging}
            onClick={() => setActiveIndex((idx) => Math.max(0, idx - 1))}
            aria-label={isKo ? '이전 리뷰' : 'Previous review'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>

          <button
            type="button"
            disabled={acknowledging}
            onClick={() => void handleAcknowledge()}
            className="inline-flex min-w-[7.5rem] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {acknowledging ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            {isKo ? '확인' : 'OK'}
          </button>

          <button
            type="button"
            disabled={!canGoNext || acknowledging}
            onClick={() =>
              setActiveIndex((idx) => Math.min(queue.length - 1, idx + 1))
            }
            aria-label={isKo ? '다음 리뷰' : 'Next review'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
