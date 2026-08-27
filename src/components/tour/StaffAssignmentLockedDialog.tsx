'use client'

import { Pin } from 'lucide-react'
import {
  getStaffAssignmentLockWarningCopy,
  type StaffAssignmentLockBlock,
} from '@/lib/staffAssignmentLock'
import { TOUR_DETAIL_NESTED_PICKER_Z_INDEX } from '@/lib/dialogZIndex'

type StaffAssignmentLockedDialogProps = {
  open: boolean
  block: StaffAssignmentLockBlock | null
  locale: string
  onClose: () => void
}

export function StaffAssignmentLockedDialog({
  open,
  block,
  locale,
  onClose,
}: StaffAssignmentLockedDialogProps) {
  if (!open || !block) return null

  const copy = getStaffAssignmentLockWarningCopy(block, locale)

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: TOUR_DETAIL_NESTED_PICKER_Z_INDEX }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-assignment-lock-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Pin className="h-5 w-5 fill-current" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 id="staff-assignment-lock-title" className="text-lg font-semibold text-amber-950">
              {copy.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-amber-900/90">{copy.message}</p>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {copy.confirm}
          </button>
        </div>
      </div>
    </div>
  )
}
