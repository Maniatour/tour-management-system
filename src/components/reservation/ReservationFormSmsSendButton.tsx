'use client'

import { useCallback, useRef, useState } from 'react'
import { Loader2, Smartphone } from 'lucide-react'
import type { Customer, Reservation } from '@/types/reservation'
import PreTourContactSmsPreviewModal from '@/components/reservation/PreTourContactSmsPreviewModal'
import { isAbortLikeError } from '@/lib/isAbortLikeError'
import {
  readReservationCustomerId,
  resolveLinkedCustomer,
  type LinkedCustomerContact,
} from '@/lib/resolveLinkedCustomer'

type Props = {
  reservation: Pick<Reservation, 'id' | 'customerId'> & { customer_id?: string | null }
  customers: Customer[]
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  className?: string
  onSendSuccess?: () => void
}

export function ReservationFormSmsSendButton({
  reservation,
  customers,
  sentBy,
  uiLocale = 'ko',
  className = '',
  onSendSuccess,
}: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [linkedCustomer, setLinkedCustomer] = useState<LinkedCustomerContact | null>(null)
  const resolvingRef = useRef(false)

  const openModal = useCallback(async () => {
    if (resolvingRef.current) return
    resolvingRef.current = true
    setBusy(true)
    let customer: LinkedCustomerContact | null = null
    try {
      customer = await resolveLinkedCustomer(customers, readReservationCustomerId(reservation))
    } catch (error) {
      if (!isAbortLikeError(error)) {
        alert(error instanceof Error ? error.message : '고객 정보를 불러오지 못했습니다.')
      }
      return
    } finally {
      resolvingRef.current = false
      setBusy(false)
    }
    if (!customer) {
      alert(
        uiLocale === 'en'
          ? 'Linked customer record was not found.'
          : '연결된 고객 정보를 찾을 수 없습니다.'
      )
      return
    }
    const hasPhone = !!(customer.phone?.trim() || customer.emergency_contact?.trim())
    if (!hasPhone) {
      alert(
        uiLocale === 'en'
          ? 'The customer has no phone number.'
          : '고객 전화번호가 없습니다.'
      )
      return
    }
    setLinkedCustomer(customer)
    setOpen(true)
  }, [customers, reservation, uiLocale])

  const btnClass =
    'inline-flex items-center justify-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] sm:text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 disabled:pointer-events-none max-w-[5.5rem] sm:max-w-none'

  return (
    <>
      <button
        type="button"
        className={`${btnClass} ${className}`}
        disabled={busy || open}
        title={
          uiLocale === 'en'
            ? 'Preview and send pre-tour contact SMS'
            : '투어 사전 연락 SMS 미리보기·발송'
        }
        onClick={() => {
          void openModal()
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
        <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{uiLocale === 'en' ? 'SMS' : '사전연락'}</span>
      </button>

      {open && linkedCustomer ? (
        <PreTourContactSmsPreviewModal
          isOpen
          onClose={() => setOpen(false)}
          reservationId={reservation.id}
          customerLanguage={linkedCustomer.language ?? null}
          sentBy={sentBy}
          uiLocale={uiLocale}
          {...(onSendSuccess ? { onSendSuccess } : {})}
        />
      ) : null}
    </>
  )
}
