/** DB에 한글 프리셋으로 저장된 Off 사유 → i18n 키 */
const OFF_SCHEDULE_REASON_KEYS: Record<string, string> = {
  연차: 'annualLeave',
  반차: 'halfDay',
  병가: 'sickLeave',
  경조사: 'familyEvent',
  출장: 'businessTrip',
  교육: 'training',
  기타: 'other',
  // 영문 저장본도 동일 키로 매핑
  'annual leave': 'annualLeave',
  'half day': 'halfDay',
  'sick leave': 'sickLeave',
  'family event': 'familyEvent',
  'business trip': 'businessTrip',
  training: 'training',
  other: 'other',
}

export const OFF_SCHEDULE_REASON_PRESETS = [
  '연차',
  '반차',
  '병가',
  '경조사',
  '출장',
  '교육',
  '기타',
] as const

export function getOffScheduleReasonKey(reason: string | null | undefined): string | null {
  if (!reason) return null
  const trimmed = reason.trim()
  return (
    OFF_SCHEDULE_REASON_KEYS[trimmed] ??
    OFF_SCHEDULE_REASON_KEYS[trimmed.toLowerCase()] ??
    null
  )
}

/**
 * 알려진 프리셋 사유는 로케일 라벨로, 그 외 자유 입력은 원문 그대로 반환.
 * t는 `*.offSchedule.reasons.*` 네임스페이스를 가진 translator를 전달.
 */
export function translateOffScheduleReason(
  reason: string | null | undefined,
  t: (key: string) => string
): string {
  if (!reason) return ''
  const key = getOffScheduleReasonKey(reason)
  if (!key) return reason
  try {
    return t(`offSchedule.reasons.${key}`)
  } catch {
    return reason
  }
}
