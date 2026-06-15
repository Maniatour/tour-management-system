import {
  canonicalScheduleProductId,
  expandScheduleRowProductIds,
  getScheduleAirportMemberIdSetForRowKey,
  getScheduleAirportPickupMemberProductIds,
  getScheduleAirportPickupRowKey,
  getScheduleAirportPickupDisplayName,
  getScheduleAirportSendingDisplayName,
  getScheduleAirportSendingMemberProductIds,
  getScheduleAirportSendingRowKey,
  getScheduleProductLabel,
  isScheduleAirportGroupedRowKey,
  isScheduleAirportPickupRowKey,
  isScheduleAirportSendingRowKey,
  type ScheduleProductRef,
} from '@/lib/scheduleAirportPickDropGroup'

export const SCHEDULE_MISC_TOUR_ROW_ID = '__schedule_misc_tour__'
export const SCHEDULE_MISC_TOUR_DISPLAY_NAME = '기타'
export const SCHEDULE_MISC_TOUR_PRODUCTS_SETTING_KEY = 'schedule_misc_tour_products'

const MISC_TOUR_ALLOWED_SUB_CATEGORIES = new Set(['mania tour', 'mania service'])

/** 기타 포함 상품 모달에 표시할 sub_category (대소문자 무시) */
export function isMiscTourSelectableSubCategory(subCategory: string | null | undefined): boolean {
  const normalized = (subCategory || '').trim().toLowerCase()
  return MISC_TOUR_ALLOWED_SUB_CATEGORIES.has(normalized)
}

export function isMiscTourSelectableProduct(product: { sub_category?: string | null }): boolean {
  return isMiscTourSelectableSubCategory(product.sub_category)
}

export function isScheduleMiscTourRowKey(id: string): boolean {
  return id === SCHEDULE_MISC_TOUR_ROW_ID
}

/** 공항 통합 행·기타 투어 등 여러 product_id를 한 행으로 합산하는 행 키 */
export function isScheduleAggregatedRowKey(id: string): boolean {
  return isScheduleAirportGroupedRowKey(id) || isScheduleMiscTourRowKey(id)
}

export function getScheduleMiscTourDisplayName(): string {
  return SCHEDULE_MISC_TOUR_DISPLAY_NAME
}

export function getMiscTourStoredItemLabel(
  storedId: string,
  products: ScheduleProductRef[],
): string {
  if (isScheduleAirportSendingRowKey(storedId)) {
    return getScheduleAirportSendingDisplayName()
  }
  if (isScheduleAirportPickupRowKey(storedId)) {
    return getScheduleAirportPickupDisplayName()
  }
  const product = products.find((p) => p.id === storedId)
  return product ? getScheduleProductLabel(product) || product.name : storedId
}

export function expandMiscTourStoredProductIds(
  storedIds: string[],
  products: ScheduleProductRef[],
): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    result.push(id)
  }
  for (const id of storedIds) {
    if (isScheduleAirportSendingRowKey(id)) {
      for (const memberId of getScheduleAirportSendingMemberProductIds(products)) add(memberId)
    } else if (isScheduleAirportPickupRowKey(id)) {
      for (const memberId of getScheduleAirportPickupMemberProductIds(products)) add(memberId)
    } else if (products.some((p) => p.id === id)) {
      add(id)
    }
  }
  return result
}

export function normalizeMiscTourProductIds(
  productIds: string[],
  products: ScheduleProductRef[],
): string[] {
  const validProduct = new Set(products.map((p) => p.id))
  const sendingMembers = new Set(getScheduleAirportSendingMemberProductIds(products))
  const pickupMembers = new Set(getScheduleAirportPickupMemberProductIds(products))
  const sendingKey = getScheduleAirportSendingRowKey(products)
  const pickupKey = getScheduleAirportPickupRowKey(products)

  const hadSendingGroup = productIds.includes(sendingKey)
  const hadPickupGroup = productIds.includes(pickupKey)
  const hadSendingMember = productIds.some((id) => sendingMembers.has(id))
  const hadPickupMember = productIds.some((id) => pickupMembers.has(id))

  const result: string[] = []
  const seen = new Set<string>()
  const push = (id: string) => {
    if (!seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }

  for (const id of productIds) {
    if (sendingMembers.has(id) || pickupMembers.has(id)) continue
    if (id === sendingKey || id === pickupKey) continue
    if (validProduct.has(id)) push(id)
  }

  if ((hadSendingGroup || hadSendingMember) && sendingMembers.size > 0) push(sendingKey)
  if ((hadPickupGroup || hadPickupMember) && pickupMembers.size > 0) push(pickupKey)

  return result
}

/** 기타 투어 멤버 상품은 개별 행 대신 통합 행 키로 치환 */
export function applyMiscTourToSelectedProducts(
  productIds: string[],
  miscTourProductIds: string[],
  products: ScheduleProductRef[],
): string[] {
  const miscStored = new Set(miscTourProductIds)
  const expandedMisc = new Set(expandMiscTourStoredProductIds(miscTourProductIds, products))

  const result: string[] = []
  const seen = new Set<string>()

  for (const id of productIds) {
    if (expandedMisc.has(id)) continue
    if (miscStored.has(id)) continue
    if (id === SCHEDULE_MISC_TOUR_ROW_ID) continue
    if (!seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }

  if (miscTourProductIds.length > 0) {
    if (!seen.has(SCHEDULE_MISC_TOUR_ROW_ID)) {
      result.push(SCHEDULE_MISC_TOUR_ROW_ID)
      seen.add(SCHEDULE_MISC_TOUR_ROW_ID)
    }
  }

  return result
}

export function expandScheduleRowProductIdsWithMisc(
  rowKey: string,
  products: ScheduleProductRef[],
  miscTourProductIds: string[],
  extraMemberIds?: Iterable<string>,
): string[] {
  if (isScheduleMiscTourRowKey(rowKey)) {
    const set = new Set(expandMiscTourStoredProductIds(miscTourProductIds, products))
    if (extraMemberIds) {
      for (const id of extraMemberIds) {
        if (id) set.add(id)
      }
    }
    return [...set]
  }
  return expandScheduleRowProductIds(rowKey, products, extraMemberIds)
}

export function getScheduleRowMemberIdSet(
  rowKey: string,
  products: ScheduleProductRef[],
  airportPickupMemberIdSet: ReadonlySet<string>,
  airportSendingMemberIdSet: ReadonlySet<string>,
  miscTourProductIds: string[],
): Set<string> {
  if (isScheduleMiscTourRowKey(rowKey)) {
    return new Set(
      expandMiscTourStoredProductIds(miscTourProductIds, products).map((id) =>
        canonicalScheduleProductId(id),
      ),
    )
  }
  if (isScheduleAirportGroupedRowKey(rowKey)) {
    return getScheduleAirportMemberIdSetForRowKey(
      rowKey,
      products,
      airportPickupMemberIdSet,
      airportSendingMemberIdSet,
    )
  }
  return new Set(
    expandScheduleRowProductIds(rowKey, products).map((id) => canonicalScheduleProductId(id)),
  )
}

export type MiscTourDayProductBreakdown = Record<
  string,
  Record<string, { name: string; total: number; waiting: number }>
>

type ReservationLike = {
  product_id?: string | null
  tour_date?: string | null
  status?: string | null
  total_people?: number | null
}

export function buildMiscTourDayProductBreakdown(
  miscTourProductIds: string[],
  products: ScheduleProductRef[],
  reservations: ReservationLike[],
): MiscTourDayProductBreakdown {
  const members = expandMiscTourStoredProductIds(miscTourProductIds, products)
  if (members.length === 0) return {}

  const memberSet = new Set(members.map((id) => canonicalScheduleProductId(id)))
  const nameByCanon = new Map<string, string>()
  for (const p of products) {
    nameByCanon.set(canonicalScheduleProductId(p.id), getScheduleProductLabel(p) || p.id)
  }

  const result: MiscTourDayProductBreakdown = {}

  for (const res of reservations) {
    const canon = canonicalScheduleProductId(res.product_id)
    if (!memberSet.has(canon)) continue
    const dateString = String(res.tour_date || '').slice(0, 10)
    if (!dateString) continue
    const st = String(res.status ?? '').toLowerCase()
    if (st === 'deleted') continue

    if (!result[dateString]) result[dateString] = {}
    if (!result[dateString][canon]) {
      result[dateString][canon] = {
        name: nameByCanon.get(canon) || canon,
        total: 0,
        waiting: 0,
      }
    }

    const people = res.total_people || 0
    if (st === 'pending') {
      result[dateString][canon].waiting += people
    } else if (st === 'confirmed' || st === 'recruiting') {
      result[dateString][canon].total += people
    }
  }

  return result
}
