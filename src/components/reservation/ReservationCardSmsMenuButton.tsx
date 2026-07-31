'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Smartphone } from 'lucide-react'
import type { Customer } from '@/types/reservation'
import ReservationOutboundSmsModal from '@/components/reservation/ReservationOutboundSmsModal'
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

type Props = {
  reservationId: string
  customer: Customer | undefined
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  onSendSuccess?: () => void
  variant?: 'icon' | 'menuItem'
  onBeforeOpen?: () => void
}

export function ReservationCardSmsMenuButton({
  reservationId,
  customer,
  sentBy,
  uiLocale = 'ko',
  onSendSuccess,
  variant = 'icon',
  onBeforeOpen,
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

  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

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
      setMenuOpen((open) => !open)
    },
    [onBeforeOpen, validateCustomer]
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
      const panelWidth = panel?.offsetWidth ?? 220
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
    if (activeCategory === 'pre_tour_contact') {
      onSendSuccess?.()
    }
  }, [activeCategory, onSendSuccess])

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
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-700" />
        ) : (
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-violet-700" />
        )}
        {isEn ? 'Send SMS' : 'SMS 발송'}
      </button>
    ) : (
      <button
        type="button"
        ref={buttonRef}
        disabled={busy || !!activeCategory}
        onClick={toggleMenu}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded leading-none border-2 border-violet-200 bg-violet-50 text-violet-700 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        title={isEn ? 'Send SMS' : 'SMS 발송'}
        aria-label={isEn ? 'Send SMS' : 'SMS 발송'}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Smartphone className="h-3 w-3 shrink-0" aria-hidden />
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
            className="fixed z-[10000] w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {isEn ? 'SMS type' : 'SMS 종류'}
            </p>
            {RESERVATION_CARD_SMS_CATEGORY_IDS.map((categoryId) => {
              const iconKey = resolveAdminSmsCategoryIconKey(categoryId, settings)
              const Icon = resolveAdminSmsCategoryIcon(iconKey)
              const label = resolveAdminSmsCategoryLabel(categoryId, settings, uiLocale)
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
                  <Icon className="h-3.5 w-3.5 shrink-0 text-violet-700" aria-hidden />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              )
            })}
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
