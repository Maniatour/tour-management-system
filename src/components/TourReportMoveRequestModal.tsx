'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, Calendar, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { useAuth } from '@/contexts/AuthContext'
import { TOUR_DETAIL_NESTED_PICKER_Z_INDEX } from '@/lib/dialogZIndex'
import { tourReportText } from '@/lib/tourReportExtras'
import type { TourReportMoveCandidate, TourReportMoveTourSummary } from '@/lib/tourReportMoveRequests'

function guideHeaders(isSimulating: boolean, simulatedEmail?: string | null): Record<string, string> {
  if (isSimulating && simulatedEmail) {
    return { 'x-simulated-user-email': simulatedEmail }
  }
  return {}
}

export default function TourReportMoveRequestModal({
  open,
  onClose,
  reportId,
  locale,
  currentLabel,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  reportId: string
  locale: string
  currentLabel?: string
  onSubmitted: () => void
}) {
  const { isSimulating, simulatedUser } = useAuth()
  const getText = (ko: string, en: string) => tourReportText(locale, ko, en)
  const localeParam = locale.startsWith('en') ? 'en' : 'ko'
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [selectedTourId, setSelectedTourId] = useState('')
  const [current, setCurrent] = useState<TourReportMoveTourSummary | null>(null)
  const [candidates, setCandidates] = useState<TourReportMoveCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setDate('')
      setReason('')
      setSelectedTourId('')
      setCurrent(null)
      setCandidates([])
    }
  }, [open])

  const loadCandidates = useCallback(
    async (nextDate: string) => {
      if (!nextDate || !reportId) return
      setLoading(true)
      try {
        const res = await fetchApiWithAuth(
          `/api/guide/tour-report-move-candidates?reportId=${encodeURIComponent(reportId)}&date=${nextDate}&locale=${localeParam}`,
          { headers: guideHeaders(isSimulating, simulatedUser?.email) }
        )
        const json = (await res.json()) as {
          error?: string
          current?: TourReportMoveTourSummary
          candidates?: TourReportMoveCandidate[]
        }
        if (!res.ok) throw new Error(json.error || getText('투어를 불러오지 못했습니다.', 'Could not load tours.'))
        setCurrent(json.current ?? null)
        setCandidates(json.candidates || [])
        setSelectedTourId('')
      } catch (e) {
        setCandidates([])
        toast.error(e instanceof Error ? e.message : getText('투어를 불러오지 못했습니다.', 'Could not load tours.'))
      } finally {
        setLoading(false)
      }
    },
    [reportId, localeParam, isSimulating, simulatedUser?.email, getText]
  )

  const handleSubmit = async () => {
    if (!selectedTourId) {
      toast.error(getText('옮길 투어를 선택해 주세요.', 'Choose the destination tour.'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetchApiWithAuth(`/api/guide/tour-report-move-requests?locale=${localeParam}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...guideHeaders(isSimulating, simulatedUser?.email),
        },
        body: JSON.stringify({ reportId, toTourId: selectedTourId, reason }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || getText('요청에 실패했습니다.', 'Could not submit the request.'))
      toast.success(getText('사무실에 이동 요청을 보냈습니다.', 'Move request sent to the office.'))
      onSubmitted()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : getText('요청에 실패했습니다.', 'Could not submit the request.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        forceZIndex={TOUR_DETAIL_NESTED_PICKER_Z_INDEX}
        hideCloseButton
        overlayClassName="bg-black/50"
        className="flex max-h-[min(90vh,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:rounded-2xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-4 w-4" />
            {getText('다른 투어로 이동 요청', 'Request move to another tour')}
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label={getText('닫기', 'Close')}
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p className="text-sm text-gray-600">
            {getText(
              '잘못된 날짜의 투어에 작성했다면, 실제 투어를 고른 뒤 사무실 승인을 요청하세요. 승인되면 리포트가 그 투어로 옮겨집니다.',
              'If this report was written on the wrong tour, pick the correct one and ask the office to move it.'
            )}
          </p>
          {(currentLabel || current) ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
              <p className="text-xs font-medium text-gray-500">{getText('현재 위치', 'Currently on')}</p>
              <p className="mt-0.5 font-medium text-gray-900">
                {current
                  ? `${current.tourDate} · ${current.productName}`
                  : currentLabel}
              </p>
            </div>
          ) : null}
          <label className="block text-sm font-medium text-gray-800">
            {getText('옮길 투어 날짜', 'Destination date')}
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const next = e.target.value
                setDate(next)
                void loadCandidates(next)
              }}
              className="mt-1.5 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
            />
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {getText('투어를 불러오는 중…', 'Loading tours…')}
            </div>
          ) : date && candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              {getText('그 날짜에 옮길 수 있는 투어가 없습니다.', 'No tours on that date.')}
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((tour) => {
                const disabled = Boolean(tour.blockedReason)
                const selected = selectedTourId === tour.id
                return (
                  <button
                    key={tour.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedTourId(tour.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : disabled
                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tour.productName}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          {tour.tourDate}
                        </p>
                      </div>
                      {tour.assignedRole ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                          {tour.assignedRole === 'assistant'
                            ? getText('어시 배정', 'Assigned assistant')
                            : getText('가이드 배정', 'Assigned guide')}
                        </span>
                      ) : null}
                    </div>
                    {tour.blockedReason === 'same_tour' ? (
                      <p className="mt-1 text-xs text-gray-500">{getText('지금 이 리포트가 있는 투어', 'Current tour')}</p>
                    ) : tour.blockedReason === 'own_report_exists' ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {getText('이미 이 투어에 리포트가 있습니다.', 'You already have a report here.')}
                      </p>
                    ) : tour.blockedReason === 'cancelled' ? (
                      <p className="mt-1 text-xs text-red-600">{getText('취소된 투어', 'Cancelled tour')}</p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
          <label className="block text-sm font-medium text-gray-800">
            {getText('사무실에 전할 메모 (선택)', 'Note for the office (optional)')}
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1.5 rounded-xl"
              placeholder={getText('예: 9월 6일 그랜드캐년 투어에 작성해야 했습니다.', 'Example: This belongs to the Sept 6 Grand Canyon tour.')}
            />
          </label>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={onClose}>
            {getText('닫기', 'Close')}
          </Button>
          <Button
            type="button"
            className="h-11 flex-1 rounded-xl"
            disabled={submitting || !selectedTourId}
            onClick={() => void handleSubmit()}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {getText('사무실에 요청', 'Send to office')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
