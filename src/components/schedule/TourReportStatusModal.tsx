'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Send,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { defaultTourReportStatusRange } from '@/lib/tourReportMissing'
import type { TourReportStatusPayload } from '@/lib/tourReportMissing'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import TourReportList from '@/components/TourReportList'

type Tab = 'missing' | 'submitted'

type RemindResult = {
  email: string
  name: string
  tourCount: number
  emailStatus: string
  smsStatus: string
  pushStatus: string
  emailError?: string
  smsError?: string
  pushError?: string
}

function targetKey(tourId: string, email: string) {
  return `${tourId}:${email}`
}

function formatWhen(value: string | null, locale: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'ko-KR', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function roleLabel(role: string, isEn: boolean): string {
  if (role === 'assistant') return isEn ? 'Assistant' : '어시'
  if (role === 'guide') return isEn ? 'Guide' : '가이드'
  return isEn ? 'Staff' : '기타'
}

export default function TourReportStatusModal({
  isOpen,
  onClose,
  locale = 'ko',
  onOpenTourDetail,
}: {
  isOpen: boolean
  onClose: () => void
  locale?: string
  onOpenTourDetail?: (tourId: string, reportId?: string) => void
}) {
  const { operatorId } = useOperatorOptional()
  const isEn = locale === 'en'
  const fallback = defaultTourReportStatusRange()
  const [rangeStart, setRangeStart] = useState(fallback.from)
  const [rangeEnd, setRangeEnd] = useState(fallback.to)
  const [tab, setTab] = useState<Tab>('missing')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [payload, setPayload] = useState<TourReportStatusPayload | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [channels, setChannels] = useState({ email: true, sms: true, push: true })
  const [sendResults, setSendResults] = useState<RemindResult[] | null>(null)
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [highlightReportId, setHighlightReportId] = useState<string | null>(null)

  const missingTours = useMemo(
    () => (payload?.tours || []).filter((tour) => tour.missingStaff.length > 0),
    [payload]
  )
  const allMissingKeys = useMemo(
    () =>
      missingTours.flatMap((tour) =>
        tour.missingStaff.map((person) => targetKey(tour.tourId, person.email))
      ),
    [missingTours]
  )
  const selectedCount = selected.size
  const selectedPeople = useMemo(() => {
      const emails = new Set(
        [...selected].map((key) => {
          const idx = key.indexOf(':')
          return idx >= 0 ? key.slice(idx + 1) : key
        })
      )
    return emails.size
  }, [selected])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: rangeStart,
        to: rangeEnd,
        locale: isEn ? 'en' : 'ko',
        operatorId: resolveOperatorId(operatorId),
      })
      const res = await fetchApiWithAuth(`/api/admin/tour-reports/status?${params}`)
      const json = (await res.json()) as TourReportStatusPayload & { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setPayload(json)
      const next = new Set(
        (json.tours || [])
          .filter((tour) => tour.missingStaff.length > 0)
          .flatMap((tour) =>
            tour.missingStaff.map((person) => targetKey(tour.tourId, person.email))
          )
      )
      setSelected(next)
    } catch (e) {
      console.error('TourReportStatusModal', e)
      toast.error(isEn ? 'Could not load tour reports.' : '투어 리포트를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [rangeStart, rangeEnd, isEn, operatorId])

  useEffect(() => {
    if (!isOpen) return
    const range = defaultTourReportStatusRange()
    setRangeStart(range.from)
    setRangeEnd(range.to)
    setTab('missing')
    setSendResults(null)
    setExpandedTourId(null)
    setHighlightReportId(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    void load()
  }, [isOpen, load])

  const toggleAll = () => {
    if (selected.size === allMissingKeys.length) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(allMissingKeys))
  }

  const handleSend = async () => {
    if (selectedCount === 0) {
      toast.error(isEn ? 'Select at least one guide.' : '알림을 보낼 대상을 선택해 주세요.')
      return
    }
    if (!channels.email && !channels.sms && !channels.push) {
      toast.error(isEn ? 'Select a channel.' : '이메일, 문자, 앱 알림 중 하나 이상 선택해 주세요.')
      return
    }
    setSending(true)
    setSendResults(null)
    try {
      const targets = [...selected].map((key) => {
        const idx = key.indexOf(':')
        return { tourId: key.slice(0, idx), email: key.slice(idx + 1) }
      })
      const res = await fetchApiWithAuth('/api/admin/tour-reports/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: rangeStart,
          to: rangeEnd,
          operatorId: resolveOperatorId(operatorId),
          locale: isEn ? 'en' : 'ko',
          channels,
          targets,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        recipientCount?: number
        emailSent?: number
        smsSent?: number
        pushSent?: number
        results?: RemindResult[]
      }
      if (!res.ok) throw new Error(json.error || 'Send failed')
      setSendResults(json.results || [])
      toast.success(
        isEn
          ? `Reminder sent to ${json.recipientCount ?? selectedPeople} guide(s).`
          : `${json.recipientCount ?? selectedPeople}명에게 알림을 보냈습니다.`
      )
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isEn
            ? 'Could not send reminders.'
            : '알림 발송에 실패했습니다.'
      )
    } finally {
      setSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-report-status-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2
              id="tour-report-status-title"
              className="flex items-center gap-2 text-lg font-semibold text-gray-900"
            >
              <FileText className="h-5 w-5 text-amber-600" />
              {isEn ? 'Tour reports' : '투어 리포트'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {isEn
                ? 'Tour reports are required from September 1. Remind guides who have not submitted.'
                : '9월 1일부터 투어 리포트 제출이 필수입니다. 미작성 가이드에게 제출을 요청할 수 있습니다.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <label className="text-gray-500">
                {isEn ? 'From' : '시작'}
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="ml-1.5 rounded-md border border-gray-200 px-2 py-1 text-gray-800"
                />
              </label>
              <label className="text-gray-500">
                {isEn ? 'To' : '종료'}
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="ml-1.5 rounded-md border border-gray-200 px-2 py-1 text-gray-800"
                />
              </label>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-5 pt-2">
          <button
            type="button"
            onClick={() => setTab('missing')}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === 'missing'
                ? 'bg-amber-50 text-amber-900'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {isEn ? 'Missing' : '미작성'}
            {payload ? ` (${payload.missingTourCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setTab('submitted')}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === 'submitted'
                ? 'bg-emerald-50 text-emerald-900'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {isEn ? 'Submitted' : '제출됨'}
            {payload ? ` (${payload.submittedReportCount})` : ''}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !payload ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEn ? 'Loading…' : '불러오는 중…'}
            </div>
          ) : tab === 'missing' ? (
            missingTours.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                {isEn
                  ? 'All assigned tours in this range have reports.'
                  : '이 기간의 배정 투어는 모두 리포트가 제출되었습니다.'}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allMissingKeys.length > 0 && selected.size === allMissingKeys.length}
                      onChange={toggleAll}
                    />
                    {isEn ? 'Select all missing' : '미작성 전체 선택'}
                  </label>
                  <span>
                    {isEn
                      ? `${selectedPeople} guide(s) · ${selectedCount} tour assignment(s)`
                      : `${selectedPeople}명 · ${selectedCount}건`}
                  </span>
                </div>
                {missingTours.map((tour) => (
                  <section
                    key={tour.tourId}
                    className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">
                        {tour.tourDate} · {tour.productName}
                      </p>
                      {onOpenTourDetail ? (
                        <button
                          type="button"
                          onClick={() => onOpenTourDetail(tour.tourId)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {isEn ? 'Tour' : '투어 상세'}
                        </button>
                      ) : null}
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {tour.staff.map((person) => {
                        const key = targetKey(tour.tourId, person.email)
                        return (
                          <li
                            key={key}
                            className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm ring-1 ring-border/60"
                          >
                            <label className="flex min-w-0 flex-1 items-center gap-2">
                              {!person.hasReport ? (
                                <input
                                  type="checkbox"
                                  checked={selected.has(key)}
                                  onChange={() => {
                                    setSelected((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })
                                  }}
                                />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              )}
                              <span className="truncate">
                                {person.name}
                                <span className="ml-1 text-xs text-gray-500">
                                  ({roleLabel(person.role, isEn)})
                                </span>
                              </span>
                            </label>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {person.hasReport ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedTourId(tour.tourId)
                                    setHighlightReportId(person.reportId)
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  {isEn ? 'View' : '보기'}
                                </button>
                              ) : (
                                <span className="text-xs font-medium text-amber-800">
                                  {isEn ? 'Missing' : '미작성'}
                                </span>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    {expandedTourId === tour.tourId ? (
                      <div className="mt-3 rounded-lg border border-border bg-white p-2">
                        <TourReportList
                          tourId={tour.tourId}
                          showTourInfo={false}
                          locale={locale}
                          highlightReportId={highlightReportId}
                        />
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            )
          ) : (payload?.submitted || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              {isEn ? 'No reports submitted in this range yet.' : '이 기간에 제출된 리포트가 없습니다.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {(payload?.submitted || []).map((row) => {
                const open = expandedTourId === row.tourId && highlightReportId === row.id
                return (
                  <li
                    key={row.id}
                    className="overflow-hidden rounded-lg border border-emerald-200/80 bg-emerald-50/40"
                  >
                    <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (open) {
                            setExpandedTourId(null)
                            setHighlightReportId(null)
                            return
                          }
                          setExpandedTourId(row.tourId)
                          setHighlightReportId(row.id)
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="font-medium text-gray-900">
                          {row.tourDate} · {row.productName}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-600">
                          {row.userName} ({roleLabel(row.role, isEn)}) · {formatWhen(row.submittedOn, locale)}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        {onOpenTourDetail ? (
                          <button
                            type="button"
                            onClick={() => onOpenTourDetail(row.tourId, row.id)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white"
                            title={isEn ? 'Open tour detail' : '투어 상세에서 보기'}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {isEn ? 'Tour' : '투어 상세'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            if (open) {
                              setExpandedTourId(null)
                              setHighlightReportId(null)
                              return
                            }
                            setExpandedTourId(row.tourId)
                            setHighlightReportId(row.id)
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-white"
                        >
                          <ChevronDown className={`h-3.5 w-3.5 ${open ? 'rotate-180' : ''}`} />
                          {isEn ? 'View' : '내용 보기'}
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <div className="border-t border-emerald-100 bg-white p-2">
                        <TourReportList
                          tourId={row.tourId}
                          showTourInfo={false}
                          locale={locale}
                          highlightReportId={row.id}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          {sendResults && sendResults.length > 0 ? (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="mb-2 font-medium text-gray-800">
                {isEn ? 'Send results' : '발송 결과'}
              </p>
              <ul className="space-y-1">
                {sendResults.map((row) => (
                  <li key={row.email} className="text-gray-700">
                    {row.name}: {isEn ? 'email' : '이메일'} {row.emailStatus}
                    {row.emailError ? ` (${row.emailError})` : ''} · SMS {row.smsStatus}
                    {row.smsError ? ` (${row.smsError})` : ''} ·{' '}
                    {isEn ? 'app' : '앱'} {row.pushStatus}
                    {row.pushError ? ` (${row.pushError})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={channels.email}
                onChange={(e) => setChannels((prev) => ({ ...prev, email: e.target.checked }))}
              />
              <Mail className="h-4 w-4" />
              {isEn ? 'Email' : '이메일'}
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={channels.sms}
                onChange={(e) => setChannels((prev) => ({ ...prev, sms: e.target.checked }))}
              />
              <MessageSquare className="h-4 w-4" />
              {isEn ? 'SMS' : '문자'}
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={channels.push}
                onChange={(e) => setChannels((prev) => ({ ...prev, push: e.target.checked }))}
              />
              <Bell className="h-4 w-4" />
              {isEn ? 'App' : '앱 알림'}
            </label>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {isEn ? 'Close' : '닫기'}
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending || selectedCount === 0 || tab !== 'missing'}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isEn ? 'Send reminder' : '제출 요청 보내기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
