'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  getTicketBookingTimeSelectOptions,
  getTicketBookingTimeSlotColors,
  normalizeDbTimeToTicketSelectSlot,
} from '@/lib/ticketBookingTimeSelect'
import {
  buildTicketBookingChangeRequestEmail,
  type TicketBookingVendorEmailSameDayTicket,
} from '@/lib/ticketBookingVendorEmail'
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
  currentBookingId?: string
  /** 같은 체크인일·같은 업체 티켓 (현재 건 포함, 취소 행 제외) */
  sameDayTickets?: TicketBookingVendorEmailSameDayTicket[]
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
  currentBookingId,
  sameDayTickets = [],
  onClose,
  onSubmit,
  saving,
}: TicketBookingQtyTimeChangeModalProps) {
  const t = useTranslations('booking.ticketBooking')
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
  const qtyChanged = Number.isFinite(parsedEa) && parsedEa !== initialEa
  const timeChanged =
    Boolean(time.trim()) &&
    normalizeDbTimeToTicketSelectSlot(time) !== normalizedInitial
  const amountChanged =
    projectedExpense != null &&
    Math.abs(projectedExpense - (Number.isFinite(initialExpense) ? initialExpense : 0)) > 0.001

  const vendorEmailDraft = useMemo(() => {
    const reqEa = Number.isFinite(parsedEa) && parsedEa >= 0 ? parsedEa : initialEa
    const reqTime = time.trim() || normalizedInitial
    let foundCurrent = false
    const tickets: TicketBookingVendorEmailSameDayTicket[] = sameDayTickets.map((ticket) => {
      const isCurrent = Boolean(
        (currentBookingId && ticket.id === currentBookingId) || ticket.isCurrent
      )
      if (!isCurrent) return { ...ticket, isCurrent: false }
      foundCurrent = true
      return {
        ...ticket,
        rnNumber: rnNumber ?? ticket.rnNumber ?? null,
        checkInDate: checkInDate || ticket.checkInDate,
        time: reqTime,
        quantity: reqEa,
        isCurrent: true,
      }
    })
    if (!foundCurrent) {
      tickets.push({
        ...(currentBookingId ? { id: currentBookingId } : {}),
        rnNumber: rnNumber ?? null,
        checkInDate,
        time: reqTime,
        quantity: reqEa,
        isCurrent: true,
      })
    }
    return buildTicketBookingChangeRequestEmail({
      company,
      checkInDate,
      ...(category !== undefined ? { category } : {}),
      ...(rnNumber !== undefined ? { rnNumber } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(submitterDisplayName !== undefined ? { submitterDisplayName } : {}),
      currentQuantity: initialEa,
      currentTime: initialTime,
      requestedQuantity: reqEa,
      requestedTime: reqTime,
      sameDayTickets: tickets,
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
    currentBookingId,
    sameDayTickets,
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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">
          수량·시간 변경 요청 후 예약은 「변경 요청」, 벤더는 「응답 대기」로 바뀝니다.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="overflow-hidden rounded-xl border border-border/60">
            <div className="grid grid-cols-2 divide-x divide-border/60">
              <div className="bg-muted/40 px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                기존
              </div>
              <div className="bg-primary/5 px-3 py-2 text-center text-xs font-semibold text-primary">
                변경
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
              <div className="px-3 py-3">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground">수량</p>
                <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
                  {initialEa}개
                </p>
              </div>
              <div className="px-3 py-3">
                <label htmlFor="ticket-qty-time-change-ea" className="text-[10px] font-medium tracking-wide text-muted-foreground">
                  {t('quantity')}
                </label>
                <input
                  id="ticket-qty-time-change-ea"
                  type="number"
                  min={0}
                  className={`mt-1.5 h-11 w-full rounded-lg border border-input px-3 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring ${
                    qtyChanged ? 'font-semibold text-red-600' : ''
                  }`}
                  value={ea}
                  onChange={(e) => setEa(e.target.value)}
                  disabled={!!saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
              <div className="px-3 py-3">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground">시간</p>
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {displayTimeLabel(initialTime)}
                </p>
              </div>
              <div className="px-3 py-3">
                <label htmlFor="ticket-qty-time-change-time" className="text-[10px] font-medium tracking-wide text-muted-foreground">
                  {t('time')} *
                </label>
                <select
                  id="ticket-qty-time-change-time"
                  className={`mt-1.5 h-11 w-full rounded-lg border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                    timeChanged ? 'font-semibold text-red-600' : ''
                  }`}
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
            </div>

            <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
              <div className="px-3 py-3">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground">금액</p>
                <p className="mt-1.5 text-sm font-semibold tabular-nums text-foreground">
                  ${formatMoneyUsd(Number.isFinite(initialExpense) ? initialExpense : 0)}
                </p>
              </div>
              <div className="px-3 py-3">
                <p className="text-[10px] font-medium tracking-wide text-muted-foreground">금액</p>
                {projectedExpense != null ? (
                  <p
                    className={`mt-1.5 text-sm font-semibold tabular-nums ${
                      amountChanged ? 'text-red-600' : 'text-foreground'
                    }`}
                  >
                    ${formatMoneyUsd(projectedExpense)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>
          </div>

          {unitUsd > 0 ? (
            <p className="text-[10px] text-muted-foreground">
              단가 약 <span className="tabular-nums">${formatMoneyUsd(unitUsd)}</span> / 1개
            </p>
          ) : initialExpense > 0 ? (
            <p className="text-[10px] text-amber-700">
              기존 수량·금액으로 단가를 계산할 수 없어 예상 금액을 표시하지 않습니다.
            </p>
          ) : null}

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
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
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
