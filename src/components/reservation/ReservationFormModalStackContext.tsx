'use client'

import { createContext, useContext } from 'react'
import { childModalZIndex } from '@/lib/dialogZIndex'

export type ReservationFormModalStack = {
  /** 예약 수정 모달 오버레이 z-index */
  parentZIndex: number
  /** 직계 자식 모달 (지출·옵션·이메일 미리보기 등) */
  childZIndex: number
  /** 자식 모달 위 2단계 (결제처 관리·상품 상세 편집 등) */
  grandchildZIndex: number
}

const ReservationFormModalStackContext = createContext<ReservationFormModalStack | null>(null)

export function ReservationFormModalStackProvider({
  parentZIndex,
  children,
}: {
  parentZIndex: number
  children: React.ReactNode
}) {
  const value: ReservationFormModalStack = {
    parentZIndex,
    childZIndex: childModalZIndex(parentZIndex),
    grandchildZIndex: childModalZIndex(parentZIndex, 2),
  }
  return (
    <ReservationFormModalStackContext.Provider value={value}>
      {children}
    </ReservationFormModalStackContext.Provider>
  )
}

/** 예약 수정 모달 내부 — 없으면 null (독립 페이지·관리자 목록 등) */
export function useReservationFormModalStack(): ReservationFormModalStack | null {
  return useContext(ReservationFormModalStackContext)
}

export function useReservationFormChildOverlayZIndex(fallback: number): number {
  const stack = useReservationFormModalStack()
  return stack?.childZIndex ?? fallback
}

export function useReservationFormGrandchildOverlayZIndex(fallback: number): number {
  const stack = useReservationFormModalStack()
  return stack?.grandchildZIndex ?? fallback
}
