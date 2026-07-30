'use client'

import { useCallback, useEffect, useState } from 'react'
import { TourDetailPageView } from '@/components/tour/TourDetailPageView'

export type TourDetailModalContentProps = {
  tourId: string
  /** 스케줄 등에서 투어 상태 변경 후 전체 뷰를 다시 마운트할 때 사용 */
  refreshNonce?: number
  /** 배정 관리 등에서 다른 투어로 이동 시 모달 헤더·링크 동기화용 */
  onNavigateToTour?: (tourId: string) => void
}

/**
 * 모달용 투어 상세.
 * TourDetailPageView 를 정적 import — 부모의 dynamic() 한 번만 받아
 * (TourDetailModalContent → 다시 dynamic TourDetailPageView) 이중 청크 로딩을 피한다.
 */
export function TourDetailModalContent({
  tourId,
  refreshNonce = 0,
  onNavigateToTour,
}: TourDetailModalContentProps) {
  const [displayTourId, setDisplayTourId] = useState(tourId)

  useEffect(() => {
    setDisplayTourId(tourId)
  }, [tourId])

  const handleNavigateToTour = useCallback(
    (nextTourId: string) => {
      setDisplayTourId(nextTourId)
      onNavigateToTour?.(nextTourId)
    },
    [onNavigateToTour]
  )

  return (
    <div className="w-full bg-white">
      <TourDetailPageView
        key={`${displayTourId}-${refreshNonce}`}
        tourId={displayTourId}
        modalLightLoad
        onNavigateToTour={handleNavigateToTour}
      />
    </div>
  )
}
