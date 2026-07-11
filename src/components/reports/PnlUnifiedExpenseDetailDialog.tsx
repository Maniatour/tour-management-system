'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Archive,
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Link2,
  ExternalLink,
  Search,
  Ban,
  User,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { deleteExpenseBySourceKey, type TourReferenceSnapshot } from '@/lib/expense-unified-duplicate-scan'
import {
  BULK_COMPANY_DUP_AMOUNT_EPS,
  BULK_COMPANY_DUP_DAY_WINDOW,
} from '@/lib/statement-bulk-company-duplicate-check'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import {
  buildDuplicateGroupStyleByKey,
  duplicateExtraKeysToSelect,
  findPnlDetailDuplicateGroups,
  pnlDetailLineKey,
} from '@/lib/pnl-expense-detail-duplicates'
import {
  addDismissedDuplicateKeys,
  removeDismissedDuplicateKeys,
} from '@/lib/pnlDuplicateDismissals'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  applyStandardLeafToCompanyExpense,
  type UnifiedStandardLeafGroup,
} from '@/lib/companyExpenseStandardUnified'
import { PNL_UNMATCHED_BUCKET_KEY, splitMappingIdsFromLeafId } from '@/lib/pnlStandardCategoryTable'
import { PNL_TOUR_HOTEL_BOOKING_MAPPING_ORIGINAL } from '@/lib/pnlReportDataFetch'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { StatementReconciledBadge } from '@/components/reconciliation/StatementReconciledBadge'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseReconciliationExemptToggle from '@/components/reconciliation/ExpenseReconciliationExemptToggle'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import {
  bulkSetExpenseReconciliationExempt,
  expenseReconExemptSourceSupported,
} from '@/lib/expense-reconciliation-exemptions'
import ExpenseStatementBulkAutoMatchModal from '@/components/reconciliation/ExpenseStatementBulkAutoMatchModal'
import { ReservationDetailModalContent } from '@/components/reservation/ReservationDetailModalContent'
import { TourDetailModalContent } from '@/components/tour/TourDetailModalContent'
import type { ExpenseAutoMatchInputRow } from '@/lib/expense-statement-auto-match'
import type { ExpenseStatementReconContext, ExpenseReconSourceTable } from '@/lib/expense-reconciliation-similar-lines'
import {
  buildTicketBookingStatementReconContextResolved,
  isTicketBookingStatementReconDisabled,
} from '@/lib/ticket-booking-statement-recon'

/** 지출 상세(z-1200)·명세 모달(z-1300) 위에 투어/예약 상세를 포털로 띄울 때 */
const PNL_NESTED_DETAIL_OVERLAY_CLASS = 'z-[1500] pointer-events-auto'
const PNL_NESTED_DETAIL_CONTENT_CLASS =
  'z-[1500] w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg'

/** iframe·임베드 모달 — 포커스가 Dialog DOM 밖으로 나가면 Radix가 닫지 않게 */
function preventNestedDetailDialogDismiss(e: Event) {
  e.preventDefault()
}

export type PnlExpenseSource =
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'company_expenses'
  | 'ticket_bookings'
  | 'tour_hotel_bookings'

const PNL_EXPENSE_SOURCES: PnlExpenseSource[] = [
  'tour_expenses',
  'reservation_expenses',
  'company_expenses',
  'ticket_bookings',
  'tour_hotel_bookings',
]

export type PnlDetailLine = {
  id: string
  source: PnlExpenseSource
  /** 표 집계·드릴 키: 표준 리프 id 또는 미매칭 버킷 */
  bucketKey: string
  /** 매핑에서 해석된 리프(또는 상위만 지정 시 상위 id) */
  resolvedLeafId: string | null
  /** expense_category_mappings.original_value 와 동일 */
  mappingOriginalValue: string
  yearMonth: string
  amount: number
  submit_on: string | null
  /** PNL 집계 기준 투어일·체크인·회계기간(YYYY-MM-DD). 없으면 null */
  tour_date_ymd: string | null
  /** 연결 투어 — 중복 판별·비교용 */
  tour_id: string | null
  reservation_id: string | null
  /** 입장권 RN 등 */
  rn_number: string | null
  /** 호텔 부킹 객실 수 */
  booking_rooms: number | null
  /** tour_id 기준 상품·가이드·어시·인원 요약 */
  tour_reference: TourReferenceSnapshot | null
  /** 시스템 등록(입력) 시각 */
  created_at: string | null
  paid_to: string | null
  paid_for: string | null
  /** payment_methods.id 등 — 표시는 paymentMethodMap으로 해석 */
  payment_method: string | null
  /** reconciliation_matches 에 명세 줄과 연결됨 */
  statementReconciled: boolean
  /** expense_reconciliation_exemptions — 명세·현금 대조 불필요 표시 */
  statementReconExempt?: boolean
  category: string | null
  company: string | null
  note: string | null
  exclude_from_pnl: boolean
}

type PnlDetailSortKey = 'submit_on' | 'created_at' | 'amount'

const PNL_DETAIL_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const PNL_DETAIL_DEFAULT_PAGE_SIZE = 25

export type PnlDrillMode = 'cell' | 'row' | 'col' | 'grand' | 'excluded' | 'unmatched' | 'duplicates'

export type PnlDrillState =
  | { mode: 'cell'; rowId: string; month: string; rowTitle?: string }
  | { mode: 'row'; rowId: string; rowTitle?: string }
  | { mode: 'col'; month: string }
  | { mode: 'grand' }
  | { mode: 'excluded' }
  | { mode: 'unmatched' }
  | { mode: 'duplicates' }

export type PnlLineReconExemptPatch = {
  source: PnlExpenseSource
  id: string
  exempt: boolean
}

function pnlDrillResetKey(drill: PnlDrillState | null): string {
  if (!drill) return ''
  switch (drill.mode) {
    case 'cell':
      return `cell:${drill.rowId}:${drill.month}`
    case 'row':
      return `row:${drill.rowId}`
    case 'col':
      return `col:${drill.month}`
    default:
      return drill.mode
  }
}

function isoToYmd(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isPnlLineStmtReconDisabled(line: PnlDetailLine): boolean {
  if (line.source === 'ticket_bookings') {
    return isTicketBookingStatementReconDisabled({
      id: line.id,
      submit_on: line.submit_on,
      check_in_date: line.tour_date_ymd,
      expense: line.amount,
      payment_method: line.payment_method,
    })
  }
  if (line.source === 'tour_hotel_bookings') {
    const ymd = isoToYmd(line.submit_on) || line.tour_date_ymd || ''
    return !ymd || Math.abs(line.amount) <= 0
  }
  const submitYmd = isoToYmd(line.submit_on)
  return !submitYmd || Math.abs(line.amount) <= 0
}

/** 명세 연결 또는 «대조 불필요» — 세금 보고 커버리지·미대조 목록에서 제외 */
export function isPnlLineStatementReconCovered(line: PnlDetailLine): boolean {
  return line.statementReconciled || line.statementReconExempt === true
}

const PNL_AUTO_MATCH_SOURCES = new Set<PnlExpenseSource>([
  'tour_expenses',
  'reservation_expenses',
  'company_expenses',
  'ticket_bookings',
  'tour_hotel_bookings',
])

function pnlLineToAutoMatchRow(line: PnlDetailLine): ExpenseAutoMatchInputRow | null {
  if (!PNL_AUTO_MATCH_SOURCES.has(line.source)) return null
  if (line.statementReconciled || line.statementReconExempt || isPnlLineStmtReconDisabled(line)) return null
  const submitYmd = isoToYmd(line.submit_on)
  if (!submitYmd) return null
  return {
    id: line.id,
    submit_on: submitYmd,
    amount: Number(line.amount ?? 0),
    paid_to: line.paid_to ?? '',
    paid_for: line.paid_for ?? '',
    payment_method: line.payment_method,
    sourceTable: line.source as ExpenseReconSourceTable,
  }
}

async function buildPnlLineStatementReconContext(
  line: PnlDetailLine
): Promise<ExpenseStatementReconContext | null> {
  const submitYmd = isoToYmd(line.submit_on)

  switch (line.source) {
    case 'tour_expenses':
    case 'reservation_expenses':
    case 'company_expenses': {
      if (!submitYmd) return null
      return {
        sourceTable: line.source,
        sourceId: line.id,
        dateYmd: submitYmd,
        amount: Math.abs(line.amount),
        direction: 'outflow',
      }
    }
    case 'ticket_bookings':
      return buildTicketBookingStatementReconContextResolved(supabase, {
        id: line.id,
        expense: line.amount,
        submit_on: line.submit_on,
        check_in_date: line.tour_date_ymd,
        payment_method: line.payment_method,
      })
    case 'tour_hotel_bookings': {
      const ymd = submitYmd || line.tour_date_ymd || ''
      const amt = Math.abs(line.amount)
      if (!ymd || amt <= 0) return null
      return {
        sourceTable: 'tour_hotel_bookings',
        sourceId: line.id,
        dateYmd: ymd,
        amount: amt,
        direction: 'outflow',
      }
    }
    default:
      return null
  }
}

function ymdLocalStartToIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toISOString()
}

function sourceLabel(s: PnlExpenseSource): string {
  switch (s) {
    case 'tour_expenses':
      return '투어 지출'
    case 'reservation_expenses':
      return '예약 지출'
    case 'company_expenses':
      return '회사 지출'
    case 'ticket_bookings':
      return '입장권 부킹'
    case 'tour_hotel_bookings':
      return '투어 호텔 부킹'
    default:
      return s
  }
}

function classificationText(line: PnlDetailLine): string {
  if (line.source === 'ticket_bookings') return (line.category || '').trim() || '—'
  if (line.source === 'tour_hotel_bookings') {
    const hotel = (line.paid_to || '').trim()
    const res = (line.paid_for || '').trim()
    if (hotel && res) return `${hotel} / ${res}`
    return hotel || res || '—'
  }
  if (line.source === 'company_expenses') {
    const pf = (line.paid_for || '').trim()
    const cat = (line.category || '').trim()
    if (pf && cat) return `${pf} · ${cat}`
    return pf || cat || '—'
  }
  return (line.paid_for || '').trim() || '—'
}

function formatMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function shortId(id: string | null | undefined, head = 8): string {
  const s = String(id ?? '').trim()
  if (!s) return '—'
  return s.length <= head + 3 ? s : `${s.slice(0, head)}…`
}

function PnlDetailTourReferenceCell({ tourRef }: { tourRef: TourReferenceSnapshot | null }) {
  if (!tourRef) return <span className="text-muted-foreground">—</span>
  const tourName = tourRef.tourName?.trim() || '—'
  return (
    <div className="min-w-0 max-w-full space-y-1">
      <div className="text-[10px] sm:text-[11px] text-foreground leading-snug font-medium break-words">{tourName}</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground leading-snug">
        <span className="inline-flex items-center gap-0.5" title="배정 인원">
          <User className="h-3 w-3 shrink-0" aria-hidden />
          <span className="tabular-nums">{tourRef.assignedPeople}</span>
        </span>
        <span className="inline-flex items-center gap-0.5 min-w-0" title={`가이드 ${tourRef.guideName}`}>
          <User className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate max-w-[5rem]">{tourRef.guideName}</span>
        </span>
        <span className="inline-flex items-center gap-0.5 min-w-0" title={`어시 ${tourRef.assistantName}`}>
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate max-w-[5rem]">{tourRef.assistantName}</span>
        </span>
        <span className="inline-flex items-center gap-0.5 min-w-0" title={`차량 ${tourRef.vehicleName}`}>
          <Car className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate max-w-[5rem]">{tourRef.vehicleName}</span>
        </span>
      </div>
    </div>
  )
}

function pnlDetailLinkSummary(line: PnlDetailLine): string {
  const parts: string[] = []
  if (line.tour_id) parts.push(`tour ${line.tour_id}`)
  if (line.reservation_id) parts.push(`res ${line.reservation_id}`)
  if (line.rn_number) parts.push(`RN ${line.rn_number}`)
  if (line.booking_rooms != null) parts.push(`${line.booking_rooms}실`)
  return parts.join(' · ') || '—'
}

function paymentMethodDisplay(line: PnlDetailLine, map: Record<string, string>): string {
  const raw = (line.payment_method || '').trim()
  if (!raw) return '—'
  return map[raw] || raw
}

/** 메모·notes·description 등 지출 설명(표시 전용) */
function descriptionText(line: PnlDetailLine): string {
  const note = (line.note || '').trim()
  if (note) return note
  if (line.source === 'ticket_bookings') {
    const company = (line.company || '').trim()
    if (company) return company
  }
  return '—'
}

function normalizePnlDetailSearchText(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

function pnlDetailLineSearchHaystack(
  line: PnlDetailLine,
  paymentMethodMap: Record<string, string>
): string {
  const parts = [
    sourceLabel(line.source),
    line.source,
    line.id,
    isoToYmd(line.submit_on),
    line.submit_on,
    line.tour_date_ymd,
    '투어일',
    line.tour_id,
    line.reservation_id,
    line.rn_number,
    line.booking_rooms != null ? String(line.booking_rooms) : '',
    line.tour_reference?.tourName,
    line.tour_reference?.guideName,
    line.tour_reference?.assistantName,
    line.tour_reference?.vehicleName,
    line.tour_reference?.assignedPeople != null ? String(line.tour_reference.assignedPeople) : '',
    pnlDetailLinkSummary(line),
    isoToYmd(line.created_at),
    line.created_at,
    '입력일',
    line.paid_to,
    line.paid_for,
    line.category,
    line.company,
    line.note,
    line.payment_method,
    paymentMethodDisplay(line, paymentMethodMap),
    classificationText(line),
    descriptionText(line),
    line.mappingOriginalValue,
    line.statementReconExempt ? '대조불필요' : line.statementReconciled ? '연결됨 명세대조' : '미연결',
    String(line.amount),
    line.amount.toFixed(2),
  ]
  return normalizePnlDetailSearchText(parts.filter(Boolean).join(' '))
}

function pnlDetailLineMatchesSearch(
  line: PnlDetailLine,
  query: string,
  paymentMethodMap: Record<string, string>
): boolean {
  const q = normalizePnlDetailSearchText(query)
  if (!q) return true
  const hay = pnlDetailLineSearchHaystack(line, paymentMethodMap)
  const tokens = q.split(' ').filter(Boolean)
  return tokens.every((t) => hay.includes(t))
}

function comparePnlDetailLines(
  a: PnlDetailLine,
  b: PnlDetailLine,
  sortKey: PnlDetailSortKey,
  sortDir: SortDir
): number {
  let cmp = 0
  if (sortKey === 'submit_on') {
    cmp = compareSortValues(isoToYmd(a.submit_on), isoToYmd(b.submit_on), sortDir)
  } else if (sortKey === 'created_at') {
    cmp = compareSortValues(isoToYmd(a.created_at), isoToYmd(b.created_at), sortDir)
  } else {
    cmp = compareSortValues(a.amount, b.amount, sortDir)
  }
  if (cmp !== 0) return cmp
  return pnlDetailLineKey(a).localeCompare(pnlDetailLineKey(b))
}

function filterLines(lines: PnlDetailLine[], drill: PnlDrillState | null): PnlDetailLine[] {
  if (!drill) return []
  switch (drill.mode) {
    case 'cell':
      return lines.filter((l) => l.bucketKey === drill.rowId && l.yearMonth === drill.month)
    case 'row':
      return lines.filter((l) => l.bucketKey === drill.rowId)
    case 'col':
      return lines.filter((l) => l.yearMonth === drill.month)
    case 'grand':
      return [...lines]
    case 'excluded':
      return lines.filter((l) => l.exclude_from_pnl)
    case 'unmatched':
      return lines.filter((l) => !isPnlLineStatementReconCovered(l))
    case 'duplicates': {
      const groups = findPnlDetailDuplicateGroups(lines)
      const dupKeys = new Set<string>(groups.flat())
      return lines.filter((l) => dupKeys.has(pnlDetailLineKey(l)))
    }
    default:
      return []
  }
}

type Draft = {
  amount: string
  submitDate: string
  paid_to: string
  paid_for: string
  category: string
  company: string
  note: string
  exclude_from_pnl: boolean
  /** 표준 리프 id — 비우면 매핑 저장 생략(미매칭 유지) */
  standardLeafId: string
}

function lineToStandardLeafId(line: PnlDetailLine): string {
  if (line.resolvedLeafId) return line.resolvedLeafId
  if (line.bucketKey && line.bucketKey !== PNL_UNMATCHED_BUCKET_KEY) return line.bucketKey
  return ''
}

function mappingOriginalFromDraft(source: PnlExpenseSource, draft: Draft): string {
  if (source === 'tour_expenses' || source === 'reservation_expenses') {
    return (draft.paid_for || '').trim() || '기타'
  }
  if (source === 'company_expenses') {
    return (draft.paid_for || '').trim() || (draft.category || '').trim() || '기타'
  }
  if (source === 'tour_hotel_bookings') {
    return PNL_TOUR_HOTEL_BOOKING_MAPPING_ORIGINAL
  }
  return (draft.category || '').trim() || '입장권'
}

function pnlClassificationChanged(line: PnlDetailLine, draft: Draft): boolean {
  switch (line.source) {
    case 'tour_expenses':
    case 'reservation_expenses':
      return draft.paid_for.trim() !== (line.paid_for ?? '').trim()
    case 'company_expenses':
      return (
        draft.paid_for.trim() !== (line.paid_for ?? '').trim() ||
        draft.category.trim() !== (line.category ?? '').trim()
      )
    case 'ticket_bookings':
      return draft.category.trim() !== (line.category ?? '').trim()
    case 'tour_hotel_bookings':
      return false
  }
}

/** PNL 집계·매핑에 쓰는 original_value — 분류 필드가 바뀌지 않으면 기존 키 유지 */
function mappingOriginalForSave(line: PnlDetailLine, draft: Draft): string {
  if (!pnlClassificationChanged(line, draft)) {
    return line.mappingOriginalValue
  }
  return mappingOriginalFromDraft(line.source, draft)
}

function lineToDraft(line: PnlDetailLine): Draft {
  return {
    amount: String(line.amount ?? ''),
    submitDate: isoToYmd(line.submit_on),
    paid_to: line.paid_to ?? '',
    paid_for: line.paid_for ?? '',
    category: line.category ?? '',
    company: line.company ?? '',
    note: line.note ?? '',
    exclude_from_pnl: line.exclude_from_pnl,
    standardLeafId: lineToStandardLeafId(line),
  }
}

async function upsertExpenseCategoryMapping(
  original: string,
  source: PnlExpenseSource,
  leafId: string,
  byId: Map<string, ExpenseStandardCategoryPickRow>
): Promise<void> {
  const { standard_category_id, sub_category_id } = splitMappingIdsFromLeafId(leafId, byId)
  const { error } = await supabase.from('expense_category_mappings').upsert(
    {
      original_value: original,
      source_table: source,
      standard_category_id,
      sub_category_id,
      match_count: 1,
      last_matched_at: new Date().toISOString(),
    },
    { onConflict: 'original_value,source_table' }
  )
  if (error) throw error
}

function drillDialogTitle(drill: PnlDrillState | null, formatMonthLabel: (ym: string) => string): string {
  if (!drill) return '지출 내역'
  switch (drill.mode) {
    case 'cell':
      return `${drill.rowTitle ?? drill.rowId} · ${formatMonthLabel(drill.month)}`
    case 'row':
      return drill.rowTitle ?? drill.rowId
    case 'col':
      return `${formatMonthLabel(drill.month)} · 전체 카테고리`
    case 'grand':
      return '전체 지출'
    case 'excluded':
      return 'PNL 제외 지출 (exclude_from_pnl)'
    case 'unmatched':
      return '명세 미대조 지출'
    case 'duplicates':
      return '중복 의심 지출'
    default:
      return '지출 내역'
  }
}

function PnlMappingAssignBlock({
  visible,
  expenseStandardCategories,
  unifiedStandardGroups,
  onMapped,
}: {
  visible: PnlDetailLine[]
  expenseStandardCategories: ExpenseStandardCategoryPickRow[]
  unifiedStandardGroups: UnifiedStandardLeafGroup[]
  onMapped: () => void | Promise<void>
}) {
  const groups = useMemo(() => {
    const m = new Map<string, { original: string; source: PnlExpenseSource; lines: PnlDetailLine[] }>()
    for (const l of visible) {
      const k = `${l.mappingOriginalValue}::${l.source}`
      if (!m.has(k)) m.set(k, { original: l.mappingOriginalValue, source: l.source, lines: [] })
      m.get(k)!.lines.push(l)
    }
    return Array.from(m.values())
  }, [visible])

  const byId = useMemo(
    () => new Map(expenseStandardCategories.map((c) => [c.id, c])),
    [expenseStandardCategories]
  )

  const [picked, setPicked] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    setPicked({})
  }, [visible])

  const save = async (original: string, source: PnlExpenseSource) => {
    const k = `${original}::${source}`
    const leafId = picked[k] || ''
    if (!leafId) {
      toast.error('표준 카테고리를 선택하세요.')
      return
    }
    setSavingKey(k)
    try {
      await upsertExpenseCategoryMapping(original, source, leafId, byId)
      toast.success('표준 카테고리 매핑을 저장했습니다.')
      await onMapped()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '매핑 저장 실패')
    } finally {
      setSavingKey(null)
    }
  }

  if (groups.length === 0) return null

  return (
    <div className="mb-4 rounded-md border bg-muted/30 px-3 py-3 space-y-3 shrink-0">
      <p className="text-xs font-medium text-foreground">표준 카테고리 매핑 (원문·출처별)</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        리프를 선택한 뒤 저장하면 <code className="text-[10px] bg-muted px-1 rounded">expense_category_mappings</code>에
        반영됩니다. (카테고리 매니저와 동일)
      </p>
      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
        {groups.map((g) => {
          const k = `${g.original}::${g.source}`
          const sum = g.lines.reduce((s, x) => s + x.amount, 0)
          return (
            <div
              key={k}
              className="flex flex-col sm:flex-row sm:items-end gap-2 text-xs border-b border-border/40 pb-2 last:border-0"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="text-muted-foreground">{sourceLabel(g.source)}</div>
                <div className="font-medium break-words" title={g.original}>
                  {g.original}
                </div>
                <div className="tabular-nums text-muted-foreground">
                  {g.lines.length}건 · {formatMoney(sum)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  className="h-9 min-w-[200px] max-w-full rounded-md border bg-background px-2 text-xs"
                  value={picked[k] ?? ''}
                  onChange={(e) => setPicked((p) => ({ ...p, [k]: e.target.value }))}
                >
                  <option value="">표준 리프 선택…</option>
                  {unifiedStandardGroups.map((gr) => (
                    <optgroup key={gr.rootId} label={gr.groupLabel}>
                      {gr.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.displayLabel}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <Button type="button" size="sm" className="h-9" disabled={savingKey === k} onClick={() => save(g.original, g.source)}>
                  매핑 저장
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type PnlUnifiedExpenseDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  drill: PnlDrillState | null
  lines: PnlDetailLine[]
  /** "중복 아님" 처리된 지출 키(source:id) — 중복 탐지에서 제외 */
  dismissedDuplicateKeys?: Set<string>
  /** 중복 아님 처리 후 부모 상태 즉시 반영(전체 reload 없음) */
  onDismissedDuplicateKeysAdded?: (keys: string[]) => void
  /** 중복 아님 해제 후 부모 상태 즉시 반영(전체 reload 없음) */
  onDismissedDuplicateKeysRemoved?: (keys: string[]) => void
  /** «중복 아님» 작업 배치 정보 — 마지막 작업 되돌리기용 */
  dismissedUndoInfo?: { batchCount: number; lastBatchSize: number }
  /** 가장 최근 «중복 아님» 클릭 한 번만 되돌리기 */
  onUndoLastDismissedDuplicates?: () => void | Promise<void>
  /** «중복 아님» 숨김 전체 되돌리기 */
  onClearAllDismissedDuplicates?: () => void | Promise<void>
  formatMonthLabel: (ym: string) => string
  onSaved: () => void | Promise<void>
  /** 대조 불필요 표시만 바뀐 경우 — 전체 PNL 재로드 없이 라인만 갱신 */
  onReconExemptChanged?: (patches: PnlLineReconExemptPatch[]) => void
  expenseStandardCategories: ExpenseStandardCategoryPickRow[]
  unifiedStandardGroups: UnifiedStandardLeafGroup[]
  locale?: string
}

async function archivePnlDetailLine(
  line: PnlDetailLine,
  deletedBy: string | null
): Promise<void> {
  const key = pnlDetailLineKey(line)
  if (line.source === 'tour_hotel_bookings') {
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('tour_hotel_bookings')
      .update({
        deletion_requested_at: now,
        deletion_requested_by: deletedBy,
        updated_at: now,
      })
      .eq('id', line.id)
      .is('deletion_requested_at', null)
    if (error) throw error
    return
  }
  if (
    line.source === 'company_expenses' ||
    line.source === 'tour_expenses' ||
    line.source === 'reservation_expenses' ||
    line.source === 'ticket_bookings'
  ) {
    await deleteExpenseBySourceKey(key, deletedBy)
    return
  }
  throw new Error(`삭제를 지원하지 않는 출처입니다: ${line.source}`)
}

/** exclude_from_pnl 만 빠르게 토글 저장 — 입장권·호텔 부킹은 미지원 */
async function persistExcludeFromPnl(line: PnlDetailLine, next: boolean): Promise<void> {
  switch (line.source) {
    case 'tour_expenses': {
      const { error } = await supabase
        .from('tour_expenses')
        .update({ exclude_from_pnl: next, updated_at: new Date().toISOString() } as never)
        .eq('id', line.id)
      if (error) throw error
      return
    }
    case 'reservation_expenses': {
      const res = await fetch(`/api/reservation-expenses/${line.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exclude_from_pnl: next }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || '예약 지출 수정 실패')
      }
      return
    }
    case 'company_expenses': {
      const res = await fetch('/api/company-expenses', {
        method: 'PUT',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: line.id, exclude_from_pnl: next }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || '회사 지출 수정 실패')
      }
      return
    }
    default:
      throw new Error('이 출처는 PNL 제외 토글을 지원하지 않습니다.')
  }
}

function supportsExcludeFromPnl(source: PnlExpenseSource): boolean {
  return source !== 'ticket_bookings' && source !== 'tour_hotel_bookings'
}

export default function PnlUnifiedExpenseDetailDialog({
  open,
  onOpenChange,
  drill,
  lines,
  dismissedDuplicateKeys,
  onDismissedDuplicateKeysAdded,
  onDismissedDuplicateKeysRemoved,
  dismissedUndoInfo,
  onUndoLastDismissedDuplicates,
  onClearAllDismissedDuplicates,
  formatMonthLabel,
  onSaved,
  onReconExemptChanged,
  expenseStandardCategories,
  unifiedStandardGroups,
  locale = 'ko',
}: PnlUnifiedExpenseDetailDialogProps) {
  const { user } = useAuth()
  const deletedByEmail = user?.email ?? null
  const { paymentMethodMap } = usePaymentMethodOptions()
  const tStmtRecon = useTranslations('expenses.statementRecon')
  const tStmtExemptBulk = useTranslations('expenses.statementRecon.reconExempt.bulk')
  const [stmtReconOpen, setStmtReconOpen] = useState(false)
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [deleteConfirmKeys, setDeleteConfirmKeys] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [markingExempt, setMarkingExempt] = useState(false)
  /** 중복 그룹 뱃지 클릭 시 해당 그룹 행만 표시 (null = 필터 없음) */
  const [focusedDuplicateGroupIndex, setFocusedDuplicateGroupIndex] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<PnlDetailSortKey>('submit_on')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  /** 비어 있으면 전체 출처 — 하나 이상이면 해당 출처만 표시 */
  const [sourceTablesFilter, setSourceTablesFilter] = useState<PnlExpenseSource[]>([])
  const [pageSize, setPageSize] = useState<number>(PNL_DETAIL_DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)
  /** PNL 제외 즉시 토글의 낙관적 표시값 (재조회 전까지 유지) */
  const [excludeOverride, setExcludeOverride] = useState<Record<string, boolean>>({})
  const [excludeSavingKey, setExcludeSavingKey] = useState<string | null>(null)
  const [bulkAutoMatchOpen, setBulkAutoMatchOpen] = useState(false)
  const [tourDetailModalId, setTourDetailModalId] = useState<string | null>(null)
  const [reservationDetailModalId, setReservationDetailModalId] = useState<string | null>(null)

  const nestedOverlayOpen =
    tourDetailModalId != null ||
    reservationDetailModalId != null ||
    stmtReconOpen ||
    bulkAutoMatchOpen

  useEffect(() => {
    if (!tourDetailModalId && !reservationDetailModalId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      if (reservationDetailModalId) {
        setReservationDetailModalId(null)
        return
      }
      setTourDetailModalId(null)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [tourDetailModalId, reservationDetailModalId])

  const isUnmatchedDrill = drill?.mode === 'unmatched'
  const drillResetKey = useMemo(() => pnlDrillResetKey(drill), [drill])

  const applyReconExemptPatches = useCallback(
    (patches: PnlLineReconExemptPatch[]) => {
      if (patches.length === 0) return
      if (onReconExemptChanged) {
        onReconExemptChanged(patches)
        return
      }
      void onSaved()
    },
    [onReconExemptChanged, onSaved]
  )

  const visible = useMemo(() => filterLines(lines, drill), [lines, drill])
  const sourcesInVisible = useMemo(() => {
    const present = new Set<PnlExpenseSource>()
    for (const l of visible) present.add(l.source)
    return PNL_EXPENSE_SOURCES.filter((s) => present.has(s))
  }, [visible])
  const sourceFilterActive = sourceTablesFilter.length > 0
  const sourceFiltered = useMemo(() => {
    if (!sourceFilterActive) return visible
    const allowed = new Set(sourceTablesFilter)
    return visible.filter((l) => allowed.has(l.source))
  }, [visible, sourceTablesFilter, sourceFilterActive])
  const searchTrim = searchQuery.trim()
  const duplicateGroups = useMemo(
    () => findPnlDetailDuplicateGroups(sourceFiltered, dismissedDuplicateKeys),
    [sourceFiltered, dismissedDuplicateKeys]
  )
  const duplicateExtraKeys = useMemo(
    () => duplicateExtraKeysToSelect(sourceFiltered, duplicateGroups),
    [sourceFiltered, duplicateGroups]
  )
  const duplicateStyleByKey = useMemo(
    () => buildDuplicateGroupStyleByKey(duplicateGroups),
    [duplicateGroups]
  )
  const duplicateGroupKeySets = useMemo(
    () => duplicateGroups.map((g) => new Set(g)),
    [duplicateGroups]
  )
  const focusedDuplicateGroupKeys = useMemo(() => {
    if (focusedDuplicateGroupIndex == null) return null
    return duplicateGroupKeySets[focusedDuplicateGroupIndex] ?? null
  }, [focusedDuplicateGroupIndex, duplicateGroupKeySets])
  const duplicateGroupFiltered = useMemo(() => {
    if (!focusedDuplicateGroupKeys) return sourceFiltered
    return sourceFiltered.filter((l) => focusedDuplicateGroupKeys.has(pnlDetailLineKey(l)))
  }, [sourceFiltered, focusedDuplicateGroupKeys])
  const filteredRows = useMemo(() => {
    if (!searchTrim) return duplicateGroupFiltered
    return duplicateGroupFiltered.filter((l) => pnlDetailLineMatchesSearch(l, searchTrim, paymentMethodMap))
  }, [duplicateGroupFiltered, searchTrim, paymentMethodMap])
  const displayRows = useMemo(() => {
    const rows = [...filteredRows]
    rows.sort((a, b) => comparePnlDetailLines(a, b, sortKey, sortDir))
    return rows
  }, [filteredRows, sortKey, sortDir])
  const autoMatchExpenseRows = useMemo(
    () =>
      filteredRows
        .map(pnlLineToAutoMatchRow)
        .filter((x): x is ExpenseAutoMatchInputRow => x !== null),
    [filteredRows]
  )

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return displayRows.slice(start, start + pageSize)
  }, [displayRows, safePage, pageSize])
  const pageStartIndex = displayRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const pageEndIndex = Math.min(safePage * pageSize, displayRows.length)

  const goToPage = useCallback(
    (next: number) => {
      setPage(next)
      scrollAreaRef.current?.scrollTo({ top: 0 })
    },
    []
  )

  const toggleSort = useCallback((key: PnlDetailSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return key
      }
      setSortDir('asc')
      return key
    })
  }, [])
  const visibleByKey = useMemo(
    () => new Map(duplicateGroupFiltered.map((l) => [pnlDetailLineKey(l), l])),
    [duplicateGroupFiltered]
  )
  /** 현재 목록에서 이미 "중복 아님" 처리된 키 (해제 버튼 노출용) */
  const dismissedVisibleKeys = useMemo(() => {
    if (!dismissedDuplicateKeys || dismissedDuplicateKeys.size === 0) return [] as string[]
    return sourceFiltered
      .map((l) => pnlDetailLineKey(l))
      .filter((k) => dismissedDuplicateKeys.has(k))
  }, [sourceFiltered, dismissedDuplicateKeys])

  const selectedLines = useMemo(
    () =>
      [...selectedKeys]
        .map((k) => visibleByKey.get(k))
        .filter((x): x is PnlDetailLine => Boolean(x)),
    [selectedKeys, visibleByKey]
  )
  const selectedSum = useMemo(
    () => selectedLines.reduce((s, l) => s + l.amount, 0),
    [selectedLines]
  )
  const selectedExemptEligibleLines = useMemo(
    () =>
      selectedLines.filter(
        (l) => expenseReconExemptSourceSupported(l.source) && l.statementReconExempt !== true
      ),
    [selectedLines]
  )

  const markSelectedReconExempt = useCallback(async () => {
    if (selectedExemptEligibleLines.length === 0) {
      toast.error(tStmtExemptBulk('noSelection'))
      return
    }
    setMarkingExempt(true)
    try {
      const bySource = new Map<ExpenseReconSourceTable, string[]>()
      for (const line of selectedExemptEligibleLines) {
        const table = line.source as ExpenseReconSourceTable
        const ids = bySource.get(table) ?? []
        ids.push(line.id)
        bySource.set(table, ids)
      }
      let updated = 0
      const requested = selectedExemptEligibleLines.length
      for (const [sourceTable, sourceIds] of bySource) {
        const result = await bulkSetExpenseReconciliationExempt(supabase, {
          sourceTable,
          sourceIds,
          exempt: true,
          actorEmail: deletedByEmail,
        })
        updated += result.updated
      }
      if (updated < requested) {
        toast.message(tStmtExemptBulk('partial', { updated, requested }))
      } else {
        toast.success(tStmtExemptBulk('successSet', { count: updated }))
      }
      setSelectedKeys(new Set())
      applyReconExemptPatches(
        selectedExemptEligibleLines.map((line) => ({
          source: line.source,
          id: line.id,
          exempt: true,
        }))
      )
    } catch (err) {
      console.error(err)
      toast.error(tStmtExemptBulk('error'))
    } finally {
      setMarkingExempt(false)
    }
  }, [selectedExemptEligibleLines, deletedByEmail, applyReconExemptPatches, tStmtExemptBulk])

  const categoryById = useMemo(
    () => new Map(expenseStandardCategories.map((c) => [c.id, c])),
    [expenseStandardCategories]
  )

  const openStmtReconForLine = useCallback(async (line: PnlDetailLine) => {
    if (isPnlLineStmtReconDisabled(line)) {
      toast.error('지출일·금액이 없어 명세 대조를 할 수 없습니다.')
      return
    }
    try {
      const ctx = await buildPnlLineStatementReconContext(line)
      if (!ctx) {
        toast.error('명세 대조 조건(날짜·금액)을 확인할 수 없습니다.')
        return
      }
      setStmtReconCtx(ctx)
      setStmtReconOpen(true)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '명세 대조를 열지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setDraft(null)
      setSelectedKeys(new Set())
      setDeleteConfirmKeys(null)
      setSearchQuery('')
      setSourceTablesFilter([])
      setSortKey('submit_on')
      setSortDir('asc')
      setFocusedDuplicateGroupIndex(null)
      setStmtReconOpen(false)
      setStmtReconCtx(null)
      setMarkingExempt(false)
      setPage(1)
      setPageSize(PNL_DETAIL_DEFAULT_PAGE_SIZE)
    }
  }, [open])

  useEffect(() => {
    setSelectedKeys(new Set())
    setDeleteConfirmKeys(null)
    setSearchQuery('')
    setSourceTablesFilter([])
    setSortKey('submit_on')
    setSortDir('asc')
    setFocusedDuplicateGroupIndex(null)
    setPage(1)
  }, [drillResetKey])

  useEffect(() => {
    setPage(1)
  }, [searchTrim, sourceTablesFilter, focusedDuplicateGroupIndex, sortKey, sortDir, pageSize])

  useEffect(() => {
    setExcludeOverride({})
  }, [lines])

  const lineExcluded = useCallback(
    (line: PnlDetailLine) => excludeOverride[pnlDetailLineKey(line)] ?? line.exclude_from_pnl,
    [excludeOverride]
  )

  const toggleExcludeFromPnl = useCallback(
    async (line: PnlDetailLine) => {
      if (!supportsExcludeFromPnl(line.source)) return
      const key = pnlDetailLineKey(line)
      const next = !(excludeOverride[key] ?? line.exclude_from_pnl)
      setExcludeOverride((prev) => ({ ...prev, [key]: next }))
      setExcludeSavingKey(key)
      try {
        await persistExcludeFromPnl(line, next)
        toast.success(next ? 'PNL 제외 처리했습니다.' : 'PNL 제외를 해제했습니다.')
        await onSaved()
      } catch (e) {
        console.error(e)
        setExcludeOverride((prev) => {
          const n = { ...prev }
          delete n[key]
          return n
        })
        toast.error(e instanceof Error ? e.message : 'PNL 제외 변경에 실패했습니다.')
      } finally {
        setExcludeSavingKey(null)
      }
    },
    [excludeOverride, onSaved]
  )

  const editingLine = useMemo(
    () => (editingId ? lines.find((l) => pnlDetailLineKey(l) === editingId) ?? null : null),
    [editingId, lines]
  )

  const toggleDuplicateGroupFilter = useCallback((groupIndex: number) => {
    setFocusedDuplicateGroupIndex((prev) => (prev === groupIndex ? null : groupIndex))
    setSelectedKeys(new Set())
  }, [])

  useEffect(() => {
    if (focusedDuplicateGroupIndex != null && focusedDuplicateGroupIndex >= duplicateGroups.length) {
      setFocusedDuplicateGroupIndex(null)
    }
  }, [focusedDuplicateGroupIndex, duplicateGroups.length])

  const toggleSelected = useCallback((key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedKeys(new Set(displayRows.map((l) => pnlDetailLineKey(l))))
  }, [displayRows])

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const selectDuplicateExtras = useCallback(() => {
    setSelectedKeys(new Set(duplicateExtraKeys))
  }, [duplicateExtraKeys])

  const markSelectedNotDuplicate = useCallback(async () => {
    const keys = [...selectedKeys]
    if (keys.length === 0) return
    setDismissing(true)
    try {
      await addDismissedDuplicateKeys(keys)
      onDismissedDuplicateKeysAdded?.(keys)
      toast.success(`${keys.length}건을 «중복 아님»으로 처리했습니다.`)
      setSelectedKeys(new Set())
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '중복 아님 처리에 실패했습니다.')
    } finally {
      setDismissing(false)
    }
  }, [selectedKeys, onDismissedDuplicateKeysAdded])

  const restoreDismissedVisible = useCallback(async () => {
    if (dismissedVisibleKeys.length === 0) return
    setDismissing(true)
    try {
      await removeDismissedDuplicateKeys(dismissedVisibleKeys)
      onDismissedDuplicateKeysRemoved?.(dismissedVisibleKeys)
      toast.success(`${dismissedVisibleKeys.length}건의 «중복 아님» 처리를 해제했습니다.`)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : '중복 아님 해제에 실패했습니다.')
    } finally {
      setDismissing(false)
    }
  }, [dismissedVisibleKeys, onDismissedDuplicateKeysRemoved])

  const startEdit = useCallback((line: PnlDetailLine) => {
    setEditingId(`${line.source}:${line.id}`)
    setDraft(lineToDraft(line))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setDraft(null)
  }, [])

  const runDeleteSelected = useCallback(
    async (keys: string[]) => {
      setDeleteConfirmKeys(null)
      const toDelete = keys
        .map((k) => visibleByKey.get(k))
        .filter((x): x is PnlDetailLine => Boolean(x))
      if (toDelete.length === 0) return

      setDeleting(true)
      try {
        for (const line of toDelete) {
          await archivePnlDetailLine(line, deletedByEmail)
        }
        toast.success(`${toDelete.length}건을 삭제 보관함(또는 삭제 요청)으로 옮겼습니다.`)
        setSelectedKeys(new Set())
        cancelEdit()
        await onSaved()
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.')
      } finally {
        setDeleting(false)
      }
    },
    [visibleByKey, deletedByEmail, onSaved, cancelEdit]
  )

  const saveEdit = useCallback(
    async (line: PnlDetailLine) => {
      if (!draft) return
      const amt = parseFloat(String(draft.amount).replace(/,/g, ''))
      if (!Number.isFinite(amt)) {
        toast.error('금액을 확인하세요.')
        return
      }
      if (amt === 0 && line.source !== 'reservation_expenses') {
        toast.error('금액을 확인하세요.')
        return
      }
      if (!draft.submitDate || !/^\d{4}-\d{2}-\d{2}$/.test(draft.submitDate)) {
        toast.error('지출일(날짜)을 선택하세요.')
        return
      }
      const submitIso = ymdLocalStartToIso(draft.submitDate)

      setSaving(true)
      try {
        if (line.source === 'tour_expenses') {
          const { error } = await supabase
            .from('tour_expenses')
            .update({
              paid_for: draft.paid_for.trim(),
              paid_to: draft.paid_to.trim() || null,
              amount: amt,
              submit_on: submitIso,
              note: draft.note.trim() || null,
              exclude_from_pnl: draft.exclude_from_pnl,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id', line.id)
          if (error) throw error
        } else if (line.source === 'reservation_expenses') {
          const res = await fetch(`/api/reservation-expenses/${line.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paid_for: draft.paid_for.trim(),
              paid_to: draft.paid_to.trim() || null,
              amount: amt,
              submit_on: submitIso,
              note: draft.note.trim() || null,
              exclude_from_pnl: draft.exclude_from_pnl,
            }),
          })
          const json = await res.json()
          if (!res.ok || !json.success) {
            throw new Error(json.message || json.error || '예약 지출 수정 실패')
          }
        } else if (line.source === 'company_expenses') {
          const companyPayload: Record<string, unknown> = {
            id: line.id,
            paid_for: draft.paid_for.trim(),
            category: draft.category.trim(),
            paid_to: draft.paid_to.trim() || null,
            amount: amt,
            submit_on: submitIso,
            exclude_from_pnl: draft.exclude_from_pnl,
            notes: draft.note.trim() || null,
          }
          if (draft.standardLeafId) {
            const applied = applyStandardLeafToCompanyExpense(draft.standardLeafId, categoryById)
            if (applied) {
              companyPayload.standard_paid_for = applied.paid_for
              companyPayload.category = applied.category
              companyPayload.expense_type = applied.expense_type
              companyPayload.tax_deductible = applied.tax_deductible
            }
          }
          const res = await fetch('/api/company-expenses', {
            method: 'PUT',
            headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(companyPayload),
          })
          const json = await res.json()
          if (!res.ok) {
            throw new Error(json.error || '회사 지출 수정 실패')
          }
        } else if (line.source === 'ticket_bookings') {
          const cat = draft.category.trim()
          if (!cat) {
            toast.error('입장권 카테고리를 입력하세요.')
            setSaving(false)
            return
          }
          const { error } = await supabase
            .from('ticket_bookings')
            .update({
              category: cat,
              company: draft.company.trim() || null,
              expense: amt,
              submit_on: submitIso,
              note: draft.note.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', line.id)
          if (error) throw error
        } else if (line.source === 'tour_hotel_bookings') {
          const hotel = draft.paid_to.trim()
          const reservationName = draft.paid_for.trim()
          if (!hotel || !reservationName) {
            toast.error('호텔명과 예약명을 입력하세요.')
            setSaving(false)
            return
          }
          const { error } = await supabase
            .from('tour_hotel_bookings')
            .update({
              hotel,
              reservation_name: reservationName,
              total_price: amt,
              submit_on: submitIso,
              updated_at: new Date().toISOString(),
            })
            .eq('id', line.id)
          if (error) throw error
        }

        const mappingOriginal = mappingOriginalForSave(line, draft)
        if (draft.standardLeafId) {
          await upsertExpenseCategoryMapping(
            mappingOriginal,
            line.source,
            draft.standardLeafId,
            categoryById
          )
        }

        toast.success('저장했습니다.')
        cancelEdit()
        await onSaved()
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : '저장에 실패했습니다.')
      } finally {
        setSaving(false)
      }
    },
    [draft, cancelEdit, onSaved, categoryById]
  )

  const title = drillDialogTitle(drill, formatMonthLabel)
  const allVisibleSelected =
    displayRows.length > 0 && displayRows.every((l) => selectedKeys.has(pnlDetailLineKey(l)))
  const someSelected = selectedKeys.size > 0

  return (
    <>
      <AlertDialog open={deleteConfirmKeys != null} onOpenChange={(v) => !v && setDeleteConfirmKeys(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-base">선택한 지출 삭제</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left text-sm text-muted-foreground space-y-2">
                <p>
                  선택한 {deleteConfirmKeys?.length ?? 0}건을 <strong>삭제 보관함</strong>으로 옮깁니다(복구 가능).
                  회사·투어·예약·입장권은 명세 대조 연결도 해제됩니다. 투어 호텔 부킹은 삭제 요청 상태로 숨깁니다.
                </p>
                {deleteConfirmKeys && deleteConfirmKeys.length > 0 ? (
                  <p className="tabular-nums font-medium text-foreground">
                    합계 {formatMoney(
                      deleteConfirmKeys.reduce((s, k) => s + (visibleByKey.get(k)?.amount ?? 0), 0)
                    )}
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={(ev) => {
                ev.preventDefault()
                if (!deleteConfirmKeys?.length) return
                void runDeleteSelected(deleteConfirmKeys)
              }}
            >
              삭제 보관함으로
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && nestedOverlayOpen) return
          onOpenChange(v)
        }}
      >
      <DialogContent
        overlayClassName="z-[1200]"
        className="flex flex-col p-0 gap-0 z-[1200] w-[min(100vw-0.5rem,120rem)] max-w-[min(100vw-0.5rem,120rem)] max-h-[min(96vh,1040px)]"
        onPointerDownOutside={(e) => {
          if (nestedOverlayOpen) e.preventDefault()
        }}
        onFocusOutside={(e) => {
          if (nestedOverlayOpen) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (nestedOverlayOpen) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (nestedOverlayOpen) e.preventDefault()
        }}
      >
        <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b shrink-0">
          <DialogTitle className="text-base leading-snug">지출 상세 — {title}</DialogTitle>
          <p className="text-xs text-muted-foreground font-normal pt-1">
            {isUnmatchedDrill ? (
              <>
                아래 목록은 은행·카드 명세와 아직 연결되지 않은 지출입니다.{' '}
                <strong>명세 자동 매칭</strong>으로 일괄 연결하거나, 행을 선택해{' '}
                <strong>대조 불필요 표시</strong>를 할 수 있습니다. 건별로는 <strong>명세 대조</strong> 열의
                은행 아이콘·대조 불필요 버튼을 사용하세요.
              </>
            ) : (
              <>
                상단에서 원문·출처별 <strong>표준 리프</strong>를 지정·저장하면 카테고리 매니저와 동일하게{' '}
                <code className="text-[10px] bg-muted px-1 rounded">expense_category_mappings</code>가 갱신됩니다. 개별
                지출은 아래에서 금액·결제내용을 수정하거나, 행을 선택해 중복·불필요 지출을 삭제 보관함으로 옮길 수
                있습니다. 별개인 지출이 중복으로 잡히면 <strong>«중복 아님 처리»</strong>로 경고에서 제외할 수
                있습니다. 연결 <strong>tour_id</strong>·<strong>RN#</strong>·예약 ID가 다른 지출, 그리고{' '}
                <strong>Entrance Fee</strong>끼리 연결 ID가 다르면 같은 금액·날짜여도 중복 후보에서 자동 제외됩니다.
              </>
            )}
          </p>
        </DialogHeader>

        {visible.length > 0 ? (
          <div className="px-3 sm:px-4 py-2 border-b bg-white shrink-0 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="relative flex-1 min-w-[12rem] max-w-xl">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                  aria-hidden
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="출처·지출일·투어일·ID·상품·가이드·결제처·분류·금액·메모 검색"
                  className="h-9 pl-9 pr-9 text-sm"
                  aria-label="지출 상세 검색"
                  disabled={deleting}
                />
                {searchTrim ? (
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:bg-muted"
                    aria-label="검색어 지우기"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {searchTrim ? (
                  <>
                    검색 <strong className="text-foreground font-medium">{displayRows.length}</strong>
                    {sourceFilterActive ? (
                      <>
                        {' '}
                        / 출처 {sourceFiltered.length}
                      </>
                    ) : null}{' '}
                    / {visible.length}건
                  </>
                ) : sourceFilterActive ? (
                  <>
                    표시 <strong className="text-foreground font-medium">{sourceFiltered.length}</strong> /{' '}
                    {visible.length}건
                  </>
                ) : (
                  <>{visible.length}건</>
                )}
              </span>
              {isUnmatchedDrill ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 border-emerald-300 text-emerald-900 hover:bg-emerald-50"
                  disabled={deleting || autoMatchExpenseRows.length === 0}
                  onClick={() => setBulkAutoMatchOpen(true)}
                  title={tStmtRecon('bulkAutoMatch.buttonTitle')}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  {tStmtRecon('bulkAutoMatch.button')}
                </Button>
              ) : null}
            </div>
            {sourcesInVisible.length > 1 ? (
              <div className="flex min-w-0 flex-col gap-1 rounded border border-slate-200 bg-slate-50/80 px-2 py-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-slate-600 shrink-0 font-medium">출처</span>
                  <button
                    type="button"
                    className="text-[10px] text-slate-600 underline hover:text-slate-900 shrink-0"
                    disabled={deleting}
                    onClick={() => setSourceTablesFilter([])}
                  >
                    전체
                  </button>
                  <span className="text-slate-400 hidden sm:inline">|</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {sourcesInVisible.map((value) => {
                      const active = sourceFilterActive && sourceTablesFilter.includes(value)
                      return (
                        <label
                          key={value}
                          className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 whitespace-nowrap"
                        >
                          <Checkbox
                            checked={active}
                            disabled={deleting}
                            onCheckedChange={() => {
                              setSourceTablesFilter((prev) => {
                                const next = prev.includes(value)
                                  ? prev.filter((x) => x !== value)
                                  : [...prev, value]
                                return next
                              })
                              setSelectedKeys(new Set())
                            }}
                          />
                          <span>{sourceLabel(value)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  체크를 모두 해제하거나 «전체»를 누르면 모든 출처를 표시합니다. 여러 개를 선택하면 해당 출처만
                  목록·중복 점검·선택에 반영됩니다.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {visible.length > 0 ? (
          <div className="px-3 sm:px-4 py-2 border-b bg-slate-50/90 shrink-0 flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-2">
              <div className="text-xs text-slate-700 min-w-0 flex-1">
                {someSelected ? (
                  <span className="font-medium tabular-nums">
                    {selectedKeys.size}건 선택 · 합계 {formatMoney(selectedSum)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">행을 선택하면 합계가 표시됩니다.</span>
                )}
                {focusedDuplicateGroupIndex != null ? (
                  <span className="block mt-1 text-slate-800 font-medium">
                    «{duplicateStyleByKey.get(duplicateGroups[focusedDuplicateGroupIndex]?.[0] ?? '')?.groupLabel ??
                      `중복 ${focusedDuplicateGroupIndex + 1}`}» 그룹만 표시 중 ({displayRows.length}건)
                  </span>
                ) : null}
                {duplicateGroups.length > 0 ? (
                  <span className="block mt-1 text-slate-600">
                    중복 의심 {duplicateGroups.length}그룹
                    {duplicateExtraKeys.length > 0 ? ` · 삭제 후보 ${duplicateExtraKeys.length}건` : ''}
                    {focusedDuplicateGroupIndex == null
                      ? ` · 표 ${displayRows.length}건`
                      : ''}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={deleting || dismissing || displayRows.length === 0}
                  onClick={() => (allVisibleSelected ? clearSelection() : selectAllVisible())}
                >
                  {allVisibleSelected ? '선택 해제' : '전체 선택'}
                </Button>
                {isUnmatchedDrill ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-slate-400 text-slate-800 hover:bg-slate-50"
                    disabled={
                      deleting || dismissing || markingExempt || selectedExemptEligibleLines.length === 0
                    }
                    title={tStmtExemptBulk('markExemptTitle')}
                    onClick={() => void markSelectedReconExempt()}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1 shrink-0" aria-hidden />
                    {markingExempt
                      ? tStmtExemptBulk('applying')
                      : tStmtExemptBulk('markExempt', { count: selectedExemptEligibleLines.length })}
                  </Button>
                ) : null}
                {!isUnmatchedDrill && focusedDuplicateGroupIndex != null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-slate-400"
                    disabled={deleting || dismissing}
                    onClick={() => setFocusedDuplicateGroupIndex(null)}
                  >
                    그룹 필터 해제
                  </Button>
                ) : null}
                {!isUnmatchedDrill && duplicateExtraKeys.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-amber-300 text-amber-950 hover:bg-amber-50"
                    disabled={deleting || dismissing}
                    onClick={selectDuplicateExtras}
                    title={`금액 ±$${BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±${BULK_COMPANY_DUP_DAY_WINDOW}일 — 그룹당 1건(명세 연결·가장 이른 등록일 우선) 유지`}
                  >
                    중복 의심 {duplicateExtraKeys.length}건 선택
                  </Button>
                ) : null}
                {!isUnmatchedDrill && dismissedVisibleKeys.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                    disabled={deleting || dismissing}
                    onClick={restoreDismissedVisible}
                    title="이 목록에서 «중복 아님»으로 처리된 건을 다시 중복 탐지 대상으로 되돌립니다."
                  >
                    중복 아님 해제 {dismissedVisibleKeys.length}건
                  </Button>
                ) : null}
                {!isUnmatchedDrill && dismissedUndoInfo && dismissedUndoInfo.batchCount > 0 && onUndoLastDismissedDuplicates ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-amber-400 text-amber-950 hover:bg-amber-50"
                    disabled={deleting || dismissing}
                    onClick={() => void onUndoLastDismissedDuplicates()}
                    title="가장 최근 «중복 아님 처리» 클릭 한 번만 되돌립니다."
                  >
                    마지막 작업 되돌리기 ({dismissedUndoInfo.lastBatchSize}건)
                  </Button>
                ) : null}
                {!isUnmatchedDrill && dismissedDuplicateKeys && dismissedDuplicateKeys.size > 0 && onClearAllDismissedDuplicates ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs border-amber-300 text-amber-950 hover:bg-amber-50"
                    disabled={deleting || dismissing}
                    onClick={() => void onClearAllDismissedDuplicates()}
                    title="«중복 아님»으로 숨긴 모든 지출을 다시 중복 의심 후보로 표시합니다."
                  >
                    중복 아님 전체 되돌리기 ({dismissedDuplicateKeys.size}건)
                  </Button>
                ) : null}
                {!isUnmatchedDrill ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      disabled={deleting || dismissing || markingExempt || !someSelected}
                      onClick={markSelectedNotDuplicate}
                      title="선택한 건을 중복 의심에서 제외합니다(삭제하지 않음). 합계는 그대로 유지됩니다."
                    >
                      중복 아님 처리
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      disabled={deleting || dismissing || markingExempt || !someSelected}
                      onClick={() => setDeleteConfirmKeys([...selectedKeys])}
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                      삭제 보관함으로
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {!isUnmatchedDrill && duplicateGroups.length > 0 ? (
              <div className="rounded-md border border-slate-200 bg-white/80 px-2 py-1.5">
                <p className="text-[10px] text-slate-500 mb-1">
                  중복 그룹을 누르면 해당 건만 표에 표시됩니다. tour_id·상품·가이드·연결 ID를 비교해 판단하세요.
                </p>
                <div className="max-h-20 overflow-y-auto overflow-x-hidden pr-1">
                  <div className="flex flex-wrap gap-1">
                    {duplicateGroups.map((g, i) => {
                      const sampleKey = g[0]
                      const style = sampleKey ? duplicateStyleByKey.get(sampleKey) : null
                      const active = focusedDuplicateGroupIndex === i
                      return (
                        <button
                          key={`dup-filter-${i}`}
                          type="button"
                          disabled={deleting || dismissing}
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border transition-colors ${
                            style?.badgeClass ?? 'bg-amber-100 text-amber-950 border-amber-300'
                          } ${active ? 'ring-2 ring-offset-1 ring-slate-700 font-semibold' : 'hover:opacity-90'}`}
                          title={`${g.join(', ')} — 클릭하여 이 그룹만 표시`}
                          onClick={() => toggleDuplicateGroupFilter(i)}
                        >
                          {style?.groupLabel ?? `중복 ${i + 1}`} · {g.length}건
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={scrollAreaRef} className="overflow-auto flex-1 min-h-0 px-2 sm:px-4 py-3 flex flex-col">
          {visible.length > 0 && !isUnmatchedDrill && (
            <PnlMappingAssignBlock
              visible={visible}
              expenseStandardCategories={expenseStandardCategories}
              unifiedStandardGroups={unifiedStandardGroups}
              onMapped={onSaved}
            />
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">이 구간에 해당하는 지출이 없습니다.</p>
          ) : displayRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {searchTrim
                ? '검색 결과가 없습니다. 검색어를 바꾸거나 지워 보세요.'
                : sourceFilterActive
                  ? '선택한 출처에 해당하는 지출이 없습니다. 출처 필터를 바꾸거나 «전체»를 눌러 보세요.'
                  : '표시할 지출이 없습니다.'}
            </p>
          ) : (
            <table className="w-full min-w-[1280px] text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pl-1 pr-1 w-9 font-medium">
                    <Checkbox
                      aria-label="현재 목록 전체 선택"
                      checked={allVisibleSelected && displayRows.length > 0}
                      onCheckedChange={(c) => {
                        if (c === true) selectAllVisible()
                        else clearSelection()
                      }}
                      disabled={deleting || displayRows.length === 0}
                    />
                  </th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">출처</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap min-w-[72px]">지출 ID</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">
                    <TableSortHeaderButton
                      label="지출일"
                      active={sortKey === 'submit_on'}
                      dir={sortDir}
                      onClick={() => toggleSort('submit_on')}
                    />
                  </th>
                  <th
                    className="py-2 pr-2 font-medium whitespace-nowrap"
                    title="PNL 집계 기준. 입장권·호텔은 체크인, 회사지출은 회계기간(월→일) 기준"
                  >
                    투어일
                  </th>
                  <th className="py-2 pr-2 font-medium min-w-[140px] max-w-[220px]">투어·상품</th>
                  <th className="py-2 pr-2 font-medium min-w-[120px] max-w-[180px]">연결 ID</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">
                    <TableSortHeaderButton
                      label="입력일"
                      active={sortKey === 'created_at'}
                      dir={sortDir}
                      onClick={() => toggleSort('created_at')}
                    />
                  </th>
                  <th className="py-2 pr-2 font-medium min-w-[88px]">결제처</th>
                  <th className="py-2 pr-2 font-medium min-w-[100px] max-w-[180px]">결제 방법</th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap">명세 대조</th>
                  <th className="py-2 pr-2 font-medium min-w-[100px]">분류(원문)</th>
                  <th className="py-2 pr-2 font-medium min-w-[140px] max-w-[280px]">설명</th>
                  <th className="py-2 pr-2 font-medium text-right whitespace-nowrap">
                    <div className="flex justify-end">
                      <TableSortHeaderButton
                        label="금액"
                        active={sortKey === 'amount'}
                        dir={sortDir}
                        onClick={() => toggleSort('amount')}
                      />
                    </div>
                  </th>
                  <th className="py-2 pr-2 font-medium whitespace-nowrap text-center w-[64px]">PNL 제외</th>
                  <th className="py-2 pl-1 font-medium whitespace-nowrap w-[72px]"> </th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((line) => {
                  const key = pnlDetailLineKey(line)
                  const desc = descriptionText(line)
                  const isSelected = selectedKeys.has(key)
                  const dupStyle = duplicateStyleByKey.get(key)
                  return (
                    <React.Fragment key={key}>
                      <tr
                        className={`border-b border-border/60 align-top cursor-pointer ${
                          isSelected
                            ? 'bg-red-50/90 ring-1 ring-inset ring-red-200'
                            : dupStyle?.rowClass ?? 'hover:bg-slate-50/80'
                        }`}
                        title="행을 클릭하면 수정 창이 열립니다"
                        onClick={() => startEdit(line)}
                      >
                        <td className="py-2 pl-1 pr-1 align-middle" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            aria-label={`${sourceLabel(line.source)} ${formatMoney(line.amount)} 선택`}
                            checked={isSelected}
                            disabled={deleting}
                            onCheckedChange={(c) => toggleSelected(key, c === true)}
                          />
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap">
                          <span className="inline-flex flex-col gap-0.5">
                            <span>{sourceLabel(line.source)}</span>
                            {dupStyle ? (
                              <button
                                type="button"
                                disabled={deleting || dismissing}
                                className={`inline-flex w-fit rounded px-1 py-0.5 text-[10px] font-semibold cursor-pointer hover:opacity-90 ${
                                  dupStyle.badgeClass
                                } ${focusedDuplicateGroupIndex === dupStyle.groupIndex ? 'ring-1 ring-slate-700' : ''}`}
                                title="클릭하여 이 중복 그룹만 표시"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleDuplicateGroupFilter(dupStyle.groupIndex)
                                }}
                              >
                                {dupStyle.groupLabel}
                              </button>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-mono text-[10px] text-muted-foreground break-all max-w-[88px]" title={line.id}>
                          {shortId(line.id, 10)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap tabular-nums">
                          {isoToYmd(line.submit_on) || '—'}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {line.tour_date_ymd || '—'}
                        </td>
                        <td className="py-2 pr-2 align-top min-w-[140px] max-w-[220px]">
                          <PnlDetailTourReferenceCell tourRef={line.tour_reference} />
                        </td>
                        <td
                          className="py-2 pr-2 align-top text-[10px] sm:text-[11px] text-muted-foreground min-w-[120px] max-w-[180px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-1">
                            {line.tour_id ? (
                              <button
                                type="button"
                                className="text-left font-mono hover:text-foreground underline-offset-2 hover:underline"
                                title={line.tour_id}
                                onClick={() => setTourDetailModalId(line.tour_id!)}
                              >
                                tour {shortId(line.tour_id, 10)}
                              </button>
                            ) : null}
                            {line.reservation_id ? (
                              <button
                                type="button"
                                className="text-left font-mono hover:text-foreground underline-offset-2 hover:underline"
                                title={line.reservation_id}
                                onClick={() => setReservationDetailModalId(line.reservation_id!)}
                              >
                                res {shortId(line.reservation_id, 10)}
                              </button>
                            ) : null}
                            {line.rn_number ? (
                              <span className="font-mono" title={`RN ${line.rn_number}`}>
                                RN {line.rn_number}
                              </span>
                            ) : null}
                            {line.booking_rooms != null ? (
                              <span title="객실 수">{line.booking_rooms}실</span>
                            ) : null}
                            {!line.tour_id &&
                            !line.reservation_id &&
                            !line.rn_number &&
                            line.booking_rooms == null ? (
                              <span>—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap tabular-nums text-muted-foreground">
                          {isoToYmd(line.created_at) || '—'}
                        </td>
                        <td className="py-2 pr-2 break-all max-w-[140px]">
                          {(line.paid_to || '').trim() || (line.company || '').trim() || '—'}
                        </td>
                        <td className="py-2 pr-2 break-words text-muted-foreground max-w-[160px]" title={line.payment_method || undefined}>
                          {paymentMethodDisplay(line, paymentMethodMap)}
                        </td>
                        <td className="py-2 pr-2 whitespace-nowrap align-middle" onClick={(e) => e.stopPropagation()}>
                          <span className="inline-flex items-center gap-0.5">
                            <ExpenseStatementReconIcon
                              matched={isPnlLineStatementReconCovered(line)}
                              exempt={line.statementReconExempt === true}
                              disabled={isPnlLineStmtReconDisabled(line) || deleting || markingExempt}
                              titleMatched={tStmtRecon('matchedTitle')}
                              titleUnmatched={tStmtRecon('unmatchedTitle')}
                              titleExempt={tStmtRecon('exemptTitle')}
                              titleDisabled={tStmtRecon('disabledTitle')}
                              onClick={() => void openStmtReconForLine(line)}
                            />
                            {expenseReconExemptSourceSupported(line.source) ? (
                              <ExpenseReconciliationExemptToggle
                                compact
                                sourceTable={line.source as ExpenseReconSourceTable}
                                sourceId={line.id}
                                exempt={line.statementReconExempt === true}
                                disabled={deleting || markingExempt}
                                onChanged={(exempt) =>
                                  applyReconExemptPatches([
                                    { source: line.source, id: line.id, exempt },
                                  ])
                                }
                              />
                            ) : null}
                            {line.statementReconExempt ? (
                              <span
                                className="hidden sm:inline text-slate-700 text-[11px]"
                                title={tStmtRecon('exemptTitle')}
                              >
                                대조 불필요
                              </span>
                            ) : line.statementReconciled ? (
                              <span
                                className="inline-flex items-center gap-1 text-emerald-800 text-[11px] sm:text-xs"
                                title="명세 대조에 연결됨"
                              >
                                <StatementReconciledBadge matched className="shrink-0" />
                                <span>연결됨</span>
                              </span>
                            ) : (
                              <span
                                className="text-muted-foreground text-[11px] sm:text-xs"
                                title="명세 줄과 아직 매칭되지 않음 — 아이콘을 눌러 대조"
                              >
                                미연결
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-2 break-words">{classificationText(line)}</td>
                        <td
                          className="py-2 pr-2 break-words text-muted-foreground min-w-[140px] max-w-[280px]"
                          title={desc !== '—' ? desc : undefined}
                        >
                          {desc}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums font-medium">{formatMoney(line.amount)}</td>
                        <td
                          className="py-2 pr-2 align-middle text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {supportsExcludeFromPnl(line.source) ? (
                            <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] font-normal whitespace-nowrap">
                              <Checkbox
                                aria-label="PNL 제외 토글"
                                checked={lineExcluded(line)}
                                disabled={deleting || excludeSavingKey === key}
                                onCheckedChange={() => void toggleExcludeFromPnl(line)}
                              />
                              <span className={lineExcluded(line) ? 'text-amber-800' : 'text-muted-foreground'}>
                                제외
                              </span>
                            </label>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-2 pl-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            disabled={deleting}
                            onClick={() => startEdit(line)}
                          >
                            수정
                          </Button>
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {visible.length > 0 && displayRows.length > 0 ? (
          <div className="px-3 sm:px-4 py-2 border-t bg-white shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {pageStartIndex.toLocaleString()}–{pageEndIndex.toLocaleString()} /{' '}
                <strong className="text-foreground font-medium">{displayRows.length.toLocaleString()}</strong>건
              </span>
              <label className="hidden sm:flex items-center gap-1">
                <span>페이지당</span>
                <select
                  className="h-8 rounded-md border bg-background px-1.5 text-xs"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  disabled={deleting}
                  aria-label="페이지당 표시 개수"
                >
                  {PNL_DETAIL_PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span>개</span>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="첫 페이지"
                disabled={deleting || safePage <= 1}
                onClick={() => goToPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="이전 페이지"
                disabled={deleting || safePage <= 1}
                onClick={() => goToPage(safePage - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <span className="px-2 text-xs tabular-nums text-foreground whitespace-nowrap">
                {safePage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="다음 페이지"
                disabled={deleting || safePage >= totalPages}
                onClick={() => goToPage(safePage + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                aria-label="마지막 페이지"
                disabled={deleting || safePage >= totalPages}
                onClick={() => goToPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        {visible.length > 0 ? (
          <DialogFooter className="px-3 sm:px-4 py-2 border-t bg-slate-50/80 shrink-0 flex-row flex-wrap justify-between gap-2">
            <span className="text-xs text-muted-foreground self-center">
              {searchTrim
                ? `검색 ${displayRows.length}${sourceFilterActive ? ` / 출처 ${sourceFiltered.length}` : ''}${focusedDuplicateGroupIndex != null ? ' · 그룹 필터' : ''} / ${visible.length}건`
                : sourceFilterActive
                  ? `표시 ${duplicateGroupFiltered.length} / ${visible.length}건`
                  : focusedDuplicateGroupIndex != null
                    ? `그룹 필터 ${displayRows.length}건 / ${visible.length}건`
                    : `${displayRows.length}건 표시`}
              {duplicateGroups.length > 0
                ? ` · 중복 점검: 금액 ±$${BULK_COMPANY_DUP_AMOUNT_EPS}, 등록일 ±${BULK_COMPANY_DUP_DAY_WINDOW}일`
                : ''}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {someSelected ? (
                <span className="text-xs font-medium tabular-nums text-slate-800">
                  선택 {selectedKeys.size}건 · {formatMoney(selectedSum)}
                </span>
              ) : null}
              {isUnmatchedDrill ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-400 text-slate-800 hover:bg-slate-50"
                  disabled={deleting || dismissing || markingExempt || selectedExemptEligibleLines.length === 0}
                  title={tStmtExemptBulk('markExemptTitle')}
                  onClick={() => void markSelectedReconExempt()}
                >
                  <Ban className="h-3.5 w-3.5 mr-1 shrink-0" aria-hidden />
                  {markingExempt
                    ? tStmtExemptBulk('applying')
                    : tStmtExemptBulk('markExempt', { count: selectedExemptEligibleLines.length })}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    disabled={deleting || dismissing || markingExempt || !someSelected}
                    onClick={markSelectedNotDuplicate}
                    title="선택한 건을 중복 의심에서 제외합니다(삭제하지 않음)."
                  >
                    중복 아님 처리
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-8"
                    disabled={deleting || dismissing || markingExempt || !someSelected}
                    onClick={() => setDeleteConfirmKeys([...selectedKeys])}
                  >
                    삭제 보관함으로
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>

      <Dialog
        open={Boolean(editingLine && draft)}
        onOpenChange={(o) => {
          if (!o) cancelEdit()
        }}
      >
        <DialogContent className="z-[1300] w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              지출 수정{editingLine ? ` — ${sourceLabel(editingLine.source)}` : ''}
            </DialogTitle>
          </DialogHeader>
          {editingLine && draft ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">금액</Label>
                <Input
                  className="h-9"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">지출일</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={draft.submitDate}
                  onChange={(e) => setDraft({ ...draft, submitDate: e.target.value })}
                />
              </div>

              {editingLine.source === 'ticket_bookings' ? (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">카테고리 (입장권 분류 · 매핑 전)</Label>
                    <Input
                      className="h-9"
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">공급업체(회사)</Label>
                    <Input
                      className="h-9"
                      value={draft.company}
                      onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                    />
                  </div>
                </>
              ) : editingLine.source === 'tour_hotel_bookings' ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">호텔명</Label>
                    <Input
                      className="h-9"
                      value={draft.paid_to}
                      onChange={(e) => setDraft({ ...draft, paid_to: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">예약명</Label>
                    <Input
                      className="h-9"
                      value={draft.paid_for}
                      onChange={(e) => setDraft({ ...draft, paid_for: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">결제처</Label>
                    <Input
                      className="h-9"
                      value={draft.paid_to}
                      onChange={(e) => setDraft({ ...draft, paid_to: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">결제내용 (paid_for)</Label>
                    <Input
                      className="h-9"
                      value={draft.paid_for}
                      onChange={(e) => setDraft({ ...draft, paid_for: e.target.value })}
                    />
                  </div>
                  {editingLine.source === 'company_expenses' && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">회사 지출 카테고리</Label>
                      <Input
                        className="h-9"
                        value={draft.category}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">메모</Label>
                <Input
                  className="h-9"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">표준 카테고리 (통합 PNL 분류)</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                  value={draft.standardLeafId}
                  onChange={(e) => setDraft({ ...draft, standardLeafId: e.target.value })}
                >
                  <option value="">— 선택 안 함 (매핑 변경 없음) —</option>
                  {unifiedStandardGroups.map((gr) => (
                    <optgroup key={gr.rootId} label={gr.groupLabel}>
                      {gr.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.displayLabel}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  저장 시 <code className="text-[10px] bg-muted px-1 rounded">expense_category_mappings</code>
                  에 반영됩니다. 동일한 결제내용(원문)·출처를 쓰는 다른 지출도 같은 표준 분류로 묶입니다. 분류만 바꿀
                  때는 결제내용을 그대로 두고 여기서 리프만 바꾸면 됩니다.
                </p>
              </div>

              {supportsExcludeFromPnl(editingLine.source) && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Checkbox
                    id="pnl-edit-exclude"
                    checked={draft.exclude_from_pnl}
                    onCheckedChange={(c) => setDraft({ ...draft, exclude_from_pnl: c === true })}
                  />
                  <Label htmlFor="pnl-edit-exclude" className="text-xs font-normal cursor-pointer">
                    통합 PNL·이 표에서 제외 (exclude_from_pnl)
                  </Label>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={cancelEdit}>
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || !editingLine}
              onClick={() => editingLine && void saveEdit(editingLine)}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(o) => {
          setStmtReconOpen(o)
          if (!o) setStmtReconCtx(null)
        }}
        context={stmtReconCtx}
        nestedElevated
        onApplied={() => void onSaved()}
      />

      {isUnmatchedDrill ? (
        <ExpenseStatementBulkAutoMatchModal
          open={bulkAutoMatchOpen}
          onOpenChange={setBulkAutoMatchOpen}
          expenses={autoMatchExpenseRows}
          reconciledExpenseIds={new Set()}
          nestedElevated
          title="명세 미대조 지출 — 자동 매칭"
          description="현재 목록(검색·출처 필터 반영) 중 명세와 연결 가능한 지출을 전체 은행 명세·현금 출금과 금액으로 맞춥니다. 미리보기에서 확인한 뒤 저장하세요."
          onApplied={() => void onSaved()}
        />
      ) : null}

      {tourDetailModalId ? (
        <Dialog
          modal={false}
          open
          onOpenChange={(v) => {
            if (!v) setTourDetailModalId(null)
          }}
        >
          <DialogContent
            overlayClassName={PNL_NESTED_DETAIL_OVERLAY_CLASS}
            className={PNL_NESTED_DETAIL_CONTENT_CLASS}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={preventNestedDetailDialogDismiss}
            onFocusOutside={preventNestedDetailDialogDismiss}
            onInteractOutside={preventNestedDetailDialogDismiss}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 pr-12 shrink-0 text-left">
              <DialogTitle className="text-base font-semibold truncate flex-1 min-w-0">투어 상세</DialogTitle>
              <a
                href={`/${locale}/admin/tours/${tourDetailModalId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 shrink-0 ml-2"
              >
                새 탭에서 열기
                <ExternalLink size={14} aria-hidden />
              </a>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col bg-white">
              <TourDetailModalContent tourId={tourDetailModalId} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {reservationDetailModalId ? (
        <Dialog
          modal={false}
          open
          onOpenChange={(v) => {
            if (!v) setReservationDetailModalId(null)
          }}
        >
          <DialogContent
            overlayClassName={PNL_NESTED_DETAIL_OVERLAY_CLASS}
            className={PNL_NESTED_DETAIL_CONTENT_CLASS}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={preventNestedDetailDialogDismiss}
            onFocusOutside={preventNestedDetailDialogDismiss}
            onInteractOutside={preventNestedDetailDialogDismiss}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 border-b border-gray-200 px-4 py-3 pr-12 shrink-0 text-left">
              <DialogTitle className="text-base font-semibold truncate flex-1 min-w-0">예약 상세</DialogTitle>
              <a
                href={`/${locale}/admin/reservations/${reservationDetailModalId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 shrink-0 ml-2"
              >
                새 탭에서 열기
                <ExternalLink size={14} aria-hidden />
              </a>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
              <ReservationDetailModalContent reservationId={reservationDetailModalId} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
