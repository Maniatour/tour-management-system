'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import {
  TICKET_BOOKING_AXIS_SELECT_ORDER,
  formatTicketBookingAxisLabel,
  type TicketBookingAxisKind,
} from '@/lib/ticketBookingAxisLabels'
import {
  applyTicketBookingSetAxes,
  type TicketBookingAxisPatch,
  type TicketBookingAxisSnapshot,
} from '@/lib/ticketBookingActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const ROW_DEF: {
  field: keyof TicketBookingAxisPatch
  axis: TicketBookingAxisKind
  labelKey: 'axisBooking' | 'axisVendor' | 'axisChange' | 'axisPayment' | 'axisRefund' | 'axisOperation'
}[] = [
  { field: 'booking_status', axis: 'booking', labelKey: 'axisBooking' },
  { field: 'vendor_status', axis: 'vendor', labelKey: 'axisVendor' },
  { field: 'change_status', axis: 'change', labelKey: 'axisChange' },
  { field: 'payment_status', axis: 'payment', labelKey: 'axisPayment' },
  { field: 'refund_status', axis: 'refund', labelKey: 'axisRefund' },
  { field: 'operation_status', axis: 'operation', labelKey: 'axisOperation' },
]

export function normalizeTicketBookingAxisPatchFromSnapshot(
  s: TicketBookingAxisSnapshot
): TicketBookingAxisPatch {
  return {
    booking_status: (s.booking_status ?? 'requested').trim().toLowerCase() || 'requested',
    vendor_status: (s.vendor_status ?? 'pending').trim().toLowerCase() || 'pending',
    change_status: (s.change_status ?? 'none').trim().toLowerCase() || 'none',
    payment_status: (s.payment_status ?? 'not_due').trim().toLowerCase() || 'not_due',
    refund_status: (s.refund_status ?? 'none').trim().toLowerCase() || 'none',
    operation_status: (s.operation_status ?? 'none').trim().toLowerCase() || 'none',
  }
}

const selectClass =
  'mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500'

type FormProps = {
  bookingId: string
  initial: TicketBookingAxisSnapshot
  onSaved: () => void
  disabled?: boolean
  /** 내장 여백·제목 생략 (상세 모달 안쪽용) */
  embedded?: boolean
}

export function TicketBookingAxesEditorForm({
  bookingId,
  initial,
  onSaved,
  disabled = false,
  embedded = false,
}: FormProps) {
  const { user } = useAuth()
  const tAct = useTranslations('booking.calendar.ticketBookingActions')
  const tAxis = useTranslations('booking.calendar.ticketBookingAxis')
  const [patch, setPatch] = useState<TicketBookingAxisPatch>(() =>
    normalizeTicketBookingAxisPatchFromSnapshot(initial)
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    setPatch(normalizeTicketBookingAxisPatchFromSnapshot(initial))
    setErr(null)
  }, [initial, bookingId])

  const onChange = useCallback((field: keyof TicketBookingAxisPatch, value: string) => {
    setPatch((p) => ({ ...p, [field]: value }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await applyTicketBookingSetAxes(bookingId, patch, user?.email ?? null)
      if (!res.ok) {
        setErr(res.error ?? tAct('unknownError'))
        return
      }
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className={embedded ? 'space-y-3' : 'space-y-4'}>
      {!embedded ?
        <p className="text-xs text-gray-600">{tAct('axesEditorHint')}</p>
      : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ROW_DEF.map(({ field, axis, labelKey }) => (
          <div key={field}>
            <label className="block text-xs font-medium text-gray-700">{tAct(labelKey)}</label>
            <select
              className={selectClass}
              value={patch[field]}
              disabled={disabled || busy}
              onChange={(ev) => onChange(field, ev.target.value)}
            >
              {TICKET_BOOKING_AXIS_SELECT_ORDER[axis].map((v) => (
                <option key={v} value={v}>
                  {formatTicketBookingAxisLabel(tAxis, axis, v)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {err ?
        <p className="text-sm text-red-600">{err}</p>
      : null}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={disabled || busy} size="sm">
          {busy ? tAct('axesEditorSaving') : tAct('axesEditorSave')}
        </Button>
      </div>
    </form>
  )
}

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  initial: TicketBookingAxisSnapshot
  onSaved: () => void
}

export function TicketBookingAxesEditorDialog({
  open,
  onOpenChange,
  bookingId,
  initial,
  onSaved,
}: DialogProps) {
  const tAct = useTranslations('booking.calendar.ticketBookingActions')

  const handleSaved = () => {
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tAct('axesEditorTitle')}</DialogTitle>
        </DialogHeader>
        <TicketBookingAxesEditorForm
          bookingId={bookingId}
          initial={initial}
          onSaved={handleSaved}
          embedded={false}
        />
      </DialogContent>
    </Dialog>
  )
}
