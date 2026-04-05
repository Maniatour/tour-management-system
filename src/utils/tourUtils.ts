// 투어 관련 유틸리티 함수들

/** tours.reservation_ids를 string[]로 정규화 (배열/JSON 문자열/콤마 구분 문자열/단일 UUID 지원) */
export function normalizeReservationIds(reservationIds: unknown): string[] {
  if (reservationIds == null) return []
  if (Array.isArray(reservationIds)) {
    return reservationIds.map((id) => String(id).trim()).filter((id) => id.length > 0)
  }
  if (typeof reservationIds === 'string') {
    const trimmed = reservationIds.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed)
          ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0)
          : []
      } catch {
        return []
      }
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    }
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
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
    if (mode === 'nonCancelled' && (cancelled || deleted)) return sum
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
    !isReservationDeletedStatus(r.status)
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
    !isReservationDeletedStatus(r.status)
  )
}

// 그룹별 색상 매핑 함수
export const getGroupColorClasses = (groupId: string, groupName?: string, optionName?: string) => {
  // 그룹 이름이나 ID에 따라 색상 결정
  const groupNameStr = (groupName || groupId).toLowerCase()
  const optionNameStr = (optionName || '').toLowerCase()
  
  // 특정 그룹에 대한 색상 매핑
  if (groupNameStr.includes('canyon') || groupNameStr.includes('캐년')) {
    return "text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 border border-blue-200"
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
  'bg-blue-100 text-blue-800',
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

/**
 * tours.team_type 미저장 시 투어 상세「팀 구성 & 차량 배정」기본값.
 * 밤도깨비 그랜드캐년 일출 투어, 그랜드서클 당일 투어 → 2가이드.
 */
export function getDefaultTeamTypeForProduct(
  nameKo?: string | null,
  nameEn?: string | null
): TeamTypeKey {
  const ko = (nameKo || '').trim()
  const en = (nameEn || '').trim().toLowerCase()

  if (ko.includes('밤도깨비')) {
    return '2guide'
  }

  const koGrandCircleDay =
    (ko.includes('그랜드서클') || ko.includes('그랜드 서클')) && ko.includes('당일')
  const enGrandCircleDay =
    en.includes('grand circle') &&
    (en.includes('day tour') || /\bday trip\b/i.test(en)) &&
    !en.includes('night')

  if (koGrandCircleDay || enGrandCircleDay) {
    return '2guide'
  }

  return '1guide'
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