'use client'

import { useMemo, useState } from 'react'
import ReactCountryFlag from 'react-country-flag'
import { ArrowLeftRight, Bus, Hotel, User, Users, X } from 'lucide-react'
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

export type ScheduleGuideTourInfoSummary = {
  productName: string
  tourDate: string
  assignedPeople: number
  capacityDenom: number
  totalPeopleAll: number
  assignedKo: number
  assignedEn: number
  assignedJa: number
  /** 배정 예약의 픽업 호텔 메인 그룹(group_number 정수부) 고유 개수 */
  pickupHotelGroupCount: number
  /** 배정 예약 픽업 호텔 내부용 이름 (당일 다른 투어와 공유 시 sharedSameDay) */
  pickupHotelItems: Array<{
    hotelId: string
    label: string
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

type EditTarget = 'guide' | 'assistant' | 'vehicle' | 'tourStatus' | 'assignmentStatus' | null

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
  onSelectGuide: (email: string | null) => void
  onSelectAssistant: (email: string | null) => void
  onSwapGuideAssistant: () => void
  onSelectVehicle: (id: string | null) => void
  onSelectTourStatus: (status: string) => void
  onSelectAssignmentStatus: (status: GuideAssignmentStatusValue) => void
}

function badgeClass(active?: boolean) {
  return [
    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors',
    active
      ? 'border-border bg-white text-gray-800 hover:bg-gray-50 cursor-pointer'
      : 'border-transparent bg-gray-100 text-gray-700',
  ].join(' ')
}

/** 예약 카드뷰와 동일한 앤텔롭 캐년 초이스 뱃지 색 */
function canyonChoiceBadgeClass(key: 'X' | 'L' | 'U') {
  if (key === 'L') return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  if (key === 'X') return 'bg-violet-100 text-violet-800 border-violet-300'
  return 'bg-amber-100 text-amber-800 border-amber-200'
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
  onSelectGuide,
  onSelectAssistant,
  onSwapGuideAssistant,
  onSelectVehicle,
  onSelectTourStatus,
  onSelectAssignmentStatus,
}: ScheduleGuideTourInfoCardProps) {
  const [editTarget, setEditTarget] = useState<EditTarget>(null)

  const assignmentLabel = getAssignmentStatusLabel(summary.assignmentStatus, locale)
  const assignmentBadgeColor = getAssignmentStatusBadgeColor(summary.assignmentStatus)

  const choiceBadges = useMemo(() => {
    const order: Array<'X' | 'L' | 'U'> = ['X', 'L', 'U']
    return order
      .filter((k) => (summary.choiceCounts[k] || 0) > 0)
      .map((k) => ({ key: k, count: summary.choiceCounts[k] || 0 }))
  }, [summary.choiceCounts])

  const ticketBadges = useMemo(() => {
    const order: Array<'X' | 'L' | 'U'> = ['L', 'X', 'U']
    return order.map((k) => ({
      key: k,
      count: summary.ticketCountsByCanyon[k] || 0,
    }))
  }, [summary.ticketCountsByCanyon])

  const canSwap =
    isStaff &&
    summary.requiresAssistant &&
    Boolean((guideEmail && guideEmail.trim()) || (assistantEmail && assistantEmail.trim()))

  const openEdit = (target: EditTarget) => {
    if (!isStaff || !target) return
    setEditTarget(target)
  }

  const closeEdit = () => setEditTarget(null)

  const editTitle =
    editTarget === 'guide'
      ? locale === 'ko'
        ? '가이드 변경'
        : 'Change guide'
      : editTarget === 'assistant'
        ? locale === 'ko'
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
        {/* 헤더: 날짜 · 상품 · 뱃지 */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
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
          <button
            type="button"
            disabled={!isStaff || updatingAssignmentStatus}
            onClick={(e) => {
              e.stopPropagation()
              openEdit('assignmentStatus')
            }}
            className={`${badgeClass(isStaff)} ${assignmentBadgeColor}`}
            title={locale === 'ko' ? '배정 상태 변경' : 'Change assignment status'}
          >
            {assignmentLabel}
          </button>
          <button
            type="button"
            disabled={!isStaff}
            onClick={(e) => {
              e.stopPropagation()
              openEdit('vehicle')
            }}
            className={`${badgeClass(isStaff)} ${
              summary.vehicleAssigned
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
            title={locale === 'ko' ? '차량(배차) 변경' : 'Change vehicle'}
          >
            {summary.vehicleAssigned
              ? locale === 'ko'
                ? '배차 완료'
                : 'Dispatched'
              : locale === 'ko'
                ? '미배차'
                : 'No vehicle'}
          </button>
          <button
            type="button"
            disabled={!isStaff || updatingTourStatus}
            onClick={(e) => {
              e.stopPropagation()
              openEdit('tourStatus')
            }}
            className={`${badgeClass(isStaff)} ${summary.tourStatusColorClass}`}
            title={locale === 'ko' ? '투어 상태 변경' : 'Change tour status'}
          >
            {summary.tourStatusLabel}
          </button>
        </div>

        {/* 스태프 · 차량 */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <button
            type="button"
            disabled={!isStaff}
            onClick={(e) => {
              e.stopPropagation()
              openEdit('guide')
            }}
            className={staffButtonClass(summary.guideAssigned)}
          >
            <User className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            <span className="truncate max-w-[8rem]">
              {summary.guideAssigned ? summary.guideName : locale === 'ko' ? '가이드 미배정' : 'No guide'}
            </span>
          </button>

          {summary.requiresAssistant ? (
            <>
              <button
                type="button"
                disabled={!canSwap}
                onClick={(e) => {
                  e.stopPropagation()
                  onSwapGuideAssistant()
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  locale === 'ko'
                    ? '가이드 ↔ 어시스턴트 교체'
                    : 'Swap guide ↔ assistant'
                }
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!isStaff}
                onClick={(e) => {
                  e.stopPropagation()
                  openEdit('assistant')
                }}
                className={staffButtonClass(summary.assistantAssigned)}
              >
                <Users className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate max-w-[8rem]">
                  {summary.assistantAssigned
                    ? summary.assistantName
                    : locale === 'ko'
                      ? '어시 미배정'
                      : 'No assistant'}
                </span>
              </button>
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
            title={locale === 'ko' ? '픽업 호텔 그룹 수' : 'Pickup hotel groups'}
          >
            <Hotel className="h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            {summary.pickupHotelGroupCount}
            {(summary.pickupHotelItems || []).length > 0 ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-normal text-gray-600">
                (
                {(summary.pickupHotelItems || []).map((item, idx) => (
                  <span key={item.hotelId} className="inline-flex items-center gap-1">
                    {idx > 0 ? <span className="text-gray-400">,</span> : null}
                    <span
                      className={
                        item.sharedSameDay
                          ? 'rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-300'
                          : 'text-[11px] text-gray-600'
                      }
                      title={
                        item.sharedSameDay
                          ? locale === 'ko'
                            ? '같은 날 다른 투어에도 있는 픽업 호텔'
                            : 'Also on another tour this day'
                          : item.label
                      }
                    >
                      {item.label}
                    </span>
                  </span>
                ))}
                )
              </span>
            ) : null}
          </span>
        </div>

        {/* 티켓 EA */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ticketBadges.map((b) => (
            <span
              key={b.key}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${canyonChoiceBadgeClass(b.key)}`}
            >
              🏜️🎫 {b.key} : {b.count}
            </span>
          ))}
          <span className="text-[10px] text-gray-400 tabular-nums ml-0.5">
            Confirm EA {summary.confirmedEa}
          </span>
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
          </div>
        </div>
      ) : null}
    </div>
  )
}
