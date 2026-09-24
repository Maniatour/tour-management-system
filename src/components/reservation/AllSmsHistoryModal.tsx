'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  X,
  XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import { supabase } from '@/lib/supabase'
import { ADMIN_SMS_CATEGORIES } from '@/lib/adminSmsTemplateCatalog'
import { resolveAdminSmsCategoryLabel } from '@/lib/adminSmsCategorySettings'
import { useAdminSmsCategorySettings } from '@/hooks/useAdminSmsCategorySettings'
import { ScheduleTooltipZIndexContext } from '@/components/schedule/ScheduleHoverTooltip'
import SmsFailureHover from '@/components/reservation/SmsFailureHover'
import { childModalZIndex, DIALOG_Z_INDEX } from '@/lib/dialogZIndex'
import { RESERVATION_CARD_SMS_CATEGORY_IDS } from '@/lib/reservationOutboundSmsCategories'
import type { ReservationOutboundSmsCategoryId } from '@/lib/reservationOutboundSmsCategories'
import {
  resolveSmsLogDeliveryState,
  smsDeliveryStateBadgeClasses,
  smsDeliveryStateLabel,
} from '@/lib/smsLogDeliveryState'

const ReservationResizableDialog = dynamic(
  () =>
    import('@/components/reservation/ReservationResizableDialog').then(
      (m) => m.ReservationResizableDialog
    ),
  { ssr: false, loading: () => null }
)

const PAGE_SIZE = 40

function visiblePageNumbers(current: number, totalPages: number): number[] {
  const width = 5
  let start = Math.max(1, current - Math.floor(width / 2))
  const end = Math.min(totalPages, start + width - 1)
  start = Math.max(1, end - width + 1)
  const pages: number[] = []
  for (let page = start; page <= end; page += 1) pages.push(page)
  return pages
}

type HistoryTab = 'all' | ReservationOutboundSmsCategoryId

type SmsLogRow = {
  id: string
  reservation_id: string
  category_id: string
  to_phone: string
  message_body: string
  locale: string
  status: string
  created_at: string
  error_message?: string | null
  sent_by?: string | null
  delivered_at?: string | null
  failed_at?: string | null
  failure_reason?: string | null
  twilio_status?: string | null
}

type HistoryItem = SmsLogRow & {
  customerName: string | null
  channelRn: string | null
  tourDate: string | null
  sentByName: string | null
}

function quoteIlike(term: string): string {
  const pattern = `%${term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
  return `"${pattern.replace(/"/g, '""')}"`
}

function formatWhen(raw: string, locale: 'ko' | 'en'): string {
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function findReservationIdsForSearch(term: string): Promise<string[]> {
  const quoted = quoteIlike(term)
  const { data: customers } = await supabase
    .from('customers')
    .select('id')
    .or(`name.ilike.${quoted},phone.ilike.${quoted},email.ilike.${quoted}`)
    .limit(80)

  const customerIds = (customers || [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id))

  const reservationOr = [`channel_rn.ilike.${quoted}`]
  if (customerIds.length > 0) {
    reservationOr.push(`customer_id.in.(${customerIds.join(',')})`)
  }

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id')
    .or(reservationOr.join(','))
    .limit(200)

  return (reservations || [])
    .map((row) => (row as { id?: string }).id)
    .filter((id): id is string => Boolean(id))
}

async function enrichLogs(logs: SmsLogRow[]): Promise<HistoryItem[]> {
  const reservationIds = [...new Set(logs.map((log) => log.reservation_id).filter(Boolean))]
  const senderEmails = [
    ...new Set(logs.map((log) => log.sent_by).filter((email): email is string => Boolean(email))),
  ]

  const reservationMap = new Map<
    string,
    { customer_id: string | null; channel_rn: string | null; tour_date: string | null }
  >()
  if (reservationIds.length > 0) {
    const { data } = await supabase
      .from('reservations')
      .select('id, customer_id, channel_rn, tour_date')
      .in('id', reservationIds)
    for (const row of data || []) {
      const typed = row as {
        id: string
        customer_id?: string | null
        channel_rn?: string | null
        tour_date?: string | null
      }
      reservationMap.set(typed.id, {
        customer_id: typed.customer_id ?? null,
        channel_rn: typed.channel_rn ?? null,
        tour_date: typed.tour_date ?? null,
      })
    }
  }

  const customerIds = [
    ...new Set(
      [...reservationMap.values()]
        .map((row) => row.customer_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const customerNames = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data } = await supabase.from('customers').select('id, name').in('id', customerIds)
    for (const row of data || []) {
      const typed = row as { id: string; name?: string | null }
      if (typed.name?.trim()) customerNames.set(typed.id, typed.name.trim())
    }
  }

  const senderNames = new Map<string, string>()
  if (senderEmails.length > 0) {
    const { data } = await supabase
      .from('team')
      .select('email, name_ko, name_en')
      .in('email', senderEmails)
    for (const row of data || []) {
      const typed = row as { email: string; name_ko?: string | null; name_en?: string | null }
      const name = typed.name_ko?.trim() || typed.name_en?.trim()
      if (name) senderNames.set(typed.email, name)
    }
  }

  return logs.map((log) => {
    const reservation = reservationMap.get(log.reservation_id)
    const customerId = reservation?.customer_id
    return {
      ...log,
      customerName: customerId ? customerNames.get(customerId) ?? null : null,
      channelRn: reservation?.channel_rn?.trim() || null,
      tourDate: reservation?.tour_date ?? null,
      sentByName: log.sent_by ? senderNames.get(log.sent_by) || log.sent_by : null,
    }
  })
}

export default function AllSmsHistoryModal({
  open,
  onClose,
  uiLocale = 'ko',
}: {
  open: boolean
  onClose: () => void
  uiLocale?: 'ko' | 'en'
}) {
  const isEn = uiLocale === 'en'
  const { user } = useAuth()
  const { settings } = useAdminSmsCategorySettings({ enabled: open })
  const [tab, setTab] = useState<HistoryTab>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailReservationId, setDetailReservationId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const filterKey = `${tab}\0${debouncedQuery}`
  const appliedFilterKeyRef = useRef(filterKey)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const load = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      setError(null)
      try {
        const term = debouncedQuery.trim()
        const searching = term.length >= 2
        const reservationIds = searching ? await findReservationIdsForSearch(term) : []

        let request = (supabase as any)
          .from('pre_tour_contact_sms_logs')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })

        if (tab !== 'all') request = request.eq('category_id', tab)
        if (searching) {
          const quoted = quoteIlike(term)
          const parts = [
            `to_phone.ilike.${quoted}`,
            `message_body.ilike.${quoted}`,
            `sent_by.ilike.${quoted}`,
          ]
          if (reservationIds.length > 0) {
            parts.push(`reservation_id.in.(${reservationIds.join(',')})`)
          }
          request = request.or(parts.join(','))
        }

        const offset = Math.max(0, (pageNum - 1) * PAGE_SIZE)
        const { data, error: queryError, count } = await request.range(offset, offset + PAGE_SIZE - 1)
        if (queryError) throw queryError

        const next = await enrichLogs((data || []) as SmsLogRow[])
        setItems(next)
        setTotal(typeof count === 'number' ? count : null)
      } catch (err) {
        console.error('SMS 전체 내역 조회 오류:', err)
        setError(isEn ? 'Could not load SMS history.' : 'SMS 내역을 불러오지 못했습니다.')
        setItems([])
      } finally {
        setLoading(false)
      }
    },
    [debouncedQuery, isEn, tab]
  )

  useEffect(() => {
    if (!open) return
    if (appliedFilterKeyRef.current !== filterKey) {
      appliedFilterKeyRef.current = filterKey
      if (page !== 1) {
        setPage(1)
        return
      }
    }
    void load(page)
  }, [open, filterKey, page, load])

  const resendFailed = async (item: HistoryItem, categoryId: ReservationOutboundSmsCategoryId) => {
    const guest = item.customerName || item.to_phone
    const confirmed = window.confirm(
      isEn
        ? `Resend this failed SMS to ${guest}?`
        : `${guest}에게 실패한 문자를 다시 보낼까요?`
    )
    if (!confirmed) return

    setResendingId(item.id)
    setResendNotice(null)
    try {
      const res = await fetchApiWithAuth('/api/send-reservation-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: item.reservation_id,
          categoryId,
          locale: item.locale,
          sentBy: user?.email ?? null,
        }),
      })
      const data = (await res.json()) as { error?: string; details?: string }
      if (!res.ok) {
        const message = data.details
          ? `${data.error || (isEn ? 'Send failed.' : '다시 보내지 못했습니다.')}: ${data.details}`
          : data.error || (isEn ? 'Send failed.' : '다시 보내지 못했습니다.')
        setResendNotice(message)
        return
      }
      setResendNotice(isEn ? 'The SMS was sent again.' : '문자를 다시 보냈습니다. 최신 목록에 표시됩니다.')
      if (page !== 1) setPage(1)
      else await load(1)
    } catch {
      setResendNotice(isEn ? 'Send failed.' : '다시 보내지 못했습니다.')
    } finally {
      setResendingId(null)
    }
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (detailReservationId) {
        setDetailReservationId(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, onClose, detailReservationId])

  if (!open || !mounted) return null

  const tabs: { id: HistoryTab; label: string }[] = [
    { id: 'all', label: isEn ? 'All' : '전체' },
    ...RESERVATION_CARD_SMS_CATEGORY_IDS.map((id) => ({
      id,
      label: resolveAdminSmsCategoryLabel(
        id,
        settings,
        uiLocale,
        ADMIN_SMS_CATEGORIES.find((category) => category.id === id)
      ),
    })),
  ]

  const pageCount = total != null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1
  const summary =
    total != null
      ? isEn
        ? `${total} messages · page ${page} of ${pageCount}`
        : `전체 ${total}건 · ${page} / ${pageCount}페이지`
      : isEn
        ? `Showing ${items.length}`
        : `${items.length}건 표시`

  return createPortal(
    <ScheduleTooltipZIndexContext.Provider value={DIALOG_Z_INDEX.elevated + 40}>
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: DIALOG_Z_INDEX.elevated }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (detailReservationId) return
        onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'SMS send history' : 'SMS 발송 내역'}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
              <Smartphone className="h-5 w-5 text-violet-600" aria-hidden />
              {isEn ? 'SMS send history' : 'SMS 발송 내역'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEn
                ? 'Every reservation SMS, searchable by guest, phone, channel RN, or message.'
                : '예약 카드에서 보낸 SMS를 손님, 전화, 채널 RN, 메시지로 찾아볼 수 있습니다.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={isEn ? 'Close' : '닫기'}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((option) => {
              const active = tab === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTab(option.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                isEn
                  ? 'Name, phone, channel RN, message'
                  : '이름, 전화, 채널 RN, 메시지'
              }
              aria-label={isEn ? 'Search SMS history' : 'SMS 내역 검색'}
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none ring-violet-600/30 placeholder:text-muted-foreground focus:ring-2"
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {loading ? (isEn ? 'Loading…' : '불러오는 중…') : summary}
            </p>
            <button
              type="button"
              onClick={() => void load(page)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              {isEn ? 'Refresh' : '새로고침'}
            </button>
          </div>

          {error ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void load(page)}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                {isEn ? 'Retry' : '다시 시도'}
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {isEn ? 'Loading SMS history…' : 'SMS 내역을 불러오는 중…'}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Smartphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" aria-hidden />
              {debouncedQuery.trim().length >= 2
                ? isEn
                  ? 'No SMS matches that name, phone, channel RN, or message.'
                  : '이름, 전화, 채널 RN, 메시지로 찾은 SMS가 없습니다.'
                : isEn
                  ? 'No SMS in this category yet.'
                  : '이 분류의 SMS가 없습니다.'}
            </div>
          ) : (
            <ul className="max-h-[min(60vh,34rem)] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => {
                const deliveryState = resolveSmsLogDeliveryState(item)
                const expanded = expandedId === item.id
                const categoryId = RESERVATION_CARD_SMS_CATEGORY_IDS.includes(
                  item.category_id as ReservationOutboundSmsCategoryId
                )
                  ? (item.category_id as ReservationOutboundSmsCategoryId)
                  : null
                const categoryLabel = categoryId
                  ? resolveAdminSmsCategoryLabel(
                      categoryId,
                      settings,
                      uiLocale,
                      ADMIN_SMS_CATEGORIES.find((category) => category.id === categoryId)
                    )
                  : item.category_id || (isEn ? 'SMS' : '문자')
                return (
                  <li key={item.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {deliveryState === 'failed' ? (
                        <XCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                      ) : deliveryState === 'delivered' ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
                      ) : (
                        <Send className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      )}
                      <span className="text-sm font-semibold text-foreground">{categoryLabel}</span>
                      {deliveryState === 'failed' ? (
                        <SmsFailureHover
                          raw={item.failure_reason || item.error_message}
                          locale={uiLocale}
                        >
                          <span
                            className={`inline-flex cursor-help rounded-full px-2 py-0.5 text-[11px] font-medium ${smsDeliveryStateBadgeClasses(deliveryState)}`}
                          >
                            {smsDeliveryStateLabel(deliveryState, uiLocale)}
                          </span>
                        </SmsFailureHover>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${smsDeliveryStateBadgeClasses(deliveryState)}`}
                        >
                          {smsDeliveryStateLabel(deliveryState, uiLocale)}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {formatWhen(item.created_at, uiLocale)}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm text-foreground">
                      {item.customerName || (isEn ? 'Guest' : '손님')}
                      {item.channelRn ? ` · RN ${item.channelRn}` : ''}
                      {item.tourDate ? ` · ${item.tourDate}` : ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{item.to_phone}</p>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className={`mt-2 w-full rounded-lg bg-muted/50 px-3 py-2 text-left text-sm text-foreground ${
                        expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'
                      }`}
                    >
                      {item.message_body}
                    </button>
                    {item.sentByName ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {isEn ? 'Sent by' : '발송자'}: {item.sentByName}
                      </p>
                    ) : null}
                    {(item.failure_reason || item.error_message) && deliveryState === 'failed' ? (
                      <SmsFailureHover
                        raw={item.failure_reason || item.error_message}
                        locale={uiLocale}
                      >
                        <p className="mt-2 flex cursor-help items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{item.failure_reason || item.error_message}</span>
                        </p>
                      </SmsFailureHover>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {deliveryState === 'failed' && categoryId ? (
                        <button
                          type="button"
                          disabled={resendingId === item.id}
                          onClick={() => void resendFailed(item, categoryId)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {resendingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Send className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {isEn ? 'Resend' : '다시 보내기'}
                        </button>
                      ) : null}
                      {item.reservation_id ? (
                        <button
                          type="button"
                          onClick={() => setDetailReservationId(item.reservation_id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          {isEn ? 'Reservation' : '예약 상세'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {resendNotice ? (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {resendNotice}
            </p>
          ) : null}
          {total != null && total > 0 && !error ? (
            <nav
              className="flex flex-wrap items-center justify-center gap-1"
              aria-label={isEn ? 'SMS history pages' : 'SMS 내역 페이지'}
            >
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                {isEn ? 'Previous' : '이전'}
              </button>
              {visiblePageNumbers(page, pageCount).map((pageNumber) => {
                const active = pageNumber === page
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-medium ${
                      active
                        ? 'bg-violet-600 text-white'
                        : 'border border-border hover:bg-muted disabled:opacity-40'
                    }`}
                  >
                    {pageNumber}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page >= pageCount || loading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                {isEn ? 'Next' : '다음'}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </nav>
          ) : null}
        </div>
      </div>
      <ReservationResizableDialog
        open={Boolean(detailReservationId)}
        onOpenChange={(next) => {
          if (!next) setDetailReservationId(null)
        }}
        reservationId={detailReservationId}
        modalZIndex={childModalZIndex(DIALOG_Z_INDEX.elevated)}
      />
    </div>
    </ScheduleTooltipZIndexContext.Provider>,
    document.body
  )
}
