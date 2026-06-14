'use client'

import dynamic from 'next/dynamic'

function ReservationsPageSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-gray-50 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
          role="status"
          aria-label="예약 관리 불러오는 중"
        />
        <p className="text-sm text-gray-500">예약 관리를 불러오는 중...</p>
      </div>
    </div>
  )
}

const ReservationsPageContent = dynamic(() => import('./ReservationsPageContent'), {
  ssr: false,
  loading: () => <ReservationsPageSkeleton />,
})

export default function AdminReservationsPage() {
  return <ReservationsPageContent />
}
