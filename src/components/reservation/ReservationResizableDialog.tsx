'use client'

import { ReservationDetailPageView } from '@/components/reservation/ReservationDetailPageView'
import type { DialogStackLevel } from '@/lib/dialogZIndex'

type ReservationResizableDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservationId: string | null
  modalStackLevel?: DialogStackLevel
  /** 부모 모달보다 위에 띄울 때. 있으면 stack level보다 우선합니다. */
  modalZIndex?: number
}

export function ReservationResizableDialog({
  open,
  onOpenChange,
  reservationId,
  modalStackLevel = 'nested',
  modalZIndex,
}: ReservationResizableDialogProps) {
  if (!open || !reservationId) return null

  return (
    <ReservationDetailPageView
      reservationId={reservationId}
      layout="modal"
      modalLightLoad
      modalStackLevel={modalStackLevel}
      {...(modalZIndex != null ? { modalZIndex } : {})}
      onCancel={() => onOpenChange(false)}
    />
  )
}
