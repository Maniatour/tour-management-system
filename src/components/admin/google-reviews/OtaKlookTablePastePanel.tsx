'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import OtaReviewImportPreviewCard, {
  type LinkedTourPreview,
} from '@/components/admin/google-reviews/OtaReviewImportPreviewCard'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { isKlookTableText, type ParsedOtaReviewRow } from '@/lib/otaReviewParse'
import type { OtaReviewSource } from '@/lib/reviewSources'

type ReservationLookup = {
  reservationId: string
  channelRn: string | null
  tourId: string | null
  tourDate: string | null
  productId: string | null
  productName: string | null
  customerName: string | null
}

type LookupState = {
  reservation: ReservationLookup | null
  suggestedTour: LinkedTourPreview | null
  alreadyImported: boolean
  error: string | null
  loading: boolean
}

type ManualOverride = {
  productId: string | null
  productName: string | null
  tour: LinkedTourPreview | null
}

type Props = {
  locale: string
  source: OtaReviewSource
  pasteText: string
  onPasteTextChange: (value: string) => void
  parsedCount: number
  validRows: ParsedOtaReviewRow[]
  invalidCount: number
  importing: boolean
  onImport: (rows: ParsedOtaReviewRow[]) => void
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

function previewKey(row: ParsedOtaReviewRow, index: number): string {
  return `${row.lineNumber ?? index}:${row.reservationNumber ?? ''}`
}

async function fetchReservationLookup(
  reservationRef: string,
  source: OtaReviewSource,
  signal: AbortSignal
): Promise<Omit<LookupState, 'loading' | 'error'>> {
  const res = await fetchApiWithAuth(
    `/api/admin/google-business/reviews/reservation-lookup?ref=${encodeURIComponent(reservationRef)}&source=${encodeURIComponent(source)}`,
    { signal }
  )
  const data = (await res.json()) as {
    ok?: boolean
    found?: boolean
    reservation?: ReservationLookup | null
    suggestedTour?: Parameters<typeof toLinkedTourPreview>[0]
    alreadyImported?: boolean
    error?: string
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'lookup_failed')
  }
  return {
    reservation: data.found ? data.reservation ?? null : null,
    suggestedTour: toLinkedTourPreview(data.suggestedTour ?? null),
    alreadyImported: data.alreadyImported === true,
  }
}

export default function OtaKlookTablePastePanel({
  locale,
  source,
  pasteText,
  onPasteTextChange,
  parsedCount,
  validRows,
  invalidCount,
  importing,
  onImport,
}: Props) {
  const isKo = locale === 'ko'
  const [lookups, setLookups] = useState<Record<string, LookupState>>({})
  const [manualByKey, setManualByKey] = useState<Record<string, ManualOverride>>({})
  const cacheRef = useRef(new Map<string, Omit<LookupState, 'loading' | 'error'>>())

  useEffect(() => {
    setManualByKey({})
  }, [pasteText])

  const lookupRefs = useMemo(
    () =>
      [...new Set(validRows.map((row) => row.reservationNumber?.trim() ?? '').filter(Boolean))].sort(),
    [validRows]
  )

  useEffect(() => {
    if (lookupRefs.length === 0) {
      setLookups({})
      return
    }

    const controller = new AbortController()
    const refs = lookupRefs

    setLookups((prev) => {
      const next: Record<string, LookupState> = {}
      for (const ref of refs) {
        const cached = cacheRef.current.get(`${source}:${ref}`)
        if (cached) {
          next[ref] = { ...cached, loading: false, error: null }
          continue
        }
        const existing = prev[ref]
        if (existing && !existing.loading) {
          next[ref] = existing
          continue
        }
        next[ref] = {
          reservation: null,
          suggestedTour: null,
          alreadyImported: false,
          error: null,
          loading: true,
        }
      }
      return next
    })

    const refsToFetch = refs.filter((ref) => !cacheRef.current.has(`${source}:${ref}`))
    if (refsToFetch.length === 0) return

    void (async () => {
      const concurrency = 4
      for (let i = 0; i < refsToFetch.length; i += concurrency) {
        if (controller.signal.aborted) return
        const batch = refsToFetch.slice(i, i + concurrency)
        await Promise.all(
          batch.map(async (ref) => {
            try {
              const result = await fetchReservationLookup(ref, source, controller.signal)
              cacheRef.current.set(`${source}:${ref}`, result)
              setLookups((prev) => ({
                ...prev,
                [ref]: { ...result, loading: false, error: null },
              }))
            } catch (error) {
              if (controller.signal.aborted) return
              setLookups((prev) => ({
                ...prev,
                [ref]: {
                  reservation: null,
                  suggestedTour: null,
                  alreadyImported: false,
                  loading: false,
                  error: error instanceof Error ? error.message : isKo ? '예약 조회 실패' : 'Lookup failed',
                },
              }))
            }
          })
        )
      }
    })()

    return () => controller.abort()
  }, [isKo, lookupRefs, source])

  const previewItems = useMemo(() => {
    return validRows.map((row, index) => {
      const key = previewKey(row, index)
      const ref = row.reservationNumber?.trim() ?? ''
      const lookup = ref ? lookups[ref] : undefined
      const manual = manualByKey[key]
      const reservation = lookup?.reservation ?? null
      const linkedTour = manual?.tour || lookup?.suggestedTour || null
      const productId = manual?.productId || reservation?.productId || row.productId || null
      const productHint = productId
        ? manual?.productName || reservation?.productName || row.productHint || null
        : null

      const draft: ParsedOtaReviewRow = {
        ...row,
        authorName: reservation?.customerName || row.authorName || null,
        productId,
        productHint,
        tourId: linkedTour?.id || reservation?.tourId || row.tourId || null,
        tourDate: reservation?.tourDate || row.tourDate || null,
      }

      return {
        key,
        draft,
        reservation,
        linkedTour,
        lookupLoading: lookup?.loading === true,
        lookupError: lookup?.error ?? null,
        alreadyImported: lookup?.alreadyImported === true,
      }
    })
  }, [lookups, manualByKey, validRows])

  const importableRows = useMemo(
    () => previewItems.filter((item) => !item.alreadyImported).map((item) => item.draft),
    [previewItems]
  )

  const linkedCount = previewItems.filter((item) => item.draft.productId || item.draft.tourId).length
  const lookingUp = previewItems.some((item) => item.lookupLoading)

  const updateManual = useCallback((key: string, patch: Partial<ManualOverride>) => {
    setManualByKey((prev) => ({
      ...prev,
      [key]: {
        productId: prev[key]?.productId ?? null,
        productName: prev[key]?.productName ?? null,
        tour: prev[key]?.tour ?? null,
        ...patch,
      },
    }))
  }, [])

  return (
    <>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isKo ? 'Klook 리뷰 테이블 붙여넣기' : 'Paste Klook review table'}
        </label>
        <textarea
          value={pasteText}
          onChange={(e) => onPasteTextChange(e.target.value)}
          rows={previewItems.length > 0 ? 8 : 16}
          placeholder={
            isKo
              ? 'Booking reference ID · Reviewed date · Stars · Reviews 열이 포함된 표를 엑셀/시트에서 복사해 붙여넣으세요.\n\n예약번호로 상품·투어가 자동 선택되고, 아래 리뷰 카드와 같은 미리보기가 표시됩니다.'
              : 'Copy the table with Booking reference ID, Reviewed date, Stars, and Reviews from Excel/sheet and paste here.\n\nProduct and tour are selected from the booking reference and shown as review cards.'
          }
          className="w-full min-h-[160px] rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed font-mono"
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
          ? `파싱 ${parsedCount}건 · 유효 ${validRows.length}건 · 무효 ${invalidCount}건 · 상품/투어 ${linkedCount}건`
          : `Parsed ${parsedCount} · valid ${validRows.length} · invalid ${invalidCount} · product/tour ${linkedCount}`}
        {lookingUp ? (isKo ? ' · 조회 중…' : ' · looking up…') : ''}
      </p>

      {previewItems.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isKo ? '등록 후 표시 미리보기' : 'Preview after save'}
          </p>
          {previewItems.map((item) => (
            <OtaReviewImportPreviewCard
              key={item.key}
              locale={locale}
              draft={item.draft}
              reservation={item.reservation}
              linkedTour={item.linkedTour}
              lookupLoading={item.lookupLoading}
              lookupError={item.lookupError}
              alreadyImported={item.alreadyImported}
              productEditable
              tourEditable
              showHeading={false}
              onProductChange={(productId, productName) => {
                updateManual(item.key, {
                  productId: productId ?? null,
                  productName: productName ?? null,
                  tour: null,
                })
              }}
              onTourChange={(tourId, tourProduct) => {
                if (!tourId) {
                  updateManual(item.key, { tour: null })
                  return
                }
                updateManual(item.key, {
                  tour: {
                    id: tourId,
                    tourDate: item.draft.tourDate || item.linkedTour?.tourDate || '',
                    productId: tourProduct?.productId ?? item.draft.productId ?? null,
                    productName: tourProduct?.productName ?? item.draft.productHint ?? null,
                    guideName: null,
                    assistantName: null,
                    totalPeople: 0,
                  },
                  ...(tourProduct?.productId
                    ? { productId: tourProduct.productId, productName: tourProduct.productName ?? null }
                    : {}),
                })
              }}
            />
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onImport(importableRows)}
        disabled={importing || importableRows.length === 0 || lookingUp}
        className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-95 disabled:opacity-50"
      >
        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {isKo ? `${importableRows.length}건 가져오기` : `Import ${importableRows.length}`}
      </button>
    </>
  )
}
