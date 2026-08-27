import { normalizeTourDateKey } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

export type StaffAssignmentLockTour = {
  id?: string | null
  tour_date?: string | null
  tour_status?: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  guide_assignment_locked?: boolean | null | string
  assistant_assignment_locked?: boolean | null | string
}

export type StaffAssignmentLockRole = 'guide' | 'assistant' | 'both'

export type StaffAssignmentLockBlock = {
  kind: 'role_locked' | 'staff_locked_elsewhere'
  role: StaffAssignmentLockRole
  tourId: string
}

export const STAFF_ASSIGNMENT_LOCK_CHANGED_EVENT = 'kovegas:staff-assignment-lock-changed'

export type StaffAssignmentLockChangedDetail = {
  tourId: string
  guide_assignment_locked: boolean
  assistant_assignment_locked: boolean
}

export function isTruthyLockFlag(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'TRUE' || value === 't'
}

export function isGuideAssignmentLocked(
  tour: StaffAssignmentLockTour | null | undefined,
): boolean {
  return isTruthyLockFlag(tour?.guide_assignment_locked)
}

export function isAssistantAssignmentLocked(
  tour: StaffAssignmentLockTour | null | undefined,
): boolean {
  return isTruthyLockFlag(tour?.assistant_assignment_locked)
}

export function emitStaffAssignmentLockChanged(detail: StaffAssignmentLockChangedDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STAFF_ASSIGNMENT_LOCK_CHANGED_EVENT, { detail }))
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function emailsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEmail(a)
  const right = normalizeEmail(b)
  return Boolean(left) && left === right
}

function assignmentValueChanged(
  current: string | null | undefined,
  next: string | null | undefined,
): boolean {
  return normalizeEmail(current) !== normalizeEmail(next)
}

export function getLockedRoleChangeBlock(
  tour: StaffAssignmentLockTour,
  patch: {
    tour_guide_id?: string | null
    assistant_id?: string | null
    team_type?: string | null
  },
): StaffAssignmentLockBlock | null {
  const tourId = String(tour.id || '').trim()
  if (!tourId) return null

  const nextGuide = 'tour_guide_id' in patch ? patch.tour_guide_id : tour.tour_guide_id
  const nextAssistant =
    'assistant_id' in patch
      ? patch.assistant_id
      : patch.team_type === '1guide'
        ? null
        : tour.assistant_id

  const guideChanging =
    'tour_guide_id' in patch && assignmentValueChanged(tour.tour_guide_id, nextGuide)
  const assistantChanging =
    ('assistant_id' in patch || patch.team_type === '1guide') &&
    assignmentValueChanged(tour.assistant_id, nextAssistant)

  const guideBlocked = guideChanging && isGuideAssignmentLocked(tour)
  const assistantBlocked = assistantChanging && isAssistantAssignmentLocked(tour)

  if (guideBlocked && assistantBlocked) {
    return { kind: 'role_locked', role: 'both', tourId }
  }
  if (guideBlocked) {
    return { kind: 'role_locked', role: 'guide', tourId }
  }
  if (assistantBlocked) {
    return { kind: 'role_locked', role: 'assistant', tourId }
  }
  return null
}

export function findStaffLockedElsewhere(
  tours: StaffAssignmentLockTour[],
  args: {
    staffEmail: string | null | undefined
    date: string | null | undefined
    excludeTourId: string
  },
): StaffAssignmentLockBlock | null {
  const email = normalizeEmail(args.staffEmail)
  const dateKey = normalizeTourDateKey(args.date)
  if (!email || !dateKey) return null

  for (const tour of tours) {
    if (String(tour.id || '') === String(args.excludeTourId)) continue
    if (isTourCancelled(tour.tour_status)) continue
    if (normalizeTourDateKey(tour.tour_date) !== dateKey) continue

    if (isGuideAssignmentLocked(tour) && emailsEqual(tour.tour_guide_id, email)) {
      return {
        kind: 'staff_locked_elsewhere',
        role: 'guide',
        tourId: String(tour.id),
      }
    }
    if (isAssistantAssignmentLocked(tour) && emailsEqual(tour.assistant_id, email)) {
      return {
        kind: 'staff_locked_elsewhere',
        role: 'assistant',
        tourId: String(tour.id),
      }
    }
  }
  return null
}

export function getStaffAssignmentChangeBlock(
  tours: StaffAssignmentLockTour[],
  tour: StaffAssignmentLockTour,
  patch: {
    tour_guide_id?: string | null
    assistant_id?: string | null
    team_type?: string | null
  },
): StaffAssignmentLockBlock | null {
  const roleBlock = getLockedRoleChangeBlock(tour, patch)
  if (roleBlock) return roleBlock

  const tourId = String(tour.id || '').trim()
  if (!tourId) return null

  if ('tour_guide_id' in patch && patch.tour_guide_id) {
    const elsewhere = findStaffLockedElsewhere(tours, {
      staffEmail: patch.tour_guide_id,
      date: tour.tour_date,
      excludeTourId: tourId,
    })
    if (elsewhere) return elsewhere
  }

  if ('assistant_id' in patch && patch.assistant_id) {
    const elsewhere = findStaffLockedElsewhere(tours, {
      staffEmail: patch.assistant_id,
      date: tour.tour_date,
      excludeTourId: tourId,
    })
    if (elsewhere) return elsewhere
  }

  return null
}

export function getStaffAssignmentLockWarningCopy(
  block: StaffAssignmentLockBlock,
  locale: string,
): { title: string; message: string; confirm: string } {
  const isKo = locale === 'ko'
  const title = isKo ? '고정된 스케줄' : 'Locked schedule'
  const confirm = isKo ? '확인' : 'OK'

  if (block.kind === 'staff_locked_elsewhere') {
    return {
      title,
      confirm,
      message: isKo
        ? '해당 가이드는 같은 날 다른 투어에 고정 배정되어 있습니다. 고객이 지정한 가이드이므로 다른 팀으로 옮기거나 스케줄에서 뺄 수 없습니다. 변경이 필요하면 투어 상세에서 고정을 해제한 뒤 다시 시도하세요.'
        : 'This guide is locked on another tour the same day. Because the customer requested this guide, they cannot be moved to another team or removed from that schedule. Unlock the assignment in tour details first if you need to change it.',
    }
  }

  if (block.role === 'assistant') {
    return {
      title,
      confirm,
      message: isKo
        ? '이 투어의 2차 가이드(어시스턴트) 배정은 고정되어 있습니다. 고객이 지정한 가이드이므로 다른 팀으로 변경하거나 해제할 수 없습니다. 변경이 필요하면 투어 상세에서 고정을 해제한 뒤 다시 시도하세요.'
        : 'The assistant assignment on this tour is locked. Because the customer requested this guide, they cannot be reassigned or unassigned. Unlock the assignment in tour details first if you need to change it.',
    }
  }

  if (block.role === 'both') {
    return {
      title,
      confirm,
      message: isKo
        ? '이 투어의 가이드·어시스턴트 배정이 고정되어 있습니다. 고객이 지정한 가이드이므로 다른 팀으로 변경하거나 스케줄에서 뺄 수 없습니다. 변경이 필요하면 투어 상세에서 고정을 해제한 뒤 다시 시도하세요.'
        : 'The guide and assistant assignments on this tour are locked. Because the customer requested these guides, they cannot be reassigned or removed. Unlock the assignment in tour details first if you need to change it.',
    }
  }

  return {
    title,
    confirm,
    message: isKo
      ? '이 투어의 가이드 배정은 고정되어 있습니다. 고객이 지정한 가이드이므로 다른 팀으로 변경하거나 해제할 수 없습니다. 변경이 필요하면 투어 상세에서 고정을 해제한 뒤 다시 시도하세요.'
      : 'The guide assignment on this tour is locked. Because the customer requested this guide, they cannot be reassigned or unassigned. Unlock the assignment in tour details first if you need to change it.',
  }
}

export function isStaffAssignmentLockDbError(error: { message?: string | null } | null | undefined): boolean {
  return String(error?.message || '').includes('STAFF_ASSIGNMENT_LOCKED')
}
