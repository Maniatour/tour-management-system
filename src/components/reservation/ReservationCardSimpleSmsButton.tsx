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
}

/** 간단 카드: 소통 채널 아이콘(h-4)과 같은 크기의 사전연락 SMS 버튼 */
export function ReservationCardSimpleSmsButton({
  reservationId,
  customer,
  sentBy,
  uiLocale = 'ko',
  onSendSuccess,
}: Props) {
  const t = useTranslations('reservations.card')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const openModal = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
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
    [customer, uiLocale]
  )

  return (
    <>
      <button
        type="button"
        disabled={busy || open}
        onClick={(e) => {
          setBusy(true)
          try {
            openModal(e)
          } finally {
            setBusy(false)
          }
        }}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
        title={t('preTourSmsButtonTitle')}
        aria-label={t('preTourSmsButtonTitle')}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Smartphone className="h-3 w-3" aria-hidden />
        )}
      </button>

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
