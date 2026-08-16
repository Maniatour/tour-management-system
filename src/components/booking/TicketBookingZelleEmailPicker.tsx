'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, Mail, Search } from 'lucide-react'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import ZelleEmailPreviewModal from '@/components/booking/ZelleEmailPreview'
import {
  zelleItemsForBookingPicker,
  zellePaymentYmd,
  type ZelleSyncBookingRef,
  type ZelleSyncListItem,
} from '@/lib/zelleDbSyncDayGroups'
import { formatZelleConfirmationDisplay, zelleConfirmationsOverlap } from '@/lib/zellePaymentEmail'

function formatUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatCardDate(ymd: string | null | undefined, locale: string): string | null {
  const s = ymd?.trim()
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  return dt.toLocaleDateString(locale.startsWith('ko') ? 'ko-KR' : 'en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
}

function itemMatchesQuery(item: ZelleSyncListItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    item.confirmationNumber,
    item.memo,
    item.recipient,
    item.amount != null ? String(item.amount) : '',
    zellePaymentYmd(item),
    ...(item.rnNumbers ?? []),
    ...(item.invoiceNumbers ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export default function TicketBookingZelleEmailPicker({
  booking,
  locale,
  disabled = false,
  attachedImportIds,
  onLinked,
}: {
  booking: ZelleSyncBookingRef
  locale: string
  disabled?: boolean
  attachedImportIds: string[]
  onLinked: () => void | Promise<void>
}) {
  const ko = locale.startsWith('ko')
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ZelleSyncListItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [viewingEmailId, setViewingEmailId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetchApiWithAuth('/api/admin/ticket-bookings/zelle-db-sync')
      const data = (await res.json().catch(() => ({}))) as {
        items?: ZelleSyncListItem[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || res.statusText)
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems, booking.id])

  const attached = useMemo(() => new Set(attachedImportIds.filter(Boolean)), [attachedImportIds])

  const { suggested } = useMemo(
    () => zelleItemsForBookingPicker(items, booking, 3),
    [items, booking]
  )

  const visible = useMemo(
    () => suggested.filter((item) => itemMatchesQuery(item, query)),
    [suggested, query]
  )

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const linkSelected = async () => {
    if (selectedIds.length === 0 || linking || disabled) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetchApiWithAuth('/api/admin/ticket-bookings/zelle-db-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          importIds: selectedIds,
          bookingIds: [booking.id],
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string | null
        attached?: number
      }
      if (!res.ok) throw new Error(data.error || res.statusText)
      if (data.error) throw new Error(data.error)
      setSelectedIds([])
      await onLinked()
      await loadItems()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3">
      <p className="text-xs font-semibold text-emerald-950">
        {ko ? '이메일 Zelle에서 연결' : 'Link from emailed Zelle'}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-emerald-900/80">
        {ko
          ? 'Gmail에서 가져온 송금 메일 중 체크인일 ±3일만 보여 줍니다. 고른 뒤 이 부킹에 연결합니다.'
          : 'Shows emailed Zelle payments within ±3 days of check-in. Pick one to link to this booking.'}
      </p>

      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled || loading}
          placeholder={ko ? '금액 · Conf · 메모 검색' : 'Search amount, conf, memo'}
          className="h-8 w-full rounded-md border border-emerald-200 bg-white pl-7 pr-2 text-xs text-gray-900 outline-none ring-emerald-400 focus:ring-2 disabled:opacity-50"
        />
      </div>

      {error ? <p className="mt-2 text-[11px] text-rose-700">{error}</p> : null}

      <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
        {loading ? (
          <p className="flex items-center gap-1.5 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {ko ? '메일 불러오는 중…' : 'Loading emails…'}
          </p>
        ) : visible.length === 0 ? (
          <p className="py-3 text-xs text-gray-500">
            {ko ? '해당하는 Zelle 메일이 없습니다.' : 'No matching Zelle emails.'}
          </p>
        ) : (
          visible.map((item) => {
            const already =
              attached.has(item.id) ||
              item.paidBookingIds.includes(booking.id) ||
              zelleConfirmationsOverlap(item.confirmationNumber, booking.zelle_confirmation_number)
            const selected = selectedIds.includes(item.id)
            const conf = formatZelleConfirmationDisplay(item.confirmationNumber)
            const dateLabel = formatCardDate(zellePaymentYmd(item), locale)
            const memo = String(item.memo ?? '').trim()
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => toggle(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(item.id)
                  }
                }}
                className={`cursor-pointer rounded-md border px-2 py-1.5 text-left text-[11px] ${
                  selected
                    ? 'border-emerald-500 bg-white ring-1 ring-emerald-400'
                    : already
                      ? 'border-emerald-200 bg-emerald-50/80'
                      : 'border-gray-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold tabular-nums text-gray-900">{formatUsd(item.amount)}</span>
                  {dateLabel ? <span className="text-gray-600">{dateLabel}</span> : null}
                  <span className={`font-mono ${conf ? 'text-slate-900' : 'text-amber-800'}`}>
                    Conf {conf || '—'}
                  </span>
                  {already ? (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold text-emerald-900">
                      {ko ? '연결됨' : 'Linked'}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="ml-auto inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingEmailId(item.id)
                    }}
                  >
                    <Mail className="h-3 w-3" />
                    {ko ? '메일' : 'Email'}
                  </button>
                </div>
                {memo ? (
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-gray-600">{memo}</p>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      <button
        type="button"
        disabled={disabled || linking || selectedIds.length === 0}
        onClick={() => void linkSelected()}
        className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        {ko
          ? selectedIds.length > 0
            ? `선택한 Zelle ${selectedIds.length}건 연결`
            : '선택한 Zelle 연결'
          : selectedIds.length > 0
            ? `Link ${selectedIds.length} selected`
            : 'Link selected'}
      </button>

      <ZelleEmailPreviewModal
        open={Boolean(viewingEmailId)}
        importId={viewingEmailId}
        locale={locale}
        overlayClassName="z-[240]"
        onClose={() => setViewingEmailId(null)}
      />
    </div>
  )
}
