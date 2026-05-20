/** 입장권 목록·상세 모달 — 연결 투어 표시용 */

export type TicketBookingTourEnrichment = {
  tour_date?: string | null
  total_people?: number | null
  products?: { name?: string; name_en?: string; name_ko?: string } | null
  guide_display_name?: string | null
  assistant_display_name?: string | null
  vehicle_display_name?: string | null
}

export function formatTourDateYmd(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return s.length >= 10 ? s.slice(0, 10) : s
}

export function getTicketBookingProductName(
  locale: string,
  product: { name?: string; name_en?: string; name_ko?: string } | undefined,
  tourFallback: string
): string {
  if (!product) return tourFallback
  const name = product.name?.trim()
  if (locale === 'en') {
    return product.name_en?.trim() || name || tourFallback
  }
  /** 한국어 UI — `products.name`(예: 밤도깨비) 우선, 없을 때만 name_ko */
  return name || product.name_ko?.trim() || product.name_en?.trim() || tourFallback
}

/** `2025-01-01 밤도깨비` 형식 */
export function formatTicketBookingTourHeadline(
  locale: string,
  tours: TicketBookingTourEnrichment | undefined,
  tourFallback: string,
  opts?: { appendPeople?: boolean }
): string | null {
  if (!tours) return null
  const product = getTicketBookingProductName(locale, tours.products ?? undefined, tourFallback)
  const date = formatTourDateYmd(tours.tour_date)
  const ko = locale.startsWith('ko')
  let base = ''
  if (date && product) base = `${date} ${product}`
  else base = product || date || ''
  if (!base) return null
  if (opts?.appendPeople) {
    const people = tours.total_people
    if (people != null && Number.isFinite(Number(people))) {
      base += ko ? ` ${people}명` : ` ${people}`
    }
  }
  return base
}

export type TicketBookingTourDetailBadge =
  | { kind: 'people'; count: number }
  | { kind: 'guide'; name: string }
  | { kind: 'assistant'; name: string }
  | { kind: 'vehicle'; label: string }

/** 상세 모달 2행 — 인원·가이드·어시·차량 뱃지 */
export function ticketBookingTourDetailBadges(
  tours: TicketBookingTourEnrichment | undefined,
  opts?: { omitPeople?: boolean }
): TicketBookingTourDetailBadge[] {
  if (!tours) return []
  const badges: TicketBookingTourDetailBadge[] = []
  const people = tours.total_people
  if (
    !opts?.omitPeople &&
    people != null &&
    Number.isFinite(Number(people))
  ) {
    badges.push({ kind: 'people', count: Number(people) })
  }
  const guide = tours.guide_display_name?.trim()
  if (guide) badges.push({ kind: 'guide', name: guide })
  const asst = tours.assistant_display_name?.trim()
  if (asst) badges.push({ kind: 'assistant', name: asst })
  const vehicle = tours.vehicle_display_name?.trim()
  if (vehicle) badges.push({ kind: 'vehicle', label: vehicle })
  return badges
}
