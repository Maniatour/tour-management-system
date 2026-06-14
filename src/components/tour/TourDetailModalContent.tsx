'use client'

import dynamic from 'next/dynamic'

const TourDetailPageView = dynamic(
  () =>
    import('@/components/tour/TourDetailPageView').then((m) => ({
      default: m.TourDetailPageView,
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

export type TourDetailModalContentProps = {
  tourId: string
  /** 스케줄 등에서 투어 상태 변경 후 전체 뷰를 다시 마운트할 때 사용 */
  refreshNonce?: number
}

export function TourDetailModalContent({ tourId, refreshNonce = 0 }: TourDetailModalContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-auto bg-white">
      <TourDetailPageView key={`${tourId}-${refreshNonce}`} tourId={tourId} modalLightLoad />
    </div>
  )
}
