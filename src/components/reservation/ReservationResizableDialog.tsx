'use client'

import { ReservationDetailPageView } from '@/components/reservation/ReservationDetailPageView'
import type { DialogStackLevel } from '@/lib/dialogZIndex'

type ReservationResizableDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservationId: string | null
  modalStackLevel?: DialogStackLevel
}

export function ReservationResizableDialog({
  open,
  onOpenChange,
  reservationId,
  modalStackLevel = 'nested',
}: ReservationResizableDialogProps) {
  if (!open || !reservationId) return null

  return (
    <ReservationDetailPageView
      reservationId={reservationId}
      layout="modal"
      modalLightLoad
      modalStackLevel={modalStackLevel}
      onCancel={() => onOpenChange(false)}
    />
  )
}
