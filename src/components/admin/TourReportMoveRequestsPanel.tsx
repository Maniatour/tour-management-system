'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRightLeft, Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { tourReportText } from '@/lib/tourReportExtras'
import type { TourReportMoveRequestView, TourReportMoveStatus } from '@/lib/tourReportMoveRequests'

function statusLabel(status: TourReportMoveStatus, locale: string): string {
  if (status === 'approved') return tourReportText(locale, '승인됨', 'Approved')
  if (status === 'rejected') return tourReportText(locale, '거부됨', 'Rejected')
  if (status === 'cancelled') return tourReportText(locale, '취소됨', 'Cancelled')
  return tourReportText(locale, '대기중', 'Pending')
}

export default function TourReportMoveRequestsPanel({
  locale,
  compact = false,
}: {
  locale: string
  compact?: boolean
}) {
  const getText = (ko: string, en: string) => tourReportText(locale, ko, en)
  const localeParam = locale.startsWith('en') ? 'en' : 'ko'
  const [status, setStatus] = useState<'pending' | 'all'>('pending')
  const [items, setItems] = useState<TourReportMoveRequestView[]>([])
  const [loading, setLoading] = useState(false)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApiWithAuth(
        `/api/admin/tour-report-move-requests?status=${status}&locale=${localeParam}`
      )
      const json = (await res.json()) as { error?: string; items?: TourReportMoveRequestView[] }
      if (!res.ok) {
        throw new Error(
          json.error || tourReportText(locale, '요청을 불러오지 못했습니다.', 'Could not load requests.')
        )
      }
      setItems(json.items || [])
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : tourReportText(locale, '요청을 불러오지 못했습니다.', 'Could not load requests.')
      )
    } finally {
      setLoading(false)
    }
  }, [status, localeParam, locale])

  useEffect(() => {
    void load()
  }, [load])

  const review = async (id: string, action: 'approve' | 'reject') => {
    const confirmText =
      action === 'approve'
        ? getText('이 리포트를 선택한 투어로 옮기시겠습니까?', 'Approve and move this report?')
        : getText('이 이동 요청을 거부하시겠습니까?', 'Reject this move request?')
    if (!confirm(confirmText)) return
    setWorkingId(id)
    try {
      const res = await fetchApiWithAuth(`/api/admin/tour-report-move-requests/${id}?locale=${localeParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewNote: notes[id] || '' }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || getText('처리에 실패했습니다.', 'Could not update the request.'))
      toast.success(
        action === 'approve'
          ? getText('리포트를 다른 투어로 옮겼습니다.', 'Report moved to the selected tour.')
          : getText('이동 요청을 거부했습니다.', 'Move request rejected.')
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : getText('처리에 실패했습니다.', 'Could not update the request.'))
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={`flex items-center gap-2 font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
            <ArrowRightLeft className="h-4 w-4" />
            {getText('리포트 이동 요청', 'Report move requests')}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            {getText(
              '가이드가 잘못된 투어에 작성한 리포트를 사무실에서 확인하고 옮겨 주세요.',
              'Review guide requests to move a report that was written on the wrong tour.'
            )}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={status === 'pending' ? 'default' : 'outline'}
            className="h-8 rounded-lg"
            onClick={() => setStatus('pending')}
          >
            {getText('대기중', 'Pending')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={status === 'all' ? 'default' : 'outline'}
            className="h-8 rounded-lg"
            onClick={() => setStatus('all')}
          >
            {getText('전체', 'All')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {getText('불러오는 중…', 'Loading…')}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
          {status === 'pending'
            ? getText('대기 중인 이동 요청이 없습니다.', 'No pending move requests.')
            : getText('이동 요청이 없습니다.', 'No move requests.')}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.requestedByName}</p>
                  <p className="text-xs text-gray-500">{item.requestedBy}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    item.status === 'pending'
                      ? 'bg-amber-50 text-amber-800'
                      : item.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {statusLabel(item.status, locale)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-gray-500">{getText('현재', 'From')}</p>
                  <p className="mt-0.5 font-medium text-gray-900">
                    {item.fromTour.tourDate} · {item.fromTour.productName}
                  </p>
                </div>
                <div className="rounded-lg bg-primary/5 px-3 py-2">
                  <p className="text-[11px] font-medium text-primary">{getText('이동할 투어', 'To')}</p>
                  <p className="mt-0.5 font-medium text-gray-900">
                    {item.toTour.tourDate} · {item.toTour.productName}
                  </p>
                </div>
              </div>
              {item.reason ? (
                <p className="mt-3 text-sm text-gray-700">
                  <span className="font-medium">{getText('가이드 메모', 'Guide note')}: </span>
                  {item.reason}
                </p>
              ) : null}
              {item.status === 'pending' ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={notes[item.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    rows={2}
                    className="rounded-xl"
                    placeholder={getText('사무실 메모 (선택)', 'Office note (optional)')}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="h-10 flex-1 rounded-xl"
                      disabled={workingId === item.id}
                      onClick={() => void review(item.id, 'approve')}
                    >
                      {workingId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                      {getText('승인하고 옮기기', 'Approve & move')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 flex-1 rounded-xl text-red-700"
                      disabled={workingId === item.id}
                      onClick={() => void review(item.id, 'reject')}
                    >
                      <X className="mr-1 h-4 w-4" />
                      {getText('거부', 'Reject')}
                    </Button>
                  </div>
                </div>
              ) : item.reviewNote ? (
                <p className="mt-2 text-xs text-gray-500">
                  {getText('사무실 메모', 'Office note')}: {item.reviewNote}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
