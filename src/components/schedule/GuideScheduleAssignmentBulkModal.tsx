'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Bell, Eye, Loader2, MessageSquare, Send, UserCheck, X } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import { normalizeTourDateKey } from '@/utils/tourUtils'
import { getAssignmentStatusLabel } from '@/lib/guideAssignmentStatus'
import type {
  GuideScheduleAssignmentPreview,
  GuideScheduleAssignmentSendChannels,
} from '@/lib/guideScheduleAssignmentMessage'

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

type TourPreviewSlice = {
  tourId: string
  tourDate: string
  productName: string
  smsBody: string
  pushTitle: string
  pushBody: string
  siteTitle: string
  siteMessageBody: string
  confirmUrl: string
  phone: string | null
  error?: string
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

function sendButtonLabel(channels: GuideScheduleAssignmentSendChannels, isKo: boolean): string {
  if (channels === 'push') return isKo ? '푸시 발송' : 'Send push'
  if (channels === 'both') return isKo ? 'SMS + 푸시 발송' : 'Send SMS + push'
  return isKo ? 'SMS 발송' : 'Send SMS'
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
  const [channels, setChannels] = useState<GuideScheduleAssignmentSendChannels>('both')
  const [sending, setSending] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previews, setPreviews] = useState<TourPreviewSlice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  const needsSms = channels === 'sms' || channels === 'both'
  const needsPush = channels === 'push' || channels === 'both'

  const guideMembers = useMemo(
    () =>
      teamMembers.filter((m) => {
        const pos = String(m.position || '').toLowerCase()
        return pos.includes('가이드') || pos.includes('guide') || pos.includes('driver') || pos.includes('드라이버')
      }),
    [teamMembers],
  )

  const channelOptions = useMemo(
    () =>
      [
        { value: 'sms' as const, label: isKo ? 'SMS만' : 'SMS only', icon: MessageSquare },
        { value: 'push' as const, label: isKo ? '푸시만' : 'Push only', icon: Bell },
        { value: 'both' as const, label: isKo ? 'SMS + 푸시' : 'SMS + push', icon: Send },
      ] as const,
    [isKo],
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
    setChannels('both')
    setPreviews([])
    setError(null)
    setProgress('')
  }, [isOpen, defaultStartDate, defaultEndDate])

  useEffect(() => {
    setSelectedTourIds(new Set(rows.map((r) => r.tourId)))
    setPreviews([])
  }, [rows])

  const toggleTour = (tourId: string) => {
    setSelectedTourIds((prev) => {
      const next = new Set(prev)
      if (next.has(tourId)) next.delete(tourId)
      else next.add(tourId)
      return next
    })
    setPreviews([])
  }

  const loadPreviews = useCallback(async () => {
    if (!selectedEmail || selectedTourIds.size === 0) return
    setPreviewLoading(true)
    setError(null)
    const email = selectedEmail.toLowerCase()
    const targets = rows.filter((r) => selectedTourIds.has(r.tourId))
    const next: TourPreviewSlice[] = []

    try {
      for (let i = 0; i < targets.length; i++) {
        const row = targets[i]!
        setProgress(
          isKo
            ? `미리보기 ${i + 1}/${targets.length}…`
            : `Preview ${i + 1}/${targets.length}…`,
        )
        try {
          const response = await fetchApiWithAuth('/api/guide-schedule-assignment/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tourId: row.tourId, locale }),
          })
          const data = await response.json()
          if (!response.ok) {
            next.push({
              tourId: row.tourId,
              tourDate: row.tourDate,
              productName: row.productLabel,
              smsBody: '',
              pushTitle: '',
              pushBody: '',
              siteTitle: '',
              siteMessageBody: '',
              confirmUrl: '',
              phone: null,
              error: data.error || (isKo ? '미리보기 실패' : 'Preview failed'),
            })
            continue
          }
          const preview = data as GuideScheduleAssignmentPreview
          const recipient = preview.recipients.find((r) => r.email.toLowerCase() === email)
          if (!recipient) {
            next.push({
              tourId: row.tourId,
              tourDate: preview.tourDate || row.tourDate,
              productName: preview.productName || row.productLabel,
              smsBody: '',
              pushTitle: '',
              pushBody: '',
              siteTitle: '',
              siteMessageBody: '',
              confirmUrl: '',
              phone: null,
              error: isKo ? '해당 가이드가 수신자에 없습니다.' : 'Guide not in recipients.',
            })
            continue
          }
          next.push({
            tourId: row.tourId,
            tourDate: preview.tourDate || row.tourDate,
            productName: preview.productName || row.productLabel,
            smsBody: recipient.smsBody,
            pushTitle: recipient.pushTitle,
            pushBody: recipient.pushBody,
            siteTitle: recipient.siteTitle,
            siteMessageBody: recipient.siteMessageBody,
            confirmUrl: recipient.confirmUrl,
            phone: recipient.phone || null,
          })
        } catch (e) {
          next.push({
            tourId: row.tourId,
            tourDate: row.tourDate,
            productName: row.productLabel,
            smsBody: '',
            pushTitle: '',
            pushBody: '',
            siteTitle: '',
            siteMessageBody: '',
            confirmUrl: '',
            phone: null,
            error: e instanceof Error ? e.message : isKo ? '미리보기 실패' : 'Preview failed',
          })
        }
      }
      setPreviews(next)
    } finally {
      setPreviewLoading(false)
      setProgress('')
    }
  }, [selectedEmail, selectedTourIds, rows, locale, isKo])

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
        const previewSlice = previews.find((p) => p.tourId === row.tourId)
        const response = await fetchApiWithAuth('/api/guide-schedule-assignment/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tourId: row.tourId,
            locale,
            channels,
            sentBy: user?.email || null,
            recipientEmails: [email],
            ...(previewSlice && !previewSlice.error
              ? {
                  recipientOverrides: [
                    {
                      email,
                      smsBody: previewSlice.smsBody,
                      pushTitle: previewSlice.pushTitle,
                      pushBody: previewSlice.pushBody,
                    },
                  ],
                }
              : {}),
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
  }, [selectedEmail, selectedTourIds, rows, locale, isKo, channels, previews, onSent, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isKo ? '가이드 스케줄 부여' : 'Send schedule assignment'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <p className="text-xs text-gray-500">
            {isKo
              ? '발송 시 가이드 앱 접속 모달이 항상 등록됩니다. SMS·푸시는 채널에서 선택하고, 발송 전에 내용을 미리볼 수 있습니다.'
              : 'A guide-app modal is always queued. Choose SMS and/or push, and preview content before sending.'}
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

          <div>
            <p className="mb-2 text-xs font-medium text-gray-700">
              {isKo ? '발송 채널' : 'Delivery channel'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {channelOptions.map((opt) => {
                const Icon = opt.icon
                const active = channels === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setChannels(opt.value)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      active
                        ? 'border-violet-500 bg-violet-50 text-violet-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                )
              })}
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
                    onClick={() => {
                      setSelectedTourIds(
                        selectedTourIds.size === rows.length
                          ? new Set()
                          : new Set(rows.map((r) => r.tourId)),
                      )
                      setPreviews([])
                    }}
                  >
                    {selectedTourIds.size === rows.length
                      ? isKo
                        ? '전체 해제'
                        : 'Deselect all'
                      : isKo
                        ? '전체 선택'
                        : 'Select all'}
                  </button>
                ) : null}
              </div>
              {rows.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                  {isKo ? '해당 기간에 배정된 투어가 없습니다.' : 'No assigned tours in this period.'}
                </p>
              ) : (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
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

          {selectedEmail && selectedTourIds.size > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700">
                  {isKo ? '발송 내용 미리보기' : 'Message preview'}
                </span>
                <button
                  type="button"
                  disabled={previewLoading || sending}
                  onClick={() => void loadPreviews()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                >
                  {previewLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {isKo ? '미리보기 불러오기' : 'Load preview'}
                </button>
              </div>

              {previews.length === 0 && !previewLoading ? (
                <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
                  {isKo
                    ? '발송 전에 미리보기를 불러와 SMS·푸시 내용을 확인하세요.'
                    : 'Load preview to review SMS and push content before sending.'}
                </p>
              ) : null}

              {previews.length > 0 ? (
                <ul className="max-h-64 space-y-2 overflow-y-auto">
                  {previews.map((item) => (
                    <li key={item.tourId} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-medium text-gray-900">
                        {item.tourDate} · {item.productName}
                      </p>
                      {item.error ? (
                        <p className="mt-1 text-xs text-red-600">{item.error}</p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {item.confirmUrl ? (
                            <a
                              href={item.confirmUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block break-all text-[11px] text-violet-700 underline"
                            >
                              {item.confirmUrl}
                            </a>
                          ) : null}
                          {item.siteTitle ? (
                            <div className="rounded-md border border-emerald-100 bg-emerald-50/60 p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                {isKo ? '앱 접속 모달' : 'In-app modal'}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">{item.siteTitle}</p>
                              <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
                                {item.siteMessageBody}
                              </pre>
                            </div>
                          ) : null}
                          {needsSms ? (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                SMS
                                {item.phone ? (
                                  <span className="ml-1 font-normal normal-case text-gray-400">
                                    ({item.phone})
                                  </span>
                                ) : (
                                  <span className="ml-1 font-normal normal-case text-red-500">
                                    {isKo ? '(전화번호 없음)' : '(no phone)'}
                                  </span>
                                )}
                              </p>
                              <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs text-gray-800">
                                {item.smsBody}
                              </pre>
                            </div>
                          ) : null}
                          {needsPush ? (
                            <div className="rounded-md border border-sky-100 bg-sky-50/60 p-2">
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                                {isKo ? '앱 푸시' : 'App push'}
                              </p>
                              <p className="text-sm font-semibold text-gray-900">{item.pushTitle}</p>
                              <p className="mt-0.5 text-xs text-gray-700">{item.pushBody}</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {progress ? <p className="text-xs text-gray-500">{progress}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending || previewLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isKo ? '취소' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={sending || previewLoading || !selectedEmail || selectedTourIds.size === 0}
            onClick={() => void handleSend()}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendButtonLabel(channels, isKo)}
          </button>
        </div>
      </div>
    </div>
  )
}
