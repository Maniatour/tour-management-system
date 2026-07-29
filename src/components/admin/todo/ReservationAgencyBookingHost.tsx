'use client'

import dynamic from 'next/dynamic'

const TicketBookingForm = dynamic(() => import('@/components/booking/TicketBookingForm'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-12 text-sm text-gray-500">로딩 중…</div>
  ),
})

type ReservationAgencyBookingHostProps = {
  locale: string
  reservationId: string
  tourDate: string | null
  onClose: () => void
  onSaved?: () => void
}

export function ReservationAgencyBookingHost({
  locale,
  reservationId,
  tourDate,
  onClose,
  onSaved,
}: ReservationAgencyBookingHostProps) {
  const isKo = locale === 'ko'
  const checkInDate = String(tourDate || '').trim().slice(0, 10)

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isKo ? '티켓 부킹 추가' : 'Add ticket booking'}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {isKo ? '예약에 연결된 입장권 부킹을 등록합니다.' : 'Create a ticket booking linked to this reservation.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={isKo ? '닫기' : 'Close'}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <TicketBookingForm
            key={reservationId}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            booking={
              {
                reservation_id: reservationId,
                check_in_date: checkInDate,
              } as any
            }
            onSave={() => {
              onSaved?.()
              onClose()
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}
