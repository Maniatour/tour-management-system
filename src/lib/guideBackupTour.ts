import { isTourCancelled } from '@/utils/tourStatusUtils'

/**
 * 가이드에게 배정됐지만 배정 인원이 없는 투어 = 추가 모집용 백업 스케줄.
 * 실제 투어는 진행될 수도, 진행하지 않을 수도 있다.
 */
export function isGuideBackupTour(input: {
  assignedPeople?: number | null | undefined
  tourGuideId?: string | null | undefined
  assistantId?: string | null | undefined
  tourStatus?: string | null | undefined
  assignmentStatus?: string | null | undefined
}): boolean {
  if (isTourCancelled(input.tourStatus)) return false
  const assignment = String(input.assignmentStatus || '').toLowerCase().trim()
  if (assignment === 'rejected') return false
  const hasAssignedStaff =
    Boolean(String(input.tourGuideId || '').trim()) ||
    Boolean(String(input.assistantId || '').trim())
  if (!hasAssignedStaff) return false
  return (Number(input.assignedPeople) || 0) <= 0
}
