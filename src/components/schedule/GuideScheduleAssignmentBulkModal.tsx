'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Loader2, Send, UserCheck, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import { normalizeTourDateKey } from '@/utils/tourUtils'
import { getAssignmentStatusLabel } from '@/lib/guideAssignmentStatus'

type TeamMember = {
  email: string
  name_ko?: string | null
  nick_name?: string | null
  position?: string | null
}

type ScheduleTour = {
  id: string
  tour_date: string | null
  tour_guide_id?: string | null
  assistant_id?: string | null
  product_id?: string | null
  assignment_status?: string | null
  products?: { name?: string | null } | null
}

type BulkTourRow = {
  tourId: string
  tourDate: string
  productLabel: string
  role: 'guide' | 'assistant'
  assignmentStatus: string | null | undefined
}

type GuideScheduleAssignmentBulkModalProps = {
  isOpen: boolean
  onClose: () => void
  locale: string
  teamMembers: TeamMember[]
  tours: ScheduleTour[]
  defaultStartDate?: string
  defaultEndDate?: string
  onSent?: () => void
}

function memberLabel(m: TeamMember): string {
  return m.nick_name || m.name_ko || m.email
}

export default function GuideScheduleAssignmentBulkModal({
  isOpen,
  onClose,
  locale,
  teamMembers,
  tours,
  defaultStartDate,
  defaultEndDate,
  onSent,
}: GuideScheduleAssignmentBulkModalProps) {
  const isKo = locale === 'ko'
  const [selectedEmail, setSelectedEmail] = useState('')
  const [startDate, setStartDate] = useState(defaultStartDate || dayjs().startOf('month').format('YYYY-MM-DD'))
  const [endDate, setEndDate] = useState(defaultEndDate || dayjs().endOf('month').format('YYYY-MM-DD'))
  const [selectedTourIds, setSelectedTourIds] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  const guideMembers = useMemo(
    () =>
      teamMembers.filter((m) => {
        const pos = String(m.position || '').toLowerCase()
        return pos.includes('가이드') || pos.includes('guide') || pos.includes('driver') || pos.includes('드라이버')
      }),
    [teamMembers],
  )

  const rows = useMemo((): BulkTourRow[] => {
    if (!selectedEmail) return []
    const email = selectedEmail.toLowerCase()
    const start = dayjs(startDate)
    const end = dayjs(endDate)
    if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return []

    const result: BulkTourRow[] = []
    for (const tour of tours) {
      const dateKey = normalizeTourDateKey(tour.tour_date)
      if (!dateKey) continue
      const d = dayjs(dateKey)
      if (d.isBefore(start, 'day') || d.isAfter(end, 'day')) continue

      const isGuide = String(tour.tour_guide_id || '').toLowerCase() === email
      const isAssistant = String(tour.assistant_id || '').toLowerCase() === email
      if (!isGuide && !isAssistant) continue

      result.push({
        tourId: tour.id,
        tourDate: dateKey,
        productLabel: tour.products?.name || tour.product_id || tour.id,
        role: isGuide ? 'guide' : 'assistant',
        assignmentStatus: tour.assignment_status,
      })
    }
    return result.sort((a, b) => a.tourDate.localeCompare(b.tourDate))
  }, [selectedEmail, startDate, endDate, tours])

  useEffect(() => {
    if (!isOpen) return
    setStartDate(defaultStartDate || dayjs().startOf('month').format('YYYY-MM-DD'))
    setEndDate(defaultEndDate || dayjs().endOf('month').format('YYYY-MM-DD'))
    setSelectedEmail('')
    setSelectedTourIds(new Set())
    setError(null)
    setProgress('')
  }, [isOpen, defaultStartDate, defaultEndDate])

  useEffect(() => {
    setSelectedTourIds(new Set(rows.map((r) => r.tourId)))
  }, [rows])

  const toggleTour = (tourId: string) => {
    setSelectedTourIds((prev) => {
      const next = new Set(prev)
      if (next.has(tourId)) next.delete(tourId)
      else next.add(tourId)
      return next
    })
  }

  const handleSend = useCallback(async () => {
    if (!selectedEmail || selectedTourIds.size === 0) return
    setSending(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const email = selectedEmail.toLowerCase()
      const targets = rows.filter((r) => selectedTourIds.has(r.tourId))
      let sent = 0
      let failed = 0

      for (const row of targets) {
        setProgress(
          isKo
            ? `${sent + failed + 1}/${targets.length} 발송 중…`
            : `Sending ${sent + failed + 1}/${targets.length}…`,
        )
        const response = await fetchApiWithAuth('/api/guide-schedule-assignment/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tourId: row.tourId,
            locale,
            sentBy: user?.email || null,
            recipientEmails: [email],
          }),
        })
        const data = await response.json()
        if (!response.ok) {
          failed += 1
          console.error('bulk assignment send failed', row.tourId, data.error)
        } else {
          sent += 1
        }
      }

      alert(
        isKo
          ? `발송 완료: ${sent}건${failed > 0 ? `, 실패 ${failed}건` : ''}`
          : `Sent: ${sent}${failed > 0 ? `, failed: ${failed}` : ''}`,
      )
      onSent?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : isKo ? '발송에 실패했습니다.' : 'Send failed.')
    } finally {
      setSending(false)
      setProgress('')
    }
  }, [selectedEmail, selectedTourIds, rows, locale, isKo, onSent, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isKo ? '가이드 스케줄 부여 SMS' : 'Send schedule assignment SMS'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p className="text-xs text-gray-500">
            {isKo
              ? '선택한 투어에 대해 가이드·어시스턴트에게 배정 안내 SMS를 보냅니다. 링크에서 확정/거절할 수 있습니다.'
              : 'Sends assignment SMS with a link to confirm or reject each tour.'}
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              {isKo ? '가이드 / 어시스턴트' : 'Guide / Assistant'}
            </label>
            <select
              value={selectedEmail}
              onChange={(e) => setSelectedEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">{isKo ? '선택…' : 'Select…'}</option>
              {guideMembers.map((m) => (
                <option key={m.email} value={m.email}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {isKo ? '시작일' : 'Start date'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                {isKo ? '종료일' : 'End date'}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {selectedEmail ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">
                  {isKo ? `배정 투어 (${rows.length}건)` : `Assigned tours (${rows.length})`}
                </span>
                {rows.length > 0 ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() =>
                      setSelectedTourIds(
                        selectedTourIds.size === rows.length
                          ? new Set()
                          : new Set(rows.map((r) => r.tourId)),
                      )
                    }
                  >
                    {selectedTourIds.size === rows.length
                      ? isKo ? '전체 해제' : 'Deselect all'
                      : isKo ? '전체 선택' : 'Select all'}
                  </button>
                ) : null}
              </div>
              {rows.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  {isKo ? '해당 기간에 배정된 투어가 없습니다.' : 'No assigned tours in this period.'}
                </p>
              ) : (
                <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
                  {rows.map((row) => (
                    <li key={row.tourId}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedTourIds.has(row.tourId)}
                          onChange={() => toggleTour(row.tourId)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="font-medium tabular-nums">{row.tourDate}</span>
                          <span className="mx-1 text-gray-400">·</span>
                          <span className="text-gray-800">{row.productLabel}</span>
                          <span className="ml-1 text-xs text-gray-500">
                            ({row.role === 'guide' ? (isKo ? '가이드' : 'Guide') : isKo ? '어시' : 'Asst'})
                            {' · '}
                            {getAssignmentStatusLabel(row.assignmentStatus, locale)}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {progress ? <p className="text-xs text-gray-500">{progress}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isKo ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={sending || !selectedEmail || selectedTourIds.size === 0}
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isKo ? 'SMS 발송' : 'Send SMS'}
          </button>
        </div>
      </div>
    </div>
  )
}
