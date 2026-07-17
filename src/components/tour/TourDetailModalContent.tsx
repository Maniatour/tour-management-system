'use client'

import { TourDetailPageView } from '@/components/tour/TourDetailPageView'

export type TourDetailModalContentProps = {
  tourId: string
  /** 스케줄 등에서 투어 상태 변경 후 전체 뷰를 다시 마운트할 때 사용 */
  refreshNonce?: number
}

/**
 * 모달용 투어 상세.
 * TourDetailPageView 를 정적 import — 부모의 dynamic() 한 번만 받아
 * (TourDetailModalContent → 다시 dynamic TourDetailPageView) 이중 청크 로딩을 피한다.
 */
export function TourDetailModalContent({ tourId, refreshNonce = 0 }: TourDetailModalContentProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-auto bg-white">
      <TourDetailPageView key={`${tourId}-${refreshNonce}`} tourId={tourId} modalLightLoad />
    </div>
  )
}
