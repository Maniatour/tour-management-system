'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardPaste, FileUp, Loader2, Sparkles, Upload } from 'lucide-react'
import OtaReviewImportPreviewCard, {
  type LinkedTourPreview,
} from '@/components/admin/google-reviews/OtaReviewImportPreviewCard'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import {
  OTA_CSV_TEMPLATE_HINTS,
  isGetYourGuideScrapedText,
  isKkdayScrapedText,
  isKlookTableText,
  parseOtaReviewCsv,
  parseOtaReviewText,
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
  duplicates?: number
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
  productId: string | null
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

function toLinkedTourPreview(
  tour: {
    id: string
    tourDate: string
    productId?: string | null
    productName: string | null
    guideName?: string | null
    assistantName?: string | null
    totalPeople?: number
  } | null
): LinkedTourPreview | null {
  if (!tour) return null
  return {
    id: tour.id,
    tourDate: tour.tourDate,
    productId: tour.productId ?? null,
    productName: tour.productName,
    guideName: tour.guideName ?? null,
    assistantName: tour.assistantName ?? null,
    totalPeople: tour.totalPeople ?? 0,
  }
}

export default function OtaReviewsImportSection({
  locale,
  source,
  onRefresh,
  onMessage,
}: Props) {
  const isKo = locale === 'ko'
  const isParseOnlyPaste = source === 'getyourguide' || source === 'kkday'
  const isBulkTablePaste = source === 'klook'
  const [mode, setMode] = useState<ImportMode>('paste')
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [linkingTours, setLinkingTours] = useState(false)
  const [pasteText, setPasteText] = useState('')

  const [reservationLookup, setReservationLookup] = useState<ReservationLookup | null>(null)
  const [linkedTour, setLinkedTour] = useState<LinkedTourPreview | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [alreadyImported, setAlreadyImported] = useState(false)
  const lookupCacheRef = useRef(
    new Map<
      string,
      {
        reservation: ReservationLookup | null
        suggestedTour: LinkedTourPreview | null
        alreadyImported: boolean
      }
    >()
  )
  const lookupRequestIdRef = useRef(0)

  const sourceLabel = getReviewSourceLabel(source, locale)
  const templateHint = OTA_CSV_TEMPLATE_HINTS[source]

  const parsedFromPaste = useMemo(() => {
    if (!pasteText.trim()) return null
    if (isBulkTablePaste) return null
    return parseSingleOtaReviewText(pasteText, source)
  }, [isBulkTablePaste, pasteText, source])

  const bulkPasteRows = useMemo(() => {
    if (!isBulkTablePaste || !pasteText.trim()) return []
    return parseOtaReviewText(pasteText, source)
  }, [isBulkTablePaste, pasteText, source])

  const bulkPasteValidation = useMemo(
    () => validateParsedOtaRows(bulkPasteRows),
    [bulkPasteRows]
  )

  const reservationRef = parsedFromPaste?.reservationNumber?.trim() ?? ''

  const singleDraft = useMemo((): ParsedOtaReviewRow | null => {
    if (!parsedFromPaste) return null
    if (!parsedFromPaste.rating && source !== 'kkday') return null

    return {
      authorName: reservationLookup?.customerName || parsedFromPaste.authorName || null,
      rating: parsedFromPaste.rating,
      comment: parsedFromPaste.comment,
      reviewCreatedAt: parsedFromPaste.reviewCreatedAt,
      productHint: reservationLookup?.productName || parsedFromPaste.productHint || null,
      reservationNumber: parsedFromPaste.reservationNumber || null,
      tourDate: reservationLookup?.tourDate || parsedFromPaste.tourDate || null,
      productId: reservationLookup?.productId || parsedFromPaste.productId || null,
      tourId: reservationLookup?.tourId || null,
    }
  }, [parsedFromPaste, reservationLookup, source])

  const singleValidation = useMemo(() => {
    if (!singleDraft) {
      return { valid: [] as ParsedOtaReviewRow[], invalid: [] as Array<{ row: ParsedOtaReviewRow; reason: string }> }
    }
    return validateParsedOtaRows([singleDraft])
  }, [singleDraft])

  const csvParsedRows = useMemo(() => {
    if (!csvText.trim()) return []
    return parseOtaReviewCsv(csvText, source)
  }, [csvText, source])

  const csvValidation = useMemo(() => validateParsedOtaRows(csvParsedRows), [csvParsedRows])

  useEffect(() => {
    if (!reservationRef) {
      setReservationLookup(null)
      setLinkedTour(null)
      setAlreadyImported(false)
      setLookupError(null)
      setLookupLoading(false)
      return
    }

    const cacheKey = `${source}:${reservationRef}`
    const cached = lookupCacheRef.current.get(cacheKey)
    if (cached) {
      setReservationLookup(cached.reservation)
      setLinkedTour(cached.suggestedTour)
      setAlreadyImported(cached.alreadyImported)
      setLookupError(null)
      setLookupLoading(false)
      return
    }

    const isCompleteRef =
      /^GYG[A-Z0-9]{6,}$/i.test(reservationRef) || /^\d{2}KK\d{8,}$/i.test(reservationRef)
    const delay = isCompleteRef ? 0 : 200
    const controller = new AbortController()

    const timer = window.setTimeout(() => {
      const requestId = ++lookupRequestIdRef.current

      void (async () => {
        setLookupLoading(true)
        setLookupError(null)
        try {
          const res = await fetchApiWithAuth(
            `/api/admin/google-business/reviews/reservation-lookup?ref=${encodeURIComponent(reservationRef)}&source=${encodeURIComponent(source)}`,
            { signal: controller.signal }
          )
          const data = (await res.json()) as {
            ok?: boolean
            found?: boolean
            reservation?: ReservationLookup | null
            suggestedTour?: {
              id: string
              tourDate: string
              productId?: string | null
              productName: string | null
              guideName?: string | null
              assistantName?: string | null
              totalPeople?: number
            } | null
            alreadyImported?: boolean
            error?: string
          }
          if (requestId !== lookupRequestIdRef.current) return

          if (!res.ok || !data.ok) {
            throw new Error(data.error || 'lookup_failed')
          }

          const reservation = data.found ? data.reservation ?? null : null
          const suggestedTour = toLinkedTourPreview(data.suggestedTour ?? null)
          const isDuplicate = data.alreadyImported === true
          lookupCacheRef.current.set(cacheKey, {
            reservation,
            suggestedTour,
            alreadyImported: isDuplicate,
          })
          setReservationLookup(reservation)
          setLinkedTour(suggestedTour)
          setAlreadyImported(isDuplicate)
        } catch (error) {
          if (controller.signal.aborted) return
          if (requestId !== lookupRequestIdRef.current) return
          setReservationLookup(null)
          setLinkedTour(null)
          setAlreadyImported(false)
          setLookupError(
            error instanceof Error ? error.message : isKo ? '예약 조회 실패' : 'Lookup failed'
          )
        } finally {
          if (requestId === lookupRequestIdRef.current) {
            setLookupLoading(false)
          }
        }
      })()
    }, delay)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isKo, reservationRef, source])

  const resetSingleForm = useCallback(() => {
    setPasteText('')
    setReservationLookup(null)
    setLinkedTour(null)
    setAlreadyImported(false)
    setLookupError(null)
    lookupCacheRef.current.clear()
  }, [])

  const runSingleImport = useCallback(async () => {
    if (singleValidation.valid.length === 0) {
      onMessage(
        isKo
          ? source === 'kkday'
            ? 'KKday 리뷰 텍스트를 붙여넣고 예약번호·별점·리뷰 내용이 파싱되는지 확인하세요.'
            : 'GetYourGuide 리뷰 텍스트를 붙여넣고 RN#·별점·리뷰 내용이 파싱되는지 확인하세요.'
          : source === 'kkday'
            ? 'Paste KKday review text and ensure booking number, rating, and review content are parsed.'
            : 'Paste GetYourGuide review text and ensure RN#, rating, and review content are parsed.'
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
          rows: singleValidation.valid,
        }),
      })
      const data = (await res.json()) as ImportResult
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'import_failed')
      }

      onMessage(
        isKo
          ? data.duplicates
            ? `이미 등록된 리뷰입니다. (중복 ${data.duplicates}건)`
            : `리뷰 등록 완료 (투어 연결 ${data.toursLinked ?? 0}건)`
          : data.duplicates
            ? `Review already registered. (${data.duplicates} duplicate(s))`
            : `Review saved (tours linked: ${data.toursLinked ?? 0})`
      )
      if (!data.duplicates) {
        resetSingleForm()
      }
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
  }, [isKo, onMessage, onRefresh, resetSingleForm, singleValidation.valid, source])

  const runBulkPasteImport = useCallback(async () => {
    if (bulkPasteValidation.valid.length === 0) {
      onMessage(
        isKo
          ? 'Klook 리뷰 테이블을 붙여넣고 Booking reference·Stars·Reviews가 파싱되는지 확인하세요.'
          : 'Paste the Klook review table and ensure booking reference, stars, and reviews are parsed.'
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
          rows: bulkPasteValidation.valid,
        }),
      })
      const data = (await res.json()) as ImportResult
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'import_failed')
      }

      onMessage(
        isKo
          ? `가져오기 완료: 신규 ${data.imported ?? 0}건, 중복 ${data.duplicates ?? 0}건, 투어 연결 ${data.toursLinked ?? 0}건`
          : `Import done: ${data.imported ?? 0} new, ${data.duplicates ?? 0} duplicate(s), ${data.toursLinked ?? 0} tour link(s)`
      )
      setPasteText('')
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
  }, [bulkPasteValidation.valid, isKo, onMessage, onRefresh, source])

  const runCsvImport = useCallback(async () => {
    if (csvValidation.valid.length === 0) {
      onMessage(
        isKo ? '가져올 수 있는 유효한 리뷰가 없습니다.' : 'No valid reviews to import.'
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
          ? `${data.imported ?? 0}건 추가${data.duplicates ? `, 중복 ${data.duplicates}건 건너뜀` : ''}, 투어 연결 ${data.toursLinked ?? 0}건`
          : `${data.imported ?? 0} imported${data.duplicates ? `, ${data.duplicates} duplicate(s) skipped` : ''}, ${data.toursLinked ?? 0} tours linked`
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
      const data = (await res.json()) as {
        ok?: boolean
        linked?: number
        authorsBackfilled?: number
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'link_failed')
      onMessage(
        isKo
          ? `투어 자동 연결 ${data.linked ?? 0}건${data.authorsBackfilled ? `, 고객명 보정 ${data.authorsBackfilled}건` : ''}`
          : `Auto-linked ${data.linked ?? 0} tours${data.authorsBackfilled ? `, ${data.authorsBackfilled} guest name(s) filled` : ''}`
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
          {isParseOnlyPaste
            ? source === 'kkday'
              ? isKo
                ? 'KKday 리뷰 화면 텍스트를 붙여넣으면 예약번호·별점·리뷰·고객·상품·투어가 자동으로 처리됩니다.'
                : 'Paste KKday review page text — booking number, rating, review, guest, product, and tour are handled automatically.'
              : isKo
                ? 'GetYourGuide 리뷰 페이지 텍스트를 붙여넣으면 RN#·별점·리뷰·고객·상품·투어가 자동으로 처리됩니다.'
                : 'Paste GetYourGuide review page text — RN#, rating, review, guest, product, and tour are handled automatically.'
            : isBulkTablePaste
              ? isKo
                ? 'Klook 리뷰 표(엑셀/시트)를 통째로 붙여넣으면 예약번호로 투어를 연결해 저장합니다.'
                : 'Paste the full Klook review table from Excel/sheet — tours are linked via booking reference.'
              : isKo
                ? '1건씩 등록하거나 CSV로 일괄 업로드할 수 있습니다.'
                : 'Add one review at a time or bulk upload via CSV.'}
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
          {isBulkTablePaste ? (isKo ? '표 붙여넣기' : 'Paste table') : isKo ? '1건 등록' : 'Single entry'}
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
          {isBulkTablePaste ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isKo ? 'Klook 리뷰 테이블 붙여넣기' : 'Paste Klook review table'}
                </label>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={16}
                  placeholder={
                    isKo
                      ? 'Booking reference ID · Reviewed date · Stars · Reviews 열이 포함된 표를 엑셀/시트에서 복사해 붙여넣으세요.\n\n예약번호(channel_rn)로 투어가 자동 연결됩니다.'
                      : 'Copy the table with Booking reference ID, Reviewed date, Stars, and Reviews from Excel/sheet and paste here.\n\nTours are auto-linked via booking reference (channel_rn).'
                  }
                  className="w-full min-h-[320px] rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed font-mono"
                />
                {pasteText.trim() && !isKlookTableText(pasteText) ? (
                  <p className="text-xs text-warning">
                    {isKo
                      ? 'Klook 표 형식이 아닐 수 있습니다. Booking reference ID·Reviewed date·Stars·Reviews 열이 있는지 확인하세요.'
                      : 'This may not be a Klook table. Ensure Booking reference ID, Reviewed date, Stars, and Reviews columns are included.'}
                  </p>
                ) : null}
              </div>

              <p className="text-xs text-muted-foreground">
                {isKo
                  ? `파싱 ${bulkPasteRows.length}건 · 유효 ${bulkPasteValidation.valid.length}건 · 무효 ${bulkPasteValidation.invalid.length}건 · 예약번호 ${bulkPasteValidation.valid.filter((row) => row.reservationNumber).length}건`
                  : `Parsed ${bulkPasteRows.length} · valid ${bulkPasteValidation.valid.length} · invalid ${bulkPasteValidation.invalid.length} · with booking ref ${bulkPasteValidation.valid.filter((row) => row.reservationNumber).length}`}
              </p>

              <button
                type="button"
                onClick={() => void runBulkPasteImport()}
                disabled={importing || bulkPasteValidation.valid.length === 0}
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isKo
                  ? `${bulkPasteValidation.valid.length}건 가져오기`
                  : `Import ${bulkPasteValidation.valid.length}`}
              </button>
            </>
          ) : (
            <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {source === 'kkday'
                  ? isKo
                    ? 'KKday 리뷰 텍스트 붙여넣기'
                    : 'Paste KKday review text'
                  : isKo
                    ? 'GetYourGuide 리뷰 텍스트 붙여넣기'
                    : 'Paste GetYourGuide review text'}
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={16}
                placeholder={
                  source === 'kkday'
                    ? isKo
                      ? 'KKday 리뷰 화면에서 복사한 텍스트를 그대로 붙여넣으세요.\n\n상품명 · 옵션 · 등급점수 · 예약자 · 예약번호 · 리뷰 내용이 자동 추출됩니다.\n등급점수가 비어 있으면 숫자(1~5)를 등급점수 뒤에 붙여 주세요.'
                      : 'Paste the full text copied from the KKday review page.\n\nProduct, option, rating, booker, booking number, and review text are extracted automatically.\nIf the rating is blank, add a number (1–5) after 등급점수.'
                    : isKo
                      ? 'GetYourGuide 리뷰 관리 페이지에서 복사한 텍스트를 그대로 붙여넣으세요.\n\n별점 · RN# · 리뷰 날짜 · 리뷰 내용 · 투어 날짜가 자동 추출됩니다.'
                      : 'Paste the full text copied from the GetYourGuide review page.\n\nRating, RN#, review date, text, and travel date are extracted automatically.'
                }
                className="w-full min-h-[320px] rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed"
              />
              {pasteText.trim() && source === 'kkday' && !isKkdayScrapedText(pasteText) ? (
                <p className="text-xs text-warning">
                  {isKo
                    ? 'KKday 형식이 아닐 수 있습니다. 상품명·예약자·예약번호(#26KK…)가 포함된 텍스트인지 확인하세요.'
                    : 'This may not be KKday format. Ensure product name, booker, and booking number (#26KK…) are included.'}
                </p>
              ) : null}
              {pasteText.trim() && source !== 'kkday' && !isGetYourGuideScrapedText(pasteText) ? (
                <p className="text-xs text-warning">
                  {isKo
                    ? 'GetYourGuide 형식이 아닐 수 있습니다. Booking reference·Travel date가 포함된 텍스트인지 확인하세요.'
                    : 'This may not be GetYourGuide format. Ensure Booking reference and Travel date are included.'}
                </p>
              ) : null}
              {source === 'kkday' && parsedFromPaste && parsedFromPaste.rating === null ? (
                <p className="text-xs text-warning">
                  {isKo
                    ? '등급점수가 복사되지 않았습니다. `등급점수: 5`처럼 1~5 숫자를 붙여 주세요.'
                    : 'Rating was not copied. Add a 1–5 number after 등급점수, e.g. `등급점수: 5`.'}
                </p>
              ) : null}
            </div>

            <OtaReviewImportPreviewCard
              locale={locale}
              draft={singleDraft}
              reservation={reservationLookup}
              linkedTour={linkedTour}
              lookupLoading={lookupLoading}
              lookupError={lookupError}
              alreadyImported={alreadyImported}
            />
          </div>

          <button
            type="button"
            onClick={() => void runSingleImport()}
            disabled={
              importing || singleValidation.valid.length === 0 || lookupLoading || alreadyImported
            }
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {alreadyImported
              ? isKo
                ? '이미 등록됨'
                : 'Already registered'
              : isKo
                ? '리뷰 1건 등록'
                : 'Save 1 review'}
          </button>
            </>
          )}
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
