'use client'

import React, {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Building2,
  CalendarDays,
  Link2,
  Lock,
  MapPinned,
  Pencil,
  Receipt,
  RefreshCw,
  Search,
  Shield,
  Ticket,
  Upload,
  Wand2,
  Plus,
  AlertCircle,
  BookOpen,
  GripVertical,
  X
} from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'

/** getSession()은 세션 갱신·Strict Mode 등으로 Abort 되어 "signal is aborted"가 날 수 있음 — 저장된 JWT 우선 */
function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  const t = localStorage.getItem('sb-access-token')
  return t?.trim() ? t.trim() : null
}
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import StatementAdjustmentExpenseModal from '@/components/reconciliation/StatementAdjustmentExpenseModal'
import { hashStatementCsvContent, makeDedupeKey, parseStatementCsvText } from '@/lib/statement-csv'
import { formatStatementLineDescription } from '@/lib/statement-display'
import {
  findBestExpenseForLine,
  type ExpenseCandidate
} from '@/lib/reconciliation-engine'

type FinancialAccount = {
  id: string
  name: string
  account_type: string
  currency: string
  is_active: boolean
}

type StatementImport = {
  id: string
  financial_account_id: string
  period_label: string | null
  period_start: string
  period_end: string
  status: string
  original_filename: string | null
  created_at: string
}

type StatementLine = {
  id: string
  statement_import_id: string
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  merchant: string | null
  matched_status: string
  exclude_from_pnl: boolean
  is_personal: boolean
  personal_partner: string | null
}

const PERSONAL_PARTNER_OPTIONS: { value: string; label: string }[] = [
  { value: 'partner1', label: 'Joey' },
  { value: 'partner2', label: 'Chad' },
  { value: 'erica', label: 'Erica' }
]

type PaymentMethodRow = {
  id: string
  method: string
  display_name?: string | null
  card_number_last4: string | null
  financial_account_id: string | null
  user_email?: string | null
  notes?: string | null
  team?: { email?: string; name_ko?: string | null; name_en?: string | null } | null
}

type ReconciliationMatchRow = {
  id: string
  statement_line_id: string
  source_table: string
  source_id: string
  matched_by: string | null
  matched_at?: string
}

type ExpenseOption = {
  source_table: 'company_expenses' | 'tour_expenses' | 'reservation_expenses' | 'ticket_bookings'
  source_id: string
  label: string
  amount: number
  submit_on: string
  /** payment_methods.id — 없으면 null */
  payment_method: string | null
}

type PaymentRecordOption = {
  id: string
  amount: number
  submit_on: string
  reservation_id: string
  note: string | null
}

/** 입금 후보: 예약 → 고객명 (없으면 짧은 예약 ID) */
function paymentRecordPickerPartyLabel(
  pr: PaymentRecordOption,
  reservationIdToCustomerName: Record<string, string>
): string {
  const rid = pr.reservation_id?.trim() ?? ''
  if (!rid) return '—'
  const nm = reservationIdToCustomerName[rid]?.trim()
  if (nm) return nm
  return rid.length > 8 ? `예약 ${rid.slice(0, 8)}…` : `예약 ${rid}`
}

const EXPENSE_TABLES = [
  'company_expenses',
  'tour_expenses',
  'reservation_expenses',
  'ticket_bookings'
] as const

/** 한 페이지당 표시 행 수 — 행마다 무거운 UI가 있으면 DOM·레이아웃 비용이 커짐 */
const RECONCILIATION_PAGE_SIZE = 40
/** PostgREST 기본 max-rows(1000) — 단일 select로는 그 이후 행이 잘림 → range 순회 */
const STATEMENT_LINES_FETCH_PAGE = 1000
/** 지출/입금 후보 모달: 금액 근접 후보 상한 (전체 옵션을 행×만큼 DOM에 두지 않음) */
const PICKER_QUICK_MAX = 120
const PICKER_SEARCH_MAX = 500
const PICKER_SEARCH_MIN_CHARS = 2
/** 금액 일치 후보가 없을 때: 명세 거래일 기준 ±일 안에서 유사 금액 지출을 채움 */
const PICKER_QUICK_DATE_WINDOW_DAYS = 21
/** 지출 연결 모달 — 테이블 탐색 시 페이지당 행 수 (다음 페이지 여부 판별용 +1건 조회) */
const PICKER_BROWSE_PAGE_SIZE = 40

type ExpensePickerBrowseTable =
  | 'company_expenses'
  | 'tour_expenses'
  | 'reservation_expenses'
  | 'ticket_bookings'

/** 명세 import id 묶음에 대해 statement_lines 전부 로드 (1000행 초과 대응) */
async function fetchAllStatementLinesForImportChunk(importChunk: string[]): Promise<StatementLine[]> {
  const out: StatementLine[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('statement_lines')
      .select('*')
      .in('statement_import_id', importChunk)
      .order('id', { ascending: true })
      .range(from, from + STATEMENT_LINES_FETCH_PAGE - 1)
    if (error && !isAbortLikeError(error)) console.error(error)
    const batch = (data as StatementLine[]) || []
    out.push(...batch)
    if (batch.length < STATEMENT_LINES_FETCH_PAGE) break
    from += STATEMENT_LINES_FETCH_PAGE
  }
  return out
}

/** 월별 커버리지 집계용 — 동일하게 1000행 제한 회피 */
async function fetchCoverageRowsForImportChunk(
  importChunk: string[]
): Promise<{ posted_date: string; matched_status: string }[]> {
  const out: { posted_date: string; matched_status: string }[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('statement_lines')
      .select('posted_date, matched_status')
      .in('statement_import_id', importChunk)
      .order('id', { ascending: true })
      .range(from, from + STATEMENT_LINES_FETCH_PAGE - 1)
    if (error && !isAbortLikeError(error)) console.error(error)
    const batch = (data || []) as { posted_date: string; matched_status: string }[]
    out.push(...batch)
    if (batch.length < STATEMENT_LINES_FETCH_PAGE) break
    from += STATEMENT_LINES_FETCH_PAGE
  }
  return out
}

/** 동일 명세 줄·동일 출처가 매칭 배열에 중복될 때 1건만 유지(DB·응답 중복 방지) */
function dedupeReconciliationMatchRows(rows: ReconciliationMatchRow[]): ReconciliationMatchRow[] {
  const byComposite = new Map<string, ReconciliationMatchRow>()
  for (const r of rows) {
    const k = `${r.statement_line_id}|${r.source_table}|${r.source_id}`
    const prev = byComposite.get(k)
    if (!prev) {
      byComposite.set(k, r)
      continue
    }
    const ta = prev.matched_at ?? ''
    const tb = r.matched_at ?? ''
    if (tb > ta) byComposite.set(k, r)
  }
  return [...byComposite.values()]
}

/** 기간 내 payment_records 전부 — PostgREST max-rows(1000) 순회 */
async function fetchAllPaymentRecordsInDateRange(
  startIso: string,
  endIso: string
): Promise<PaymentRecordOption[]> {
  const byId = new Map<string, PaymentRecordOption>()
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('payment_records')
      .select('id, amount, submit_on, reservation_id, note')
      .gte('submit_on', startIso)
      .lte('submit_on', endIso)
      .order('id', { ascending: true })
      .range(from, from + STATEMENT_LINES_FETCH_PAGE - 1)
    if (error && !isAbortLikeError(error)) console.error(error)
    const batch = (data || []) as Record<string, unknown>[]
    for (const r of batch) {
      const id = String(r.id)
      if (byId.has(id)) continue
      byId.set(id, {
        id,
        amount: Number(r.amount),
        submit_on: String(r.submit_on),
        reservation_id: String(r.reservation_id),
        note: r.note != null ? String(r.note) : null
      })
    }
    if (batch.length < STATEMENT_LINES_FETCH_PAGE) break
    from += STATEMENT_LINES_FETCH_PAGE
  }
  return [...byId.values()]
}

function expensePaymentMethodFromRow(r: Record<string, unknown>): string | null {
  const v = r.payment_method
  if (v == null || v === '') return null
  const s = String(v).trim()
  return s || null
}

function paymentMethodLabelFromRows(id: string | null | undefined, rows: PaymentMethodRow[]): string {
  const raw = id?.trim()
  if (!raw) return '—'
  const pm = rows.find((p) => p.id === raw)
  if (!pm) return raw.length > 14 ? `${raw.slice(0, 10)}…` : raw
  const dn = pm.display_name?.trim()
  if (dn) return dn
  const last = pm.card_number_last4 ? ` ·${pm.card_number_last4}` : ''
  const base = (pm.method || '결제').trim()
  return `${base}${last}`.trim() || raw
}

function recordToExpenseOption(
  table: ExpensePickerBrowseTable,
  r: Record<string, unknown>
): ExpenseOption {
  const pm = expensePaymentMethodFromRow(r)
  if (table === 'ticket_bookings') {
    return {
      source_table: 'ticket_bookings',
      source_id: String(r.id),
      label: `${String(r.category ?? '')} / ${String(r.company ?? '')}`,
      amount: Number(r.expense ?? 0),
      submit_on: String(r.submit_on),
      payment_method: pm
    }
  }
  return {
    source_table: table,
    source_id: String(r.id),
    label: `${r.paid_for} / ${r.paid_to}`,
    amount: Number(r.amount),
    submit_on: String(r.submit_on),
    payment_method: pm
  }
}

function formatExpensePickerLineLabel(o: ExpenseOption) {
  const tag =
    o.source_table === 'company_expenses'
      ? '회사'
      : o.source_table === 'tour_expenses'
        ? '투어'
        : o.source_table === 'reservation_expenses'
          ? '예약'
          : '입장권'
  return `${tag} · $${o.amount.toFixed(2)} · ${o.label.slice(0, 56)}`
}

function formatExpenseOptionSubmitDate(o: ExpenseOption) {
  const s = o.submit_on?.trim() ?? ''
  return s.length >= 10 ? s.slice(0, 10) : s || '—'
}

/** 카드 한 줄용 MM/DD/YYYY (submit_on ISO) */
function formatExpenseSubmitOnUsMdY(submitOn: string): string {
  const s = submitOn?.trim() ?? ''
  if (s.length < 10) return s || '—'
  const y = s.slice(0, 4)
  const m = s.slice(5, 7)
  const d = s.slice(8, 10)
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return s.slice(0, 10)
  return `${m}/${d}/${y}`
}

/** datetime-local 값 ↔ ISO (submit_on 등) */
function isoToDatetimeLocalValue(iso: string): string {
  const s = iso?.trim() ?? ''
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalValueToIso(local: string): string {
  const t = local?.trim() ?? ''
  if (!t) return new Date().toISOString()
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function expenseSourceTableAriaLabel(sourceTable: string): string {
  switch (sourceTable) {
    case 'company_expenses':
      return '회사 지출'
    case 'tour_expenses':
      return '투어 지출'
    case 'reservation_expenses':
      return '예약 지출'
    case 'ticket_bookings':
      return '입장권 부킹'
    default:
      return '지출 연결'
  }
}

/** 회사 / 투어 / 예약 / 입장권 — 매칭·미매칭 목록에서 한눈에 구분 */
function expenseSourceTypeIconColorClass(sourceTable: string): string {
  switch (sourceTable) {
    case 'company_expenses':
      return 'text-amber-600'
    case 'tour_expenses':
      return 'text-sky-600'
    case 'reservation_expenses':
      return 'text-violet-600'
    case 'ticket_bookings':
      return 'text-emerald-600'
    default:
      return 'text-slate-500'
  }
}

function ExpenseSourceTypeIcon({
  sourceTable,
  className
}: {
  sourceTable: string
  className?: string
}) {
  const cn = `${expenseSourceTypeIconColorClass(sourceTable)} ${className ?? 'h-3.5 w-3.5'} shrink-0`.trim()
  switch (sourceTable) {
    case 'company_expenses':
      return <Building2 className={cn} aria-hidden />
    case 'tour_expenses':
      return <MapPinned className={cn} aria-hidden />
    case 'reservation_expenses':
      return <CalendarDays className={cn} aria-hidden />
    case 'ticket_bookings':
      return <Ticket className={cn} aria-hidden />
    default:
      return <Link2 className={cn} aria-hidden />
  }
}

function calendarDaysBetweenIsoDates(a: string, b: string): number {
  const da = a.slice(0, 10)
  const db = b.slice(0, 10)
  if (da.length < 10 || db.length < 10) return 9999
  const t1 = new Date(`${da}T12:00:00`).getTime()
  const t2 = new Date(`${db}T12:00:00`).getTime()
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 9999
  return Math.abs(t1 - t2) / 86400000
}

/** 금액 완전 일치 후보가 없을 때 — 명세 금액과 지출 금액이 비슷한지 (±12% 또는 $4 이내) */
function expenseAmountRoughlyMatchesLine(lineAmt: number, expenseAmt: number): boolean {
  const diff = Math.abs(expenseAmt - lineAmt)
  if (diff < 0.02) return true
  const ref = Math.max(Math.abs(lineAmt), Math.abs(expenseAmt), 0.01)
  return diff / ref <= 0.12 || diff <= 4
}

function expenseKey(sourceTable: string, sourceId: string) {
  return `${sourceTable}:${sourceId}`
}

function dedupeExpenseOptionsByKey(list: ExpenseOption[]): ExpenseOption[] {
  const m = new Map<string, ExpenseOption>()
  for (const o of list) {
    const k = expenseKey(o.source_table, o.source_id)
    if (!m.has(k)) m.set(k, o)
  }
  return [...m.values()]
}

type ExpensePickerQuickItem = { o: ExpenseOption; blockedElsewhere: boolean }

function dedupeExpensePickerQuickItems(items: ExpensePickerQuickItem[]): ExpensePickerQuickItem[] {
  const m = new Map<string, ExpensePickerQuickItem>()
  for (const it of items) {
    const k = expenseKey(it.o.source_table, it.o.source_id)
    const prev = m.get(k)
    if (!prev) m.set(k, it)
    else m.set(k, { o: it.o, blockedElsewhere: prev.blockedElsewhere || it.blockedElsewhere })
  }
  return [...m.values()]
}

/** 현재 명세 줄이 아닌 다른 줄에 이 지출이 연결되어 있으면 그 명세 줄 id 하나 */
function firstOtherStatementLineIdForExpense(
  lineId: string,
  o: ExpenseOption,
  lineIdsByKey: Map<string, Set<string>>
): string | null {
  const k = expenseKey(o.source_table, o.source_id)
  const set = lineIdsByKey.get(k)
  if (!set) return null
  for (const lid of set) {
    if (lid !== lineId) return lid
  }
  return null
}

/** API·동기화 등으로 같은 행이 두 번 들어오는 경우 제거 */
function dedupeExpenseOptionsList(ex: ExpenseOption[]): ExpenseOption[] {
  const byId = new Map<string, ExpenseOption>()
  for (const o of ex) {
    const sid = String(o.source_id ?? '').trim()
    if (!sid || sid === 'undefined' || sid === 'null') continue
    const k = expenseKey(o.source_table, sid)
    if (!byId.has(k)) byId.set(k, { ...o, source_id: sid })
  }
  const list = [...byId.values()]

  /** 동일 유형·동일 거래일(시각 무시)·동일 금액·동일 라벨 → 별도 행이 여러 개면 1개만 유지 */
  const TABLE_MERGE_PRIORITY: Record<string, number> = {
    company_expenses: 0,
    tour_expenses: 1,
    reservation_expenses: 2,
    ticket_bookings: 3
  }
  const pr = (t: string) => TABLE_MERGE_PRIORITY[t] ?? 99
  const byFingerprint = new Map<string, ExpenseOption>()
  for (const o of list) {
    const labelNorm = o.label.replace(/\s+/g, ' ').trim().toLowerCase()
    const amt = Number.isFinite(Number(o.amount)) ? Number(o.amount).toFixed(2) : String(o.amount)
    const submitRaw = String(o.submit_on).trim()
    const dateYmd = submitRaw.length >= 10 ? submitRaw.slice(0, 10) : submitRaw
    const pmKey = String(o.payment_method ?? '').trim()
    const fp = `${o.source_table}|${labelNorm}|${amt}|${dateYmd}|${pmKey}`
    const existing = byFingerprint.get(fp)
    if (!existing) {
      byFingerprint.set(fp, o)
      continue
    }
    const keep =
      pr(o.source_table) < pr(existing.source_table)
        ? o
        : pr(o.source_table) > pr(existing.source_table)
          ? existing
          : String(o.source_id).localeCompare(String(existing.source_id)) < 0
            ? o
            : existing
    byFingerprint.set(fp, keep)
  }
  return [...byFingerprint.values()]
}

const DRAG_MIME_EXPENSE = 'application/x-tms-expense'

/** 명세 기간에 로드된 지출 후보만 대상으로, DB에 이미 매칭된 source 키 조회 */
async function fetchMatchedExpenseKeysForOptions(
  client: typeof supabase,
  options: ExpenseOption[]
): Promise<Set<string>> {
  const matched = new Set<string>()
  if (options.length === 0) return matched
  const byTable = new Map<string, Set<string>>()
  for (const o of options) {
    if (!byTable.has(o.source_table)) byTable.set(o.source_table, new Set())
    byTable.get(o.source_table)!.add(o.source_id)
  }
  const chunkSize = 100
  for (const [table, idSet] of byTable) {
    const ids = [...idSet]
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { data, error } = await client
        .from('reconciliation_matches')
        .select('source_id')
        .eq('source_table', table)
        .in('source_id', chunk)
      if (error) {
        if (!isAbortLikeError(error)) console.error(error)
        continue
      }
      for (const row of data || []) {
        matched.add(`${table}:${row.source_id}`)
      }
    }
  }
  return matched
}

export default function StatementReconciliationTab() {
  const { authUser } = useAuth()
  const params = useParams()
  const locale = typeof params?.locale === 'string' ? params.locale : 'ko'
  const email = authUser?.email ?? ''

  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null)
  const [imports, setImports] = useState<StatementImport[]>([])
  const [lines, setLines] = useState<StatementLine[]>([])
  const [matches, setMatches] = useState<ReconciliationMatchRow[]>([])

  const [filterAccountId, setFilterAccountId] = useState('')
  /** true면 matched_status가 unmatched인 명세 줄만 표시 */
  const [showOnlyUnmatchedLines, setShowOnlyUnmatchedLines] = useState(false)
  /** 표 테이블: 설명·가맹점·금액·일자·방향 등 부분 문자열 검색 */
  const [reconciliationSearchQuery, setReconciliationSearchQuery] = useState('')
  /** 명세 대조 표: 한 번에 그리는 행 수 제한(대량 DOM으로 브라우저 멈춤 방지) */
  const [reconciliationPage, setReconciliationPage] = useState(1)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [expenseOptions, setExpenseOptions] = useState<ExpenseOption[]>([])
  /** 기간 내 지출 후보 중 DB에 이미 매칭된 expenseKey (미매칭 패널·드래그용) */
  const [matchedExpenseKeysInDb, setMatchedExpenseKeysInDb] = useState<Set<string>>(() => new Set())
  const [matchedExpenseKeysLoading, setMatchedExpenseKeysLoading] = useState(false)
  const [dropTargetLineId, setDropTargetLineId] = useState<string | null>(null)
  /** 미매칭 패널 — 지출 행 편집 모달 */
  const [unmatchedEditOption, setUnmatchedEditOption] = useState<ExpenseOption | null>(null)
  const [unmatchedEditLoading, setUnmatchedEditLoading] = useState(false)
  const [unmatchedEditSaving, setUnmatchedEditSaving] = useState(false)
  const [unmatchedEditPaidFor, setUnmatchedEditPaidFor] = useState('')
  const [unmatchedEditPaidTo, setUnmatchedEditPaidTo] = useState('')
  const [unmatchedEditAmount, setUnmatchedEditAmount] = useState('')
  const [unmatchedEditSubmitOn, setUnmatchedEditSubmitOn] = useState('')
  const [unmatchedEditCategory, setUnmatchedEditCategory] = useState('')
  const [unmatchedEditCompany, setUnmatchedEditCompany] = useState('')
  const [unmatchedEditTourDate, setUnmatchedEditTourDate] = useState('')
  /** 미매칭 패널: 일자 정렬 — desc 최신 먼저, asc 과거 먼저 */
  const [unmatchedPanelSortDate, setUnmatchedPanelSortDate] = useState<'desc' | 'asc'>('desc')
  const [unmatchedPanelSearch, setUnmatchedPanelSearch] = useState('')
  /** '' = 전체, '__none__' = 결제수단 미지정 */
  const [unmatchedPanelPaymentMethodFilter, setUnmatchedPanelPaymentMethodFilter] = useState('')
  /** '' = 전체 — company_expenses | tour_expenses | reservation_expenses | ticket_bookings */
  const [unmatchedPanelSourceTableFilter, setUnmatchedPanelSourceTableFilter] = useState('')
  /** 미매칭 패널: 미매칭 지출만 / 기간 내 지출 전체(이미 연결 포함) */
  const [unmatchedPanelListScope, setUnmatchedPanelListScope] = useState<'unmatched' | 'all'>(
    'unmatched'
  )
  const [paymentOptions, setPaymentOptions] = useState<PaymentRecordOption[]>([])
  const [coverageYear, setCoverageYear] = useState(() => new Date().getFullYear().toString())
  /** 선택 금융 계정·연도 기준, 월별 대조완료(matched) / 업로드 전체 줄 수 */
  const [coverageMonthStats, setCoverageMonthStats] = useState<
    { reconciled: number; uploaded: number }[]
  >(() => Array.from({ length: 12 }, () => ({ reconciled: 0, uploaded: 0 })))
  const [coverageStatsLoading, setCoverageStatsLoading] = useState(false)

  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<'bank' | 'credit_card'>('credit_card')
  const [csvText, setCsvText] = useState('')
  /** 파일에서 읽은 경우 저장 — 가져오기 시 statement_imports.original_filename, textarea 직접 수정 시 null */
  const [csvImportFileName, setCsvImportFileName] = useState<string | null>(null)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [importAccountId, setImportAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /** 가져오기 버튼 근처에만 표시 — 긴 안내 아래에 있어도 피드백이 보이게 함 */
  const [importCsvFeedback, setImportCsvFeedback] = useState<string | null>(null)
  const [accountActionError, setAccountActionError] = useState<string | null>(null)
  const [accountsListError, setAccountsListError] = useState<string | null>(null)
  const [paymentLinkModalOpen, setPaymentLinkModalOpen] = useState(false)
  /** 모달: 행별 선택 금융계정 (저장 전까지 서버와 다를 수 있음) */
  const [paymentLinkDraft, setPaymentLinkDraft] = useState<Record<string, string | null>>({})
  /** true면 목록 새로고침 시 draft 덮어쓰기 안 함 */
  const [paymentLinkDirty, setPaymentLinkDirty] = useState(false)
  const [savingPaymentLinks, setSavingPaymentLinks] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [accountsModalOpen, setAccountsModalOpen] = useState(false)
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false)
  const [journalModalOpen, setJournalModalOpen] = useState(false)
  /** 행마다 수천 개 `<option>`을 두지 않고, 모달에서 검색·선택 */
  const [expensePickerLineId, setExpensePickerLineId] = useState<string | null>(null)
  const [expensePickerQuery, setExpensePickerQuery] = useState('')
  const [expensePickerBrowseTable, setExpensePickerBrowseTable] = useState<ExpensePickerBrowseTable | null>(null)
  const [expensePickerBrowsePage, setExpensePickerBrowsePage] = useState(0)
  const [expensePickerBrowseRows, setExpensePickerBrowseRows] = useState<ExpenseOption[]>([])
  const [expensePickerBrowseLoading, setExpensePickerBrowseLoading] = useState(false)
  const [expensePickerBrowseHasMore, setExpensePickerBrowseHasMore] = useState(false)
  const [paymentPickerLineId, setPaymentPickerLineId] = useState<string | null>(null)
  const [paymentPickerQuery, setPaymentPickerQuery] = useState('')
  /** payment_records.reservation_id → customers.name (입금 연결 모달 표시용) */
  const [paymentPickerReservationCustomerNames, setPaymentPickerReservationCustomerNames] = useState<
    Record<string, string>
  >({})
  const createAccountInFlight = useRef(false)
  const csvImportFileInputRef = useRef<HTMLInputElement>(null)

  /** 보정 지출 — 유형 선택 후 모달에서 실제 지출 입력 */
  const [adjustModalLine, setAdjustModalLine] = useState<StatementLine | null>(null)

  /** GET /api/financial/accounts — 클라이언트 Supabase SELECT는 abort·권한 이슈로 빈 목록이 될 수 있음 */
  const loadAccounts = useCallback(async () => {
    setAccountsListError(null)
    try {
      const token = getStoredAccessToken()
      if (!token) {
        setAccounts([])
        return
      }
      const res = await fetch('/api/financial/accounts', {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin',
      })
      const json = (await res.json()) as {
        success?: boolean
        data?: FinancialAccount[]
        error?: string
      }
      if (!res.ok) {
        setAccounts([])
        setAccountsListError(json.error || `금융 계정 목록을 불러오지 못했습니다. (${res.status})`)
        return
      }
      setAccounts(json.data || [])
    } catch (e) {
      setAccounts([])
      setAccountsListError(e instanceof Error ? e.message : '금융 계정 목록을 불러오지 못했습니다.')
    }
  }, [])

  /** 결제 방법 관리 페이지와 동일 API — 클라이언트 직접 조회보다 스키마·한도 일치, 실패 시 메시지 표시 */
  const loadPaymentMethods = useCallback(async () => {
    setPaymentMethodsError(null)
    try {
      const res = await fetch('/api/payment-methods?limit=5000')
      const json = (await res.json()) as {
        success?: boolean
        message?: string
        data?: Array<{
          id: string
          method?: string
          display_name?: string | null
          card_number_last4?: string | null
          financial_account_id?: string | null
          user_email?: string | null
          notes?: string | null
          team?: { email?: string; name_ko?: string | null; name_en?: string | null } | null
        }>
      }
      if (!res.ok || json.success === false) {
        setPaymentMethods([])
        setPaymentMethodsError(
          json.message || `결제수단 목록을 불러오지 못했습니다. (${res.status})`
        )
        return
      }
      const list = json.data || []
      setPaymentMethods(
        list.map((pm) => ({
          id: pm.id,
          method: pm.method ?? '',
          display_name: pm.display_name ?? null,
          card_number_last4: pm.card_number_last4 ?? null,
          financial_account_id: pm.financial_account_id ?? null,
          user_email: pm.user_email ?? null,
          notes: pm.notes ?? null,
          team: pm.team ?? null
        }))
      )
    } catch (e) {
      console.error(e)
      setPaymentMethods([])
      setPaymentMethodsError(e instanceof Error ? e.message : '결제수단을 불러오는 중 오류가 났습니다.')
    }
  }, [])

  const loadImports = useCallback(async () => {
    const { data, error } = await supabase
      .from('statement_imports')
      .select('*')
      .order('period_start', { ascending: false })
      .limit(200)
    if (error && !isAbortLikeError(error)) console.error(error)
    else if (!error) setImports((data as StatementImport[]) || [])
  }, [])

  const emptyMonthStats = useCallback(
    () => Array.from({ length: 12 }, () => ({ reconciled: 0, uploaded: 0 })),
    []
  )

  /** loadCoverageMonthStats가 deps로 자주 바뀌면 loadLinesAndMatches → 무한에 가깝게 재실행되므로 ref로 최신값만 읽음 */
  const filterAccountIdRef = useRef(filterAccountId)
  const coverageYearRef = useRef(coverageYear)
  const importsRef = useRef(imports)
  filterAccountIdRef.current = filterAccountId
  coverageYearRef.current = coverageYear
  importsRef.current = imports

  const coverageStatsRequestGen = useRef(0)

  /** 상단 탭으로 고른 금융 계정의 모든 명세 import에 속한 줄을 월별 집계 (콜백 참조 고정) */
  const loadCoverageMonthStats = useCallback(async () => {
    const gen = ++coverageStatsRequestGen.current
    const filterAccountId = filterAccountIdRef.current
    const imports = importsRef.current
    const coverageYear = coverageYearRef.current

    if (!filterAccountId) {
      setCoverageMonthStats(emptyMonthStats())
      return
    }
    const importIds = imports.filter((im) => im.financial_account_id === filterAccountId).map((im) => im.id)
    if (importIds.length === 0) {
      setCoverageMonthStats(emptyMonthStats())
      return
    }
    const year = parseInt(coverageYear, 10)
    if (!Number.isFinite(year)) {
      setCoverageMonthStats(emptyMonthStats())
      return
    }
    setCoverageStatsLoading(true)
    try {
      const rows: { posted_date: string; matched_status: string }[] = []
      const chunkSize = 80
      for (let i = 0; i < importIds.length; i += chunkSize) {
        if (gen !== coverageStatsRequestGen.current) return
        const chunk = importIds.slice(i, i + chunkSize)
        const batch = await fetchCoverageRowsForImportChunk(chunk)
        rows.push(...batch)
      }
      if (gen !== coverageStatsRequestGen.current) return
      const byMonth = emptyMonthStats()
      for (const row of rows) {
        const raw = row.posted_date
        if (raw == null) continue
        const s = typeof raw === 'string' ? raw : String(raw)
        if (s.length < 7) continue
        const parts = s.slice(0, 10).split('-')
        const y = parseInt(parts[0] || '0', 10)
        const m = parseInt(parts[1] || '0', 10)
        if (y !== year || m < 1 || m > 12) continue
        const idx = m - 1
        byMonth[idx].uploaded += 1
        if (row.matched_status === 'matched') {
          byMonth[idx].reconciled += 1
        }
      }
      if (gen !== coverageStatsRequestGen.current) return
      setCoverageMonthStats(byMonth)
    } finally {
      if (gen === coverageStatsRequestGen.current) {
        setCoverageStatsLoading(false)
      }
    }
  }, [emptyMonthStats])

  /** 선택 금융 계정에 연결된 모든 명세 업로드의 줄·매칭을 합쳐 로드 */
  const loadLinesAndMatchesForAccount = useCallback(async (accountId: string) => {
    if (!accountId) {
      startTransition(() => {
        setLines([])
        setMatches([])
      })
      return
    }
    const importIds = importsRef.current
      .filter((im) => im.financial_account_id === accountId)
      .map((im) => im.id)
    if (importIds.length === 0) {
      startTransition(() => {
        setLines([])
        setMatches([])
      })
      return
    }
    const linesArr: StatementLine[] = []
    const idChunkSize = 40
    for (let i = 0; i < importIds.length; i += idChunkSize) {
      const chunk = importIds.slice(i, i + idChunkSize)
      const batch = await fetchAllStatementLinesForImportChunk(chunk)
      linesArr.push(...batch)
    }
    linesArr.sort((a, b) => {
      const da = a.posted_date || ''
      const db = b.posted_date || ''
      if (da !== db) return da.localeCompare(db)
      return String(a.id).localeCompare(String(b.id))
    })
    const ids = linesArr.map((l) => l.id)
    let matchRows: ReconciliationMatchRow[] = []
    if (ids.length > 0) {
      const chunkSize = 80
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        const { data: matchData, error: e2 } = await supabase
          .from('reconciliation_matches')
          .select('id, statement_line_id, source_table, source_id, matched_by, matched_at')
          .in('statement_line_id', chunk)
        if (e2) {
          if (!isAbortLikeError(e2)) console.error(e2)
          break
        }
        matchRows = matchRows.concat((matchData as ReconciliationMatchRow[]) || [])
      }
    }
    matchRows = dedupeReconciliationMatchRows(matchRows)
    startTransition(() => {
      setLines(linesArr)
      setMatches(matchRows)
    })
  }, [])

  const coverageStatsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleCoverageStatsRefresh = useCallback(() => {
    if (coverageStatsDebounceRef.current) clearTimeout(coverageStatsDebounceRef.current)
    coverageStatsDebounceRef.current = setTimeout(() => {
      coverageStatsDebounceRef.current = null
      void loadCoverageMonthStats()
    }, 450)
  }, [loadCoverageMonthStats])

  useEffect(() => {
    return () => {
      if (coverageStatsDebounceRef.current) clearTimeout(coverageStatsDebounceRef.current)
    }
  }, [])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  /** 결제수단 목록은 연결 모달·미매칭 지출 결제방법 표시에 필요 */
  useEffect(() => {
    if (paymentLinkModalOpen || filterAccountId) {
      void loadPaymentMethods()
    }
  }, [paymentLinkModalOpen, filterAccountId, loadPaymentMethods])

  /** 금융 계정 API는 Bearer 필요 — Auth 준비 후 호출 (마운트 직전 빈 토큰으로 목록이 비는 것 방지) */
  useEffect(() => {
    if (authUser?.email) {
      loadAccounts()
    }
  }, [authUser?.email, loadAccounts])

  const importIdsFingerprintForAccount = useMemo(
    () =>
      imports
        .filter((im) => im.financial_account_id === filterAccountId)
        .map((im) => im.id)
        .sort()
        .join(','),
    [imports, filterAccountId]
  )

  useEffect(() => {
    void loadLinesAndMatchesForAccount(filterAccountId)
  }, [filterAccountId, importIdsFingerprintForAccount, loadLinesAndMatchesForAccount])

  useEffect(() => {
    setExpensePickerLineId(null)
    setExpensePickerQuery('')
    setPaymentPickerLineId(null)
    setPaymentPickerQuery('')
  }, [filterAccountId])

  useEffect(() => {
    if (expensePickerLineId && !lines.some((l) => l.id === expensePickerLineId)) {
      setExpensePickerLineId(null)
      setExpensePickerQuery('')
    }
  }, [expensePickerLineId, lines])

  useEffect(() => {
    if (paymentPickerLineId && !lines.some((l) => l.id === paymentPickerLineId)) {
      setPaymentPickerLineId(null)
      setPaymentPickerQuery('')
    }
  }, [paymentPickerLineId, lines])

  /** 계정·연도·import 목록 변경 시에만 월 통계 (디바운스로 연속 갱신 합침) */
  useEffect(() => {
    const t = setTimeout(() => {
      void loadCoverageMonthStats()
    }, 320)
    return () => clearTimeout(t)
  }, [filterAccountId, coverageYear, imports, loadCoverageMonthStats])

  /** 모달이 열려 있고 편집 중이 아니면 서버 목록과 draft 동기화 */
  useEffect(() => {
    if (!paymentLinkModalOpen) return
    if (paymentLinkDirty) return
    const next: Record<string, string | null> = {}
    for (const pm of paymentMethods) {
      next[pm.id] = pm.financial_account_id ?? null
    }
    setPaymentLinkDraft(next)
  }, [paymentLinkModalOpen, paymentMethods, paymentLinkDirty])

  const paymentLinkHasChanges = useMemo(() => {
    if (!paymentLinkModalOpen) return false
    return paymentMethods.some((pm) => {
      const cur =
        paymentLinkDraft[pm.id] !== undefined ? paymentLinkDraft[pm.id] : pm.financial_account_id ?? null
      const base = pm.financial_account_id ?? null
      return cur !== base
    })
  }, [paymentLinkModalOpen, paymentMethods, paymentLinkDraft])

  const importsForAccount = useMemo(
    () => imports.filter((im) => im.financial_account_id === filterAccountId),
    [imports, filterAccountId]
  )

  /** 해당 계정의 모든 명세 업로드 기간을 합친 범위(지출 후보·피커·자동매칭 후보 조회용) */
  const accountExpenseWindow = useMemo(() => {
    const list = importsForAccount
    if (!list.length) return null
    let minS = list[0].period_start || ''
    let maxE = list[0].period_end || ''
    for (const im of list) {
      const ps = im.period_start || ''
      const pe = im.period_end || ''
      if (ps && (!minS || ps < minS)) minS = ps
      if (pe && (!maxE || pe > maxE)) maxE = pe
    }
    if (!minS || !maxE) return null
    return { period_start: minS, period_end: maxE }
  }, [importsForAccount])

  /** 명세 잠금 버튼: 기간 종료일이 가장 늦은 업로드 1건 */
  const lockTargetImport = useMemo(() => {
    const list = [...importsForAccount].sort((a, b) => {
      const eb = (b.period_end || b.period_start || '').slice(0, 10)
      const ea = (a.period_end || a.period_start || '').slice(0, 10)
      return eb.localeCompare(ea)
    })
    return list[0] ?? null
  }, [importsForAccount])

  /** 명세 기간(±7일) 지출·입금 후보 — 저장 후 갱신에도 사용 */
  const fetchExpenseOptionsForPeriod = useCallback(async (): Promise<{
    ex: ExpenseOption[]
    prOpts: PaymentRecordOption[]
  } | null> => {
    if (!filterAccountId || !accountExpenseWindow) return null
    const start = new Date(accountExpenseWindow.period_start)
    const end = new Date(accountExpenseWindow.period_end)
    start.setDate(start.getDate() - 7)
    end.setDate(end.getDate() + 7)
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    const [{ data: ce }, { data: te }, { data: re }, { data: tb }] = await Promise.all([
      supabase
        .from('company_expenses')
        .select('id, amount, submit_on, paid_for, paid_to, payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('tour_expenses')
        .select('id, amount, submit_on, paid_for, paid_to, payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('reservation_expenses')
        .select('id, amount, submit_on, paid_for, paid_to, payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('ticket_bookings')
        .select('id, expense, submit_on, category, company, payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso)
    ])
    const prOpts = await fetchAllPaymentRecordsInDateRange(startIso, endIso)
    const ex: ExpenseOption[] = [
      ...(ce || []).map((r: Record<string, unknown>) => ({
        source_table: 'company_expenses' as const,
        source_id: String(r.id),
        label: `${r.paid_for} / ${r.paid_to}`,
        amount: Number(r.amount),
        submit_on: String(r.submit_on),
        payment_method: expensePaymentMethodFromRow(r)
      })),
      ...(te || []).map((r: Record<string, unknown>) => ({
        source_table: 'tour_expenses' as const,
        source_id: String(r.id),
        label: `${r.paid_for} / ${r.paid_to}`,
        amount: Number(r.amount),
        submit_on: String(r.submit_on),
        payment_method: expensePaymentMethodFromRow(r)
      })),
      ...(re || []).map((r: Record<string, unknown>) => ({
        source_table: 'reservation_expenses' as const,
        source_id: String(r.id),
        label: `${r.paid_for} / ${r.paid_to}`,
        amount: Number(r.amount),
        submit_on: String(r.submit_on),
        payment_method: expensePaymentMethodFromRow(r)
      })),
      ...(tb || []).map((r: Record<string, unknown>) => ({
        source_table: 'ticket_bookings' as const,
        source_id: String(r.id),
        label: `${String(r.category ?? '')} / ${String(r.company ?? '')}`,
        amount: Number(r.expense ?? 0),
        submit_on: String(r.submit_on),
        payment_method: expensePaymentMethodFromRow(r)
      }))
    ]
    const exDeduped = dedupeExpenseOptionsList(ex)
    return { ex: exDeduped, prOpts }
  }, [filterAccountId, accountExpenseWindow])

  const matchesByLine = useMemo(() => {
    const m = new Map<string, ReconciliationMatchRow[]>()
    for (const x of matches) {
      const arr = m.get(x.statement_line_id) || []
      arr.push(x)
      m.set(x.statement_line_id, arr)
    }
    return m
  }, [matches])

  /** 지출 키 → 그 지출을 잡고 있는 명세 줄 id 집합 (드롭다운·행마다 matches.some 반복 제거) */
  const expenseKeyToLineIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const x of matches) {
      if (!EXPENSE_TABLES.includes(x.source_table as (typeof EXPENSE_TABLES)[number])) continue
      const k = expenseKey(x.source_table, x.source_id)
      if (!map.has(k)) map.set(k, new Set())
      map.get(k)!.add(x.statement_line_id)
    }
    return map
  }, [matches])

  const expensePairOnLine = useMemo(() => {
    const s = new Set<string>()
    for (const x of matches) {
      if (!EXPENSE_TABLES.includes(x.source_table as (typeof EXPENSE_TABLES)[number])) continue
      s.add(`${x.statement_line_id}|${expenseKey(x.source_table, x.source_id)}`)
    }
    return s
  }, [matches])

  const paymentRecordToLineIds = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const x of matches) {
      if (x.source_table !== 'payment_records') continue
      if (!map.has(x.source_id)) map.set(x.source_id, new Set())
      map.get(x.source_id)!.add(x.statement_line_id)
    }
    return map
  }, [matches])

  const expenseOptionSelectableFast = useCallback(
    (lineId: string, opt: ExpenseOption) => {
      const k = expenseKey(opt.source_table, opt.source_id)
      if (expensePairOnLine.has(`${lineId}|${k}`)) return true
      const lines = expenseKeyToLineIds.get(k)
      if (!lines) return true
      for (const lid of lines) {
        if (lid !== lineId) return false
      }
      return true
    },
    [expenseKeyToLineIds, expensePairOnLine]
  )

  const canPickExpenseKeysFast = useCallback(
    (lineId: string, sourceTable: string, sourceId: string) => {
      const k = expenseKey(sourceTable, sourceId)
      if (expensePairOnLine.has(`${lineId}|${k}`)) return true
      const lids = expenseKeyToLineIds.get(k)
      if (!lids) return true
      for (const lid of lids) {
        if (lid !== lineId) return false
      }
      return true
    },
    [expenseKeyToLineIds, expensePairOnLine]
  )

  const canPickPaymentRecordForLineFast = useCallback(
    (lineId: string, prId: string) => {
      const set = paymentRecordToLineIds.get(prId)
      if (!set) return true
      for (const lid of set) {
        if (lid !== lineId) return false
      }
      return true
    },
    [paymentRecordToLineIds]
  )

  const expenseOptionByKey = useMemo(() => {
    const m = new Map<string, ExpenseOption>()
    for (const o of expenseOptions) {
      m.set(`${o.source_table}:${o.source_id}`, o)
    }
    return m
  }, [expenseOptions])

  const refreshUnmatchedExpenseKeys = useCallback(async () => {
    if (expenseOptions.length === 0) {
      setMatchedExpenseKeysInDb(new Set())
      return
    }
    setMatchedExpenseKeysLoading(true)
    try {
      const s = await fetchMatchedExpenseKeysForOptions(supabase, expenseOptions)
      setMatchedExpenseKeysInDb(s)
    } finally {
      setMatchedExpenseKeysLoading(false)
    }
  }, [expenseOptions])

  useEffect(() => {
    void refreshUnmatchedExpenseKeys()
  }, [refreshUnmatchedExpenseKeys])

  useEffect(() => {
    const clearDrop = () => setDropTargetLineId(null)
    document.addEventListener('dragend', clearDrop)
    return () => document.removeEventListener('dragend', clearDrop)
  }, [])

  const unmatchedExpensePanelRows = useMemo(() => {
    const nonZero = (o: ExpenseOption) => {
      const amt = Number(o.amount)
      if (!Number.isFinite(amt)) return true
      return amt !== 0
    }
    const rows =
      unmatchedPanelListScope === 'all'
        ? expenseOptions.filter(nonZero)
        : expenseOptions.filter((o) => {
            if (matchedExpenseKeysInDb.has(expenseKey(o.source_table, o.source_id))) return false
            return nonZero(o)
          })
    rows.sort((a, b) => {
      const tb = new Date(String(b.submit_on)).getTime()
      const ta = new Date(String(a.submit_on)).getTime()
      const aBad = Number.isNaN(ta)
      const bBad = Number.isNaN(tb)
      if (aBad && bBad) return 0
      if (aBad) return 1
      if (bBad) return -1
      const cmp = tb - ta
      return unmatchedPanelSortDate === 'desc' ? cmp : -cmp
    })
    return rows
  }, [
    expenseOptions,
    matchedExpenseKeysInDb,
    unmatchedPanelSortDate,
    unmatchedPanelListScope
  ])

  const unmatchedExpensePanelSourceFilteredRows = useMemo(() => {
    const t = unmatchedPanelSourceTableFilter
    if (!t) return unmatchedExpensePanelRows
    return unmatchedExpensePanelRows.filter((o) => o.source_table === t)
  }, [unmatchedExpensePanelRows, unmatchedPanelSourceTableFilter])

  const unmatchedPanelPaymentFilterOptions = useMemo(() => {
    const idToLabel = new Map<string, string>()
    let hasNone = false
    for (const o of unmatchedExpensePanelSourceFilteredRows) {
      const p = o.payment_method?.trim()
      if (!p) hasNone = true
      else if (!idToLabel.has(p))
        idToLabel.set(p, paymentMethodLabelFromRows(p, paymentMethods))
    }
    const entries = [...idToLabel.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'))
    return { entries, hasNone }
  }, [unmatchedExpensePanelSourceFilteredRows, paymentMethods])

  const unmatchedExpensePanelPaymentFilteredRows = useMemo(() => {
    const fid = unmatchedPanelPaymentMethodFilter
    if (!fid) return unmatchedExpensePanelSourceFilteredRows
    if (fid === '__none__') {
      return unmatchedExpensePanelSourceFilteredRows.filter((o) => !o.payment_method?.trim())
    }
    return unmatchedExpensePanelSourceFilteredRows.filter(
      (o) => (o.payment_method?.trim() || '') === fid
    )
  }, [unmatchedExpensePanelSourceFilteredRows, unmatchedPanelPaymentMethodFilter])

  const unmatchedExpensePanelFilteredRows = useMemo(() => {
    const q = unmatchedPanelSearch.trim().toLowerCase()
    if (!q) return unmatchedExpensePanelPaymentFilteredRows
    return unmatchedExpensePanelPaymentFilteredRows.filter((o) => {
      const label = o.label.toLowerCase()
      const amtNorm = Number(o.amount)
      const amtStr = Number.isFinite(amtNorm) ? amtNorm.toFixed(2) : ''
      const amtRaw = String(o.amount ?? '').toLowerCase()
      const submit = String(o.submit_on).toLowerCase()
      const id = o.source_id.toLowerCase()
      const table = o.source_table.toLowerCase()
      const typeKo = expenseSourceTableAriaLabel(o.source_table).toLowerCase()
      const dateUs = formatExpenseSubmitOnUsMdY(o.submit_on).toLowerCase()
      const pmLabel = paymentMethodLabelFromRows(o.payment_method, paymentMethods).toLowerCase()
      const pmId = (o.payment_method?.trim() || '').toLowerCase()
      const qAmt = q.replace(/[$,]/g, '')
      const amtHit =
        Boolean(amtStr && qAmt !== '' && amtStr.includes(qAmt)) || amtRaw.includes(q)
      return (
        label.includes(q) ||
        submit.includes(q) ||
        id.includes(q) ||
        table.includes(q) ||
        typeKo.includes(q) ||
        dateUs.includes(q) ||
        amtHit ||
        pmLabel.includes(q) ||
        pmId.includes(q)
      )
    })
  }, [
    unmatchedExpensePanelPaymentFilteredRows,
    unmatchedPanelSearch,
    paymentMethods
  ])

  /** 은행/카드 구분 탭 제거 — 활성 금융 계정 전부를 탭으로 표시 */
  const accountsForReconciliation = useMemo(() => {
    return [...accounts]
      .filter((a) => a.is_active)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [accounts])

  const canMutateStatementUploads = useMemo(
    () => email.toLowerCase().trim() === 'info@maniatour.com',
    [email]
  )

  useEffect(() => {
    setImportAccountId((prev) => {
      if (prev && accountsForReconciliation.some((a) => a.id === prev)) return prev
      return accountsForReconciliation[0]?.id ?? ''
    })
  }, [accountsForReconciliation])

  useEffect(() => {
    setFilterAccountId((prev) => {
      if (prev && accountsForReconciliation.some((a) => a.id === prev)) return prev
      const withData = accountsForReconciliation.find((a) =>
        imports.some((im) => im.financial_account_id === a.id)
      )
      return withData?.id ?? accountsForReconciliation[0]?.id ?? ''
    })
  }, [accountsForReconciliation, imports])

  const monthOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of lines) {
      if (l.posted_date?.length >= 7) set.add(l.posted_date.slice(0, 7))
    }
    return Array.from(set).sort()
  }, [lines])

  const displayLines = useMemo(() => {
    if (selectedMonth === 'all') return lines
    return lines.filter((l) => l.posted_date?.startsWith(selectedMonth))
  }, [lines, selectedMonth])

  /** 월·미대조만 필터 적용 후 (검색 전) — 빈 화면 메시지 구분용 */
  const reconciliationLinesBeforeSearch = useMemo(() => {
    if (!showOnlyUnmatchedLines) return displayLines
    return displayLines.filter((l) => l.matched_status === 'unmatched')
  }, [displayLines, showOnlyUnmatchedLines])

  const reconciliationTableLines = useMemo(() => {
    let rows = reconciliationLinesBeforeSearch
    const q = reconciliationSearchQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((line) => {
      const shown = formatStatementLineDescription(line.description, line.merchant).toLowerCase()
      const desc = (line.description ?? '').toLowerCase()
      const merchant = (line.merchant ?? '').toLowerCase()
      const posted = (line.posted_date ?? '').toLowerCase()
      const amt = Number(line.amount)
      const amtNorm = Number.isFinite(amt) ? amt.toFixed(2) : ''
      const amtRaw = String(line.amount ?? '').toLowerCase()
      const qAmt = q.replace(/[$,]/g, '')
      const dir = (line.direction ?? '').toLowerCase()
      const status = (line.matched_status ?? '').toLowerCase()
      const idShort = (line.id ?? '').toLowerCase()
      const dirKo = line.direction === 'outflow' ? '출금' : line.direction === 'inflow' ? '수입' : ''
      const statusKo =
        line.matched_status === 'unmatched' ? '미대조' : line.matched_status === 'matched' ? '대조' : ''
      const amtHit =
        Boolean(amtNorm && qAmt !== '' && amtNorm.includes(qAmt)) || amtRaw.includes(q)
      return (
        shown.includes(q) ||
        desc.includes(q) ||
        merchant.includes(q) ||
        posted.includes(q) ||
        amtHit ||
        dir.includes(q) ||
        status.includes(q) ||
        idShort.includes(q) ||
        dirKo.toLowerCase().includes(q) ||
        statusKo.toLowerCase().includes(q)
      )
    })
  }, [reconciliationLinesBeforeSearch, reconciliationSearchQuery])

  const reconciliationPageCount = useMemo(
    () => Math.max(1, Math.ceil(reconciliationTableLines.length / RECONCILIATION_PAGE_SIZE)),
    [reconciliationTableLines.length]
  )

  const pagedReconciliationLines = useMemo(() => {
    const start = (reconciliationPage - 1) * RECONCILIATION_PAGE_SIZE
    return reconciliationTableLines.slice(start, start + RECONCILIATION_PAGE_SIZE)
  }, [reconciliationTableLines, reconciliationPage])

  useEffect(() => {
    setReconciliationPage(1)
  }, [filterAccountId, selectedMonth, showOnlyUnmatchedLines, reconciliationSearchQuery])

  useEffect(() => {
    setReconciliationSearchQuery('')
  }, [filterAccountId])

  useEffect(() => {
    setUnmatchedPanelSearch('')
    setUnmatchedPanelPaymentMethodFilter('')
    setUnmatchedPanelSourceTableFilter('')
  }, [filterAccountId])

  useEffect(() => {
    setReconciliationPage((p) => Math.min(Math.max(1, p), reconciliationPageCount))
  }, [reconciliationPageCount])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await fetchExpenseOptionsForPeriod()
      if (cancelled) return
      if (!data) {
        startTransition(() => {
          setExpenseOptions([])
          setPaymentOptions([])
        })
        return
      }
      startTransition(() => {
        setExpenseOptions(data.ex)
        setPaymentOptions(data.prOpts)
      })
    })()
    return () => {
      cancelled = true
    }
  }, [fetchExpenseOptionsForPeriod])

  const refreshExpenseOptionsFromServer = useCallback(async () => {
    const data = await fetchExpenseOptionsForPeriod()
    if (!data) {
      startTransition(() => {
        setExpenseOptions([])
        setPaymentOptions([])
      })
      return
    }
    startTransition(() => {
      setExpenseOptions(data.ex)
      setPaymentOptions(data.prOpts)
    })
  }, [fetchExpenseOptionsForPeriod])

  /** 지출 연결 모달 — 테이블 탐색: 현재 명세 줄 거래일( posted_date ) 기준 ±7일 */
  const expensePickerLinePostedYmd = useMemo(() => {
    if (!expensePickerLineId) return ''
    return lines.find((l) => l.id === expensePickerLineId)?.posted_date?.trim().slice(0, 10) ?? ''
  }, [expensePickerLineId, lines])

  const loadExpensePickerBrowse = useCallback(
    async (table: ExpensePickerBrowseTable, page: number) => {
      const lineDate = expensePickerLinePostedYmd
      if (!lineDate || lineDate.length < 10) {
        setExpensePickerBrowseRows([])
        setExpensePickerBrowseHasMore(false)
        return
      }
      const mid = new Date(`${lineDate}T12:00:00`)
      if (Number.isNaN(mid.getTime())) {
        setExpensePickerBrowseRows([])
        setExpensePickerBrowseHasMore(false)
        return
      }
      setExpensePickerBrowseLoading(true)
      try {
        const start = new Date(mid.getTime())
        const end = new Date(mid.getTime())
        start.setDate(start.getDate() - 7)
        end.setDate(end.getDate() + 7)
        const startIso = start.toISOString()
        const endIso = end.toISOString()
        const from = page * PICKER_BROWSE_PAGE_SIZE
        const sel =
          table === 'ticket_bookings'
            ? 'id, expense, submit_on, category, company, payment_method'
            : table === 'tour_expenses'
              ? 'id, amount, submit_on, paid_for, paid_to, tour_date, payment_method'
              : 'id, amount, submit_on, paid_for, paid_to, payment_method'

        const { data, error } = await supabase
          .from(table)
          .select(sel)
          .gte('submit_on', startIso)
          .lte('submit_on', endIso)
          .order('submit_on', { ascending: false })
          .range(from, from + PICKER_BROWSE_PAGE_SIZE)

        if (error) throw error
        const rows = data ?? []
        const hasMore = rows.length > PICKER_BROWSE_PAGE_SIZE
        const slice = rows
          .slice(0, PICKER_BROWSE_PAGE_SIZE)
          .map((r) => recordToExpenseOption(table, r as Record<string, unknown>))
        setExpensePickerBrowseRows(slice)
        setExpensePickerBrowseHasMore(hasMore)
      } catch (e) {
        setExpensePickerBrowseRows([])
        setExpensePickerBrowseHasMore(false)
        if (!isAbortLikeError(e)) {
          setMessage(e instanceof Error ? e.message : '목록 로드 실패')
        }
      } finally {
        setExpensePickerBrowseLoading(false)
      }
    },
    [expensePickerLinePostedYmd]
  )

  useEffect(() => {
    if (!expensePickerBrowseTable || !expensePickerLineId) return
    void loadExpensePickerBrowse(expensePickerBrowseTable, expensePickerBrowsePage)
  }, [
    expensePickerBrowseTable,
    expensePickerBrowsePage,
    expensePickerLineId,
    expensePickerLinePostedYmd,
    loadExpensePickerBrowse
  ])

  useEffect(() => {
    setExpensePickerBrowseTable(null)
    setExpensePickerBrowsePage(0)
    setExpensePickerBrowseRows([])
    setExpensePickerBrowseHasMore(false)
  }, [expensePickerLineId])

  useEffect(() => {
    if (!unmatchedEditOption) {
      setUnmatchedEditLoading(false)
      return
    }
    const { source_table, source_id } = unmatchedEditOption
    let cancelled = false
    setUnmatchedEditLoading(true)
    setMessage(null)
    ;(async () => {
      const sel =
        source_table === 'ticket_bookings'
          ? 'id, expense, submit_on, category, company'
          : source_table === 'tour_expenses'
            ? 'id, amount, submit_on, paid_for, paid_to, tour_date'
            : 'id, amount, submit_on, paid_for, paid_to'
      const { data, error } = await supabase.from(source_table).select(sel).eq('id', source_id).maybeSingle()
      if (cancelled) return
      setUnmatchedEditLoading(false)
      if (error || !data) {
        setMessage(error?.message || '지출을 불러오지 못했습니다.')
        setUnmatchedEditOption(null)
        return
      }
      const row = data as Record<string, unknown>
      if (source_table === 'ticket_bookings') {
        setUnmatchedEditCategory(String(row.category ?? ''))
        setUnmatchedEditCompany(String(row.company ?? ''))
        setUnmatchedEditAmount(String(row.expense ?? ''))
        setUnmatchedEditSubmitOn(isoToDatetimeLocalValue(String(row.submit_on ?? '')))
        setUnmatchedEditPaidFor('')
        setUnmatchedEditPaidTo('')
        setUnmatchedEditTourDate('')
      } else if (source_table === 'tour_expenses') {
        setUnmatchedEditPaidFor(String(row.paid_for ?? ''))
        setUnmatchedEditPaidTo(String(row.paid_to ?? ''))
        setUnmatchedEditAmount(String(row.amount ?? ''))
        setUnmatchedEditSubmitOn(isoToDatetimeLocalValue(String(row.submit_on ?? '')))
        setUnmatchedEditTourDate(row.tour_date ? String(row.tour_date).slice(0, 10) : '')
        setUnmatchedEditCategory('')
        setUnmatchedEditCompany('')
      } else {
        setUnmatchedEditPaidFor(String(row.paid_for ?? ''))
        setUnmatchedEditPaidTo(String(row.paid_to ?? ''))
        setUnmatchedEditAmount(String(row.amount ?? ''))
        setUnmatchedEditSubmitOn(isoToDatetimeLocalValue(String(row.submit_on ?? '')))
        setUnmatchedEditTourDate('')
        setUnmatchedEditCategory('')
        setUnmatchedEditCompany('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [unmatchedEditOption])

  const saveUnmatchedExpenseEdit = useCallback(async () => {
    if (!unmatchedEditOption) return
    const { source_table, source_id } = unmatchedEditOption
    const amt = parseFloat(String(unmatchedEditAmount).replace(/,/g, ''))
    if (!Number.isFinite(amt)) {
      setMessage('금액이 올바르지 않습니다.')
      return
    }
    setUnmatchedEditSaving(true)
    setMessage(null)
    try {
      if (source_table === 'ticket_bookings') {
        const cat = unmatchedEditCategory.trim()
        const comp = unmatchedEditCompany.trim()
        if (!cat || !comp) {
          setMessage('카테고리와 공급업체를 입력하세요.')
          return
        }
        const { error } = await supabase
          .from('ticket_bookings')
          .update({
            category: cat,
            company: comp,
            expense: amt,
            submit_on: datetimeLocalValueToIso(unmatchedEditSubmitOn)
          })
          .eq('id', source_id)
        if (error) throw error
      } else if (source_table === 'tour_expenses') {
        if (!unmatchedEditTourDate.trim()) {
          setMessage('투어 날짜를 입력하세요.')
          return
        }
        const { error } = await supabase
          .from('tour_expenses')
          .update({
            paid_for: unmatchedEditPaidFor.trim(),
            paid_to: unmatchedEditPaidTo.trim(),
            amount: amt,
            submit_on: datetimeLocalValueToIso(unmatchedEditSubmitOn),
            tour_date: unmatchedEditTourDate.trim()
          })
          .eq('id', source_id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from(source_table)
          .update({
            paid_for: unmatchedEditPaidFor.trim(),
            paid_to: unmatchedEditPaidTo.trim(),
            amount: amt,
            submit_on: datetimeLocalValueToIso(unmatchedEditSubmitOn)
          })
          .eq('id', source_id)
        if (error) throw error
      }
      setUnmatchedEditOption(null)
      setMessage('저장했습니다.')
      await refreshExpenseOptionsFromServer()
      await refreshUnmatchedExpenseKeys()
      if (expensePickerBrowseTable !== null && expensePickerLineId) {
        await loadExpensePickerBrowse(expensePickerBrowseTable, expensePickerBrowsePage)
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setUnmatchedEditSaving(false)
    }
  }, [
    unmatchedEditOption,
    unmatchedEditAmount,
    unmatchedEditCategory,
    unmatchedEditCompany,
    unmatchedEditPaidFor,
    unmatchedEditPaidTo,
    unmatchedEditSubmitOn,
    unmatchedEditTourDate,
    refreshExpenseOptionsFromServer,
    refreshUnmatchedExpenseKeys,
    expensePickerBrowseTable,
    expensePickerBrowsePage,
    expensePickerLineId,
    loadExpensePickerBrowse
  ])

  const createAccount = async () => {
    if (!newAccountName.trim() || loading || createAccountInFlight.current) return
    createAccountInFlight.current = true
    setLoading(true)
    setMessage(null)
    setAccountActionError(null)
    try {
      let accessToken = getStoredAccessToken()
      if (!accessToken) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          accessToken = session?.access_token ?? null
        } catch (e) {
          if (isAbortLikeError(e)) {
            accessToken = getStoredAccessToken()
          } else {
            throw e
          }
        }
      }
      if (!accessToken) {
        setAccountActionError('로그인 세션이 없습니다. 다시 로그인한 뒤 시도하세요.')
        return
      }
      const res = await fetch('/api/financial/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: newAccountName.trim(),
          account_type: newAccountType,
          currency: 'USD',
        }),
        credentials: 'same-origin',
      })
      const json = (await res.json()) as { error?: string; success?: boolean; code?: string }
      if (!res.ok) {
        setAccountActionError(json.error || `추가 실패 (${res.status})`)
        return
      }
      setNewAccountName('')
      await loadAccounts()
      setMessage('금융 계정이 추가되었습니다.')
    } catch (e) {
      if (isAbortLikeError(e)) {
        setAccountActionError(
          '요청이 중단되었습니다. 네트워크가 불안정하거나 세션이 갱신 중일 수 있습니다. 잠시 후 다시 눌러 보세요.'
        )
      } else {
        setAccountActionError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      }
    } finally {
      createAccountInFlight.current = false
      setLoading(false)
    }
  }

  const saveAllPaymentMethodLinks = async () => {
    const token = getStoredAccessToken()
    if (!token) {
      const msg = '로그인이 필요합니다. 다시 로그인한 뒤 시도하세요.'
      setMessage(msg)
      setPaymentMethodsError(msg)
      return
    }
    const changes: { id: string; faId: string | null }[] = []
    for (const pm of paymentMethods) {
      const cur =
        paymentLinkDraft[pm.id] !== undefined ? paymentLinkDraft[pm.id] : pm.financial_account_id ?? null
      const base = pm.financial_account_id ?? null
      if (cur !== base) {
        changes.push({ id: pm.id, faId: cur })
      }
    }
    if (changes.length === 0) {
      setMessage('변경된 내용이 없습니다.')
      return
    }
    setSavingPaymentLinks(true)
    setMessage(null)
    setPaymentMethodsError(null)
    try {
      const results = await Promise.allSettled(
        changes.map(({ id, faId }) =>
          fetch(`/api/payment-methods/${encodeURIComponent(id)}/financial-account`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ financial_account_id: faId }),
            credentials: 'same-origin',
          }).then(async (res) => {
            const json = (await res.json()) as { error?: string; message?: string }
            if (!res.ok) {
              throw new Error(json.error || json.message || `HTTP ${res.status}`)
            }
            return id
          })
        )
      )
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      if (failed.length > 0) {
        const errText =
          failed.length === 1
            ? String(failed[0].reason instanceof Error ? failed[0].reason.message : failed[0].reason)
            : `${failed.length}건 저장에 실패했습니다. ${failed
                .map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason)))
                .slice(0, 3)
                .join(' / ')}`
        setMessage(errText)
        setPaymentMethodsError(errText)
        return
      }
      setPaymentLinkDirty(false)
      await loadPaymentMethods()
      setMessage(`${changes.length}건의 연결을 저장했습니다.`)
    } catch (e) {
      const errText = e instanceof Error ? e.message : '저장 중 오류가 났습니다.'
      setMessage(errText)
      setPaymentMethodsError(errText)
    } finally {
      setSavingPaymentLinks(false)
    }
  }

  const importCsv = async () => {
    const notifyImport = (msg: string) => {
      setMessage(msg)
      setImportCsvFeedback(msg)
    }
    setImportCsvFeedback(null)
    if (!canMutateStatementUploads) {
      notifyImport('명세 CSV 가져오기(업로드)는 info@maniatour.com 계정만 사용할 수 있습니다.')
      return
    }
    if (!importAccountId || !periodStart || !periodEnd || !csvText.trim()) {
      notifyImport('계정·기간·CSV 내용을 입력하세요.')
      return
    }
    if (!email) {
      notifyImport('로그인이 필요합니다.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const parsed = parseStatementCsvText(csvText)
      if (parsed.length === 0) {
        notifyImport(
          '파싱된 행이 없습니다. 첫 줄에 날짜·금액 열이 있는지 확인하세요. (은행/카드사마다 열 이름이 다르고, Excel CSV는 맨 앞에 보이지 않는 문자(BOM)가 붙을 수 있습니다.)'
        )
        return
      }

      const contentHash = await hashStatementCsvContent(csvText)
      const { data: dup, error: dupErr } = await supabase
        .from('statement_imports')
        .select('id, created_at, original_filename')
        .eq('financial_account_id', importAccountId)
        .eq('content_hash', contentHash)
        .maybeSingle()

      if (dupErr && !isAbortLikeError(dupErr)) {
        console.error(dupErr)
      }
      if (dup?.id) {
        const when = dup.created_at
          ? new Date(dup.created_at).toLocaleString('ko-KR')
          : ''
        notifyImport(
          `이 금융 계정에 동일한 내용의 CSV가 이미 등록되어 있습니다. (${when ? `등록: ${when}` : '기존 건'}${dup.original_filename ? ` · ${dup.original_filename}` : ''}) 중복 가져오기를 건너뜁니다.`
        )
        return
      }

      const periodLabel = `${periodStart.slice(0, 7)}`

      const { data: imp, error: eImp } = await supabase
        .from('statement_imports')
        .insert({
          financial_account_id: importAccountId,
          period_label: periodLabel,
          period_start: periodStart,
          period_end: periodEnd,
          status: 'imported',
          imported_by: email,
          original_filename: (csvImportFileName?.trim() || 'paste.csv').slice(0, 240),
          content_hash: contentHash
        })
        .select('id')
        .single()

      if (eImp || !imp?.id) {
        const msg = eImp?.message || '명세 헤더 저장 실패'
        if (
          msg.includes('duplicate') ||
          msg.includes('unique') ||
          msg.includes('idx_statement_imports_account_content_hash')
        ) {
          notifyImport(
            '이 금융 계정에 동일한 내용의 CSV가 이미 등록되어 있습니다. 중복 가져오기를 건너뜁니다.'
          )
        } else {
          notifyImport(msg)
        }
        return
      }

      const importId = imp.id as string
      const rows = parsed.map((r, i) => ({
        statement_import_id: importId,
        posted_date: r.postedDate,
        amount: r.amount,
        direction: r.direction,
        description: r.description,
        merchant: r.merchant,
        external_reference: r.externalReference,
        dedupe_key: makeDedupeKey(importId, r, i),
        raw: r.raw as Record<string, unknown>,
        matched_status: 'unmatched' as const
      }))

      const chunk = 150
      for (let i = 0; i < rows.length; i += chunk) {
        const { error: e2 } = await supabase.from('statement_lines').insert(rows.slice(i, i + chunk))
        if (e2) {
          notifyImport(e2.message)
          return
        }
      }

      setCsvText('')
      setCsvImportFileName(null)
      await loadImports()
      notifyImport(`가져옴: ${parsed.length}행`)
    } catch (e) {
      notifyImport(e instanceof Error ? e.message : '가져오기 중 오류가 났습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCsvImportFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target
      const file = input.files?.[0]
      input.value = ''
      if (!file || !canMutateStatementUploads) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : ''
        setCsvText(text)
        setCsvImportFileName(file.name)
        setImportCsvFeedback(null)
      }
      reader.onerror = () => {
        setImportCsvFeedback('파일을 읽지 못했습니다.')
      }
      reader.readAsText(file)
    },
    [canMutateStatementUploads]
  )

  const runAutoMatch = async () => {
    if (!filterAccountId || !accountExpenseWindow) return
    setLoading(true)
    setMessage(null)

    const start = new Date(accountExpenseWindow.period_start)
    const end = new Date(accountExpenseWindow.period_end)
    start.setDate(start.getDate() - 5)
    end.setDate(end.getDate() + 5)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const [{ data: ce }, { data: te }, { data: re }, { data: tb }, { data: existingMatches }] =
      await Promise.all([
        supabase
          .from('company_expenses')
          .select('id, amount, submit_on, paid_for, paid_to')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        supabase
          .from('tour_expenses')
          .select('id, amount, submit_on, paid_for, paid_to')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        supabase
          .from('reservation_expenses')
          .select('id, amount, submit_on, paid_for, paid_to')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        supabase
          .from('ticket_bookings')
          .select('id, expense, submit_on, category, company')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        supabase.from('reconciliation_matches').select('source_table, source_id')
      ])

    const used = new Set<string>()
    for (const m of existingMatches || []) {
      used.add(`${m.source_table}:${m.source_id}`)
    }

    const candidates: ExpenseCandidate[] = [
      ...(ce || []).map((r: Record<string, unknown>) => ({
        source_table: 'company_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`
      })),
      ...(te || []).map((r: Record<string, unknown>) => ({
        source_table: 'tour_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`
      })),
      ...(re || []).map((r: Record<string, unknown>) => ({
        source_table: 'reservation_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`
      })),
      ...(tb || []).map((r: Record<string, unknown>) => ({
        source_table: 'ticket_bookings' as const,
        source_id: String(r.id),
        amount: Number(r.expense ?? 0),
        occurred_at: String(r.submit_on),
        label: `${String(r.category ?? '')} / ${String(r.company ?? '')}`
      }))
    ]

    let n = 0
    for (const line of lines) {
      if (line.direction !== 'outflow') continue
      if ((matchesByLine.get(line.id) || []).length > 0) continue
      const amt = Number(line.amount)
      const best = findBestExpenseForLine(amt, line.posted_date, candidates, used)
      if (!best) continue
      const k = `${best.expense.source_table}:${best.expense.source_id}`
      used.add(k)
      const { error } = await supabase.from('reconciliation_matches').insert({
        statement_line_id: line.id,
        source_table: best.expense.source_table,
        source_id: best.expense.source_id,
        matched_amount: amt,
        matched_by: email || null
      })
      if (error) {
        if (!isAbortLikeError(error)) console.error(error)
        continue
      }
      await supabase
        .from('statement_lines')
        .update({ matched_status: 'matched' })
        .eq('id', line.id)
      n += 1
    }

    setLoading(false)
    setMessage(`자동 매칭 ${n}건`)
    await loadLinesAndMatchesForAccount(filterAccountId)
    scheduleCoverageStatsRefresh()
    await refreshUnmatchedExpenseKeys()
  }

  const lockImport = async () => {
    if (!lockTargetImport) return
    if (!canMutateStatementUploads) {
      setMessage('명세 잠금은 info@maniatour.com 계정만 사용할 수 있습니다.')
      return
    }
    setLoading(true)
    await supabase
      .from('statement_imports')
      .update({ status: 'locked' })
      .eq('id', lockTargetImport.id)
    setLoading(false)
    await loadImports()
    setMessage(
      importsForAccount.length > 1
        ? `가장 최근 명세(기간 종료일 기준)를 잠갔습니다. (${lockTargetImport.period_start ?? ''} ~ ${lockTargetImport.period_end ?? ''})`
        : '명세가 잠겼습니다.'
    )
  }

  const toggleLineFlags = async (line: StatementLine, field: 'exclude_from_pnl' | 'is_personal') => {
    if (field === 'is_personal') {
      const next = !line.is_personal
      await supabase
        .from('statement_lines')
        .update({
          is_personal: next,
          personal_partner: next ? line.personal_partner : null
        })
        .eq('id', line.id)
    } else {
      const next = !line.exclude_from_pnl
      await supabase.from('statement_lines').update({ exclude_from_pnl: next }).eq('id', line.id)
    }
    await loadLinesAndMatchesForAccount(filterAccountId)
  }

  const setStatementPersonalPartner = async (
    line: StatementLine,
    partner: 'partner1' | 'partner2' | 'erica' | ''
  ) => {
    await supabase
      .from('statement_lines')
      .update({ personal_partner: partner || null })
      .eq('id', line.id)
    await loadLinesAndMatchesForAccount(filterAccountId)
  }

  const syncLineMatchedFlag = async (lineId: string) => {
    const { count } = await supabase
      .from('reconciliation_matches')
      .select('id', { count: 'exact', head: true })
      .eq('statement_line_id', lineId)
    await supabase
      .from('statement_lines')
      .update({ matched_status: (count ?? 0) > 0 ? 'matched' : 'unmatched' })
      .eq('id', lineId)
  }

  const saveExpenseSelection = async (line: StatementLine, value: string) => {
    if (!email) {
      setMessage('로그인이 필요합니다.')
      return
    }
    if (!filterAccountId) return
    setLoading(true)
    setMessage(null)
    try {
      if (value) {
        const colon = value.indexOf(':')
        const st = value.slice(0, colon)
        const sid = value.slice(colon + 1)
        if (!canPickExpenseKeysFast(line.id, st, sid)) {
          setMessage('이미 다른 명세 줄에 연결된 지출입니다.')
          setLoading(false)
          return
        }
      }
      const lineMatches = matches.filter(
        (m) =>
          m.statement_line_id === line.id &&
          EXPENSE_TABLES.includes(m.source_table as (typeof EXPENSE_TABLES)[number])
      )
      for (const m of lineMatches) {
        await supabase.from('reconciliation_matches').delete().eq('id', m.id)
      }
      if (value) {
        const colon = value.indexOf(':')
        const st = value.slice(0, colon)
        const sid = value.slice(colon + 1)
        await supabase.from('reconciliation_matches').insert({
          statement_line_id: line.id,
          source_table: st,
          source_id: sid,
          matched_amount: Number(line.amount),
          matched_by: email
        })
      }
      await syncLineMatchedFlag(line.id)
      setMessage(value ? '지출 매칭을 저장했습니다.' : '지출 매칭을 해제했습니다.')
      await loadLinesAndMatchesForAccount(filterAccountId)
      scheduleCoverageStatsRefresh()
      await refreshUnmatchedExpenseKeys()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  const addPaymentRecordMatch = async (line: StatementLine, prId: string) => {
    if (!email) {
      setMessage('로그인이 필요합니다.')
      return
    }
    if (!filterAccountId) return
    if (!canPickPaymentRecordForLineFast(line.id, prId)) {
      setMessage('이미 다른 명세 줄에 연결된 입금 기록입니다.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      await supabase.from('reconciliation_matches').insert({
        statement_line_id: line.id,
        source_table: 'payment_records',
        source_id: prId,
        matched_amount: Number(line.amount),
        matched_by: email
      })
      await syncLineMatchedFlag(line.id)
      setMessage('입금 매칭을 추가했습니다.')
      await loadLinesAndMatchesForAccount(filterAccountId)
      scheduleCoverageStatsRefresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  const removeMatchRow = async (lineId: string, matchRowId: string) => {
    if (!filterAccountId) return
    setLoading(true)
    try {
      await supabase.from('reconciliation_matches').delete().eq('id', matchRowId)
      await syncLineMatchedFlag(lineId)
      await loadLinesAndMatchesForAccount(filterAccountId)
      scheduleCoverageStatsRefresh()
      await refreshUnmatchedExpenseKeys()
      setMessage('매칭을 삭제했습니다.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '삭제 실패')
    } finally {
      setLoading(false)
    }
  }

  const deferredExpensePickerQuery = useDeferredValue(expensePickerQuery)
  const deferredPaymentPickerQuery = useDeferredValue(paymentPickerQuery)

  const expensePickerLine = useMemo(
    () => (expensePickerLineId ? lines.find((l) => l.id === expensePickerLineId) ?? null : null),
    [expensePickerLineId, lines]
  )

  const paymentPickerLine = useMemo(
    () => (paymentPickerLineId ? lines.find((l) => l.id === paymentPickerLineId) ?? null : null),
    [paymentPickerLineId, lines]
  )

  const paymentPickerLineMatches = useMemo(() => {
    if (!paymentPickerLineId) return [] as ReconciliationMatchRow[]
    return matchesByLine.get(paymentPickerLineId) || []
  }, [paymentPickerLineId, matchesByLine])

  const expensePickerQuick = useMemo(() => {
    if (!expensePickerLineId || !expensePickerLine) {
      return { list: [] as ExpensePickerQuickItem[], mode: 'none' as const }
    }
    const lineAmt = Number(expensePickerLine.amount)
    const lineDate = expensePickerLine.posted_date?.slice(0, 10) ?? ''

    const exact: ExpensePickerQuickItem[] = []
    for (const o of expenseOptions) {
      if (Math.abs(o.amount - lineAmt) < 0.02) {
        exact.push({
          o,
          blockedElsewhere: !expenseOptionSelectableFast(expensePickerLineId, o)
        })
      }
    }
    if (exact.length > 0) {
      return {
        list: dedupeExpensePickerQuickItems(exact).slice(0, PICKER_QUICK_MAX),
        mode: 'exact' as const
      }
    }

    type Scored = { item: ExpensePickerQuickItem; score: number }
    const scored: Scored[] = []
    for (const o of expenseOptions) {
      const oDate = o.submit_on?.trim() ? o.submit_on.trim().slice(0, 10) : ''
      if (!lineDate || oDate.length < 10) continue
      const days = calendarDaysBetweenIsoDates(lineDate, oDate)
      if (days > PICKER_QUICK_DATE_WINDOW_DAYS) continue
      if (!expenseAmountRoughlyMatchesLine(lineAmt, o.amount)) continue
      const amtDiff = Math.abs(o.amount - lineAmt)
      const score = 10000 - amtDiff * 100 - days * 8
      scored.push({
        item: {
          o,
          blockedElsewhere: !expenseOptionSelectableFast(expensePickerLineId, o)
        },
        score
      })
    }
    scored.sort((a, b) => b.score - a.score)
    const similar = dedupeExpensePickerQuickItems(scored.map((s) => s.item)).slice(0, PICKER_QUICK_MAX)
    if (similar.length > 0) {
      return { list: similar, mode: 'similar' as const }
    }
    return { list: [], mode: 'none' as const }
  }, [expensePickerLineId, expensePickerLine, expenseOptions, expenseOptionSelectableFast])

  const expensePickerSearchResults = useMemo(() => {
    if (!expensePickerLineId || !expensePickerLine) return []
    const q = deferredExpensePickerQuery.trim().toLowerCase()
    if (q.length < PICKER_SEARCH_MIN_CHARS) return []
    const out: ExpenseOption[] = []
    for (const o of expenseOptions) {
      if (!expenseOptionSelectableFast(expensePickerLineId, o)) continue
      const hay = `${o.label} ${o.amount} ${o.submit_on} ${o.source_id}`.toLowerCase()
      if (!hay.includes(q)) continue
      out.push(o)
      if (out.length >= PICKER_SEARCH_MAX) break
    }
    return dedupeExpenseOptionsByKey(out).slice(0, PICKER_SEARCH_MAX)
  }, [
    expensePickerLineId,
    expensePickerLine,
    deferredExpensePickerQuery,
    expenseOptions,
    expenseOptionSelectableFast
  ])

  const paymentPickerQuickOptions = useMemo(() => {
    if (!paymentPickerLineId || !paymentPickerLine) return []
    const lineAmt = Number(paymentPickerLine.amount)
    const out: PaymentRecordOption[] = []
    for (const pr of paymentOptions) {
      const onThis = paymentPickerLineMatches.some(
        (m) => m.source_table === 'payment_records' && m.source_id === pr.id
      )
      if (onThis) continue
      if (!canPickPaymentRecordForLineFast(paymentPickerLineId, pr.id)) continue
      if (Math.abs(pr.amount - lineAmt) < 0.02) {
        out.push(pr)
        if (out.length >= PICKER_QUICK_MAX) break
      }
    }
    return out
  }, [
    paymentPickerLineId,
    paymentPickerLine,
    paymentOptions,
    paymentPickerLineMatches,
    canPickPaymentRecordForLineFast
  ])

  const paymentPickerSearchResults = useMemo(() => {
    if (!paymentPickerLineId || !paymentPickerLine) return []
    const q = deferredPaymentPickerQuery.trim().toLowerCase()
    if (q.length < PICKER_SEARCH_MIN_CHARS) return []
    const out: PaymentRecordOption[] = []
    for (const pr of paymentOptions) {
      const onThis = paymentPickerLineMatches.some(
        (m) => m.source_table === 'payment_records' && m.source_id === pr.id
      )
      if (onThis) continue
      if (!canPickPaymentRecordForLineFast(paymentPickerLineId, pr.id)) continue
      const custNm = paymentPickerReservationCustomerNames[pr.reservation_id]?.trim() ?? ''
      const hay = `${pr.amount} ${pr.submit_on} ${pr.reservation_id} ${pr.note ?? ''} ${custNm}`.toLowerCase()
      if (!hay.includes(q)) continue
      out.push(pr)
      if (out.length >= PICKER_SEARCH_MAX) break
    }
    return out
  }, [
    paymentPickerLineId,
    paymentPickerLine,
    deferredPaymentPickerQuery,
    paymentOptions,
    paymentPickerLineMatches,
    canPickPaymentRecordForLineFast,
    paymentPickerReservationCustomerNames
  ])

  useEffect(() => {
    if (!paymentPickerLineId || paymentOptions.length === 0) {
      setPaymentPickerReservationCustomerNames({})
      return
    }
    let cancelled = false
    ;(async () => {
      const resIds = [...new Set(paymentOptions.map((p) => p.reservation_id).filter(Boolean))]
      if (resIds.length === 0) {
        if (!cancelled) setPaymentPickerReservationCustomerNames({})
        return
      }
      const map: Record<string, string> = {}
      const chunkSize = 80
      for (let i = 0; i < resIds.length; i += chunkSize) {
        const chunk = resIds.slice(i, i + chunkSize)
        const { data: resvRows, error: e1 } = await supabase
          .from('reservations')
          .select('id, customer_id')
          .in('id', chunk)
        if (cancelled) return
        if (e1) {
          if (!isAbortLikeError(e1)) console.error(e1)
          break
        }
        const custIds = [
          ...new Set(
            (resvRows || [])
              .map((r) => (r as { customer_id?: string | null }).customer_id)
              .filter(Boolean)
          )
        ] as string[]
        const custById = new Map<string, string>()
        if (custIds.length > 0) {
          const { data: custRows, error: e2 } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', custIds)
          if (cancelled) return
          if (e2 && !isAbortLikeError(e2)) console.error(e2)
          else if (custRows) {
            for (const c of custRows as { id: string; name?: string | null }[]) {
              const n = c.name?.trim()
              if (n) custById.set(String(c.id), n)
            }
          }
        }
        for (const r of resvRows || []) {
          const row = r as { id: string; customer_id?: string | null }
          const rid = String(row.id)
          const cid = row.customer_id
          const name = cid ? custById.get(String(cid)) : undefined
          map[rid] = name ?? ''
        }
      }
      if (!cancelled) setPaymentPickerReservationCustomerNames(map)
    })()
    return () => {
      cancelled = true
    }
  }, [paymentPickerLineId, paymentOptions])

  const statementOutflowSum = useMemo(
    () =>
      reconciliationTableLines
        .filter((l) => l.direction === 'outflow' && !l.exclude_from_pnl)
        .reduce((s, l) => s + Number(l.amount), 0),
    [reconciliationTableLines]
  )

  const statementInflowSum = useMemo(
    () =>
      reconciliationTableLines
        .filter((l) => l.direction === 'inflow' && !l.exclude_from_pnl)
        .reduce((s, l) => s + Number(l.amount), 0),
    [reconciliationTableLines]
  )

  const selectedAccountLabel = useMemo(
    () => accountsForReconciliation.find((a) => a.id === filterAccountId)?.name ?? '—',
    [accountsForReconciliation, filterAccountId]
  )

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0">
      <div className="space-y-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-semibold text-slate-900 shrink-0">금융 계정</span>
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 min-w-0 flex-1">
          {accountsForReconciliation.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setFilterAccountId(a.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
                filterAccountId === a.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="max-w-[14rem] truncate" title={a.name}>
                {a.name}
              </span>
              <span
                className={`text-[10px] uppercase shrink-0 ${
                  filterAccountId === a.id ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {a.account_type === 'bank' ? '은행' : a.account_type === 'credit_card' ? '카드' : a.account_type}
              </span>
            </button>
          ))}
          {accountsForReconciliation.length === 0 && (
            <span className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              활성 금융 계정이 없습니다. «금융 계정»에서 추가하세요.
            </span>
          )}
          </div>
        </div>
        <p className="text-xs text-slate-600 w-full">
          계정별로 업로드된 명세를 고릅니다. 탭을 바꾸면 해당 레지스터로 가져온 명세·거래가 불러와집니다.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 shrink-0">명세 대조 안내 · 도움말</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setHelpModalOpen(true)}
            aria-label="명세 대조 안내 · 도움말 열기"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            열기
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 shrink-0">보안 · 취급 주의</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setSecurityModalOpen(true)}
            aria-label="보안 · 취급 주의 열기"
          >
            <Shield className="h-4 w-4 shrink-0" />
            열기
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 shrink-0">금융 계정</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setAccountsModalOpen(true)
              void loadAccounts()
            }}
            aria-label="금융 계정 관리 열기"
          >
            <Building2 className="h-4 w-4 shrink-0" />
            열기
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 shrink-0">결제수단 ↔ 금융 계정 연결</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setPaymentLinkDirty(false)
              setPaymentLinkModalOpen(true)
              void loadPaymentMethods()
            }}
            aria-label="결제수단과 금융 계정 연결 열기"
          >
            <Link2 className="h-4 w-4 shrink-0" />
            열기
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 shrink-0">명세 CSV 가져오기</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              if (filterAccountId) setImportAccountId(filterAccountId)
              setCsvImportModalOpen(true)
              void loadAccounts()
            }}
            aria-label="명세 CSV 가져오기 열기"
          >
            <Upload className="h-4 w-4 shrink-0" />
            열기
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-2 min-w-0">
          <span className="text-sm font-medium text-slate-800 shrink-0">카드 대금 이체 분개</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => {
              setJournalModalOpen(true)
              void loadAccounts()
            }}
            aria-label="카드 대금 이체 분개 열기"
          >
            <Receipt className="h-4 w-4 shrink-0" />
            열기
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-800">{message}</div>
      )}

      <StatementAdjustmentExpenseModal
        open={adjustModalLine !== null}
        onOpenChange={(v) => {
          if (!v) setAdjustModalLine(null)
        }}
        line={adjustModalLine}
        email={email}
        onCompleted={async () => {
          setMessage('보정 지출이 생성·연결되었습니다.')
          if (filterAccountId) {
            await loadLinesAndMatchesForAccount(filterAccountId)
            scheduleCoverageStatsRefresh()
            await refreshUnmatchedExpenseKeys()
          }
        }}
      />

      <Dialog open={helpModalOpen} onOpenChange={setHelpModalOpen}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1.25rem)] max-h-[min(92vh,880px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-slate-100 shrink-0 text-left">
            <DialogTitle className="text-base sm:text-lg flex items-center gap-2">
              <BookOpen className="h-5 w-5 shrink-0 text-slate-600" />
              명세 대조 안내 · 도움말
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 text-xs sm:text-sm text-slate-800 space-y-4">
            <div className="flex items-start gap-2">
              <BookOpen className="h-5 w-5 shrink-0 text-slate-600 mt-0.5" />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">이 화면의 위치</h2>
                <p>
                  <strong>관리자 › 명세 대조</strong> 전용 페이지입니다.{' '}
                  <strong>「<AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>」</strong> 사이드바 메뉴 또는 URL{' '}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs border">/ko/admin/statement-reconciliation</code>
                  (로케일에 따라 <code className="rounded bg-slate-100 px-1 py-0.5 text-xs border">/ko</code> 앞 경로만 달라집니다.)
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <h3 className="font-semibold text-slate-900">왜 필요한가</h3>
              <p className="leading-relaxed">
                영수증을 붙여 둔 지출은 <code className="text-xs bg-slate-100 px-1 rounded border">company_expenses</code>·
                <code className="text-xs bg-slate-100 px-1 rounded border">tour_expenses</code>·
                <code className="text-xs bg-slate-100 px-1 rounded border">reservation_expenses</code> 등에 들어가지만, 카드
                실제 <AccountingTerm termKey="청구서">청구</AccountingTerm>는 <strong>월별 <AccountingTerm termKey="명세">명세</AccountingTerm>(statement)</strong>가 기준이 됩니다. 여기서 명세와 시스템 지출을 맞추면{' '}
                <AccountingTerm termKey="PNL">PNL</AccountingTerm>·정산이 명세와 일치합니다.
              </p>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <h3 className="font-semibold text-slate-900">권장 월별 순서</h3>
              <ol className="list-decimal list-inside space-y-2 leading-relaxed pl-1">
                <li>
                  <strong>
                    <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                  </strong>
                  을 만듭니다(카드·은행 각각). 한 장의 카드/한 계좌당 하나씩 두면 <AccountingTerm termKey="대조">대조</AccountingTerm>가 쉽습니다.
                </li>
                <li>
                  <strong>
                    <AccountingTerm termKey="결제수단">결제수단</AccountingTerm>(payment_methods)
                  </strong>{' '}
                  목록에서 직원 카드 등을 해당{' '}
                  <strong>
                    <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                  </strong>
                  에 연결합니다. (누가 어떤 회사 카드로 썼는지와 명세 단위를 맞출 때 참고용입니다.)
                </li>
                <li>
                  카드사·은행에서 <strong>CSV</strong>를 내려받아 입력란에 붙여 넣고, <strong>이번 명세의 기간</strong>과{' '}
                  <strong>
                    해당 <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                  </strong>
                  을 선택한 뒤 <strong>가져오기</strong>를 누릅니다.
                </li>
                <li>
                  <strong>명세 선택</strong>으로 방금 넣은 걸 고른 다음{' '}
                  <strong>
                    <AccountingTerm termKey="자동매칭">자동 매칭</AccountingTerm>
                  </strong>
                  을 실행합니다. 금액이 같고 날짜가 가까운 기존 지출(회사/투어/예약/입장권 부킹)과 연결됩니다.
                </li>
                <li>
                  여전히{' '}
                  <strong>
                    <AccountingTerm termKey="미매칭">미매칭</AccountingTerm>
                  </strong>
                  인 줄은 명세에만 있는 지출입니다.{' '}
                  <strong>
                    <AccountingTerm termKey="보정지출">보정 지출</AccountingTerm>
                  </strong>
                  을 누르면 티켓·예약·투어·회사 지출 중 유형을 고른 뒤, 해당 입력란에 맞게 실제 지출을 저장하면 명세와 연결됩니다.
                </li>
                <li>
                  <strong>개인 사용</strong>이면 <strong>개인</strong>을 켠 뒤{' '}
                  <strong>
                    <AccountingTerm termKey="파트너">파트너</AccountingTerm>(Joey / Chad / Erica)
                  </strong>
                  를 선택합니다. 같은 금액이{' '}
                  <strong>
                    <AccountingTerm termKey="파트너자금">파트너 자금</AccountingTerm> 관리
                  </strong>
                  에 <AccountingTerm termKey="출금">출금</AccountingTerm>으로 자동 반영됩니다(개인 카드 사용 = 해당 파트너의 순자산에서 차감되는 흐름으로 잡습니다).
                </li>
                <li>
                  <strong>
                    <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>
                  </strong>
                  는 <AccountingTerm termKey="손익">손익</AccountingTerm> 집계에서 빼고 싶을 때 켭니다. 개인과 별개로 설정할 수 있습니다.
                </li>
                <li>
                  월 작업이 끝나면{' '}
                  <strong>
                    <AccountingTerm termKey="명세잠금">명세 잠금</AccountingTerm>
                  </strong>
                  으로 해당 명세를 고정합니다.
                </li>
              </ol>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <h3 className="font-semibold text-slate-900">CSV 형식 안내</h3>
              <p className="leading-relaxed">
                첫 줄에 <strong>헤더</strong>가 있어야 합니다. 날짜 컬럼은 <code className="text-xs">Date</code>,{' '}
                <code className="text-xs">Transaction Date</code>, <code className="text-xs">Posted Date</code> 등으로
                인식하고, 금액은 <code className="text-xs">Amount</code> 또는 <code className="text-xs">Debit</code>/
                <code className="text-xs">Credit</code> 쌍으로 읽습니다. 은행마다 열 이름이 다르면, 내보내기 옵션에서
                “CSV” 또는 호환 형식을 선택하세요. 같은 명세를 두 번 넣으면 <strong>중복 키</strong>로 걸릴 수 있으니,
                기간·계정별로 한 번만 가져오는 것이 좋습니다.
              </p>
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-2">
              <h3 className="font-semibold text-slate-900">
                <AccountingTerm termKey="임시와확정">Temp / Posted</AccountingTerm>에 대해
              </h3>
              <p className="leading-relaxed">
                영수증만 올라간 지출은 아직 명세와 연결되지 않았을 수 있습니다. 이 탭에서는{' '}
                <strong>명세 라인 ↔ 기존 지출</strong>이 연결되면 그 줄은 사실상 “대조됨(Posted에 가까움)”으로 보시면
                됩니다. 명세에 없는 지출은 다음 달 청구에 나오거나 누락 여부를 따로 확인해야 합니다.
              </p>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex gap-2 text-amber-950">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">
                  <AccountingTerm termKey="이중계상">이중 계상</AccountingTerm> 주의
                </p>
                <p className="leading-relaxed">
                  카드 승인 건은 이미 지출 테이블에 비용으로 잡혔을 수 있습니다. <strong>은행에서 카드 대금만 이체한
                  줄</strong>은 비용이 아니라 <strong>현금 ↔ 카드 <AccountingTerm termKey="미지급">미지급</AccountingTerm></strong>{' '}
                  이동입니다. 그 <AccountingTerm termKey="출금">출금</AccountingTerm>을 다시 비용으로 넣지 마세요. 필요하면 상단 버튼{' '}
                  <strong>
                    <AccountingTerm termKey="카드대금이체">카드 대금 이체</AccountingTerm>{' '}
                    <AccountingTerm termKey="분개">분개</AccountingTerm>
                  </strong>
                  로 장부만 맞출 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={securityModalOpen} onOpenChange={setSecurityModalOpen}>
        <DialogContent className="max-w-lg w-[calc(100vw-1.25rem)]">
          <DialogHeader className="text-left space-y-0">
            <DialogTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 shrink-0 text-slate-600" />
              보안 · 취급 주의 (은행·카드 명세)
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 pt-1">
            <p>
              이 화면은 <strong>Super</strong> 권한으로만 열립니다. 명세 CSV·거래 설명에는 <strong>카드 전체 번호, CVV, 계좌 비밀번호, OTP</strong>를
              붙여 넣지 마세요. 필요한 경우 마지막 4자리만 관리합니다.
            </p>
            <p>
              공용 PC·프로젝터 화면에서는 작업 후 <strong>로그아웃</strong>하고, 명세 파일은 메일·메신저로 무단 유출되지 않게 보관합니다.
            </p>
            <p className="text-slate-600">
              데이터 전송은 앱과 Supabase 간 HTTPS로 이루어집니다. 조직 정책에 따라 주기적으로 명세 잠금·권한 검토를 권장합니다.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={accountsModalOpen} onOpenChange={setAccountsModalOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1.25rem)] max-h-[min(92vh,800px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-gray-100 shrink-0 text-left space-y-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <DialogTitle className="text-base sm:text-lg flex flex-wrap items-center gap-x-2 gap-y-1 pr-2">
                <Building2 className="h-5 w-5 shrink-0" />
                <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                <span className="font-normal text-gray-600">(은행·카드 레지스터)</span>
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => loadAccounts()}
                title="금융 계정 목록 새로고침"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-3">
            {accountsListError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
                {accountsListError}
              </div>
            )}
            {accountActionError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {accountActionError}
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <input
                className="border rounded px-3 py-2 text-sm w-full sm:min-w-[200px] sm:max-w-md"
                placeholder="이름 (예: Chase 회사 체크)"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
              <select
                className="border rounded px-3 py-2 text-sm"
                value={newAccountType}
                onChange={(e) => setNewAccountType(e.target.value as 'bank' | 'credit_card')}
              >
                <option value="credit_card">신용카드</option>
                <option value="bank">은행</option>
              </select>
              <Button type="button" size="sm" onClick={createAccount} disabled={loading}>
                <Plus className="h-4 w-4 mr-1" />
                추가
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              같은 유형(은행/신용카드) 안에서는 이름이 겹치면 추가할 수 없습니다. 이미 만들어 둔 줄이 있으면 목록에서 확인하세요.
            </p>
            <ul className="text-sm text-gray-600 divide-y border-t border-gray-100">
              {accounts.map((a) => (
                <li key={a.id} className="py-1 flex justify-between">
                  <span>{a.name}</span>
                  <span className="text-gray-400">{a.account_type}</span>
                </li>
              ))}
              {accounts.length === 0 && <li className="text-gray-400 py-2">등록된 계정 없음</li>}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={csvImportModalOpen} onOpenChange={setCsvImportModalOpen}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1.25rem)] max-h-[min(92vh,860px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-gray-100 shrink-0 text-left space-y-0">
            <DialogTitle className="text-base sm:text-lg flex flex-wrap items-center gap-x-2 gap-y-1">
              <Upload className="h-5 w-5 shrink-0" />
              <AccountingTerm termKey="명세">명세</AccountingTerm> CSV 가져오기
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-3">
            {!canMutateStatementUploads && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                CSV 업로드·가져오기는 <strong>info@maniatour.com</strong> 관리자 계정만 사용할 수 있습니다. (조회·대조는
                그대로 가능합니다.)
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                <select
                  className="mt-1 border rounded px-3 py-2 w-full disabled:opacity-50"
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(e.target.value)}
                  disabled={!canMutateStatementUploads}
                >
                  <option value="">선택</option>
                  {accountsForReconciliation.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                기간 시작
                <input
                  type="date"
                  className="mt-1 border rounded px-3 py-2 w-full disabled:opacity-50"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  disabled={!canMutateStatementUploads}
                />
              </label>
              <label className="text-sm">
                기간 종료
                <input
                  type="date"
                  className="mt-1 border rounded px-3 py-2 w-full disabled:opacity-50"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  disabled={!canMutateStatementUploads}
                />
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-700 block">CSV 파일</label>
              <input
                ref={csvImportFileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
                className="sr-only"
                tabIndex={-1}
                onChange={handleCsvImportFileChange}
                disabled={!canMutateStatementUploads}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canMutateStatementUploads || loading}
                  onClick={() => csvImportFileInputRef.current?.click()}
                >
                  파일 선택
                </Button>
                {csvImportFileName ? (
                  <span className="text-xs text-slate-600 truncate max-w-[min(100%,18rem)]" title={csvImportFileName}>
                    선택됨: {csvImportFileName}
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">또는 아래에 내용을 붙여 넣으세요.</span>
                )}
              </div>
            </div>
            <textarea
              className="w-full border rounded p-3 font-mono text-xs min-h-[160px] disabled:opacity-50"
              placeholder="CSV 내용 붙여넣기 또는 위에서 파일 선택…"
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value)
                setCsvImportFileName(null)
              }}
              disabled={!canMutateStatementUploads}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={importCsv}
                disabled={loading || !canMutateStatementUploads}
              >
                {loading ? '처리 중…' : '가져오기'}
              </Button>
            </div>
            {importCsvFeedback && (
              <div
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                role="status"
              >
                {importCsvFeedback}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentLinkModalOpen}
        onOpenChange={(open) => {
          setPaymentLinkModalOpen(open)
          if (!open) setPaymentLinkDirty(false)
        }}
      >
        <DialogContent className="max-w-5xl w-[calc(100vw-1.25rem)] p-0 gap-0 flex flex-col max-h-[min(92vh,920px)] sm:max-h-[90vh]">
          <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-gray-100 shrink-0 text-left space-y-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle className="text-base sm:text-lg pr-2">
                <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  <AccountingTerm termKey="결제수단">결제수단</AccountingTerm>
                  <span className="font-normal text-gray-600">↔</span>
                  <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                  <span className="font-normal text-gray-600">연결</span>
                </span>
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setPaymentLinkDirty(false)
                  void loadPaymentMethods()
                }}
                title="목록 새로고침 (서버 기준으로 다시 불러와 선택 초기화)"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
            <p className="text-xs text-gray-500 mb-3">
              직원 카드·계좌는{' '}
              <Link
                href={`/${locale}/admin/payment-methods`}
                className="text-blue-600 underline hover:text-blue-800"
                onClick={() => setPaymentLinkModalOpen(false)}
              >
                결제 방법 관리
              </Link>
              에서 등록합니다. 가이드 이름은 팀 테이블 기준, 메모는 결제수단 메모입니다. 각 행에서 금융 계정을 고른 뒤{' '}
              <strong>아래 저장</strong>을 누르면 한꺼번에 반영됩니다.
            </p>
            {paymentMethodsError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 mb-3">
                {paymentMethodsError}
              </div>
            )}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-3">카드/방법</th>
                    <th className="py-2 pr-3 min-w-[7rem]">가이드(이름)</th>
                    <th className="py-2 pr-3 min-w-[10rem]">메모</th>
                    <th className="py-2 pr-2 whitespace-nowrap">끝 4자리</th>
                    <th className="py-2 min-w-[14rem]">
                      <AccountingTerm termKey="금융계정">금융 계정</AccountingTerm>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentMethods.length === 0 && !paymentMethodsError && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-600 text-sm">
                        등록된 결제수단이 없습니다.{' '}
                        <Link
                          href={`/${locale}/admin/payment-methods`}
                          className="text-blue-600 font-medium underline hover:text-blue-800"
                          onClick={() => setPaymentLinkModalOpen(false)}
                        >
                          결제 방법 관리
                        </Link>
                        에서 추가하세요.
                      </td>
                    </tr>
                  )}
                  {paymentMethods.map((pm) => {
                    const linked =
                      paymentLinkDraft[pm.id] !== undefined
                        ? paymentLinkDraft[pm.id]
                        : pm.financial_account_id ?? null
                    const label =
                      (pm.display_name && pm.display_name.trim()) ||
                      (pm.method && pm.method.trim()) ||
                      pm.id
                    const guidePrimary = pm.team?.name_ko?.trim() || pm.team?.name_en?.trim() || ''
                    const guideSub =
                      pm.team?.name_ko && pm.team?.name_en && pm.team.name_ko !== pm.team.name_en
                        ? pm.team.name_en
                        : ''
                    return (
                      <tr key={pm.id} className="border-b border-gray-100 align-top">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-gray-900">{label}</div>
                          {pm.method && pm.method !== label ? (
                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2" title={pm.method}>
                              {pm.method}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          {guidePrimary ? (
                            <>
                              <div className="font-medium text-gray-900">{guidePrimary}</div>
                              {guideSub ? (
                                <div className="text-xs text-gray-600">{guideSub}</div>
                              ) : null}
                              {pm.user_email ? (
                                <div className="text-xs text-gray-500 mt-0.5">{pm.user_email}</div>
                              ) : null}
                            </>
                          ) : pm.user_email ? (
                            <div className="text-xs text-gray-600">{pm.user_email}</div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 max-w-[18rem]">
                          {pm.notes?.trim() ? (
                            <div
                              className="text-xs text-gray-800 whitespace-pre-wrap break-words max-h-32 overflow-y-auto"
                              title={pm.notes}
                            >
                              {pm.notes}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2 tabular-nums">{pm.card_number_last4 || '—'}</td>
                        <td className="py-2">
                          {accounts.length === 0 ? (
                            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 max-w-[20rem]">
                              상단 <strong>금융 계정</strong>에서 먼저 추가한 뒤 연결할 수 있습니다.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-[22rem]">
                              <button
                                type="button"
                                disabled={savingPaymentLinks}
                                onClick={() => {
                                  if (linked == null) return
                                  setPaymentLinkDraft((prev) => ({ ...prev, [pm.id]: null }))
                                  setPaymentLinkDirty(true)
                                }}
                                className={`px-2 py-1 text-xs rounded-md border shrink-0 transition-colors disabled:opacity-50 ${
                                  linked == null
                                    ? 'bg-slate-700 text-white border-slate-700'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                없음
                              </button>
                              {accounts.map((a) => {
                                const selected = linked === a.id
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    disabled={savingPaymentLinks}
                                    onClick={() => {
                                      if (selected) return
                                      setPaymentLinkDraft((prev) => ({ ...prev, [pm.id]: a.id }))
                                      setPaymentLinkDirty(true)
                                    }}
                                    className={`px-2 py-1 text-xs rounded-md border max-w-[11rem] text-left truncate transition-colors disabled:opacity-50 ${
                                      selected
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50/80 hover:border-blue-300'
                                    }`}
                                    title={`${a.name} (${a.account_type})`}
                                  >
                                    <span className="block truncate">{a.name}</span>
                                  </button>
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
          </div>
          <div className="px-4 py-3 border-t border-gray-100 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/90">
            <p className="text-xs text-gray-600">
              {paymentLinkHasChanges ? (
                <span className="text-amber-800 font-medium">저장하지 않은 변경이 있습니다.</span>
              ) : (
                '변경 사항이 없거나 서버와 동일합니다.'
              )}
            </p>
            <Button
              type="button"
              className="shrink-0 w-full sm:w-auto"
              disabled={!paymentLinkHasChanges || savingPaymentLinks}
              onClick={() => void saveAllPaymentMethodLinks()}
            >
              {savingPaymentLinks ? '저장 중…' : '변경 사항 저장'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm text-emerald-950">금융 계정별 명세·대조 월 통계</h3>
            <p className="text-xs text-slate-600 mt-1">
              상단에서 선택한 <strong>금융 계정</strong> 한 줄만 표시합니다. 각 칸은{' '}
              <strong className="text-emerald-900">대조 완료(matched) / 업로드된 전체 줄</strong> 수입니다. 거래일(
              <code className="text-[11px] bg-white/80 px-1 rounded">posted_date</code>)이 해당 연·월에 속한 줄만
              집계합니다.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={coverageStatsLoading || !filterAccountId}
            onClick={() => void loadCoverageMonthStats()}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${coverageStatsLoading ? 'animate-spin' : ''}`} />
            통계 새로고침
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <label className="flex items-center gap-2">
            연도
            <select
              className="border rounded px-2 py-1 bg-white"
              value={coverageYear}
              onChange={(e) => setCoverageYear(e.target.value)}
            >
              {['2023', '2024', '2025', '2026', '2027'].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-slate-500">
            선택 계정: <strong className="text-slate-800">{selectedAccountLabel}</strong>
          </span>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="text-xs border border-emerald-200 bg-white w-full min-w-[640px]">
            <thead>
              <tr className="bg-emerald-100/80">
                <th className="border border-emerald-200 p-2 text-left min-w-[10rem]">금융 계정</th>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <th key={m} className="border border-emerald-200 p-1.5 text-center whitespace-nowrap min-w-[4.25rem]">
                    {m}월
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!filterAccountId || accountsForReconciliation.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-3 text-slate-500">
                    상단에서 금융 계정을 선택하세요. 계정이 없으면 «금융 계정»에서 추가하세요.
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className="border border-emerald-200 p-2 font-medium text-slate-900 align-top">
                    <span className="line-clamp-3" title={selectedAccountLabel}>
                      {selectedAccountLabel}
                    </span>
                  </td>
                  {coverageMonthStats.map((st, i) => (
                    <td
                      key={i}
                      className="border border-emerald-200 p-1.5 text-center align-middle tabular-nums font-medium text-slate-800"
                    >
                      {coverageStatsLoading ? (
                        <span className="text-slate-400">…</span>
                      ) : st.uploaded === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span title={`대조 완료 ${st.reconciled}건 / 업로드 ${st.uploaded}건`}>
                          {st.reconciled}/{st.uploaded}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-2 sm:p-3 space-y-2 sm:space-y-3">
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <h3 className="font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:text-base shrink-0">
              <Link2 className="h-5 w-5 shrink-0" />
              <AccountingTerm termKey="명세대조">명세 대조</AccountingTerm>
            </h3>
            <div className="flex flex-nowrap items-center justify-end gap-2 min-w-0 w-full sm:w-auto sm:max-w-none sm:ml-auto overflow-x-auto [scrollbar-width:thin] py-0.5">
              <div className="relative flex-1 min-w-[7.5rem] max-w-[min(100%,18rem)] shrink">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <input
                  type="search"
                  className="w-full border rounded py-1.5 pl-8 pr-8 text-sm h-9"
                  value={reconciliationSearchQuery}
                  onChange={(e) => setReconciliationSearchQuery(e.target.value)}
                  autoComplete="off"
                  aria-label="명세 대조 표 검색"
                />
                {reconciliationSearchQuery ? (
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-slate-100"
                    aria-label="검색어 지우기"
                    onClick={() => setReconciliationSearchQuery('')}
                  >
                    <span className="text-lg leading-none">&times;</span>
                  </button>
                ) : null}
              </div>
              <div className="shrink-0" title="거래일 기준 월 필터">
                <select
                  className="border rounded px-2 py-1.5 text-sm min-w-[7.5rem] bg-white h-9"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  aria-label="거래일 기준 월 필터"
                >
                  <option value="all">전체 기간</option>
                  {monthOptions.map((ym) => (
                    <option key={ym} value={ym}>
                      {ym}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 h-9 w-9 p-0"
                onClick={() => loadImports()}
                aria-label="명세 목록 새로고침"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer shrink-0 border rounded px-2.5 bg-slate-50 h-9 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={showOnlyUnmatchedLines}
                  onChange={(e) => setShowOnlyUnmatchedLines(e.target.checked)}
                />
                미대조만
              </label>
            </div>
          </div>
        </div>

        {filterAccountId && (
          <p className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
            <span>
              레지스터: <strong>{selectedAccountLabel}</strong>
            </span>
            <span>·</span>
            <span>
              DB 명세 업로드 <strong>{importsForAccount.length}</strong>건 합산 표시
            </span>
            {accountExpenseWindow && (
              <>
                <span>·</span>
                <span>
                  지출 후보 조회 구간 {accountExpenseWindow.period_start} ~ {accountExpenseWindow.period_end}
                </span>
              </>
            )}
            <span>·</span>
            <span>
              표시 중 지출 합계:{' '}
              <strong>${statementOutflowSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            </span>
            <span>·</span>
            <span>
              표시 중 수입 합계:{' '}
              <strong>${statementInflowSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
            </span>
            {showOnlyUnmatchedLines && (
              <>
                <span>·</span>
                <span className="text-amber-800 font-medium">필터: 미대조(unmatched)만 표시 중</span>
              </>
            )}
            {reconciliationSearchQuery.trim() ? (
              <>
                <span>·</span>
                <span className="text-slate-700">
                  검색: <strong className="font-medium">«{reconciliationSearchQuery.trim()}»</strong> (
                  {reconciliationTableLines.length}건)
                </span>
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={runAutoMatch}
            disabled={loading || !filterAccountId || !accountExpenseWindow}
          >
            <Wand2 className="h-4 w-4 mr-1" />
            <AccountingTerm termKey="자동매칭">자동 매칭</AccountingTerm>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={lockImport}
            disabled={loading || !lockTargetImport || !canMutateStatementUploads}
            title={
              !canMutateStatementUploads
                ? 'info@maniatour.com 계정만 잠글 수 있습니다.'
                : importsForAccount.length > 1
                  ? '가장 최근 명세 업로드(기간 종료일 기준) 한 건을 잠급니다.'
                  : undefined
            }
          >
            <Lock className="h-4 w-4 mr-1" />
            <AccountingTerm termKey="명세잠금">명세 잠금</AccountingTerm>
          </Button>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-3 min-w-0 xl:h-[min(78vh,780px)] xl:min-h-[22rem]">
          <div className="min-w-0 flex-1 flex flex-col min-h-0 xl:min-h-0">
          <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto -mx-1 px-1 sm:mx-0 sm:px-0 touch-pan-x rounded-md border border-slate-100/80 bg-white">
          <table className="w-full min-w-[1350px] text-[11px] leading-snug sm:text-xs sm:leading-snug table-fixed">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="px-1.5 py-1.5 align-middle w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]">
                  일자
                </th>
                <th className="px-1.5 py-1.5 text-right align-middle w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]">
                  지출
                </th>
                <th className="px-1.5 py-1.5 text-right align-middle w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]">
                  수입
                </th>
                <th className="px-1.5 py-1.5 min-w-[28rem] w-[28rem] max-w-[30rem] text-center align-middle">
                  설명
                </th>
                <th className="px-1.5 py-1.5 min-w-[28rem] w-[28rem] max-w-[30rem] align-middle">
                  <AccountingTerm termKey="매칭">매칭</AccountingTerm>
                </th>
                <th className="px-1.5 py-1.5 min-w-[7.5rem]">개인·파트너 / 제외</th>
                <th className="px-1.5 py-1.5 align-middle">동작</th>
              </tr>
            </thead>
            <tbody>
              {pagedReconciliationLines.map((line) => {
                const lineMs = matchesByLine.get(line.id) || []
                const expenseMatch = lineMs.find((m) =>
                  EXPENSE_TABLES.includes(m.source_table as (typeof EXPENSE_TABLES)[number])
                )
                const payMatches = lineMs.filter((m) => m.source_table === 'payment_records')
                const isOut = line.direction === 'outflow'
                const descShown = formatStatementLineDescription(line.description, line.merchant)
                const linkedExpenseOpt = expenseMatch
                  ? expenseOptionByKey.get(
                      `${expenseMatch.source_table}:${expenseMatch.source_id}`
                    )
                  : undefined
                return (
                  <tr
                    key={line.id}
                    className={`border-b border-gray-100 ${
                      isOut && dropTargetLineId === line.id ? 'bg-sky-50 ring-1 ring-inset ring-sky-300/80' : ''
                    }`}
                    onDragOver={
                      isOut
                        ? (e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'copy'
                            setDropTargetLineId(line.id)
                          }
                        : undefined
                    }
                    onDrop={
                      isOut
                        ? (e) => {
                            e.preventDefault()
                            setDropTargetLineId(null)
                            const raw = e.dataTransfer.getData(DRAG_MIME_EXPENSE)
                            if (!raw) return
                            try {
                              const parsed = JSON.parse(raw) as { source_table?: string; source_id?: string }
                              if (!parsed.source_table || !parsed.source_id) return
                              void saveExpenseSelection(
                                line,
                                `${parsed.source_table}:${parsed.source_id}`
                              )
                            } catch {
                              /* ignore */
                            }
                          }
                        : undefined
                    }
                  >
                    <td className="px-1.5 py-1.5 whitespace-nowrap tabular-nums align-middle w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]">
                      {line.posted_date}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-rose-800 align-middle w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]">
                      {isOut ? `$${Number(line.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums text-emerald-800 align-middle w-[6.75rem] min-w-[6.75rem] max-w-[6.75rem]">
                      {!isOut ? `$${Number(line.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-1.5 py-1.5 min-w-[28rem] w-[28rem] max-w-[30rem] align-middle text-center">
                      <div
                        className="line-clamp-2 break-words leading-snug min-w-0 text-center"
                        title={descShown}
                      >
                        {descShown}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 text-[10px] sm:text-[11px] space-y-0.5 min-w-[28rem] w-[28rem] max-w-[30rem] align-middle">
                      {isOut ? (
                        <div className="space-y-1 w-full min-w-0">
                          {expenseMatch ? (
                            <div className="rounded border border-slate-200 bg-slate-50/80 px-1.5 py-1">
                              <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <div className="flex min-w-0 flex-1 items-start gap-1 pr-0.5">
                                  <span
                                    className="mt-0.5 shrink-0"
                                    title={expenseSourceTableAriaLabel(expenseMatch.source_table)}
                                    aria-label={expenseSourceTableAriaLabel(expenseMatch.source_table)}
                                  >
                                    <ExpenseSourceTypeIcon sourceTable={expenseMatch.source_table} />
                                  </span>
                                  <div
                                    className="min-w-0 flex-1 text-[11px] leading-snug text-slate-800 line-clamp-2"
                                    title={
                                      linkedExpenseOpt
                                        ? `${formatExpenseSubmitOnUsMdY(linkedExpenseOpt.submit_on)} $${Number(linkedExpenseOpt.amount).toFixed(2)} ${linkedExpenseOpt.label}`
                                        : `${expenseMatch.source_table} · ${expenseMatch.source_id}`
                                    }
                                  >
                                    {linkedExpenseOpt ? (
                                      <>
                                        <span className="tabular-nums text-slate-700">
                                          {formatExpenseSubmitOnUsMdY(linkedExpenseOpt.submit_on)}
                                        </span>{' '}
                                        <span className="tabular-nums font-medium">
                                          ${Number(linkedExpenseOpt.amount).toFixed(2)}
                                        </span>{' '}
                                        <span className="break-words">{linkedExpenseOpt.label}</span>
                                      </>
                                    ) : (
                                      <span className="text-slate-600">
                                        {expenseMatch.source_table} · {expenseMatch.source_id.slice(0, 8)}…
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-6 w-6 shrink-0 p-0"
                                    disabled={loading}
                                    title="수정"
                                    aria-label="지출 연결 수정"
                                    onClick={() => {
                                      setExpensePickerQuery('')
                                      setExpensePickerLineId(line.id)
                                    }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                    disabled={loading}
                                    title="연결 해제"
                                    aria-label="연결 해제"
                                    onClick={() => void saveExpenseSelection(line, '')}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-1 border-t border-slate-200/60 pt-1 text-[11px] text-slate-500">
                                저장: {expenseMatch.matched_by ?? '—'} ·{' '}
                                {expenseMatch.matched_at
                                  ? new Date(expenseMatch.matched_at).toLocaleString()
                                  : ''}
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 w-full max-w-full text-[10px] sm:text-xs py-1"
                              disabled={loading}
                              onClick={() => {
                                setExpensePickerQuery('')
                                setExpensePickerLineId(line.id)
                              }}
                            >
                              지출 연결…
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {payMatches.map((pm) => (
                            <div
                              key={pm.id}
                              className="flex min-w-0 max-w-full items-center justify-between gap-1.5 rounded border border-emerald-200/80 bg-green-50/90 px-1.5 py-0.5"
                            >
                              <div className="min-w-0 flex-1 truncate text-[11px] text-green-900">
                                <span>입금 #{pm.source_id.slice(0, 8)}…</span>
                                <span className="ml-1 text-[10px] text-slate-600">{pm.matched_by ?? '—'}</span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 shrink-0 p-0 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                disabled={loading}
                                title="연결 제거"
                                aria-label="연결 제거"
                                onClick={() => removeMatchRow(line.id, pm.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 w-full max-w-full text-[10px] sm:text-xs py-1"
                            disabled={loading}
                            onClick={() => {
                              setPaymentPickerQuery('')
                              setPaymentPickerLineId(line.id)
                            }}
                          >
                            + 입금 기록 연결…
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <label className="flex items-center gap-1 text-[10px] sm:text-xs mb-0.5">
                        <input
                          type="checkbox"
                          checked={line.is_personal}
                          onChange={() => toggleLineFlags(line, 'is_personal')}
                        />
                        개인
                      </label>
                      {line.is_personal && isOut && (
                        <select
                          className="border rounded px-1 py-0.5 text-xs w-full max-w-[9rem] mb-1"
                          value={line.personal_partner || ''}
                          onChange={(e) =>
                            setStatementPersonalPartner(
                              line,
                              e.target.value as 'partner1' | 'partner2' | 'erica' | ''
                            )
                          }
                          title="파트너 자금 관리에 반영할 당사자"
                        >
                          <option value="">파트너 선택</option>
                          {PERSONAL_PARTNER_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={line.exclude_from_pnl}
                          onChange={() => toggleLineFlags(line, 'exclude_from_pnl')}
                        />
                        <AccountingTerm termKey="PNL제외">PNL 제외</AccountingTerm>
                      </label>
                    </td>
                    <td className="px-1.5 py-1.5 align-middle">
                      {isOut && !expenseMatch && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] sm:text-xs py-1 px-2"
                          onClick={() => setAdjustModalLine(line)}
                        >
                          <AccountingTerm termKey="보정지출">보정 지출</AccountingTerm>
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filterAccountId && reconciliationTableLines.length > RECONCILIATION_PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 px-1 text-[11px] text-gray-600 border-t border-gray-100 bg-slate-50/50">
              <span>
                표시 중{' '}
                <strong>
                  {(reconciliationPage - 1) * RECONCILIATION_PAGE_SIZE + 1}–
                  {Math.min(reconciliationPage * RECONCILIATION_PAGE_SIZE, reconciliationTableLines.length)}
                </strong>
                건 / 전체 <strong>{reconciliationTableLines.length}</strong>건 · 쪽{' '}
                <strong>
                  {reconciliationPage}/{reconciliationPageCount}
                </strong>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reconciliationPage <= 1}
                  onClick={() => setReconciliationPage((p) => Math.max(1, p - 1))}
                >
                  이전
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reconciliationPage >= reconciliationPageCount}
                  onClick={() => setReconciliationPage((p) => Math.min(reconciliationPageCount, p + 1))}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
          {filterAccountId && reconciliationTableLines.length === 0 && (
            <p className="text-xs text-gray-500 py-3">
              {lines.length === 0
                ? '라인 없음'
                : reconciliationLinesBeforeSearch.length === 0
                  ? showOnlyUnmatchedLines
                    ? '이 조건에서 미대조 거래가 없습니다. 필터를 끄거나 월을 바꿔 보세요.'
                    : selectedMonth !== 'all'
                      ? '선택한 월에 해당하는 거래가 없습니다.'
                      : '표시할 거래가 없습니다.'
                  : reconciliationSearchQuery.trim()
                    ? '검색 결과가 없습니다. 검색어를 바꾸거나 지워 보세요.'
                    : '표시할 거래가 없습니다.'}
            </p>
          )}
          </div>
          </div>

          <aside className="flex flex-col min-h-0 w-full shrink-0 rounded-lg border border-slate-200 bg-slate-50/90 p-2 shadow-sm xl:h-full xl:min-h-0 xl:w-[min(100%,28rem)] xl:max-w-[30rem]">
            <div className="flex items-start gap-2 border-b border-slate-200/80 pb-1.5 mb-1.5 shrink-0">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <h4 className="text-[11px] font-semibold text-slate-800 leading-tight">미매칭 지출</h4>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                  {unmatchedPanelListScope === 'unmatched' ? (
                    <>
                      선택 명세 기간(±7일) 내 회사·투어·예약·입장권 지출 중 아직 명세와 연결되지 않은 항목입니다. 행을{' '}
                      <strong>드래그</strong>해 왼쪽 표의 <strong>출금</strong> 줄에 놓으면 매칭됩니다.
                    </>
                  ) : (
                    <>
                      같은 기간의 회사·투어·예약·입장권 지출 <strong>전체</strong>입니다. 이미 명세와 연결된 행은{' '}
                      <strong className="text-emerald-800">연결됨</strong>으로 표시되며 드래그할 수 없습니다. 미연결 행만
                      드래그해 출금 줄에 놓을 수 있습니다.
                    </>
                  )}
                </p>
              </div>
            </div>
            {!filterAccountId ? (
              <p className="text-xs text-slate-500 py-2">상단에서 금융 계정을 선택하면 목록이 표시됩니다.</p>
            ) : matchedExpenseKeysLoading && expenseOptions.length > 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">매칭 여부 확인 중…</p>
            ) : unmatchedExpensePanelRows.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                {expenseOptions.length === 0
                  ? '이 기간에 불러온 지출 후보가 없습니다.'
                  : unmatchedPanelListScope === 'all'
                    ? '금액이 0이 아닌 지출이 없습니다.'
                    : '미매칭 지출이 없습니다. (모두 연결됨)'}
              </p>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 gap-2">
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 min-w-0">
                  <select
                    aria-label="목록 범위"
                    className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white min-w-0 shrink-0 max-w-[min(100%,10.5rem)]"
                    value={unmatchedPanelListScope}
                    onChange={(e) =>
                      setUnmatchedPanelListScope(e.target.value as 'unmatched' | 'all')
                    }
                  >
                    <option value="unmatched">미매칭만</option>
                    <option value="all">전체 (연결됨 포함)</option>
                  </select>
                  <select
                    aria-label="일자 정렬"
                    className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white min-w-0 shrink-0 max-w-[min(100%,11rem)]"
                    value={unmatchedPanelSortDate}
                    onChange={(e) => setUnmatchedPanelSortDate(e.target.value as 'desc' | 'asc')}
                  >
                    <option value="desc">최신순 (일자 내림차순)</option>
                    <option value="asc">과거순 (일자 오름차순)</option>
                  </select>
                  <div className="relative min-w-0 flex-1 basis-[8rem]">
                    <Search
                      className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <input
                      type="search"
                      aria-label="미매칭 지출 검색"
                      className="w-full min-w-0 border border-slate-200 rounded py-1 pl-7 pr-7 text-[10px] bg-white"
                      placeholder="비고·금액·일자·유형·테이블·ID…"
                      value={unmatchedPanelSearch}
                      onChange={(e) => setUnmatchedPanelSearch(e.target.value)}
                      autoComplete="off"
                    />
                    {unmatchedPanelSearch.trim() ? (
                      <button
                        type="button"
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:bg-slate-100"
                        aria-label="검색어 지우기"
                        onClick={() => setUnmatchedPanelSearch('')}
                      >
                        <span className="text-sm leading-none">&times;</span>
                      </button>
                    ) : null}
                  </div>
                  <select
                    aria-label="지출 유형 필터"
                    className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white min-w-0 shrink-0 max-w-[min(100%,8.5rem)]"
                    value={unmatchedPanelSourceTableFilter}
                    onChange={(e) => setUnmatchedPanelSourceTableFilter(e.target.value)}
                  >
                    <option value="">전체 유형</option>
                    <option value="company_expenses">회사</option>
                    <option value="tour_expenses">투어</option>
                    <option value="reservation_expenses">예약</option>
                    <option value="ticket_bookings">입장권</option>
                  </select>
                  <select
                    aria-label="결제방법 필터"
                    className="border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white min-w-0 shrink-0 max-w-[min(100%,10rem)]"
                    value={unmatchedPanelPaymentMethodFilter}
                    onChange={(e) => setUnmatchedPanelPaymentMethodFilter(e.target.value)}
                  >
                    <option value="">전체</option>
                    {unmatchedPanelPaymentFilterOptions.hasNone ? (
                      <option value="__none__">미지정</option>
                    ) : null}
                    {unmatchedPanelPaymentFilterOptions.entries.map(([id, lab]) => (
                      <option key={id} value={id}>
                        {lab}
                      </option>
                    ))}
                  </select>
                </div>
                {unmatchedExpensePanelFilteredRows.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">
                    {unmatchedExpensePanelSourceFilteredRows.length === 0
                      ? unmatchedPanelSourceTableFilter
                        ? unmatchedPanelListScope === 'all'
                          ? '선택한 유형의 지출이 없습니다.'
                          : '선택한 유형의 미매칭 지출이 없습니다.'
                        : '필터에 맞는 지출이 없습니다.'
                      : unmatchedExpensePanelPaymentFilteredRows.length === 0
                        ? '결제방법 필터에 맞는 지출이 없습니다.'
                        : '검색 결과가 없습니다. 검색어를 바꾸거나 지워 보세요.'}
                  </p>
                ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-0.5 px-0.5">
                <table className="w-full text-[10px] sm:text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1 pr-1 w-6" aria-hidden />
                      <th className="py-1 pr-1 font-medium">일자</th>
                      <th className="py-1 pr-1 font-medium text-right whitespace-nowrap">금액</th>
                      <th className="py-1 pr-1 font-medium min-w-[4.5rem] max-w-[7rem]">결제방법</th>
                      <th className="py-1 font-medium min-w-0">비고</th>
                      <th className="py-1 w-8 text-center font-medium">편집</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedExpensePanelFilteredRows.slice(0, 250).map((o) => {
                      const pmLabel = paymentMethodLabelFromRows(o.payment_method, paymentMethods)
                      const isLinkedToStatement =
                        unmatchedPanelListScope === 'all' &&
                        matchedExpenseKeysInDb.has(expenseKey(o.source_table, o.source_id))
                      return (
                      <tr
                        key={`${o.source_table}:${o.source_id}`}
                        draggable={!isLinkedToStatement}
                        onDragStart={
                          isLinkedToStatement
                            ? undefined
                            : (e) => {
                                e.dataTransfer.setData(
                                  DRAG_MIME_EXPENSE,
                                  JSON.stringify({
                                    source_table: o.source_table,
                                    source_id: o.source_id
                                  })
                                )
                                e.dataTransfer.effectAllowed = 'copy'
                              }
                        }
                        title={
                          isLinkedToStatement
                            ? '이미 명세와 연결된 지출입니다. 드래그할 수 없습니다.'
                            : undefined
                        }
                        className={`border-b border-slate-100/90 ${
                          isLinkedToStatement
                            ? 'bg-slate-100/40 opacity-90 cursor-default'
                            : 'hover:bg-white cursor-grab active:cursor-grabbing'
                        }`}
                      >
                        <td className="py-1 pr-1 align-middle">
                          <ExpenseSourceTypeIcon sourceTable={o.source_table} className="h-3.5 w-3.5" />
                        </td>
                        <td className="py-1 pr-1 align-top tabular-nums text-slate-700 whitespace-nowrap">
                          {formatExpenseSubmitOnUsMdY(o.submit_on)}
                        </td>
                        <td className="py-1 pr-1 align-top text-right tabular-nums font-medium text-slate-900 whitespace-nowrap">
                          ${o.amount.toFixed(2)}
                        </td>
                        <td
                          className="py-1 pr-1 align-top text-slate-600 line-clamp-2 break-words min-w-0 max-w-[7rem]"
                          title={pmLabel}
                        >
                          {pmLabel}
                        </td>
                        <td className="py-1 align-top text-slate-700 min-w-0" title={o.label}>
                          <div className="flex items-start gap-1 min-w-0">
                            {isLinkedToStatement ? (
                              <span className="shrink-0 text-[9px] font-medium text-emerald-900 bg-emerald-100/90 px-1 py-px rounded">
                                연결됨
                              </span>
                            ) : null}
                            <span className="line-clamp-2 break-words min-w-0">{o.label}</span>
                          </div>
                        </td>
                        <td className="py-1 align-middle text-center w-8">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            title="수정"
                            aria-label="지출 수정"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              setUnmatchedEditOption(o)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
                {unmatchedExpensePanelFilteredRows.length > 250 ? (
                  <p className="text-[10px] text-slate-500 pt-1">상위 250건만 표시합니다.</p>
                ) : null}
              </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </section>

      <Dialog
        open={Boolean(unmatchedEditOption)}
        onOpenChange={(open) => {
          if (!open) setUnmatchedEditOption(null)
        }}
      >
        <DialogContent className="max-w-md w-[calc(100vw-1.25rem)] max-h-[min(88vh,520px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left">
            <DialogTitle className="text-base">미매칭 지출 수정</DialogTitle>
          </DialogHeader>
          {unmatchedEditOption ? (
            <div className="flex flex-col flex-1 min-h-0 gap-3 px-4 py-3 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                <ExpenseSourceTypeIcon sourceTable={unmatchedEditOption.source_table} className="h-4 w-4" />
                <span>{expenseSourceTableAriaLabel(unmatchedEditOption.source_table)}</span>
                <code className="text-[10px] bg-slate-100 px-1 rounded max-w-full truncate">
                  {unmatchedEditOption.source_id}
                </code>
              </div>
              {unmatchedEditLoading ? (
                <p className="text-sm text-slate-500 py-4">불러오는 중…</p>
              ) : unmatchedEditOption.source_table === 'ticket_bookings' ? (
                <div className="space-y-3 text-sm">
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">카테고리</span>
                    <input
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditCategory}
                      onChange={(e) => setUnmatchedEditCategory(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">공급업체</span>
                    <input
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditCompany}
                      onChange={(e) => setUnmatchedEditCompany(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">비용 (USD)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded px-2 py-2 tabular-nums"
                      value={unmatchedEditAmount}
                      onChange={(e) => setUnmatchedEditAmount(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">제출 일시</span>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditSubmitOn}
                      onChange={(e) => setUnmatchedEditSubmitOn(e.target.value)}
                    />
                  </label>
                </div>
              ) : unmatchedEditOption.source_table === 'tour_expenses' ? (
                <div className="space-y-3 text-sm">
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">결제내용 (paid_for)</span>
                    <input
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditPaidFor}
                      onChange={(e) => setUnmatchedEditPaidFor(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">결제처 (paid_to)</span>
                    <input
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditPaidTo}
                      onChange={(e) => setUnmatchedEditPaidTo(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">금액 (USD)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded px-2 py-2 tabular-nums"
                      value={unmatchedEditAmount}
                      onChange={(e) => setUnmatchedEditAmount(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">투어 날짜</span>
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditTourDate}
                      onChange={(e) => setUnmatchedEditTourDate(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">제출 일시</span>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditSubmitOn}
                      onChange={(e) => setUnmatchedEditSubmitOn(e.target.value)}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">결제내용 (paid_for)</span>
                    <input
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditPaidFor}
                      onChange={(e) => setUnmatchedEditPaidFor(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">결제처 (paid_to)</span>
                    <input
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditPaidTo}
                      onChange={(e) => setUnmatchedEditPaidTo(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">금액 (USD)</span>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full border rounded px-2 py-2 tabular-nums"
                      value={unmatchedEditAmount}
                      onChange={(e) => setUnmatchedEditAmount(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-slate-600">제출 일시</span>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-2"
                      value={unmatchedEditSubmitOn}
                      onChange={(e) => setUnmatchedEditSubmitOn(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={unmatchedEditSaving}
                  onClick={() => setUnmatchedEditOption(null)}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  disabled={unmatchedEditLoading || unmatchedEditSaving}
                  onClick={() => void saveUnmatchedExpenseEdit()}
                >
                  {unmatchedEditSaving ? '저장 중…' : '저장'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(expensePickerLine && expensePickerLine.direction === 'outflow')}
        onOpenChange={(open) => {
          if (!open) {
            setExpensePickerLineId(null)
            setExpensePickerQuery('')
            setExpensePickerBrowseTable(null)
            setExpensePickerBrowsePage(0)
            setExpensePickerBrowseRows([])
            setExpensePickerBrowseHasMore(false)
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[calc(100vw-1.25rem)] max-h-[min(92vh,820px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left">
            <DialogTitle className="text-base">회사/투어/예약/입장권 지출 연결</DialogTitle>
          </DialogHeader>
          {expensePickerLine ? (
            <div className="flex flex-col flex-1 min-h-0 gap-3 px-4 py-3 overflow-y-auto">
              <p className="text-xs text-slate-600 break-words">
                명세 <strong>{expensePickerLine.posted_date}</strong> · 출금{' '}
                <strong>${Number(expensePickerLine.amount).toFixed(2)}</strong>
              </p>
              <label className="text-xs text-slate-600 block space-y-1">
                검색 ({PICKER_SEARCH_MIN_CHARS}자 이상 — 설명·금액·일자·ID)
                <input
                  className="w-full border rounded px-2 py-2 text-sm"
                  value={expensePickerQuery}
                  onChange={(e) => setExpensePickerQuery(e.target.value)}
                  autoFocus
                />
              </label>
              <div>
                <div className="text-xs font-medium text-slate-700 mb-0.5">
                  금액 일치·근접 후보 (최대 {PICKER_QUICK_MAX})
                </div>
                {expensePickerQuick.mode === 'similar' ? (
                  <p className="text-[11px] text-slate-500 mb-1">
                    같은 금액이 없어 명세일 ±{PICKER_QUICK_DATE_WINDOW_DAYS}일 안, 유사 금액 후보를 표시합니다.
                  </p>
                ) : null}
                <div className="max-h-[min(28vh,280px)] overflow-y-auto border rounded divide-y divide-slate-100 bg-white">
                  {expensePickerQuick.list.length === 0 ? (
                    <div className="p-3 text-slate-500 text-sm">
                      금액 일치 및 명세일 ±{PICKER_QUICK_DATE_WINDOW_DAYS}일·유사 금액 후보가 없습니다. 검색을
                      이용하세요.
                    </div>
                  ) : (
                    expensePickerQuick.list.map(({ o, blockedElsewhere }) => {
                      const otherLineId = blockedElsewhere
                        ? firstOtherStatementLineIdForExpense(expensePickerLine!.id, o, expenseKeyToLineIds)
                        : null
                      const blockedTitle = blockedElsewhere
                        ? otherLineId
                          ? `이미 다른 명세 줄에 연결되어 있습니다. (명세 줄 id: ${otherLineId})`
                          : '이미 다른 명세 줄에 연결되어 있습니다.'
                        : undefined
                      return (
                        <button
                          key={`${o.source_table}:${o.source_id}`}
                          type="button"
                          disabled={loading || blockedElsewhere}
                          title={blockedTitle}
                          className={`w-full text-left px-2 py-2 text-sm flex flex-col items-start gap-0.5 border-l-2 ${
                            blockedElsewhere
                              ? 'border-amber-400 bg-amber-50/60 cursor-not-allowed opacity-90'
                              : 'border-transparent hover:bg-slate-50 disabled:opacity-50'
                          }`}
                          onClick={() => {
                            if (blockedElsewhere) return
                            setExpensePickerLineId(null)
                            setExpensePickerQuery('')
                            void saveExpenseSelection(expensePickerLine, `${o.source_table}:${o.source_id}`)
                          }}
                        >
                          <span className="flex flex-wrap items-center gap-1.5 w-full">
                            <span className={blockedElsewhere ? 'text-slate-600' : ''}>
                              {formatExpensePickerLineLabel(o)}
                            </span>
                            {blockedElsewhere ? (
                              <span className="text-[10px] font-medium text-amber-900 bg-amber-100 px-1.5 py-0 rounded shrink-0">
                                다른 명세에 연결됨
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            일자 {formatExpenseOptionSubmitDate(o)}
                          </span>
                          <span
                            className="text-[10px] text-slate-400 font-mono break-all w-full"
                            title={`${o.source_table}:${o.source_id}`}
                          >
                            {o.source_table}:{o.source_id}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="text-xs font-medium text-slate-700">
                  테이블에서 직접 선택
                  <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                    위 명세 줄 거래일 <strong className="text-slate-700">{expensePickerLinePostedYmd || '—'}</strong> 기준
                    ±7일(<span className="tabular-nums">submit_on</span>)만 조회합니다. 페이지당{' '}
                    {PICKER_BROWSE_PAGE_SIZE}건씩 불러옵니다.
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { t: 'company_expenses' as const, label: '회사' },
                      { t: 'tour_expenses' as const, label: '투어' },
                      { t: 'reservation_expenses' as const, label: '예약' },
                      { t: 'ticket_bookings' as const, label: '입장권' }
                    ] as const
                  ).map(({ t, label }) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={expensePickerBrowseTable === t ? 'secondary' : 'outline'}
                      className="text-xs"
                      disabled={loading || expensePickerLinePostedYmd.length < 10}
                      onClick={() => {
                        setExpensePickerBrowseTable(t)
                        setExpensePickerBrowsePage(0)
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {expensePickerLinePostedYmd.length < 10 ? (
                  <p className="text-[11px] text-amber-800">
                    명세 줄에 유효한 거래일(posted_date)이 없으면 이 목록을 불러올 수 없습니다.
                  </p>
                ) : expensePickerBrowseTable ? (
                  <div className="space-y-2">
                    {expensePickerBrowseLoading ? (
                      <p className="text-sm text-slate-500 py-2">목록 불러오는 중…</p>
                    ) : (
                      <div className="max-h-[min(36vh,320px)] overflow-auto border rounded border-slate-200 bg-white">
                        <table className="w-full text-left text-[11px] sm:text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                              <th className="px-2 py-1.5 w-8" aria-hidden />
                              <th className="px-2 py-1.5 min-w-[6rem] max-w-[7.5rem]">행 ID</th>
                              <th className="px-2 py-1.5">일자</th>
                              <th className="px-2 py-1.5 text-right whitespace-nowrap">금액</th>
                              <th className="px-2 py-1.5 min-w-[8rem]">비고</th>
                              <th className="px-2 py-1.5 w-[7.5rem] text-center">동작</th>
                            </tr>
                          </thead>
                          <tbody>
                            {expensePickerBrowseRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="px-2 py-4 text-slate-500 text-center">
                                  이 구간에 해당 지출이 없습니다.
                                </td>
                              </tr>
                            ) : (
                              expensePickerBrowseRows.map((o) => {
                                const canLink = expensePickerLine
                                  ? canPickExpenseKeysFast(expensePickerLine.id, o.source_table, o.source_id)
                                  : false
                                return (
                                  <tr key={`${o.source_table}:${o.source_id}`} className="border-b border-slate-100">
                                    <td className="px-2 py-1 align-middle">
                                      <ExpenseSourceTypeIcon sourceTable={o.source_table} className="h-3.5 w-3.5" />
                                    </td>
                                    <td
                                      className="px-1 py-1 font-mono text-[10px] text-slate-500 align-top max-w-[7.5rem] break-all"
                                      title={`${o.source_table}:${o.source_id}`}
                                    >
                                      {o.source_table}:{o.source_id}
                                    </td>
                                    <td className="px-2 py-1 tabular-nums text-slate-800 whitespace-nowrap">
                                      {formatExpenseSubmitOnUsMdY(o.submit_on)}
                                    </td>
                                    <td className="px-2 py-1 text-right tabular-nums font-medium">
                                      ${o.amount.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1 text-slate-700 min-w-0 max-w-[14rem]">
                                      <div className="line-clamp-2 break-words" title={o.label}>
                                        {o.label}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1">
                                      <div className="flex flex-wrap gap-1 justify-end">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="default"
                                          className="h-7 text-[10px] px-2"
                                          disabled={loading || !canLink}
                                          title={!canLink ? '다른 명세 줄에 이미 연결된 지출입니다.' : '이 명세 줄에 연결'}
                                          onClick={() => {
                                            if (!expensePickerLine) return
                                            setExpensePickerLineId(null)
                                            setExpensePickerQuery('')
                                            void saveExpenseSelection(
                                              expensePickerLine,
                                              `${o.source_table}:${o.source_id}`
                                            )
                                          }}
                                        >
                                          연결
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 w-7 p-0"
                                          title="수정"
                                          aria-label="수정"
                                          onClick={() => setUnmatchedEditOption(o)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={expensePickerBrowsePage <= 0 || expensePickerBrowseLoading}
                        onClick={() => setExpensePickerBrowsePage((p) => Math.max(0, p - 1))}
                      >
                        이전 페이지
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!expensePickerBrowseHasMore || expensePickerBrowseLoading}
                        onClick={() => setExpensePickerBrowsePage((p) => p + 1)}
                      >
                        다음 페이지
                      </Button>
                      <span>
                        페이지 <strong>{expensePickerBrowsePage + 1}</strong>
                        {expensePickerBrowseHasMore ? ' · 다음 있음' : ' · 마지막'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {deferredExpensePickerQuery.trim().length >= PICKER_SEARCH_MIN_CHARS ? (
                <div>
                  <div className="text-xs font-medium text-slate-700 mb-1">
                    검색 결과 (최대 {PICKER_SEARCH_MAX}건)
                  </div>
                  <div className="max-h-[min(28vh,280px)] overflow-y-auto border rounded divide-y divide-slate-100 bg-white">
                    {expensePickerSearchResults.length === 0 ? (
                      <div className="p-3 text-slate-500 text-sm">결과 없음</div>
                    ) : (
                      expensePickerSearchResults.map((o) => (
                        <button
                          key={`s:${o.source_table}:${o.source_id}`}
                          type="button"
                          disabled={loading}
                          className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 flex flex-col items-start gap-0.5"
                          onClick={() => {
                            setExpensePickerLineId(null)
                            setExpensePickerQuery('')
                            void saveExpenseSelection(expensePickerLine, `${o.source_table}:${o.source_id}`)
                          }}
                        >
                          <span>{formatExpensePickerLineLabel(o)}</span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            일자 {formatExpenseOptionSubmitDate(o)}
                          </span>
                          <span
                            className="text-[10px] text-slate-400 font-mono break-all w-full"
                            title={`${o.source_table}:${o.source_id}`}
                          >
                            {o.source_table}:{o.source_id}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {PICKER_SEARCH_MIN_CHARS}글자 이상 입력하면 전체 후보에서 검색합니다.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(paymentPickerLine && paymentPickerLine.direction !== 'outflow')}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentPickerLineId(null)
            setPaymentPickerQuery('')
          }
        }}
      >
        <DialogContent className="max-w-2xl w-[calc(100vw-1.25rem)] max-h-[min(90vh,760px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left">
            <DialogTitle className="text-base">입금 기록 연결</DialogTitle>
          </DialogHeader>
          {paymentPickerLine ? (
            <div className="flex flex-col flex-1 min-h-0 gap-3 px-4 py-3 overflow-y-auto">
              <p className="text-xs text-slate-600 break-words">
                명세 <strong>{paymentPickerLine.posted_date}</strong> · 수입{' '}
                <strong>${Number(paymentPickerLine.amount).toFixed(2)}</strong>
              </p>
              <label className="text-xs text-slate-600 block space-y-1">
                검색 ({PICKER_SEARCH_MIN_CHARS}자 이상 — 금액·일자·고객명·예약 ID·메모)
                <input
                  className="w-full border rounded px-2 py-2 text-sm"
                  value={paymentPickerQuery}
                  onChange={(e) => setPaymentPickerQuery(e.target.value)}
                  autoFocus
                />
              </label>
              <div>
                <div className="text-xs font-medium text-slate-700 mb-1">
                  금액 일치·근접 후보 (최대 {PICKER_QUICK_MAX})
                </div>
                <div className="max-h-[min(28vh,280px)] overflow-y-auto border rounded divide-y divide-slate-100 bg-white">
                  {paymentPickerQuickOptions.length === 0 ? (
                    <div className="p-3 text-slate-500 text-sm">
                      같은 금액 입금 후보가 없습니다. 검색을 이용하세요.
                    </div>
                  ) : (
                    paymentPickerQuickOptions.map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        disabled={loading}
                        className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                        onClick={() => {
                          setPaymentPickerLineId(null)
                          setPaymentPickerQuery('')
                          void addPaymentRecordMatch(paymentPickerLine, pr.id)
                        }}
                      >
                        ${pr.amount.toFixed(2)} ·{' '}
                        {paymentRecordPickerPartyLabel(pr, paymentPickerReservationCustomerNames)} ·{' '}
                        {pr.submit_on?.slice(0, 10)}
                        {pr.note ? ` · ${String(pr.note).slice(0, 40)}` : ''}
                      </button>
                    ))
                  )}
                </div>
              </div>
              {deferredPaymentPickerQuery.trim().length >= PICKER_SEARCH_MIN_CHARS ? (
                <div>
                  <div className="text-xs font-medium text-slate-700 mb-1">
                    검색 결과 (최대 {PICKER_SEARCH_MAX}건)
                  </div>
                  <div className="max-h-[min(28vh,280px)] overflow-y-auto border rounded divide-y divide-slate-100 bg-white">
                    {paymentPickerSearchResults.length === 0 ? (
                      <div className="p-3 text-slate-500 text-sm">결과 없음</div>
                    ) : (
                      paymentPickerSearchResults.map((pr) => (
                        <button
                          key={`s:${pr.id}`}
                          type="button"
                          disabled={loading}
                          className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                          onClick={() => {
                            setPaymentPickerLineId(null)
                            setPaymentPickerQuery('')
                            void addPaymentRecordMatch(paymentPickerLine, pr.id)
                          }}
                        >
                          ${pr.amount.toFixed(2)} ·{' '}
                          {paymentRecordPickerPartyLabel(pr, paymentPickerReservationCustomerNames)} ·{' '}
                          {pr.submit_on?.slice(0, 10)}
                          {pr.note ? ` · ${String(pr.note).slice(0, 40)}` : ''}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {PICKER_SEARCH_MIN_CHARS}글자 이상 입력하면 전체 후보에서 검색합니다.
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={journalModalOpen} onOpenChange={setJournalModalOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1.25rem)] max-h-[min(92vh,800px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-5 pb-3 pr-12 border-b border-gray-100 shrink-0 text-left space-y-0">
            <DialogTitle className="text-base sm:text-lg flex flex-wrap items-center gap-x-1 gap-y-1">
              <Receipt className="h-5 w-5 shrink-0 text-slate-600" />
              <AccountingTerm termKey="카드대금이체">카드 대금 이체</AccountingTerm>{' '}
              <AccountingTerm termKey="분개">분개</AccountingTerm>
              <span className="font-normal text-gray-600 text-sm">(선택)</span>
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
            <CardPaymentJournalSection accounts={accounts} email={email} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CardPaymentJournalSection({
  accounts,
  email
}: {
  accounts: FinancialAccount[]
  email: string
}) {
  const [bankId, setBankId] = useState('')
  const [cardId, setCardId] = useState('')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('카드 대금 납부')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    const amt = parseFloat(amount)
    if (!bankId || !cardId || !Number.isFinite(amt) || amt <= 0) {
      setMsg('은행·카드 계정과 금액을 확인하세요.')
      return
    }
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/financial/journal/card-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryDate,
          memo,
          bankFinancialAccountId: bankId,
          cardFinancialAccountId: cardId,
          amount: amt,
          createdBy: email || null
        })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '실패')
      setMsg(`분개 저장됨: ${j.journal_entry_id}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }

  const banks = accounts.filter((a) => a.account_type === 'bank')
  const cards = accounts.filter((a) => a.account_type === 'credit_card')

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        은행에서 신용카드 <AccountingTerm termKey="청구서">청구액</AccountingTerm>을 지불한 경우 비용이 아니라{' '}
        <AccountingTerm termKey="부채">부채</AccountingTerm>·현금 이동으로 기록합니다.{' '}
        <AccountingTerm termKey="차변">차변</AccountingTerm> 카드(
        <AccountingTerm termKey="미지급">미지급</AccountingTerm> 감소), <AccountingTerm termKey="대변">대변</AccountingTerm>{' '}
        은행.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <label>
          <AccountingTerm termKey="은행계정">은행 계정</AccountingTerm>
          <select
            className="mt-1 border rounded px-2 py-1 w-full"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
          >
            <option value="">선택</option>
            {banks.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <AccountingTerm termKey="카드계정">카드 계정</AccountingTerm>(
          <AccountingTerm termKey="미지급">미지급</AccountingTerm>)
          <select
            className="mt-1 border rounded px-2 py-1 w-full"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
          >
            <option value="">선택</option>
            {cards.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          금액
          <input
            type="number"
            step="0.01"
            className="mt-1 border rounded px-2 py-1 w-full"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          거래일
          <input
            type="date"
            className="mt-1 border rounded px-2 py-1 w-full"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </label>
      </div>
      <input
        className="border rounded px-2 py-1 w-full max-w-lg text-sm"
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모"
      />
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
      <Button type="button" onClick={submit} disabled={loading}>
        <AccountingTerm termKey="분개">분개</AccountingTerm> 저장
      </Button>
    </div>
  )
}
