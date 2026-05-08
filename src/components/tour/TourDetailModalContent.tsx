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
      <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-gray-500">
        로딩 중…
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
      <TourDetailPageView key={`${tourId}-${refreshNonce}`} tourId={tourId} />
    </div>
  )
}
