'use client'

import { useCallback, useState } from 'react'
import { Loader2, Smartphone } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Customer } from '@/types/reservation'
import PreTourContactSmsPreviewModal from '@/components/reservation/PreTourContactSmsPreviewModal'

type Props = {
  reservationId: string
  customer: Customer | undefined
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  onSendSuccess?: () => void
  /** icon: 상단 컴팩트 버튼 / menuItem: 더보기 메뉴 행 */
  variant?: 'icon' | 'menuItem'
  /** 메뉴에서 열기 직전(부모 더보기 닫기 등). 포털·언마운트되는 메뉴 안에서는 사용하지 말 것 — 모달 상태를 부모에서 관리하세요. */
  onBeforeOpen?: () => void
}

/** 간단 카드: 투어 사전연락 SMS */
export function ReservationCardSimpleSmsButton({
  reservationId,
  customer,
  sentBy,
  uiLocale = 'ko',
  onSendSuccess,
  variant = 'icon',
  onBeforeOpen,
}: Props) {
  const t = useTranslations('reservations.card')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const openModal = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onBeforeOpen?.()
      if (!customer) {
        alert(uiLocale === 'en' ? 'Customer not found.' : '고객 정보를 찾을 수 없습니다.')
        return
      }
      const hasPhone = !!(customer.phone?.trim() || customer.emergency_contact?.trim())
      if (!hasPhone) {
        alert(uiLocale === 'en' ? 'No phone number.' : '고객 전화번호가 없습니다.')
        return
      }
      setOpen(true)
    },
    [customer, uiLocale, onBeforeOpen]
  )

  const handleClick = (e: React.MouseEvent) => {
    setBusy(true)
    try {
      openModal(e)
    } finally {
      setBusy(false)
    }
  }

  const label = t('preTourSmsButtonTitle')

  return (
    <>
      {variant === 'menuItem' ? (
        <button
          type="button"
          role="menuitem"
          disabled={busy || open}
          onClick={handleClick}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          title={label}
          aria-label={label}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-700" aria-hidden />
          ) : (
            <Smartphone className="h-3.5 w-3.5 shrink-0 text-violet-700" aria-hidden />
          )}
          {label}
        </button>
      ) : (
        <button
          type="button"
          disabled={busy || open}
          onClick={handleClick}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
          title={label}
          aria-label={label}
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Smartphone className="h-3 w-3" aria-hidden />
          )}
        </button>
      )}

      {open && customer ? (
        <PreTourContactSmsPreviewModal
          isOpen
          onClose={() => setOpen(false)}
          reservationId={reservationId}
          customerLanguage={customer.language ?? null}
          sentBy={sentBy}
          uiLocale={uiLocale}
          {...(onSendSuccess ? { onSendSuccess } : {})}
        />
      ) : null}
    </>
  )
}
