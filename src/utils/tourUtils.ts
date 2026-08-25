// 투어 관련 유틸리티 함수들

import { reservationExcludedFromTourAssignment } from '@/lib/reservationStatus'

/** tours.reservation_ids를 string[]로 정규화 (배열/JSON 문자열/콤마 구분 문자열/단일 UUID 지원, 중복 제거) */
export function normalizeReservationIds(reservationIds: unknown): string[] {
  let ids: string[] = []
  if (reservationIds == null) {
    ids = []
  } else if (Array.isArray(reservationIds)) {
    ids = reservationIds.map((id) => String(id).trim()).filter((id) => id.length > 0)
  } else if (typeof reservationIds === 'string') {
    const trimmed = reservationIds.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        ids = Array.isArray(parsed)
          ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0)
          : []
      } catch {
        ids = []
      }
    } else if (trimmed.includes(',')) {
      ids = trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    } else {
      ids = trimmed.length > 0 ? [trimmed] : []
    }
  }
  return [...new Set(ids)]
}

/**
 * tours.tour_guide_id / assistant_id 에 콤마 구분·JSON 장식 문자열이 올 수 있음 (DB normalize_email_list 와 동작 유사).
 * 봉투 인쇄 등에서 각 이메일별로 team.display_name 을 조회할 때 사용.
 */
export function parseTourAssignmentEmails(raw: string | null | undefined): string[] {
  if (raw == null || typeof raw !== 'string') return []
  let cleaned = raw.trim()
  if (!cleaned) return []
  cleaned = cleaned.replace(/[\[\]"]/g, '')
  return cleaned
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** UUID 하이픈 유무·대소문자 차이를 무시하고 예약 ID가 같은지 비교 */
export function reservationIdsLooselyEqual(a: string, b: string): boolean {
  const na = String(a).trim().toLowerCase()
  const nb = String(b).trim().toLowerCase()
  if (na === nb) return true
  const da = na.replace(/-/g, '')
  const db = nb.replace(/-/g, '')
  if (da.length === 32 && db.length === 32 && /^[0-9a-f]{32}$/.test(da) && /^[0-9a-f]{32}$/.test(db)) {
    return da === db
  }
  return false
}

/** 집계·중복 검사용 (UUID면 하이픈 제거 소문자) */
export function canonicalReservationIdKey(s: string): string {
  const t = String(s).trim().toLowerCase()
  const h = t.replace(/-/g, '')
  if (/^[0-9a-f]{32}$/.test(h)) return h
  return t
}

/** DB/JSON마다 다른 투어일 표기를 YYYY-MM-DD 키로 맞춤 */
export function normalizeTourDateKey(value: unknown): string {
  if (value == null) return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  return s.length >= 10 ? s.slice(0, 10) : s
}

/** 검색어가 날짜 형태인지 (리스트 뷰 월 필터 우회 등) */
export function isDateLikeSearchTerm(term: string): boolean {
  const t = term.trim()
  if (!t) return false
  if (/^\d{4}([./-]\d{1,2}([./-]\d{1,2})?)?$/.test(t)) return true
  if (/^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?$/.test(t)) return true
  if (/\d\s*년|\d\s*월|\d\s*일/.test(t)) return true
  return false
}

/** 검색어를 YYYY-MM-DD / YYYY-MM / YYYY 프리픽스로 정규화 시도 */
function parseSearchTermToDatePrefix(term: string): string | null {
  const t = term.trim().replace(/\s+/g, '')
  let m = t.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  }
  m = t.match(/^(\d{4})[-./](\d{1,2})$/)
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}`
  }
  m = t.match(/^(\d{4})$/)
  if (m) return m[1]
  m = t.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/)
  if (m) {
    let y = m[3]
    if (y.length === 2) y = `20${y}`
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  m = t.match(/^(\d{1,2})[-./](\d{1,2})$/)
  if (m) {
    return `-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  }
  return null
}

/** 투어일(tour_date)이 검색어와 일치하는지 — ISO·로케일 표기·부분 일치 */
export function tourDateMatchesSearchTerm(
  tourDate: string | null | undefined,
  term: string,
  locale: 'ko' | 'en' = 'ko'
): boolean {
  if (!term.trim()) return false
  const dateKey = normalizeTourDateKey(tourDate)
  if (!dateKey) return false
  const qRaw = term.trim()
  const q = qRaw.toLowerCase()
  const qCompact = q.replace(/\s/g, '')

  if (dateKey.includes(q) || dateKey.includes(qCompact)) return true

  const prefix = parseSearchTermToDatePrefix(qRaw)
  if (prefix) {
    if (prefix.startsWith('-')) return dateKey.includes(prefix)
    if (prefix.length === 10) return dateKey === prefix
    return dateKey.startsWith(prefix)
  }

  try {
    const d = new Date(`${dateKey}T12:00:00`)
    if (Number.isNaN(d.getTime())) return false
    const loc = locale === 'en' ? 'en-US' : 'ko-KR'
    const formatted = d.toLocaleDateString(loc).toLowerCase()
    if (formatted.includes(q)) return true
    if (formatted.replace(/\s/g, '').includes(qCompact)) return true
  } catch {
    /* ignore */
  }
  return false
}

/** 같은 상품·같은 투어일(날짜만)인지 */
export function sameTourProductAndDate(
  a: { product_id?: string | null; tour_date?: string | null },
  b: { product_id?: string | null; tour_date?: string | null }
): boolean {
  const pa = String(a.product_id ?? '').trim().toLowerCase()
  const pb = String(b.product_id ?? '').trim().toLowerCase()
  if (!pa || !pb || pa !== pb) return false
  return normalizeTourDateKey(a.tour_date) === normalizeTourDateKey(b.tour_date)
}

/** 정규화한 뒤, 첫 등장 순서를 유지하며 ID 중복을 제거 (한 투어의 reservation_ids 배열만 정리) */
export function dedupeReservationIdsPreservingOrder(reservationIds: unknown): string[] {
  const ids = normalizeReservationIds(reservationIds)
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const key = canonicalReservationIdKey(id)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

/** 예약 객체 배열에서 id 기준 중복 제거 (첫 등장 순서 유지) */
export function dedupeReservationsPreservingOrder<T extends { id: string | number | null | undefined }>(
  reservations: T[]
): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  for (const reservation of reservations) {
    const key = canonicalReservationIdKey(String(reservation.id ?? ''))
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(reservation)
  }
  return out
}

/**
 * 모든 투어의 reservation_ids에 각 예약 ID가 등장한 총 횟수.
 * 동일 투어 배열에 같은 ID가 두 번 있으면 2로 집계됩니다.
 */
export function countReservationOccurrencesAcrossTours(
  tours: Array<{ reservation_ids?: unknown }>
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tours) {
    for (const id of normalizeReservationIds(t.reservation_ids)) {
      const k = String(id).trim()
      if (!k) continue
      counts.set(k, (counts.get(k) || 0) + 1)
    }
  }
  return counts
}

/** 투어에 배정된 예약 중 하나라도 전역적으로 2번 이상 등장하면 true (배열 내 중복·다른 투어 중복 포함) */
export function tourHasReservationAssignmentDuplicates(
  reservationIdsRaw: unknown,
  globalCounts: Map<string, number>
): boolean {
  const ids = normalizeReservationIds(reservationIdsRaw)
  const seen = new Set<string>()
  for (const id of ids) {
    const k = String(id).trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    if ((globalCounts.get(k) || 0) >= 2) return true
  }
  return false
}

/** 예약 상태가 취소인지 (cancelled / canceled / cancel 포함) */
export function isReservationCancelledStatus(status: string | null | undefined): boolean {
  const s = (status || '').toString().toLowerCase().trim()
  if (!s) return false
  return s === 'cancelled' || s === 'canceled' || s.includes('cancel')
}

/** 예약 상태가 소프트 삭제(deleted)인지 */
export function isReservationDeletedStatus(status: string | null | undefined): boolean {
  return (status || '').toString().toLowerCase().trim() === 'deleted'
}

/** 투어 상태가 삭제(deleted)인지 (tour_status 또는 레거시 status) */
export function isTourDeletedStatus(status: string | null | undefined): boolean {
  return (status || '').toString().toLowerCase().trim() === 'deleted'
}

/** DB에서 예약/투어 행을 완전히 제거할 수 있는 계정 (클라이언트 표시용, 서버 RLS와 별도) */
export const PERMANENT_DELETE_ALLOWED_EMAIL = 'info@maniatour.com'

export function canPermanentDeleteRecords(userEmail: string | null | undefined): boolean {
  return (userEmail || '').toLowerCase().trim() === PERMANENT_DELETE_ALLOWED_EMAIL.toLowerCase()
}

type ReservationLike = {
  id?: string | null
  product_id?: string | null
  tour_date?: string | null
  status?: string | null
  total_people?: number | null
  adults?: number | null
  children?: number | null
  child?: number | null
  infants?: number | null
  infant?: number | null
}

/** 같은 상품·투어일 기준 취소 제외 또는 취소만 인원 합계 */
export function sumPeopleSameProductDate(
  tour: { product_id?: string | null; tour_date?: string | null },
  reservations: ReservationLike[],
  mode: 'nonCancelled' | 'cancelled'
): number {
  if (!tour || !reservations?.length) return 0
  const pid = (tour.product_id ?? '').toString().trim()
  const date = (tour.tour_date ?? '').toString().trim()
  if (!pid || !date) return 0
  return reservations.reduce((sum, r) => {
    if ((r.product_id ?? '').toString().trim() !== pid || (r.tour_date ?? '').toString().trim() !== date) {
      return sum
    }
    const cancelled = isReservationCancelledStatus(r.status)
    const deleted = isReservationDeletedStatus(r.status)
    if (mode === 'nonCancelled' && (cancelled || deleted || reservationExcludedFromTourAssignment(r.status))) return sum
    if (mode === 'cancelled' && !cancelled) return sum
    const p = r.total_people
    if (typeof p === 'number' && !Number.isNaN(p)) return sum + p
    const adults = Number(r.adults) || 0
    const children = Number(r.children ?? r.child) || 0
    const infants = Number(r.infants ?? r.infant) || 0
    return sum + adults + children + infants
  }, 0)
}

// 투어에 배정된 인원 (취소 예약 제외, total_people 우선)
export const calculateAssignedPeople = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return 0

  const ids = normalizeReservationIds(tour.reservation_ids)
  if (ids.length === 0) return 0
  const idSet = new Set(ids.map((id) => String(id).trim()))

  return reservations.reduce((total: number, reservation: ReservationLike) => {
    if (!idSet.has(String(reservation.id ?? '').trim())) return total
    if (isReservationCancelledStatus(reservation.status)) return total
    if (isReservationDeletedStatus(reservation.status)) return total
    if (reservationExcludedFromTourAssignment(reservation.status)) return total
    const p = reservation.total_people
    if (typeof p === 'number' && !Number.isNaN(p)) return total + p
    const adults = Number(reservation.adults) || 0
    const children = Number(reservation.children ?? reservation.child) || 0
    const infants = Number(reservation.infants ?? reservation.infant) || 0
    return total + adults + children + infants
  }, 0)
}

// 같은 상품/날짜의 예약 인원 합계 (취소 제외)
export const calculateTotalPeopleForSameProductDate = (tour: any, reservations: any[]) =>
  sumPeopleSameProductDate(tour, reservations, 'nonCancelled')

// 배정되지 않은 사람 수 계산
export const calculateUnassignedPeople = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return 0
  
  const assignedReservationIds = tour.reservation_ids || []
  const unassignedReservations = reservations.filter(r => 
    !assignedReservationIds.includes(r.id) && 
    r.product_id === tour.product_id && 
    r.tour_date === tour.tour_date &&
    !isReservationDeletedStatus(r.status) &&
    !reservationExcludedFromTourAssignment(r.status)
  )
  
  return unassignedReservations.reduce((total, reservation) => {
    return total + (reservation.adults || 0) + (reservation.children || 0)
  }, 0)
}

// 대기 중인 예약들 가져오기
export const getPendingReservations = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return []
  
  const assignedReservationIds = tour.reservation_ids || []
  return reservations.filter(r => 
    !assignedReservationIds.includes(r.id) && 
    r.product_id === tour.product_id && 
    r.tour_date === tour.tour_date &&
    !isReservationDeletedStatus(r.status) &&
    !reservationExcludedFromTourAssignment(r.status)
  )
}

// 그룹별 색상 매핑 함수
export const getGroupColorClasses = (groupId: string, groupName?: string, _optionName?: string) => {
  // 그룹 이름이나 ID에 따라 색상 결정
  const groupNameStr = (groupName || groupId).toLowerCase()
  
  // 특정 그룹에 대한 색상 매핑
  if (groupNameStr.includes('canyon') || groupNameStr.includes('캐년')) {
    return "text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-border"
  }
  if (groupNameStr.includes('hotel') || groupNameStr.includes('호텔') || groupNameStr.includes('room') || groupNameStr.includes('룸')) {
    return "text-xs px-2 py-1 rounded bg-green-100 text-green-800 border border-green-200"
  }
  if (groupNameStr.includes('meal') || groupNameStr.includes('식사') || groupNameStr.includes('food')) {
    return "text-xs px-2 py-1 rounded bg-orange-100 text-orange-800 border border-orange-200"
  }
  if (groupNameStr.includes('transport') || groupNameStr.includes('교통') || groupNameStr.includes('vehicle')) {
    return "text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200"
  }
  if (groupNameStr.includes('activity') || groupNameStr.includes('활동') || groupNameStr.includes('experience')) {
    return "text-xs px-2 py-1 rounded bg-pink-100 text-pink-800 border border-pink-200"
  }
  
  // 기본 색상 팔레트 (그룹 ID 해시 기반)
  const colorPalette = [
    "text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800 border border-indigo-200",
    "text-xs px-2 py-1 rounded bg-teal-100 text-teal-800 border border-teal-200",
    "text-xs px-2 py-1 rounded bg-cyan-100 text-cyan-800 border border-cyan-200",
    "text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200",
    "text-xs px-2 py-1 rounded bg-violet-100 text-violet-800 border border-violet-200",
    "text-xs px-2 py-1 rounded bg-rose-100 text-rose-800 border border-rose-200",
    "text-xs px-2 py-1 rounded bg-sky-100 text-sky-800 border border-sky-200",
    "text-xs px-2 py-1 rounded bg-lime-100 text-lime-800 border border-lime-200"
  ]
  
  // 그룹 ID의 해시값으로 색상 선택
  let hash = 0
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colorPalette[Math.abs(hash) % colorPalette.length]
}

// 옵션 배지 색상 배열
export const optionBadgeColors = [
  'bg-primary/10 text-primary',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-yellow-100 text-yellow-800',
  'bg-red-100 text-red-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-rose-100 text-rose-800'
]

// 옵션 ID를 기반으로 색상 선택하는 함수
export const getOptionBadgeColor = (optionId: string) => {
  // 옵션 ID의 해시값을 계산하여 색상 인덱스 결정
  let hash = 0
  for (let i = 0; i < optionId.length; i++) {
    const char = optionId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32비트 정수로 변환
  }
  const colorIndex = Math.abs(hash) % optionBadgeColors.length
  return optionBadgeColors[colorIndex]
}

// 옵션 이름 가져오기 함수
export const getOptionName = (optionId: string, productId: string, productOptionsData: any) => {
  if (!optionId || !productOptionsData || !productOptionsData[optionId]) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Option not found:', { optionId, productId, productOptionsData })
    }
    return optionId
  }
  
  const option = productOptionsData[optionId]
  const result = option.name || optionId
  if (process.env.NODE_ENV === 'development') {
    console.log('Option found:', { optionId, result, option })
  }
  return result
}

type TeamTypeKey = '1guide' | '2guide' | 'guide+driver'

export type ProductTeamTypeNameFields = {
  id?: string | null
  name?: string | null | undefined
  name_ko?: string | null | undefined
  name_en?: string | null | undefined
  internal_name_ko?: string | null | undefined
  internal_name_en?: string | null | undefined
  customer_name_ko?: string | null | undefined
  customer_name_en?: string | null | undefined
}

/** tours.team_type 문자열을 UI/저장용 키로 정규화. 알 수 없으면 null. */
export function normalizeTourTeamType(raw: string | null | undefined): TeamTypeKey | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  if (s === '1guide' || s === '1_guide') return '1guide'
  if (s === '2guide' || s === '2_guides' || s === '2guides') return '2guide'
  if (s === 'guide+driver' || s === 'guide_driver' || s === 'guidedriver') return 'guide+driver'
  return null
}

/**
 * tours.team_type 미저장(또는 DB 컬럼 기본값 1guide만 있는 경우) 시
 * 투어 상세「팀 구성 & 차량 배정」기본값.
 * 밤도깨비(MDGCSUNRISE 포함), 그랜드서클 당일 투어(MDGC1D) → 2가이드.
 */
export function getDefaultTeamTypeForProduct(
  nameKo?: string | null,
  nameEn?: string | null,
  extra?: Omit<ProductTeamTypeNameFields, 'name_ko' | 'name_en'> | null
): TeamTypeKey {
  const productId = String(extra?.id || '').trim().toUpperCase()
  if (
    productId === 'MDGCSUNRISE' ||
    productId.startsWith('MDGCSUNRISE') ||
    productId.startsWith('MDGCSUNR') ||
    productId === 'MDGC1D' ||
    productId.startsWith('MDGC1D')
  ) {
    return '2guide'
  }

  const koParts = [
    nameKo,
    extra?.name,
    extra?.internal_name_ko,
    extra?.customer_name_ko,
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean)
  const enParts = [
    nameEn,
    extra?.internal_name_en,
    extra?.customer_name_en,
  ]
    .map((v) => (v || '').trim().toLowerCase())
    .filter(Boolean)

  const koJoined = koParts.join(' ')
  const enJoined = enParts.join(' ')

  if (koJoined.includes('밤도깨비') || /night\s*goblin|midnight\s*goblin/i.test(enJoined)) {
    return '2guide'
  }

  // 상품명이 「당일 투어」(MDGC1D) — 그랜드서클이 이름에 없어도 2가이드
  if (koJoined.includes('당일 투어') || koJoined.includes('당일투어')) {
    return '2guide'
  }

  const koGrandCircleDay =
    (koJoined.includes('그랜드서클') || koJoined.includes('그랜드 서클')) &&
    koJoined.includes('당일')
  const enGrandCircleDay =
    enJoined.includes('grand circle') &&
    (enJoined.includes('day tour') || /\bday trip\b/i.test(enJoined)) &&
    !enJoined.includes('night')

  if (koGrandCircleDay || enGrandCircleDay) {
    return '2guide'
  }

  return '1guide'
}

/** 상품 객체에서 팀 구성 기본값 산출 */
export function getDefaultTeamTypeFromProduct(
  product?: ProductTeamTypeNameFields | null
): TeamTypeKey {
  if (!product) return '1guide'
  return getDefaultTeamTypeForProduct(product.name_ko, product.name_en, product)
}

/**
 * 투어 생성·복사 시 넣을 team_type.
 * - 원본에 2guide / guide+driver 가 있으면 그대로 유지
 * - 원본이 비어 있거나 DB 기본값(1guide)만 있고 상품 기본이 2guide 이면 상품 기본 사용
 */
export function resolveTeamTypeForTourCreate(opts: {
  sourceTeamType?: string | null
  product?: ProductTeamTypeNameFields | null
}): TeamTypeKey {
  const productDefault = getDefaultTeamTypeFromProduct(opts.product)
  const source = normalizeTourTeamType(opts.sourceTeamType)
  if (source === '2guide' || source === 'guide+driver') return source
  if (productDefault !== '1guide') return productDefault
  return source || productDefault
}

/** 날짜 문자열 → YYYY-MM-DD (비교용) */
export function toTourDateKey(input: string | null | undefined): string {
  if (input == null) return ''
  const s = String(input).trim()
  return s.length >= 10 ? s.slice(0, 10) : s
}

/** YYYY-MM-DD 기준으로 일수 더하기 (UTC 자정 기준) */
export function addDaysToYmd(ymd: string, days: number): string {
  const key = toTourDateKey(ymd)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return ''
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

type VehicleCategoryFields = {
  vehicle_category?: string | null
  rental_start_date?: string | null
  rental_end_date?: string | null
}

/**
 * 팀 구성 차량 드롭다운: 회사·개인 등 비렌트는 항상 표시.
 * 렌터카는 투어일이 렌트 시작일 이후이고, 렌트 종료일+3일 이내일 때만 표시.
 * (렌트 기간이 끝난 뒤 3일까지 배정 후보에 남김)
 */
export function isVehicleShownInTeamAssignmentDropdown(
  vehicle: VehicleCategoryFields,
  tourDate: string | null | undefined
): boolean {
  const cat = (vehicle.vehicle_category || '').toString().toLowerCase().trim()
  if (cat !== 'rental') return true

  const tour = toTourDateKey(tourDate)
  const start = toTourDateKey(vehicle.rental_start_date)
  const end = toTourDateKey(vehicle.rental_end_date)
  // 투어일 미전달 시(다른 화면 호환) 필터 생략
  if (!tour) return true
  if (!start || !end) return false

  if (tour < start) return false

  const lastEligible = addDaysToYmd(end, 3)
  if (!lastEligible || tour > lastEligible) return false

  return true
}