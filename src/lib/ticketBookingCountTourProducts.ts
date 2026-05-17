/**
 * 스케줄 부킹·건강점검: 입장권 수량과 투어 인원을 비교할 상품.
 * 멀티데이 · 밤도깨비 · 당일(앤텔롭+홀슈) 투어만 (`TicketBookingList` 달력 투어와 동일 범위).
 */
export const TICKET_BOOKING_COUNT_TOUR_PRODUCT_IDS = [
  'MDGCSUNRISE',
  'MDGC1D',
  'MNGC1N',
  'MNGC2N',
  'MNGC3N',
  'MNCUSTOM',
  'MNM1',
  'MDGC1DPRVT',
  'MDGCSUNRPRVT',
  'MNGC1NPRVT',
  'MNGC2NPRVT',
] as const

export function productIdRequiresTicketBookingCount(productId: string | null | undefined): boolean {
  const pid = String(productId ?? '').trim()
  if (!pid) return false
  if ((TICKET_BOOKING_COUNT_TOUR_PRODUCT_IDS as readonly string[]).includes(pid)) return true
  if (pid.startsWith('MNGC1N') || pid.startsWith('MNM1')) return true
  if (pid.startsWith('MNGC2N')) return true
  if (pid.startsWith('MNGC3N')) return true
  if (pid.startsWith('MDGC1D')) return true
  if (pid.startsWith('MDGCSUNRISE') || pid.startsWith('MDGCSUNRPRVT')) return true
  return false
}

export function tourProductRequiresTicketBookingCount(tour: {
  product_id?: string | null
  products?: { name?: string | null; name_ko?: string | null } | null
}): boolean {
  if (productIdRequiresTicketBookingCount(tour?.product_id)) return true
  const name = String(tour?.products?.name_ko ?? tour?.products?.name ?? '').trim()
  if (!name) return false
  if (name.includes('밤도깨비')) return true
  if ((name.includes('그랜드서클') || name.includes('그랜드 서클')) && name.includes('당일')) return true
  if (
    (name.includes('앤텔롭') || name.includes('앤틸롭') || name.includes('엔텔롭')) &&
    (name.includes('홀슈') || name.includes('호스슈') || name.includes('Horseshoe'))
  ) {
    return true
  }
  if (/MNGC\d+N/i.test(name) || name.includes('1박2일') || name.includes('2박3일') || name.includes('3박4일')) {
    return true
  }
  return false
}
