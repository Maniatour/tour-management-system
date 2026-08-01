'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Smartphone } from 'lucide-react'
import type { Customer } from '@/types/reservation'
import ReservationOutboundSmsModal from '@/components/reservation/ReservationOutboundSmsModal'
import { resolveAdminSmsCategoryIconColor } from '@/lib/adminSmsCategoryColors'
import { resolveAdminSmsCategoryIcon } from '@/lib/adminSmsCategoryIcons'
import {
  resolveAdminSmsCategoryIconKey,
  resolveAdminSmsCategoryLabel,
} from '@/lib/adminSmsCategorySettings'
import { useAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'
import {
  RESERVATION_CARD_SMS_CATEGORY_IDS,
  type ReservationOutboundSmsCategoryId,
} from '@/lib/reservationOutboundSmsCategories'
import {
  fetchReservationSmsLogSummaries,
  type ReservationSmsLogSummary,
} from '@/lib/reservationSmsLogSummaries'
import {
  smsDeliveryStateBadgeClasses,
  smsDeliveryStateIconBorderClasses,
  smsDeliveryStateLabel,
} from '@/lib/smsLogDeliveryState'
import { ADMIN_FLOATING_PORTAL_Z_INDEX } from '@/lib/adminFloatingFabLayout'

type Props = {
  reservationId: string
  customer: Customer | undefined
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  onSendSuccess?: () => void
  onSmsSendSuccess?: (reservationId: string) => void
  onSmsLogsClick?: () => void
  variant?: 'icon' | 'menuItem'
  onBeforeOpen?: () => void
  /** 목록 페이지 배치 조회 시 전달 */
  smsLogSummary?: ReservationSmsLogSummary | null
  smsLogSummaryLoaded?: boolean
}

export function ReservationCardSmsMenuButton({
  reservationId,
  customer,
  sentBy,
  uiLocale = 'ko',
  onSendSuccess,
  onSmsSendSuccess,
  onSmsLogsClick,
  variant = 'icon',
  onBeforeOpen,
  smsLogSummary: smsLogSummaryProp,
  smsLogSummaryLoaded: smsLogSummaryLoadedProp,
}: Props) {
  const isEn = uiLocale === 'en'
  const { settings } = useAdminSmsCategorySettings()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const [portalReady, setPortalReady] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ReservationOutboundSmsCategoryId | null>(
    null
  )
  const [busy, setBusy] = useState(false)
  const [localSummary, setLocalSummary] = useState<ReservationSmsLogSummary | null>(null)
  const [localSummaryLoaded, setLocalSummaryLoaded] = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const smsLogSummary = smsLogSummaryProp ?? localSummary
  const smsLogSummaryLoaded = smsLogSummaryLoadedProp ?? localSummaryLoaded

  useEffect(() => {
    setPortalReady(true)
  }, [])

  const loadLocalSummary = useCallback(async () => {
    if (smsLogSummaryProp !== undefined) return
    const fetched = await fetchReservationSmsLogSummaries([reservationId])
    setLocalSummary(fetched.get(reservationId) ?? { latest: null, byCategory: {} })
    setLocalSummaryLoaded(true)
  }, [reservationId, smsLogSummaryProp])

  useEffect(() => {
    if (smsLogSummaryProp !== undefined) return
    void loadLocalSummary()
  }, [smsLogSummaryProp, loadLocalSummary])

  const validateCustomer = useCallback(() => {
    if (!customer) {
      alert(isEn ? 'Customer not found.' : '고객 정보를 찾을 수 없습니다.')
      return false
    }
    const hasPhone = !!(customer.phone?.trim() || customer.emergency_contact?.trim())
    if (!hasPhone) {
      alert(isEn ? 'No phone number.' : '고객 전화번호가 없습니다.')
      return false
    }
    return true
  }, [customer, isEn])

  const openCategory = useCallback(
    (categoryId: ReservationOutboundSmsCategoryId) => {
      onBeforeOpen?.()
      if (!validateCustomer()) return
      setMenuOpen(false)
      setActiveCategory(categoryId)
    },
    [onBeforeOpen, validateCustomer]
  )

  const toggleMenu = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onBeforeOpen?.()
      if (!validateCustomer()) return
      if (smsLogSummaryProp === undefined && !localSummaryLoaded) {
        void loadLocalSummary()
      }
      setMenuOpen((open) => !open)
    },
    [onBeforeOpen, validateCustomer, smsLogSummaryProp, localSummaryLoaded, loadLocalSummary]
  )

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        menuRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return
      }
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }
    const updatePos = () => {
      const btn = buttonRef.current
      const panel = panelRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const panelWidth = panel?.offsetWidth ?? 260
      const left = Math.min(rect.left, window.innerWidth - panelWidth - 8)
      setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [menuOpen])

  const handleSendSuccess = useCallback(() => {
    onSmsSendSuccess?.(reservationId)
    if (smsLogSummaryProp === undefined) {
      void loadLocalSummary()
    }
    if (activeCategory === 'pre_tour_contact') {
      onSendSuccess?.()
    }
  }, [
    activeCategory,
    onSendSuccess,
    onSmsSendSuccess,
    reservationId,
    smsLogSummaryProp,
    loadLocalSummary,
  ])

  const latestLog = smsLogSummaryLoaded ? (smsLogSummary?.latest ?? null) : null
  const hasSendHistory = !!latestLog

  const triggerIconKey = hasSendHistory
    ? resolveAdminSmsCategoryIconKey(
        latestLog.categoryId as ReservationOutboundSmsCategoryId,
        settings
      )
    : 'smartphone'
  const TriggerIcon = resolveAdminSmsCategoryIcon(triggerIconKey)
  const triggerIconColor = hasSendHistory
    ? resolveAdminSmsCategoryIconColor(latestLog.categoryId)
    : 'text-violet-700'
  const triggerBorderClasses = hasSendHistory
    ? smsDeliveryStateIconBorderClasses(latestLog.deliveryState)
    : 'border-violet-200 bg-violet-50'

  const triggerButton =
    variant === 'menuItem' ? (
      <button
        type="button"
        role="menuitem"
        ref={buttonRef}
        disabled={busy || !!activeCategory}
        onClick={toggleMenu}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        title={isEn ? 'Send SMS' : 'SMS 발송'}
        aria-label={isEn ? 'Send SMS' : 'SMS 발송'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {busy ? (
          <Loader2 className={`h-3.5 w-3.5 shrink-0 animate-spin ${triggerIconColor}`} />
        ) : (
          <TriggerIcon className={`h-3.5 w-3.5 shrink-0 ${triggerIconColor}`} />
        )}
        {isEn ? 'Send SMS' : 'SMS 발송'}
      </button>
    ) : (
      <button
        type="button"
        ref={buttonRef}
        disabled={busy || !!activeCategory}
        onClick={toggleMenu}
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 leading-none transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${triggerBorderClasses} ${triggerIconColor}`}
        title={
          hasSendHistory
            ? `${isEn ? 'Send SMS' : 'SMS 발송'} · ${smsDeliveryStateLabel(latestLog.deliveryState, uiLocale)}`
            : isEn
              ? 'Send SMS'
              : 'SMS 발송'
        }
        aria-label={isEn ? 'Send SMS' : 'SMS 발송'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        ) : (
          <TriggerIcon className="h-3 w-3 shrink-0" aria-hidden />
        )}
      </button>
    )

  return (
    <>
      <div className="relative shrink-0" ref={menuRef}>
        {triggerButton}
      </div>

      {menuOpen &&
        portalReady &&
        menuPos &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            className="fixed w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left, zIndex: ADMIN_FLOATING_PORTAL_Z_INDEX }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {isEn ? 'SMS type' : 'SMS 종류'}
            </p>
            {RESERVATION_CARD_SMS_CATEGORY_IDS.map((categoryId) => {
              const iconKey = resolveAdminSmsCategoryIconKey(categoryId, settings)
              const Icon = resolveAdminSmsCategoryIcon(iconKey)
              const label = resolveAdminSmsCategoryLabel(categoryId, settings, uiLocale)
              const iconColor = resolveAdminSmsCategoryIconColor(categoryId)
              const categorySummary = smsLogSummary?.byCategory?.[categoryId] ?? null
              const deliveryState = categorySummary?.deliveryState
              const showBadge = !!categorySummary && deliveryState && deliveryState !== 'none'

              return (
                <button
                  key={categoryId}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-violet-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    setBusy(true)
                    try {
                      openCategory(categoryId)
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {showBadge && deliveryState ? (
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-tight ${smsDeliveryStateBadgeClasses(deliveryState)}`}
                    >
                      {smsDeliveryStateLabel(deliveryState, uiLocale)}
                    </span>
                  ) : null}
                </button>
              )
            })}
            {onSmsLogsClick ? (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-primary hover:bg-muted/50"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    onSmsLogsClick()
                  }}
                >
                  <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{isEn ? 'SMS send history' : 'SMS 발송 내역'}</span>
                </button>
              </>
            ) : null}
          </div>,
          document.body
        )}

      {activeCategory && customer ? (
        <ReservationOutboundSmsModal
          isOpen
          onClose={() => setActiveCategory(null)}
          reservationId={reservationId}
          categoryId={activeCategory}
          customerLanguage={customer.language ?? null}
          sentBy={sentBy}
          uiLocale={uiLocale}
          onSendSuccess={handleSendSuccess}
        />
      ) : null}
    </>
  )
}

/** @deprecated Use ReservationCardSmsMenuButton */
export const ReservationCardSimpleSmsButton = ReservationCardSmsMenuButton
