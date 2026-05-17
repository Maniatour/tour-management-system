'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  getTicketBookingTimeSelectOptions,
  getTicketBookingTimeSlotColors,
  normalizeDbTimeToTicketSelectSlot,
} from '@/lib/ticketBookingTimeSelect'
import { buildTicketBookingChangeRequestEmail } from '@/lib/ticketBookingVendorEmail'
import { useTeamMemberDisplayName } from '@/lib/useTeamMemberDisplayName'
import TicketBookingVendorEmailCopyBlock from '@/components/booking/TicketBookingVendorEmailCopyBlock'

function formatMoneyUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 명시 단가 우선, 없으면 기존 총액÷수량 */
function deriveUnitPriceUsd(
  initialEa: number,
  initialExpense: number,
  unitPrice?: number | null
): number {
  const up =
    unitPrice != null && Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null
  if (up != null) return up
  if (initialEa > 0 && initialExpense > 0) return initialExpense / initialEa
  return 0
}

function displayTimeLabel(raw: string): string {
  const s = normalizeDbTimeToTicketSelectSlot(raw)
  return s || '—'
}

export type TicketBookingQtyTimeChangeModalProps = {
  open: boolean
  title: string
  initialEa: number
  /** 원본 `ticket_bookings.time` (HH:MM 또는 HH:MM:SS) — 모달에서 슬롯으로 정규화 */
  initialTime: string
  /** 기존 행 비용(총액) — 수량 비례 예상금액 계산용 */
  initialExpense?: number
  /** 있으면 단가로 우선 사용 */
  initialUnitPrice?: number | null
  company?: string
  checkInDate?: string
  category?: string
  rnNumber?: string | null
  note?: string | null
  submittedBy?: string | null
  onClose: () => void
  onSubmit: (pendingEa: number, pendingTime: string) => void | Promise<void>
  saving?: boolean
}

export default function TicketBookingQtyTimeChangeModal({
  open,
  title,
  initialEa,
  initialTime,
  initialExpense = 0,
  initialUnitPrice,
  company = '',
  checkInDate = '',
  category,
  rnNumber,
  note,
  submittedBy,
  onClose,
  onSubmit,
  saving,
}: TicketBookingQtyTimeChangeModalProps) {
  const t = useTranslations('booking.ticketBooking')
  const locale = useLocale()
  const submitterDisplayName = useTeamMemberDisplayName(submittedBy)
  const slotOptions = useMemo(() => getTicketBookingTimeSelectOptions(), [])
  const slotValues = useMemo(() => new Set(slotOptions.map((o) => o.value)), [slotOptions])

  const [ea, setEa] = useState(String(initialEa))
  const [time, setTime] = useState('')

  useEffect(() => {
    if (open) {
      setEa(String(initialEa))
      setTime(normalizeDbTimeToTicketSelectSlot(initialTime))
    }
  }, [open, initialEa, initialTime])

  const normalizedInitial = useMemo(
    () => normalizeDbTimeToTicketSelectSlot(initialTime),
    [initialTime]
  )
  const showExtraSlot = Boolean(normalizedInitial && !slotValues.has(normalizedInitial))
  const extraHour = showExtraSlot
    ? parseInt(normalizedInitial.split(':')[0] || '6', 10)
    : 6
  const extraColors = showExtraSlot ? getTicketBookingTimeSlotColors(extraHour) : null

  const unitUsd = deriveUnitPriceUsd(initialEa, initialExpense, initialUnitPrice)
  const parsedEa = parseInt(ea, 10)
  const projectedExpense =
    Number.isFinite(parsedEa) && parsedEa >= 0 && unitUsd > 0
      ? Math.round(unitUsd * parsedEa * 100) / 100
      : null

  const vendorEmailDraft = useMemo(() => {
    const reqEa = Number.isFinite(parsedEa) && parsedEa >= 0 ? parsedEa : initialEa
    const reqTime = time.trim() || normalizedInitial
    return buildTicketBookingChangeRequestEmail({
      company,
      checkInDate,
      category,
      rnNumber,
      note,
      submitterDisplayName,
      currentQuantity: initialEa,
      currentTime: initialTime,
      requestedQuantity: reqEa,
      requestedTime: reqTime,
    })
  }, [
    company,
    checkInDate,
    category,
    rnNumber,
    note,
    submitterDisplayName,
    initialEa,
    initialTime,
    parsedEa,
    time,
    normalizedInitial,
  ])

  if (!open) return null

  const submitChangeRequest = async () => {
    const n = parseInt(ea, 10)
    if (Number.isNaN(n) || n < 0) return
    if (!time.trim()) return
    await onSubmit(n, time.trim())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitChangeRequest()
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={() => !saving && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">
          수량·시간 변경 요청 후 예약은 「변경 요청」, 벤더는 「응답 대기」로 바뀝니다.
        </p>

        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
          <div className="mb-2 font-medium text-gray-800">기존 예약</div>
          <dl className="space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">수량</dt>
              <dd className="font-medium tabular-nums text-gray-900">{initialEa}개</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">시간</dt>
              <dd className="font-medium text-gray-900">{displayTimeLabel(initialTime)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">금액(비용)</dt>
              <dd className="font-semibold tabular-nums text-gray-900">
                ${formatMoneyUsd(Number.isFinite(initialExpense) ? initialExpense : 0)}
              </dd>
            </div>
          </dl>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="text-[11px] font-medium text-gray-700">변경 요청 값</div>
          <div>
            <label className="block text-xs font-medium text-gray-600">
              {t('quantity')} <span className="font-normal text-gray-400">(요청)</span>
            </label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={ea}
              onChange={(e) => setEa(e.target.value)}
              disabled={!!saving}
            />
            {unitUsd > 0 ? (
              <p className="mt-1 text-[10px] text-gray-500">
                단가 약 <span className="tabular-nums">${formatMoneyUsd(unitUsd)}</span> / 1개
              </p>
            ) : initialExpense > 0 ? (
              <p className="mt-1 text-[10px] text-amber-700">
                기존 수량·금액으로 단가를 계산할 수 없어 예상 금액을 표시하지 않습니다.
              </p>
            ) : null}
            {projectedExpense != null ? (
              <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-950">
                <span className="text-blue-800">변경 수량 기준 예상 금액</span>{' '}
                <span className="font-semibold tabular-nums">${formatMoneyUsd(projectedExpense)}</span>
              </div>
            ) : null}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">
              {t('time')} <span className="font-normal text-gray-400">(요청)</span> *
            </label>
            <select
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={!!saving}
              required
            >
              <option value="">{t('selectTime')}</option>
              {showExtraSlot && extraColors ?
                <option
                  value={normalizedInitial}
                  style={{
                    backgroundColor: extraColors.bg,
                    color: extraColors.text,
                  }}
                >
                  {normalizedInitial}
                </option>
              : null}
              {slotOptions.map(({ value, bg, text }) => (
                <option key={value} value={value} style={{ backgroundColor: bg, color: text }}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <TicketBookingVendorEmailCopyBlock
            subject={vendorEmailDraft.subject}
            bodyPlain={vendorEmailDraft.bodyPlain}
            bodyHtml={vendorEmailDraft.bodyHtml}
            bodyTextHtml={vendorEmailDraft.bodyTextHtml}
            company={company}
            sendAndSaveEnabled
            saving={!!saving}
            onSendAndSave={submitChangeRequest}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              disabled={!!saving}
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={!!saving}
            >
              {saving ? '저장 중…' : '변경 요청 보내기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
