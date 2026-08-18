'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ResizableDialogContent } from '@/components/ui/ResizableDialogContent'
import { applyNoShowDateChange } from '@/lib/reservationDateChange'
import { isDateChangedReservationStatus } from '@/lib/reservationStatus'
import { normalizeTourDateForDb } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservationId: string
  currentTourDate: string
  reservationStatus?: string | null
  alreadyChanged?: boolean
  onCompleted: (liveReservationId: string) => void | Promise<void>
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export default function NoShowDateChangeModal({
  open,
  onOpenChange,
  reservationId,
  currentTourDate,
  reservationStatus,
  alreadyChanged,
  onCompleted,
}: Props) {
  const locale = useLocale()
  const isKo = locale.startsWith('ko')
  const currentYmd = normalizeTourDateForDb(currentTourDate) || currentTourDate.slice(0, 10)
  const [newDate, setNewDate] = useState(currentYmd ? addDaysYmd(currentYmd, 1) : '')
  const [extra, setExtra] = useState('100')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blockedReason = useMemo(() => {
    if (isDateChangedReservationStatus(reservationStatus)) {
      return isKo
        ? '자리표시(날짜변경) 예약입니다. 실예약을 열어 주세요.'
        : 'This is a placeholder. Open the live booking.'
    }
    if (alreadyChanged) {
      return isKo
        ? '이미 날짜 변경된 예약입니다.'
        : 'This booking was already date-changed.'
    }
    const st = String(reservationStatus ?? '').toLowerCase()
    if (st === 'cancelled' || st === 'canceled' || st === 'deleted') {
      return isKo ? '취소·삭제된 예약은 날짜 변경할 수 없습니다.' : 'Cancelled/deleted bookings cannot be date-changed.'
    }
    return null
  }, [alreadyChanged, isKo, reservationStatus])

  const extraNum = Math.max(0, Number(extra) || 0)

  const handleSubmit = async () => {
    if (blockedReason) return
    setError(null)
    setSubmitting(true)
    try {
      const result = await applyNoShowDateChange({
        liveReservationId: reservationId,
        newTourDate: newDate,
        additionalCostUsd: extraNum,
        note,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      onOpenChange(false)
      await onCompleted(result.liveReservationId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResizableDialogContent
        stackLevel="nested"
        className="max-w-lg"
        storageKey="no-show-date-change-modal"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" />
            {isKo ? '노쇼 날짜 변경' : 'No-show date change'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
            {isKo ? (
              <>
                <p className="font-medium">OTA 날짜 착각 노쇼 → 다음날로 이동할 때 씁니다.</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>이 예약은 새 날짜로 이동하고, GYG RN·입금·투어비는 그대로입니다.</li>
                  <li>원래 날짜에 $0 자리표시가 생기고, 그날 앤텔롭 티켓만 맞춥니다.</li>
                  <li>자리표시는 투어에 배정되지 않아 진행인원에 안 들어갑니다.</li>
                  <li>다음날 앤텔롭 티켓과 고객 추가 입금은 저장 후 수동입니다.</li>
                </ul>
              </>
            ) : (
              <>
                <p className="font-medium">Use for an OTA wrong-date no-show moved to the next day.</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>This booking moves; GYG RN, payments, and tour fare stay here.</li>
                  <li>A $0 placeholder is created on the original date for Antelope tickets.</li>
                  <li>The placeholder is not assigned to a tour, so it is not in headcount.</li>
                  <li>Book next-day tickets and record the extra payment after save.</li>
                </ul>
              </>
            )}
          </div>

          {blockedReason ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {blockedReason}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-gray-700">
                  {isKo ? '현재 투어일' : 'Current tour date'}
                  <input
                    readOnly
                    value={currentYmd}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-600"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  {isKo ? '옮길 투어일' : 'New tour date'}
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-700">
                {isKo ? '고객 추가 청구 ($)' : 'Extra charge to guest ($)'}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                />
                <span className="mt-1 block font-normal text-gray-500">
                  {isKo
                    ? '입장권 또는 processing fee만. GYG 정산 금액은 바뀌지 않습니다. 0원도 가능합니다.'
                    : 'Entrance or processing fee only. GYG settlement stays the same. $0 is allowed.'}
                </span>
              </label>
              <label className="block text-xs font-medium text-gray-700">
                {isKo ? '메모 (선택)' : 'Note (optional)'}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
                  placeholder={isKo ? '예: 15일 노쇼, 입장권 $100만 추가' : 'e.g. Wrong date; $100 entrance only'}
                />
              </label>
              <p className="text-xs text-gray-600">
                {isKo
                  ? `확인 시 이 예약은 ${newDate || '—'}로 이동하고, ${currentYmd}에 $0 자리표시가 생깁니다. 추가 청구 $${extraNum.toFixed(2)}.`
                  : `On confirm this booking moves to ${newDate || '—'} and a $0 placeholder is created on ${currentYmd}. Extra $${extraNum.toFixed(2)}.`}
              </p>
            </>
          )}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {isKo ? '닫기' : 'Close'}
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !!blockedReason}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isKo ? '날짜 변경 확인' : 'Confirm date change'}
          </Button>
        </DialogFooter>
      </ResizableDialogContent>
    </Dialog>
  )
}
