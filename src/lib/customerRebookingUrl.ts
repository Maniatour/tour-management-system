import type { CancellationFollowUpMessageLocale } from '@/lib/cancellationFollowUpMessage'

/** 고객 사이트 기본 도메인 */
export const KOVEGAS_CUSTOMER_SITE_ORIGIN = 'https://www.kovegas.com'

/** 취소 후 재예약 권유 기본 쿠폰 */
export const REBOOKING_OUTREACH_COUPON_CODE = 'REBOOK15'

/** DB 조회 실패 시 재예약 쿠폰 할인율(%) 폴백 */
export const REBOOKING_OUTREACH_COUPON_PERCENT = 15

/** 쿠폰 유효 종료일(ISO) — DB 조회 실패 시 폴백 */
export const REBOOKING_OUTREACH_COUPON_VALID_UNTIL_ISO = '2026-09-30'

export type CustomerRebookingPrefill = {
  tourDate?: string | null
  adults?: number
  children?: number
  infants?: number
  couponCode?: string | null
  selectedOptions?: Record<string, string>
  selectedChoiceQuantities?: Record<string, Record<string, number>>
  openBooking?: boolean
}

export type ReservationChoiceRowForRebooking = {
  choice_id?: string | null
  option_id?: string | null
  quantity?: number | null
}

export function formatRebookingCouponValidUntil(
  locale: CancellationFollowUpMessageLocale,
  endDateIso?: string | null
): string {
  const raw = (endDateIso?.trim() || REBOOKING_OUTREACH_COUPON_VALID_UNTIL_ISO).slice(0, 10)
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return raw
  const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatTourDateLongForCancellationMessage(
  tourDate: string | null | undefined,
  locale: CancellationFollowUpMessageLocale
): string {
  const raw = tourDate?.trim()
  if (!raw) return '—'
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!iso) return raw
  const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function mapReservationChoicesToBookingPrefill(rows: ReservationChoiceRowForRebooking[]): {
  selectedOptions: Record<string, string>
  selectedChoiceQuantities: Record<string, Record<string, number>>
} {
  const selectedOptions: Record<string, string> = {}
  const selectedChoiceQuantities: Record<string, Record<string, number>> = {}

  for (const row of rows) {
    const choiceId = String(row.choice_id ?? '').trim()
    const optionId = String(row.option_id ?? '').trim()
    if (!choiceId || !optionId || optionId === '__undecided__' || optionId === 'undecided') continue
    const qty = typeof row.quantity === 'number' && row.quantity > 0 ? row.quantity : 1
    if (qty > 1) {
      const group = selectedChoiceQuantities[choiceId] ?? {}
      group[optionId] = qty
      selectedChoiceQuantities[choiceId] = group
    }
    selectedOptions[choiceId] = optionId
  }

  return { selectedOptions, selectedChoiceQuantities }
}

/** URLSearchParams가 인코딩하므로 JSON만 직렬화 (이중 인코딩 방지) */
export function encodeCustomerRebookingPrefillParam(prefill: CustomerRebookingPrefill): string {
  return JSON.stringify(prefill)
}

export function decodeCustomerRebookingPrefillParam(raw: string | null | undefined): CustomerRebookingPrefill | null {
  if (!raw?.trim()) return null
  let candidate = raw.trim()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return JSON.parse(candidate) as CustomerRebookingPrefill
    } catch {
      try {
        candidate = decodeURIComponent(candidate)
      } catch {
        return null
      }
    }
  }
  return null
}

export function parseCustomerRebookingPrefillFromSearchParams(
  searchParams: URLSearchParams
): CustomerRebookingPrefill | null {
  const encoded = searchParams.get('prefill')
  if (encoded) {
    const decoded = decodeCustomerRebookingPrefillParam(encoded)
    if (decoded) return decoded
  }

  const date = searchParams.get('date')?.trim()
  const adults = searchParams.get('adults')
  const children = searchParams.get('children') ?? searchParams.get('child')
  const infants = searchParams.get('infants') ?? searchParams.get('infant')
  const coupon = searchParams.get('coupon')?.trim()
  const openBooking = searchParams.get('openBooking') === '1'

  let selectedOptions: Record<string, string> | undefined
  let selectedChoiceQuantities: Record<string, Record<string, number>> | undefined
  const choicesRaw = searchParams.get('choices')
  if (choicesRaw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(choicesRaw)) as {
        options?: Record<string, string>
        quantities?: Record<string, Record<string, number>>
      }
      selectedOptions = parsed.options
      selectedChoiceQuantities = parsed.quantities
    } catch {
      /* ignore */
    }
  }

  if (!date && adults == null && !coupon && !openBooking && !selectedOptions) return null

  return {
    ...(date ? { tourDate: date } : {}),
    ...(adults != null ? { adults: Math.max(0, Number(adults) || 0) } : {}),
    ...(children != null ? { children: Math.max(0, Number(children) || 0) } : {}),
    ...(infants != null ? { infants: Math.max(0, Number(infants) || 0) } : {}),
    ...(coupon ? { couponCode: coupon } : {}),
    ...(selectedOptions ? { selectedOptions } : {}),
    ...(selectedChoiceQuantities ? { selectedChoiceQuantities } : {}),
    ...(openBooking ? { openBooking: true } : {}),
  }
}

export function buildCustomerRebookingUrl(params: {
  locale: string
  productId: string
  prefill: CustomerRebookingPrefill
}): string {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const url = new URL(`${KOVEGAS_CUSTOMER_SITE_ORIGIN}/${locale}/products/${params.productId}`)
  const prefill: CustomerRebookingPrefill = {
    ...params.prefill,
    openBooking: params.prefill.openBooking ?? true,
    couponCode: params.prefill.couponCode?.trim() || REBOOKING_OUTREACH_COUPON_CODE,
  }
  url.searchParams.set('prefill', encodeCustomerRebookingPrefillParam(prefill))
  if (prefill.tourDate) url.searchParams.set('date', prefill.tourDate)
  if (prefill.adults != null) url.searchParams.set('adults', String(prefill.adults))
  if (prefill.children != null) url.searchParams.set('children', String(prefill.children))
  if (prefill.infants != null) url.searchParams.set('infants', String(prefill.infants))
  if (prefill.couponCode) url.searchParams.set('coupon', prefill.couponCode)
  if (prefill.openBooking) url.searchParams.set('openBooking', '1')
  return url.toString()
}

/** 이메일/SMS용 짧은 재예약 URL (예약 ID만 포함) */
export function buildCustomerRebookingShortUrl(params: {
  locale: string
  reservationId: string
}): string {
  const locale = params.locale === 'ko' ? 'ko' : 'en'
  const id = params.reservationId.trim()
  return `${KOVEGAS_CUSTOMER_SITE_ORIGIN}/${locale}/rebook/${encodeURIComponent(id)}`
}

export function buildCustomerRebookingUrlFromReservation(params: {
  locale: string
  reservationId: string
  productId?: string
  tourDate?: string | null
  adults?: number
  children?: number
  infants?: number
  choiceRows?: ReservationChoiceRowForRebooking[]
  couponCode?: string | null
  couponValidUntilIso?: string | null
}): string {
  if (params.reservationId?.trim()) {
    return buildCustomerRebookingShortUrl({
      locale: params.locale,
      reservationId: params.reservationId,
    })
  }

  const { selectedOptions, selectedChoiceQuantities } = mapReservationChoicesToBookingPrefill(
    params.choiceRows ?? []
  )
  const adults = Math.max(0, params.adults ?? 0)
  const children = Math.max(0, params.children ?? 0)
  const infants = Math.max(0, params.infants ?? 0)
  const partyTotal = adults + children + infants

  return buildCustomerRebookingUrl({
    locale: params.locale,
    productId: params.productId ?? '',
    prefill: {
      tourDate: params.tourDate ?? null,
      adults: partyTotal > 0 ? adults : 1,
      children,
      infants,
      couponCode: params.couponCode?.trim() || REBOOKING_OUTREACH_COUPON_CODE,
      selectedOptions,
      selectedChoiceQuantities,
      openBooking: true,
    },
  })
}
