/** 가이드 포털 목록·촬영 투어에 필요한 컬럼만. JSON 오버라이드·메모는 제외. */
export const GUIDE_PORTAL_TOUR_LIST_SELECT = [
  'id',
  'tour_date',
  'tour_status',
  'assignment_status',
  'tour_guide_id',
  'assistant_id',
  'tour_car_id',
  'product_id',
  'reservation_ids',
  'is_private_tour',
].join(', ')

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/**
 * 가이드/어시스턴트로 배정된 투어 PostgREST `.or()` 필터.
 * 단일 이메일 exact match + 콤마 구분 목록(ilike)을 함께 쓴다.
 */
export function assignedToursOrFilter(email: string): string {
  const raw = email.trim().replace(/"/g, '')
  if (!raw) return 'id.eq.__none__'
  const lower = raw.toLowerCase()
  const like = escapeIlike(lower)
  const parts = [
    `tour_guide_id.eq."${lower}"`,
    `assistant_id.eq."${lower}"`,
    `tour_guide_id.ilike."%${like}%"`,
    `assistant_id.ilike."%${like}%"`,
  ]
  if (raw !== lower) {
    parts.unshift(`tour_guide_id.eq."${raw}"`, `assistant_id.eq."${raw}"`)
  }
  return parts.join(',')
}
