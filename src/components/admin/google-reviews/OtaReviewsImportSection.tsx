'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ClipboardPaste,
  FileUp,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  Upload,
  User,
} from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  OTA_CSV_TEMPLATE_HINTS,
  parseOtaReviewCsv,
  parseSingleOtaReviewText,
  validateParsedOtaRows,
  type ParsedOtaReviewRow,
} from '@/lib/otaReviewParse'
import type { OtaReviewSource } from '@/lib/reviewSources'
import { getReviewSourceLabel } from '@/lib/reviewSources'

type ImportResult = {
  ok?: boolean
  imported?: number
  updated?: number
  skipped?: number
  classified?: number
  autoApproved?: number
  toursLinked?: number
  validCount?: number
  invalidCount?: number
  error?: string
}

type ReservationLookup = {
  reservationId: string
  channelRn: string | null
  tourId: string | null
  tourDate: string | null
  productName: string | null
  customerName: string | null
}

type ImportMode = 'paste' | 'csv'

type Props = {
  locale: string
  source: OtaReviewSource
  onRefresh: () => Promise<void>
  onMessage: (message: string) => void
}

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (rating: number) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={`h-10 w-10 rounded-lg border transition-colors ${
            value !== null && star <= value
              ? 'border-amber-300 bg-amber-50 text-amber-500'
              : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
          } disabled:opacity-50`}
          aria-label={`${star} stars`}
        >
          <Star
            className={`h-4 w-4 mx-auto ${value !== null && star <= value ? 'fill-current' : ''}`}
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}

function ReviewPreviewCard({
  locale,
  sourceLabel,
  draft,
  ratingOnly,
  reservation,
  lookupLoading,
  lookupError,
}: {
  locale: string
  sourceLabel: string
  draft: ParsedOtaReviewRow | null
  ratingOnly: boolean
  reservation: ReservationLookup | null
  lookupLoading: boolean
  lookupError: string | null
}) {
  const isKo = locale === 'ko'

  if (!draft) {
    return (
      <div className="h-full min-h-[280px] rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 flex items-center justify-center text-center">
        <p className="text-sm text-muted-foreground">
          {isKo
            ? '별점과 내용을 입력하면 미리보기가 표시됩니다.'
            : 'Enter a rating and content to see the preview.'}
        </p>
      </div>
    )
  }

  const isValid = draft.rating !== null && draft.rating >= 1 && draft.rating <= 5 &&
    (ratingOnly || Boolean(draft.comment?.trim()) || Boolean(draft.authorName?.trim()))

  return (
    <div className="h-full min-h-[280px] rounded-xl border border-border/60 bg-muted/10 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isKo ? '미리보기' : 'Preview'}
          </p>
          <p className="text-sm font-semibold text-foreground mt-1">{sourceLabel}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            isValid
              ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning'
          }`}
        >
          {isValid ? (isKo ? '등록 가능' : 'Ready') : isKo ? '입력 필요' : 'Incomplete'}
        </span>
      </div>

      <div className="flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={`h-4 w-4 ${draft.rating !== null && index < draft.rating ? 'fill-current' : 'text-muted-foreground/30'}`}
            aria-hidden
          />
        ))}
        <span className="ml-2 text-sm text-foreground tabular-nums">{draft.rating ?? '—'}</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>{draft.authorName?.trim() || (isKo ? '작성자 미입력' : 'No author')}</span>
        </div>
        <div className="flex items-start gap-2 text-foreground">
          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden />
          <span>
            {draft.reviewCreatedAt
              ? new Date(draft.reviewCreatedAt).toLocaleDateString(isKo ? 'ko-KR' : 'en-US')
              : isKo
                ? '날짜 미입력'
                : 'No date'}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border/50 bg-background p-4">
        {ratingOnly ? (
          <p className="text-sm text-muted-foreground italic">
            {isKo ? '(별점만 기록 — 리뷰 내용 없음)' : '(Rating only — no review text)'}
          </p>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {draft.comment?.trim() || (isKo ? '리뷰 내용 없음' : 'No review text')}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border/50 bg-background p-4 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isKo ? '예약 · 투어 연결' : 'Reservation · tour link'}
        </p>
        {lookupLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {isKo ? '예약 조회 중…' : 'Looking up reservation…'}
          </div>
        ) : lookupError ? (
          <p className="text-sm text-danger">{lookupError}</p>
        ) : reservation ? (
          <div className="space-y-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">{isKo ? '예약' : 'Reservation'}: </span>
              <strong>{reservation.channelRn || reservation.reservationId}</strong>
            </p>
            {reservation.customerName ? (
              <p>
                <span className="text-muted-foreground">{isKo ? '고객' : 'Guest'}: </span>
                {reservation.customerName}
              </p>
            ) : null}
            {reservation.tourId ? (
              <p className="flex items-start gap-1.5 text-success">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                <span>
                  {reservation.tourDate
                    ? new Date(reservation.tourDate).toLocaleDateString(isKo ? 'ko-KR' : 'en-US')
                    : '—'}
                  {reservation.productName ? ` · ${reservation.productName}` : ''}
                </span>
              </p>
            ) : (
              <p className="text-sm text-warning">
                {isKo ? '예약은 찾았지만 연결된 투어가 없습니다.' : 'Reservation found but no tour linked.'}
              </p>
            )}
          </div>
        ) : draft.reservationNumber?.trim() ? (
          <p className="text-sm text-warning">
            {isKo ? '일치하는 예약을 찾지 못했습니다.' : 'No matching reservation found.'}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {isKo ? '예약 번호를 입력하면 투어가 자동 연결됩니다.' : 'Enter a reservation number to auto-link a tour.'}
          </p>
        )}
      </div>
    </div>
  )
}

export default function OtaReviewsImportSection({
  locale,
  source,
  onRefresh,
  onMessage,
}: Props) {
  const isKo = locale === 'ko'
  const [mode, setMode] = useState<ImportMode>('paste')
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [linkingTours, setLinkingTours] = useState(false)

  const [reservationNumber, setReservationNumber] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [reviewDate, setReviewDate] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [ratingOnly, setRatingOnly] = useState(false)

  const [reservationLookup, setReservationLookup] = useState<ReservationLookup | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const sourceLabel = getReviewSourceLabel(source, locale)
  const templateHint = OTA_CSV_TEMPLATE_HINTS[source]

  const parsedFromPaste = useMemo(
    () => (pasteText.trim() ? parseSingleOtaReviewText(pasteText) : null),
    [pasteText]
  )

  const singleDraft = useMemo((): ParsedOtaReviewRow | null => {
    const baseRating = rating ?? parsedFromPaste?.rating ?? null
    if (baseRating === null) return null

    const draft: ParsedOtaReviewRow = {
      authorName: authorName.trim() || parsedFromPaste?.authorName || null,
      rating: baseRating,
      comment: ratingOnly ? null : pasteText.trim() || parsedFromPaste?.comment || null,
      reviewCreatedAt: reviewDate
        ? new Date(`${reviewDate}T12:00:00`).toISOString()
        : parsedFromPaste?.reviewCreatedAt || null,
      productHint: parsedFromPaste?.productHint || reservationLookup?.productName || null,
      reservationNumber: reservationNumber.trim() || parsedFromPaste?.reservationNumber || null,
    }
    return draft
  }, [
    authorName,
    parsedFromPaste,
    pasteText,
    rating,
    ratingOnly,
    reservationLookup?.productName,
    reservationNumber,
    reviewDate,
  ])

  const singleValidation = useMemo(() => {
    if (!singleDraft) {
      return { valid: [] as ParsedOtaReviewRow[], invalid: [] as Array<{ row: ParsedOtaReviewRow; reason: string }> }
    }
    return validateParsedOtaRows([singleDraft], { ratingOnly })
  }, [ratingOnly, singleDraft])

  const csvParsedRows = useMemo(() => {
    if (!csvText.trim()) return []
    return parseOtaReviewCsv(csvText)
  }, [csvText])

  const csvValidation = useMemo(() => validateParsedOtaRows(csvParsedRows), [csvParsedRows])

  useEffect(() => {
    const ref = reservationNumber.trim()
    if (!ref) {
      setReservationLookup(null)
      setLookupError(null)
      return
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setLookupLoading(true)
        setLookupError(null)
        try {
          const res = await fetchApiWithAuth(
            `/api/admin/google-business/reviews/reservation-lookup?ref=${encodeURIComponent(ref)}`
          )
          const data = (await res.json()) as {
            ok?: boolean
            found?: boolean
            reservation?: ReservationLookup | null
            error?: string
          }
          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'lookup_failed')
          }
          setReservationLookup(data.found ? data.reservation ?? null : null)
        } catch (error) {
          setReservationLookup(null)
          setLookupError(
            error instanceof Error ? error.message : isKo ? '예약 조회 실패' : 'Lookup failed'
          )
        } finally {
          setLookupLoading(false)
        }
      })()
    }, 400)

    return () => window.clearTimeout(timer)
  }, [isKo, reservationNumber])

  const resetSingleForm = useCallback(() => {
    setReservationNumber('')
    setAuthorName('')
    setRating(null)
    setReviewDate('')
    setPasteText('')
    setRatingOnly(false)
    setReservationLookup(null)
    setLookupError(null)
  }, [])

  const runSingleImport = useCallback(async () => {
    if (singleValidation.valid.length === 0) {
      onMessage(
        isKo
          ? '별점(1~5)을 선택하고, 별점만 기록이 아니면 리뷰 내용을 입력하세요.'
          : 'Select a rating (1–5) and add review text unless using rating-only mode.'
      )
      return
    }

    setImporting(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/ota-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          mode: 'rows',
          ratingOnly,
          rows: singleValidation.valid,
        }),
      })
      const data = (await res.json()) as ImportResult
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'import_failed')
      }

      onMessage(
        isKo
          ? `리뷰 등록 완료 (투어 연결 ${data.toursLinked ?? 0}건)`
          : `Review saved (tours linked: ${data.toursLinked ?? 0})`
      )
      resetSingleForm()
      await onRefresh()
    } catch (error) {
      onMessage(
        isKo
          ? `등록 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Save failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setImporting(false)
    }
  }, [isKo, onMessage, onRefresh, ratingOnly, resetSingleForm, singleValidation.valid, source])

  const runCsvImport = useCallback(async () => {
    if (csvValidation.valid.length === 0) {
      onMessage(
        isKo
          ? '가져올 수 있는 유효한 리뷰가 없습니다.'
          : 'No valid reviews to import.'
      )
      return
    }

    setImporting(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/ota-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          mode: 'rows',
          rows: csvValidation.valid,
        }),
      })
      const data = (await res.json()) as ImportResult
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'import_failed')
      }

      onMessage(
        isKo
          ? `${data.imported ?? 0}건 추가, 투어 연결 ${data.toursLinked ?? 0}건`
          : `${data.imported ?? 0} imported, ${data.toursLinked ?? 0} tours linked`
      )
      setCsvText('')
      await onRefresh()
    } catch (error) {
      onMessage(
        isKo
          ? `가져오기 실패: ${error instanceof Error ? error.message : 'unknown'}`
          : `Import failed: ${error instanceof Error ? error.message : 'unknown'}`
      )
    } finally {
      setImporting(false)
    }
  }, [csvValidation.valid, isKo, onMessage, onRefresh, source])

  const runClassify = useCallback(async () => {
    setClassifying(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/google-business/reviews/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean; classified?: number; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'classify_failed')
      onMessage(
        isKo ? `자동 분류 ${data.classified ?? 0}건 완료` : `Classified ${data.classified ?? 0} reviews`
      )
      await onRefresh()
    } catch (error) {
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
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean; linked?: number; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'link_failed')
      onMessage(
        isKo ? `투어 자동 연결 ${data.linked ?? 0}건` : `Auto-linked ${data.linked ?? 0} tours`
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
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isKo ? `${sourceLabel} 리뷰 추가` : `Add ${sourceLabel} reviews`}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isKo
            ? '1건씩 등록하거나 CSV로 일괄 업로드할 수 있습니다. 예약 번호로 투어를 연결합니다.'
            : 'Add one review at a time or bulk upload via CSV. Link tours by reservation number.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium border ${
            mode === 'paste'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background hover:bg-muted/50'
          }`}
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          {isKo ? '1건 등록' : 'Single entry'}
        </button>
        <button
          type="button"
          onClick={() => setMode('csv')}
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-medium border ${
            mode === 'csv'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background hover:bg-muted/50'
          }`}
        >
          <FileUp className="h-3.5 w-3.5" aria-hidden />
          {isKo ? 'CSV 업로드' : 'CSV upload'}
        </button>
      </div>

      {mode === 'paste' ? (
        <div className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {isKo ? '예약 번호' : 'Reservation number'}
            </span>
            <input
              type="text"
              value={reservationNumber}
              onChange={(e) => setReservationNumber(e.target.value)}
              placeholder={isKo ? 'OTA 예약 번호 또는 시스템 예약 ID' : 'OTA reference or reservation ID'}
              className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isKo ? '작성자' : 'Author'}
              </span>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={isKo ? '선택 입력' : 'Optional'}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isKo ? '리뷰 날짜' : 'Review date'}
              </span>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {isKo ? '별점' : 'Rating'}
            </span>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={ratingOnly}
              onChange={(e) => setRatingOnly(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {isKo ? '내용 없이 별점만 기록' : 'Rating only (no review text)'}
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isKo ? '리뷰 텍스트 붙여넣기' : 'Paste review text'}
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={12}
                disabled={ratingOnly}
                placeholder={
                  ratingOnly
                    ? isKo
                      ? '별점만 기록 모드 — 텍스트 입력 비활성화'
                      : 'Rating-only mode — text input disabled'
                    : isKo
                      ? '리뷰 내용을 붙여넣으세요.\n예: 최고의 투어였습니다! 가이드가 정말 친절했어요.'
                      : 'Paste the review text here.'
                }
                className="w-full min-h-[280px] rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed disabled:opacity-50 disabled:bg-muted/30"
              />
            </div>

            <ReviewPreviewCard
              locale={locale}
              sourceLabel={sourceLabel}
              draft={singleDraft}
              ratingOnly={ratingOnly}
              reservation={reservationLookup}
              lookupLoading={lookupLoading}
              lookupError={lookupError}
            />
          </div>

          <button
            type="button"
            onClick={() => void runSingleImport()}
            disabled={importing || singleValidation.valid.length === 0}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isKo ? '리뷰 1건 등록' : 'Save 1 review'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium text-foreground">
              {isKo ? 'CSV 파일 선택' : 'Choose CSV file'}
            </span>
            <span className="text-xs text-muted-foreground text-center max-w-md">
              {isKo ? templateHint.columnsKo : templateHint.columnsEn}
            </span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void file.text().then(setCsvText)
              }}
            />
          </label>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            placeholder={isKo ? templateHint.columnsKo : templateHint.columnsEn}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-mono"
          />

          <p className="text-xs text-muted-foreground">
            {isKo
              ? `유효 ${csvValidation.valid.length}건 / 무효 ${csvValidation.invalid.length}건`
              : `${csvValidation.valid.length} valid / ${csvValidation.invalid.length} invalid`}
          </p>

          <button
            type="button"
            onClick={() => void runCsvImport()}
            disabled={importing || csvValidation.valid.length === 0}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isKo ? `${csvValidation.valid.length}건 가져오기` : `Import ${csvValidation.valid.length}`}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
        <button
          type="button"
          onClick={() => void runClassify()}
          disabled={classifying}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          {classifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isKo ? '자동 분류' : 'Auto-classify'}
        </button>
        <button
          type="button"
          onClick={() => void runLinkTours()}
          disabled={linkingTours}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border bg-background text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          {linkingTours ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isKo ? '투어 자동 연결' : 'Auto-link tours'}
        </button>
      </div>
    </section>
  )
}
