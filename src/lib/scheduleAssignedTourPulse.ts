import { isTourCancelled, isTourConfirmedStatus } from '@/utils/tourStatusUtils'

/** 오늘부터 이 일수까지 배차·배정·상태 미확정을 스케줄 셀/박스에 깜빡임 */
export const SCHEDULE_TOUR_CONFIRMATION_PULSE_WINDOW_DAYS = 7

export type ScheduleAssignedTourPulseKind =
  | 'missing_dispatch'
  | 'unconfirmed_assignment'
  | 'unconfirmed_tour'

export type ScheduleAssignedTourPulseIssue = {
  kind: ScheduleAssignedTourPulseKind
  statusLabel?: string
}

function normalizeAssignmentStatus(status: string | null | undefined): string {
  if (!status) return 'pending'
  const s = status.toLowerCase().trim()
  if (s === 'confirm') return 'confirmed'
  return s
}

const ASSIGNMENT_STATUS_LABEL_KO: Record<string, string> = {
  pending: '배정 대기',
  assigned: '부여',
  confirmed: '배정',
  rejected: '거절',
  cancelled: '취소',
  recruiting: '모집중',
}

export function isScheduleVehicleDispatched(tourCarId: string | null | undefined): boolean {
  return Boolean(tourCarId && String(tourCarId).trim())
}

export function isScheduleAssignmentConfirmed(status: string | null | undefined): boolean {
  return normalizeAssignmentStatus(status) === 'confirmed'
}

export function isScheduleTourDateInConfirmationPulseWindow(
  tourDate: string | null | undefined,
  today: string,
  windowEnd: string = scheduleTourConfirmationPulseWindowEnd(today),
): boolean {
  const date = String(tourDate || '').slice(0, 10)
  if (!date) return false
  return date >= today && date <= windowEnd
}

export function scheduleTourConfirmationPulseWindowEnd(
  today: string,
  windowDays: number = SCHEDULE_TOUR_CONFIRMATION_PULSE_WINDOW_DAYS,
): string {
  const [year, month, day] = today.split('-').map((part) => Number(part))
  if (!year || !month || !day) return today
  const next = new Date(Date.UTC(year, month - 1, day + (windowDays - 1)))
  const yyyy = next.getUTCFullYear()
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function collectTourConfirmationPulseIssues(args: {
  tourDate: string | null | undefined
  tourStatus: string | null | undefined
  assignmentStatus: string | null | undefined
  tourCarId: string | null | undefined
  assignedPeople: number
  today: string
  windowEnd?: string
  tourStatusLabel?: string
  assignmentStatusLabel?: string
}): ScheduleAssignedTourPulseIssue[] {
  if (isTourCancelled(args.tourStatus)) return []
  if ((Number(args.assignedPeople) || 0) <= 0) return []
  if (
    !isScheduleTourDateInConfirmationPulseWindow(
      args.tourDate,
      args.today,
      args.windowEnd ?? scheduleTourConfirmationPulseWindowEnd(args.today),
    )
  ) {
    return []
  }

  const issues: ScheduleAssignedTourPulseIssue[] = []
  if (!isScheduleVehicleDispatched(args.tourCarId)) {
    issues.push({ kind: 'missing_dispatch' })
  }
  if (!isScheduleAssignmentConfirmed(args.assignmentStatus)) {
    issues.push({
      kind: 'unconfirmed_assignment',
      statusLabel:
        args.assignmentStatusLabel ||
        ASSIGNMENT_STATUS_LABEL_KO[normalizeAssignmentStatus(args.assignmentStatus)] ||
        '미정',
    })
  }
  if (!isTourConfirmedStatus(args.tourStatus)) {
    issues.push(
      args.tourStatusLabel
        ? { kind: 'unconfirmed_tour', statusLabel: args.tourStatusLabel }
        : { kind: 'unconfirmed_tour' },
    )
  }
  return issues
}

export function scheduleAssignedTourPulseAlertLine(
  issue: ScheduleAssignedTourPulseIssue,
  uiLocale: string,
): string {
  const isKo = uiLocale === 'ko'
  if (issue.kind === 'missing_dispatch') {
    return isKo ? '배차 미확정 · 미배차' : 'Dispatch not confirmed · no vehicle'
  }
  if (issue.kind === 'unconfirmed_assignment') {
    const detail = issue.statusLabel
      ? ` · ${issue.statusLabel}`
      : isKo
        ? ' · 미확정'
        : ' · unconfirmed'
    return isKo ? `배정 미확정${detail}` : `Assignment not confirmed${detail}`
  }
  const detail = issue.statusLabel
    ? ` · ${issue.statusLabel}`
    : isKo
      ? ' · 미확정'
      : ' · unconfirmed'
  return isKo ? `상태 미확정${detail}` : `Status not confirmed${detail}`
}

export function scheduleAssignedTourPulseAriaLabel(
  issues: ScheduleAssignedTourPulseIssue[],
  uiLocale: string,
): string {
  return issues.map((issue) => scheduleAssignedTourPulseAlertLine(issue, uiLocale)).join(', ')
}
