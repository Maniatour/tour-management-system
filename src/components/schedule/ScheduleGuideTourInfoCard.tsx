'use client'

import { useMemo, useState, type ReactNode } from 'react'
import ReactCountryFlag from 'react-country-flag'
import {
  ArrowLeftRight,
  Bus,
  Calendar,
  Car,
  DollarSign,
  FileText,
  History,
  Hotel,
  Pin,
  Mail,
  Printer,
  Smartphone,
  User,
  UserCheck,
  Users,
  X,
  Copy,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAssignmentStatusBadgeColor,
  getAssignmentStatusLabel,
  type GuideAssignmentStatusValue,
} from '@/lib/guideAssignmentStatus'

function pickupStopNumberEmoji(groupNumber: number): string {
  const n = Math.floor(Number(groupNumber))
  if (!Number.isFinite(n) || n < 1) return '#️⃣'
  const keycaps = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']
  if (n >= 1 && n <= keycaps.length) {
    return keycaps[n - 1]!
  }
  return `${n}.`
}

export type ScheduleGuideTourInfoSummary = {
  productName: string
  tourDate: string
  assignedPeople: number
  capacityDenom: number
  totalPeopleAll: number
  assignedKo: number
  assignedEn: number
  assignedJa: number
  /** 배정 예약의 픽업 호텔 수 (픽업 스케줄: 호텔 ID별 픽업 수) */
  pickupHotelGroupCount: number
  /** 배정 예약 픽업 호텔 내부용 이름 (같은 날·같은 상품의 다른 투어와 공유 시 sharedSameDay) */
  pickupHotelItems: Array<{
    hotelId: string
    label: string
    /** pickup_hotels.group_number (내림 정수), 없으면 null */
    groupNumber: number | null
    sharedSameDay?: boolean
  }>
  guideName: string
  assistantName: string
  vehicleNumber: string
  vehicleAssigned: boolean
  guideAssigned: boolean
  assistantAssigned: boolean
  requiresAssistant: boolean
  isPrivateTour: boolean
  choiceCounts: Record<string, number>
  ticketCountsByCanyon: Record<string, number>
  confirmedEa: number
  assignmentStatus: string
  tourStatus: string | null
  tourStatusLabel: string
  tourStatusColorClass: string
}

type TeamMemberOption = {
  email: string
  nick_name?: string | null
  name_ko?: string | null
}

type VehicleOption = { id: string; label: string }

type StatusOption = { value: string; label: string }

type TourTeamType = '1guide' | '2guide' | 'guide+driver'

type EditTarget = 'guide' | 'assistant' | 'vehicle' | 'tourStatus' | 'assignmentStatus' | 'teamType' | null

const TEAM_TYPE_OPTIONS: Array<{
  value: TourTeamType
  ko: string
  en: string
  Icon: typeof User
}> = [
  { value: '1guide', ko: '1가이드', en: '1 Guide', Icon: User },
  { value: '2guide', ko: '2가이드', en: '2 Guides', Icon: Users },
  { value: 'guide+driver', ko: '가이드 & 드라이버', en: 'Guide & Driver', Icon: Car },
]

const NO_GUIDE = '__no_guide__'
const NO_ASSISTANT = '__no_assistant__'
const NO_VEHICLE = '__no_vehicle__'

const ASSIGNMENT_STATUS_OPTIONS: GuideAssignmentStatusValue[] = [
  'pending',
  'assigned',
  'confirmed',
  'rejected',
]

type ScheduleGuideTourInfoCardProps = {
  summary: ScheduleGuideTourInfoSummary
  locale: string
  isStaff: boolean
  /** 현재 모달에서 선택된(포커스) 투어 카드 */
  selected?: boolean
  onSelectCard?: () => void
  guideEmail: string | null
  assistantEmail: string | null
  vehicleId: string | null
  teamMembers: TeamMemberOption[]
  vehicles: VehicleOption[]
  tourStatusOptions: StatusOption[]
  tourStatusValue: string
  updatingTourStatus?: boolean
  updatingAssignmentStatus?: boolean
  teamType: TourTeamType
  updatingTeamType?: boolean
  onSelectTeamType: (type: TourTeamType) => void
  onSelectGuide: (email: string | null) => void
  onSelectAssistant: (email: string | null) => void
  onSwapGuideAssistant: () => void
  guideAssignmentLocked?: boolean
  assistantAssignmentLocked?: boolean
  onLockedAssignmentAttempt?: (role: 'guide' | 'assistant' | 'both') => void
  onToggleGuideAssignmentLock?: () => void
  onToggleAssistantAssignmentLock?: () => void
  onSelectVehicle: (id: string | null) => void
  onSelectTourStatus: (status: string) => void
  onSelectAssignmentStatus: (status: GuideAssignmentStatusValue) => void
  /** 선택된 카드일 때 티켓 EA 행 오른쪽에 표시할 빠른 액션 */
  showQuickActions?: boolean
  canSendGuideSchedule?: boolean
  onPrintTourInfo?: () => void
  onSendScheduleAssignment?: () => void
  onSendScheduleConfirm?: () => void
  onViewAssignmentHistory?: () => void
  onPrintReceipts?: () => void
  onPrintTipEnvelopes?: () => void
  onPrintBalanceEnvelopes?: () => void
  /** 같은 상품/날짜로 투어 복사 */
  onCopyTour?: () => void
  copyingTour?: boolean
}

/** 아이콘 전용 상태 뱃지: 배경·테두리로 상태 구분 */
function statusIconBadgeClass(active?: boolean) {
  return [
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 shadow-sm transition-colors',
    active ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
  ].join(' ')
}

function assignmentStatusIconColor(status: string | null | undefined) {
  const n = (status || '').toLowerCase().trim()
  if (n === 'confirm' || n === 'confirmed') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-500'
  }
  if (n === 'assigned') {
    return 'bg-violet-100 text-violet-700 border-violet-500'
  }
  if (n === 'rejected') {
    return 'bg-red-100 text-red-700 border-red-500'
  }
  if (n === 'pending') {
    return 'bg-amber-100 text-amber-800 border-amber-500'
  }
  return 'bg-gray-100 text-gray-600 border-gray-400'
}

function vehicleDispatchIconColor(assigned: boolean) {
  return assigned
    ? 'bg-emerald-100 text-emerald-700 border-emerald-500'
    : 'bg-amber-50 text-amber-800 border-amber-500 border-dashed'
}

function tourStatusIconColor(status: string | null | undefined) {
  const n = (status || '').toLowerCase().trim()
  if (n === 'confirm' || n === 'confirmed') {
    return 'bg-green-100 text-green-700 border-green-500'
  }
  if (n === 'recruiting') {
    return 'bg-sky-100 text-sky-700 border-sky-500'
  }
  if (n.includes('cancel') || n === 'deleted') {
    return 'bg-red-100 text-red-700 border-red-500'
  }
  if (n === 'complete' || n === 'completed') {
    return 'bg-slate-100 text-slate-600 border-slate-400'
  }
  return 'bg-gray-100 text-gray-600 border-gray-400'
}

/** 예약 카드뷰와 동일한 앤텔롭 캐년 초이스 뱃지 색 */
function canyonChoiceBadgeClass(key: 'X' | 'L' | 'U') {
  if (key === 'L') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (key === 'X') return 'bg-violet-100 text-violet-800 border-violet-300'
  return 'bg-amber-100 text-amber-800 border-amber-200'
}

function staffBadgeClass(assigned: boolean) {
  return [
    'inline-flex items-center gap-0.5 rounded-lg border py-0.5 pl-0.5 pr-2 text-xs font-medium',
    assigned
      ? 'border-border bg-white text-gray-900'
      : 'border-dashed border-amber-300 bg-amber-50 text-amber-950',
  ].join(' ')
}

function staffButtonClass(assigned: boolean) {
  return [
    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
    assigned
      ? 'border-border bg-white text-gray-900 hover:bg-gray-50'
      : 'border-dashed border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100',
  ].join(' ')
}

export default function ScheduleGuideTourInfoCard({
  summary,
  locale,
  isStaff,
  selected = false,
  onSelectCard,
  guideEmail,
  assistantEmail,
  vehicleId,
  teamMembers,
  vehicles,
  tourStatusOptions,
  tourStatusValue,
  updatingTourStatus = false,
  updatingAssignmentStatus = false,
  teamType,
  updatingTeamType = false,
  onSelectTeamType,
  onSelectGuide,
  onSelectAssistant,
  onSwapGuideAssistant,
  guideAssignmentLocked = false,
  assistantAssignmentLocked = false,
  onLockedAssignmentAttempt,
  onToggleGuideAssignmentLock,
  onToggleAssistantAssignmentLock,
  onSelectVehicle,
  onSelectTourStatus,
  onSelectAssignmentStatus,
  showQuickActions = false,
  canSendGuideSchedule = false,
  onPrintTourInfo,
  onSendScheduleAssignment,
  onSendScheduleConfirm,
  onViewAssignmentHistory,
  onPrintReceipts,
  onPrintTipEnvelopes,
  onPrintBalanceEnvelopes,
  onCopyTour,
  copyingTour = false,
}: ScheduleGuideTourInfoCardProps) {
  const [editTarget, setEditTarget] = useState<EditTarget>(null)

  const assignmentLabel = getAssignmentStatusLabel(summary.assignmentStatus, locale)

  const choiceBadges = useMemo(() => {
    const order: Array<'X' | 'L' | 'U'> = ['X', 'L', 'U']
    return order
      .filter((k) => (summary.choiceCounts[k] || 0) > 0)
      .map((k) => ({ key: k, count: summary.choiceCounts[k] || 0 }))
  }, [summary.choiceCounts])

  const ticketBadges = useMemo(() => {
    const order: Array<'X' | 'L' | 'U'> = ['L', 'X', 'U']
    return order
      .filter((k) => (summary.ticketCountsByCanyon[k] || 0) > 0)
      .map((k) => ({
        key: k,
        count: summary.ticketCountsByCanyon[k] || 0,
      }))
  }, [summary.ticketCountsByCanyon])

  const quickActionButtons: ReactNode =
    showQuickActions ? (
      <div
        className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {onPrintTourInfo ? (
          <button
            type="button"
            onClick={onPrintTourInfo}
            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
            title={locale === 'ko' ? '투어 정보 인쇄' : 'Print tour info'}
          >
            <FileText className="h-4 w-4" />
          </button>
        ) : null}
        {canSendGuideSchedule && onSendScheduleAssignment ? (
          <button
            type="button"
            onClick={onSendScheduleAssignment}
            className="rounded-md border border-violet-200 bg-violet-50 p-1.5 text-violet-700 hover:bg-violet-100"
            title={locale === 'ko' ? '가이드·어시 스케줄 부여 SMS' : 'Send schedule assignment SMS'}
          >
            <UserCheck className="h-4 w-4" />
          </button>
        ) : null}
        {canSendGuideSchedule && onSendScheduleConfirm ? (
          <button
            type="button"
            onClick={onSendScheduleConfirm}
            className="rounded-md border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-700 hover:bg-indigo-100"
            title={locale === 'ko' ? '가이드·어시 스케줄 컨펌 발송' : 'Send schedule confirm'}
          >
            <Smartphone className="h-4 w-4" />
          </button>
        ) : null}
        {isStaff && onViewAssignmentHistory ? (
          <button
            type="button"
            onClick={onViewAssignmentHistory}
            className="rounded-md border border-slate-200 bg-slate-50 p-1.5 text-slate-700 hover:bg-slate-100"
            title={locale === 'ko' ? '배정·컨펌 기록' : 'Assignment history'}
          >
            <History className="h-4 w-4" />
          </button>
        ) : null}
        {onPrintReceipts ? (
          <button
            type="button"
            onClick={onPrintReceipts}
            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
            title={locale === 'ko' ? '영수증 일괄 인쇄' : 'Print receipts'}
          >
            <Printer className="h-4 w-4" />
          </button>
        ) : null}
        {onPrintTipEnvelopes ? (
          <button
            type="button"
            onClick={onPrintTipEnvelopes}
            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
            title={locale === 'ko' ? '팁 봉투 인쇄' : 'Print tip envelopes'}
          >
            <Mail className="h-4 w-4" />
          </button>
        ) : null}
        {onPrintBalanceEnvelopes ? (
          <button
            type="button"
            onClick={onPrintBalanceEnvelopes}
            className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50"
            title={locale === 'ko' ? 'Balance 봉투 인쇄' : 'Print balance envelopes'}
          >
            <DollarSign className="h-4 w-4" />
          </button>
        ) : null}
        {isStaff && onCopyTour ? (
          <button
            type="button"
            onClick={onCopyTour}
            disabled={copyingTour}
            className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            title={locale === 'ko' ? '투어 복사 (같은 상품·날짜)' : 'Copy tour (same product & date)'}
          >
            <Copy className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    ) : null

  const canSwap =
    isStaff &&
    summary.requiresAssistant &&
    Boolean((guideEmail && guideEmail.trim()) || (assistantEmail && assistantEmail.trim()))

  const openEdit = (target: EditTarget) => {
    if (!isStaff || !target) return
    if (target === 'guide' && guideAssignmentLocked) {
      onLockedAssignmentAttempt?.('guide')
      return
    }
    if (target === 'assistant' && assistantAssignmentLocked) {
      onLockedAssignmentAttempt?.('assistant')
      return
    }
    if (target === 'teamType' && assistantAssignmentLocked) {
      // 1가이드로 바꾸면 어시가 해제되므로, 편집은 열되 실제 변경은 apply 쪽에서 막음
    }
    setEditTarget(target)
  }

  const closeEdit = () => setEditTarget(null)

  const currentTeamTypeOption =
    TEAM_TYPE_OPTIONS.find((option) => option.value === teamType) || TEAM_TYPE_OPTIONS[0]
  const currentTeamTypeLabel =
    locale === 'ko' ? currentTeamTypeOption.ko : currentTeamTypeOption.en
  const CurrentTeamTypeIcon = currentTeamTypeOption.Icon

  const editTitle =
    editTarget === 'guide'
      ? locale === 'ko'
        ? '가이드 변경'
        : 'Change guide'
      : editTarget === 'assistant'
        ? teamType === 'guide+driver'
          ? locale === 'ko'
            ? '드라이버 변경'
            : 'Change driver'
          : locale === 'ko'
            ? '어시스턴트 변경'
            : 'Change assistant'
        : editTarget === 'vehicle'
          ? locale === 'ko'
            ? '차량 변경'
            : 'Change vehicle'
          : editTarget === 'tourStatus'
            ? locale === 'ko'
              ? '투어 상태 변경'
              : 'Change tour status'
            : editTarget === 'assignmentStatus'
              ? locale === 'ko'
                ? '배정 상태 변경'
                : 'Change assignment status'
              : editTarget === 'teamType'
                ? locale === 'ko'
                  ? '팀 구성 변경'
                  : 'Change team type'
                : ''

  return (
    <div className="space-y-3">
      <div
        role={onSelectCard ? 'button' : undefined}
        tabIndex={onSelectCard ? 0 : undefined}
        onClick={onSelectCard}
        onKeyDown={
          onSelectCard
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectCard()
                }
              }
            : undefined
        }
        className={`rounded-xl border bg-gradient-to-b from-white to-gray-50/80 p-3 shadow-sm transition-shadow ${
          selected
            ? 'border-primary ring-2 ring-primary/30 shadow-md'
            : 'border-border/70 hover:border-border'
        } ${onSelectCard && !selected ? 'cursor-pointer' : ''}`}
      >
        {/* 헤더: 날짜 · 상품 · 인원/초이스 | 상태 뱃지(우측) */}
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900">
              {summary.tourDate}{' '}
              {summary.isPrivateTour ? '🔒 ' : ''}
              {summary.productName}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-primary"
              title={locale === 'ko' ? '배정 인원 / 정원' : 'Assigned / capacity'}
            >
              <Users size={12} aria-hidden />
              <span>
                {summary.assignedPeople}/{summary.capacityDenom}
              </span>
            </span>
            {choiceBadges.map((b) => (
              <span
                key={b.key}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${canyonChoiceBadgeClass(b.key)}`}
              >
                🏜️ {b.key} {b.count}
              </span>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              disabled={!isStaff || updatingAssignmentStatus}
              onClick={(e) => {
                e.stopPropagation()
                openEdit('assignmentStatus')
              }}
              className={`${statusIconBadgeClass(isStaff)} ${assignmentStatusIconColor(summary.assignmentStatus)}`}
              title={
                locale === 'ko'
                  ? `배정 상태: ${assignmentLabel}`
                  : `Assignment: ${assignmentLabel}`
              }
              aria-label={
                locale === 'ko'
                  ? `배정 상태: ${assignmentLabel}`
                  : `Assignment: ${assignmentLabel}`
              }
            >
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!isStaff}
              onClick={(e) => {
                e.stopPropagation()
                openEdit('vehicle')
              }}
              className={`${statusIconBadgeClass(isStaff)} ${vehicleDispatchIconColor(summary.vehicleAssigned)}`}
              title={
                summary.vehicleAssigned
                  ? locale === 'ko'
                    ? '배차 완료'
                    : 'Dispatched'
                  : locale === 'ko'
                    ? '미배차'
                    : 'No vehicle'
              }
              aria-label={
                summary.vehicleAssigned
                  ? locale === 'ko'
                    ? '배차 완료'
                    : 'Dispatched'
                  : locale === 'ko'
                    ? '미배차'
                    : 'No vehicle'
              }
            >
              <Bus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!isStaff || updatingTourStatus}
              onClick={(e) => {
                e.stopPropagation()
                openEdit('tourStatus')
              }}
              className={`${statusIconBadgeClass(isStaff)} ${tourStatusIconColor(summary.tourStatus)}`}
              title={
                locale === 'ko'
                  ? `투어 상태: ${summary.tourStatusLabel}`
                  : `Tour status: ${summary.tourStatusLabel}`
              }
              aria-label={
                locale === 'ko'
                  ? `투어 상태: ${summary.tourStatusLabel}`
                  : `Tour status: ${summary.tourStatusLabel}`
              }
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          </div>
        </div>

        {/* 스태프 · 차량 · 팀 구성 */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <div className={staffBadgeClass(summary.guideAssigned)}>
            <button
              type="button"
              disabled={!isStaff || (!guideAssignmentLocked && !summary.guideAssigned)}
              onClick={(e) => {
                e.stopPropagation()
                onToggleGuideAssignmentLock?.()
              }}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                guideAssignmentLocked
                  ? 'text-amber-800'
                  : 'text-gray-400 hover:text-gray-700'
              } disabled:cursor-not-allowed disabled:opacity-40`}
              title={
                locale === 'ko'
                  ? guideAssignmentLocked
                    ? '배정 고정 해제'
                    : '배정 고정'
                  : guideAssignmentLocked
                    ? 'Unlock assignment'
                    : 'Lock assignment'
              }
              aria-label={
                locale === 'ko'
                  ? guideAssignmentLocked
                    ? '배정 고정 해제'
                    : '배정 고정'
                  : guideAssignmentLocked
                    ? 'Unlock assignment'
                    : 'Lock assignment'
              }
              aria-pressed={guideAssignmentLocked}
            >
              <Pin className={`h-3.5 w-3.5 ${guideAssignmentLocked ? 'fill-current' : ''}`} />
            </button>
            <button
              type="button"
              disabled={!isStaff}
              onClick={(e) => {
                e.stopPropagation()
                openEdit('guide')
              }}
              className="truncate max-w-[8rem] py-1 text-left hover:underline disabled:cursor-not-allowed"
            >
              {summary.guideAssigned ? summary.guideName : locale === 'ko' ? '가이드 미배정' : 'No guide'}
            </button>
          </div>

          {summary.requiresAssistant ? (
            <>
              <button
                type="button"
                disabled={!canSwap}
                onClick={(e) => {
                  e.stopPropagation()
                  if (guideAssignmentLocked || assistantAssignmentLocked) {
                    onLockedAssignmentAttempt?.(
                      guideAssignmentLocked && assistantAssignmentLocked
                        ? 'both'
                        : guideAssignmentLocked
                          ? 'guide'
                          : 'assistant',
                    )
                    return
                  }
                  onSwapGuideAssistant()
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  teamType === 'guide+driver'
                    ? locale === 'ko'
                      ? '가이드 ↔ 드라이버 교체'
                      : 'Swap guide ↔ driver'
                    : locale === 'ko'
                      ? '가이드 ↔ 어시스턴트 교체'
                      : 'Swap guide ↔ assistant'
                }
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
              <div className={staffBadgeClass(summary.assistantAssigned)}>
                <button
                  type="button"
                  disabled={!isStaff || (!assistantAssignmentLocked && !summary.assistantAssigned)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleAssistantAssignmentLock?.()
                  }}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    assistantAssignmentLocked
                      ? 'text-amber-800'
                      : 'text-gray-400 hover:text-gray-700'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                  title={
                    locale === 'ko'
                      ? assistantAssignmentLocked
                        ? '배정 고정 해제'
                        : '배정 고정'
                      : assistantAssignmentLocked
                        ? 'Unlock assignment'
                        : 'Lock assignment'
                  }
                  aria-label={
                    locale === 'ko'
                      ? assistantAssignmentLocked
                        ? '배정 고정 해제'
                        : '배정 고정'
                      : assistantAssignmentLocked
                        ? 'Unlock assignment'
                        : 'Lock assignment'
                  }
                  aria-pressed={assistantAssignmentLocked}
                >
                  <Pin className={`h-3.5 w-3.5 ${assistantAssignmentLocked ? 'fill-current' : ''}`} />
                </button>
                <button
                  type="button"
                  disabled={!isStaff}
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit('assistant')
                  }}
                  className="truncate max-w-[8rem] py-1 text-left hover:underline disabled:cursor-not-allowed"
                >
                  {summary.assistantAssigned
                    ? summary.assistantName
                    : teamType === 'guide+driver'
                      ? locale === 'ko'
                        ? '드라이버 미배정'
                        : 'No driver'
                      : locale === 'ko'
                        ? '어시 미배정'
                        : 'No assistant'}
                </button>
              </div>
            </>
          ) : null}

          <button
            type="button"
            disabled={!isStaff}
            onClick={(e) => {
              e.stopPropagation()
              openEdit('vehicle')
            }}
            className={staffButtonClass(summary.vehicleAssigned)}
          >
            <Bus className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate max-w-[10rem]">
              {summary.vehicleAssigned
                ? summary.vehicleNumber
                : locale === 'ko'
                  ? '차량 미배정'
                  : 'No vehicle'}
            </span>
          </button>

          <button
            type="button"
            disabled={!isStaff || updatingTeamType}
            onClick={(e) => {
              e.stopPropagation()
              openEdit('teamType')
            }}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            title={locale === 'ko' ? '팀 구성 변경' : 'Change team type'}
            aria-label={
              locale === 'ko'
                ? `팀 구성: ${currentTeamTypeLabel}`
                : `Team type: ${currentTeamTypeLabel}`
            }
          >
            <CurrentTeamTypeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">{currentTeamTypeLabel}</span>
          </button>
        </div>

        {/* 언어 · 픽업 호텔 그룹 */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-700 mb-2">
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
            <ReactCountryFlag
              countryCode="KR"
              svg
              style={{ width: '20px', height: '15px', borderRadius: '2px' }}
              aria-hidden
            />
            {summary.assignedKo}
          </span>
          <span className="text-gray-300">/</span>
          <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
            <ReactCountryFlag
              countryCode="US"
              svg
              style={{ width: '20px', height: '15px', borderRadius: '2px' }}
              aria-hidden
            />
            {summary.assignedEn + summary.assignedJa}
            {summary.assignedJa > 0 ? (
              <span className="inline-flex items-center gap-1 text-gray-500">
                (
                <ReactCountryFlag
                  countryCode="JP"
                  svg
                  style={{ width: '20px', height: '15px', borderRadius: '2px' }}
                  aria-hidden
                />
                {summary.assignedJa})
              </span>
            ) : null}
          </span>
          <span
            className="inline-flex flex-wrap items-center gap-1 font-medium tabular-nums text-teal-800"
            title={locale === 'ko' ? '픽업 수 (픽업 스케줄 기준)' : 'Pickup stops (pickup schedule)'}
          >
            <Hotel className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            {summary.pickupHotelGroupCount}
            {(summary.pickupHotelItems || []).length > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-normal text-gray-600">
                (
                {(summary.pickupHotelItems || []).map((item, idx) => (
                  <span key={item.hotelId} className="inline-flex items-center gap-0.5">
                    {idx > 0 ? <span className="text-gray-400 mr-0.5">,</span> : null}
                    <span
                      className={
                        item.sharedSameDay
                          ? 'rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-300'
                          : 'text-[11px] text-gray-600'
                      }
                      title={
                        item.sharedSameDay
                          ? locale === 'ko'
                            ? '같은 날·같은 상품의 다른 투어에도 있는 픽업 호텔'
                            : 'Also on another same-product tour this day'
                          : item.groupNumber != null
                            ? `G${item.groupNumber} · ${item.label}`
                            : item.label
                      }
                    >
                      {item.groupNumber != null
                        ? pickupStopNumberEmoji(item.groupNumber)
                        : '#️⃣'}
                      {item.label}
                    </span>
                  </span>
                ))}
                )
              </span>
            ) : null}
          </span>
        </div>

        {/* 티켓 EA + (선택 시) 빠른 액션 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ticketBadges.map((b) => (
            <span
              key={b.key}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${canyonChoiceBadgeClass(b.key)}`}
            >
              🏜️🎫 {b.key} : {b.count}
            </span>
          ))}
          {quickActionButtons}
        </div>
      </div>

      {/* 편집 서브모달 */}
      {editTarget ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900">{editTitle}</h4>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editTarget === 'guide' ? (
              <Select
                value={guideEmail && guideEmail.trim() ? guideEmail : NO_GUIDE}
                onValueChange={(v) => {
                  onSelectGuide(v === NO_GUIDE ? null : v)
                  closeEdit()
                }}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[1300]">
                  <SelectItem value={NO_GUIDE}>
                    {locale === 'ko' ? '미배정' : 'Unassigned'}
                  </SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.email} value={m.email}>
                      {m.nick_name || m.name_ko || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {editTarget === 'assistant' ? (
              <Select
                value={assistantEmail && assistantEmail.trim() ? assistantEmail : NO_ASSISTANT}
                onValueChange={(v) => {
                  onSelectAssistant(v === NO_ASSISTANT ? null : v)
                  closeEdit()
                }}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[1300]">
                  <SelectItem value={NO_ASSISTANT}>
                    {locale === 'ko' ? '미배정' : 'Unassigned'}
                  </SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={`asst-${m.email}`} value={m.email}>
                      {m.nick_name || m.name_ko || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {editTarget === 'vehicle' ? (
              <Select
                value={vehicleId && vehicleId.trim() ? vehicleId : NO_VEHICLE}
                onValueChange={(v) => {
                  onSelectVehicle(v === NO_VEHICLE ? null : v)
                  closeEdit()
                }}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[1300]">
                  <SelectItem value={NO_VEHICLE}>
                    {locale === 'ko' ? '배정 안 함' : 'None'}
                  </SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {editTarget === 'tourStatus' ? (
              <Select
                value={tourStatusValue || ''}
                onValueChange={(v) => {
                  onSelectTourStatus(v)
                  closeEdit()
                }}
                disabled={updatingTourStatus}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue placeholder={locale === 'ko' ? '상태 선택' : 'Select status'} />
                </SelectTrigger>
                <SelectContent className="z-[1300]">
                  {tourStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {editTarget === 'assignmentStatus' ? (
              <div className="space-y-2">
                {ASSIGNMENT_STATUS_OPTIONS.map((status) => {
                  const selected =
                    (summary.assignmentStatus || 'pending').toLowerCase() === status
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={updatingAssignmentStatus}
                      onClick={() => {
                        onSelectAssignmentStatus(status)
                        closeEdit()
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                        selected
                          ? 'border-primary bg-primary/5 font-semibold text-primary'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      } ${getAssignmentStatusBadgeColor(status)}`}
                    >
                      {getAssignmentStatusLabel(status, locale)}
                    </button>
                  )
                })}
              </div>
            ) : null}

            {editTarget === 'teamType' ? (
              <div className="space-y-2">
                {TEAM_TYPE_OPTIONS.map((option) => {
                  const selected = teamType === option.value
                  const label = locale === 'ko' ? option.ko : option.en
                  const Icon = option.Icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={updatingTeamType}
                      onClick={() => {
                        onSelectTeamType(option.value)
                        closeEdit()
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        selected
                          ? 'border-primary bg-primary/5 font-semibold text-primary'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
