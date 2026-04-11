'use client'

import { useCallback, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Customer, Reservation } from '@/types/reservation'
import EmailPreviewModal from '@/components/reservation/EmailPreviewModal'

export type ReservationFormEmailSendKind = 'confirmation' | 'departure' | 'pickup'

type Props = {
  reservation: Pick<Reservation, 'id' | 'customerId' | 'pickUpTime' | 'tourDate'>
  customers: Customer[]
  sentBy: string | null
  uiLocale?: 'ko' | 'en'
  className?: string
}

export function ReservationFormEmailSendButtons({
  reservation,
  customers,
  sentBy,
  uiLocale = 'ko',
  className = '',
}: Props) {
  const [sending, setSending] = useState<ReservationFormEmailSendKind | null>(null)
  const [previewKind, setPreviewKind] = useState<ReservationFormEmailSendKind | null>(null)

  const openPreview = useCallback(
    (kind: ReservationFormEmailSendKind) => {
      const customer = customers.find((c) => c.id === reservation.customerId)
      if (!customer?.email) {
        alert(uiLocale === 'en' ? 'The customer has no email address.' : '고객 이메일이 없습니다.')
        return
      }

      if (kind === 'pickup') {
        const pt = reservation.pickUpTime?.trim()
        if (!pt || !reservation.tourDate) {
          alert(
            uiLocale === 'en'
              ? 'Pickup time and tour date are required.'
              : '픽업 시간과 투어 날짜가 필요합니다.'
          )
          return
        }
      }

      setPreviewKind(kind)
    },
    [customers, reservation.customerId, reservation.pickUpTime, reservation.tourDate, uiLocale]
  )

  const executeSend = useCallback(
    async (kind: ReservationFormEmailSendKind) => {
      const customer = customers.find((c) => c.id === reservation.customerId)
      if (!customer?.email) {
        throw new Error(uiLocale === 'en' ? 'The customer has no email address.' : '고객 이메일이 없습니다.')
      }

      const customerLanguage = String(customer.language ?? 'ko').toLowerCase()
      const locale =
        customerLanguage === 'en' || customerLanguage === 'english' ? 'en' : 'ko'

      let response: Response
      if (kind === 'confirmation') {
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: reservation.id,
            email: customer.email,
            type: 'both',
            locale,
            sentBy,
          }),
        })
      } else if (kind === 'departure') {
        response = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: reservation.id,
            email: customer.email,
            type: 'voucher',
            locale,
            sentBy,
          }),
        })
      } else {
        const pt = reservation.pickUpTime!.trim()
        const pickupTime = pt.includes(':') ? pt : `${pt}:00`
        response = await fetch('/api/send-pickup-schedule-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: reservation.id,
            pickupTime,
            tourDate: reservation.tourDate,
            locale,
            sentBy,
          }),
        })
      }

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : '이메일 발송에 실패했습니다.'
        )
      }
      alert(uiLocale === 'en' ? 'Email sent successfully.' : '이메일이 발송되었습니다.')
    },
    [customers, reservation.id, reservation.pickUpTime, reservation.tourDate, reservation.customerId, sentBy, uiLocale]
  )

  const btnClass =
    'inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] sm:text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none max-w-[5.5rem] sm:max-w-none'

  const customer = customers.find((c) => c.id === reservation.customerId)
  const previewEmail = customer?.email ?? ''

  return (
    <>
      <div className={`flex flex-wrap items-center justify-end gap-1 ${className}`}>
        <button
          type="button"
          className={btnClass}
          disabled={!!sending || !!previewKind}
          title={
            uiLocale === 'en'
              ? 'Preview and send reservation confirmation email'
              : '예약 확인 이메일 미리보기·발송'
          }
          onClick={() => openPreview('confirmation')}
        >
          {sending === 'confirmation' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : null}
          <span className="truncate">{uiLocale === 'en' ? 'Booking' : '예약확인'}</span>
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={!!sending || !!previewKind}
          title={
            uiLocale === 'en'
              ? 'Preview and send tour departure confirmation email'
              : '투어 출발 확정 이메일 미리보기·발송'
          }
          onClick={() => openPreview('departure')}
        >
          {sending === 'departure' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : null}
          <span className="truncate">{uiLocale === 'en' ? 'Departure' : '출발확정'}</span>
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={!!sending || !!previewKind}
          title={
            uiLocale === 'en'
              ? 'Preview and send pickup notification email'
              : '픽업 안내 이메일 미리보기·발송'
          }
          onClick={() => openPreview('pickup')}
        >
          {sending === 'pickup' ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : null}
          <span className="truncate">{uiLocale === 'en' ? 'Pickup' : '픽업안내'}</span>
        </button>
      </div>

      {previewKind && previewEmail ? (
        <EmailPreviewModal
          isOpen
          onClose={() => setPreviewKind(null)}
          reservationId={reservation.id}
          emailType={previewKind}
          customerEmail={previewEmail}
          pickupTime={reservation.pickUpTime ?? null}
          tourDate={reservation.tourDate ?? null}
          onSend={async () => {
            setSending(previewKind)
            try {
              await executeSend(previewKind)
            } finally {
              setSending(null)
            }
          }}
        />
      ) : null}
    </>
  )
}

