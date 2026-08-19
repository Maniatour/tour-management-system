'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getTicketBookingOriginalQty,
  isTicketBookingCancelledStatus,
  type TicketBookingDisplaySnap,
} from '@/lib/ticketBookingDisplay'
import { teamMemberNameForLocale } from '@/lib/teamMemberDisplayName'
import {
  deriveTicketBookingUnitPriceUsd,
  formatExpenseArrow,
  formatQtyArrow,
  formatUsdExpenseChunk,
} from '@/lib/ticketBookingWorkflow'

export type TicketBookingQtyTimelineBooking = TicketBookingDisplaySnap & {
  id: string
  created_at?: string | null
  submitted_by?: string | null
  unit_price?: number | null
}

type HistoryRow = {
  id: string
  action: string
  changed_at: string | null
  changed_by: string | null
  reason: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
}

export type QtyTimelineActorKind = 'created' | 'requested' | 'modified'

export type QtyTimelineItem = {
  key: string
  delta: number | null
  /** 이 이벤트 반영 후 유효 수량 (예: +1 → afterQty 11) */
  afterQty: number | null
  label: string
  tone: 'start' | 'up' | 'down' | 'pending' | 'neutral'
  at: string | null
  actorEmail: string | null
  actorKind: QtyTimelineActorKind
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

function readEa(values: Record<string, unknown> | null | undefined): number | null {
  if (!values) return null
  const raw = values.ea
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function readPendingEa(values: Record<string, unknown> | null | undefined): number | null {
  if (!values) return null
  const raw = values.pending_ea
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function readChangeStatus(values: Record<string, unknown> | null | undefined): string {
  if (!values) return ''
  return String(values.change_status ?? '').trim().toLowerCase()
}

function formatAt(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return d.toLocaleString(locale.startsWith('en') ? 'en-US' : 'ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

/** 같은 시각(분)·같은 수량 변화는 한 줄로 합침 */
function sameTimelineMinute(a: string | null, b: string | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const ta = new Date(a).getTime()
  const tb = new Date(b).getTime()
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b
  return Math.floor(ta / 60_000) === Math.floor(tb / 60_000)
}

function mergeSameMomentQtyTimelineItems(items: QtyTimelineItem[]): QtyTimelineItem[] {
  if (items.length <= 1) return items
  const out: QtyTimelineItem[] = []
  for (const it of items) {
    const prev = out[out.length - 1]
    const canMerge =
      prev != null &&
      prev.tone !== 'start' &&
      it.tone !== 'start' &&
      sameTimelineMinute(prev.at, it.at) &&
      prev.delta === it.delta &&
      prev.afterQty === it.afterQty

    if (canMerge && prev) {
      const tone = it.tone === 'pending' ? prev.tone : it.tone
      out[out.length - 1] = {
        ...prev,
        key: `${prev.key}+${it.key}`,
        label: `${prev.label} > ${it.label}`,
        tone,
        actorEmail: prev.actorEmail || it.actorEmail,
        actorKind:
          prev.actorKind === 'requested' || it.actorKind === 'requested'
            ? 'requested'
            : it.actorKind,
      }
    } else {
      out.push(it)
    }
  }
  return out
}

/** booking_history + 현재 스냅샷으로 수량 타임라인 구성 */
export function buildTicketBookingQtyTimeline(
  booking: TicketBookingQtyTimelineBooking,
  history: HistoryRow[],
  locale = 'ko'
): QtyTimelineItem[] {
  const isEn = locale.startsWith('en')
  const items: QtyTimelineItem[] = []
  const chron = [...history].sort((a, b) => {
    const ta = a.changed_at ? new Date(a.changed_at).getTime() : 0
    const tb = b.changed_at ? new Date(b.changed_at).getTime() : 0
    return ta - tb
  })

  let seeded = false
  let runningQty = 0

  for (const row of chron) {
    const oldV = asRecord(row.old_values)
    const newV = asRecord(row.new_values)
    const oldEa = readEa(oldV)
    const newEa = readEa(newV)
    const action = (row.action || '').toLowerCase()

    if (action === 'created' || (oldEa == null && newEa != null && !seeded)) {
      const qty = newEa ?? getTicketBookingOriginalQty(booking)
      runningQty = qty
      items.push({
        key: `created-${row.id}`,
        delta: qty,
        afterQty: runningQty,
        label: isEn ? 'Hold created' : '가예약 등록',
        tone: 'start',
        at: row.changed_at,
        actorEmail: row.changed_by,
        actorKind: 'created',
      })
      seeded = true
      continue
    }

    if (oldEa != null && newEa != null && oldEa !== newEa) {
      const delta = newEa - oldEa
      runningQty = newEa
      items.push({
        key: `ea-${row.id}`,
        delta,
        afterQty: runningQty,
        label:
          row.reason?.trim() ||
          (isEn
            ? delta < 0
              ? 'Qty reduced'
              : 'Qty increased'
            : delta < 0
              ? '수량 감소'
              : '수량 증가'),
        tone: delta < 0 ? 'down' : 'up',
        at: row.changed_at,
        actorEmail: row.changed_by,
        actorKind: 'modified',
      })
      seeded = true
    }

    const oldCs = readChangeStatus(oldV)
    const newCs = readChangeStatus(newV)
    const oldPend = readPendingEa(oldV)
    const newPend = readPendingEa(newV)
    const baseEa = newEa ?? oldEa ?? runningQty

    if (newCs === 'requested' && newPend != null && newPend !== baseEa && oldCs !== 'requested') {
      const delta = newPend - baseEa
      items.push({
        key: `req-${row.id}`,
        delta,
        afterQty: newPend,
        label: isEn ? 'Change requested (awaiting vendor)' : '변경 요청 (벤더 대기)',
        tone: 'pending',
        at: row.changed_at,
        actorEmail: row.changed_by,
        actorKind: 'requested',
      })
    } else if (oldCs === 'requested' && newCs !== 'requested' && oldPend != null) {
      const accepted = newEa != null && newEa === oldPend
      if (accepted) {
        runningQty = oldPend
      } else if (newEa != null) {
        runningQty = newEa
      }
      items.push({
        key: `res-${row.id}`,
        delta: accepted ? oldPend - (oldEa ?? baseEa) : null,
        afterQty: runningQty,
        label: accepted
          ? isEn
            ? 'Vendor accepted'
            : '벤더 승인'
          : isEn
            ? 'Vendor rejected / cleared'
            : '벤더 거절·해제',
        tone: accepted ? (oldPend - (oldEa ?? baseEa) < 0 ? 'down' : 'up') : 'neutral',
        at: row.changed_at,
        actorEmail: row.changed_by,
        actorKind: 'modified',
      })
    }
  }

  if (!seeded) {
    const qty = getTicketBookingOriginalQty(booking)
    runningQty = qty
    items.push({
      key: 'seed',
      delta: qty,
      afterQty: runningQty,
      label: isEn ? 'Hold on file' : '가예약 기록',
      tone: 'start',
      at: booking.created_at ?? null,
      actorEmail: booking.submitted_by ?? null,
      actorKind: 'created',
    })
  }

  const cs = (booking.change_status ?? 'none').toLowerCase()
  const orig = getTicketBookingOriginalQty(booking)
  if (cs === 'requested' && booking.pending_ea != null && Number(booking.pending_ea) !== orig) {
    const alreadyPending = items.some((it) => it.tone === 'pending')
    if (!alreadyPending) {
      const pend = Number(booking.pending_ea)
      items.push({
        key: 'live-pending',
        delta: pend - orig,
        afterQty: pend,
        label: isEn ? 'Change requested (awaiting vendor)' : '변경 요청 (벤더 대기)',
        tone: 'pending',
        at: null,
        actorEmail: null,
        actorKind: 'requested',
      })
    }
  }

  if (isTicketBookingCancelledStatus(booking) && orig > 0) {
    const hasFullCancel = items.some(
      (it) => it.delta === -orig || (it.delta != null && it.delta < 0 && Math.abs(it.delta) >= orig)
    )
    if (!hasFullCancel) {
      runningQty = 0
      items.push({
        key: 'cancelled',
        delta: -orig,
        afterQty: runningQty,
        label: isEn ? 'Fully cancelled' : '전량 취소',
        tone: 'down',
        at: null,
        actorEmail: null,
        actorKind: 'modified',
      })
    }
  }

  return mergeSameMomentQtyTimelineItems(items)
}

const qtyHistoryCache = new Map<string, HistoryRow[]>()
const qtyHistoryInflight = new Map<string, Promise<HistoryRow[]>>()

export async function loadTicketBookingQtyHistory(bookingId: string): Promise<HistoryRow[]> {
  const cached = qtyHistoryCache.get(bookingId)
  if (cached) return cached
  const existing = qtyHistoryInflight.get(bookingId)
  if (existing) return existing

  const p = (async () => {
    const { data, error } = await supabase
      .from('booking_history')
      .select('id, action, changed_at, changed_by, reason, old_values, new_values')
      .eq('booking_type', 'ticket')
      .eq('booking_id', bookingId)
      .order('changed_at', { ascending: true })
    if (error) {
      console.warn('qty timeline history', error)
      return [] as HistoryRow[]
    }
    const rows: HistoryRow[] = (data || []).map((row) => ({
      id: String(row.id),
      action: String(row.action ?? ''),
      changed_at: row.changed_at ?? null,
      changed_by: row.changed_by ? String(row.changed_by) : null,
      reason: row.reason ?? null,
      old_values: asRecord(row.old_values),
      new_values: asRecord(row.new_values),
    }))
    qtyHistoryCache.set(bookingId, rows)
    return rows
  })()

  qtyHistoryInflight.set(bookingId, p)
  try {
    return await p
  } finally {
    qtyHistoryInflight.delete(bookingId)
  }
}

export function qtyAfterSequence(items: QtyTimelineItem[]): number[] {
  const qtys: number[] = []
  for (const it of items) {
    if (it.afterQty == null || !Number.isFinite(it.afterQty)) continue
    if (qtys.length === 0 || qtys[qtys.length - 1] !== it.afterQty) {
      qtys.push(it.afterQty)
    }
  }
  return qtys
}

export function formatQtyAfterChain(items: QtyTimelineItem[]): string {
  return qtyAfterSequence(items).join(' > ')
}

export function formatExpenseAfterChain(
  qtys: number[],
  booking: {
    ea?: number | null | undefined
    expense?: number | null | undefined
    unit_price?: number | null | undefined
    change_status?: string | null | undefined
    pending_ea?: number | null | undefined
  }
): string {
  const unit = deriveTicketBookingUnitPriceUsd(
    booking.ea ?? 0,
    Number(booking.expense ?? 0),
    booking.unit_price ?? null
  )
  if (!(unit > 0) || qtys.length === 0) return formatExpenseArrow(booking)
  const amounts: number[] = []
  for (const q of qtys) {
    const amount = Math.round(unit * q * 100) / 100
    if (amounts.length === 0 || Math.abs(amounts[amounts.length - 1] - amount) >= 0.005) {
      amounts.push(amount)
    }
  }
  if (amounts.length <= 1) return formatExpenseArrow(booking)
  return amounts.map(formatUsdExpenseChunk).join(' > ')
}

/** 달력 칩 호버: 수량 변경 기록(8 > 7 > 5) + 금액 */
export function TicketBookingHoverQtyAmountLines({
  booking,
  locale,
  active,
}: {
  booking: TicketBookingQtyTimelineBooking
  locale: string
  active: boolean
}) {
  const isEn = locale.startsWith('en')
  const fallbackQty = formatQtyArrow(booking)
  const fallbackAmount = formatExpenseArrow(booking)
  const [qtyText, setQtyText] = useState(fallbackQty)
  const [amountText, setAmountText] = useState(fallbackAmount)
  const [pendingLast, setPendingLast] = useState(false)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    void loadTicketBookingQtyHistory(booking.id).then((history) => {
      if (cancelled) return
      const items = buildTicketBookingQtyTimeline(booking, history, locale)
      const qtys = qtyAfterSequence(items)
      const chain = qtys.join(' > ')
      setQtyText(chain || fallbackQty)
      setAmountText(formatExpenseAfterChain(qtys, booking))
      const lastWithQty = [...items].reverse().find((it) => it.afterQty != null)
      setPendingLast(lastWithQty?.tone === 'pending' && qtys.length > 1)
    })
    return () => {
      cancelled = true
    }
  }, [active, booking, locale, fallbackQty])

  const qtyParts = qtyText.split(' > ').filter(Boolean)
  const showQtyParts = qtyParts.length > 1 && qtyParts.every((p) => /^-?\d+(\.\d+)?$/.test(p.trim()))

  return (
    <>
      <div className="text-[10px] font-medium text-gray-900">
        <span className="text-gray-500">{isEn ? 'Quantity' : '수량'}</span>{' '}
        <span className="tabular-nums">
          {showQtyParts
            ? qtyParts.map((part, i) => (
                <Fragment key={`${part}-${i}`}>
                  {i > 0 ? <span className="text-gray-400"> {'>'} </span> : null}
                  <span
                    className={
                      pendingLast && i === qtyParts.length - 1 ? 'font-semibold text-orange-700' : undefined
                    }
                  >
                    {part.trim()}
                  </span>
                </Fragment>
              ))
            : qtyText}
        </span>
      </div>
      <div className="text-[10px] font-medium text-gray-900">
        <span className="text-gray-500">{isEn ? 'Amount' : '금액'}</span>{' '}
        <span className="tabular-nums">{amountText}</span>
      </div>
    </>
  )
}

type Props = {
  booking: TicketBookingQtyTimelineBooking
  locale?: string
  /** 모달 등 외부 제목이 있을 때 섹션 헤딩 숨김 */
  hideHeading?: boolean
}

function actorKindLabel(kind: QtyTimelineActorKind, isEn: boolean): string {
  if (kind === 'requested') return isEn ? 'Requested by' : '요청'
  if (kind === 'created') return isEn ? 'Created by' : '등록'
  return isEn ? 'Updated by' : '수정'
}

function fallbackActorLabel(email: string): string {
  const em = email.trim()
  if (!em || em.toLowerCase() === 'system') return ''
  const local = em.split('@')[0] || em
  return local
}

export default function TicketBookingQtyTimeline({
  booking,
  locale = 'ko',
  hideHeading = false,
}: Props) {
  const isEn = locale.startsWith('en')
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [nameByEmail, setNameByEmail] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const rows = await loadTicketBookingQtyHistory(booking.id)
      if (cancelled) return
      setHistory(rows)

      const emails = [
        ...new Set(
          [
            ...rows.map((r) => String(r.changed_by || '').trim()),
            String(booking.submitted_by || '').trim(),
          ].filter((em) => em.includes('@'))
        ),
      ]
      if (emails.length === 0) {
        setNameByEmail(new Map())
        setLoading(false)
        return
      }
      const { data: teamData, error: teamError } = await supabase
        .from('team')
        .select('email, nick_name, name_ko, name_en, display_name')
        .in('email', emails)
      if (cancelled) return
      const map = new Map<string, string>()
      if (!teamError && teamData) {
        for (const member of teamData) {
          const key = String(member.email || '').trim().toLowerCase()
          const label = teamMemberNameForLocale(member, locale)
          if (key && label) map.set(key, label)
        }
      }
      setNameByEmail(map)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [booking.id, booking.submitted_by, locale])

  const items = useMemo(
    () => buildTicketBookingQtyTimeline(booking, history, locale),
    [booking, history, locale]
  )

  const resolveActorName = (email: string | null | undefined): string => {
    const em = String(email || '').trim()
    if (!em) return ''
    return nameByEmail.get(em.toLowerCase()) || fallbackActorLabel(em)
  }

  return (
    <section className="space-y-2">
      {!hideHeading ? (
        <h4 className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {isEn ? 'Quantity timeline' : '수량 타임라인'}
        </h4>
      ) : null}
      {loading ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {isEn ? 'Loading…' : '불러오는 중…'}
        </p>
      ) : (
        <ol className="mt-1 space-y-2 border-l-2 border-gray-200 pl-4">
          {items.map((it) => {
            const deltaClass =
              it.tone === 'pending'
                ? 'text-orange-700'
                : it.tone === 'down'
                  ? 'text-red-700'
                  : it.tone === 'up' || it.tone === 'start'
                    ? 'text-emerald-700'
                    : 'text-slate-600'
            const dotClass =
              it.tone === 'pending'
                ? 'bg-orange-400'
                : it.tone === 'down'
                  ? 'bg-red-500'
                  : it.tone === 'start' || it.tone === 'up'
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
            const deltaText =
              it.delta == null
                ? '·'
                : it.tone === 'start'
                  ? `+${it.delta}`
                  : it.delta > 0
                    ? `+${it.delta}`
                    : String(it.delta)
            const qtyText =
              it.afterQty != null ? (
                <>
                  <span className="text-muted-foreground"> = </span>
                  <span className={`font-semibold tabular-nums ${deltaClass}`}>{it.afterQty}</span>
                </>
              ) : null
            const when = formatAt(it.at, locale)
            const actorName = resolveActorName(it.actorEmail)
            return (
              <li key={it.key} className="relative text-sm">
                <span className={`absolute -left-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full ${dotClass}`} />
                <span className={`font-medium tabular-nums ${deltaClass}`}>{deltaText}</span>
                {qtyText}
                <span className="text-muted-foreground"> {it.label}</span>
                {actorName || when ? (
                  <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    {actorName ? (
                      <span className="font-medium text-slate-700">
                        {actorKindLabel(it.actorKind, isEn)} {actorName}
                      </span>
                    ) : null}
                    {actorName && when ? <span className="text-gray-300"> · </span> : null}
                    {when ? <span className="text-[10px] text-gray-400">{when}</span> : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
