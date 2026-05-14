'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import {
  TICKET_BOOKING_AXIS_SELECT_ORDER,
  formatTicketBookingAxisLabel,
  getBookingAxisStatusBadgeClass,
  getVendorAxisStatusBadgeClass,
} from '@/lib/ticketBookingAxisLabels'
import { applyTicketBookingSetAxes } from '@/lib/ticketBookingActions'
import type { TicketBookingAxisSnapshot } from '@/lib/ticketBookingActions'
import { normalizeTicketBookingAxisPatchFromSnapshot } from '@/components/booking/TicketBookingAxesEditor'
import {
  TicketBookingBookingStatusIcon,
  TicketBookingVendorStatusIcon,
} from '@/components/booking/ticketBookingAxisStatusIcons'

export type ScheduleTicketBookingAxisRow = {
  id: string
  status: string | null
  booking_status?: string | null
  vendor_status?: string | null
  change_status?: string | null
  payment_status?: string | null
  refund_status?: string | null
  operation_status?: string | null
}

function mergeRowFromRpc(row: ScheduleTicketBookingAxisRow, rpc: Record<string, unknown>): ScheduleTicketBookingAxisRow {
  return {
    ...row,
    status: typeof rpc.status === 'string' ? rpc.status : row.status,
    booking_status:
      typeof rpc.booking_status === 'string' ? rpc.booking_status : row.booking_status ?? null,
    vendor_status: typeof rpc.vendor_status === 'string' ? rpc.vendor_status : row.vendor_status ?? null,
    change_status: typeof rpc.change_status === 'string' ? rpc.change_status : row.change_status ?? null,
    payment_status: typeof rpc.payment_status === 'string' ? rpc.payment_status : row.payment_status ?? null,
    refund_status: typeof rpc.refund_status === 'string' ? rpc.refund_status : row.refund_status ?? null,
    operation_status:
      typeof rpc.operation_status === 'string' ? rpc.operation_status : row.operation_status ?? null,
  }
}

type Props = {
  booking: ScheduleTicketBookingAxisRow
  /** 셀 내 여러 인라인 컨트롤 구분용 */
  instanceKey: string
  disabled?: boolean
  compact?: boolean
  className?: string
  onAxesUpdated: (next: ScheduleTicketBookingAxisRow) => void
}

export default function ScheduleTicketBookingAxisInline({
  booking,
  instanceKey,
  disabled = false,
  compact = true,
  className = '',
  onAxesUpdated,
}: Props) {
  const { user } = useAuth()
  const locale = useLocale()
  const tAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const [dropdown, setDropdown] = useState<null | { axis: 'booking' | 'vendor'; top: number; left: number }>(null)
  const [saving, setSaving] = useState(false)
  const bookingBtnRef = useRef<HTMLButtonElement>(null)
  const vendorBtnRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    setDropdown(null)
  }, [])

  const toggleMenu = useCallback((axis: 'booking' | 'vendor') => {
    setDropdown((prev) => {
      if (prev?.axis === axis) return null
      const el = axis === 'booking' ? bookingBtnRef.current : vendorBtnRef.current
      if (!el || typeof window === 'undefined') return null
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const menuW = 200
      const left = Math.min(rect.left, Math.max(8, vw - menuW - 8))
      return { axis, top: rect.bottom + 4, left }
    })
  }, [])

  useEffect(() => {
    if (!dropdown) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dropdown, close])

  const snapshot: TicketBookingAxisSnapshot = useMemo(
    () => ({
      booking_status: booking.booking_status,
      vendor_status: booking.vendor_status,
      change_status: booking.change_status,
      payment_status: booking.payment_status,
      refund_status: booking.refund_status,
      operation_status: booking.operation_status,
    }),
    [
      booking.booking_status,
      booking.vendor_status,
      booking.change_status,
      booking.payment_status,
      booking.refund_status,
      booking.operation_status,
    ]
  )

  const applyAxis = async (axis: 'booking' | 'vendor', nextRaw: string) => {
    if (disabled || saving) return
    const next = nextRaw.trim().toLowerCase()
    const patch = { ...normalizeTicketBookingAxisPatchFromSnapshot(snapshot) }
    if (axis === 'booking' && patch.booking_status === next) {
      close()
      return
    }
    if (axis === 'vendor' && patch.vendor_status === next) {
      close()
      return
    }
    if (axis === 'booking') patch.booking_status = next
    else patch.vendor_status = next

    setSaving(true)
    try {
      const res = await applyTicketBookingSetAxes(booking.id, patch, user?.email ?? null)
      if (!res.ok) {
        alert(res.error ?? (locale === 'ko' ? '상태 변경에 실패했습니다.' : 'Update failed.'))
        return
      }
      const payload = res.data as { booking?: Record<string, unknown> } | undefined
      const row = payload?.booking
      if (row && typeof row === 'object') {
        onAxesUpdated(mergeRowFromRpc(booking, row as Record<string, unknown>))
      }
      close()
    } catch (e) {
      console.error(e)
      alert(locale === 'ko' ? '상태 변경 중 오류가 발생했습니다.' : 'An error occurred while updating.')
    } finally {
      setSaving(false)
    }
  }

  const bookingLabel = formatTicketBookingAxisLabel(tAxis, 'booking', booking.booking_status)
  const vendorLabel = formatTicketBookingAxisLabel(tAxis, 'vendor', booking.vendor_status)

  const portal =
    dropdown &&
    typeof document !== 'undefined' &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[10050]"
          aria-hidden
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
        />
        <div
          role="listbox"
          className="fixed z-[10051] w-[min(12.5rem,calc(100vw-1rem))] max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
          style={{ top: dropdown.top, left: dropdown.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {(dropdown.axis === 'booking'
            ? TICKET_BOOKING_AXIS_SELECT_ORDER.booking
            : TICKET_BOOKING_AXIS_SELECT_ORDER.vendor
          ).map((value) => {
              const isBooking = dropdown.axis === 'booking'
              const cur = (
                isBooking ? booking.booking_status ?? 'requested' : booking.vendor_status ?? 'pending'
              )
                .trim()
                .toLowerCase()
              const label = formatTicketBookingAxisLabel(tAxis, isBooking ? 'booking' : 'vendor', value)
              const badge = isBooking ? getBookingAxisStatusBadgeClass(value) : getVendorAxisStatusBadgeClass(value)
              return (
                <button
                  key={value}
                  type="button"
                  disabled={saving}
                  onClick={(e) => {
                    e.stopPropagation()
                    void applyAxis(isBooking ? 'booking' : 'vendor', value)
                  }}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50 ${
                    cur === value ? 'bg-violet-50 font-semibold' : ''
                  }`}
                >
                  {isBooking ? (
                    <TicketBookingBookingStatusIcon status={value} className="h-3.5 w-3.5" title={label} />
                  ) : (
                    <TicketBookingVendorStatusIcon status={value} className="h-3.5 w-3.5" title={label} />
                  )}
                  <span className={`inline-flex min-w-0 flex-1 truncate rounded-full px-2 py-0.5 font-medium ${badge}`}>
                    {label}
                  </span>
                </button>
              )
            }
          )}
        </div>
      </>,
      document.body
    )

  const pad = compact ? 'px-0.5 py-0' : 'px-1 py-0.5'
  const textCls = compact ? 'max-w-[4.5rem] truncate text-[9px]' : 'text-[10px]'

  return (
    <div
      className={`flex flex-wrap items-center gap-0.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        ref={bookingBtnRef}
        type="button"
        disabled={disabled || saving}
        id={`${instanceKey}-bs`}
        title={locale === 'ko' ? `예약: ${bookingLabel}` : `Booking: ${bookingLabel}`}
        className={`inline-flex max-w-full items-center gap-0.5 rounded border border-transparent ${pad} hover:border-violet-300 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50`}
        onClick={(e) => {
          e.stopPropagation()
          toggleMenu('booking')
        }}
      >
        <TicketBookingBookingStatusIcon
          status={booking.booking_status}
          variant={compact ? 'tile' : 'line'}
          className={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0'}
          title={bookingLabel}
        />
        <span className={`font-semibold tabular-nums text-gray-800 ${textCls}`}>{bookingLabel}</span>
      </button>
      <button
        ref={vendorBtnRef}
        type="button"
        disabled={disabled || saving}
        id={`${instanceKey}-vs`}
        title={locale === 'ko' ? `벤더: ${vendorLabel}` : `Vendor: ${vendorLabel}`}
        className={`inline-flex max-w-full items-center gap-0.5 rounded border border-transparent ${pad} hover:border-violet-300 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50`}
        onClick={(e) => {
          e.stopPropagation()
          toggleMenu('vendor')
        }}
      >
        <TicketBookingVendorStatusIcon
          status={booking.vendor_status}
          variant={compact ? 'tile' : 'line'}
          className={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0'}
          title={vendorLabel}
        />
        <span className={`font-semibold tabular-nums text-gray-800 ${textCls}`}>{vendorLabel}</span>
      </button>
      {portal}
    </div>
  )
}
