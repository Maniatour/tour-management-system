'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import type { ExpenseStatementReconContext, SimilarStatementLineRow, SimilarStatementLinesMatchMode } from '@/lib/expense-reconciliation-similar-lines'
import {
  expenseReconciliationAmountTolerance,
  fetchLinkedStatementLineRowsForExpenseSource,
  fetchSimilarStatementLinesForExpenseRow,
  fetchStatementLinesForTicketBookingDateProbe,
  mergeLinkedAndCandidateRows,
  replaceExpenseReconciliationMatch,
  resolveStatementLineConflictsBeforeLink,
  searchStatementLinesAcrossImports,
  sumMatchedAmountAllocatedToSource,
  unlinkExpenseReconciliationMatch,
  type StatementLineConflictResolution
} from '@/lib/expense-reconciliation-similar-lines'
import {
  fetchLedgerMatchDetails,
  fetchLedgerMatchDetailsBatch,
  formatLedgerMatchDetailLines,
  sourceTableLabelKey,
  type LedgerMatchDetail,
  type LedgerMatchRef,
} from '@/lib/expense-ledger-match-display'
import {
  formatTicketBookingTourHeadline,
  type TicketBookingTourEnrichment,
} from '@/lib/ticket-booking-tour-display'

const ACCOUNT_TAB_ALL = '__all__'
const UNKNOWN_ACCOUNT_TAB_ID = '__unknown_account__'

function accountTabIdForRow(r: SimilarStatementLineRow): string {
  return r.financial_account_id?.trim() || UNKNOWN_ACCOUNT_TAB_ID
}

function dedupeStatementLineIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** 입금(inflow)은 출금 대비 반대 방향이므로 마이너스로 표시 */
function statementLineSignedAmountLabel(row: { amount: number; direction: string }): string {
  const abs = Math.abs(row.amount)
  const isInflow = String(row.direction).toLowerCase() === 'inflow'
  return `${isInflow ? '-' : ''}$${abs.toFixed(2)}`
}

type LedgerMatchDetailLabelBundle = {
  sourceType: string
  allocatedOnStatement: string
  ledgerAmount: string
  paidTo: string
  paidFor: string
  submitDate: string
  checkInDate: string
  tourDate: string
  linkedTour: string
  quantity: string
  rn: string
  description: string
  paymentMethod: string
  recordId: string
  notFound: string
}

function StatementTableLinkedMatchCell({
  match,
  detail,
  labels,
  paymentMethodMap,
  paymentMethodFinancialAccountNameByPmId,
  fallbackLabel,
  sourceTypeLabel,
}: {
  match: LedgerMatchRef
  detail: LedgerMatchDetail | undefined
  labels: LedgerMatchDetailLabelBundle
  paymentMethodMap: Record<string, string>
  paymentMethodFinancialAccountNameByPmId: Record<string, string>
  fallbackLabel: string
  sourceTypeLabel: (table: string) => string
}) {
  if (!detail) {
    return <div className="truncate text-muted-foreground">{fallbackLabel}</div>
  }
  const pmKey = detail.payment_method?.trim() ?? ''
  const pmLabel = pmKey
    ? paymentMethodMap[pmKey] ?? paymentMethodFinancialAccountNameByPmId[pmKey] ?? pmKey
    : null
  const typeName = sourceTypeLabel(detail.source_table)
  const { headline, rows } = formatLedgerMatchDetailLines(
    detail,
    { ...labels, sourceType: typeName },
    pmLabel
  )
  return (
    <div className="rounded border border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 mb-1.5 last:mb-0 min-w-[16rem]">
      <p className="font-semibold text-[10px] text-slate-900 leading-snug tabular-nums">{headline}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] leading-snug">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex min-w-0 items-baseline gap-1">
            <dt className="shrink-0 text-muted-foreground after:content-[':']">{row.label}</dt>
            <dd className="min-w-0 break-words font-medium text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** 명세 줄에 배정 가능한 금액(이미 다른 원장에 배정된 잔여 한도) */
function lineMatchableAmount(row: SimilarStatementLineRow): number {
  const lineAbs = Math.abs(row.amount)
  const lineRoom = Math.max(0, lineAbs - row.allocated_sum)
  return lineRoom > 0.009 ? lineRoom : lineAbs
}

/** 추가 연결(append) 시 배정 USD — 입력값 우선, 없으면 원장·명세 한도에서 산출 */
function computeAppendShareAmount(params: {
  row: SimilarStatementLineRow
  ledgerCap: number
  sourceAllocatedSum: number
  selfAllocOnLine: number
  /** true: 선택 줄의 타 지출 연결을 끊고 이 원장만 남긴 뒤 배정(충돌 해결·충돌 UI) */
  treatLineFreedByConflict: boolean
  manualStr: string
}): number | null {
  const parsed = Number(String(params.manualStr).trim().replace(/,/g, ''))
  if (Number.isFinite(parsed) && parsed > 0) return Math.abs(parsed)

  const isInflow = String(params.row.direction).toLowerCase() === 'inflow'
  const lineAbs = Math.abs(params.row.amount)
  const lineRoom = params.treatLineFreedByConflict
    ? Math.max(0, lineAbs - Math.abs(params.selfAllocOnLine))
    : Math.max(0, lineAbs - params.row.allocated_sum)
  const remainingOnLedger = Math.max(0, params.ledgerCap - params.sourceAllocatedSum)
  const share = isInflow ? lineRoom : Math.min(remainingOnLedger, lineRoom)
  return share > 0.009 ? Math.round(share * 100) / 100 : null
}

type SourceSummaryInfo = {
  paymentMethod: string | null
  primaryDetail: string | null
  secondaryDetail: string | null
  rnNumber?: string | null
  /** 투어 호텔 부킹 등 — YYYY-MM-DD 표시용 */
  checkInDate?: string | null
  checkOutDate?: string | null
  /** 입장권 부킹 — 등록일·체크인·연결 투어 */
  submitOn?: string | null
  ticketCheckInDate?: string | null
  ledgerExpense?: number | null
  tourId?: string | null
  linkedTour?: TicketBookingTourEnrichment | null
}

function formatYmdForDisplay(raw: string | null | undefined): string | null {
  const s = raw == null ? '' : String(raw).trim()
  if (!s) return null
  return s.length >= 10 ? s.slice(0, 10) : s
}

async function fetchSourceSummaryInfo(context: ExpenseStatementReconContext): Promise<SourceSummaryInfo | null> {
  const base = { paymentMethod: null, primaryDetail: null, secondaryDetail: null } as SourceSummaryInfo
  switch (context.sourceTable) {
    case 'company_expenses': {
      const { data } = await supabase
        .from('company_expenses')
        .select('payment_method, paid_for, paid_to, description')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.description ?? null,
        secondaryDetail: data.paid_to ?? null
      }
    }
    case 'reservation_expenses': {
      const { data } = await supabase
        .from('reservation_expenses')
        .select('payment_method, paid_for, paid_to, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.note ?? null,
        secondaryDetail: data.paid_to ?? null
      }
    }
    case 'tour_expenses': {
      const { data } = await supabase
        .from('tour_expenses')
        .select('payment_method, paid_for, paid_to, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.note ?? null,
        secondaryDetail: data.paid_to ?? null
      }
    }
    case 'ticket_bookings': {
      const { data } = await supabase
        .from('ticket_bookings')
        .select(
          'payment_method, category, company, note, rn_number, submit_on, check_in_date, expense, tour_id'
        )
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      const rn = data.rn_number == null ? null : String(data.rn_number).trim() || null
      const tourId = data.tour_id == null ? null : String(data.tour_id).trim() || null
      let linkedTour: TicketBookingTourEnrichment | null = null
      if (tourId) {
        const { data: tourRow } = await supabase
          .from('tours')
          .select(
            `
            tour_date,
            products (
              name,
              name_en,
              name_ko
            )
          `
          )
          .eq('id', tourId)
          .maybeSingle()
        if (tourRow) {
          const tr = tourRow as {
            tour_date?: string | null
            products?: { name?: string; name_en?: string; name_ko?: string } | { name?: string; name_en?: string; name_ko?: string }[] | null
          }
          const rawProducts = tr.products
          const product =
            rawProducts == null
              ? null
              : Array.isArray(rawProducts)
                ? rawProducts[0] ?? null
                : rawProducts
          linkedTour = {
            tour_date: tr.tour_date ?? null,
            products: product,
          }
        }
      }
      const expense = Number(data.expense ?? 0)
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.category ?? data.note ?? null,
        secondaryDetail: data.company ?? null,
        rnNumber: rn,
        submitOn: formatYmdForDisplay(data.submit_on),
        ticketCheckInDate: formatYmdForDisplay(data.check_in_date),
        ledgerExpense: Number.isFinite(expense) ? Math.abs(expense) : null,
        tourId,
        linkedTour,
      }
    }
    case 'tour_hotel_bookings': {
      const { data } = await supabase
        .from('tour_hotel_bookings')
        .select('payment_method, hotel, reservation_name, city, check_in_date, check_out_date, rn_number')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      const rn = data.rn_number == null ? null : String(data.rn_number).trim() || null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.hotel ?? data.reservation_name ?? null,
        secondaryDetail: data.city ?? null,
        rnNumber: rn,
        checkInDate: formatYmdForDisplay(data.check_in_date),
        checkOutDate: formatYmdForDisplay(data.check_out_date)
      }
    }
    case 'payment_records': {
      const { data } = await supabase
        .from('payment_records')
        .select('payment_method, note')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.note ?? null,
        secondaryDetail: null
      }
    }
    case 'cash_transactions': {
      const { data } = await supabase
        .from('cash_transactions')
        .select('transaction_type, description, category, notes')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      const type = String(data.transaction_type ?? '').trim()
      return {
        paymentMethod: null,
        primaryDetail: data.description ?? data.category ?? null,
        secondaryDetail:
          type === 'deposit' ? '현금 입금' : type === 'withdrawal' ? '현금 출금' : data.category ?? null,
      }
    }
    default:
      return base
  }
}

export default function ExpenseStatementSimilarLinesModal({
  open,
  onOpenChange,
  context,
  onApplied,
  nestedElevated = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  context: ExpenseStatementReconContext | null
  onApplied?: () => void
  /** 다른 Dialog(z≥1200) 위에 열 때 — 오버레이·본문 z-[1300] */
  nestedElevated?: boolean
}) {
  const t = useTranslations('expenses.statementRecon')
  const locale = useLocale()
  const { user } = useAuth()
  const {
    paymentMethodMap,
    paymentMethodFinancialAccountNameByPmId,
    paymentMethodFinancialAccountNameByMethodKey
  } = usePaymentMethodOptions()
  const [rows, setRows] = useState<SimilarStatementLineRow[]>([])
  const [linkedRows, setLinkedRows] = useState<SimilarStatementLineRow[]>([])
  const [sourceAllocByLineId, setSourceAllocByLineId] = useState<Map<string, number>>(() => new Map())
  const [matchIdByLineId, setMatchIdByLineId] = useState<Map<string, string | null>>(() => new Map())
  const [unlinkingLineId, setUnlinkingLineId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /** 선택 순서 유지(추가 연결 시 여러 줄을 순서대로 배정) */
  const [selectedIdsOrdered, setSelectedIdsOrdered] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [matchMode, setMatchMode] = useState<SimilarStatementLinesMatchMode>('dateProximity')
  const [rowSearch, setRowSearch] = useState('')
  const [searchResultRows, setSearchResultRows] = useState<SimilarStatementLineRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [sourceSummary, setSourceSummary] = useState<SourceSummaryInfo | null>(null)
  const [syncAmountToStatement, setSyncAmountToStatement] = useState(false)
  const [appendLink, setAppendLink] = useState(false)
  const [appendAmountStr, setAppendAmountStr] = useState('')
  const [sourceAllocatedSum, setSourceAllocatedSum] = useState<number | null>(null)
  const appendAmountUserEditedRef = useRef(false)
  const headerSelectAllRef = useRef<HTMLInputElement>(null)
  const [activeAccountTab, setActiveAccountTab] = useState(ACCOUNT_TAB_ALL)
  const [conflictDetails, setConflictDetails] = useState<LedgerMatchDetail[]>([])
  const [conflictDetailsLoading, setConflictDetailsLoading] = useState(false)
  const [linkedMatchDetailsByKey, setLinkedMatchDetailsByKey] = useState<Map<string, LedgerMatchDetail>>(
    () => new Map()
  )
  const [linkedMatchDetailsLoading, setLinkedMatchDetailsLoading] = useState(false)

  const ticketDateProbe = context?.ticketBookingDateProbe

  const contextRef = useRef(context)
  const matchModeRef = useRef(matchMode)
  const tRef = useRef(t)
  contextRef.current = context
  matchModeRef.current = matchMode
  tRef.current = t

  /** context·matchMode 객체 참조 변경만으로 load가 반복되지 않도록 원시값 키 사용 */
  const contextLoadKey = useMemo(() => {
    if (!context) return null
    const p = context.ticketBookingDateProbe
    return [
      context.sourceTable,
      context.sourceId,
      context.dateYmd,
      String(context.amount),
      context.direction,
      matchMode,
      p?.submitYmd ?? '',
      p?.checkInYmd ?? '',
      String(p?.dayWindow ?? ''),
      p?.financialAccountId ?? '',
    ].join('\u0000')
  }, [context, matchMode])

  const runLoad = useCallback(async (opts?: { preserveSelection?: boolean }) => {
    const ctx = contextRef.current
    if (!ctx) return
    const probe = ctx.ticketBookingDateProbe
    const mode = matchModeRef.current
    setLoading(true)
    setMessage(null)
    if (!opts?.preserveSelection) setSelectedIdsOrdered([])
    try {
      const linkedPromise = fetchLinkedStatementLineRowsForExpenseSource(supabase, {
        sourceTable: ctx.sourceTable,
        sourceId: ctx.sourceId,
        dateYmd: ctx.dateYmd,
        ledgerAmount: ctx.amount,
      })
      const candidatesPromise = probe
        ? fetchStatementLinesForTicketBookingDateProbe(supabase, {
            submitYmd: probe.submitYmd,
            checkInYmd: probe.checkInYmd,
            dayWindow: probe.dayWindow,
            financialAccountId: probe.financialAccountId,
            ledgerAmount: ctx.amount,
            limit: 400,
          })
        : fetchSimilarStatementLinesForExpenseRow(supabase, {
            dateYmd: ctx.dateYmd,
            amount: ctx.amount,
            direction: ctx.direction,
            matchMode: mode,
            limit: mode === 'amountOnly' ? 200 : 100,
          })

      const [linkedPack, list] = await Promise.all([linkedPromise, candidatesPromise])
      setLinkedRows(linkedPack.rows)
      setSourceAllocByLineId(linkedPack.allocatedByLineId)
      setMatchIdByLineId(linkedPack.matchIdByLineId)
      setRows(mergeLinkedAndCandidateRows(linkedPack.rows, list))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : tRef.current('loadError'))
      setLinkedRows([])
      setSourceAllocByLineId(new Map())
      setMatchIdByLineId(new Map())
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && contextLoadKey != null) void runLoad()
    if (!open) {
      setRows([])
      setLinkedRows([])
      setSourceAllocByLineId(new Map())
      setMatchIdByLineId(new Map())
      setUnlinkingLineId(null)
      setSelectedIdsOrdered([])
      setMessage(null)
      setMatchMode('dateProximity')
      setRowSearch('')
      setSearchResultRows([])
      setSearchLoading(false)
      setSourceSummary(null)
      setSyncAmountToStatement(false)
      setAppendLink(false)
      setAppendAmountStr('')
      setSourceAllocatedSum(null)
      appendAmountUserEditedRef.current = false
      setActiveAccountTab(ACCOUNT_TAB_ALL)
    }
  }, [open, contextLoadKey, runLoad])

  useEffect(() => {
    if (!open || !context) return
    let cancelled = false
    void fetchSourceSummaryInfo(context)
      .then((info) => {
        if (!cancelled) setSourceSummary(info)
      })
      .catch(() => {
        if (!cancelled) setSourceSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, context])

  useEffect(() => {
    if (!open || !context) {
      setSourceAllocatedSum(null)
      return
    }
    let cancelled = false
    void sumMatchedAmountAllocatedToSource(supabase, context.sourceTable, context.sourceId).then((n) => {
      if (!cancelled) setSourceAllocatedSum(n)
    })
    return () => {
      cancelled = true
    }
  }, [open, context])

  const searchQueryTrimmed = rowSearch.trim()
  const isSearchActive = searchQueryTrimmed.length > 0

  const sourceRows = useMemo(() => {
    if (!isSearchActive) return rows
    return searchResultRows
  }, [rows, searchResultRows, isSearchActive])

  const accountTabs = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    for (const r of sourceRows) {
      const id = accountTabIdForRow(r)
      const name = r.financial_account_name?.trim() || '—'
      const cur = map.get(id)
      if (cur) cur.count += 1
      else map.set(id, { name, count: 1 })
    }
    return [...map.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [sourceRows])

  const visibleRows = useMemo(() => {
    if (activeAccountTab === ACCOUNT_TAB_ALL) return sourceRows
    return sourceRows.filter((r) => accountTabIdForRow(r) === activeAccountTab)
  }, [sourceRows, activeAccountTab])

  const rowById = useMemo(() => {
    const m = new Map<string, SimilarStatementLineRow>()
    for (const r of rows) m.set(r.id, r)
    for (const r of searchResultRows) m.set(r.id, r)
    return m
  }, [rows, searchResultRows])

  useEffect(() => {
    if (!open || !context) return
    if (!isSearchActive) {
      setSearchResultRows([])
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    let cancelled = false
    const timer = setTimeout(() => {
      void searchStatementLinesAcrossImports(supabase, {
        query: searchQueryTrimmed,
        direction: ticketDateProbe ? null : context.direction,
        limit: 250
      })
        .then((list) => {
          if (!cancelled) {
            setSearchResultRows(list)
            setMessage(null)
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setMessage(e instanceof Error ? e.message : t('loadError'))
            setSearchResultRows([])
          }
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [rowSearch, open, context, t, ticketDateProbe, isSearchActive, searchQueryTrimmed])

  useEffect(() => {
    setSelectedIdsOrdered((prev) => {
      const next = prev.filter((id) => visibleRows.some((r) => r.id === id))
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev
      return next
    })
  }, [visibleRows])

  const toggleLineId = useCallback((id: string) => {
    setSelectedIdsOrdered((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const unlinkRowKey = (row: SimilarStatementLineRow) =>
    row.reconciliation_match_id?.trim() || row.id

  const unlinkCurrentLink = useCallback(
    async (row: SimilarStatementLineRow) => {
      if (!context || unlinkingLineId) return
      const lineId = row.id
      const ok = window.confirm(t('modalUnlinkCurrentLinkConfirm'))
      if (!ok) return
      setUnlinkingLineId(unlinkRowKey(row))
      setMessage(null)
      try {
        await unlinkExpenseReconciliationMatch(supabase, {
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          matchId: row.reconciliation_match_id ?? matchIdByLineId.get(lineId) ?? null,
          statementLineId: lineId,
        })
        setSelectedIdsOrdered((prev) => prev.filter((id) => id !== lineId))
        await runLoad({ preserveSelection: true })
        const n = await sumMatchedAmountAllocatedToSource(
          supabase,
          context.sourceTable,
          context.sourceId
        )
        setSourceAllocatedSum(n)
        onApplied?.()
      } catch (e) {
        setMessage(e instanceof Error ? e.message : t('modalUnlinkCurrentLinkError'))
      } finally {
        setUnlinkingLineId(null)
      }
    },
    [context, unlinkingLineId, matchIdByLineId, t, runLoad, onApplied]
  )

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selectedIdsOrdered.includes(r.id))
  const someVisibleSelected = visibleRows.some((r) => selectedIdsOrdered.includes(r.id))

  useEffect(() => {
    const el = headerSelectAllRef.current
    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  const toggleAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIdsOrdered((prev) => prev.filter((id) => !visibleRows.some((r) => r.id === id)))
    } else {
      setSelectedIdsOrdered((prev) => {
        const next = [...prev]
        for (const r of visibleRows) {
          if (!next.includes(r.id)) next.push(r.id)
        }
        return next
      })
    }
  }, [allVisibleSelected, visibleRows])

  const primarySelectedId = selectedIdsOrdered[0] ?? null
  const selectedRow = useMemo(
    () => (primarySelectedId ? rowById.get(primarySelectedId) ?? null : null),
    [rowById, primarySelectedId]
  )

  /** 선택한 줄 중 입금(환불)이 하나라도 있으면 — 추가 연결 시 «순» 배정을 줄이므로 잔여 0이어도 허용 */
  const anySelectedInflow = useMemo(
    () =>
      selectedIdsOrdered.some(
        (id) => String(rowById.get(id)?.direction ?? '').toLowerCase() === 'inflow'
      ),
    [selectedIdsOrdered, rowById]
  )

  const conflictingOnSelectedLine = useMemo(() => {
    if (!selectedRow || !context) return []
    return selectedRow.existing_matches.filter(
      (m) => !(m.source_table === context.sourceTable && m.source_id === context.sourceId)
    )
  }, [selectedRow, context])

  /** 선택한 명세 줄에 다른 지출·부킹이 연결됨 — append(기존 연결 유지)여도 표시 */
  const hasLineConflict =
    selectedIdsOrdered.length === 1 &&
    conflictingOnSelectedLine.length > 0

  const lineFullyAllocatedByOthers = useMemo(() => {
    if (!selectedRow || conflictingOnSelectedLine.length === 0) return false
    const lineAbs = Math.abs(selectedRow.amount)
    const tol = Math.max(0.5, lineAbs * 0.001)
    return selectedRow.allocated_sum >= lineAbs - tol
  }, [selectedRow, conflictingOnSelectedLine.length])

  const conflictDetailsKey = useMemo(() => {
    if (!selectedRow || conflictingOnSelectedLine.length === 0) return ''
    return `${selectedRow.id}|${conflictingOnSelectedLine
      .map((m) => `${m.source_table}:${m.source_id}`)
      .sort()
      .join(',')}`
  }, [selectedRow, conflictingOnSelectedLine])

  useEffect(() => {
    if (!open || !conflictDetailsKey || !selectedRow) {
      setConflictDetails([])
      setConflictDetailsLoading(false)
      return
    }
    let cancelled = false
    setConflictDetailsLoading(true)
    void fetchLedgerMatchDetails(supabase, selectedRow.id, conflictingOnSelectedLine)
      .then((list) => {
        if (!cancelled) setConflictDetails(list)
      })
      .catch(() => {
        if (!cancelled) setConflictDetails([])
      })
      .finally(() => {
        if (!cancelled) setConflictDetailsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, conflictDetailsKey, selectedRow, conflictingOnSelectedLine])

  useEffect(() => {
    if (!open) {
      setLinkedMatchDetailsByKey(new Map())
      setLinkedMatchDetailsLoading(false)
      return
    }
    const refs: LedgerMatchRef[] = []
    for (const r of rows) {
      for (const m of r.existing_matches) refs.push(m)
    }
    for (const r of searchResultRows) {
      for (const m of r.existing_matches) refs.push(m)
    }
    if (refs.length === 0) {
      setLinkedMatchDetailsByKey(new Map())
      setLinkedMatchDetailsLoading(false)
      return
    }
    let cancelled = false
    setLinkedMatchDetailsLoading(true)
    void fetchLedgerMatchDetailsBatch(supabase, refs)
      .then((map) => {
        if (!cancelled) setLinkedMatchDetailsByKey(map)
      })
      .catch(() => {
        if (!cancelled) setLinkedMatchDetailsByKey(new Map())
      })
      .finally(() => {
        if (!cancelled) setLinkedMatchDetailsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, rows, searchResultRows])

  const detailLabelBundle: LedgerMatchDetailLabelBundle = {
    sourceType: t('lineConflictDetailSourceType'),
    allocatedOnStatement: t('lineConflictDetailAllocated'),
    ledgerAmount: t('lineConflictDetailLedgerAmount'),
    paidTo: t('lineConflictDetailPaidTo'),
    paidFor: t('lineConflictDetailPaidFor'),
    submitDate: t('sourceSubmitOn'),
    checkInDate: t('lineConflictDetailCheckIn'),
    tourDate: t('lineConflictDetailTourDate'),
    linkedTour: t('sourceLinkedTour'),
    quantity: t('colLinkedQuantity'),
    rn: t('lineConflictDetailRn'),
    description: t('lineConflictDetailDescription'),
    paymentMethod: t('sourcePaymentMethod'),
    recordId: t('lineConflictDetailRecordId'),
    notFound: t('lineConflictDetailNotFound'),
  }

  const ledgerTotalAbs = context ? Math.abs(context.amount) : 0
  const remainingOnLedger =
    sourceAllocatedSum == null ? null : Math.max(0, ledgerTotalAbs - sourceAllocatedSum)

  const allowTicketMultiLink =
    Boolean(ticketDateProbe) && context?.sourceTable === 'ticket_bookings' && !appendLink

  const selectedLineCount = dedupeStatementLineIdsPreserveOrder(selectedIdsOrdered).length

  useEffect(() => {
    appendAmountUserEditedRef.current = false
  }, [context?.sourceId, appendLink, selectedIdsOrdered.join('|')])

  useEffect(() => {
    if (
      !open ||
      !context ||
      !appendLink ||
      selectedIdsOrdered.length !== 1 ||
      !selectedRow ||
      appendAmountUserEditedRef.current
    )
      return
    if (sourceAllocatedSum == null) return
    const amount = computeAppendShareAmount({
      row: selectedRow,
      ledgerCap: ledgerTotalAbs,
      sourceAllocatedSum,
      selfAllocOnLine: sourceAllocByLineId.get(selectedRow.id) ?? 0,
      treatLineFreedByConflict: hasLineConflict,
      manualStr: '',
    })
    const next = amount != null ? amount.toFixed(2) : ''
    setAppendAmountStr((prev) => (prev === next ? prev : next))
  }, [
    open,
    context?.sourceId,
    appendLink,
    selectedIdsOrdered.length,
    selectedRow,
    hasLineConflict,
    sourceAllocatedSum,
    ledgerTotalAbs,
    sourceAllocByLineId,
  ])

  const selectedAmountDiff = selectedRow ? Math.abs(Math.abs(selectedRow.amount) - Math.abs(context?.amount ?? 0)) : 0
  const syncTol = context ? expenseReconciliationAmountTolerance(Math.abs(context.amount)) : 0
  const canSyncAmount =
    !appendLink &&
    selectedIdsOrdered.length === 1 &&
    Boolean(context) &&
    context!.sourceTable !== 'payment_records' &&
    selectedRow != null &&
    selectedAmountDiff > 0.009 &&
    selectedAmountDiff <= syncTol

  const apply = async (conflictResolution?: StatementLineConflictResolution) => {
    if (!context || !user?.email) {
      setMessage(t('needLogin'))
      return
    }
    let ordered = dedupeStatementLineIdsPreserveOrder(selectedIdsOrdered)
    if (appendLink) {
      ordered = ordered.filter((id) => !linkedLineIdSet.has(id))
    }
    if (ordered.length === 0) {
      setMessage(t('needSelectLine'))
      return
    }
    if (!appendLink && ordered.length > 1 && !allowTicketMultiLink) {
      setMessage(t('replaceSelectSingleOnly'))
      return
    }
    if (hasLineConflict && !conflictResolution) {
      setMessage(t('lineConflictNeedChoice'))
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const ledgerCap = Math.abs(context.amount)
      const email = user.email

      if (!appendLink && allowTicketMultiLink && ordered.length > 1) {
        const linePlans: { lineId: string; row: SimilarStatementLineRow; amount: number }[] = []
        for (const lineId of ordered) {
          const row = rowById.get(lineId)
          if (!row) continue
          const amount = lineMatchableAmount(row)
          if (amount <= 0.009) continue
          linePlans.push({ lineId, row, amount })
        }
        if (linePlans.length === 0) {
          setMessage(t('needSelectLine'))
          return
        }
        const multiCap = linePlans.reduce((sum, p) => sum + p.amount, 0)
        for (let i = 0; i < linePlans.length; i++) {
          const { lineId, row, amount } = linePlans[i]!
          await replaceExpenseReconciliationMatch(supabase, {
            actorEmail: email,
            sourceTable: context.sourceTable,
            sourceId: context.sourceId,
            statementLineId: lineId,
            statementLineAmount: row.amount,
            matchedAmount: amount,
            linkMode: i === 0 ? 'replace' : 'append',
            ledgerCapAmount: multiCap,
            syncSourceAmountToStatement: false,
          })
        }
        onApplied?.()
        onOpenChange(false)
        return
      }

      if (!appendLink) {
        const row = rowById.get(ordered[0]!)
        if (!row) {
          setMessage(t('saveError'))
          return
        }
        if (conflictResolution) {
          const result = await resolveStatementLineConflictsBeforeLink(supabase, {
            statementLineId: row.id,
            keepSourceTable: context.sourceTable,
            keepSourceId: context.sourceId,
            resolution: conflictResolution,
            actorEmail: email
          })
          if (
            conflictResolution === 'unlinkAndDeleteOthers' &&
            result.skippedDeleteCount > 0
          ) {
            setMessage(t('lineConflictDeleteSkipped', { n: result.skippedDeleteCount }))
          }
        }
        const diff = Math.abs(Math.abs(row.amount) - ledgerCap)
        const stol = expenseReconciliationAmountTolerance(ledgerCap)
        const canSync =
          context.sourceTable !== 'payment_records' && diff > 0.009 && diff <= stol
        const lineAbs = Math.abs(row.amount)
        const lineRoom = Math.max(0, lineAbs - row.allocated_sum)
        const matchedAmount =
          lineRoom > 0.009 ? Math.min(ledgerCap, lineRoom) : ledgerCap

        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: row.id,
          statementLineAmount: row.amount,
          matchedAmount,
          linkMode: 'replace',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: canSync && syncAmountToStatement
        })
        onApplied?.()
        onOpenChange(false)
        return
      }

      if (ordered.length === 1) {
        const row = rowById.get(ordered[0]!)
        if (!row) {
          setMessage(t('saveError'))
          return
        }
        if (conflictResolution) {
          const result = await resolveStatementLineConflictsBeforeLink(supabase, {
            statementLineId: row.id,
            keepSourceTable: context.sourceTable,
            keepSourceId: context.sourceId,
            resolution: conflictResolution,
            actorEmail: email,
          })
          if (
            conflictResolution === 'unlinkAndDeleteOthers' &&
            result.skippedDeleteCount > 0
          ) {
            setMessage(t('lineConflictDeleteSkipped', { n: result.skippedDeleteCount }))
          }
        }
        let allocSum =
          sourceAllocatedSum ??
          (await sumMatchedAmountAllocatedToSource(supabase, context.sourceTable, context.sourceId))
        if (conflictResolution) {
          allocSum = await sumMatchedAmountAllocatedToSource(
            supabase,
            context.sourceTable,
            context.sourceId
          )
        }
        const matchedAmount = computeAppendShareAmount({
          row,
          ledgerCap,
          sourceAllocatedSum: allocSum,
          selfAllocOnLine: sourceAllocByLineId.get(row.id) ?? 0,
          treatLineFreedByConflict: Boolean(conflictResolution) || hasLineConflict,
          manualStr: appendAmountStr,
        })
        if (matchedAmount == null) {
          setMessage(t('appendAmountInvalid'))
          return
        }
        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: row.id,
          statementLineAmount: row.amount,
          matchedAmount,
          linkMode: 'append',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: false
        })
        onApplied?.()
        onOpenChange(false)
        return
      }

      // 입금(환불) 줄은 잔여 한도와 무관하게 먼저 연결(순 배정을 줄임), 이후 출금 줄을 남은 한도만큼 배정
      const orderedRows = ordered
        .map((lineId) => ({ lineId, row: rowById.get(lineId) }))
        .filter((x): x is { lineId: string; row: SimilarStatementLineRow } => Boolean(x.row))
      const inflowFirst = [
        ...orderedRows.filter((x) => String(x.row.direction).toLowerCase() === 'inflow'),
        ...orderedRows.filter((x) => String(x.row.direction).toLowerCase() !== 'inflow'),
      ]

      if (conflictResolution && ordered.length === 1) {
        const row = rowById.get(ordered[0]!)
        if (row) {
          const result = await resolveStatementLineConflictsBeforeLink(supabase, {
            statementLineId: row.id,
            keepSourceTable: context.sourceTable,
            keepSourceId: context.sourceId,
            resolution: conflictResolution,
            actorEmail: email,
          })
          if (
            conflictResolution === 'unlinkAndDeleteOthers' &&
            result.skippedDeleteCount > 0
          ) {
            setMessage(t('lineConflictDeleteSkipped', { n: result.skippedDeleteCount }))
          }
        }
      }

      for (const { lineId, row } of inflowFirst) {
        const isInflow = String(row.direction).toLowerCase() === 'inflow'
        const lineAbs = Math.abs(row.amount)
        const lineRoom = Math.max(0, lineAbs - row.allocated_sum)
        const capTol = Math.max(0.5, ledgerCap * 0.001)

        let share: number
        if (isInflow) {
          share = lineRoom
        } else {
          const allocated = await sumMatchedAmountAllocatedToSource(supabase, context.sourceTable, context.sourceId)
          const remaining = ledgerCap - allocated
          if (remaining <= capTol) continue
          share = Math.min(remaining, lineRoom)
        }
        if (share <= capTol) continue

        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: lineId,
          statementLineAmount: row.amount,
          matchedAmount: share,
          linkMode: 'append',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: false
        })
      }

      onApplied?.()
      onOpenChange(false)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  const formatMatchLabel = (m: { source_table: string; source_id: string }) => {
    const k = sourceTableLabelKey(m.source_table)
    const typeName = t(`sourceTypes.${k}`)
    return `${typeName} · ${m.source_id.slice(0, 8)}…`
  }

  const tableName = context ? t(`sourceTypes.${sourceTableLabelKey(context.sourceTable)}`) : ''
  const dirLabel = context
    ? ticketDateProbe
      ? `${t('dirOut')} · ${t('dirIn')}`
      : context.direction === 'inflow'
        ? t('dirIn')
        : t('dirOut')
    : ''

  const paymentMethodDisplay = useMemo(() => {
    const raw = sourceSummary?.paymentMethod
    if (raw == null || String(raw).trim() === '') return null
    const key = String(raw).trim()
    return paymentMethodMap[key] ?? key
  }, [sourceSummary?.paymentMethod, paymentMethodMap])

  const linkedFinancialAccountDisplay = useMemo(() => {
    const raw = sourceSummary?.paymentMethod
    if (raw == null || String(raw).trim() === '') return null
    const key = String(raw).trim()
    return (
      paymentMethodFinancialAccountNameByPmId[key] ?? paymentMethodFinancialAccountNameByMethodKey[key] ?? null
    )
  }, [
    sourceSummary?.paymentMethod,
    paymentMethodFinancialAccountNameByPmId,
    paymentMethodFinancialAccountNameByMethodKey
  ])

  const preferredAccountTabId = useMemo(() => {
    const probeId = ticketDateProbe?.financialAccountId?.trim()
    if (probeId && accountTabs.some((tab) => tab.id === probeId)) return probeId
    const linkedName = linkedFinancialAccountDisplay?.trim()
    if (linkedName) {
      const byName = accountTabs.find((tab) => tab.name === linkedName)
      if (byName) return byName.id
    }
    if (accountTabs.length === 1) return accountTabs[0]!.id
    return ACCOUNT_TAB_ALL
  }, [ticketDateProbe?.financialAccountId, accountTabs, linkedFinancialAccountDisplay])

  useEffect(() => {
    if (!open) return
    setActiveAccountTab((prev) => (prev === preferredAccountTabId ? prev : preferredAccountTabId))
  }, [open, context?.sourceId, preferredAccountTabId])

  useEffect(() => {
    if (activeAccountTab === ACCOUNT_TAB_ALL) return
    if (!accountTabs.some((tab) => tab.id === activeAccountTab)) {
      setActiveAccountTab(ACCOUNT_TAB_ALL)
    }
  }, [activeAccountTab, accountTabs])

  const showAccountTabs = accountTabs.length > 0
  const linkedLineIdSet = useMemo(() => new Set(linkedRows.map((r) => r.id)), [linkedRows])

  const isTicketBookingSource = context?.sourceTable === 'ticket_bookings'
  const linkedTourHeadline = useMemo(() => {
    if (!sourceSummary?.linkedTour) return null
    return formatTicketBookingTourHeadline(
      locale,
      sourceSummary.linkedTour,
      t('sourceTypes.ticketBookings'),
      { appendPeople: true }
    )
  }, [sourceSummary?.linkedTour, locale, t])
  const linkedTourDateYmd = useMemo(() => {
    const raw = sourceSummary?.linkedTour?.tour_date
    if (raw == null) return null
    const s = String(raw).trim()
    return s.length >= 10 ? s.slice(0, 10) : s || null
  }, [sourceSummary?.linkedTour?.tour_date])

  const showCurrentLinksPanel =
    linkedRows.length > 0 || (isTicketBookingSource && sourceSummary != null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={nestedElevated ? 'z-[1300]' : undefined}
        className={`max-h-[88vh] w-full max-w-[min(98vw,88rem)] flex flex-col gap-0 overflow-hidden p-4 sm:p-6${nestedElevated ? ' z-[1300]' : ''}`}
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{t('modalTitle')}</DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">{t('modalHint')}</p>
          <p className="text-xs text-muted-foreground pt-0.5">{t('modalSplitHint')}</p>
          <p className="text-xs text-muted-foreground pt-0.5">{t('modalMultiLineHint')}</p>
        </DialogHeader>

        {context ? (
          <div className="shrink-0 max-h-[min(42vh,16rem)] overflow-y-auto space-y-1.5 border-b pb-2 mb-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('ledgerSummary', {
                table: tableName,
                date: context.dateYmd,
                amount: context.amount.toFixed(2),
                dir: dirLabel
              })}
            </p>
            {!isTicketBookingSource && sourceSummary?.primaryDetail ? (
              <p className="text-[11px] text-muted-foreground leading-snug truncate" title={sourceSummary.primaryDetail}>
                {t('sourcePrimaryDetail')}: {sourceSummary.primaryDetail}
              </p>
            ) : null}
            {!isTicketBookingSource && sourceSummary?.secondaryDetail ? (
              <p className="text-[11px] text-muted-foreground leading-snug truncate" title={sourceSummary.secondaryDetail}>
                {t('sourceSecondaryDetail')}: {sourceSummary.secondaryDetail}
              </p>
            ) : null}
            {!isTicketBookingSource && sourceSummary?.rnNumber ? (
              <p className="text-[11px] text-muted-foreground leading-snug tabular-nums" title={sourceSummary.rnNumber}>
                {t('sourceRnNumber')}: {sourceSummary.rnNumber}
              </p>
            ) : null}
            {sourceSummary?.checkInDate ? (
              <p className="text-[11px] text-muted-foreground leading-snug tabular-nums">
                {t('sourceHotelCheckIn')}: {sourceSummary.checkInDate}
              </p>
            ) : null}
            {sourceSummary?.checkOutDate ? (
              <p className="text-[11px] text-muted-foreground leading-snug tabular-nums">
                {t('sourceHotelCheckOut')}: {sourceSummary.checkOutDate}
              </p>
            ) : null}
            {paymentMethodDisplay ? (
              <p
                className="text-[11px] text-muted-foreground leading-snug truncate"
                title={
                  linkedFinancialAccountDisplay
                    ? `${paymentMethodDisplay} · ${linkedFinancialAccountDisplay}`
                    : paymentMethodDisplay
                }
              >
                {t('sourcePaymentMethod')}: {paymentMethodDisplay}
                <span className="text-muted-foreground/90">
                  {' '}
                  · {t('sourceLinkedFinancialAccount')}: {linkedFinancialAccountDisplay ?? t('noLinks')}
                </span>
              </p>
            ) : null}
            {showCurrentLinksPanel ? (
              <div className="rounded-md border border-emerald-300/80 bg-emerald-50/60 px-3 py-2 space-y-2">
                {isTicketBookingSource && sourceSummary ? (
                  <div className="rounded border border-emerald-200/90 bg-white/95 px-2.5 py-2 space-y-1.5">
                    <p className="text-[11px] font-semibold text-emerald-950">
                      {t('sourceTypes.ticketBookings')}
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] leading-snug">
                      {sourceSummary.primaryDetail ? (
                        <>
                          <dt className="text-muted-foreground shrink-0">{t('sourcePrimaryDetail')}</dt>
                          <dd className="min-w-0 break-words font-medium">{sourceSummary.primaryDetail}</dd>
                        </>
                      ) : null}
                      {sourceSummary.secondaryDetail ? (
                        <>
                          <dt className="text-muted-foreground shrink-0">{t('sourceSecondaryDetail')}</dt>
                          <dd className="min-w-0 break-words">{sourceSummary.secondaryDetail}</dd>
                        </>
                      ) : null}
                      {sourceSummary.submitOn ? (
                        <>
                          <dt className="text-muted-foreground shrink-0 tabular-nums">{t('sourceSubmitOn')}</dt>
                          <dd className="tabular-nums font-medium">{sourceSummary.submitOn}</dd>
                        </>
                      ) : null}
                      {sourceSummary.ticketCheckInDate ? (
                        <>
                          <dt className="text-muted-foreground shrink-0 tabular-nums">{t('sourceCheckIn')}</dt>
                          <dd className="tabular-nums">{sourceSummary.ticketCheckInDate}</dd>
                        </>
                      ) : null}
                      {linkedTourDateYmd ? (
                        <>
                          <dt className="text-muted-foreground shrink-0 tabular-nums">{t('sourceTourDate')}</dt>
                          <dd className="tabular-nums">{linkedTourDateYmd}</dd>
                        </>
                      ) : null}
                      {sourceSummary.rnNumber ? (
                        <>
                          <dt className="text-muted-foreground shrink-0 tabular-nums">{t('sourceRnNumber')}</dt>
                          <dd className="tabular-nums">{sourceSummary.rnNumber}</dd>
                        </>
                      ) : null}
                      {sourceSummary.ledgerExpense != null && sourceSummary.ledgerExpense > 0 ? (
                        <>
                          <dt className="text-muted-foreground shrink-0 tabular-nums">{t('sourceLedgerExpense')}</dt>
                          <dd className="tabular-nums font-medium">${sourceSummary.ledgerExpense.toFixed(2)}</dd>
                        </>
                      ) : null}
                      <dt className="text-muted-foreground shrink-0">{t('sourceLinkedTour')}</dt>
                      <dd className="min-w-0 break-words font-medium text-emerald-900">
                        {linkedTourHeadline ?? t('sourceLinkedTourNone')}
                      </dd>
                    </dl>
                  </div>
                ) : null}
                {linkedRows.length > 0 ? (
                  <>
                <p className="text-xs font-semibold text-emerald-900">
                  {t('currentLinksTitle')} · {t('currentLinksCount', { count: linkedRows.length })}
                </p>
                <p className="text-[11px] text-emerald-900/85 leading-snug">{t('currentLinksHint')}</p>
                <ul className="space-y-1.5">
                  {linkedRows.map((r) => {
                    const alloc = r.source_linked_amount ?? sourceAllocByLineId.get(r.id)
                    const dirOut = String(r.direction).toLowerCase() !== 'inflow'
                    return (
                      <li
                        key={r.id}
                        className="rounded border border-emerald-200/90 bg-white/95 px-2.5 py-2 text-[11px] leading-snug text-gray-900"
                      >
                        <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium tabular-nums">
                          <span>{r.financial_account_name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{r.posted_date}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className={dirOut ? 'text-rose-800' : 'text-emerald-700'}>
                            {statementLineSignedAmountLabel(r)}
                          </span>
                          {alloc != null ? (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-emerald-800">
                                {t('currentLinkAllocated')}: ${alloc.toFixed(2)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[10px] text-red-700 hover:bg-red-50 hover:text-red-800"
                          disabled={unlinkingLineId === unlinkRowKey(r) || saving}
                          title={t('unlinkStatementMatch')}
                          aria-label={t('unlinkStatementMatchAria')}
                          onClick={(e) => {
                            e.stopPropagation()
                            void unlinkCurrentLink(r)
                          }}
                        >
                          {unlinkingLineId === unlinkRowKey(r) ? t('saving') : t('unlinkStatementMatch')}
                        </Button>
                        </div>
                        <p className="mt-1 text-muted-foreground break-words">{r.description || '—'}</p>
                      </li>
                    )
                  })}
                </ul>
                  </>
                ) : isTicketBookingSource ? (
                  <p className="text-[11px] text-emerald-900/85 leading-snug">{t('currentLinksEmpty')}</p>
                ) : null}
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground leading-snug">
              {ticketDateProbe
                ? t('ticketBookingDateProbeHint', {
                    window: ticketDateProbe.dayWindow ?? 3,
                    submit: ticketDateProbe.submitYmd || '—',
                    checkIn: ticketDateProbe.checkInYmd || '—',
                    account: ticketDateProbe.financialAccountId
                      ? t('ticketBookingDateProbeAccountLinked')
                      : t('ticketBookingDateProbeAccountAll')
                  })
                : matchMode === 'amountOnly'
                  ? t('amountOnlyModeHint')
                  : t('dateProximityModeHint')}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">{t('searchGlobalHint')}</p>
            {allowTicketMultiLink ? (
              <p className="text-[11px] text-muted-foreground leading-snug">{t('ticketBookingMultiLinkHint')}</p>
            ) : null}
            {appendLink ? (
              <div className="space-y-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-[11px] text-muted-foreground">
                {remainingOnLedger != null && sourceAllocatedSum != null ? (
                  <p className="tabular-nums leading-snug">
                    {t('appendRemaining', {
                      allocated: sourceAllocatedSum.toFixed(2),
                      total: ledgerTotalAbs.toFixed(2),
                      remaining: remainingOnLedger.toFixed(2)
                    })}
                  </p>
                ) : (
                  <p>{t('loading')}</p>
                )}
                {selectedIdsOrdered.length > 1 ? (
                  <p className="text-emerald-950/90 leading-snug">{t('multiAppendHint')}</p>
                ) : (
                  <label className="flex flex-col gap-0.5 max-w-[14rem]">
                    <span className="text-foreground/90">{t('appendShareLabel')}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="h-8 text-xs tabular-nums"
                      value={appendAmountStr}
                      onChange={(e) => {
                        appendAmountUserEditedRef.current = true
                        setAppendAmountStr(e.target.value)
                      }}
                    />
                  </label>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="shrink-0 z-10 bg-white border-b mb-2 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {!ticketDateProbe ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant={matchMode === 'dateProximity' ? 'default' : 'outline'}
                    disabled={loading || !context}
                    onClick={() => {
                      setMatchMode('dateProximity')
                    }}
                  >
                    {t('matchModeDateProximity')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={matchMode === 'amountOnly' ? 'default' : 'outline'}
                    disabled={loading || !context}
                    onClick={() => {
                      setMatchMode('amountOnly')
                    }}
                  >
                    {t('matchModeAmountOnly')}
                  </Button>
                </>
              ) : null}
            </div>
            <div className="w-full sm:flex-1 sm:min-w-[10rem] sm:max-w-md">
              <Input
                type="search"
                value={rowSearch}
                onChange={(e) => setRowSearch(e.target.value)}
                placeholder={t('searchRowsPlaceholder')}
                className="h-9 text-sm"
                disabled={!context}
              />
            </div>
          </div>
          {showAccountTabs ? (
            <div
              className="flex gap-1 overflow-x-auto overscroll-x-contain border-b border-gray-200 pb-px -mx-0.5 px-0.5"
              role="tablist"
              aria-label={t('accountTabsLabel')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeAccountTab === ACCOUNT_TAB_ALL}
                onClick={() => setActiveAccountTab(ACCOUNT_TAB_ALL)}
                className={`shrink-0 rounded-t-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeAccountTab === ACCOUNT_TAB_ALL
                    ? 'border-gray-200 border-b-white bg-white text-blue-700 shadow-sm -mb-px z-[1]'
                    : 'border-transparent bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {t('accountTabAll', { count: sourceRows.length })}
              </button>
              {accountTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeAccountTab === tab.id}
                  onClick={() => setActiveAccountTab(tab.id)}
                  className={`shrink-0 max-w-[14rem] truncate rounded-t-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeAccountTab === tab.id
                      ? 'border-gray-200 border-b-white bg-white text-blue-700 shadow-sm -mb-px z-[1]'
                      : 'border-transparent bg-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={tab.name}
                >
                  {t('accountTabNamed', { name: tab.name, count: tab.count })}
                </button>
              ))}
            </div>
          ) : null}
          {!loading && !isSearchActive && rows.length > 0 ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {t('similarCandidatesCount', { count: visibleRows.length })}
              {activeAccountTab !== ACCOUNT_TAB_ALL && sourceRows.length !== visibleRows.length
                ? ` · ${t('accountTabFilteredFrom', { total: sourceRows.length })}`
                : ''}
            </p>
          ) : null}
          {isSearchActive && !searchLoading ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {t('searchResultsCount', { count: visibleRows.length })}
              {activeAccountTab !== ACCOUNT_TAB_ALL && sourceRows.length !== visibleRows.length
                ? ` · ${t('accountTabFilteredFrom', { total: sourceRows.length })}`
                : ''}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 space-y-2 mb-2 max-h-[min(24vh,10rem)] overflow-y-auto">
        {message ? <div className="text-sm text-red-600">{message}</div> : null}

        {selectedIdsOrdered.length > 0 ? (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {t('selectedLinesCount', { n: selectedIdsOrdered.length })}
          </p>
        ) : null}

        {canSyncAmount ? (
          <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={syncAmountToStatement}
              onChange={(e) => setSyncAmountToStatement(e.target.checked)}
            />
            <span>
              {t('syncAmountCheckbox', {
                ledger: (context?.amount ?? 0).toFixed(2),
                statement: Math.abs(selectedRow?.amount ?? 0).toFixed(2)
              })}
            </span>
          </label>
        ) : null}

        {hasLineConflict ? (
          <div className="space-y-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-950">
            <p className="font-semibold leading-snug">{t('lineConflictTitle')}</p>
            {lineFullyAllocatedByOthers ? (
              <p className="leading-snug">{t('lineConflictFullyAllocated')}</p>
            ) : null}
            {conflictDetailsLoading ? (
              <p className="text-[11px] text-red-900/80">{t('lineConflictDetailLoading')}</p>
            ) : null}
            <div className="space-y-2">
              {(conflictDetails.length > 0
                ? conflictDetails
                : conflictingOnSelectedLine.map((m) => ({
                    source_table: m.source_table,
                    source_id: m.source_id,
                    matched_amount: null,
                    ledger_amount: 0,
                    date_primary_ymd: '',
                    date_secondary_ymd: null,
                    paid_to: '—',
                    paid_for: '—',
                    description: null,
                    payment_method: null,
                    rn_number: null,
                    check_in_date_ymd: null,
                    tour_date_ymd: null,
                  }))
              ).map((d) => {
                const pmKey = d.payment_method?.trim() ?? ''
                const pmLabel = pmKey
                  ? paymentMethodMap[pmKey] ??
                    paymentMethodFinancialAccountNameByPmId[pmKey] ??
                    pmKey
                  : null
                const typeName = t(
                  `sourceTypes.${sourceTableLabelKey(d.source_table)}`
                )
                const { headline, rows } = formatLedgerMatchDetailLines(
                  d,
                  { ...detailLabelBundle, sourceType: typeName },
                  pmLabel
                )
                return (
                  <div
                    key={`${d.source_table}:${d.source_id}`}
                    className="rounded-md border border-red-300/80 bg-white/90 px-2.5 py-2 text-[11px] leading-snug text-gray-900 shadow-sm"
                  >
                    <p className="font-semibold text-red-950 tabular-nums">{headline}</p>
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                      {rows.map((row) => (
                        <Fragment key={`${row.label}-${row.value}`}>
                          <dt className="text-gray-500 shrink-0">{row.label}</dt>
                          <dd className="min-w-0 break-words font-medium">{row.value}</dd>
                        </Fragment>
                      ))}
                    </dl>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] leading-snug text-red-900/90">{t('lineConflictHint')}</p>
          </div>
        ) : null}
        </div>

        <div className="flex-1 min-h-[10rem] overflow-auto rounded-md border">
          {loading || (isSearchActive && searchLoading) ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : !isSearchActive && rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : visibleRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{isSearchActive ? t('noSearchResults') : t('accountTabEmpty')}</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-muted sticky top-0 z-[1]">
                <tr>
                  <th className="text-center p-2 font-medium w-11">
                    <input
                      ref={headerSelectAllRef}
                      type="checkbox"
                      className="accent-emerald-600"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      aria-label={t('selectAllVisible')}
                    />
                  </th>
                  <th className="text-left p-2 font-medium">{t('colAccount')}</th>
                  <th className="text-left p-2 font-medium">{t('colDate')}</th>
                  {ticketDateProbe ? (
                    <th className="text-left p-2 font-medium whitespace-nowrap">{t('colDirection')}</th>
                  ) : null}
                  <th className="text-right p-2 font-medium">{t('colAmount')}</th>
                  <th className="text-right p-2 font-medium whitespace-nowrap">{t('colAllocatedSum')}</th>
                  <th className="text-left p-2 font-medium">{t('colDesc')}</th>
                  <th className="text-left p-2 font-medium">{t('colStatus')}</th>
                  <th className="text-left p-2 font-medium min-w-[20rem] w-[28rem]">{t('colLinked')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const isCurrentLink = linkedLineIdSet.has(r.id)
                  const sourceAlloc = r.source_linked_amount ?? sourceAllocByLineId.get(r.id)
                  const rowKey = r.reconciliation_match_id || `${r.id}-${sourceAlloc}`
                  return (
                  <tr
                    key={rowKey}
                    className={`border-t cursor-pointer hover:bg-muted/50 ${
                      selectedIdsOrdered.includes(r.id)
                        ? 'bg-emerald-50'
                        : isCurrentLink
                          ? 'bg-emerald-50/60'
                          : ''
                    }`}
                    onClick={() => toggleLineId(r.id)}
                  >
                    <td className="p-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-emerald-600"
                        checked={selectedIdsOrdered.includes(r.id)}
                        onChange={() => toggleLineId(r.id)}
                      />
                    </td>
                    <td className="p-2 max-w-[9rem] truncate align-middle" title={r.financial_account_name}>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        {isCurrentLink ? (
                          <span className="inline-flex flex-wrap items-center gap-1">
                            <span className="inline-flex w-fit rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                              {t('currentLinkBadge')}
                            </span>
                            <button
                              type="button"
                              className="text-[10px] font-medium text-red-700 underline decoration-red-300 hover:text-red-900 disabled:opacity-50"
                              disabled={unlinkingLineId === unlinkRowKey(r) || saving}
                              title={t('unlinkStatementMatch')}
                              onClick={(e) => {
                                e.stopPropagation()
                                void unlinkCurrentLink(r)
                              }}
                            >
                              {unlinkingLineId === unlinkRowKey(r) ? t('saving') : t('unlinkStatementMatch')}
                            </button>
                          </span>
                        ) : null}
                        <span className="truncate">{r.financial_account_name}</span>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap align-middle">{r.posted_date}</td>
                    {ticketDateProbe ? (
                      <td className="p-2 whitespace-nowrap align-middle text-xs">
                        <span
                          className={
                            String(r.direction).toLowerCase() === 'inflow'
                              ? 'text-emerald-700 font-medium'
                              : 'text-rose-800 font-medium'
                          }
                        >
                          {String(r.direction).toLowerCase() === 'inflow' ? t('dirIn') : t('dirOut')}
                        </span>
                      </td>
                    ) : null}
                    <td
                      className={`p-2 text-right tabular-nums align-middle ${
                        String(r.direction).toLowerCase() === 'inflow' ? 'text-emerald-700' : ''
                      }`}
                    >
                      {statementLineSignedAmountLabel(r)}
                    </td>
                    <td className="p-2 text-right tabular-nums text-xs text-muted-foreground align-middle whitespace-nowrap">
                      {r.existing_matches.length > 0 ? (
                        <>
                          ${r.allocated_sum.toFixed(2)} / ${Math.abs(r.amount).toFixed(2)}
                          {isCurrentLink && sourceAlloc != null ? (
                            <div className="text-[10px] text-emerald-800 font-medium">
                              {t('currentLinkAllocated')}: ${sourceAlloc.toFixed(2)}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        t('noLinks')
                      )}
                    </td>
                    <td className="p-2 max-w-[14rem] truncate align-middle" title={r.description}>
                      {r.description}
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs align-middle">
                      {r.matched_status === 'unmatched'
                        ? t('statusUnmatched')
                        : r.matched_status === 'partial'
                          ? t('statusPartial')
                          : t('statusMatched')}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground min-w-[20rem] w-[28rem] max-w-[32rem] align-top">
                      {r.existing_matches.length === 0 ? (
                        t('noLinks')
                      ) : linkedMatchDetailsLoading &&
                        r.existing_matches.some(
                          (m) => !linkedMatchDetailsByKey.has(`${m.source_table}:${m.source_id}`)
                        ) ? (
                        <p className="text-[10px] text-muted-foreground py-1">{t('colLinkedDetailLoading')}</p>
                      ) : (
                        <div className="space-y-0">
                          {r.existing_matches.map((m, i) => (
                            <StatementTableLinkedMatchCell
                              key={`${m.source_table}-${m.source_id}-${i}`}
                              match={m}
                              detail={linkedMatchDetailsByKey.get(`${m.source_table}:${m.source_id}`)}
                              labels={detailLabelBundle}
                              paymentMethodMap={paymentMethodMap}
                              paymentMethodFinancialAccountNameByPmId={
                                paymentMethodFinancialAccountNameByPmId
                              }
                              fallbackLabel={formatMatchLabel(m)}
                              sourceTypeLabel={(table) =>
                                t(`sourceTypes.${sourceTableLabelKey(table)}`)
                              }
                            />
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t mt-2">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:mr-auto">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
            <label className="flex min-w-0 flex-1 items-start gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground leading-snug cursor-pointer sm:max-w-[28rem]">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 accent-emerald-600"
                checked={appendLink}
                onChange={(e) => setAppendLink(e.target.checked)}
              />
              <span>{t('appendLinkCheckbox')}</span>
            </label>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2">
          {hasLineConflict ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={selectedIdsOrdered.length === 0 || saving}
                onClick={() => void apply('unlinkOthers')}
              >
                {saving ? t('saving') : t('connectUnlinkOthers')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={selectedIdsOrdered.length === 0 || saving}
                onClick={() => void apply('unlinkAndDeleteOthers')}
              >
                {saving ? t('saving') : t('connectDeleteOthers')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={
                selectedIdsOrdered.length === 0 ||
                saving ||
                (appendLink &&
                  !anySelectedInflow &&
                  remainingOnLedger != null &&
                  remainingOnLedger < 0.01)
              }
              onClick={() => void apply()}
            >
              {saving
                ? t('saving')
                : allowTicketMultiLink && selectedLineCount > 1
                  ? t('connectTicketMultiN', { n: selectedLineCount })
                  : appendLink && selectedIdsOrdered.length > 1
                    ? t('connectAppendN', {
                        n: dedupeStatementLineIdsPreserveOrder(selectedIdsOrdered).length
                      })
                    : appendLink
                      ? t('connectAppend')
                      : t('connect')}
            </Button>
          )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
