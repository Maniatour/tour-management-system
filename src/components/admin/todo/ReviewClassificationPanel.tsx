'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { TodoPanelStatusButtons } from '@/components/admin/todo/TodoPanelStatusButtons'
import ReviewClassificationClassifyModal from '@/components/admin/todo/ReviewClassificationClassifyModal'
import {
  GoogleReviewQueueRow,
  OtaPlatformRow,
} from '@/components/admin/todo/ReviewClassificationRows'
import { useTodoPanelAutoComplete } from '@/hooks/useTodoPanelAutoComplete'
import { useReviewClassificationQueue } from '@/hooks/useReviewClassificationQueue'
import { getTodoPanelAutoCompleteMode } from '@/lib/todoPanelAutoComplete'
import { todayInLasVegas } from '@/lib/dailyReport/dateUtils'
import type { AdminGoogleReviewRow } from '@/lib/googleReviewAdmin'
import {
  findReviewClassificationLinkedTodo,
  isOtaReviewPlatformDue,
  readReviewClassificationLocalCompleted,
  reviewClassificationCompletionDateKey,
  reviewClassificationPanelTitle,
  reviewClassificationWorkCount,
  writeReviewClassificationLocalCompleted,
  type ReviewClassificationLinkedTodo,
} from '@/lib/reviewClassificationTodo'

type ReviewClassificationPanelProps = {
  locale: string
  variant?: 'panel' | 'list'
  className?: string
  linkedTodos?: Array<ReviewClassificationLinkedTodo & { title?: string | null }>
  onToggleLinkedTodo?: (todo: ReviewClassificationLinkedTodo, completed: boolean) => Promise<void>
  onCompletedChange?: (completed: boolean) => void
  onEditRequest?: () => void
  onHold?: boolean
  holdEnabled?: boolean
  onToggleHold?: () => void
  holdBusy?: boolean
  holdDisabledHint?: string
  queryEnabled?: boolean
}

const EMPTY_LINKED_TODOS: Array<ReviewClassificationLinkedTodo & { title?: string | null }> = []

export function ReviewClassificationPanel({
  locale,
  variant = 'list',
  className = '',
  linkedTodos = EMPTY_LINKED_TODOS,
  onToggleLinkedTodo,
  onCompletedChange,
  onEditRequest,
  onHold = false,
  holdEnabled = false,
  onToggleHold,
  holdBusy = false,
  holdDisabledHint,
  queryEnabled = true,
}: ReviewClassificationPanelProps) {
  const isKo = locale === 'ko'
  const isList = variant === 'list'
  const completionDateKey = useMemo(() => reviewClassificationCompletionDateKey(), [])
  const linkedTodo = findReviewClassificationLinkedTodo(linkedTodos)
  const [localCompleted, setLocalCompleted] = useState(() =>
    readReviewClassificationLocalCompleted(completionDateKey)
  )
  const [completing, setCompleting] = useState(false)
  const [classifyReview, setClassifyReview] = useState<AdminGoogleReviewRow | null>(null)

  const {
    googleReviews,
    platforms,
    todayKey,
    loading,
    savingSource,
    reload,
    markOtaCheck,
    patchGoogleReview,
  } = useReviewClassificationQueue(queryEnabled)

  useEffect(() => {
    setLocalCompleted(readReviewClassificationLocalCompleted(completionDateKey))
  }, [completionDateKey])

  const completed = linkedTodo?.completed ?? localCompleted
  const workCount = reviewClassificationWorkCount(googleReviews.length, platforms, todayKey)
  const otaDueCount = platforms.filter((platform) => isOtaReviewPlatformDue(platform, todayKey)).length

  const setPanelCompleted = useCallback(
    async (next: boolean) => {
      if (next === completed) return
      setCompleting(true)
      try {
        if (linkedTodo && onToggleLinkedTodo) {
          await onToggleLinkedTodo(linkedTodo, next)
        } else {
          writeReviewClassificationLocalCompleted(next, completionDateKey)
          setLocalCompleted(next)
        }
        onCompletedChange?.(next)
      } finally {
        setCompleting(false)
      }
    },
    [completed, linkedTodo, onToggleLinkedTodo, onCompletedChange, completionDateKey]
  )

  useTodoPanelAutoComplete({
    enabled: queryEnabled,
    loading,
    workCount,
    completed,
    onHold,
    mode: getTodoPanelAutoCompleteMode('review-classification'),
    applyCompleted: setPanelCompleted,
  })

  const progressLabel = isKo
    ? `미분류 ${googleReviews.length} · OTA ${otaDueCount}`
    : `${googleReviews.length} Google · ${otaDueCount} OTA`

  return (
    <div
      className={
        isList
          ? className
          : `w-full rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/80 to-white p-3 shadow-sm ${completed ? 'opacity-80' : ''}`
      }
      title={onEditRequest ? (isKo ? '우클릭: 수정' : 'Right-click to edit') : undefined}
      onContextMenu={
        onEditRequest
          ? (e) => {
              e.preventDefault()
              e.stopPropagation()
              onEditRequest()
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <TodoPanelStatusButtons
          locale={locale}
          completed={completed}
          onHold={onHold}
          busy={completing}
          holdBusy={holdBusy}
          holdEnabled={holdEnabled}
          holdDisabledHint={holdDisabledHint}
          onToggleComplete={() => void setPanelCompleted(!completed)}
          onToggleHold={onToggleHold}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <p
                className={`min-w-0 text-[13px] font-semibold leading-snug ${
                  completed ? 'text-gray-400 line-through' : onHold ? 'text-amber-900' : 'text-gray-900'
                }`}
              >
                {reviewClassificationPanelTitle(locale)}
              </p>
              {isList ? (
                <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">
                  {isKo ? '일일' : 'Daily'}
                </span>
              ) : null}
              <span className="shrink-0 text-[10px] font-medium text-sky-800">{progressLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-sky-800"
              title={isKo ? '목록 새로고침' : 'Refresh list'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isKo ? '리뷰 분류 목록 불러오는 중…' : 'Loading review classification…'}
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {isKo ? '구글 리뷰 · 오후 9시 업로드 · 투어 미선택' : 'Google · 9 PM import · no tour'}
              </p>
              {googleReviews.length === 0 ? (
                <p className="rounded-md border border-dashed border-gray-200 bg-white/60 py-2 text-center text-[11px] text-gray-500">
                  {isKo ? '투어가 없는 구글 리뷰가 없습니다.' : 'No Google reviews waiting for a tour.'}
                </p>
              ) : (
                googleReviews.map((review) => (
                  <GoogleReviewQueueRow
                    key={review.id}
                    review={review}
                    locale={locale}
                    onOpen={() => setClassifyReview(review)}
                  />
                ))
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {isKo ? '수동 채널' : 'Manual channels'}
              </p>
              {platforms.map((platform) => (
                <OtaPlatformRow
                  key={platform.source}
                  platform={platform}
                  locale={locale}
                  todayKey={todayKey || todayInLasVegas()}
                  saving={savingSource === platform.source}
                  onMarkNoReview={() => void markOtaCheck(platform.source, 'no_review')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {classifyReview ? (
        <ReviewClassificationClassifyModal
          locale={locale}
          review={classifyReview}
          onClose={() => setClassifyReview(null)}
          onSaved={(next) => {
            patchGoogleReview(next)
            if (next.tourId || next.excludeStaffRating) setClassifyReview(null)
          }}
        />
      ) : null}
    </div>
  )
}
