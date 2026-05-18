/** @deprecated 저장된 선택값 마이그레이션용 — 예전 「공항 픽드롭」 단일 행 */
export const SCHEDULE_AIRPORT_PICK_DROP_ROW_ID = '__schedule_airport_pick_drop__'

/** @deprecated */
export const SCHEDULE_AIRPORT_PICK_DROP_DISPLAY_NAME = '공항 픽드롭'

export const SCHEDULE_AIRPORT_PICKUP_CANONICAL_ID = 'MSFPICKUP'
export const SCHEDULE_AIRPORT_SENDING_CANONICAL_ID = 'MSSENDING'

/** 스케줄·상품 선택 모달에 표시할 통합 상품 라벨 (DB name_ko 와 무관) */
export const SCHEDULE_AIRPORT_PICKUP_DISPLAY_NAME = '공항 픽업'
export const SCHEDULE_AIRPORT_SENDING_DISPLAY_NAME = '공항 샌딩'

const LEGACY_PICKUP_PRODUCT_IDS = new Set([
  'mspickup3',
  'mspickup6',
  'mspickup14',
  'msfpickup',
])

const LEGACY_SENDING_PRODUCT_IDS = new Set([
  'mssending3',
  'mssending6',
  'mssending14',
  'mssending',
])

/** 스케줄에서 픽업 계열로 묶을 상품명 (정확 일치) */
export const SCHEDULE_AIRPORT_PICKUP_PRODUCT_NAMES = [
  '공항 픽업 8주년 이벤트',
  '공항 픽업(1~3인)',
  '공항 픽업(4~6인)',
  '공항 픽업(7~14인)',
] as const

/** 스케줄에서 샌딩 계열로 묶을 상품명 (정확 일치) */
export const SCHEDULE_AIRPORT_SENDING_PRODUCT_NAMES = [
  '공항 샌딩 서비스',
  '공항 샌딩(1~3인)',
  '공항 샌딩(4~6인)',
  '공항 샌딩(7~14인)',
] as const

/** @deprecated 하위 호환 */
export const SCHEDULE_AIRPORT_PICK_DROP_PRODUCT_NAMES = [
  ...SCHEDULE_AIRPORT_PICKUP_PRODUCT_NAMES,
  ...SCHEDULE_AIRPORT_SENDING_PRODUCT_NAMES,
] as const

export type ScheduleProductRef = {
  id: string
  name: string
  name_ko?: string | null
  name_en?: string | null
  product_code?: string | null
}

function normalizeProductNameForMatch(name: string): string {
  return (name || '')
    .trim()
    .replace(/[～〜]/g, '~')
    .replace(/\s+/g, ' ')
}

function compactProductNameForMatch(name: string): string {
  return normalizeProductNameForMatch(name).replace(/\s/g, '')
}

export function getScheduleProductLabel(p: ScheduleProductRef): string {
  return (p.name_ko || p.name || p.name_en || p.product_code || '').trim()
}

function nameListIncludesCompact(name: string, list: readonly string[]): boolean {
  const compact = compactProductNameForMatch(name)
  return list.map(compactProductNameForMatch).includes(compact)
}

/** 예약·투어 이름 힌트용 (카탈로그 상품 분류와 분리) */
export function isScheduleAirportPickupProductName(name: string): boolean {
  const n = normalizeProductNameForMatch(name)
  if (!n) return false
  if (nameListIncludesCompact(name, SCHEDULE_AIRPORT_PICKUP_PRODUCT_NAMES)) return true
  if (/^공항\s*픽업\s*\(\s*\d+\s*[~\-]\s*\d+\s*인\s*\)/i.test(n)) return true
  return false
}

/** 예약·투어 이름 힌트용 */
export function isScheduleAirportSendingProductName(name: string): boolean {
  const n = normalizeProductNameForMatch(name)
  if (!n) return false
  if (nameListIncludesCompact(name, SCHEDULE_AIRPORT_SENDING_PRODUCT_NAMES)) return true
  if (/^공항\s*샌딩\s*\(\s*\d+\s*[~\-]\s*\d+\s*인\s*\)/i.test(n)) return true
  return false
}

/** @deprecated 픽업·샌딩 통합 판별 — 마이그레이션·힌트용 */
export function isScheduleAirportPickDropProductName(name: string): boolean {
  return isScheduleAirportPickupProductName(name) || isScheduleAirportSendingProductName(name)
}

/** 카탈로그: MSFPICKUP·구 variant ID 만 픽업 그룹 (이름만으로 묶지 않음) */
export function isScheduleAirportPickupProduct(p: ScheduleProductRef): boolean {
  return LEGACY_PICKUP_PRODUCT_IDS.has(canonicalScheduleProductId(p.id))
}

/** 카탈로그: MSSENDING·구 variant ID 만 샌딩 그룹 */
export function isScheduleAirportSendingProduct(p: ScheduleProductRef): boolean {
  return LEGACY_SENDING_PRODUCT_IDS.has(canonicalScheduleProductId(p.id))
}

/** @deprecated */
export function isScheduleAirportPickDropProduct(p: ScheduleProductRef): boolean {
  return isScheduleAirportPickupProduct(p) || isScheduleAirportSendingProduct(p)
}

export function canonicalScheduleProductId(id: string | null | undefined): string {
  return String(id ?? '').trim().toLowerCase()
}

export function isScheduleLegacyCombinedAirportRowKey(id: string): boolean {
  return id === SCHEDULE_AIRPORT_PICK_DROP_ROW_ID
}

export function isScheduleAirportPickupRowKey(id: string): boolean {
  return canonicalScheduleProductId(id) === canonicalScheduleProductId(SCHEDULE_AIRPORT_PICKUP_CANONICAL_ID)
}

export function isScheduleAirportSendingRowKey(id: string): boolean {
  return canonicalScheduleProductId(id) === canonicalScheduleProductId(SCHEDULE_AIRPORT_SENDING_CANONICAL_ID)
}

/** 스케줄에서 여러 product_id를 한 행으로 합산하는 행 키 */
export function isScheduleAirportGroupedRowKey(id: string): boolean {
  return (
    isScheduleLegacyCombinedAirportRowKey(id) ||
    isScheduleAirportPickupRowKey(id) ||
    isScheduleAirportSendingRowKey(id)
  )
}

/** @deprecated → isScheduleLegacyCombinedAirportRowKey */
export function isScheduleAirportPickDropRowKey(id: string): boolean {
  return isScheduleLegacyCombinedAirportRowKey(id)
}

export function getScheduleAirportPickupMemberProductIds(products: ScheduleProductRef[]): string[] {
  return products.filter((p) => isScheduleAirportPickupProduct(p)).map((p) => p.id)
}

export function getScheduleAirportSendingMemberProductIds(products: ScheduleProductRef[]): string[] {
  return products.filter((p) => isScheduleAirportSendingProduct(p)).map((p) => p.id)
}

/** @deprecated */
export function getScheduleAirportPickDropMemberProductIds(products: ScheduleProductRef[]): string[] {
  return [
    ...getScheduleAirportPickupMemberProductIds(products),
    ...getScheduleAirportSendingMemberProductIds(products),
  ]
}

export function getScheduleAirportPickupRowKey(_products?: ScheduleProductRef[]): string {
  return SCHEDULE_AIRPORT_PICKUP_CANONICAL_ID
}

export function getScheduleAirportSendingRowKey(_products?: ScheduleProductRef[]): string {
  return SCHEDULE_AIRPORT_SENDING_CANONICAL_ID
}

export function getScheduleAirportPickupDisplayName(
  _products?: ScheduleProductRef[],
  _rowKey?: string,
): string {
  return SCHEDULE_AIRPORT_PICKUP_DISPLAY_NAME
}

export function getScheduleAirportSendingDisplayName(
  _products?: ScheduleProductRef[],
  _rowKey?: string,
): string {
  return SCHEDULE_AIRPORT_SENDING_DISPLAY_NAME
}

type ScheduleAirportPickDropIdHint = {
  product_id?: string | null
  productName?: string | null
}

function addHintToSet(
  set: Set<string>,
  productId: string | null | undefined,
  nameHint: string | null | undefined,
  products: ScheduleProductRef[],
  kind: 'pickup' | 'sending',
) {
  const pid = canonicalScheduleProductId(productId)
  if (!pid) return
  const productById = new Map(products.map((p) => [canonicalScheduleProductId(p.id), p] as const))
  const product = productById.get(pid)
  const isPickup = kind === 'pickup'
  const matchesProduct = isPickup
    ? product && isScheduleAirportPickupProduct(product)
    : product && isScheduleAirportSendingProduct(product)
  const matchesName = nameHint
    ? isPickup
      ? isScheduleAirportPickupProductName(String(nameHint))
      : isScheduleAirportSendingProductName(String(nameHint))
    : false
  if (matchesProduct || matchesName) set.add(pid)
}

export function buildScheduleAirportPickupMemberIdSet(
  products: ScheduleProductRef[],
  hints?: {
    reservationProductIds?: Iterable<string | null | undefined>
    reservationHints?: Iterable<ScheduleAirportPickDropIdHint>
    tourHints?: Iterable<ScheduleAirportPickDropIdHint>
  },
): Set<string> {
  const set = new Set<string>()
  for (const id of getScheduleAirportPickupMemberProductIds(products)) {
    const canon = canonicalScheduleProductId(id)
    if (canon) set.add(canon)
  }
  if (hints?.reservationHints) {
    for (const r of hints.reservationHints) addHintToSet(set, r.product_id, r.productName, products, 'pickup')
  } else if (hints?.reservationProductIds) {
    for (const id of hints.reservationProductIds) addHintToSet(set, id, null, products, 'pickup')
  }
  if (hints?.tourHints) {
    for (const t of hints.tourHints) addHintToSet(set, t.product_id, t.productName, products, 'pickup')
  }
  return set
}

export function buildScheduleAirportSendingMemberIdSet(
  products: ScheduleProductRef[],
  hints?: {
    reservationProductIds?: Iterable<string | null | undefined>
    reservationHints?: Iterable<ScheduleAirportPickDropIdHint>
    tourHints?: Iterable<ScheduleAirportPickDropIdHint>
  },
): Set<string> {
  const set = new Set<string>()
  for (const id of getScheduleAirportSendingMemberProductIds(products)) {
    const canon = canonicalScheduleProductId(id)
    if (canon) set.add(canon)
  }
  if (hints?.reservationHints) {
    for (const r of hints.reservationHints) addHintToSet(set, r.product_id, r.productName, products, 'sending')
  } else if (hints?.reservationProductIds) {
    for (const id of hints.reservationProductIds) addHintToSet(set, id, null, products, 'sending')
  }
  if (hints?.tourHints) {
    for (const t of hints.tourHints) addHintToSet(set, t.product_id, t.productName, products, 'sending')
  }
  return set
}

/** @deprecated — 픽업·샌딩 합집합 */
export function buildScheduleAirportPickDropMemberIdSet(
  products: ScheduleProductRef[],
  hints?: {
    reservationProductIds?: Iterable<string | null | undefined>
    reservationHints?: Iterable<ScheduleAirportPickDropIdHint>
    tourHints?: Iterable<ScheduleAirportPickDropIdHint>
  },
): Set<string> {
  return new Set([
    ...buildScheduleAirportPickupMemberIdSet(products, hints),
    ...buildScheduleAirportSendingMemberIdSet(products, hints),
  ])
}

export function getScheduleAirportMemberIdSetForRowKey(
  rowKey: string,
  products: ScheduleProductRef[],
  pickupMemberIdSet: ReadonlySet<string>,
  sendingMemberIdSet: ReadonlySet<string>,
): Set<string> {
  if (isScheduleLegacyCombinedAirportRowKey(rowKey)) {
    return new Set([...pickupMemberIdSet, ...sendingMemberIdSet])
  }
  if (isScheduleAirportPickupRowKey(rowKey)) {
    return new Set(pickupMemberIdSet)
  }
  if (isScheduleAirportSendingRowKey(rowKey)) {
    return new Set(sendingMemberIdSet)
  }
  return new Set(
    expandScheduleRowProductIds(rowKey, products).map((id) => canonicalScheduleProductId(id)),
  )
}

/** 저장된 선택 목록: 구 단일 「공항 픽드롭」·개별 구 variant ID → MSFPICKUP / MSSENDING */
export function normalizeScheduleSelectedProducts(
  productIds: string[],
  products: ScheduleProductRef[],
): string[] {
  const pickupMembers = new Set(getScheduleAirportPickupMemberProductIds(products))
  const sendingMembers = new Set(getScheduleAirportSendingMemberProductIds(products))
  const pickupRowKey = getScheduleAirportPickupRowKey(products)
  const sendingRowKey = getScheduleAirportSendingRowKey(products)
  const legacyGroupId = SCHEDULE_AIRPORT_PICK_DROP_ROW_ID

  const hadPickupMember = productIds.some((id) => pickupMembers.has(id))
  const hadSendingMember = productIds.some((id) => sendingMembers.has(id))
  const hadLegacyGroup = productIds.includes(legacyGroupId)
  const hadPickupRow = productIds.includes(pickupRowKey)
  const hadSendingRow = productIds.includes(sendingRowKey)

  const result: string[] = []
  const seen = new Set<string>()

  const push = (id: string) => {
    if (!seen.has(id)) {
      result.push(id)
      seen.add(id)
    }
  }

  for (const id of productIds) {
    if (pickupMembers.has(id) || sendingMembers.has(id)) continue
    if (id === legacyGroupId) continue
    push(id)
  }

  const wantPickup = hadPickupMember || hadLegacyGroup || hadPickupRow
  const wantSending = hadSendingMember || hadLegacyGroup || hadSendingRow

  if (wantPickup && pickupMembers.size > 0) push(pickupRowKey)
  if (wantSending && sendingMembers.size > 0) push(sendingRowKey)

  return result
}

/** 테이블 행·필터용 실제 product_id 목록 */
export function expandScheduleRowProductIds(
  rowKey: string,
  products: ScheduleProductRef[],
  extraMemberIds?: Iterable<string>,
): string[] {
  if (isScheduleLegacyCombinedAirportRowKey(rowKey)) {
    const set = new Set(getScheduleAirportPickDropMemberProductIds(products))
    if (extraMemberIds) {
      for (const id of extraMemberIds) {
        if (id) set.add(id)
      }
    }
    return [...set]
  }
  if (isScheduleAirportPickupRowKey(rowKey)) {
    const set = new Set(getScheduleAirportPickupMemberProductIds(products))
    if (extraMemberIds) {
      for (const id of extraMemberIds) {
        if (id) set.add(id)
      }
    }
    return [...set]
  }
  if (isScheduleAirportSendingRowKey(rowKey)) {
    const set = new Set(getScheduleAirportSendingMemberProductIds(products))
    if (extraMemberIds) {
      for (const id of extraMemberIds) {
        if (id) set.add(id)
      }
    }
    return [...set]
  }
  return [rowKey]
}

export type ScheduleProductPickerItem =
  | { kind: 'single'; id: string; name: string }
  | { kind: 'group'; id: string; name: string; memberIds: string[] }

/** 상품 선택 모달: 공항 픽업·공항 샌딩 각각 한 행 (구 variant ID는 숨김) */
export function buildScheduleProductPickerItems(products: ScheduleProductRef[]): ScheduleProductPickerItem[] {
  const pickupMemberIds = getScheduleAirportPickupMemberProductIds(products)
  const sendingMemberIds = getScheduleAirportSendingMemberProductIds(products)
  const hidden = new Set([...pickupMemberIds, ...sendingMemberIds])
  const items: ScheduleProductPickerItem[] = []

  if (pickupMemberIds.length > 0) {
    items.push({
      kind: 'group',
      id: SCHEDULE_AIRPORT_PICKUP_CANONICAL_ID,
      name: SCHEDULE_AIRPORT_PICKUP_DISPLAY_NAME,
      memberIds: pickupMemberIds,
    })
  }

  if (sendingMemberIds.length > 0) {
    items.push({
      kind: 'group',
      id: SCHEDULE_AIRPORT_SENDING_CANONICAL_ID,
      name: SCHEDULE_AIRPORT_SENDING_DISPLAY_NAME,
      memberIds: sendingMemberIds,
    })
  }

  for (const p of products) {
    if (!hidden.has(p.id)) {
      items.push({ kind: 'single', id: p.id, name: getScheduleProductLabel(p) || p.name })
    }
  }

  return items
}

function resolveProductColorValue(
  rowKey: string,
  productColors: Record<string, string>,
): string | undefined {
  if (!rowKey) return undefined
  if (productColors[rowKey]) return productColors[rowKey]
  const lower = rowKey.toLowerCase()
  for (const [key, value] of Object.entries(productColors)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

/** 투어 product_id → productColors 맵 조회용 행 키 */
export function getScheduleColorRowKeyForProductId(
  productId: string | null | undefined,
  pickupMemberIdSet?: ReadonlySet<string>,
  sendingMemberIdSet?: ReadonlySet<string>,
): string {
  const raw = String(productId ?? '').trim()
  if (!raw) return ''
  const canon = canonicalScheduleProductId(raw)
  if (pickupMemberIdSet?.has(canon)) {
    return SCHEDULE_AIRPORT_PICKUP_CANONICAL_ID
  }
  if (sendingMemberIdSet?.has(canon)) {
    return SCHEDULE_AIRPORT_SENDING_CANONICAL_ID
  }
  return raw
}

/** @deprecated — pickup/sending 세트 분리 인자 사용 */
export function getScheduleColorRowKeyForProductIdLegacy(
  productId: string | null | undefined,
  airportMemberIdSet?: ReadonlySet<string>,
): string {
  const raw = String(productId ?? '').trim()
  if (!raw) return ''
  if (airportMemberIdSet?.has(canonicalScheduleProductId(raw))) {
    return SCHEDULE_AIRPORT_PICK_DROP_ROW_ID
  }
  return raw
}

/** 상품 목록 순서 기반 기본 프리셋 (selectedProducts 미선택 시 폴백) */
export function getScheduleDefaultPresetIdForProduct(
  productId: string | null | undefined,
  products: ScheduleProductRef[],
  defaultPresetIds: readonly string[],
): string {
  if (defaultPresetIds.length === 0) return 'preset_0'
  const raw = String(productId ?? '').trim()
  if (!raw) return defaultPresetIds[0]
  const canon = canonicalScheduleProductId(raw)
  const idx = products.findIndex(
    (p) => p.id === raw || canonicalScheduleProductId(p.id) === canon,
  )
  return defaultPresetIds[idx >= 0 ? idx % defaultPresetIds.length : 0]
}

export function getScheduleProductColor(
  rowKey: string,
  productColors: Record<string, string>,
  defaultPresetId: string,
): string {
  return resolveProductColorValue(rowKey, productColors) ?? defaultPresetId
}

/** 가이드·차량 스케줄 등: 투어 product_id로 지정된 상품 색상 조회 */
export function getScheduleProductColorForProductId(
  productId: string | null | undefined,
  productColors: Record<string, string>,
  products: ScheduleProductRef[],
  defaultPresetIds: readonly string[],
  pickupMemberIdSet?: ReadonlySet<string>,
  sendingMemberIdSet?: ReadonlySet<string>,
): string {
  const rowKey = getScheduleColorRowKeyForProductId(
    productId,
    pickupMemberIdSet,
    sendingMemberIdSet,
  )
  if (!rowKey) return defaultPresetIds[0] ?? 'preset_0'
  const defaultId = getScheduleDefaultPresetIdForProduct(productId, products, defaultPresetIds)
  return getScheduleProductColor(rowKey, productColors, defaultId)
}
