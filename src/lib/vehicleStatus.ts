/** DB vehicles.status CHECK 와 동일 (영문 코드만 저장) */
export const VEHICLE_STATUS_CODES = [
  'returned',
  'cancelled',
  'available',
  'inactive',
  'reserved',
  'maintenance',
] as const

export type VehicleStatusCode = (typeof VEHICLE_STATUS_CODES)[number]

/** 팀·투어 배정 등 선택 목록에서 제외할 때 사용 */
export function isInactiveVehicleStatus(status: string | null | undefined): boolean {
  return (status ?? '').toString().trim().toLowerCase() === 'inactive'
}

const LABEL_KO: Record<VehicleStatusCode, string> = {
  returned: '반납 완료',
  cancelled: '취소됨',
  available: '이용 가능',
  inactive: '비활성',
  reserved: '예약됨',
  maintenance: '정비 중',
}

/** UI용 한글 라벨 (알 수 없는 값은 그대로 표시) */
export function getVehicleStatusLabelKo(status: string | null | undefined): string {
  const s = (status || '').trim()
  if (s && s in LABEL_KO) return LABEL_KO[s as VehicleStatusCode]
  return s || LABEL_KO.available
}

const COLOR_CLASS: Record<VehicleStatusCode, string> = {
  available: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-slate-100 text-slate-800',
  reserved: 'bg-amber-100 text-amber-800',
  returned: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

export function getVehicleStatusBadgeClass(status: string | null | undefined): string {
  const s = (status || '').trim()
  if (s && s in COLOR_CLASS) return COLOR_CLASS[s as VehicleStatusCode]
  return 'bg-gray-100 text-gray-800'
}

/** 셀렉트 박스용 (value = DB 코드) */
export const VEHICLE_STATUS_SELECT_OPTIONS: { value: VehicleStatusCode; label: string }[] =
  VEHICLE_STATUS_CODES.map((value) => ({
    value,
    label: LABEL_KO[value],
  }))
