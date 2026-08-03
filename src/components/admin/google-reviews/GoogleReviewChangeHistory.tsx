'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Clock, Loader2, User } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { formatLasVegasDateTime } from '@/lib/dailyReport/dateUtils'
import {
  formatGoogleReviewChangeLabel,
  type GoogleReviewChangeLogRow,
} from '@/lib/googleReviewChangeLog'

type Props = {
  reviewId: string
  locale: string
  refreshKey?: number
  compact?: boolean
}

type HistoryResponse = {
  ok?: boolean
  logs?: GoogleReviewChangeLogRow[]
  error?: string
}

export default function GoogleReviewChangeHistory({
  reviewId,
  locale,
  refreshKey = 0,
  compact = false,
}: Props) {
  const isKo = locale === 'ko'
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [logs, setLogs] = useState<GoogleReviewChangeLogRow[]>([])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/google-business/reviews/${reviewId}/history?limit=10`
      )
      const data = (await res.json()) as HistoryResponse
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'history_failed')
      }
      setLogs(data.logs ?? [])
      setLoaded(true)
    } catch (error) {
      console.error('[GoogleReviewChangeHistory]', error)
      setLogs([])
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [reviewId])

  useEffect(() => {
    if (!expanded) return
    void loadHistory()
  }, [expanded, loadHistory, refreshKey])

  return (
    <div className={compact ? '' : 'pt-1'}>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        aria-expanded={expanded}
      >
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {isKo ? '변경 이력' : 'Change history'}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="mt-2 rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {isKo ? '불러오는 중…' : 'Loading…'}
            </div>
          ) : !loaded || logs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">
              {isKo ? '변경 이력이 없습니다.' : 'No change history yet.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li key={log.id} className="text-xs text-foreground">
                  <p className="font-medium">
                    {formatGoogleReviewChangeLabel(log, isKo)}
                  </p>
                  <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="tabular-nums">
                      {formatLasVegasDateTime(log.createdAt, locale) ?? '—'}
                    </span>
                    {log.changedByEmail ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden />
                        {log.changedByEmail}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
