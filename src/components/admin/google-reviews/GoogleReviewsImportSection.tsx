'use client'

import { useCallback, useState } from 'react'
import { Download, Loader2, Sparkles } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { GoogleBusinessConnectionStatus, GoogleReviewStats } from '@/types/googleBusiness'

type ImportPageResult = {
  ok?: boolean
  imported?: number
  updated?: number
  skipped?: number
  classified?: number
  autoApproved?: number
  pageReviewCount?: number
  nextPageToken?: string | null
  done?: boolean
  totalReviewCount?: number | null
  error?: string
}

type ClassifyResult = {
  ok?: boolean
  classified?: number
  autoApproved?: number
  skipped?: number
  tourLinks?: { linked?: number; staffLinked?: number; skipped?: number }
  error?: string
}

type Props = {
  locale: string
  status: GoogleBusinessConnectionStatus | null
  reviewStats: GoogleReviewStats | null
  onRefresh: () => Promise<void>
  onMessage: (message: string) => void
}

export default function GoogleReviewsImportSection({
  locale,
  status,
  reviewStats,
  onRefresh,
  onMessage,
}: Props) {
  const isKo = locale === 'ko'
  const [importing, setImporting] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [linkingTours, setLinkingTours] = useState(false)
  const [importProgress, setImportProgress] = useState<string | null>(null)

  const canImport = Boolean(status?.connected && status.googleLocationName)

  const runImport = useCallback(async () => {
    if (!canImport) {
      onMessage(isKo ? '먼저 Google 위치를 선택하세요.' : 'Select a Google location first.')
      return
    }

    setImporting(true)
    setImportProgress(isKo ? '가져오기 시작…' : 'Starting import…')

    let pageToken: string | null = null
    let totalImported = 0
    let totalUpdated = 0
    let totalClassified = 0
    let totalAutoApproved = 0
    let page = 0

    try {
      do {
        page += 1
        const res = await fetchApiWithAuth('/api/admin/google-business/reviews/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageToken }),
        })
        const data = (await res.json()) as ImportPageResult
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'import_failed')
        }

        totalImported += data.imported ?? 0
        totalUpdated += data.updated ?? 0
        totalClassified += data.classified ?? 0
        totalAutoApproved += data.autoApproved ?? 0
        pageToken = data.nextPageToken ?? null

        setImportProgress(
          isKo
            ? `페이지 ${page} 처리됨 — 신규 ${totalImported}, 갱신 ${totalUpdated}, 분류 ${totalClassified}, 5★승인 ${totalAutoApproved}`
            : `Page ${page} — new ${totalImported}, updated ${totalUpdated}, classified ${totalClassified}, 5★ approved ${totalAutoApproved}`
        )

        if (data.done) break
      } while (pageToken)

      onMessage(
        isKo
          ? `가져오기 완료: 신규 ${totalImported}건, 갱신 ${totalUpdated}건, 자동 분류 ${totalClassified}건, 5★ 자동 승인 ${totalAutoApproved}건`
          : `Import complete: ${totalImported} new, ${totalUpdated} updated, ${totalClassified} classified, ${totalAutoApproved} five-star auto-approved`
      )
      await onRefresh()
    } catch (error) {
      console.error('[GoogleReviewsImportSection]', error)
      onMessage(
        isKo
          ? `가져오기 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Import failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }, [canImport, isKo, onMessage, onRefresh])

  const runClassify = useCallback(async () => {
    setClassifying(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 300 }),
      })
      const data = (await res.json()) as ClassifyResult
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'classify_failed')
      }
      onMessage(
        isKo
          ? `자동 분류 완료: ${data.classified ?? 0}건, 5★ 자동 승인 ${data.autoApproved ?? 0}건, 투어 연결 ${data.tourLinks?.linked ?? 0}건 (건너뜀 ${data.skipped ?? 0})`
          : `Classification done: ${data.classified ?? 0} matched, ${data.autoApproved ?? 0} five-star auto-approved, ${data.tourLinks?.linked ?? 0} tours linked (${data.skipped ?? 0} skipped)`
      )
      await onRefresh()
    } catch (error) {
      console.error('[GoogleReviewsImportSection] classify', error)
      onMessage(
        isKo
          ? `분류 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Classification failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setClassifying(false)
    }
  }, [isKo, onMessage, onRefresh])

  const runLinkTours = useCallback(async () => {
    setLinkingTours(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/link-tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 500 }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        linked?: number
        staffLinked?: number
        skipped?: number
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'link_tours_failed')
      onMessage(
        isKo
          ? `투어 자동 연결: ${data.linked ?? 0}건, 직원 매핑 ${data.staffLinked ?? 0}건`
          : `Auto-linked ${data.linked ?? 0} tours, ${data.staffLinked ?? 0} staff mappings`
      )
      await onRefresh()
    } catch (error) {
      onMessage(
        isKo
          ? `투어 연결 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Tour linking failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setLinkingTours(false)
    }
  }, [isKo, onMessage, onRefresh])

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isKo ? '리뷰 가져오기' : 'Import reviews'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isKo
            ? 'Google Business Profile에서 리뷰를 페이지 단위로 가져옵니다. 중복은 자동으로 건너뜁니다.'
            : 'Pull reviews from Google Business Profile in pages. Duplicates are skipped automatically.'}
        </p>
      </div>

      {reviewStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">{isKo ? '전체' : 'Total'}</p>
            <p className="font-semibold text-foreground">{reviewStats.total}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">{isKo ? '승인 대기' : 'Pending'}</p>
            <p className="font-semibold text-foreground">{reviewStats.pending}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">{isKo ? '승인됨' : 'Approved'}</p>
            <p className="font-semibold text-foreground">{reviewStats.approved}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">{isKo ? '미분류' : 'Unclassified'}</p>
            <p className="font-semibold text-foreground">{reviewStats.unclassified}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">{isKo ? '거절' : 'Rejected'}</p>
            <p className="font-semibold text-foreground">{reviewStats.rejected}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
            <p className="text-muted-foreground text-xs">{isKo ? '숨김' : 'Hidden'}</p>
            <p className="font-semibold text-foreground">{reviewStats.hidden}</p>
          </div>
        </div>
      ) : null}

      {status?.lastSyncedAt ? (
        <p className="text-xs text-muted-foreground">
          {isKo ? '마지막 동기화' : 'Last sync'}:{' '}
          {new Date(status.lastSyncedAt).toLocaleString(isKo ? 'ko-KR' : 'en-US')}
          {typeof status.lastImportReviewCount === 'number'
            ? ` · Google 총 ${status.lastImportReviewCount}건`
            : ''}
        </p>
      ) : null}

      {importProgress ? (
        <p className="text-sm text-muted-foreground" role="status">
          {importProgress}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!canImport ? (
          <p className="w-full text-xs text-muted-foreground">
            {isKo
              ? '위치를 선택한 뒤 「선택 저장」을 눌러야 전체 가져오기가 활성화됩니다.'
              : 'Select a location and click “Save selection” to enable import.'}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void runImport()}
          disabled={!canImport || importing}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isKo ? '전체 가져오기' : 'Import all reviews'}
        </button>
        <button
          type="button"
          onClick={() => void runClassify()}
          disabled={classifying || (reviewStats?.total ?? 0) === 0}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isKo ? '미분류 자동 분류' : 'Classify unmapped'}
        </button>
        <button
          type="button"
          onClick={() => void runLinkTours()}
          disabled={linkingTours || (reviewStats?.total ?? 0) === 0}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          {linkingTours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isKo ? '투어 자동 연결' : 'Link tours'}
        </button>
      </div>
    </section>
  )
}
