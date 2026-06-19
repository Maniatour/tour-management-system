'use client'

import dynamic from 'next/dynamic'

const ReservationDetailPageView = dynamic(
  () =>
    import('@/components/reservation/ReservationDetailPageView').then((m) => ({
      default: m.ReservationDetailPageView,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] flex-col gap-3 p-4">
        <div className="h-8 w-1/3 animate-pulse rounded bg-gray-200" />
        <div className="h-24 animate-pulse rounded bg-gray-100" />
        <div className="h-24 animate-pulse rounded bg-gray-100" />
      </div>
    ),
  }
)

export type ReservationDetailModalContentProps = {
  reservationId: string
}

export function ReservationDetailModalContent({ reservationId }: ReservationDetailModalContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-auto bg-white">
      <ReservationDetailPageView reservationId={reservationId} modalLightLoad />
    </div>
  )
}
