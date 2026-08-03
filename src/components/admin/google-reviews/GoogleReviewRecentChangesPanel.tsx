'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Clock, ExternalLink, Loader2, User } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { formatLasVegasDateTime } from '@/lib/dailyReport/dateUtils'
import {
  formatGoogleReviewChangeLabel,
  type GoogleReviewChangeLogRow,
} from '@/lib/googleReviewChangeLog'

type Props = {
  locale: string
  enabled: boolean
  refreshKey: number
  onOpenReview?: (log: GoogleReviewChangeLogRow) => void
  openingReviewId?: string | null
}

type ChangeLogsResponse = {
  ok?: boolean
  logs?: GoogleReviewChangeLogRow[]
  error?: string
}

export default function GoogleReviewRecentChangesPanel({
  locale,
  enabled,
  refreshKey,
  onOpenReview,
  openingReviewId = null,
}: Props) {
  const isKo = locale === 'ko'
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<GoogleReviewChangeLogRow[]>([])

  const loadLogs = useCallback(async () => {
    if (!enabled) {
      setLogs([])
      return
    }

    setLoading(true)
    try {
      const res = await fetchApiWithAuth(
        '/api/admin/google-business/reviews/change-logs?limit=15'
      )
      const data = (await res.json()) as ChangeLogsResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'list_failed')
      }
      setLogs(data.logs ?? [])
    } catch (error) {
      console.error('[GoogleReviewRecentChangesPanel]', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void loadLogs()
  }, [enabled, loadLogs, refreshKey])

  if (!enabled) return null

  return (
    <section className="rounded-xl border border-border/50 bg-muted/15 p-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              {isKo ? '최근 변경 이력' : 'Recent changes'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isKo
                ? '상태·상품·투어·가이드 평점 설정 변경 내역'
                : 'Status, product, tour, and staff-rating changes'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="mt-4 border-t border-border/40 pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isKo ? '아직 변경 이력이 없습니다.' : 'No changes recorded yet.'}
            </p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {logs.map((log) => (
                <li key={log.id}>
                  <button
                    type="button"
                    onClick={() => onOpenReview?.(log)}
                    disabled={!onOpenReview || openingReviewId === log.googleReviewId}
                    className="w-full rounded-lg border border-border/40 bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {log.authorName ?? (isKo ? '익명' : 'Anonymous')}
                      </p>
                      <time className="text-xs text-muted-foreground tabular-nums">
                        {formatLasVegasDateTime(log.createdAt, locale) ?? '—'}
                      </time>
                    </div>
                    <p className="text-sm text-foreground mt-1">
                      {formatGoogleReviewChangeLabel(log, isKo)}
                    </p>
                    {log.changedByEmail ? (
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden />
                        {log.changedByEmail}
                      </p>
                    ) : null}
                    {onOpenReview ? (
                      <p className="text-xs font-medium text-primary mt-2 inline-flex items-center gap-1">
                        {openingReviewId === log.googleReviewId ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            {isKo ? '리뷰 여는 중…' : 'Opening review…'}
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3 w-3" aria-hidden />
                            {isKo ? '리뷰 보기 · 수정' : 'View and edit review'}
                          </>
                        )}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  )
}
