'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import type { ExpenseStatementReconContext, SimilarStatementLineRow, SimilarStatementLinesMatchMode } from '@/lib/expense-reconciliation-similar-lines'
import {
  collectOffsetPairCounterpartLineIds,
  expenseReconciliationAmountTolerance,
  fetchLinkedStatementLineRowsForExpenseSource,
  fetchSimilarStatementLineRowsByIds,
  fetchSimilarStatementLinesForExpenseRow,
  fetchStatementLinePairCounterpartsByLineIds,
  fetchStatementLinesForTicketBookingDateProbe,
  isSimilarStatementLineShownForUnmatchedFilter,
  mergeLinkedAndCandidateRows,
  replaceExpenseReconciliationMatch,
  resolveStatementLineConflictsBeforeLink,
  searchStatementLinesAcrossImports,
  sumMatchedAmountAllocatedToSource,
  unlinkExpenseReconciliationMatch,
  type StatementLineConflictResolution,
  type StatementLinePairCounterpartInfo,
} from '@/lib/expense-reconciliation-similar-lines'
import {
  expenseSourceSupportsCashLedgerLink,
  fetchLinkedCashTransactionsForExpense,
  fetchLinkedExpensesForCashTransaction,
  fetchSimilarCashTransactionsForExpense,
  fetchSimilarExpensesForCashTransaction,
  parseExpenseCashLinkRowKey,
  expenseCashLinkRowKey,
  searchCashTransactions,
  searchExpensesForCashTransaction,
  attachExternalLinksToExpenseForCashRows,
  expenseForCashHasStatementLink,
  expenseForCashHasOtherCashLink,
  linkExpensesToCashTransaction,
  unlinkExpenseCashLedgerMatches,
  unlinkExpenseCashLedgerMatchesForCash,
  type SimilarCashTransactionRow,
  type SimilarExpenseForCashRow,
} from '@/lib/expense-cash-ledger-match'
import CashTransactionPickerModal from '@/components/reconciliation/CashTransactionPickerModal'
import { fetchStatementLinePairsForLineIds } from '@/lib/statement-line-pairs'
import { ArrowLeftRight } from 'lucide-react'
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
import { cn } from '@/lib/utils'

const ACCOUNT_TAB_ALL = '__all__'
const UNKNOWN_ACCOUNT_TAB_ID = '__unknown_account__'

type StatementStatusFilter = 'unmatched' | 'all'

function rowPassesStatementStatusFilter(
  r: SimilarStatementLineRow,
  filter: StatementStatusFilter
): boolean {
  if (filter === 'all') return true
  return isSimilarStatementLineShownForUnmatchedFilter(r)
}

/** 세그먼트 필터 — 선택·비선택 대비를 크게 */
function FilterSegmentButton({
  active,
  onClick,
  disabled,
  children,
  activeTone,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  activeTone: 'slate' | 'emerald'
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-9 sm:h-8 min-w-0 sm:min-w-[4.5rem] flex-1 sm:flex-none px-2 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-md transition-all border',
        disabled && 'opacity-50 cursor-not-allowed',
        active
          ? activeTone === 'slate'
            ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-400/50 ring-offset-1'
            : 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/60 ring-offset-1'
          : activeTone === 'slate'
            ? 'bg-white text-slate-600 border-transparent hover:bg-white hover:text-slate-900 hover:border-slate-200'
            : 'bg-white/90 text-emerald-900/75 border-transparent hover:bg-white hover:text-emerald-950 hover:border-emerald-200'
      )}
    >
      {active ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

function MobileKvRow({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex gap-2 text-xs leading-snug min-w-0', className)}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-[4.5rem]">
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  )
}

const RECON_MODAL_SHELL_CLASS = cn(
  '!flex !flex-col gap-0 overflow-hidden p-0 lg:p-6',
  'max-lg:fixed max-lg:inset-x-0 max-lg:top-[var(--header-height,4rem)] max-lg:bottom-[calc(var(--footer-height,4rem)+env(safe-area-inset-bottom,0px))] max-lg:translate-x-0 max-lg:translate-y-0 max-lg:h-auto max-lg:max-h-none max-lg:w-full max-lg:max-w-none max-lg:rounded-none max-lg:border-0 max-lg:shadow-none',
  'lg:top-[50%] lg:left-[50%] lg:translate-x-[-50%] lg:translate-y-[-50%] lg:max-h-[88vh] lg:h-auto lg:w-full lg:max-w-[min(98vw,88rem)] lg:rounded-lg lg:border lg:shadow-lg'
)

function ReconModalSection({
  title,
  badge,
  tone = 'neutral',
  fill = false,
  className,
  children,
}: {
  title: string
  badge?: ReactNode
  tone?: 'neutral' | 'source' | 'candidates' | 'cash' | 'sky'
  fill?: boolean
  className?: string
  children: ReactNode
}) {
  const shell = {
    neutral: 'border-slate-200 bg-white',
    source: 'border-slate-200 bg-slate-50/90',
    candidates: 'border-emerald-300/70 bg-white',
    cash: 'border-amber-300/70 bg-white',
    sky: 'border-sky-300/70 bg-white',
  }
  const header = {
    neutral: 'border-slate-200 bg-slate-100/90 text-slate-800',
    source: 'border-slate-200 bg-white text-slate-800',
    candidates: 'border-emerald-200/80 bg-emerald-100/70 text-emerald-950',
    cash: 'border-amber-200/80 bg-amber-100/70 text-amber-950',
    sky: 'border-sky-200/80 bg-sky-100/70 text-sky-950',
  }
  return (
    <section
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden',
        shell[tone],
        fill && 'flex min-h-0 flex-1 flex-col',
        className
      )}
    >
      <div className={cn('flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2', header[tone])}>
        <h3 className="text-[11px] font-bold uppercase tracking-wide">{title}</h3>
        {badge != null ? (
          <span className="shrink-0 rounded-full border border-current/15 bg-white/90 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
            {badge}
          </span>
        ) : null}
      </div>
      <div className={cn(fill ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'p-3')}>{children}</div>
    </section>
  )
}

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
  submitBy: string
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

function formatSubmitterDisplay(
  email: string | null | undefined,
  teamLabels: Map<string, string>
): string {
  const e = String(email ?? '').trim()
  if (!e) return '—'
  return teamLabels.get(e.toLowerCase()) || e
}

function StatementTableLinkedMatchCell({
  match: _match,
  detail,
  labels,
  paymentMethodMap,
  paymentMethodFinancialAccountNameByPmId,
  fallbackLabel,
  sourceTypeLabel,
  formatSubmitter,
}: {
  match: LedgerMatchRef
  detail: LedgerMatchDetail | undefined
  labels: LedgerMatchDetailLabelBundle
  paymentMethodMap: Record<string, string>
  paymentMethodFinancialAccountNameByPmId: Record<string, string>
  fallbackLabel: string
  sourceTypeLabel: (table: string) => string
  formatSubmitter: (email: string) => string
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
    pmLabel,
    { formatSubmitter }
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
  submitterEmail?: string | null
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
        .select('payment_method, paid_for, paid_to, description, submit_by')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.description ?? null,
        secondaryDetail: data.paid_to ?? null,
        submitterEmail: data.submit_by ?? null,
      }
    }
    case 'reservation_expenses': {
      const { data } = await supabase
        .from('reservation_expenses')
        .select('payment_method, paid_for, paid_to, note, submitted_by')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.note ?? null,
        secondaryDetail: data.paid_to ?? null,
        submitterEmail: data.submitted_by ?? null,
      }
    }
    case 'tour_expenses': {
      const { data } = await supabase
        .from('tour_expenses')
        .select('payment_method, paid_for, paid_to, note, submitted_by')
        .eq('id', context.sourceId)
        .maybeSingle()
      if (!data) return null
      return {
        paymentMethod: data.payment_method ?? null,
        primaryDetail: data.paid_for ?? data.note ?? null,
        secondaryDetail: data.paid_to ?? null,
        submitterEmail: data.submitted_by ?? null,
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
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
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
  const [statementStatusFilter, setStatementStatusFilter] = useState<StatementStatusFilter>('unmatched')
  const [rowSearch, setRowSearch] = useState('')
  const [rowSearchInput, setRowSearchInput] = useState('')
  const [searchResultRows, setSearchResultRows] = useState<SimilarStatementLineRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const statementSearchGenRef = useRef(0)
  const [sourceSummary, setSourceSummary] = useState<SourceSummaryInfo | null>(null)
  const [syncAmountToStatement, setSyncAmountToStatement] = useState(false)
  const [appendLink, setAppendLink] = useState(false)
  const [appendAmountStr, setAppendAmountStr] = useState('')
  const [sourceAllocatedSum, setSourceAllocatedSum] = useState<number | null>(null)
  const appendAmountUserEditedRef = useRef(false)
  const headerSelectAllRef = useRef<HTMLInputElement>(null)
  const headerSelectAllMobileRef = useRef<HTMLInputElement>(null)
  const [activeAccountTab, setActiveAccountTab] = useState(ACCOUNT_TAB_ALL)
  const [conflictDetails, setConflictDetails] = useState<LedgerMatchDetail[]>([])
  const [conflictDetailsLoading, setConflictDetailsLoading] = useState(false)
  const [linkedMatchDetailsByKey, setLinkedMatchDetailsByKey] = useState<Map<string, LedgerMatchDetail>>(
    () => new Map()
  )
  const [linkedMatchDetailsLoading, setLinkedMatchDetailsLoading] = useState(false)
  const [showOffsetPairs, setShowOffsetPairs] = useState(false)
  const [offsetPairsByLineId, setOffsetPairsByLineId] = useState<
    Map<string, StatementLinePairCounterpartInfo[]>
  >(() => new Map())
  const [offsetInjectedRows, setOffsetInjectedRows] = useState<SimilarStatementLineRow[]>([])
  const [offsetPairsLoading, setOffsetPairsLoading] = useState(false)
  const [cashRows, setCashRows] = useState<SimilarCashTransactionRow[]>([])
  const [linkedCashRows, setLinkedCashRows] = useState<SimilarCashTransactionRow[]>([])
  const [selectedCashId, setSelectedCashId] = useState<string | null>(null)
  const [cashLoading, setCashLoading] = useState(false)
  const [cashSaving, setCashSaving] = useState(false)
  const [unlinkingCashId, setUnlinkingCashId] = useState<string | null>(null)
  const [cashSearch, setCashSearch] = useState('')
  const [cashSearchResultRows, setCashSearchResultRows] = useState<SimilarCashTransactionRow[]>([])
  const [cashSearchLoading, setCashSearchLoading] = useState(false)
  const [expenseForCashRows, setExpenseForCashRows] = useState<SimilarExpenseForCashRow[]>([])
  const [linkedExpenseForCashRows, setLinkedExpenseForCashRows] = useState<SimilarExpenseForCashRow[]>([])
  const [selectedExpenseForCashKeys, setSelectedExpenseForCashKeys] = useState<string[]>([])
  const [expenseForCashLoading, setExpenseForCashLoading] = useState(false)
  const [expenseForCashSaving, setExpenseForCashSaving] = useState(false)
  const [unlinkingExpenseForCashKey, setUnlinkingExpenseForCashKey] = useState<string | null>(null)
  const [expenseForCashSearch, setExpenseForCashSearch] = useState('')
  const [expenseForCashSearchInput, setExpenseForCashSearchInput] = useState('')
  const [expenseForCashSearchRows, setExpenseForCashSearchRows] = useState<SimilarExpenseForCashRow[]>([])
  const [expenseForCashSearchLoading, setExpenseForCashSearchLoading] = useState(false)
  const expenseForCashSearchGenRef = useRef(0)
  const [cashSectionExpenseRows, setCashSectionExpenseRows] = useState<SimilarExpenseForCashRow[]>([])
  const [linkedCashSectionExpenseRows, setLinkedCashSectionExpenseRows] = useState<SimilarExpenseForCashRow[]>([])
  const [selectedCashLinkExpenseKeys, setSelectedCashLinkExpenseKeys] = useState<string[]>([])
  const [cashSectionExpenseLoading, setCashSectionExpenseLoading] = useState(false)
  const [cashPickerOpen, setCashPickerOpen] = useState(false)
  const [teamMemberLabels, setTeamMemberLabels] = useState<Map<string, string>>(() => new Map())

  const ticketDateProbe = context?.ticketBookingDateProbe
  const isCashAnchorMode =
    Boolean(context) &&
    context!.sourceTable === 'cash_transactions' &&
    context!.direction === 'outflow'
  const showCashLedgerSection =
    Boolean(context) &&
    context!.direction === 'outflow' &&
    expenseSourceSupportsCashLedgerLink(context!.sourceTable)

  const contextRef = useRef(context)
  const matchModeRef = useRef(matchMode)
  const tRef = useRef(t)
  const activeOperatorIdRef = useRef(activeOperatorId)
  contextRef.current = context
  matchModeRef.current = matchMode
  tRef.current = t
  activeOperatorIdRef.current = activeOperatorId

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.from('team').select('email, display_name, name_ko')
        if (error) throw error
        if (cancelled) return
        const memberMap = new Map<string, string>()
        for (const member of data ?? []) {
          const email = String(member.email || '').trim()
          if (!email) continue
          const dn = member.display_name != null ? String(member.display_name).trim() : ''
          const ko = member.name_ko != null ? String(member.name_ko).trim() : ''
          memberMap.set(email.toLowerCase(), dn || ko || email)
        }
        setTeamMemberLabels(memberMap)
      } catch {
        if (!cancelled) setTeamMemberLabels(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const formatSubmitter = useCallback(
    (email: string) => formatSubmitterDisplay(email, teamMemberLabels),
    [teamMemberLabels]
  )

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
      if (ctx.sourceTable === 'cash_transactions' && ctx.direction === 'outflow') {
        setLinkedRows([])
        setSourceAllocByLineId(new Map())
        setMatchIdByLineId(new Map())
        setRows([])
        setLinkedCashRows([])
        setCashRows([])
        if (!opts?.preserveSelection) {
          setSelectedCashId(null)
          setSelectedIdsOrdered([])
        }

        setExpenseForCashLoading(true)
        try {
          const linkedExpenses = await fetchLinkedExpensesForCashTransaction(supabase, ctx.sourceId)
          setLinkedExpenseForCashRows(linkedExpenses)
          const linkedKeys = new Set(linkedExpenses.map((r) => r.key))
          const similarExpenses = await fetchSimilarExpensesForCashTransaction(supabase, {
            cashTransactionId: ctx.sourceId,
            dateYmd: ctx.dateYmd,
            amount: ctx.amount,
            matchMode: mode,
            linkedExpenseKeys: linkedKeys,
            operatorId: activeOperatorIdRef.current,
          })
          const mergedExpenses = [...linkedExpenses]
          for (const row of similarExpenses) {
            if (!mergedExpenses.some((x) => x.key === row.key)) mergedExpenses.push(row)
          }
          const mergedWithLinks = await attachExternalLinksToExpenseForCashRows(
            supabase,
            mergedExpenses,
            ctx.sourceId
          )
          setExpenseForCashRows(mergedWithLinks)
          setLinkedExpenseForCashRows(mergedWithLinks.filter((r) => linkedKeys.has(r.key)))
          if (!opts?.preserveSelection) {
            setSelectedExpenseForCashKeys([])
          }
        } catch (expErr) {
          console.error(expErr)
          setLinkedExpenseForCashRows([])
          setExpenseForCashRows([])
          if (!opts?.preserveSelection) setSelectedExpenseForCashKeys([])
          setMessage(expErr instanceof Error ? expErr.message : tRef.current('loadError'))
        } finally {
          setExpenseForCashLoading(false)
        }
        return
      }

      setLinkedExpenseForCashRows([])
      setExpenseForCashRows([])
      if (!opts?.preserveSelection) setSelectedExpenseForCashKeys([])

      const linkedPromise = fetchLinkedStatementLineRowsForExpenseSource(supabase, {
        sourceTable: ctx.sourceTable,
        sourceId: ctx.sourceId,
        dateYmd: ctx.dateYmd,
        ledgerAmount: ctx.amount,
      })
      const candidatesPromise = probe
        ? fetchStatementLinesForTicketBookingDateProbe(supabase, {
            submitYmd: probe.submitYmd ?? null,
            checkInYmd: probe.checkInYmd ?? null,
            ...(probe.dayWindow !== undefined ? { dayWindow: probe.dayWindow } : {}),
            financialAccountId: probe.financialAccountId ?? null,
            ledgerAmount: ctx.amount,
            limit: 400,
            operatorId: activeOperatorIdRef.current,
          })
        : fetchSimilarStatementLinesForExpenseRow(supabase, {
            dateYmd: ctx.dateYmd,
            amount: ctx.amount,
            direction: ctx.direction,
            matchMode: mode,
            limit: mode === 'amountOnly' ? 200 : 100,
            operatorId: activeOperatorIdRef.current,
          })

      const [linkedPack, list] = await Promise.all([linkedPromise, candidatesPromise])
      setLinkedRows(linkedPack.rows)
      setSourceAllocByLineId(linkedPack.allocatedByLineId)
      setMatchIdByLineId(linkedPack.matchIdByLineId)
      setRows(mergeLinkedAndCandidateRows(linkedPack.rows, list))

      if (
        ctx.direction === 'outflow' &&
        expenseSourceSupportsCashLedgerLink(ctx.sourceTable)
      ) {
        setCashLoading(true)
        try {
          const linkedCash = await fetchLinkedCashTransactionsForExpense(supabase, {
            sourceTable: ctx.sourceTable,
            sourceId: ctx.sourceId,
          })
          setLinkedCashRows(linkedCash)
          const linkedIds = new Set(linkedCash.map((r) => r.id))
          const similarCash = await fetchSimilarCashTransactionsForExpense(supabase, {
            dateYmd: ctx.dateYmd,
            amount: ctx.amount,
            linkedCashIds: linkedIds,
            operatorId: activeOperatorIdRef.current,
          })
          const mergedCash = [...linkedCash]
          for (const row of similarCash) {
            if (!mergedCash.some((x) => x.id === row.id)) mergedCash.push(row)
          }
          setCashRows(mergedCash)
          if (!opts?.preserveSelection) {
            setSelectedCashId(linkedCash[0]?.id ?? null)
          }
        } catch (cashErr) {
          console.error(cashErr)
          setLinkedCashRows([])
          setCashRows([])
          if (!opts?.preserveSelection) setSelectedCashId(null)
        } finally {
          setCashLoading(false)
        }
      } else {
        setLinkedCashRows([])
        setCashRows([])
        if (!opts?.preserveSelection) setSelectedCashId(null)
      }
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
      setStatementStatusFilter('unmatched')
      setRowSearch('')
      setRowSearchInput('')
      setSearchResultRows([])
      setSearchLoading(false)
      setSourceSummary(null)
      setSyncAmountToStatement(false)
      setAppendLink(false)
      setAppendAmountStr('')
      setSourceAllocatedSum(null)
      appendAmountUserEditedRef.current = false
      setActiveAccountTab(ACCOUNT_TAB_ALL)
      setShowOffsetPairs(false)
      setOffsetPairsByLineId(new Map())
      setOffsetInjectedRows([])
      setOffsetPairsLoading(false)
      setCashRows([])
      setLinkedCashRows([])
      setSelectedCashId(null)
      setCashLoading(false)
      setCashSaving(false)
      setUnlinkingCashId(null)
      setCashSearch('')
      setCashSearchResultRows([])
      setCashSearchLoading(false)
      setExpenseForCashRows([])
      setLinkedExpenseForCashRows([])
      setSelectedExpenseForCashKeys([])
      setCashSectionExpenseRows([])
      setLinkedCashSectionExpenseRows([])
      setSelectedCashLinkExpenseKeys([])
      setCashSectionExpenseLoading(false)
      setCashPickerOpen(false)
      setExpenseForCashLoading(false)
      setExpenseForCashSaving(false)
      setUnlinkingExpenseForCashKey(null)
      setExpenseForCashSearch('')
      setExpenseForCashSearchInput('')
      setExpenseForCashSearchRows([])
      setExpenseForCashSearchLoading(false)
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
  const cashSearchTrimmed = cashSearch.trim()
  const isCashSearchActive = cashSearchTrimmed.length > 0
  const expenseForCashSearchTrimmed = expenseForCashSearch.trim()
  const isExpenseForCashSearchActive = expenseForCashSearchTrimmed.length > 0

  const visibleCashRows = useMemo(() => {
    if (!isCashSearchActive) return cashRows
    const merged = [...linkedCashRows]
    for (const row of cashSearchResultRows) {
      if (!merged.some((x) => x.id === row.id)) merged.push(row)
    }
    return merged
  }, [cashRows, linkedCashRows, cashSearchResultRows, isCashSearchActive])

  const linkedCashRowIds = useMemo(
    () => new Set(linkedCashRows.map((r) => r.id)),
    [linkedCashRows]
  )

  useEffect(() => {
    if (!open || !context || !showCashLedgerSection) return
    if (!isCashSearchActive) {
      setCashSearchResultRows([])
      setCashSearchLoading(false)
      return
    }
    setCashSearchLoading(true)
    let cancelled = false
    const timer = setTimeout(() => {
      void searchCashTransactions(supabase, {
        query: cashSearchTrimmed,
        limit: 150,
        linkedCashIds: linkedCashRowIds,
        dateYmd: context.dateYmd,
        ledgerAmount: context.amount,
        operatorId: activeOperatorId,
      })
        .then((list) => {
          if (!cancelled) setCashSearchResultRows(list)
        })
        .catch((e) => {
          if (!cancelled) {
            setMessage(e instanceof Error ? e.message : t('loadError'))
            setCashSearchResultRows([])
          }
        })
        .finally(() => {
          if (!cancelled) setCashSearchLoading(false)
        })
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    cashSearch,
    open,
    context,
    showCashLedgerSection,
    isCashSearchActive,
    cashSearchTrimmed,
    linkedCashRowIds,
    activeOperatorId,
    t,
  ])

  const visibleExpenseForCashRows = useMemo(() => {
    if (!isExpenseForCashSearchActive) return expenseForCashRows
    const merged = [...linkedExpenseForCashRows]
    for (const row of expenseForCashSearchRows) {
      if (!merged.some((x) => x.key === row.key)) merged.push(row)
    }
    return merged
  }, [expenseForCashRows, linkedExpenseForCashRows, expenseForCashSearchRows, isExpenseForCashSearchActive])

  useEffect(() => {
    if (!open || !context || !isCashAnchorMode) return
    if (!isExpenseForCashSearchActive) {
      setExpenseForCashSearchRows([])
      setExpenseForCashSearchLoading(false)
      return
    }
    const gen = ++expenseForCashSearchGenRef.current
    setExpenseForCashSearchLoading(true)
    void searchExpensesForCashTransaction(supabase, {
      query: expenseForCashSearchTrimmed,
      cashTransactionId: context.sourceId,
      limit: 150,
      linkedExpenseKeys: new Set(linkedExpenseForCashRows.map((r) => r.key)),
      dateYmd: context.dateYmd,
      cashAmount: context.amount,
      operatorId: activeOperatorId,
    })
      .then(async (list) => {
        if (gen !== expenseForCashSearchGenRef.current) return
        const withLinks = await attachExternalLinksToExpenseForCashRows(
          supabase,
          list,
          context.sourceId
        )
        if (gen !== expenseForCashSearchGenRef.current) return
        setExpenseForCashSearchRows(withLinks)
      })
      .catch((e) => {
        if (gen !== expenseForCashSearchGenRef.current) return
        setMessage(e instanceof Error ? e.message : t('loadError'))
        setExpenseForCashSearchRows([])
      })
      .finally(() => {
        if (gen === expenseForCashSearchGenRef.current) setExpenseForCashSearchLoading(false)
      })
  }, [
    expenseForCashSearch,
    open,
    context,
    isCashAnchorMode,
    isExpenseForCashSearchActive,
    expenseForCashSearchTrimmed,
    linkedExpenseForCashRows,
    t,
  ])

  const visibleCashSectionExpenseRows = useMemo(() => cashSectionExpenseRows, [cashSectionExpenseRows])

  const contextExpenseKey = useMemo(
    () => (context ? expenseCashLinkRowKey(context.sourceTable, context.sourceId) : null),
    [context]
  )

  const toggleExpenseForCashKey = useCallback((key: string) => {
    setSelectedExpenseForCashKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const toggleCashLinkExpenseKey = useCallback((key: string) => {
    setSelectedCashLinkExpenseKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const selectableExpenseForCashRows = useMemo(
    () => visibleExpenseForCashRows.filter((r) => !r.linked_to_this_cash),
    [visibleExpenseForCashRows]
  )

  const allSelectableExpenseForCashSelected =
    selectableExpenseForCashRows.length > 0 &&
    selectableExpenseForCashRows.every((r) => selectedExpenseForCashKeys.includes(r.key))

  const selectableCashSectionExpenseRows = useMemo(
    () => visibleCashSectionExpenseRows.filter((r) => !r.linked_to_this_cash),
    [visibleCashSectionExpenseRows]
  )

  const allSelectableCashSectionExpensesSelected =
    selectableCashSectionExpenseRows.length > 0 &&
    selectableCashSectionExpenseRows.every((r) => selectedCashLinkExpenseKeys.includes(r.key))

  useEffect(() => {
    if (!open || !context || isCashAnchorMode || !showCashLedgerSection || !selectedCashId) {
      setCashSectionExpenseRows([])
      setLinkedCashSectionExpenseRows([])
      if (!selectedCashId) setSelectedCashLinkExpenseKeys([])
      setCashSectionExpenseLoading(false)
      return
    }
    const cashRow = visibleCashRows.find((r) => r.id === selectedCashId)
    if (!cashRow) return

    let cancelled = false
    setCashSectionExpenseLoading(true)
    void (async () => {
      try {
        const linkedExpenses = await fetchLinkedExpensesForCashTransaction(supabase, selectedCashId)
        const linkedKeys = new Set(linkedExpenses.map((r) => r.key))
        const similarExpenses = await fetchSimilarExpensesForCashTransaction(supabase, {
          cashTransactionId: selectedCashId,
          dateYmd: cashRow.transaction_date,
          amount: cashRow.amount,
          matchMode,
          linkedExpenseKeys: linkedKeys,
          operatorId: activeOperatorId,
        })
        const mergedExpenses = [...linkedExpenses]
        for (const row of similarExpenses) {
          if (!mergedExpenses.some((x) => x.key === row.key)) mergedExpenses.push(row)
        }
        const ctxKey = expenseCashLinkRowKey(context.sourceTable, context.sourceId)
        if (!mergedExpenses.some((x) => x.key === ctxKey)) {
          mergedExpenses.unshift({
            key: ctxKey,
            source_table: context.sourceTable as SimilarExpenseForCashRow['source_table'],
            source_id: context.sourceId,
            submit_date: context.dateYmd,
            amount: Math.abs(context.amount),
            paid_to: sourceSummary?.primaryDetail ?? null,
            paid_for: sourceSummary?.secondaryDetail ?? null,
            detail: null,
            submitter_email: sourceSummary?.submitterEmail ?? null,
            amount_diff: Math.abs(Math.abs(context.amount) - cashRow.amount),
            day_diff: 0,
            score: 2000,
            linked_to_this_cash: linkedKeys.has(ctxKey),
            external_links: [],
          })
        }
        const mergedWithLinks = await attachExternalLinksToExpenseForCashRows(
          supabase,
          mergedExpenses,
          selectedCashId
        )
        if (cancelled) return
        setCashSectionExpenseRows(mergedWithLinks)
        setLinkedCashSectionExpenseRows(mergedWithLinks.filter((r) => linkedKeys.has(r.key)))
        const ctxLinked = linkedKeys.has(ctxKey)
        setSelectedCashLinkExpenseKeys(ctxLinked ? [] : [ctxKey])
      } catch (e) {
        if (!cancelled) {
          setCashSectionExpenseRows([])
          setLinkedCashSectionExpenseRows([])
          setSelectedCashLinkExpenseKeys([])
          setMessage(e instanceof Error ? e.message : t('loadError'))
        }
      } finally {
        if (!cancelled) setCashSectionExpenseLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    open,
    context,
    isCashAnchorMode,
    showCashLedgerSection,
    selectedCashId,
    visibleCashRows,
    matchMode,
    sourceSummary,
    t,
  ])

  const baseSourceRows = useMemo(() => {
    if (!isSearchActive) return rows
    return searchResultRows
  }, [rows, searchResultRows, isSearchActive])

  const offsetInjectedLineIdSet = useMemo(
    () => new Set(offsetInjectedRows.map((r) => r.id)),
    [offsetInjectedRows]
  )

  const sourceRows = useMemo(() => {
    if (!showOffsetPairs || offsetInjectedRows.length === 0) return baseSourceRows
    const baseIds = new Set(baseSourceRows.map((r) => r.id))
    const extra = offsetInjectedRows.filter((r) => !baseIds.has(r.id))
    return [...baseSourceRows, ...extra]
  }, [baseSourceRows, showOffsetPairs, offsetInjectedRows])

  const statusFilteredSourceRows = useMemo(
    () => sourceRows.filter((r) => rowPassesStatementStatusFilter(r, statementStatusFilter)),
    [sourceRows, statementStatusFilter]
  )

  const accountTabs = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>()
    for (const r of statusFilteredSourceRows) {
      const id = accountTabIdForRow(r)
      const name = r.financial_account_name?.trim() || '—'
      const cur = map.get(id)
      if (cur) cur.count += 1
      else map.set(id, { name, count: 1 })
    }
    return [...map.entries()]
      .map(([id, { name, count }]) => ({ id, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [statusFilteredSourceRows])

  const visibleRows = useMemo(() => {
    if (activeAccountTab === ACCOUNT_TAB_ALL) return statusFilteredSourceRows
    return statusFilteredSourceRows.filter((r) => accountTabIdForRow(r) === activeAccountTab)
  }, [statusFilteredSourceRows, activeAccountTab])

  const rowById = useMemo(() => {
    const m = new Map<string, SimilarStatementLineRow>()
    for (const r of rows) m.set(r.id, r)
    for (const r of searchResultRows) m.set(r.id, r)
    for (const r of offsetInjectedRows) m.set(r.id, r)
    return m
  }, [rows, searchResultRows, offsetInjectedRows])

  useEffect(() => {
    if (!open || !showOffsetPairs) {
      setOffsetPairsByLineId(new Map())
      setOffsetInjectedRows([])
      setOffsetPairsLoading(false)
      return
    }
    const lineIds = baseSourceRows.map((r) => r.id)
    if (lineIds.length === 0) {
      setOffsetPairsByLineId(new Map())
      setOffsetInjectedRows([])
      setOffsetPairsLoading(false)
      return
    }
    let cancelled = false
    setOffsetPairsLoading(true)
    void (async () => {
      try {
        const [pairs, counterparts] = await Promise.all([
          fetchStatementLinePairsForLineIds(supabase, lineIds),
          fetchStatementLinePairCounterpartsByLineIds(supabase, lineIds),
        ])
        if (cancelled) return
        setOffsetPairsByLineId(counterparts)
        const injectIds = collectOffsetPairCounterpartLineIds(
          pairs,
          lineIds,
          new Set(lineIds)
        )
        if (injectIds.length === 0) {
          setOffsetInjectedRows([])
          return
        }
        const injected = await fetchSimilarStatementLineRowsByIds(supabase, injectIds)
        if (!cancelled) setOffsetInjectedRows(injected)
      } catch {
        if (!cancelled) {
          setOffsetPairsByLineId(new Map())
          setOffsetInjectedRows([])
        }
      } finally {
        if (!cancelled) setOffsetPairsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, showOffsetPairs, baseSourceRows])

  const applyRowSearch = useCallback(() => {
    setRowSearch(rowSearchInput.trim())
  }, [rowSearchInput])

  const applyExpenseForCashSearch = useCallback(() => {
    setExpenseForCashSearch(expenseForCashSearchInput.trim())
  }, [expenseForCashSearchInput])

  useEffect(() => {
    if (!open || !context) return
    if (!isSearchActive) {
      setSearchResultRows([])
      setSearchLoading(false)
      return
    }
    const gen = ++statementSearchGenRef.current
    setSearchLoading(true)
    void searchStatementLinesAcrossImports(supabase, {
      query: searchQueryTrimmed,
      direction: ticketDateProbe ? null : context.direction,
      limit: 250,
      operatorId: activeOperatorId,
    })
      .then((list) => {
        if (gen !== statementSearchGenRef.current) return
        setSearchResultRows(list)
        setMessage(null)
      })
      .catch((e) => {
        if (gen !== statementSearchGenRef.current) return
        setMessage(e instanceof Error ? e.message : t('loadError'))
        setSearchResultRows([])
      })
      .finally(() => {
        if (gen === statementSearchGenRef.current) setSearchLoading(false)
      })
  }, [
    rowSearch,
    open,
    context,
    t,
    ticketDateProbe,
    isSearchActive,
    searchQueryTrimmed,
    activeOperatorId,
  ])

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
    const indeterminate = someVisibleSelected && !allVisibleSelected
    for (const el of [headerSelectAllRef.current, headerSelectAllMobileRef.current]) {
      if (el) el.indeterminate = indeterminate
    }
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
    submitBy: t('expenseFromCashColSubmitter'),
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

  const appendConnectDisabled =
    selectedIdsOrdered.length === 0 ||
    saving ||
    (!anySelectedInflow && remainingOnLedger != null && remainingOnLedger < 0.01)

  const appendConnectLabel =
    selectedLineCount > 1 ? t('connectAppendN', { n: selectedLineCount }) : t('connectAppend')

  const apply = async (
    conflictResolution?: StatementLineConflictResolution,
    forceMode?: 'replace' | 'append'
  ) => {
    if (!context || !user?.email) {
      setMessage(t('needLogin'))
      return
    }
    const appendMode = forceMode === 'append' ? true : forceMode === 'replace' ? false : appendLink
    let ordered = dedupeStatementLineIdsPreserveOrder(selectedIdsOrdered)
    if (appendMode) {
      ordered = ordered.filter((id) => !linkedLineIdSet.has(id))
    }
    if (ordered.length === 0) {
      setMessage(t('needSelectLine'))
      return
    }
    if (!appendMode && ordered.length > 1 && !allowTicketMultiLink) {
      setMessage(t('replaceSelectSingleOnly'))
      return
    }
    if (hasLineConflict && !conflictResolution && !appendMode) {
      setMessage(t('lineConflictNeedChoice'))
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const ledgerCap = Math.abs(context.amount)
      const email = user.email

      if (!appendMode && allowTicketMultiLink && ordered.length > 1) {
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
            operatorId: activeOperatorId,
          })
        }
        onApplied?.()
        onOpenChange(false)
        return
      }

      if (!appendMode) {
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
        const cappedShare = lineRoom > 0.009 ? Math.min(ledgerCap, lineRoom) : ledgerCap
        // 순비용 $0(환불 등) 부킹은 ledgerCap=0이라 분할값이 0이 됨 → 0 저장 방지, 명세 줄 전액으로 폴백
        const matchedAmount =
          cappedShare > 0.009 ? cappedShare : lineRoom > 0.009 ? lineRoom : lineAbs

        await replaceExpenseReconciliationMatch(supabase, {
          actorEmail: email,
          sourceTable: context.sourceTable,
          sourceId: context.sourceId,
          statementLineId: row.id,
          statementLineAmount: row.amount,
          matchedAmount,
          linkMode: 'replace',
          ledgerCapAmount: ledgerCap,
          syncSourceAmountToStatement: canSync && syncAmountToStatement,
          operatorId: activeOperatorId,
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
          syncSourceAmountToStatement: false,
          operatorId: activeOperatorId,
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
          syncSourceAmountToStatement: false,
          operatorId: activeOperatorId,
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

  const handleCashPicked = useCallback(
    (row: SimilarCashTransactionRow) => {
      setSelectedCashId(row.id)
      setCashRows((prev) => {
        if (prev.some((x) => x.id === row.id)) {
          return prev.map((x) =>
            x.id === row.id
              ? { ...row, linked_to_this_expense: linkedCashRows.some((l) => l.id === row.id) }
              : x
          )
        }
        return [
          { ...row, linked_to_this_expense: linkedCashRows.some((l) => l.id === row.id) },
          ...prev,
        ]
      })
    },
    [linkedCashRows]
  )

  const selectedCashRow = useMemo(() => {
    if (!selectedCashId) return null
    return (
      visibleCashRows.find((r) => r.id === selectedCashId) ??
      linkedCashRows.find((r) => r.id === selectedCashId) ??
      cashRows.find((r) => r.id === selectedCashId) ??
      null
    )
  }, [selectedCashId, visibleCashRows, linkedCashRows, cashRows])

  const applyCashLink = async () => {
    if (!context || !user?.email || !selectedCashId) {
      setMessage(t('cashNeedSelect'))
      return
    }
    const cashRow = visibleCashRows.find((r) => r.id === selectedCashId)
    if (!cashRow) {
      setMessage(t('saveError'))
      return
    }
    const ctxKey = expenseCashLinkRowKey(context.sourceTable, context.sourceId)
    const keysToLink =
      selectedCashLinkExpenseKeys.length > 0
        ? [...new Set(selectedCashLinkExpenseKeys)]
        : [ctxKey]
    const rowByKey = new Map(cashSectionExpenseRows.map((r) => [r.key, r]))
    const items = keysToLink
      .map((key) => {
        const parsed = parseExpenseCashLinkRowKey(key)
        const row = rowByKey.get(key)
        if (!parsed || !row) return null
        return {
          expenseSourceTable: parsed.sourceTable,
          expenseSourceId: parsed.sourceId,
          expenseAmount: row.amount,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    if (items.length === 0) {
      setMessage(t('cashNeedSelectExpenses'))
      return
    }
    setCashSaving(true)
    setMessage(null)
    try {
      const { linked, skippedAlreadyLinked } = await linkExpensesToCashTransaction(supabase, {
        actorEmail: user.email,
        cashTransactionId: cashRow.id,
        cashAmount: cashRow.amount,
        operatorId: activeOperatorId,
        items,
      })
      if (linked === 0 && skippedAlreadyLinked > 0) {
        setMessage(t('cashAllSelectedAlreadyLinked'))
      } else if (linked > 0) {
        onApplied?.()
        await runLoad({ preserveSelection: true })
        setSelectedCashLinkExpenseKeys([])
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setCashSaving(false)
    }
  }

  const unlinkCash = async (cashId: string) => {
    if (!context || !user?.email) return
    setUnlinkingCashId(cashId)
    setMessage(null)
    try {
      await unlinkExpenseCashLedgerMatches(supabase, context.sourceTable, context.sourceId)
      await runLoad({ preserveSelection: true })
      onApplied?.()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('cashUnlinkError'))
    } finally {
      setUnlinkingCashId(null)
    }
  }

  const applyExpenseLinkFromCash = async () => {
    if (!context || !user?.email || selectedExpenseForCashKeys.length === 0) {
      setMessage(t('expenseFromCashNeedSelect'))
      return
    }
    const rowByKey = new Map(visibleExpenseForCashRows.map((r) => [r.key, r]))
    const items = [...new Set(selectedExpenseForCashKeys)]
      .map((key) => {
        const parsed = parseExpenseCashLinkRowKey(key)
        const row = rowByKey.get(key)
        if (!parsed || !row || row.linked_to_this_cash) return null
        return {
          expenseSourceTable: parsed.sourceTable,
          expenseSourceId: parsed.sourceId,
          expenseAmount: row.amount,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    if (items.length === 0) {
      setMessage(t('expenseFromCashNeedSelect'))
      return
    }
    setExpenseForCashSaving(true)
    setMessage(null)
    try {
      const { linked, skippedAlreadyLinked } = await linkExpensesToCashTransaction(supabase, {
        actorEmail: user.email,
        cashTransactionId: context.sourceId,
        cashAmount: Math.abs(context.amount),
        operatorId: activeOperatorId,
        items,
      })
      if (linked === 0 && skippedAlreadyLinked > 0) {
        setMessage(t('expenseFromCashAllSelectedAlreadyLinked'))
      } else if (linked > 0) {
        onApplied?.()
        await runLoad({ preserveSelection: true })
        setSelectedExpenseForCashKeys([])
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('saveError'))
    } finally {
      setExpenseForCashSaving(false)
    }
  }

  const unlinkExpenseFromCash = async (expenseKey: string) => {
    if (!context) return
    const parsed = parseExpenseCashLinkRowKey(expenseKey)
    if (!parsed) return
    setUnlinkingExpenseForCashKey(expenseKey)
    setMessage(null)
    try {
      await unlinkExpenseCashLedgerMatchesForCash(
        supabase,
        context.sourceId,
        parsed.sourceTable,
        parsed.sourceId
      )
      await runLoad({ preserveSelection: true })
      onApplied?.()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('expenseFromCashUnlinkError'))
    } finally {
      setUnlinkingExpenseForCashKey(null)
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
    linkedRows.length > 0 ||
    linkedCashRows.length > 0 ||
    linkedExpenseForCashRows.length > 0 ||
    (isTicketBookingSource && sourceSummary != null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(nestedElevated ? { overlayClassName: 'z-[1300]' } : {})}
        className={cn(RECON_MODAL_SHELL_CLASS, nestedElevated && 'z-[1300]')}
      >
        <DialogHeader className="shrink-0 border-b bg-white px-3 py-2.5 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:pr-8">
          <DialogTitle className="text-base lg:text-lg leading-snug text-left">
            {isCashAnchorMode ? t('expenseFromCashModalTitle') : t('modalTitle')}
          </DialogTitle>
          <p className="hidden lg:block text-sm text-muted-foreground pt-1 text-left">
            {isCashAnchorMode ? t('expenseFromCashModalHint') : t('modalHint')}
          </p>
          {!isCashAnchorMode ? (
            <div className="hidden lg:block space-y-0.5 text-left">
              <p className="text-xs text-muted-foreground pt-0.5">{t('modalSplitHint')}</p>
              <p className="text-xs text-muted-foreground">{t('modalMultiLineHint')}</p>
            </div>
          ) : (
            <p className="hidden lg:block text-xs text-muted-foreground pt-0.5 text-left">{t('expenseFromCashModalSplitHint')}</p>
          )}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-2 px-3 py-2 lg:gap-3 lg:px-0 lg:py-0">
        {context ? (
          <>
            <div className="lg:hidden shrink-0 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-2.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('sourceSectionTitle')}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 leading-snug">{tableName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {context.dateYmd} · ${context.amount.toFixed(2)} · {dirLabel}
              </p>
              {(linkedRows.length > 0 || linkedCashRows.length > 0 || linkedExpenseForCashRows.length > 0) ? (
                <p className="mt-1.5 text-[10px] font-medium text-emerald-800 tabular-nums">
                  {t('currentLinksTitle')} ·{' '}
                  {t('currentLinksCount', {
                    count: linkedRows.length + linkedCashRows.length + linkedExpenseForCashRows.length,
                  })}
                </p>
              ) : null}
            </div>
            <ReconModalSection
              title={t('sourceSectionTitle')}
              tone="source"
              className="hidden lg:block shrink-0 max-h-[min(42vh,16rem)] overflow-y-auto"
            >
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('ledgerSummary', {
                table: tableName,
                date: context.dateYmd,
                amount: context.amount.toFixed(2),
                dir: dirLabel
              })}
            </p>
            {!isTicketBookingSource && sourceSummary?.primaryDetail ? (
              <p className="text-[11px] text-muted-foreground leading-snug break-words" title={sourceSummary.primaryDetail}>
                {t('sourcePrimaryDetail')}: {sourceSummary.primaryDetail}
              </p>
            ) : null}
            {!isTicketBookingSource && sourceSummary?.secondaryDetail ? (
              <p className="text-[11px] text-muted-foreground leading-snug break-words" title={sourceSummary.secondaryDetail}>
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
                {linkedCashRows.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-amber-950 pt-1">
                      {t('currentCashLinksTitle')} · {t('currentLinksCount', { count: linkedCashRows.length })}
                    </p>
                    <p className="text-[11px] text-amber-900/85 leading-snug">{t('currentCashLinksHint')}</p>
                    <ul className="space-y-1.5">
                      {linkedCashRows.map((r) => (
                        <li
                          key={r.id}
                          className="rounded border border-amber-200/90 bg-white/95 px-2.5 py-2 text-[11px] leading-snug text-gray-900"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium tabular-nums">
                              <span className="text-amber-900">{t('sourceTypes.cashTransactions')}</span>
                              <span className="text-muted-foreground">·</span>
                              <span>{r.transaction_date}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-rose-800">${r.amount.toFixed(2)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2 text-[10px] text-red-700 hover:bg-red-50 hover:text-red-800"
                              disabled={unlinkingCashId === r.id || cashSaving || saving}
                              title={t('cashUnlink')}
                              onClick={(e) => {
                                e.stopPropagation()
                                void unlinkCash(r.id)
                              }}
                            >
                              {unlinkingCashId === r.id ? t('saving') : t('cashUnlink')}
                            </Button>
                          </div>
                          <p className="mt-1 text-muted-foreground break-words">{r.description || '—'}</p>
                          {r.category ? (
                            <p className="text-[10px] text-muted-foreground/90">{r.category}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {linkedExpenseForCashRows.length > 0 ? (
                  <>
                    <p className="text-xs font-semibold text-sky-950 pt-1">
                      {t('currentExpenseFromCashLinksTitle')} ·{' '}
                      {t('currentLinksCount', { count: linkedExpenseForCashRows.length })}
                    </p>
                    <p className="text-[11px] text-sky-900/85 leading-snug">{t('currentExpenseFromCashLinksHint')}</p>
                    <ul className="space-y-1.5">
                      {linkedExpenseForCashRows.map((r) => (
                        <li
                          key={r.key}
                          className="rounded border border-sky-200/90 bg-white/95 px-2.5 py-2 text-[11px] leading-snug text-gray-900"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium tabular-nums">
                              <span className="text-sky-900">
                                {t(`sourceTypes.${sourceTableLabelKey(r.source_table)}`)}
                              </span>
                              <span className="text-muted-foreground">·</span>
                              <span>{r.submit_date}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-rose-800">${r.amount.toFixed(2)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 px-2 text-[10px] text-red-700 hover:bg-red-50 hover:text-red-800"
                              disabled={unlinkingExpenseForCashKey === r.key || expenseForCashSaving || saving}
                              title={t('expenseFromCashUnlink')}
                              onClick={(e) => {
                                e.stopPropagation()
                                void unlinkExpenseFromCash(r.key)
                              }}
                            >
                              {unlinkingExpenseForCashKey === r.key ? t('saving') : t('expenseFromCashUnlink')}
                            </Button>
                          </div>
                          <p className="mt-1 text-muted-foreground break-words">
                            {[r.paid_to, r.paid_for, r.detail].filter(Boolean).join(' · ') || '—'}
                          </p>
                          {r.external_links.some((l) => l.kind === 'statement') ? (
                            <p className="mt-1 text-[10px] text-violet-800 font-medium">
                              {t('expenseFromCashLinkedStatementCount', {
                                count: r.external_links.filter((l) => l.kind === 'statement').length,
                              })}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground leading-snug">
              {isCashAnchorMode
                ? matchMode === 'amountOnly'
                  ? t('expenseFromCashAmountOnlyModeHint')
                  : t('expenseFromCashDateProximityModeHint')
                : ticketDateProbe
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
            <p className="text-[11px] text-muted-foreground leading-snug">
              {isCashAnchorMode ? t('expenseFromCashSearchHint') : t('searchGlobalHint')}
            </p>
            {!isCashAnchorMode ? (
            <label className="flex items-start gap-2 rounded-md border border-violet-200/80 bg-violet-50/50 px-3 py-2 text-[11px] text-muted-foreground leading-snug cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 accent-violet-600"
                checked={showOffsetPairs}
                onChange={(e) => setShowOffsetPairs(e.target.checked)}
              />
              <span>
                <span className="font-medium text-violet-950">{t('showOffsetPairsCheckbox')}</span>
                <span className="block text-violet-900/85">{t('showOffsetPairsHint')}</span>
              </span>
            </label>
            ) : null}
            {!isCashAnchorMode && showOffsetPairs && offsetPairsLoading ? (
              <p className="text-[11px] text-violet-900/80">{t('offsetPairLoading')}</p>
            ) : null}
            {!isCashAnchorMode && showOffsetPairs && !offsetPairsLoading && offsetInjectedRows.length > 0 ? (
              <p className="text-[11px] text-violet-900/80 tabular-nums">
                {t('offsetPairInjectedCount', { count: offsetInjectedRows.length })}
              </p>
            ) : null}
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
            </ReconModalSection>
          </>
        ) : null}

        {isCashAnchorMode ? (
          <>
            <ReconModalSection title={t('filtersSectionTitle')} tone="neutral" className="shrink-0">
              <div className="space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-0.5">
                    {t('matchModeGroupLabel')}
                  </span>
                  <div
                    className="grid grid-cols-2 gap-1 rounded-lg border-2 border-slate-200 bg-slate-100/90 p-1 sm:inline-flex sm:flex-wrap"
                    role="group"
                    aria-label={t('matchModeGroupLabel')}
                  >
                    <FilterSegmentButton
                      active={matchMode === 'dateProximity'}
                      activeTone="slate"
                      disabled={expenseForCashLoading || !context}
                      onClick={() => setMatchMode('dateProximity')}
                    >
                      {t('matchModeDateProximity')}
                    </FilterSegmentButton>
                    <FilterSegmentButton
                      active={matchMode === 'amountOnly'}
                      activeTone="slate"
                      disabled={expenseForCashLoading || !context}
                      onClick={() => setMatchMode('amountOnly')}
                    >
                      {t('matchModeAmountOnly')}
                    </FilterSegmentButton>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row w-full lg:flex-1 lg:min-w-[10rem] lg:max-w-md gap-2">
                  <Input
                    type="search"
                    value={expenseForCashSearchInput}
                    onChange={(e) => setExpenseForCashSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applyExpenseForCashSearch()
                      }
                    }}
                    placeholder={t('expenseFromCashSearchPlaceholder')}
                    className="h-9 text-sm flex-1 min-w-0"
                    disabled={!context || expenseForCashLoading}
                  />
                  <Button
                    type="button"
                    className="h-9 w-full sm:w-auto shrink-0 px-3 text-sm"
                    disabled={!context || expenseForCashLoading}
                    onClick={applyExpenseForCashSearch}
                  >
                    {t('searchButton')}
                  </Button>
                </div>
              </div>
              <p className="hidden lg:block text-[11px] text-muted-foreground leading-snug">{t('expenseFromCashExternalLinksHint')}</p>
              {selectableExpenseForCashRows.length > 0 ? (
                <p className="text-[11px] text-muted-foreground tabular-nums lg:hidden">
                  {t('expenseFromCashSelectedCount', { n: selectedExpenseForCashKeys.length })}
                </p>
              ) : null}
              </div>
            </ReconModalSection>

            <ReconModalSection
              title={t('candidatesSectionTitle')}
              badge={
                isExpenseForCashSearchActive && !expenseForCashSearchLoading
                  ? t('searchResultsCount', { count: visibleExpenseForCashRows.length })
                  : t('similarCandidatesCount', { count: visibleExpenseForCashRows.length })
              }
              tone="sky"
              fill
              className="min-h-[min(44vh,18rem)] flex-1"
            >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {message ? <div className="shrink-0 border-b px-3 py-2 text-sm text-red-600">{message}</div> : null}
              <div className="min-h-[min(36vh,14rem)] flex-1 overflow-y-auto overscroll-y-contain mobile-scroll">
              {expenseForCashLoading || (isExpenseForCashSearchActive && expenseForCashSearchLoading) ? (
                <p className="text-xs text-muted-foreground py-6 text-center">{t('loading')}</p>
              ) : visibleExpenseForCashRows.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  {isExpenseForCashSearchActive ? t('expenseFromCashSearchEmpty') : t('expenseFromCashEmpty')}
                </p>
              ) : (
                <>
                  <div className="md:hidden divide-y">
                    <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-sky-600"
                        checked={allSelectableExpenseForCashSelected}
                        disabled={selectableExpenseForCashRows.length === 0}
                        aria-label={t('expenseFromCashSelectAll')}
                        onChange={() => {
                          if (allSelectableExpenseForCashSelected) {
                            setSelectedExpenseForCashKeys([])
                          } else {
                            setSelectedExpenseForCashKeys(selectableExpenseForCashRows.map((r) => r.key))
                          }
                        }}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-900/80">
                        {t('expenseFromCashSelectAll')}
                      </span>
                    </div>
                    {visibleExpenseForCashRows.map((r) => {
                      const selected = selectedExpenseForCashKeys.includes(r.key)
                      const hasStmtLink = expenseForCashHasStatementLink(r)
                      const hasOtherCash = expenseForCashHasOtherCashLink(r)
                      const linked = r.linked_to_this_cash
                      return (
                        <div
                          key={r.key}
                          className={`p-3 ${linked ? '' : 'cursor-pointer active:bg-sky-50/80'} ${
                            selected ? 'bg-sky-100/80' : linked ? '' : ''
                          } ${linked ? 'ring-1 ring-inset ring-emerald-400/50' : ''} ${
                            hasStmtLink ? 'ring-1 ring-inset ring-violet-400/45' : ''
                          } ${!hasStmtLink && hasOtherCash ? 'ring-1 ring-inset ring-amber-400/45' : ''}`}
                          onClick={() => {
                            if (!linked) toggleExpenseForCashKey(r.key)
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-0.5 accent-sky-600 shrink-0"
                              checked={selected}
                              disabled={linked}
                              onChange={() => toggleExpenseForCashKey(r.key)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`${r.paid_to ?? ''} ${r.paid_for ?? ''}`}
                            />
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-xs font-semibold text-sky-950">
                                  {t(`sourceTypes.${sourceTableLabelKey(r.source_table)}`)}
                                </span>
                                {r.linked_to_this_cash ? (
                                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                                    {t('currentLinkBadge')}
                                  </span>
                                ) : null}
                              </div>
                              <MobileKvRow label={t('expenseFromCashColDate')}>
                                <span className="tabular-nums">{r.submit_date}</span>
                              </MobileKvRow>
                              <MobileKvRow label={t('expenseFromCashColAmount')}>
                                <span className="tabular-nums font-medium text-rose-800">${r.amount.toFixed(2)}</span>
                              </MobileKvRow>
                              <MobileKvRow label={t('expenseFromCashColPaidTo')}>{r.paid_to || '—'}</MobileKvRow>
                              <MobileKvRow label={t('expenseFromCashColPaidFor')}>{r.paid_for || '—'}</MobileKvRow>
                              <MobileKvRow label={t('expenseFromCashColSubmitter')}>
                                <span title={r.submitter_email ?? undefined}>
                                  {formatSubmitterDisplay(r.submitter_email, teamMemberLabels)}
                                </span>
                              </MobileKvRow>
                              {r.detail ? (
                                <MobileKvRow label={t('expenseFromCashColDetail')}>{r.detail}</MobileKvRow>
                              ) : null}
                              {r.external_links.length > 0 ? (
                                <div className="space-y-1 pt-0.5">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t('expenseFromCashColLinks')}
                                  </p>
                                  {r.external_links.map((link) => {
                                    const isStmt = link.kind === 'statement'
                                    const tone = isStmt
                                      ? 'bg-violet-50/95 text-violet-950 border-violet-200/85'
                                      : link.is_current_cash
                                        ? 'bg-emerald-50/95 text-emerald-950 border-emerald-200/85'
                                        : 'bg-amber-50/95 text-amber-950 border-amber-200/85'
                                    return (
                                      <div
                                        key={`${link.kind}-${link.ref_id}`}
                                        className={`rounded border px-2 py-1 text-[10px] leading-snug ${tone}`}
                                      >
                                        <span className="font-semibold">
                                          {isStmt
                                            ? t('expenseFromCashLinkStatement')
                                            : t('expenseFromCashLinkCash')}
                                          {link.is_current_cash ? ` (${t('currentLinkBadge')})` : ''}
                                        </span>
                                        <span className="tabular-nums">
                                          {' '}
                                          · {link.date} · ${link.amount.toFixed(2)}
                                        </span>
                                        {link.account_name ? (
                                          <p className="break-words text-violet-900/85">{link.account_name}</p>
                                        ) : null}
                                        <p className="break-words opacity-90">{link.label}</p>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-white z-[1]">
                    <tr className="border-b text-left text-[10px] uppercase tracking-wide text-sky-900/80">
                      <th className="p-2 w-8">
                        <input
                          type="checkbox"
                          className="accent-sky-600"
                          checked={allSelectableExpenseForCashSelected}
                          disabled={selectableExpenseForCashRows.length === 0}
                          aria-label={t('expenseFromCashSelectAll')}
                          onChange={() => {
                            if (allSelectableExpenseForCashSelected) {
                              setSelectedExpenseForCashKeys([])
                            } else {
                              setSelectedExpenseForCashKeys(selectableExpenseForCashRows.map((r) => r.key))
                            }
                          }}
                        />
                      </th>
                      <th className="p-2">{t('expenseFromCashColType')}</th>
                      <th className="p-2">{t('expenseFromCashColDate')}</th>
                      <th className="p-2 text-right">{t('expenseFromCashColAmount')}</th>
                      <th className="p-2">{t('expenseFromCashColPaidTo')}</th>
                      <th className="p-2">{t('expenseFromCashColPaidFor')}</th>
                      <th className="p-2">{t('expenseFromCashColSubmitter')}</th>
                      <th className="p-2">{t('expenseFromCashColDetail')}</th>
                      <th className="p-2 min-w-[14rem]">{t('expenseFromCashColLinks')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleExpenseForCashRows.map((r) => {
                      const selected = selectedExpenseForCashKeys.includes(r.key)
                      const hasStmtLink = expenseForCashHasStatementLink(r)
                      const hasOtherCash = expenseForCashHasOtherCashLink(r)
                      const linked = r.linked_to_this_cash
                      return (
                        <tr
                          key={r.key}
                          className={`border-b ${linked ? '' : 'cursor-pointer'} ${
                            selected ? 'bg-sky-100/80' : linked ? '' : 'hover:bg-sky-50/80'
                          } ${linked ? 'ring-1 ring-inset ring-emerald-400/50' : ''} ${
                            hasStmtLink ? 'ring-1 ring-inset ring-violet-400/45' : ''
                          } ${!hasStmtLink && hasOtherCash ? 'ring-1 ring-inset ring-amber-400/45' : ''}`}
                          onClick={() => {
                            if (!linked) toggleExpenseForCashKey(r.key)
                          }}
                        >
                          <td className="p-2 align-middle">
                            <input
                              type="checkbox"
                              className="accent-sky-600"
                              checked={selected}
                              disabled={linked}
                              onChange={() => toggleExpenseForCashKey(r.key)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`${r.paid_to ?? ''} ${r.paid_for ?? ''}`}
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {t(`sourceTypes.${sourceTableLabelKey(r.source_table)}`)}
                            {r.linked_to_this_cash ? (
                              <span className="ml-1 text-[10px] text-emerald-800 font-medium">
                                ({t('currentLinkBadge')})
                              </span>
                            ) : null}
                          </td>
                          <td className="p-2 tabular-nums whitespace-nowrap">{r.submit_date}</td>
                          <td className="p-2 text-right tabular-nums font-medium text-rose-800">
                            ${r.amount.toFixed(2)}
                          </td>
                          <td className="p-2 max-w-[10rem] truncate" title={r.paid_to ?? undefined}>
                            {r.paid_to || '—'}
                          </td>
                          <td className="p-2 max-w-[10rem] truncate" title={r.paid_for ?? undefined}>
                            {r.paid_for || '—'}
                          </td>
                          <td
                            className="p-2 max-w-[8rem] truncate"
                            title={r.submitter_email ?? undefined}
                          >
                            {formatSubmitterDisplay(r.submitter_email, teamMemberLabels)}
                          </td>
                          <td className="p-2 max-w-[14rem] truncate" title={r.detail ?? undefined}>
                            {r.detail || '—'}
                          </td>
                          <td className="p-2 align-top min-w-[14rem] max-w-[20rem]">
                            {r.external_links.length === 0 ? (
                              <span className="text-muted-foreground">{t('noLinks')}</span>
                            ) : (
                              <div className="space-y-1">
                                {r.external_links.map((link) => {
                                  const isStmt = link.kind === 'statement'
                                  const tone = isStmt
                                    ? 'bg-violet-50/95 text-violet-950 border-violet-200/85'
                                    : link.is_current_cash
                                      ? 'bg-emerald-50/95 text-emerald-950 border-emerald-200/85'
                                      : 'bg-amber-50/95 text-amber-950 border-amber-200/85'
                                  return (
                                    <div
                                      key={`${link.kind}-${link.ref_id}`}
                                      className={`rounded border px-1.5 py-1 text-[10px] leading-snug ${tone}`}
                                      title={link.label}
                                    >
                                      <span className="font-semibold">
                                        {isStmt
                                          ? t('expenseFromCashLinkStatement')
                                          : t('expenseFromCashLinkCash')}
                                        {link.is_current_cash ? ` (${t('currentLinkBadge')})` : ''}
                                      </span>
                                      <span className="tabular-nums">
                                        {' '}
                                        · {link.date} · ${link.amount.toFixed(2)}
                                      </span>
                                      {link.account_name ? (
                                        <p className="truncate text-violet-900/85">{link.account_name}</p>
                                      ) : null}
                                      <p className="truncate opacity-90">{link.label}</p>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                  </div>
                </>
              )}
              </div>
            </div>
            </ReconModalSection>
            <div className="shrink-0 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto border-sky-300 bg-sky-100/80 hover:bg-sky-200/80 text-sky-950"
                disabled={
                  selectedExpenseForCashKeys.length === 0 ||
                  expenseForCashSaving ||
                  saving ||
                  expenseForCashLoading ||
                  expenseForCashSearchLoading
                }
                onClick={() => void applyExpenseLinkFromCash()}
              >
                {expenseForCashSaving
                  ? t('saving')
                  : selectedExpenseForCashKeys.length > 1
                    ? t('expenseFromCashConnectMultiple', { n: selectedExpenseForCashKeys.length })
                    : t('expenseFromCashConnect')}
              </Button>
            </div>
          </>
        ) : (
        <>
        <ReconModalSection title={t('filtersSectionTitle')} tone="neutral" className="shrink-0">
          <div className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              {!ticketDateProbe ? (
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-0.5">
                    {t('matchModeGroupLabel')}
                  </span>
                  <div
                    className="grid grid-cols-2 gap-1 rounded-lg border-2 border-slate-200 bg-slate-100/90 p-1 sm:inline-flex sm:flex-wrap"
                    role="group"
                    aria-label={t('matchModeGroupLabel')}
                  >
                    <FilterSegmentButton
                      active={matchMode === 'dateProximity'}
                      activeTone="slate"
                      disabled={loading || !context}
                      onClick={() => setMatchMode('dateProximity')}
                    >
                      {t('matchModeDateProximity')}
                    </FilterSegmentButton>
                    <FilterSegmentButton
                      active={matchMode === 'amountOnly'}
                      activeTone="slate"
                      disabled={loading || !context}
                      onClick={() => setMatchMode('amountOnly')}
                    >
                      {t('matchModeAmountOnly')}
                    </FilterSegmentButton>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 px-0.5">
                  {t('statementStatusGroupLabel')}
                </span>
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg border-2 border-emerald-200 bg-emerald-50 p-1 sm:inline-flex sm:flex-wrap"
                  role="group"
                  aria-label={t('statementStatusGroupLabel')}
                >
                  <FilterSegmentButton
                    active={statementStatusFilter === 'unmatched'}
                    activeTone="emerald"
                    disabled={loading || !context}
                    onClick={() => {
                      setStatementStatusFilter('unmatched')
                      setActiveAccountTab(ACCOUNT_TAB_ALL)
                    }}
                  >
                    {t('statementStatusFilterUnmatched')}
                  </FilterSegmentButton>
                  <FilterSegmentButton
                    active={statementStatusFilter === 'all'}
                    activeTone="emerald"
                    disabled={loading || !context}
                    onClick={() => {
                      setStatementStatusFilter('all')
                      setActiveAccountTab(ACCOUNT_TAB_ALL)
                    }}
                  >
                    {t('statementStatusFilterAll')}
                  </FilterSegmentButton>
                </div>
                {statementStatusFilter === 'unmatched' ? (
                  <p className="hidden lg:block text-[11px] text-emerald-900/70 px-0.5 leading-snug">{t('statementStatusUnmatchedHint')}</p>
                ) : null}
              </div>
            </div>
            <div className="w-full lg:flex-1 lg:min-w-[10rem] lg:max-w-md flex flex-col sm:flex-row gap-2">
              <Input
                type="search"
                value={rowSearchInput}
                onChange={(e) => setRowSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyRowSearch()
                  }
                }}
                placeholder={t('searchRowsPlaceholder')}
                className="h-9 text-sm flex-1 min-w-0"
                disabled={!context}
              />
              <Button
                type="button"
                className="h-9 w-full sm:w-auto shrink-0 px-3 text-sm"
                disabled={!context || loading}
                onClick={applyRowSearch}
              >
                {t('searchButton')}
              </Button>
            </div>
          </div>
          {!isCashAnchorMode ? (
            <label className="flex lg:hidden items-center gap-2 rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                className="shrink-0 accent-violet-600"
                checked={showOffsetPairs}
                onChange={(e) => setShowOffsetPairs(e.target.checked)}
              />
              <span className="font-medium text-violet-950">{t('showOffsetPairsCheckbox')}</span>
            </label>
          ) : null}
          </div>
        </ReconModalSection>

        {(message || selectedIdsOrdered.length > 0 || canSyncAmount || hasLineConflict) ? (
        <div className="shrink-0 space-y-2 max-h-[min(22vh,9rem)] lg:max-h-[min(24vh,10rem)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
        {message ? <div className="text-sm text-red-600">{message}</div> : null}

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
                  pmLabel,
                  { formatSubmitter }
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
            <p className="text-[11px] leading-snug text-red-900/90 hidden lg:block">{t('lineConflictHint')}</p>
          </div>
        ) : null}
        </div>
        ) : null}

        <ReconModalSection
          title={t('candidatesSectionTitle')}
          badge={
            isSearchActive && !searchLoading
              ? t('searchResultsCount', { count: visibleRows.length })
              : t('similarCandidatesCount', { count: visibleRows.length })
          }
          tone="candidates"
          fill
          className="min-h-[min(44vh,18rem)] flex-1"
        >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showAccountTabs ? (
            <div
              className="shrink-0 flex gap-1 overflow-x-auto overscroll-x-contain border-b border-emerald-200/80 bg-emerald-50/30 px-2 py-1.5"
              role="tablist"
              aria-label={t('accountTabsLabel')}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeAccountTab === ACCOUNT_TAB_ALL}
                onClick={() => setActiveAccountTab(ACCOUNT_TAB_ALL)}
                className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeAccountTab === ACCOUNT_TAB_ALL
                    ? 'border-emerald-300 bg-white text-emerald-800 shadow-sm'
                    : 'border-transparent bg-transparent text-emerald-900/70 hover:bg-white/70'
                }`}
              >
                {t('accountTabAll', { count: statusFilteredSourceRows.length })}
              </button>
              {accountTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeAccountTab === tab.id}
                  onClick={() => setActiveAccountTab(tab.id)}
                  className={`shrink-0 max-w-[10rem] truncate rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeAccountTab === tab.id
                      ? 'border-emerald-300 bg-white text-emerald-800 shadow-sm'
                      : 'border-transparent bg-transparent text-emerald-900/70 hover:bg-white/70'
                  }`}
                  title={tab.name}
                >
                  {t('accountTabNamed', { name: tab.name, count: tab.count })}
                </button>
              ))}
            </div>
          ) : null}
          {selectedIdsOrdered.length > 0 ? (
            <div className="shrink-0 border-b border-emerald-200/60 bg-emerald-50/40 px-3 py-1.5 text-[11px] text-emerald-900 tabular-nums font-medium">
              {t('selectedLinesCount', { n: selectedIdsOrdered.length })}
            </div>
          ) : null}
          <div className="min-h-[min(36vh,14rem)] flex-1 overflow-y-auto overscroll-y-contain mobile-scroll">
          {loading || (isSearchActive && searchLoading) ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('loading')}</div>
          ) : !isSearchActive && rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : statusFilteredSourceRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('statusFilterEmptyUnmatched')}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{isSearchActive ? t('noSearchResults') : t('accountTabEmpty')}</div>
          ) : (
            <>
              <div className="md:hidden divide-y">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 sticky top-0 z-[1]">
                  <input
                    ref={headerSelectAllMobileRef}
                    type="checkbox"
                    className="accent-emerald-600"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label={t('selectAllVisible')}
                  />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('selectAllVisible')}
                  </span>
                </div>
                {visibleRows.map((r) => {
                  const isCurrentLink = linkedLineIdSet.has(r.id)
                  const isOffsetInjected = offsetInjectedLineIdSet.has(r.id)
                  const offsetPairs = offsetPairsByLineId.get(r.id) ?? []
                  const sourceAlloc = r.source_linked_amount ?? sourceAllocByLineId.get(r.id)
                  const rowKey = r.reconciliation_match_id || `${r.id}-${sourceAlloc}`
                  return (
                    <div
                      key={rowKey}
                      className={`p-3 cursor-pointer active:bg-muted/50 ${
                        selectedIdsOrdered.includes(r.id)
                          ? 'bg-emerald-50'
                          : isCurrentLink
                            ? 'bg-emerald-50/60'
                            : ''
                      }`}
                      onClick={() => toggleLineId(r.id)}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-emerald-600 shrink-0"
                          checked={selectedIdsOrdered.includes(r.id)}
                          onChange={() => toggleLineId(r.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            {isCurrentLink ? (
                              <>
                                <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                                  {t('currentLinkBadge')}
                                </span>
                                <button
                                  type="button"
                                  className="text-[10px] font-medium text-red-700 underline decoration-red-300 hover:text-red-900 disabled:opacity-50"
                                  disabled={unlinkingLineId === unlinkRowKey(r) || saving}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void unlinkCurrentLink(r)
                                  }}
                                >
                                  {unlinkingLineId === unlinkRowKey(r) ? t('saving') : t('unlinkStatementMatch')}
                                </button>
                              </>
                            ) : null}
                            {isOffsetInjected ? (
                              <span className="inline-flex rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">
                                {t('offsetPairBadge')}
                              </span>
                            ) : null}
                          </div>
                          <MobileKvRow label={t('colAccount')}>{r.financial_account_name}</MobileKvRow>
                          <MobileKvRow label={t('colDate')}>
                            <span className="tabular-nums">{r.posted_date}</span>
                          </MobileKvRow>
                          {ticketDateProbe ? (
                            <MobileKvRow label={t('colDirection')}>
                              <span
                                className={
                                  String(r.direction).toLowerCase() === 'inflow'
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-rose-800 font-medium'
                                }
                              >
                                {String(r.direction).toLowerCase() === 'inflow' ? t('dirIn') : t('dirOut')}
                              </span>
                            </MobileKvRow>
                          ) : null}
                          <MobileKvRow label={t('colAmount')}>
                            <span
                              className={`tabular-nums font-medium ${
                                String(r.direction).toLowerCase() === 'inflow' ? 'text-emerald-700' : ''
                              }`}
                            >
                              {statementLineSignedAmountLabel(r)}
                            </span>
                          </MobileKvRow>
                          <MobileKvRow label={t('colAllocatedSum')}>
                            {r.existing_matches.length > 0 ? (
                              <span className="tabular-nums text-muted-foreground">
                                ${r.allocated_sum.toFixed(2)} / ${Math.abs(r.amount).toFixed(2)}
                                {isCurrentLink && sourceAlloc != null ? (
                                  <span className="block text-[10px] text-emerald-800 font-medium">
                                    {t('currentLinkAllocated')}: ${sourceAlloc.toFixed(2)}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              t('noLinks')
                            )}
                          </MobileKvRow>
                          {r.description ? (
                            <MobileKvRow label={t('colDesc')}>{r.description}</MobileKvRow>
                          ) : null}
                          <MobileKvRow label={t('colStatus')}>
                            {r.matched_status === 'unmatched'
                              ? t('statusUnmatched')
                              : r.matched_status === 'partial'
                                ? t('statusPartial')
                                : t('statusMatched')}
                          </MobileKvRow>
                          {showOffsetPairs ? (
                            <div className="space-y-1 pt-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('colOffsetPair')}
                              </p>
                              {offsetPairsLoading ? (
                                <span className="text-xs text-muted-foreground">{t('offsetPairLoading')}</span>
                              ) : offsetPairs.length === 0 ? (
                                <span className="text-xs text-muted-foreground">{t('offsetPairNone')}</span>
                              ) : (
                                offsetPairs.map((pair) => {
                                  const isInflow =
                                    String(pair.counterpartDirection).toLowerCase() === 'inflow'
                                  return (
                                    <div
                                      key={pair.pairId}
                                      className="rounded border border-violet-200/90 bg-violet-50/90 px-2 py-1 text-[10px] leading-snug text-violet-950"
                                    >
                                      <span className="inline-flex items-center gap-0.5 font-medium">
                                        <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden />
                                        {isInflow ? t('dirIn') : t('dirOut')}
                                      </span>
                                      <span className="tabular-nums ml-1">
                                        {pair.counterpartPostedDate} · ${pair.counterpartAmount.toFixed(2)}
                                      </span>
                                      <p className="mt-0.5 break-words text-violet-900/85">
                                        {pair.counterpartFinancialAccountName}
                                      </p>
                                      <p className="break-words text-violet-900/75">{pair.counterpartDescription}</p>
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          ) : null}
                          {r.existing_matches.length > 0 ? (
                            <div className="space-y-1 pt-0.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t('colLinked')}
                              </p>
                              {linkedMatchDetailsLoading &&
                              r.existing_matches.some(
                                (m) => !linkedMatchDetailsByKey.has(`${m.source_table}:${m.source_id}`)
                              ) ? (
                                <p className="text-[10px] text-muted-foreground">{t('colLinkedDetailLoading')}</p>
                              ) : (
                                r.existing_matches.map((m, i) => (
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
                                    formatSubmitter={formatSubmitter}
                                  />
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="hidden md:block overflow-x-auto">
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
                  {showOffsetPairs ? (
                    <th className="text-left p-2 font-medium min-w-[12rem] whitespace-nowrap">
                      {t('colOffsetPair')}
                    </th>
                  ) : null}
                  <th className="text-left p-2 font-medium min-w-[20rem] w-[28rem]">{t('colLinked')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const isCurrentLink = linkedLineIdSet.has(r.id)
                  const isOffsetInjected = offsetInjectedLineIdSet.has(r.id)
                  const offsetPairs = offsetPairsByLineId.get(r.id) ?? []
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
                        {isOffsetInjected ? (
                          <span className="inline-flex w-fit rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">
                            {t('offsetPairBadge')}
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
                    {showOffsetPairs ? (
                      <td className="p-2 text-xs align-top min-w-[12rem]">
                        {offsetPairsLoading ? (
                          <span className="text-muted-foreground">{t('offsetPairLoading')}</span>
                        ) : offsetPairs.length === 0 ? (
                          <span className="text-muted-foreground">{t('offsetPairNone')}</span>
                        ) : (
                          <div className="space-y-1">
                            {offsetPairs.map((pair) => {
                              const isInflow =
                                String(pair.counterpartDirection).toLowerCase() === 'inflow'
                              return (
                                <div
                                  key={pair.pairId}
                                  className="rounded border border-violet-200/90 bg-violet-50/90 px-2 py-1 text-[10px] leading-snug text-violet-950"
                                  title={pair.counterpartDescription}
                                >
                                  <span className="inline-flex items-center gap-0.5 font-medium">
                                    <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden />
                                    {isInflow ? t('dirIn') : t('dirOut')}
                                  </span>
                                  <span className="tabular-nums ml-1">
                                    {pair.counterpartPostedDate} · $
                                    {pair.counterpartAmount.toFixed(2)}
                                  </span>
                                  <p className="mt-0.5 text-violet-900/85 truncate">
                                    {pair.counterpartFinancialAccountName}
                                  </p>
                                  <p className="text-violet-900/75 truncate">{pair.counterpartDescription}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    ) : null}
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
                              formatSubmitter={formatSubmitter}
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
              </div>
            </>
          )}
          </div>
        </div>
        </ReconModalSection>
        </>
        )}

        {showCashLedgerSection && !isCashAnchorMode ? (
          <ReconModalSection title={t('cashSectionTitle')} tone="cash" className="shrink-0 max-lg:max-h-[34vh] max-lg:overflow-y-auto">
            <div className="space-y-2">
              <p className="hidden lg:block text-[11px] text-amber-900/85 leading-snug">{t('cashSectionHint')}</p>
              <p className="hidden lg:block text-[11px] text-amber-900/85 leading-snug">{t('cashSectionMultiExpenseHint')}</p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full sm:w-auto border-amber-300 bg-white hover:bg-amber-50 text-amber-950"
                disabled={!context || cashLoading}
                onClick={() => setCashPickerOpen(true)}
              >
                {t('cashSectionBrowseButton')}
              </Button>
              {!cashLoading && cashRows.length > 0 ? (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t('cashSectionSimilarCount', { count: cashRows.length })}
                </span>
              ) : null}
            </div>
            {selectedCashRow ? (
              <div className="rounded-md border border-amber-300/90 bg-white/95 px-3 py-2 text-[11px] leading-snug">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80 mb-1">
                  {t('cashSectionSelectedTitle')}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium tabular-nums text-gray-900">
                  <span>{selectedCashRow.transaction_date}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-rose-800">${selectedCashRow.amount.toFixed(2)}</span>
                  {selectedCashRow.linked_to_this_expense ? (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-emerald-800">{t('currentLinkBadge')}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-1 text-muted-foreground break-words">{selectedCashRow.description || '—'}</p>
                {selectedCashRow.category ? (
                  <p className="text-[10px] text-muted-foreground/90">{selectedCashRow.category}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-1">{t('cashSectionNoSelection')}</p>
            )}
            {!selectedCashId && !cashLoading && visibleCashRows.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-900/85">{t('cashSectionQuickPicksTitle')}</p>
                <ul className="space-y-1 max-h-[8rem] overflow-y-auto">
                  {visibleCashRows.slice(0, 8).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="w-full text-left rounded border border-amber-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] hover:bg-amber-50/90 transition-colors"
                        onClick={() => handleCashPicked(r)}
                      >
                        <span className="font-medium tabular-nums">
                          {r.transaction_date} · ${r.amount.toFixed(2)}
                        </span>
                        <span className="block truncate text-muted-foreground">{r.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {cashLoading ? <p className="text-xs text-muted-foreground py-2">{t('loading')}</p> : null}
            {selectedCashId && !isCashAnchorMode ? (
              <div className="space-y-2 border-t border-amber-200/80 pt-2">
                <div>
                  <h4 className="text-xs font-semibold text-amber-950">{t('cashSectionExpensesToLinkTitle')}</h4>
                  {linkedCashSectionExpenseRows.length > 0 ? (
                    <p className="text-[10px] text-emerald-900/85 tabular-nums">
                      {t('cashSectionAlreadyLinkedCount', { count: linkedCashSectionExpenseRows.length })}
                    </p>
                  ) : null}
                  {selectableCashSectionExpenseRows.length > 0 ? (
                    <p className="text-[10px] text-amber-900/75 tabular-nums">
                      {t('expenseFromCashSelectedCount', { n: selectedCashLinkExpenseKeys.length })}
                    </p>
                  ) : null}
                </div>
                {cashSectionExpenseLoading ? (
                  <p className="text-xs text-muted-foreground py-2">{t('loading')}</p>
                ) : visibleCashSectionExpenseRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">{t('expenseFromCashEmpty')}</p>
                ) : (
                  <>
                    <div className="md:hidden divide-y border border-amber-200/80 rounded-md overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-amber-200/80 bg-amber-50/60 px-3 py-2">
                        <input
                          type="checkbox"
                          className="accent-amber-600"
                          checked={allSelectableCashSectionExpensesSelected}
                          disabled={selectableCashSectionExpenseRows.length === 0}
                          aria-label={t('expenseFromCashSelectAll')}
                          onChange={() => {
                            if (allSelectableCashSectionExpensesSelected) {
                              setSelectedCashLinkExpenseKeys([])
                            } else {
                              setSelectedCashLinkExpenseKeys(
                                selectableCashSectionExpenseRows.map((r) => r.key)
                              )
                            }
                          }}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
                          {t('expenseFromCashSelectAll')}
                        </span>
                      </div>
                      {visibleCashSectionExpenseRows.map((r) => {
                        const selected = selectedCashLinkExpenseKeys.includes(r.key)
                        const linked = r.linked_to_this_cash
                        const isContextRow = r.key === contextExpenseKey
                        return (
                          <div
                            key={r.key}
                            className={`p-3 ${linked ? '' : 'cursor-pointer active:bg-amber-50/80'} ${
                              selected ? 'bg-amber-100/80' : linked ? '' : ''
                            } ${linked ? 'ring-1 ring-inset ring-emerald-400/50' : ''}`}
                            onClick={() => {
                              if (!linked) toggleCashLinkExpenseKey(r.key)
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-0.5 accent-amber-600 shrink-0"
                                checked={selected}
                                disabled={linked}
                                onChange={() => toggleCashLinkExpenseKey(r.key)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`${r.paid_to ?? ''} ${r.paid_for ?? ''}`}
                              />
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-xs font-semibold text-amber-950">
                                    {t(`sourceTypes.${sourceTableLabelKey(r.source_table)}`)}
                                  </span>
                                  {linked ? (
                                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">
                                      {t('currentLinkBadge')}
                                    </span>
                                  ) : isContextRow ? (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                                      {t('cashSectionCurrentExpenseBadge')}
                                    </span>
                                  ) : null}
                                </div>
                                <MobileKvRow label={t('expenseFromCashColDate')}>
                                  <span className="tabular-nums">{r.submit_date}</span>
                                </MobileKvRow>
                                <MobileKvRow label={t('expenseFromCashColAmount')}>
                                  <span className="tabular-nums font-medium text-rose-800">${r.amount.toFixed(2)}</span>
                                </MobileKvRow>
                                <MobileKvRow label={t('expenseFromCashColPaidTo')}>{r.paid_to || '—'}</MobileKvRow>
                                <MobileKvRow label={t('expenseFromCashColPaidFor')}>{r.paid_for || '—'}</MobileKvRow>
                                <MobileKvRow label={t('expenseFromCashColSubmitter')}>
                                  <span title={r.submitter_email ?? undefined}>
                                    {formatSubmitterDisplay(r.submitter_email, teamMemberLabels)}
                                  </span>
                                </MobileKvRow>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-amber-200/80 text-left text-[10px] uppercase tracking-wide text-amber-900/80">
                        <th className="p-2 w-8">
                          <input
                            type="checkbox"
                            className="accent-amber-600"
                            checked={allSelectableCashSectionExpensesSelected}
                            disabled={selectableCashSectionExpenseRows.length === 0}
                            aria-label={t('expenseFromCashSelectAll')}
                            onChange={() => {
                              if (allSelectableCashSectionExpensesSelected) {
                                setSelectedCashLinkExpenseKeys([])
                              } else {
                                setSelectedCashLinkExpenseKeys(
                                  selectableCashSectionExpenseRows.map((r) => r.key)
                                )
                              }
                            }}
                          />
                        </th>
                        <th className="p-2">{t('expenseFromCashColType')}</th>
                        <th className="p-2">{t('expenseFromCashColDate')}</th>
                        <th className="p-2 text-right">{t('expenseFromCashColAmount')}</th>
                        <th className="p-2">{t('expenseFromCashColPaidTo')}</th>
                        <th className="p-2">{t('expenseFromCashColPaidFor')}</th>
                        <th className="p-2">{t('expenseFromCashColSubmitter')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCashSectionExpenseRows.map((r) => {
                        const selected = selectedCashLinkExpenseKeys.includes(r.key)
                        const linked = r.linked_to_this_cash
                        const isContextRow = r.key === contextExpenseKey
                        return (
                          <tr
                            key={r.key}
                            className={`border-b border-amber-100/90 ${linked ? '' : 'cursor-pointer'} ${
                              selected ? 'bg-amber-100/80' : linked ? '' : 'hover:bg-amber-50/80'
                            } ${linked ? 'ring-1 ring-inset ring-emerald-400/50' : ''}`}
                            onClick={() => {
                              if (!linked) toggleCashLinkExpenseKey(r.key)
                            }}
                          >
                            <td className="p-2 align-middle">
                              <input
                                type="checkbox"
                                className="accent-amber-600"
                                checked={selected}
                                disabled={linked}
                                onChange={() => toggleCashLinkExpenseKey(r.key)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`${r.paid_to ?? ''} ${r.paid_for ?? ''}`}
                              />
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {t(`sourceTypes.${sourceTableLabelKey(r.source_table)}`)}
                              {linked ? (
                                <span className="ml-1 text-[10px] text-emerald-800 font-medium">
                                  ({t('currentLinkBadge')})
                                </span>
                              ) : isContextRow ? (
                                <span className="ml-1 text-[10px] text-amber-900 font-medium">
                                  ({t('cashSectionCurrentExpenseBadge')})
                                </span>
                              ) : null}
                            </td>
                            <td className="p-2 tabular-nums whitespace-nowrap">{r.submit_date}</td>
                            <td className="p-2 text-right tabular-nums font-medium text-rose-800">
                              ${r.amount.toFixed(2)}
                            </td>
                            <td className="p-2 max-w-[10rem] truncate" title={r.paid_to ?? undefined}>
                              {r.paid_to || '—'}
                            </td>
                            <td className="p-2 max-w-[10rem] truncate" title={r.paid_for ?? undefined}>
                              {r.paid_for || '—'}
                            </td>
                            <td
                              className="p-2 max-w-[8rem] truncate"
                              title={r.submitter_email ?? undefined}
                            >
                              {formatSubmitterDisplay(r.submitter_email, teamMemberLabels)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <div className="flex justify-end pb-1">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto border-amber-300 bg-amber-100/80 hover:bg-amber-200/80 text-amber-950"
                disabled={
                  !selectedCashId ||
                  cashSaving ||
                  saving ||
                  cashLoading ||
                  cashSearchLoading ||
                  cashSectionExpenseLoading
                }
                onClick={() => void applyCashLink()}
              >
                {cashSaving
                  ? t('saving')
                  : selectedCashLinkExpenseKeys.length > 1
                    ? t('cashConnectMultiple', { n: selectedCashLinkExpenseKeys.length })
                    : t('cashConnect')}
              </Button>
            </div>
            </div>
          </ReconModalSection>
        ) : null}

        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 lg:gap-3 lg:flex-row lg:items-center lg:justify-between border-t bg-white px-3 py-2.5 lg:px-0 lg:py-0 lg:pt-2 lg:mt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:pb-0">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 sm:mr-auto">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
            {!isCashAnchorMode ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:max-w-none">
              <label className="flex min-w-0 flex-1 items-start gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground leading-snug cursor-pointer sm:max-w-[28rem]">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0 accent-emerald-600"
                  checked={appendLink}
                  onChange={(e) => setAppendLink(e.target.checked)}
                />
                <span>{t('appendLinkCheckbox')}</span>
              </label>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto shrink-0 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950"
                disabled={appendConnectDisabled}
                onClick={() => void apply(undefined, 'append')}
              >
                {saving ? t('saving') : appendConnectLabel}
              </Button>
            </div>
            ) : null}
          </div>
          {!isCashAnchorMode ? (
          <div className="flex w-full flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2">
          {hasLineConflict ? (
            <>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={selectedIdsOrdered.length === 0 || saving}
                onClick={() => void apply('unlinkOthers')}
              >
                {saving ? t('saving') : t('connectUnlinkOthers')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={selectedIdsOrdered.length === 0 || saving}
                onClick={() => void apply('unlinkAndDeleteOthers')}
              >
                {saving ? t('saving') : t('connectDeleteOthers')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={selectedIdsOrdered.length === 0 || saving}
              onClick={() => void apply(undefined, 'replace')}
            >
              {saving
                ? t('saving')
                : allowTicketMultiLink && selectedLineCount > 1
                  ? t('connectTicketMultiN', { n: selectedLineCount })
                  : t('connect')}
            </Button>
          )}
          </div>
          ) : null}
        </DialogFooter>

        {showCashLedgerSection && !isCashAnchorMode && context ? (
          <CashTransactionPickerModal
            open={cashPickerOpen}
            onOpenChange={setCashPickerOpen}
            selectedId={selectedCashId}
            onConfirm={handleCashPicked}
            ledgerDateYmd={context.dateYmd}
            ledgerAmount={context.amount}
            linkedCashIds={linkedCashRowIds}
            nestedElevated={nestedElevated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
