'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslations } from 'next-intl'
import { PencilLine } from 'lucide-react'
import {
  applyTicketBookingSetAxes,
  type TicketBookingAxisSnapshot,
} from '@/lib/ticketBookingActions'
import { normalizeTicketBookingAxisPatchFromSnapshot } from '@/components/booking/TicketBookingAxesEditor'
import {
  TICKET_BOOKING_AXIS_SELECT_ORDER,
  formatTicketBookingAxisLabel,
  getBookingAxisStatusBadgeClass,
  getVendorAxisStatusBadgeClass,
} from '@/lib/ticketBookingAxisLabels'
import {
  getTicketBookingUnifiedStatusBadgeClass,
  resolveTicketBookingUnifiedStatus,
} from '@/lib/ticketBookingDisplay'
import {
  showChangeRequestButton,
  isWorkflowInitialPhase,
} from '@/lib/ticketBookingWorkflow'
import {
  TicketBookingBookingStatusIcon,
  TicketBookingVendorStatusIcon,
} from '@/components/booking/ticketBookingAxisStatusIcons'

type BookingSnap = TicketBookingAxisSnapshot & {
  id: string
  status?: string | null
}

type Props = {
  booking: BookingSnap
  locale: string
  compact?: boolean
  disabled?: boolean
  className?: string
  onUpdated?: (() => void) | undefined
  onRequestChange?: (() => void) | undefined
}

export default function TicketBookingStatusQuickMenu({
  booking,
  locale,
  compact = false,
  disabled = false,
  className = '',
  onUpdated,
  onRequestChange,
}: Props) {
  const { user } = useAuth()
  const tAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const isEn = locale.startsWith('en')
  const unified = resolveTicketBookingUnifiedStatus(booking, locale)
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)
  const [saving, setSaving] = useState(false)

  const close = useCallback(() => setMenu(null), [])

  const openMenu = (anchor: HTMLElement) => {
    if (disabled || saving || typeof window === 'undefined') return
    if (menu) {
      close()
      return
    }
    const rect = anchor.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const menuW = 256
    const menuH = 320
    const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - menuW - 8))
    const spaceBelow = vh - rect.bottom
    const top =
      spaceBelow < Math.min(menuH, vh * 0.4) && rect.top > menuH
        ? Math.max(8, rect.top - menuH)
        : rect.bottom + 4
    setMenu({ top, left })
  }

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, close])

  const applyAxis = async (axis: 'booking' | 'vendor', nextRaw: string) => {
    if (disabled || saving) return
    const next = nextRaw.trim().toLowerCase()
    const patch = { ...normalizeTicketBookingAxisPatchFromSnapshot(booking) }
    if (axis === 'booking') {
      if (patch.booking_status === next) {
        close()
        return
      }
      patch.booking_status = next
    } else {
      if (patch.vendor_status === next) {
        close()
        return
      }
      patch.vendor_status = next
    }
    setSaving(true)
    try {
      const res = await applyTicketBookingSetAxes(booking.id, patch, user?.email ?? null)
      if (!res.ok) {
        alert(res.error ?? (isEn ? 'Failed to update status.' : '상태 변경에 실패했습니다.'))
        return
      }
      close()
      onUpdated?.()
    } catch (e) {
      console.error(e)
      alert(isEn ? 'An error occurred while updating.' : '상태 변경 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const csLower = String(booking.change_status ?? 'none').toLowerCase()
  const showChangeRow =
    Boolean(onRequestChange) &&
    !isWorkflowInitialPhase(booking) &&
    (csLower === 'requested' || showChangeRequestButton(booking))
  const changeDisabled = csLower === 'requested' || !showChangeRequestButton(booking)

  const bsCurrent = (booking.booking_status ?? 'requested').trim().toLowerCase()
  const vsCurrent = (booking.vendor_status ?? 'pending').trim().toLowerCase()

  const portal =
    menu &&
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
          className="fixed z-[10051] w-[min(16rem,calc(100vw-1rem))] max-h-80 overflow-y-auto rounded-lg border-2 border-gray-600 bg-black py-1 shadow-2xl"
          style={{ top: menu.top, left: menu.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {isEn ? 'Booking' : '예약'}
          </p>
          {TICKET_BOOKING_AXIS_SELECT_ORDER.booking.map((value) => {
            const label = formatTicketBookingAxisLabel(tAxis, 'booking', value)
            return (
              <button
                key={`b-${value}`}
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation()
                  void applyAxis('booking', value)
                }}
                className={`flex w-full items-center gap-2 border-b border-gray-700 px-3 py-2 text-left text-xs hover:bg-gray-800 disabled:opacity-50 ${
                  bsCurrent === value ? 'bg-gray-900 font-semibold' : 'bg-black'
                }`}
              >
                <TicketBookingBookingStatusIcon
                  status={value}
                  className="h-3.5 w-3.5 shrink-0 text-white"
                  title={label}
                />
                <span
                  className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${getBookingAxisStatusBadgeClass(value)}`}
                >
                  {label}
                </span>
              </button>
            )
          })}
          <p className="mt-1 border-t border-gray-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {isEn ? 'Vendor' : '벤더'}
          </p>
          {TICKET_BOOKING_AXIS_SELECT_ORDER.vendor.map((value) => {
            const label = formatTicketBookingAxisLabel(tAxis, 'vendor', value)
            return (
              <button
                key={`v-${value}`}
                type="button"
                disabled={saving}
                onClick={(e) => {
                  e.stopPropagation()
                  void applyAxis('vendor', value)
                }}
                className={`flex w-full items-center gap-2 border-b border-gray-700 px-3 py-2 text-left text-xs hover:bg-gray-800 disabled:opacity-50 ${
                  vsCurrent === value ? 'bg-gray-900 font-semibold' : 'bg-black'
                }`}
              >
                <TicketBookingVendorStatusIcon
                  status={value}
                  className="h-3.5 w-3.5 shrink-0 text-white"
                  title={label}
                />
                <span
                  className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${getVendorAxisStatusBadgeClass(value)}`}
                >
                  {label}
                </span>
              </button>
            )
          })}
          {showChangeRow ? (
            <button
              type="button"
              disabled={saving || changeDisabled}
              title={
                changeDisabled
                  ? isEn
                    ? 'Change request already in progress'
                    : '이미 변경 요청 진행 중'
                  : isEn
                    ? 'Open quantity/time change request'
                    : '수량·시간 변경 요청 모달 열기'
              }
              onClick={(e) => {
                e.stopPropagation()
                if (changeDisabled) return
                close()
                onRequestChange?.()
              }}
              className={`flex w-full items-center gap-2 border-t border-gray-600 px-3 py-2 text-left text-xs ${
                changeDisabled ? 'cursor-not-allowed bg-black opacity-50' : 'bg-black hover:bg-gray-800'
              }`}
            >
              <PencilLine className="h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
              <span
                className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  csLower === 'requested' ? 'bg-orange-100 text-orange-950' : 'bg-amber-100 text-amber-950'
                }`}
              >
                {formatTicketBookingAxisLabel(tAxis, 'change', 'requested')}
              </span>
            </button>
          ) : null}
        </div>
      </>,
      document.body
    )

  return (
    <>
      <button
        type="button"
        disabled={disabled || saving}
        aria-haspopup="listbox"
        aria-expanded={Boolean(menu)}
        title={`${unified.detail} · ${isEn ? 'Click to change status' : '클릭하여 상태 변경'}`}
        className={`inline-flex rounded-md border font-medium hover:ring-2 hover:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'rounded-lg px-2 py-0.5 text-xs'
        } ${getTicketBookingUnifiedStatusBadgeClass(unified.key)} ${className}`}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          openMenu(e.currentTarget)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {unified.label}
      </button>
      {portal}
    </>
  )
}
