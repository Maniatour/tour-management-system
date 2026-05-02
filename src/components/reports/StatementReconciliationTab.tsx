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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Link2,
  Lock,
  MapPinned,
  Pencil,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  Tag,
  Ticket,
  Upload,
  UserRound,
  Wand2,
  Plus,
  AlertCircle,
  BookOpen,
  GripVertical,
  ListPlus,
  Loader2,
  X
} from 'lucide-react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import { formatPaymentMethodDisplay } from '@/lib/paymentMethodDisplay'

/** getSession()은 세션 갱신·Strict Mode 등으로 Abort 되어 "signal is aborted"가 날 수 있음 — 저장된 JWT 우선 */
function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  const t = localStorage.getItem('sb-access-token')
  return t?.trim() ? t.trim() : null
}
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { AccountingTerm } from '@/components/ui/AccountingTerm'
import StatementAdjustmentExpenseModal from '@/components/reconciliation/StatementAdjustmentExpenseModal'
import StatementBulkExpenseModal from '@/components/reconciliation/StatementBulkExpenseModal'
import PaymentMethodFinancialAccountLinkModal from '@/components/reconciliation/PaymentMethodFinancialAccountLinkModal'
import FinancialAccountLinkedCardsModal from '@/components/reconciliation/FinancialAccountLinkedCardsModal'
import {
  hashStatementCsvContent,
  makeDedupeKey,
  parseStatementCsvText,
  shouldInvertStatementCsvDirections,
  type StatementCsvDirectionMode
} from '@/lib/statement-csv'
import { formatStatementLineDescription } from '@/lib/statement-display'
import { type ExpenseCandidate } from '@/lib/reconciliation-engine'

type FinancialAccount = {
  id: string
  name: string
  account_type: string
  currency: string
  is_active: boolean
  /** 명세 CSV: auto(레거시) | invert | no_invert — UI 에서는 invert/no_invert 로 확정 저장 권장 */
  statement_csv_direction_mode?: StatementCsvDirectionMode | string | null
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

/** CSV 가져오기 모달 — 미리보기 행 수 */
const CSV_IMPORT_PREVIEW_MAX = 5

function describeCsvImportInvertRule(account: FinancialAccount): {
  ruleLabel: string
  invertApplied: boolean
} {
  const mode = (account.statement_csv_direction_mode ?? 'auto') as string
  const invertApplied = shouldInvertStatementCsvDirections(
    account.account_type,
    account.statement_csv_direction_mode
  )
  let ruleLabel: string
  if (mode === 'invert') {
    ruleLabel = '항상 반전 (양수 = 지출)'
  } else if (mode === 'no_invert') {
    ruleLabel = '반전 안 함 (음수·괄호 = 지출)'
  } else {
    ruleLabel =
      account.account_type === 'credit_card'
        ? '자동 · 신용카드 (부호 반전 적용)'
        : '자동 · 은행·기타 (부호 반전 없음)'
  }
  return { ruleLabel, invertApplied }
}

type PaymentMethodRow = {
  id: string
  method: string
  display_name?: string | null
  card_holder_name?: string | null
  card_number_last4: string | null
  financial_account_id: string | null
  user_email?: string | null
  notes?: string | null
  team?: {
    email?: string
    name_ko?: string | null
    name_en?: string | null
    nick_name?: string | null
  } | null
}

type ReconciliationMatchRow = {
  id: string
  statement_line_id: string
  source_table: string
  source_id: string
  matched_by: string | null
  matched_at?: string
  updated_by?: string | null
  updated_at?: string | null
}

type ReconciliationMatchEventRow = {
  id: string
  match_id: string | null
  statement_line_id: string
  action: 'created' | 'updated' | 'deleted'
  actor_email: string | null
  occurred_at: string
  before_source_table: string | null
  before_source_id: string | null
  after_source_table: string | null
  after_source_id: string | null
  before_matched_amount: number | string | null
  after_matched_amount: number | string | null
}

type ExpenseOption = {
  source_table:
    | 'company_expenses'
    | 'tour_expenses'
    | 'reservation_expenses'
    | 'ticket_bookings'
    | 'tour_hotel_bookings'
  source_id: string
  label: string
  amount: number
  submit_on: string
  paid_to: string
  paid_for: string
  description: string | null
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
  'ticket_bookings',
  'tour_hotel_bookings'
] as const

type ReconciliationViewTab = 'statements' | 'operational-ledger'

type OperationalLedgerSourceTable =
  | 'reservation_expenses'
  | 'company_expenses'
  | 'payment_records'
  | 'ticket_bookings'
  | 'tour_hotel_bookings'

type OperationalLedgerRow = {
  key: string
  source_table: OperationalLedgerSourceTable
  source_id: string
  direction: 'outflow' | 'inflow'
  date: string
  amount: number
  party: string
  purpose: string
  note: string | null
  payment_method: string | null
  already_matched: boolean
}

type StatementLineCandidate = {
  id: string
  financial_account_id: string
  financial_account_name: string
  posted_date: string
  direction: string
  amount: number
  description: string
  matched_status: string
  score: number
  amount_diff: number
  day_diff: number
}

/** 자동 매칭 미리보기 행 — 확인 후 DB 저장 */
type AutoMatchCandidateOption = {
  key: string
  source_table: ExpenseCandidate['source_table']
  source_id: string
  expense_label: string
  expense_registered_date: string
  expense_amount: number
  expense_paid_to: string
  expense_paid_for: string
  expense_standard_paid_for: string | null
  score: number
  amount_diff: number
}

type AutoMatchProposalRow = {
  statement_line_id: string
  posted_date: string
  line_amount: number
  line_desc: string
  candidates: AutoMatchCandidateOption[]
}

type AutoMatchExpenseCandidate = ExpenseCandidate & {
  paid_to: string
  paid_for: string
  standard_paid_for: string | null
}

const AUTO_MATCH_SOURCE_LABEL: Record<ExpenseCandidate['source_table'], string> = {
  company_expenses: '회사 지출',
  tour_expenses: '투어 지출',
  reservation_expenses: '예약 지출',
  ticket_bookings: '입장권 부킹'
}

const OPERATIONAL_LEDGER_SOURCE_LABEL: Record<OperationalLedgerSourceTable, string> = {
  reservation_expenses: '예약',
  company_expenses: '회사',
  payment_records: '입금',
  ticket_bookings: '티켓',
  tour_hotel_bookings: '호텔 부킹'
}

const EXPENSE_SOURCE_FILTER_OPTIONS: { value: '' | ExpensePickerBrowseTable; label: string }[] = [
  { value: '', label: '전체' },
  { value: 'company_expenses', label: '회사' },
  { value: 'tour_expenses', label: '투어' },
  { value: 'reservation_expenses', label: '예약' },
  { value: 'ticket_bookings', label: '입장권' }
]

/** 한 페이지당 표시 행 수 — 행마다 무거운 UI가 있으면 DOM·레이아웃 비용이 커짐 */
const RECONCILIATION_PAGE_SIZE = 40
/** 운영 지출입 찾기 — 각 행 후보를 자동 조회하므로 페이지 단위로 제한 */
const OPERATIONAL_LEDGER_PAGE_SIZE = 20
/** 운영 지출입 찾기: reconciliation_matches source_id IN 조회 청크 */
const OPERATIONAL_LEDGER_MATCH_IN_CHUNK = 200
/** PostgREST 기본 max-rows(1000) — 단일 select로는 그 이후 행이 잘림 → range 순회 */
const STATEMENT_LINES_FETCH_PAGE = 1000
/** 대조 표에 쓰는 컬럼만 조회 (raw JSONB 제외로 전송·파싱 비용 대폭 감소) */
const STATEMENT_LINE_LIST_SELECT =
  'id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status,exclude_from_pnl,is_personal,personal_partner'
/** reconciliation_matches IN 쿼리 병렬도 (한꺼번에 너무 많이 열면 브라우저·API 한도 이슈) */
const RECON_MATCH_FETCH_PARALLEL = 12
/** 명세 import 청크별로 줄·매칭을 겹쳐 로드할 때 import id 묶음 크기 */
const STATEMENT_IMPORT_LINE_CHUNK = 40
/** 지출/입금 후보 모달: 금액 근접 후보 상한 (전체 옵션을 행×만큼 DOM에 두지 않음) */
const PICKER_QUICK_MAX = 120
const PICKER_SEARCH_MAX = 500
const PICKER_SEARCH_MIN_CHARS = 2
/** 금액 일치 후보가 없을 때: 명세 거래일 기준 ±일 안에서 유사 금액 지출을 채움 */
const PICKER_QUICK_DATE_WINDOW_DAYS = 21
/** 지출 연결 모달 — 테이블 탐색 시 페이지당 행 수 (다음 페이지 여부 판별용 +1건 조회) */
const PICKER_BROWSE_PAGE_SIZE = 40
/** 자동 매칭 미리보기: 한 명세 줄당 표시할 후보 수 */
const AUTO_MATCH_CANDIDATE_LIMIT = 8
/** 자동 매칭 미리보기: 한 번에 렌더링할 행 수(체크 토글 버벅임 완화) */
const AUTO_MATCH_PREVIEW_PAGE_SIZE = 120
/** 자동 매칭 미리보기: 명세 줄 금액과 같은 지출만 후보 (미리보기 옵션 표시와 동일한 부동소수 허용치) */
const AUTO_MATCH_AMOUNT_EQUAL_EPS = 0.015
const AUTO_MATCH_MAX_DAY_DIFF = 7
/** 계정별 명세 줄·매칭 메모리 캐시 TTL (짧게 유지해 DB 왕복만 완화) */
const RECONCILIATION_LOAD_CACHE_TTL_MS = 15000

function ymdToUtcDayNumber(raw: string): number {
  const s = String(raw ?? '').trim()
  const ymd = s.length >= 10 ? s.slice(0, 10) : s
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return Number.NaN
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const t = Date.UTC(y, mo - 1, d)
  if (Number.isNaN(t)) return Number.NaN
  return Math.floor(t / 86400000)
}

function dayDiffFromYmd(iso: string, ymd: string): number {
  const a = ymdToUtcDayNumber(iso)
  const b = ymdToUtcDayNumber(ymd)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.abs(a - b)
}

function autoMatchCandidateScore(lineAmount: number, postedDate: string, expense: AutoMatchExpenseCandidate) {
  const amountDiff = Math.abs(Number(expense.amount) - lineAmount)
  if (amountDiff >= AUTO_MATCH_AMOUNT_EQUAL_EPS) return null
  const dayDiff = dayDiffFromYmd(expense.occurred_at, postedDate)
  if (dayDiff > AUTO_MATCH_MAX_DAY_DIFF) return null
  const amountPenalty = 0
  const datePenalty = dayDiff * 5
  const labelBonus = expense.label.trim().length > 2 ? 5 : 0
  return Math.max(1, 100 - amountPenalty - datePenalty + labelBonus)
}

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
      .select(STATEMENT_LINE_LIST_SELECT)
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

/** 이미 로드한 명세 줄로 연도·import 집합 기준 월별 커버리지 (별도 DB 전량 스캔 생략) */
function aggregateCoverageMonthStatsFromLines(
  rows: StatementLine[],
  year: number,
  allowedImportIds: Set<string>
): { reconciled: number; uploaded: number }[] {
  const byMonth = Array.from({ length: 12 }, () => ({ reconciled: 0, uploaded: 0 }))
  if (!Number.isFinite(year) || allowedImportIds.size === 0) return byMonth
  for (const row of rows) {
    if (!allowedImportIds.has(row.statement_import_id)) continue
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
  return byMonth
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

/** statement_line_id 목록에 대한 reconciliation_matches (80건씩 IN, 물결 병렬) */
async function fetchReconciliationMatchesForLineIds(lineIds: string[]): Promise<ReconciliationMatchRow[]> {
  if (lineIds.length === 0) return []
  const idChunks: string[][] = []
  const chunkSize = 80
  for (let i = 0; i < lineIds.length; i += chunkSize) {
    idChunks.push(lineIds.slice(i, i + chunkSize))
  }
  const matchRows: ReconciliationMatchRow[] = []
  for (let w = 0; w < idChunks.length; w += RECON_MATCH_FETCH_PARALLEL) {
    const wave = idChunks.slice(w, w + RECON_MATCH_FETCH_PARALLEL)
    try {
      const results = await Promise.all(
        wave.map(async (chunk) => {
          const { data: matchData, error: e2 } = await supabase
            .from('reconciliation_matches')
            .select('id,statement_line_id,source_table,source_id,matched_by,matched_at,updated_by,updated_at')
            .in('statement_line_id', chunk)
          if (e2) {
            if (!isAbortLikeError(e2)) console.error(e2)
            throw e2
          }
          return (matchData as ReconciliationMatchRow[]) || []
        })
      )
      for (const part of results) matchRows.push(...part)
    } catch {
      break
    }
  }
  return matchRows
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

/** YYYY-MM-DD 로컬 달력 기준 일수 가감 */
function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const core = ymd.trim().slice(0, 10)
  const parts = core.split('-').map((x) => parseInt(x, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return core
  const [yy, mm, dd] = parts
  const d = new Date(yy, mm - 1, dd)
  if (Number.isNaN(d.getTime())) return core
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 명세 줄 posted_date → 비교용 YYYY-MM-DD (10자 미만이면 범위 필터에서 제외) */
function statementLinePostedYmd(line: { posted_date?: string | null }): string {
  const raw = String(line.posted_date ?? '').trim()
  return raw.length >= 10 ? raw.slice(0, 10) : ''
}

function paymentMethodLabelFromRows(id: string | null | undefined, rows: PaymentMethodRow[]): string {
  const raw = id?.trim()
  if (!raw) return '—'
  const pm = rows.find((p) => p.id === raw)
  if (!pm) return raw.length > 14 ? `${raw.slice(0, 10)}…` : raw
  const formatted = formatPaymentMethodDisplay(
    {
      id: pm.id,
      method: pm.method,
      display_name: pm.display_name ?? null,
      user_email: pm.user_email ?? null,
      card_holder_name: pm.card_holder_name ?? null,
    },
    pm.team
      ? {
          nick_name: pm.team.nick_name ?? null,
          name_en: pm.team.name_en ?? null,
          name_ko: pm.team.name_ko ?? null,
        }
      : undefined
  )
  if (!pm.card_number_last4) return formatted
  return `${formatted} ·${pm.card_number_last4}`
}

function recordToExpenseOption(
  table: ExpenseOption['source_table'],
  r: Record<string, unknown>
): ExpenseOption {
  const pm = expensePaymentMethodFromRow(r)
  if (table === 'tour_hotel_bookings') {
    return {
      source_table: 'tour_hotel_bookings',
      source_id: String(r.id),
      label: `${String(r.hotel ?? '')} / ${String(r.reservation_name ?? '')}`,
      amount: Number(r.total_price ?? 0),
      submit_on: String(r.submit_on ?? r.check_in_date ?? r.created_at ?? ''),
      paid_to: String(r.hotel ?? ''),
      paid_for: String(r.reservation_name ?? '호텔 부킹'),
      description: r.note == null ? null : String(r.note),
      payment_method: pm
    }
  }
  if (table === 'ticket_bookings') {
    return {
      source_table: 'ticket_bookings',
      source_id: String(r.id),
      label: `${String(r.category ?? '')} / ${String(r.company ?? '')}`,
      amount: Number(r.expense ?? 0),
      submit_on: String(r.submit_on),
      paid_to: String(r.company ?? ''),
      paid_for: String(r.category ?? ''),
      description: null,
      payment_method: pm
    }
  }
  const paidFor = String(r.paid_for ?? '')
  const paidTo = String(r.paid_to ?? '')
  return {
    source_table: table,
    source_id: String(r.id),
    label: `${paidFor} / ${paidTo}`,
    amount: Number(r.amount),
    submit_on: String(r.submit_on),
    paid_to: paidTo,
    paid_for: paidFor,
    description:
      r.description == null && r.note == null ? null : String(r.description ?? r.note ?? ''),
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

function formatReconciliationTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16)
  return d.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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
    case 'tour_hotel_bookings':
      return '호텔 부킹'
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
    case 'tour_hotel_bookings':
      return 'text-orange-600'
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
    case 'tour_hotel_bookings':
      return <Building2 className={cn} aria-hidden />
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

function formatMoneyUsd(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function normalizeDateYmd(value: string | null | undefined): string {
  const s = String(value ?? '').trim()
  return s.length >= 10 ? s.slice(0, 10) : s
}

function operationalLedgerKey(sourceTable: string, sourceId: string): string {
  return `${sourceTable}:${sourceId}`
}

/** 운영 지출입 원장 테이블별 금액 컬럼명 */
function operationalLedgerDbAmountPayload(
  sourceTable: OperationalLedgerSourceTable,
  amount: number
): Record<string, number> {
  switch (sourceTable) {
    case 'ticket_bookings':
      return { expense: amount }
    case 'tour_hotel_bookings':
      return { total_price: amount }
    default:
      return { amount }
  }
}

function todayYmd(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

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
  /** 동일 테이블 내 IN 청크를 묶어 병렬 요청 (건수 많을 때 순차 대비 체감 속도) */
  const CHUNK_WAVE = 8
  for (const [table, idSet] of byTable) {
    const ids = [...idSet]
    for (let i = 0; i < ids.length; i += chunkSize * CHUNK_WAVE) {
      const wave: string[][] = []
      for (let w = 0; w < CHUNK_WAVE; w++) {
        const start = i + w * chunkSize
        if (start >= ids.length) break
        wave.push(ids.slice(start, start + chunkSize))
      }
      const settled = await Promise.allSettled(
        wave.map((chunk) =>
          client
            .from('reconciliation_matches')
            .select('source_id')
            .eq('source_table', table)
            .in('source_id', chunk)
        )
      )
      for (const s of settled) {
        if (s.status !== 'fulfilled') continue
        const { data, error } = s.value
        if (error) {
          if (!isAbortLikeError(error)) console.error(error)
          continue
        }
        for (const row of data || []) {
          matched.add(`${table}:${row.source_id}`)
        }
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
  /** 명세 CSV 업로드·잠금·삭제: info@ 또는 team 직책 super */
  const [isTeamSuperForStatements, setIsTeamSuperForStatements] = useState(false)

  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [imports, setImports] = useState<StatementImport[]>([])
  const [lines, setLines] = useState<StatementLine[]>([])
  const [matches, setMatches] = useState<ReconciliationMatchRow[]>([])
  const [teamDisplayNamesByEmail, setTeamDisplayNamesByEmail] = useState<Record<string, string>>({})
  /** 아래 명세 대조 표: 줄·매칭 Supabase 로드 중 */
  const [reconciliationLinesLoading, setReconciliationLinesLoading] = useState(false)

  const [filterAccountId, setFilterAccountId] = useState('')
  /** true면 matched_status가 unmatched인 명세 줄만 표시 */
  const [showOnlyUnmatchedLines, setShowOnlyUnmatchedLines] = useState(false)
  /** 표 테이블: 설명·가맹점·금액·일자·방향 등 부분 문자열 검색 */
  const [reconciliationSearchQuery, setReconciliationSearchQuery] = useState('')
  /** 명세 대조 표: 한 번에 그리는 행 수 제한(대량 DOM으로 브라우저 멈춤 방지) */
  const [reconciliationPage, setReconciliationPage] = useState(1)
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  /** 명세 대조 표: 거래일(posted_date) 시작·종료 — 비우면 범위 제한 없음(월 필터와 함께 적용) */
  const [statementTableDateStart, setStatementTableDateStart] = useState('')
  const [statementTableDateEnd, setStatementTableDateEnd] = useState('')
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
  /** 미매칭 패널: 일자 정렬 — desc 최신 먼저, asc 과거 먼저(기본) */
  const [unmatchedPanelSortDate, setUnmatchedPanelSortDate] = useState<'desc' | 'asc'>('asc')
  const [unmatchedPanelSearch, setUnmatchedPanelSearch] = useState('')
  /** 비어 있으면 전체 — id 또는 '__none__'(미지정) 다중 선택 */
  const [unmatchedPanelPaymentMethodFilter, setUnmatchedPanelPaymentMethodFilter] = useState<string[]>([])
  const [unmatchedPmFilterOpen, setUnmatchedPmFilterOpen] = useState(false)
  const unmatchedPmFilterWrapRef = useRef<HTMLDivElement>(null)
  /** 미매칭 지출·입금 후보 API 조회 구간 (기본: 명세 표 현재 페이지 첫·끝 일자 ±7일) */
  const [unmatchedExpenseQueryStart, setUnmatchedExpenseQueryStart] = useState('')
  const [unmatchedExpenseQueryEnd, setUnmatchedExpenseQueryEnd] = useState('')
  /** true면 자동 기본값 동기화 안 함(검색으로 표가 바뀌어도 유지) — 페이지·계정 바꾸면 false로 리셋 */
  const [unmatchedExpenseRangeTouched, setUnmatchedExpenseRangeTouched] = useState(false)
  /** '' = 전체 — company_expenses | tour_expenses | reservation_expenses | ticket_bookings */
  const [unmatchedPanelSourceTableFilter, setUnmatchedPanelSourceTableFilter] = useState('')
  /** 미매칭 패널: 미매칭 지출만 / 기간 내 지출 전체(이미 연결 포함) */
  const [unmatchedPanelListScope, setUnmatchedPanelListScope] = useState<'unmatched' | 'all'>(
    'unmatched'
  )
  /** xl에서 오른쪽 미매칭 패널 — 접어 두면 지출·매칭키 조회를 하지 않아 초기 로딩이 빨라짐 */
  const [unmatchedSidebarOpen, setUnmatchedSidebarOpen] = useState(false)
  const [unmatchedExpensesLoading, setUnmatchedExpensesLoading] = useState(false)
  const [paymentOptions, setPaymentOptions] = useState<PaymentRecordOption[]>([])
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(false)
  const [coverageYear, setCoverageYear] = useState(() => new Date().getFullYear().toString())

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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([])
  const [paymentLinkModalOpen, setPaymentLinkModalOpen] = useState(false)
  const [linkedCardsModalOpen, setLinkedCardsModalOpen] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [accountsModalOpen, setAccountsModalOpen] = useState(false)
  const [csvImportModalOpen, setCsvImportModalOpen] = useState(false)
  const [journalModalOpen, setJournalModalOpen] = useState(false)
  /** 자동 매칭: 미리보기 후 확인 시에만 reconciliation_matches 저장 */
  const [autoMatchPreviewOpen, setAutoMatchPreviewOpen] = useState(false)
  const [autoMatchProposals, setAutoMatchProposals] = useState<AutoMatchProposalRow[]>([])
  const [autoMatchSummaryHint, setAutoMatchSummaryHint] = useState<string | null>(null)
  const [autoMatchApplying, setAutoMatchApplying] = useState(false)
  /** 미리보기에서 저장할 명세 줄 id — 기본은 후보 전체 선택 */
  const [autoMatchSelectedIds, setAutoMatchSelectedIds] = useState<Set<string>>(() => new Set())
  const [autoMatchPreviewPage, setAutoMatchPreviewPage] = useState(1)
  /** 미리보기에서 명세 줄별로 선택한 후보 key */
  const [autoMatchCandidateSelection, setAutoMatchCandidateSelection] = useState<Record<string, string>>({})
  const autoMatchSelectAllRef = useRef<HTMLInputElement>(null)
  const [bulkCompanyExpenseModalOpen, setBulkCompanyExpenseModalOpen] = useState(false)
  const [resetAllMatchesOpen, setResetAllMatchesOpen] = useState(false)
  const [resettingAllMatches, setResettingAllMatches] = useState(false)
  const [matchHistoryTarget, setMatchHistoryTarget] = useState<{
    line: StatementLine
    match: ReconciliationMatchRow
    expense?: ExpenseOption
  } | null>(null)
  const [matchHistoryRows, setMatchHistoryRows] = useState<ReconciliationMatchEventRow[]>([])
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false)
  const [matchHistoryError, setMatchHistoryError] = useState<string | null>(null)
  /** 행마다 수천 개 `<option>`을 두지 않고, 모달에서 검색·선택 */
  const [expensePickerLineId, setExpensePickerLineId] = useState<string | null>(null)
  const [expensePickerQuery, setExpensePickerQuery] = useState('')
  const [expensePickerBrowseTable, setExpensePickerBrowseTable] = useState<ExpensePickerBrowseTable | null>(null)
  const [expensePickerBrowsePage, setExpensePickerBrowsePage] = useState(0)
  const [expensePickerBrowseRows, setExpensePickerBrowseRows] = useState<ExpenseOption[]>([])
  const [expensePickerBrowseLoading, setExpensePickerBrowseLoading] = useState(false)
  const [expensePickerBrowseHasMore, setExpensePickerBrowseHasMore] = useState(false)
  const [matchedExpenseDetails, setMatchedExpenseDetails] = useState<Record<string, ExpenseOption>>({})
  const [paymentPickerLineId, setPaymentPickerLineId] = useState<string | null>(null)
  const [paymentPickerQuery, setPaymentPickerQuery] = useState('')
  /** payment_records.reservation_id → customers.name (입금 연결 모달 표시용) */
  const [paymentPickerReservationCustomerNames, setPaymentPickerReservationCustomerNames] = useState<
    Record<string, string>
  >({})
  const paymentMethodsLoadedRef = useRef(false)
  const createAccountInFlight = useRef(false)
  const csvImportFileInputRef = useRef<HTMLInputElement>(null)
  const [savingStatementCsvModeFor, setSavingStatementCsvModeFor] = useState<string | null>(null)
  const [flippingStatementDirectionsFor, setFlippingStatementDirectionsFor] = useState<string | null>(null)
  const [reconciliationViewTab, setReconciliationViewTab] = useState<ReconciliationViewTab>('statements')
  const [operationalLedgerStart, setOperationalLedgerStart] = useState(() => todayYmd())
  const [operationalLedgerEnd, setOperationalLedgerEnd] = useState(() => todayYmd())
  const [operationalLedgerRows, setOperationalLedgerRows] = useState<OperationalLedgerRow[]>([])
  const [operationalLedgerLoading, setOperationalLedgerLoading] = useState(false)
  const [operationalLedgerSearch, setOperationalLedgerSearch] = useState('')
  const [operationalLedgerSourceFilter, setOperationalLedgerSourceFilter] = useState<OperationalLedgerSourceTable | ''>('')
  const [operationalLedgerScope, setOperationalLedgerScope] = useState<'unmatched' | 'all'>('unmatched')
  const [operationalLedgerPage, setOperationalLedgerPage] = useState(1)
  const [statementCandidatesByLedgerKey, setStatementCandidatesByLedgerKey] = useState<Record<string, StatementLineCandidate[]>>({})
  const [statementCandidateLoadingKeys, setStatementCandidateLoadingKeys] = useState<Set<string>>(() => new Set())
  const [operationalLedgerAmountSavingKey, setOperationalLedgerAmountSavingKey] = useState<string | null>(null)
  const [operationalLedgerAmountInputRemount, setOperationalLedgerAmountInputRemount] = useState<Record<string, number>>({})

  /** 보정 지출 — 유형 선택 후 모달에서 실제 지출 입력 */
  const [adjustModalLine, setAdjustModalLine] = useState<StatementLine | null>(null)

  /** GET /api/financial/accounts — 클라이언트 Supabase SELECT는 abort·권한 이슈로 빈 목록이 될 수 있음 */
  const loadAccounts = useCallback(async () => {
    setAccountsListError(null)
    try {
      const getSessionToken = async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          return session?.access_token ?? null
        } catch (e) {
          if (isAbortLikeError(e)) return getStoredAccessToken()
          throw e
        }
      }

      let token = getStoredAccessToken() || (await getSessionToken())
      const fetchAccounts = (accessToken: string | null) =>
        fetch('/api/financial/accounts', {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          credentials: 'same-origin',
        })

      let res = await fetchAccounts(token)

      if (res.status === 401) {
        const refreshedToken = await getSessionToken()
        if (refreshedToken && refreshedToken !== token) {
          token = refreshedToken
          res = await fetchAccounts(refreshedToken)
        }
      }

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
  const loadPaymentMethods = useCallback(async (force = false) => {
    if (!force && paymentMethodsLoadedRef.current) return
    try {
      const res = await fetch('/api/payment-methods?limit=5000')
      const json = (await res.json()) as {
        success?: boolean
        message?: string
        data?: Array<{
          id: string
          method?: string
          display_name?: string | null
          card_holder_name?: string | null
          card_number_last4?: string | null
          financial_account_id?: string | null
          user_email?: string | null
          notes?: string | null
          team?: {
            email?: string
            name_ko?: string | null
            name_en?: string | null
            nick_name?: string | null
          } | null
        }>
      }
      if (!res.ok || json.success === false) {
        setPaymentMethods([])
        paymentMethodsLoadedRef.current = false
        setMessage(
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
          card_holder_name: pm.card_holder_name ?? null,
          card_number_last4: pm.card_number_last4 ?? null,
          financial_account_id: pm.financial_account_id ?? null,
          user_email: pm.user_email ?? null,
          notes: pm.notes ?? null,
          team: pm.team ?? null
        }))
      )
      paymentMethodsLoadedRef.current = true
    } catch (e) {
      console.error(e)
      setPaymentMethods([])
      paymentMethodsLoadedRef.current = false
      setMessage(e instanceof Error ? e.message : '결제수단을 불러오는 중 오류가 났습니다.')
    }
  }, [])

  const loadImports = useCallback(async () => {
    const { data, error } = await supabase
      .from('statement_imports')
      .select('id,financial_account_id,period_label,period_start,period_end,status,original_filename,created_at')
      .order('period_start', { ascending: false })
      .limit(200)
    if (error && !isAbortLikeError(error)) console.error(error)
    else if (!error) setImports((data as StatementImport[]) || [])
  }, [])

  const loadTeamDisplayNames = useCallback(async () => {
    const { data, error } = await supabase
      .from('team')
      .select('email,name_ko,name_en')
      .eq('is_active', true)
    if (error) {
      if (!isAbortLikeError(error)) console.error(error)
      return
    }
    const map: Record<string, string> = {}
    for (const row of (data || []) as { email?: string | null; name_ko?: string | null; name_en?: string | null }[]) {
      const em = row.email?.trim().toLowerCase()
      if (!em) continue
      map[em] = row.name_ko?.trim() || row.name_en?.trim() || row.email?.trim() || em
    }
    setTeamDisplayNamesByEmail(map)
  }, [])

  const importsRef = useRef(imports)
  importsRef.current = imports
  const linesMatchesCacheRef = useRef<
    Map<string, { loadedAt: number; lines: StatementLine[]; matches: ReconciliationMatchRow[] }>
  >(new Map())

  /** 명세 줄 로드 경합 시 이전 요청의 finally 가 로딩을 끄지 않도록 */
  const loadLinesGenRef = useRef(0)
  /** 동시에 여러 번 호출될 때 로딩 스피너가 영구히 남는 것 방지 */
  const loadLinesInFlightRef = useRef(0)

  /** 선택 금융 계정에 연결된 모든 명세 업로드의 줄·매칭을 합쳐 로드 */
  const loadLinesAndMatchesForAccount = useCallback(async (accountId: string, options?: { force?: boolean }) => {
    const force = Boolean(options?.force)
    if (!accountId) {
      loadLinesGenRef.current += 1
      setReconciliationLinesLoading(false)
      startTransition(() => {
        setLines([])
        setMatches([])
      })
      return
    }
    const importIds = importsRef.current
      .filter((im) => im.financial_account_id === accountId)
      .map((im) => im.id)
      .sort()
    if (importIds.length === 0) {
      loadLinesGenRef.current += 1
      setReconciliationLinesLoading(false)
      startTransition(() => {
        setLines([])
        setMatches([])
      })
      return
    }
    const cacheKey = `${accountId}|${importIds.join(',')}`
    if (!force) {
      const cached = linesMatchesCacheRef.current.get(cacheKey)
      if (cached && Date.now() - cached.loadedAt < RECONCILIATION_LOAD_CACHE_TTL_MS) {
        startTransition(() => {
          setLines(cached.lines)
          setMatches(cached.matches)
        })
        setReconciliationLinesLoading(false)
        return
      }
    }
    const gen = ++loadLinesGenRef.current
    loadLinesInFlightRef.current += 1
    setReconciliationLinesLoading(true)
    try {
      const perImportTasks: Promise<{
        lines: StatementLine[]
        matches: ReconciliationMatchRow[]
      }>[] = []
      for (let i = 0; i < importIds.length; i += STATEMENT_IMPORT_LINE_CHUNK) {
        const slice = importIds.slice(i, i + STATEMENT_IMPORT_LINE_CHUNK)
        perImportTasks.push(
          (async () => {
            const partLines = await fetchAllStatementLinesForImportChunk(slice)
            const partIds = partLines.map((l) => l.id)
            let partMatches: ReconciliationMatchRow[] = []
            if (partIds.length > 0) {
              try {
                partMatches = await fetchReconciliationMatchesForLineIds(partIds)
              } catch (e) {
                /** 매칭만 실패해도 명세 줄은 반드시 유지 (이전엔 전 청크 reject 로 줄이 통째로 사라짐) */
                if (!isAbortLikeError(e)) console.error(e)
              }
            }
            return { lines: partLines, matches: partMatches }
          })()
        )
      }
      const settled = await Promise.allSettled(perImportTasks)
      const linesArr: StatementLine[] = []
      let matchRows: ReconciliationMatchRow[] = []
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          linesArr.push(...s.value.lines)
          matchRows.push(...s.value.matches)
        } else if (!isAbortLikeError(s.reason)) {
          console.error(s.reason)
        }
      }
      linesArr.sort((a, b) => {
        const da = a.posted_date || ''
        const db = b.posted_date || ''
        if (da !== db) return da.localeCompare(db)
        return String(a.id).localeCompare(String(b.id))
      })
      matchRows = dedupeReconciliationMatchRows(matchRows)
      linesMatchesCacheRef.current.set(cacheKey, {
        loadedAt: Date.now(),
        lines: linesArr,
        matches: matchRows
      })
      if (gen === loadLinesGenRef.current) {
        startTransition(() => {
          setLines(linesArr)
          setMatches(matchRows)
        })
      }
    } finally {
      loadLinesInFlightRef.current -= 1
      if (loadLinesInFlightRef.current <= 0) {
        loadLinesInFlightRef.current = 0
        setReconciliationLinesLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  useEffect(() => {
    if (authUser?.email) void loadTeamDisplayNames()
  }, [authUser?.email, loadTeamDisplayNames])

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

  const paymentMethodFinancialAccountById = useMemo(() => {
    return new Map(paymentMethods.map((pm) => [pm.id, pm.financial_account_id ?? null]))
  }, [paymentMethods])

  const expenseMatchesSelectedFinancialAccount = useCallback(
    (o: Pick<ExpenseOption, 'payment_method'>) => {
      const pm = o.payment_method?.trim()
      if (!pm || !filterAccountId) return false
      return paymentMethodFinancialAccountById.get(pm) === filterAccountId
    },
    [paymentMethodFinancialAccountById, filterAccountId]
  )

  const compareExpenseFinancialAccountPriority = useCallback(
    (a: ExpenseOption, b: ExpenseOption) => {
      const am = expenseMatchesSelectedFinancialAccount(a)
      const bm = expenseMatchesSelectedFinancialAccount(b)
      if (am !== bm) return am ? -1 : 1
      return 0
    },
    [expenseMatchesSelectedFinancialAccount]
  )

  const importsForAccount = useMemo(
    () => imports.filter((im) => im.financial_account_id === filterAccountId),
    [imports, filterAccountId]
  )

  const coverageImportIdSet = useMemo(
    () => new Set(importsForAccount.map((im) => im.id)),
    [importsForAccount]
  )

  /** 월 통계: 명세 줄을 한 번 불러온 뒤 메모리에서만 집계 (이전: 동일 데이터를 DB에서 다시 전량 조회) */
  const coverageMonthStats = useMemo(() => {
    if (!filterAccountId || coverageImportIdSet.size === 0) {
      return Array.from({ length: 12 }, () => ({ reconciled: 0, uploaded: 0 }))
    }
    const year = parseInt(coverageYear, 10)
    return aggregateCoverageMonthStatsFromLines(lines, year, coverageImportIdSet)
  }, [lines, coverageYear, filterAccountId, coverageImportIdSet])

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
    for (const [k, o] of Object.entries(matchedExpenseDetails)) {
      if (!m.has(k)) m.set(k, o)
    }
    return m
  }, [expenseOptions, matchedExpenseDetails])

  const refreshUnmatchedExpenseKeys = useCallback(async () => {
    if (expenseOptions.length === 0) {
      setMatchedExpenseKeysInDb(new Set())
      setMatchedExpenseKeysLoading(false)
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
      const priorityCmp = compareExpenseFinancialAccountPriority(a, b)
      if (priorityCmp !== 0) return priorityCmp
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
    compareExpenseFinancialAccountPriority,
    unmatchedPanelSortDate,
    unmatchedPanelListScope
  ])

  const unmatchedExpensePanelSourceFilteredRows = useMemo(() => {
    const t = unmatchedPanelSourceTableFilter
    if (!t) return unmatchedExpensePanelRows
    return unmatchedExpensePanelRows.filter((o) => o.source_table === t)
  }, [unmatchedExpensePanelRows, unmatchedPanelSourceTableFilter])

  const unmatchedExpenseSourceTabCounts = useMemo(() => {
    const counts: Record<string, number> = { '': unmatchedExpensePanelRows.length }
    for (const o of unmatchedExpensePanelRows) {
      counts[o.source_table] = (counts[o.source_table] ?? 0) + 1
    }
    return counts
  }, [unmatchedExpensePanelRows])

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
    const sel = unmatchedPanelPaymentMethodFilter
    if (sel.length === 0) return unmatchedExpensePanelSourceFilteredRows
    const selectedPm = new Set(sel)
    return unmatchedExpensePanelSourceFilteredRows.filter((o) => {
      const pm = o.payment_method?.trim() || ''
      if (!pm) return selectedPm.has('__none__')
      return selectedPm.has(pm)
    })
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

  const reconciliationAccountIdsKey = useMemo(
    () => accountsForReconciliation.map((a) => a.id).sort().join(','),
    [accountsForReconciliation]
  )

  /** 활성 금융 계정이 있으면 결제수단 목록 로드(명세 대조·미매칭 등) */
  useEffect(() => {
    if (!reconciliationAccountIdsKey) return
    void loadPaymentMethods()
  }, [reconciliationAccountIdsKey, loadPaymentMethods])

  /** CSV 가져오기 모달: 선택 계정의 반전 규칙 + 파싱 미리보기(상위 N행) */
  const csvImportParsePreview = useMemo(() => {
    const tid = importAccountId?.trim()
    const txt = csvText?.trim()
    if (!tid) {
      return { status: 'need_account' as const }
    }
    const acc =
      accountsForReconciliation.find((a) => a.id === tid) ?? accounts.find((a) => a.id === tid)
    if (!acc) {
      return { status: 'need_account' as const }
    }
    const { ruleLabel, invertApplied } = describeCsvImportInvertRule(acc)
    if (!txt) {
      return {
        status: 'need_csv' as const,
        accountName: acc.name,
        ruleLabel,
        invertApplied,
      }
    }
    const parsed = parseStatementCsvText(csvText, {
      invertDirections: shouldInvertStatementCsvDirections(
        acc.account_type,
        acc.statement_csv_direction_mode
      ),
    })
    return {
      status: 'ready' as const,
      accountName: acc.name,
      ruleLabel,
      invertApplied,
      rows: parsed.slice(0, CSV_IMPORT_PREVIEW_MAX),
      totalParsed: parsed.length,
    }
  }, [importAccountId, csvText, accountsForReconciliation, accounts])

  useEffect(() => {
    if (!authUser?.email) {
      setIsTeamSuperForStatements(false)
      return
    }
    const emailLower = authUser.email.toLowerCase().trim()
    if (emailLower === 'info@maniatour.com') {
      setIsTeamSuperForStatements(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('team')
          .select('position')
          .eq('email', authUser.email)
          .eq('is_active', true)
          .maybeSingle()
        if (cancelled) return
        if (error || !data) {
          setIsTeamSuperForStatements(false)
          return
        }
        const position = String((data as { position?: string }).position ?? '')
          .toLowerCase()
          .trim()
        setIsTeamSuperForStatements(position === 'super')
      } catch (e) {
        if (!cancelled) {
          console.error(e)
          setIsTeamSuperForStatements(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.email])

  const canMutateStatementUploads = useMemo(() => {
    const em = email.toLowerCase().trim()
    return em === 'info@maniatour.com' || isTeamSuperForStatements
  }, [email, isTeamSuperForStatements])

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
    let rows = selectedMonth === 'all' ? lines : lines.filter((l) => l.posted_date?.startsWith(selectedMonth))
    let startY = statementTableDateStart.trim().slice(0, 10)
    let endY = statementTableDateEnd.trim().slice(0, 10)
    if (startY.length >= 10 && endY.length >= 10) {
      if (startY > endY) {
        const t = startY
        startY = endY
        endY = t
      }
      rows = rows.filter((l) => {
        const ymd = statementLinePostedYmd(l)
        return ymd.length >= 10 && ymd >= startY && ymd <= endY
      })
    } else if (startY.length >= 10) {
      rows = rows.filter((l) => {
        const ymd = statementLinePostedYmd(l)
        return ymd.length >= 10 && ymd >= startY
      })
    } else if (endY.length >= 10) {
      rows = rows.filter((l) => {
        const ymd = statementLinePostedYmd(l)
        return ymd.length >= 10 && ymd <= endY
      })
    }
    return rows
  }, [lines, selectedMonth, statementTableDateStart, statementTableDateEnd])

  const statementTableDateRangeActive = useMemo(() => {
    const s = statementTableDateStart.trim().slice(0, 10)
    const e = statementTableDateEnd.trim().slice(0, 10)
    return s.length >= 10 || e.length >= 10
  }, [statementTableDateStart, statementTableDateEnd])

  /** 월·거래일 범위·미대조만 필터 적용 후 (검색 전) — 빈 화면 메시지 구분용 */
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

  /** 일괄 회사 지출: 표의 출금·미대조·아직 매칭 없음 — 최대 200건 */
  const bulkCompanyExpenseCandidates = useMemo(() => {
    return reconciliationTableLines
      .filter(
        (l) =>
          l.direction === 'outflow' &&
          l.matched_status === 'unmatched' &&
          (matchesByLine.get(l.id) || []).length === 0 &&
          Number(l.amount) > 0
      )
      .slice(0, 200)
  }, [reconciliationTableLines, matchesByLine])

  const defaultPaymentMethodIdForAccount = useMemo(() => {
    const pm = paymentMethods.find((p) => p.financial_account_id === filterAccountId)
    return pm?.id ?? null
  }, [paymentMethods, filterAccountId])

  const reconciliationPageCount = useMemo(
    () => Math.max(1, Math.ceil(reconciliationTableLines.length / RECONCILIATION_PAGE_SIZE)),
    [reconciliationTableLines.length]
  )
  const autoMatchPreviewPageCount = useMemo(
    () => Math.max(1, Math.ceil(autoMatchProposals.length / AUTO_MATCH_PREVIEW_PAGE_SIZE)),
    [autoMatchProposals.length]
  )
  const normalizedAutoMatchPreviewPage = Math.min(autoMatchPreviewPage, autoMatchPreviewPageCount)
  const autoMatchPagedProposals = useMemo(() => {
    const start = (normalizedAutoMatchPreviewPage - 1) * AUTO_MATCH_PREVIEW_PAGE_SIZE
    return autoMatchProposals.slice(start, start + AUTO_MATCH_PREVIEW_PAGE_SIZE)
  }, [autoMatchProposals, normalizedAutoMatchPreviewPage])
  const autoMatchPageAllSelected =
    autoMatchPagedProposals.length > 0 &&
    autoMatchPagedProposals.every((p) => autoMatchSelectedIds.has(p.statement_line_id))
  const autoMatchPageSelectedCount = useMemo(
    () =>
      autoMatchPagedProposals.reduce(
        (count, p) => count + (autoMatchSelectedIds.has(p.statement_line_id) ? 1 : 0),
        0
      ),
    [autoMatchPagedProposals, autoMatchSelectedIds]
  )

  const pagedReconciliationLines = useMemo(() => {
    const start = (reconciliationPage - 1) * RECONCILIATION_PAGE_SIZE
    return reconciliationTableLines.slice(start, start + RECONCILIATION_PAGE_SIZE)
  }, [reconciliationTableLines, reconciliationPage])

  useEffect(() => {
    const wanted = new Map<ExpenseOption['source_table'], Set<string>>()
    for (const line of pagedReconciliationLines) {
      const ms = matchesByLine.get(line.id) || []
      for (const m of ms) {
        if (!EXPENSE_TABLES.includes(m.source_table as ExpenseOption['source_table'])) continue
        const key = expenseKey(m.source_table, m.source_id)
        if (expenseOptionByKey.has(key)) continue
        const table = m.source_table as ExpenseOption['source_table']
        const ids = wanted.get(table) || new Set<string>()
        ids.add(m.source_id)
        wanted.set(table, ids)
      }
    }
    if (wanted.size === 0) return

    let cancelled = false
    ;(async () => {
      const next: Record<string, ExpenseOption> = {}
      const jobs = [...wanted.entries()].map(async ([table, ids]) => {
        const idList = [...ids]
        if (idList.length === 0) return
        const sel =
          table === 'ticket_bookings'
            ? 'id,expense,submit_on,category,company,payment_method'
            : table === 'tour_hotel_bookings'
              ? 'id,total_price,submit_on,check_in_date,hotel,reservation_name,payment_method'
            : table === 'company_expenses'
              ? 'id,amount,submit_on,paid_for,paid_to,description,payment_method'
              : 'id,amount,submit_on,paid_for,paid_to,note,payment_method'
        const { data, error } = await (supabase as any).from(table).select(sel).in('id', idList)
        if (error) {
          if (!isAbortLikeError(error)) console.error(error)
          return
        }
        for (const row of data || []) {
          const o = recordToExpenseOption(table, row as Record<string, unknown>)
          next[expenseKey(o.source_table, o.source_id)] = o
        }
      })
      await Promise.all(jobs)
      if (cancelled || Object.keys(next).length === 0) return
      setMatchedExpenseDetails((prev) => ({ ...prev, ...next }))
    })()

    return () => {
      cancelled = true
    }
  }, [pagedReconciliationLines, matchesByLine, expenseOptionByKey])

  /** 명세 표 현재 페이지 첫·마지막 행 거래일 ±7일 — 미매칭 지출 조회 기본값 */
  const defaultUnmatchedExpenseRange = useMemo(() => {
    const fallbackFromAccount = (): { start: string; end: string } => {
      if (!accountExpenseWindow) return { start: '', end: '' }
      const ps = accountExpenseWindow.period_start.trim().slice(0, 10)
      const pe = accountExpenseWindow.period_end.trim().slice(0, 10)
      if (ps.length < 10 || pe.length < 10) return { start: '', end: '' }
      return { start: addCalendarDaysYmd(ps, -7), end: addCalendarDaysYmd(pe, 7) }
    }
    const lines = pagedReconciliationLines
    if (lines.length > 0) {
      const first = lines[0].posted_date?.trim().slice(0, 10) ?? ''
      const last = lines[lines.length - 1].posted_date?.trim().slice(0, 10) ?? ''
      if (first.length >= 10 && last.length >= 10) {
        return { start: addCalendarDaysYmd(first, -7), end: addCalendarDaysYmd(last, 7) }
      }
    }
    if (reconciliationTableLines.length > 0) {
      const first = reconciliationTableLines[0].posted_date?.trim().slice(0, 10) ?? ''
      const last =
        reconciliationTableLines[reconciliationTableLines.length - 1].posted_date?.trim().slice(0, 10) ??
        ''
      if (first.length >= 10 && last.length >= 10) {
        return { start: addCalendarDaysYmd(first, -7), end: addCalendarDaysYmd(last, 7) }
      }
    }
    return fallbackFromAccount()
  }, [pagedReconciliationLines, reconciliationTableLines, accountExpenseWindow])

  useEffect(() => {
    setUnmatchedExpenseRangeTouched(false)
  }, [reconciliationPage, filterAccountId])

  useEffect(() => {
    if (unmatchedExpenseRangeTouched) return
    const { start, end } = defaultUnmatchedExpenseRange
    if (start && end) {
      setUnmatchedExpenseQueryStart(start)
      setUnmatchedExpenseQueryEnd(end)
    }
  }, [
    defaultUnmatchedExpenseRange.start,
    defaultUnmatchedExpenseRange.end,
    unmatchedExpenseRangeTouched
  ])

  /** 입금 연결 모달 전용 — 미매칭 패널과 분리해 두면 초기에 payment_records 전량 순회를 하지 않음 */
  const fetchPaymentRecordsForUnmatchedQueryRange = useCallback(async (): Promise<
    PaymentRecordOption[] | null
  > => {
    if (!filterAccountId) return null
    let startYmd = unmatchedExpenseQueryStart.trim().slice(0, 10)
    let endYmd = unmatchedExpenseQueryEnd.trim().slice(0, 10)
    if (!startYmd || !endYmd || startYmd.length < 10 || endYmd.length < 10) return null
    if (startYmd > endYmd) {
      const t = startYmd
      startYmd = endYmd
      endYmd = t
    }
    const start = new Date(startYmd + 'T00:00:00')
    const end = new Date(endYmd + 'T23:59:59.999')
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    return fetchAllPaymentRecordsInDateRange(startIso, endIso)
  }, [filterAccountId, unmatchedExpenseQueryStart, unmatchedExpenseQueryEnd])

  /** 미매칭 패널 지출 후보 — 사용자 지정 기간 (입금 기록은 별도 로드) */
  const fetchExpenseOptionsForPeriod = useCallback(async (): Promise<ExpenseOption[] | null> => {
    if (!filterAccountId) return null
    let startYmd = unmatchedExpenseQueryStart.trim().slice(0, 10)
    let endYmd = unmatchedExpenseQueryEnd.trim().slice(0, 10)
    if (!startYmd || !endYmd || startYmd.length < 10 || endYmd.length < 10) return null
    if (startYmd > endYmd) {
      const t = startYmd
      startYmd = endYmd
      endYmd = t
    }
    const start = new Date(startYmd + 'T00:00:00')
    const end = new Date(endYmd + 'T23:59:59.999')
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    const [{ data: ce }, { data: te }, { data: re }, { data: tb }] = await Promise.all([
      supabase
        .from('company_expenses')
        .select('id,amount,submit_on,paid_for,paid_to,description,payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('tour_expenses')
        .select('id,amount,submit_on,paid_for,paid_to,note,payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('reservation_expenses')
        .select('id,amount,submit_on,paid_for,paid_to,note,payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso),
      supabase
        .from('ticket_bookings')
        .select('id,expense,submit_on,category,company,payment_method')
        .gte('submit_on', startIso)
        .lte('submit_on', endIso)
    ])
    const ex: ExpenseOption[] = [
      ...(ce || []).map((r: Record<string, unknown>) => recordToExpenseOption('company_expenses', r)),
      ...(te || []).map((r: Record<string, unknown>) => recordToExpenseOption('tour_expenses', r)),
      ...(re || []).map((r: Record<string, unknown>) => recordToExpenseOption('reservation_expenses', r)),
      ...(tb || []).map((r: Record<string, unknown>) => recordToExpenseOption('ticket_bookings', r))
    ]
    return dedupeExpenseOptionsList(ex)
  }, [filterAccountId, unmatchedExpenseQueryStart, unmatchedExpenseQueryEnd])

  useEffect(() => {
    setReconciliationPage(1)
  }, [
    filterAccountId,
    selectedMonth,
    statementTableDateStart,
    statementTableDateEnd,
    showOnlyUnmatchedLines,
    reconciliationSearchQuery
  ])

  useEffect(() => {
    setReconciliationSearchQuery('')
    setStatementTableDateStart('')
    setStatementTableDateEnd('')
  }, [filterAccountId])

  useEffect(() => {
    setUnmatchedPanelSearch('')
    setUnmatchedPanelPaymentMethodFilter([])
    setUnmatchedPanelSourceTableFilter('')
    setUnmatchedPmFilterOpen(false)
    setUnmatchedSidebarOpen(false)
  }, [filterAccountId])

  useEffect(() => {
    const allowed = new Set<string>()
    if (unmatchedPanelPaymentFilterOptions.hasNone) allowed.add('__none__')
    for (const [id] of unmatchedPanelPaymentFilterOptions.entries) {
      allowed.add(id)
    }
    setUnmatchedPanelPaymentMethodFilter((prev) => {
      const next = prev.filter((x) => allowed.has(x))
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev
      return next
    })
  }, [unmatchedPanelPaymentFilterOptions])

  useEffect(() => {
    if (!unmatchedPmFilterOpen) return
    const onDown = (e: MouseEvent) => {
      const el = unmatchedPmFilterWrapRef.current
      if (el && !el.contains(e.target as Node)) setUnmatchedPmFilterOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [unmatchedPmFilterOpen])

  useEffect(() => {
    setReconciliationPage((p) => Math.min(Math.max(1, p), reconciliationPageCount))
  }, [reconciliationPageCount])

  useEffect(() => {
    const el = autoMatchSelectAllRef.current
    if (!el) return
    const total = autoMatchPagedProposals.length
    const n = autoMatchPageSelectedCount
    el.indeterminate = total > 0 && n > 0 && n < total
  }, [autoMatchPreviewOpen, autoMatchPagedProposals, autoMatchPageSelectedCount])

  useEffect(() => {
    setAutoMatchPreviewPage((p) => Math.min(Math.max(1, p), autoMatchPreviewPageCount))
  }, [autoMatchPreviewPageCount])

  useEffect(() => {
    if (!unmatchedSidebarOpen) {
      startTransition(() => {
        setExpenseOptions([])
        setUnmatchedExpensesLoading(false)
      })
      return
    }
    let cancelled = false
    ;(async () => {
      setUnmatchedExpensesLoading(true)
      try {
        const ex = await fetchExpenseOptionsForPeriod()
        if (cancelled) return
        if (!ex) {
          startTransition(() => {
            setExpenseOptions([])
          })
          return
        }
        startTransition(() => {
          setExpenseOptions(ex)
        })
      } finally {
        if (!cancelled) setUnmatchedExpensesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [unmatchedSidebarOpen, fetchExpenseOptionsForPeriod])

  const refreshExpenseOptionsFromServer = useCallback(async () => {
    const ex = await fetchExpenseOptionsForPeriod()
    if (!ex) {
      startTransition(() => {
        setExpenseOptions([])
      })
      return
    }
    startTransition(() => {
      setExpenseOptions(ex)
    })
  }, [fetchExpenseOptionsForPeriod])

  /** 미매칭 패널을 열지 않은 채 지출 연결 모달만 연 경우 — 후보·검색용 지출 로드 */
  useEffect(() => {
    if (!expensePickerLineId || !filterAccountId) return
    if (expenseOptions.length > 0) return
    void refreshExpenseOptionsFromServer()
  }, [expensePickerLineId, filterAccountId, expenseOptions.length, refreshExpenseOptionsFromServer])

  /** 입금 연결 모달 — 열릴 때만 해당 기간 payment_records 순회 */
  useEffect(() => {
    if (!paymentPickerLineId || !filterAccountId) {
      setPaymentOptions([])
      setPaymentPickerReservationCustomerNames({})
      setPaymentOptionsLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setPaymentOptionsLoading(true)
      try {
        const pr = await fetchPaymentRecordsForUnmatchedQueryRange()
        if (cancelled) return
        setPaymentOptions(pr ?? [])
      } catch (e) {
        if (!cancelled && !isAbortLikeError(e)) console.error(e)
        if (!cancelled) setPaymentOptions([])
      } finally {
        if (!cancelled) setPaymentOptionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [paymentPickerLineId, filterAccountId, fetchPaymentRecordsForUnmatchedQueryRange])

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
            ? 'id,expense,submit_on,category,company,payment_method'
            : table === 'tour_expenses'
              ? 'id,amount,submit_on,paid_for,paid_to,note,tour_date,payment_method'
              : table === 'company_expenses'
                ? 'id,amount,submit_on,paid_for,paid_to,description,payment_method'
                : 'id,amount,submit_on,paid_for,paid_to,note,payment_method'

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
          ? 'id,expense,submit_on,category,company'
          : source_table === 'tour_expenses'
            ? 'id,amount,submit_on,paid_for,paid_to,tour_date'
            : 'id,amount,submit_on,paid_for,paid_to'
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

  const saveAccountStatementCsvDirection = async (
    accountId: string,
    mode: StatementCsvDirectionMode
  ) => {
    if (!accountId) return
    setSavingStatementCsvModeFor(accountId)
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
      const res = await fetch(`/api/financial/accounts/${encodeURIComponent(accountId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ statement_csv_direction_mode: mode }),
        credentials: 'same-origin',
      })
      const json = (await res.json()) as {
        error?: string
        success?: boolean
        data?: FinancialAccount
      }
      if (!res.ok) {
        setAccountActionError(json.error || `저장 실패 (${res.status})`)
        return
      }
      const saved = json.data?.statement_csv_direction_mode ?? mode
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, statement_csv_direction_mode: saved } : a))
      )
    } catch (e) {
      if (isAbortLikeError(e)) {
        setAccountActionError(
          '요청이 중단되었습니다. 네트워크가 불안정하거나 세션이 갱신 중일 수 있습니다. 잠시 후 다시 눌러 보세요.'
        )
      } else {
        setAccountActionError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      }
    } finally {
      setSavingStatementCsvModeFor(null)
    }
  }

  /** 이미 적재된 명세 줄 direction 만 반전 (CSV 가져오기 규칙은 그대로) */
  const flipExistingStatementLineDirections = async (accountId: string) => {
    if (!canMutateStatementUploads) {
      setAccountActionError(
        '명세 데이터를 바꾸는 작업은 info@maniatour.com 계정 또는 team에서 직책이 super인 활성 직원만 사용할 수 있습니다.'
      )
      return
    }
    if (
      !window.confirm(
        '이 금융 계정에 연결된 모든 명세 줄의 지출·수입 방향만 반전합니다. (아래에서 고른 CSV 가져오기 규칙은 바뀌지 않습니다.) 계속할까요?'
      )
    ) {
      return
    }
    setFlippingStatementDirectionsFor(accountId)
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
      const res = await fetch(
        `/api/financial/accounts/${encodeURIComponent(accountId)}/flip-statement-lines`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'same-origin',
        }
      )
      const json = (await res.json()) as {
        error?: string
        success?: boolean
        flippedCount?: number
      }
      if (!res.ok) {
        setAccountActionError(json.error || `실패 (${res.status})`)
        return
      }
      const n = json.flippedCount ?? 0
      setMessage(`명세 ${n}건의 지출·수입 방향을 반전했습니다. (CSV 가져오기 규칙은 그대로입니다.)`)
      if (filterAccountId === accountId) {
        await loadLinesAndMatchesForAccount(accountId, { force: true })
      }
    } catch (e) {
      if (isAbortLikeError(e)) {
        setAccountActionError(
          '요청이 중단되었습니다. 네트워크가 불안정하거나 세션이 갱신 중일 수 있습니다. 잠시 후 다시 눌러 보세요.'
        )
      } else {
        setAccountActionError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      }
    } finally {
      setFlippingStatementDirectionsFor(null)
    }
  }

  const importCsv = async () => {
    const notifyImport = (msg: string) => {
      setMessage(msg)
      setImportCsvFeedback(msg)
    }
    setImportCsvFeedback(null)
    if (!canMutateStatementUploads) {
      notifyImport(
        '명세 CSV 가져오기(업로드)는 info@maniatour.com 계정 또는 team에서 직책이 super인 활성 직원만 사용할 수 있습니다.'
      )
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
      const importAccount = accounts.find((a) => a.id === importAccountId)
      const parsed = parseStatementCsvText(csvText, {
        invertDirections: shouldInvertStatementCsvDirections(
          importAccount?.account_type ?? '',
          importAccount?.statement_csv_direction_mode
        ),
      })
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

  const prepareAutoMatch = async () => {
    if (!filterAccountId || !accountExpenseWindow) return
    if (pagedReconciliationLines.length === 0) {
      setMessage('현재 페이지에 표시할 명세 줄이 없습니다. 필터·검색·페이지를 확인하세요.')
      return
    }
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
          .select('id, amount, submit_on, paid_for, paid_to, standard_paid_for')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        supabase
          .from('tour_expenses')
          .select('id, amount, submit_on, paid_for, paid_to')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        (supabase as any)
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

    const candidates: AutoMatchExpenseCandidate[] = [
      ...(ce || []).map((r: Record<string, unknown>) => ({
        source_table: 'company_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`,
        paid_to: String(r.paid_to ?? ''),
        paid_for: String(r.paid_for ?? ''),
        standard_paid_for: r.standard_paid_for == null ? null : String(r.standard_paid_for)
      })),
      ...(te || []).map((r: Record<string, unknown>) => ({
        source_table: 'tour_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`,
        paid_to: String(r.paid_to ?? ''),
        paid_for: String(r.paid_for ?? ''),
        standard_paid_for: null
      })),
      ...(re || []).map((r: Record<string, unknown>) => ({
        source_table: 'reservation_expenses' as const,
        source_id: String(r.id),
        amount: Number(r.amount),
        occurred_at: String(r.submit_on),
        label: `${r.paid_for} / ${r.paid_to}`,
        paid_to: String(r.paid_to ?? ''),
        paid_for: String(r.paid_for ?? ''),
        standard_paid_for: null
      })),
      ...(tb || []).map((r: Record<string, unknown>) => ({
        source_table: 'ticket_bookings' as const,
        source_id: String(r.id),
        amount: Number(r.expense ?? 0),
        occurred_at: String(r.submit_on),
        label: `${String(r.category ?? '')} / ${String(r.company ?? '')}`,
        paid_to: String(r.company ?? ''),
        paid_for: String(r.category ?? ''),
        standard_paid_for: null
      }))
    ]

    const proposals: AutoMatchProposalRow[] = []
    const selectedCandidateByLine: Record<string, string> = {}
    const usedForDefaultSelection = new Set(used)
    for (const line of pagedReconciliationLines) {
      if (line.direction !== 'outflow') continue
      if ((matchesByLine.get(line.id) || []).length > 0) continue
      const amt = Number(line.amount)
      const options = candidates
        .map((expense) => {
          const key = `${expense.source_table}:${expense.source_id}`
          if (used.has(key)) return null
          const score = autoMatchCandidateScore(amt, line.posted_date, expense)
          if (!score) return null
          return {
            key,
            source_table: expense.source_table,
            source_id: expense.source_id,
            expense_label: expense.label,
            expense_registered_date: expense.occurred_at,
            expense_amount: Number(expense.amount),
            expense_paid_to: expense.paid_to,
            expense_paid_for: expense.paid_for,
            expense_standard_paid_for: expense.standard_paid_for,
            score,
            amount_diff: Math.abs(Number(expense.amount) - amt)
          } satisfies AutoMatchCandidateOption
        })
        .filter((x): x is AutoMatchCandidateOption => x != null)
        .sort((a, b) => {
          const scoreCmp = b.score - a.score
          if (scoreCmp !== 0) return scoreCmp
          const diffCmp = a.amount_diff - b.amount_diff
          if (diffCmp !== 0) return diffCmp
          return new Date(a.expense_registered_date).getTime() - new Date(b.expense_registered_date).getTime()
        })
        .slice(0, AUTO_MATCH_CANDIDATE_LIMIT)
      if (options.length === 0) continue

      const defaultCandidate = options.find((o) => !usedForDefaultSelection.has(o.key)) ?? options[0]
      selectedCandidateByLine[line.id] = defaultCandidate.key
      usedForDefaultSelection.add(defaultCandidate.key)
      proposals.push({
        statement_line_id: line.id,
        posted_date: line.posted_date,
        line_amount: amt,
        line_desc: formatStatementLineDescription(line.description, line.merchant),
        candidates: options
      })
    }

    setLoading(false)

    if (proposals.length === 0) {
      setMessage(
        reconciliationPageCount > 1
          ? `이 페이지 (${reconciliationPage}/${reconciliationPageCount})에서 자동 연결할 출금·미매칭 후보가 없습니다.`
          : '자동 연결할 출금·미매칭 후보가 없습니다.'
      )
      return
    }

    setAutoMatchSummaryHint(
      reconciliationPageCount > 1
        ? `페이지 ${reconciliationPage}/${reconciliationPageCount} · 표 ${pagedReconciliationLines.length}행 범위`
        : null
    )
    setAutoMatchProposals(proposals)
    setAutoMatchSelectedIds(new Set(proposals.map((p) => p.statement_line_id)))
    setAutoMatchPreviewPage(1)
    setAutoMatchCandidateSelection(selectedCandidateByLine)
    setAutoMatchPreviewOpen(true)
  }

  const applyAutoMatchProposals = async () => {
    if (!filterAccountId || autoMatchProposals.length === 0) {
      setAutoMatchPreviewOpen(false)
      setAutoMatchProposals([])
      setAutoMatchSummaryHint(null)
      setAutoMatchSelectedIds(new Set())
      setAutoMatchPreviewPage(1)
      setAutoMatchCandidateSelection({})
      return
    }
    const toSave = autoMatchProposals.filter((p) => autoMatchSelectedIds.has(p.statement_line_id))
    if (toSave.length === 0) {
      setMessage('저장할 행을 한 건 이상 선택하세요.')
      return
    }
    setAutoMatchApplying(true)
    let n = 0
    try {
      for (const p of toSave) {
        const selectedKey = autoMatchCandidateSelection[p.statement_line_id] || p.candidates[0]?.key
        const selected = p.candidates.find((c) => c.key === selectedKey) ?? p.candidates[0]
        if (!selected) continue
        const { data: inserted, error } = await supabase
          .from('reconciliation_matches')
          .insert({
            statement_line_id: p.statement_line_id,
            source_table: selected.source_table,
            source_id: selected.source_id,
            matched_amount: p.line_amount,
            matched_by: email || null
          })
          .select('id')
          .maybeSingle()
        if (error) {
          if (!isAbortLikeError(error)) console.error(error)
          continue
        }
        await logReconciliationMatchEvent({
          match_id: inserted?.id ? String(inserted.id) : null,
          statement_line_id: p.statement_line_id,
          action: 'created',
          actor_email: email || null,
          before_source_table: null,
          before_source_id: null,
          after_source_table: selected.source_table,
          after_source_id: selected.source_id,
          before_matched_amount: null,
          after_matched_amount: p.line_amount
        })
        await supabase
          .from('statement_lines')
          .update({ matched_status: 'matched' })
          .eq('id', p.statement_line_id)
        n += 1
      }
    } finally {
      setAutoMatchApplying(false)
    }

    setAutoMatchPreviewOpen(false)
    setAutoMatchProposals([])
    setAutoMatchSummaryHint(null)
    setAutoMatchSelectedIds(new Set())
    setAutoMatchPreviewPage(1)
    setAutoMatchCandidateSelection({})
    setMessage(
      reconciliationPageCount > 1
        ? `자동 매칭 ${n}건 저장됨 (페이지 ${reconciliationPage}/${reconciliationPageCount} 범위)`
        : `자동 매칭 ${n}건 저장됨`
    )
    await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
    await refreshUnmatchedExpenseKeys()
  }

  /** DB에 자동/수동 구분 없음 — reconciliation_matches 전부 삭제 후 명세 줄 대조 상태만 되돌림 */
  const resetAllReconciliationMatches = async () => {
    setResettingAllMatches(true)
    setResetAllMatchesOpen(false)
    setMessage(null)
    try {
      const { error: delErr } = await supabase
        .from('reconciliation_matches')
        .delete()
        .gte('created_at', '1970-01-01T00:00:00.000Z')
      if (delErr) throw delErr

      const { error: upErr } = await supabase
        .from('statement_lines')
        .update({ matched_status: 'unmatched' })
        .in('matched_status', ['matched', 'partial'])
      if (upErr) throw upErr

      setMessage('모든 명세 대조 매칭(지출·입금 연결)이 초기화되었습니다.')
      if (filterAccountId) {
        await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
        await refreshUnmatchedExpenseKeys()
      }
      await loadImports()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '매칭 초기화에 실패했습니다.')
    } finally {
      setResettingAllMatches(false)
    }
  }

  const lockImport = async () => {
    if (!lockTargetImport) return
    if (!canMutateStatementUploads) {
      setMessage(
        '명세 잠금은 info@maniatour.com 계정 또는 team에서 직책이 super인 활성 직원만 사용할 수 있습니다.'
      )
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
      setLines((prev) =>
        prev.map((row) =>
          row.id === line.id
            ? {
                ...row,
                is_personal: next,
                personal_partner: next ? row.personal_partner : null
              }
            : row
        )
      )
    } else {
      const next = !line.exclude_from_pnl
      await supabase.from('statement_lines').update({ exclude_from_pnl: next }).eq('id', line.id)
      setLines((prev) =>
        prev.map((row) => (row.id === line.id ? { ...row, exclude_from_pnl: next } : row))
      )
    }
  }

  const setStatementPersonalPartner = async (
    line: StatementLine,
    partner: 'partner1' | 'partner2' | 'erica' | ''
  ) => {
    await supabase
      .from('statement_lines')
      .update({ personal_partner: partner || null })
      .eq('id', line.id)
    setLines((prev) =>
      prev.map((row) => (row.id === line.id ? { ...row, personal_partner: partner || null } : row))
    )
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
      if (value) {
        const colon = value.indexOf(':')
        const st = value.slice(0, colon)
        const sid = value.slice(colon + 1)
        const existing = lineMatches[0]
        if (existing) {
          if (existing.source_table !== st || existing.source_id !== sid) {
            const { error } = await supabase
              .from('reconciliation_matches')
              .update({
                source_table: st,
                source_id: sid,
                matched_amount: Number(line.amount),
                updated_by: email,
                updated_at: new Date().toISOString()
              } as any)
              .eq('id', existing.id)
            if (error) throw error
            await logReconciliationMatchEvent({
              match_id: existing.id,
              statement_line_id: line.id,
              action: 'updated',
              actor_email: email,
              before_source_table: existing.source_table,
              before_source_id: existing.source_id,
              after_source_table: st,
              after_source_id: sid,
              before_matched_amount: Number(line.amount),
              after_matched_amount: Number(line.amount)
            })
          }
        } else {
          const { data: inserted, error } = await supabase
            .from('reconciliation_matches')
            .insert({
              statement_line_id: line.id,
              source_table: st,
              source_id: sid,
              matched_amount: Number(line.amount),
              matched_by: email
            })
            .select('id')
            .maybeSingle()
          if (error) throw error
          await logReconciliationMatchEvent({
            match_id: inserted?.id ? String(inserted.id) : null,
            statement_line_id: line.id,
            action: 'created',
            actor_email: email,
            before_source_table: null,
            before_source_id: null,
            after_source_table: st,
            after_source_id: sid,
            before_matched_amount: null,
            after_matched_amount: Number(line.amount)
          })
        }
      } else {
        for (const m of lineMatches) {
          await logReconciliationMatchEvent({
            match_id: m.id,
            statement_line_id: line.id,
            action: 'deleted',
            actor_email: email,
            before_source_table: m.source_table,
            before_source_id: m.source_id,
            after_source_table: null,
            after_source_id: null,
            before_matched_amount: Number(line.amount),
            after_matched_amount: null
          })
          await supabase.from('reconciliation_matches').delete().eq('id', m.id)
        }
      }
      await syncLineMatchedFlag(line.id)
      setMessage(value ? '지출 매칭을 저장했습니다.' : '지출 매칭을 해제했습니다.')
      await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
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
      await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
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
      const match = matches.find((m) => m.id === matchRowId)
      const line = lines.find((l) => l.id === lineId)
      if (match) {
        await logReconciliationMatchEvent({
          match_id: match.id,
          statement_line_id: lineId,
          action: 'deleted',
          actor_email: email || null,
          before_source_table: match.source_table,
          before_source_id: match.source_id,
          after_source_table: null,
          after_source_id: null,
          before_matched_amount: line ? Number(line.amount) : null,
          after_matched_amount: null
        })
      }
      await supabase.from('reconciliation_matches').delete().eq('id', matchRowId)
      await syncLineMatchedFlag(lineId)
      await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
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
      exact.sort((a, b) => {
        const priorityCmp = compareExpenseFinancialAccountPriority(a.o, b.o)
        if (priorityCmp !== 0) return priorityCmp
        return String(a.o.submit_on ?? '').localeCompare(String(b.o.submit_on ?? ''))
      })
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
    scored.sort((a, b) => {
      const priorityCmp = compareExpenseFinancialAccountPriority(a.item.o, b.item.o)
      if (priorityCmp !== 0) return priorityCmp
      return b.score - a.score
    })
    const similar = dedupeExpensePickerQuickItems(scored.map((s) => s.item)).slice(0, PICKER_QUICK_MAX)
    if (similar.length > 0) {
      return { list: similar, mode: 'similar' as const }
    }
    return { list: [], mode: 'none' as const }
  }, [
    expensePickerLineId,
    expensePickerLine,
    expenseOptions,
    expenseOptionSelectableFast,
    compareExpenseFinancialAccountPriority
  ])

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
    return dedupeExpenseOptionsByKey(out)
      .sort((a, b) => compareExpenseFinancialAccountPriority(a, b))
      .slice(0, PICKER_SEARCH_MAX)
  }, [
    expensePickerLineId,
    expensePickerLine,
    deferredExpensePickerQuery,
    expenseOptions,
    expenseOptionSelectableFast,
    compareExpenseFinancialAccountPriority
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

  const logReconciliationMatchEvent = useCallback(
    async (event: Omit<ReconciliationMatchEventRow, 'id' | 'occurred_at'>) => {
      const { error } = await (supabase as any).from('reconciliation_match_events').insert(event)
      if (error && !isAbortLikeError(error)) console.error('reconciliation_match_events insert:', error)
    },
    []
  )

  const loadOperationalLedgerRows = useCallback(async () => {
    let startYmd = operationalLedgerStart.trim().slice(0, 10)
    let endYmd = operationalLedgerEnd.trim().slice(0, 10)
    if (!startYmd || !endYmd || startYmd.length < 10 || endYmd.length < 10) {
      setMessage('운영 원장 조회 기간을 선택하세요.')
      return
    }
    if (startYmd > endYmd) {
      const t = startYmd
      startYmd = endYmd
      endYmd = t
    }
    const startIso = new Date(`${startYmd}T00:00:00`).toISOString()
    const endIso = new Date(`${endYmd}T23:59:59.999`).toISOString()
    setOperationalLedgerLoading(true)
    setMessage(null)
    try {
      const [re, ce, pr, tb, hb] = await Promise.all([
        supabase
          .from('reservation_expenses')
          .select('id,amount,submit_on,paid_for,paid_to,note,payment_method')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        (supabase as any)
          .from('company_expenses')
          .select('id,amount,submit_on,paid_for,paid_to,description,payment_method')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        (supabase as any)
          .from('payment_records')
          .select('id,amount,submit_on,reservation_id,note,payment_method')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        (supabase as any)
          .from('ticket_bookings')
          .select('id,expense,submit_on,category,company,note,payment_method')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso),
        (supabase as any)
          .from('tour_hotel_bookings')
          .select('id,total_price,submit_on,check_in_date,hotel,reservation_name,payment_method')
          .gte('submit_on', startIso)
          .lte('submit_on', endIso)
      ])
      const errors = [re.error, ce.error, pr.error, tb.error, hb.error].filter(Boolean)
      if (errors.length > 0) throw errors[0]

      const rows: OperationalLedgerRow[] = [
        ...((re.data || []) as Record<string, unknown>[]).map((r) => ({
          key: operationalLedgerKey('reservation_expenses', String(r.id)),
          source_table: 'reservation_expenses' as const,
          source_id: String(r.id),
          direction: 'outflow' as const,
          date: normalizeDateYmd(String(r.submit_on ?? '')),
          amount: Number(r.amount ?? 0),
          party: String(r.paid_to ?? ''),
          purpose: String(r.paid_for ?? ''),
          note: r.note == null ? null : String(r.note),
          payment_method: expensePaymentMethodFromRow(r),
          already_matched: false
        })),
        ...((ce.data || []) as Record<string, unknown>[]).map((r) => ({
          key: operationalLedgerKey('company_expenses', String(r.id)),
          source_table: 'company_expenses' as const,
          source_id: String(r.id),
          direction: 'outflow' as const,
          date: normalizeDateYmd(String(r.submit_on ?? '')),
          amount: Number(r.amount ?? 0),
          party: String(r.paid_to ?? ''),
          purpose: String(r.paid_for ?? ''),
          note: r.description == null ? null : String(r.description),
          payment_method: expensePaymentMethodFromRow(r),
          already_matched: false
        })),
        ...((pr.data || []) as Record<string, unknown>[]).map((r) => ({
          key: operationalLedgerKey('payment_records', String(r.id)),
          source_table: 'payment_records' as const,
          source_id: String(r.id),
          direction: 'inflow' as const,
          date: normalizeDateYmd(String(r.submit_on ?? '')),
          amount: Number(r.amount ?? 0),
          party: String(r.reservation_id ?? ''),
          purpose: 'payment_record',
          note: r.note == null ? null : String(r.note),
          payment_method: expensePaymentMethodFromRow(r),
          already_matched: false
        })),
        ...((tb.data || []) as Record<string, unknown>[]).map((r) => ({
          key: operationalLedgerKey('ticket_bookings', String(r.id)),
          source_table: 'ticket_bookings' as const,
          source_id: String(r.id),
          direction: 'outflow' as const,
          date: normalizeDateYmd(String(r.submit_on ?? '')),
          amount: Number(r.expense ?? 0),
          party: String(r.company ?? ''),
          purpose: String(r.category ?? ''),
          note: r.note == null ? null : String(r.note),
          payment_method: expensePaymentMethodFromRow(r),
          already_matched: false
        })),
        ...((hb.data || []) as Record<string, unknown>[]).map((r) => ({
          key: operationalLedgerKey('tour_hotel_bookings', String(r.id)),
          source_table: 'tour_hotel_bookings' as const,
          source_id: String(r.id),
          direction: 'outflow' as const,
          date: normalizeDateYmd(String(r.submit_on ?? r.check_in_date ?? '')),
          amount: Number(r.total_price ?? 0),
          party: String(r.hotel ?? ''),
          purpose: String(r.reservation_name ?? '호텔 부킹'),
          note: null,
          payment_method: expensePaymentMethodFromRow(r),
          already_matched: false
        }))
      ].filter((r) => Number.isFinite(r.amount) && r.amount !== 0 && r.date.length >= 10)

      const matched = new Set<string>()
      const byTable = new Map<OperationalLedgerSourceTable, string[]>()
      for (const row of rows) {
        const arr = byTable.get(row.source_table)
        if (arr) arr.push(row.source_id)
        else byTable.set(row.source_table, [row.source_id])
      }
      await Promise.all(
        [...byTable.entries()].map(async ([table, ids]) => {
          const unique = [...new Set(ids)]
          if (unique.length === 0) return
          for (let i = 0; i < unique.length; i += OPERATIONAL_LEDGER_MATCH_IN_CHUNK) {
            const chunk = unique.slice(i, i + OPERATIONAL_LEDGER_MATCH_IN_CHUNK)
            const { data, error } = await (supabase as any)
              .from('reconciliation_matches')
              .select('source_id')
              .eq('source_table', table)
              .in('source_id', chunk)
            if (error) {
              if (!isAbortLikeError(error)) {
                console.error(
                  `reconciliation_matches 조회 실패 (table=${table}, chunk=${i / OPERATIONAL_LEDGER_MATCH_IN_CHUNK + 1})`,
                  error
                )
              }
              continue
            }
            for (const m of data || []) matched.add(operationalLedgerKey(table, String(m.source_id)))
          }
        })
      )

      setOperationalLedgerRows(rows.map((r) => ({ ...r, already_matched: matched.has(r.key) })))
      setStatementCandidatesByLedgerKey({})
      setOperationalLedgerPage(1)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '운영 원장을 불러오지 못했습니다.')
      setOperationalLedgerRows([])
    } finally {
      setOperationalLedgerLoading(false)
    }
  }, [operationalLedgerStart, operationalLedgerEnd])

  const persistOperationalLedgerAmount = useCallback(
    async (row: OperationalLedgerRow, rawInput: string) => {
      if (row.already_matched) {
        setMessage('이미 명세와 연결된 행은 금액을 바꿀 수 없습니다.')
        setOperationalLedgerAmountInputRemount((prev) => ({
          ...prev,
          [row.key]: (prev[row.key] ?? 0) + 1
        }))
        return
      }
      const normalized = rawInput.replace(/,/g, '').trim()
      const parsed = normalized === '' ? NaN : Number(normalized)
      if (!Number.isFinite(parsed)) {
        setMessage('금액을 숫자로 입력하세요.')
        setOperationalLedgerAmountInputRemount((prev) => ({
          ...prev,
          [row.key]: (prev[row.key] ?? 0) + 1
        }))
        return
      }
      const rounded = Math.round(parsed * 100) / 100
      if (rounded < 0) {
        setMessage('금액은 0 이상이어야 합니다.')
        setOperationalLedgerAmountInputRemount((prev) => ({
          ...prev,
          [row.key]: (prev[row.key] ?? 0) + 1
        }))
        return
      }
      if (Math.abs(rounded - row.amount) < 0.005) return

      setOperationalLedgerAmountSavingKey(row.key)
      setMessage(null)
      try {
        const payload = operationalLedgerDbAmountPayload(row.source_table, rounded)
        const { error } = await (supabase as any).from(row.source_table).update(payload).eq('id', row.source_id)
        if (error) throw error
        setOperationalLedgerRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, amount: rounded } : r))
        )
        setStatementCandidatesByLedgerKey((prev) => {
          if (!(row.key in prev)) return prev
          const next = { ...prev }
          delete next[row.key]
          return next
        })
        setStatementCandidateLoadingKeys((prev) => {
          if (!prev.has(row.key)) return prev
          const next = new Set(prev)
          next.delete(row.key)
          return next
        })
        setMessage('금액을 저장했습니다.')
      } catch (e) {
        setMessage(e instanceof Error ? e.message : '금액 저장에 실패했습니다.')
        setOperationalLedgerAmountInputRemount((prev) => ({
          ...prev,
          [row.key]: (prev[row.key] ?? 0) + 1
        }))
      } finally {
        setOperationalLedgerAmountSavingKey(null)
      }
    },
    []
  )

  /** 금융 계정이 연결된 결제수단 — DB에 저장될 수 있는 id·방법명·표시명 키 */
  const operationalLedgerLinkedPaymentKeys = useMemo(() => {
    const s = new Set<string>()
    for (const pm of paymentMethods) {
      if (!pm.financial_account_id) continue
      for (const v of [pm.id, pm.method, pm.display_name]) {
        if (v == null) continue
        const k = String(v).trim()
        if (k) s.add(k)
      }
    }
    return s
  }, [paymentMethods])

  /** 결제수단↔금융계정 연결이 있는 행을 먼저(날짜·테이블은 그 다음) */
  const operationalLedgerSortedRows = useMemo(() => {
    return [...operationalLedgerRows].sort((a, b) => {
      const aKey = a.payment_method?.trim() ?? ''
      const bKey = b.payment_method?.trim() ?? ''
      const aLinked = aKey.length > 0 && operationalLedgerLinkedPaymentKeys.has(aKey)
      const bLinked = bKey.length > 0 && operationalLedgerLinkedPaymentKeys.has(bKey)
      if (aLinked !== bLinked) return aLinked ? -1 : 1
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      return a.source_table.localeCompare(b.source_table)
    })
  }, [operationalLedgerRows, operationalLedgerLinkedPaymentKeys])

  const operationalLedgerFilteredRows = useMemo(() => {
    const q = operationalLedgerSearch.trim().toLowerCase()
    return operationalLedgerSortedRows.filter((row) => {
      if (operationalLedgerScope === 'unmatched' && row.already_matched) return false
      if (operationalLedgerSourceFilter && row.source_table !== operationalLedgerSourceFilter) return false
      if (!q) return true
      const hay = [
        row.date,
        row.amount,
        row.party,
        row.purpose,
        row.note,
        row.source_table,
        row.source_id,
        paymentMethodLabelFromRows(row.payment_method, paymentMethods)
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [
    operationalLedgerSortedRows,
    operationalLedgerScope,
    operationalLedgerSourceFilter,
    operationalLedgerSearch,
    paymentMethods
  ])

  const operationalLedgerPageCount = useMemo(
    () => Math.max(1, Math.ceil(operationalLedgerFilteredRows.length / OPERATIONAL_LEDGER_PAGE_SIZE)),
    [operationalLedgerFilteredRows.length]
  )

  const pagedOperationalLedgerRows = useMemo(() => {
    const start = (operationalLedgerPage - 1) * OPERATIONAL_LEDGER_PAGE_SIZE
    return operationalLedgerFilteredRows.slice(start, start + OPERATIONAL_LEDGER_PAGE_SIZE)
  }, [operationalLedgerFilteredRows, operationalLedgerPage])

  useEffect(() => {
    setOperationalLedgerPage((p) => Math.min(Math.max(1, p), operationalLedgerPageCount))
  }, [operationalLedgerPageCount])

  const findStatementCandidatesForLedgerRow = useCallback(
    async (row: OperationalLedgerRow) => {
      setStatementCandidateLoadingKeys((prev) => {
        const next = new Set(prev)
        next.add(row.key)
        return next
      })
      setMessage(null)
      try {
        const startYmd = addCalendarDaysYmd(row.date, -7)
        const endYmd = addCalendarDaysYmd(row.date, 7)
        const importIds = imports
          .filter((im) => im.period_start.slice(0, 10) <= endYmd && im.period_end.slice(0, 10) >= startYmd)
          .map((im) => im.id)
        if (importIds.length === 0) {
          setStatementCandidatesByLedgerKey((prev) => ({ ...prev, [row.key]: [] }))
          return
        }
        const importToAccount = new Map(imports.map((im) => [im.id, im.financial_account_id]))
        const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))
        const all: StatementLineCandidate[] = []
        for (let i = 0; i < importIds.length; i += 80) {
          const chunk = importIds.slice(i, i + 80)
          const { data, error } = await (supabase as any)
            .from('statement_lines')
            .select('id,statement_import_id,posted_date,amount,direction,description,merchant,matched_status')
            .in('statement_import_id', chunk)
            .gte('posted_date', startYmd)
            .lte('posted_date', endYmd)
            .eq('direction', row.direction)
          if (error) throw error
          for (const line of (data || []) as Record<string, unknown>[]) {
            const lineAmount = Number(line.amount ?? 0)
            const amountDiff = Math.abs(Math.abs(lineAmount) - Math.abs(row.amount))
            const dayDiff = dayDiffFromYmd(String(line.posted_date ?? ''), row.date)
            if (amountDiff > Math.max(5, Math.abs(row.amount) * 0.05)) continue
            const importId = String(line.statement_import_id ?? '')
            const accountId = importToAccount.get(importId) || ''
            const pmAccountId = row.payment_method ? paymentMethodFinancialAccountById.get(row.payment_method) : null
            const accountBonus = pmAccountId && pmAccountId === accountId ? 20 : 0
            const exactBonus = amountDiff < 0.02 ? 40 : 0
            all.push({
              id: String(line.id),
              financial_account_id: accountId,
              financial_account_name: accountNameById.get(accountId) || accountId || '—',
              posted_date: String(line.posted_date ?? ''),
              direction: String(line.direction ?? ''),
              amount: lineAmount,
              description: formatStatementLineDescription(
                line.description == null ? null : String(line.description),
                line.merchant == null ? null : String(line.merchant)
              ),
              matched_status: String(line.matched_status ?? ''),
              amount_diff: amountDiff,
              day_diff: dayDiff,
              score: 100 + exactBonus + accountBonus - amountDiff * 10 - dayDiff * 3
            })
          }
        }
        const exactAmountCandidates = all.filter((c) => c.amount_diff < 0.02)
        const displayCandidates = exactAmountCandidates.length > 0 ? exactAmountCandidates : all
        displayCandidates.sort((a, b) => {
          if ((a.matched_status === 'unmatched') !== (b.matched_status === 'unmatched')) {
            return a.matched_status === 'unmatched' ? -1 : 1
          }
          const score = b.score - a.score
          if (score !== 0) return score
          const amt = a.amount_diff - b.amount_diff
          if (amt !== 0) return amt
          return a.day_diff - b.day_diff
        })
        setStatementCandidatesByLedgerKey((prev) => ({ ...prev, [row.key]: displayCandidates.slice(0, 8) }))
      } catch (e) {
        setMessage(e instanceof Error ? e.message : '명세 후보를 찾지 못했습니다.')
      } finally {
        setStatementCandidateLoadingKeys((prev) => {
          const next = new Set(prev)
          next.delete(row.key)
          return next
        })
      }
    },
    [imports, accounts, paymentMethodFinancialAccountById]
  )

  useEffect(() => {
    if (reconciliationViewTab !== 'operational-ledger' || operationalLedgerLoading) return
    if (imports.length === 0 || accounts.length === 0) return
    const rowsToLoad = pagedOperationalLedgerRows.filter(
      (row) => !row.already_matched && statementCandidatesByLedgerKey[row.key] === undefined
    )
    if (rowsToLoad.length === 0) return

    let cancelled = false
    ;(async () => {
      for (const row of rowsToLoad) {
        if (cancelled) break
        await findStatementCandidatesForLedgerRow(row)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    reconciliationViewTab,
    operationalLedgerLoading,
    imports.length,
    accounts.length,
    pagedOperationalLedgerRows,
    statementCandidatesByLedgerKey,
    findStatementCandidatesForLedgerRow
  ])

  const saveOperationalLedgerMatch = useCallback(
    async (row: OperationalLedgerRow, candidate: StatementLineCandidate) => {
      if (!email) {
        setMessage('로그인이 필요합니다.')
        return
      }
      if (row.already_matched) {
        setMessage('이미 명세와 연결된 운영 원장 행입니다.')
        return
      }
      setLoading(true)
      setMessage(null)
      try {
        const { data: inserted, error } = await (supabase as any)
          .from('reconciliation_matches')
          .insert({
            statement_line_id: candidate.id,
            source_table: row.source_table,
            source_id: row.source_id,
            matched_amount: candidate.amount,
            matched_by: email
          })
          .select('id')
          .maybeSingle()
        if (error) throw error
        await logReconciliationMatchEvent({
          match_id: inserted?.id ? String(inserted.id) : null,
          statement_line_id: candidate.id,
          action: 'created',
          actor_email: email,
          before_source_table: null,
          before_source_id: null,
          after_source_table: row.source_table,
          after_source_id: row.source_id,
          before_matched_amount: null,
          after_matched_amount: candidate.amount
        })
        await (supabase as any).from('statement_lines').update({ matched_status: 'matched' }).eq('id', candidate.id)
        setOperationalLedgerRows((prev) =>
          prev.map((r) => (r.key === row.key ? { ...r, already_matched: true } : r))
        )
        setMessage('운영 원장 행을 명세와 매칭했습니다.')
        if (filterAccountId) await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
      } catch (e) {
        setMessage(e instanceof Error ? e.message : '매칭 저장 실패')
      } finally {
        setLoading(false)
      }
    },
    [email, filterAccountId, loadLinesAndMatchesForAccount, logReconciliationMatchEvent]
  )

  const selectedAccountLabel = useMemo(
    () => accountsForReconciliation.find((a) => a.id === filterAccountId)?.name ?? '—',
    [accountsForReconciliation, filterAccountId]
  )

  const displayNameForEmail = useCallback(
    (value: string | null | undefined) => {
      const em = value?.trim()
      if (!em) return '—'
      return teamDisplayNamesByEmail[em.toLowerCase()] || em
    },
    [teamDisplayNamesByEmail]
  )

  const loadMatchHistory = useCallback(async (target: {
    line: StatementLine
    match: ReconciliationMatchRow
    expense?: ExpenseOption
  }) => {
    setMatchHistoryTarget(target)
    setMatchHistoryRows([])
    setMatchHistoryError(null)
    setMatchHistoryLoading(true)
    try {
      const { data, error } = await (supabase as any)
        .from('reconciliation_match_events')
        .select(
          'id,match_id,statement_line_id,action,actor_email,occurred_at,before_source_table,before_source_id,after_source_table,after_source_id,before_matched_amount,after_matched_amount'
        )
        .eq('statement_line_id', target.line.id)
        .order('occurred_at', { ascending: false })
      if (error) throw error
      setMatchHistoryRows((data || []) as ReconciliationMatchEventRow[])
    } catch (e) {
      setMatchHistoryError(
        e instanceof Error
          ? e.message
          : '매칭 이력을 불러오지 못했습니다. 마이그레이션 적용 여부를 확인하세요.'
      )
    } finally {
      setMatchHistoryLoading(false)
    }
  }, [])

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={accountsForReconciliation.length === 0}
            onClick={() => setLinkedCardsModalOpen(true)}
            aria-label="계정별 연결 카드 보기 및 연결 편집"
          >
            <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
            계정별 연결 카드
          </Button>
          <span className="text-[11px] text-slate-500">
            활성 금융 계정마다 어떤 카드가 연결됐는지 모달에서 보고, 연결을 바로 바꿀 수 있습니다.
          </span>
        </div>
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
              setPaymentLinkModalOpen(true)
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

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            reconciliationViewTab === 'statements'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => setReconciliationViewTab('statements')}
        >
          명세 대조
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            reconciliationViewTab === 'operational-ledger'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => setReconciliationViewTab('operational-ledger')}
        >
          운영 지출입 찾기
        </button>
      </div>

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
            await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
            await refreshUnmatchedExpenseKeys()
          }
        }}
      />

      <StatementBulkExpenseModal
        open={bulkCompanyExpenseModalOpen}
        onOpenChange={setBulkCompanyExpenseModalOpen}
        candidateLines={bulkCompanyExpenseCandidates}
        financialAccountId={filterAccountId}
        defaultPaymentMethodId={defaultPaymentMethodIdForAccount}
        email={email}
        onCompleted={async () => {
          setMessage('선택한 명세 줄에 지출을 생성·연결했습니다.')
          if (filterAccountId) {
            await loadLinesAndMatchesForAccount(filterAccountId, { force: true })
            await refreshUnmatchedExpenseKeys()
          }
        }}
      />

      <Dialog
        open={autoMatchPreviewOpen}
        onOpenChange={(open) => {
          if (!open && autoMatchApplying) return
          setAutoMatchPreviewOpen(open)
          if (!open) {
            setAutoMatchProposals([])
            setAutoMatchSummaryHint(null)
            setAutoMatchSelectedIds(new Set())
            setAutoMatchPreviewPage(1)
            setAutoMatchCandidateSelection({})
          }
        }}
      >
        <DialogContent
          className="w-[min(98vw,110rem)] max-w-[min(98vw,110rem)] max-h-[min(92vh,860px)] flex flex-col p-0 gap-0"
          onPointerDownOutside={(e) => {
            if (autoMatchApplying) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (autoMatchApplying) e.preventDefault()
          }}
        >
          <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left space-y-1">
            <DialogTitle className="text-base flex items-center gap-2">
              <Wand2 className="h-5 w-5 shrink-0 text-slate-600" />
              <AccountingTerm termKey="자동매칭">자동 매칭</AccountingTerm> 미리보기
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-600">
              체크한 행만 저장됩니다. 저장하지 않을 행은 선택을 해제하세요. 취소하면 아무 것도 저장되지 않습니다.
              선택된 금융 계정에 연결된 결제수단의 지출은 후보 목록에서 우선 표시됩니다.
              {autoMatchSummaryHint ? (
                <span className="block mt-1 text-slate-700">{autoMatchSummaryHint}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="px-2 sm:px-4 py-2 overflow-auto flex-1 min-h-0">
            <table className="w-full min-w-[106rem] text-[11px] sm:text-xs border-collapse">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-1.5 pr-1 w-8 text-center">
                    <input
                      ref={autoMatchSelectAllRef}
                      type="checkbox"
                      className="rounded border-slate-300 align-middle"
                      checked={autoMatchPageAllSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAutoMatchSelectedIds((prev) => {
                            const next = new Set(prev)
                            for (const row of autoMatchPagedProposals) {
                              next.add(row.statement_line_id)
                            }
                            return next
                          })
                        } else {
                          setAutoMatchSelectedIds((prev) => {
                            const next = new Set(prev)
                            for (const row of autoMatchPagedProposals) {
                              next.delete(row.statement_line_id)
                            }
                            return next
                          })
                        }
                      }}
                      title="이 페이지 후보 전체 선택/해제"
                      aria-label="미리보기 행 전체 선택"
                    />
                  </th>
                  <th className="py-1.5 pr-2 font-medium w-[5.5rem]">명세일</th>
                  <th className="py-1.5 pr-2 font-medium text-right w-[4.5rem]">금액</th>
                  <th className="py-1.5 pr-2 font-medium min-w-[14rem]">명세 설명</th>
                  <th className="py-1.5 pr-2 font-medium min-w-[18rem]">후보 선택</th>
                  <th className="py-1.5 pr-2 font-medium w-[5.5rem]">연결 출처</th>
                  <th className="py-1.5 pr-2 font-medium w-[6.5rem]">등록 날짜</th>
                  <th className="py-1.5 pr-2 font-medium text-right w-[6rem]">지출 금액</th>
                  <th className="py-1.5 pr-2 font-medium min-w-[10rem]">Paid To</th>
                  <th className="py-1.5 pr-2 font-medium min-w-[12rem]">Paid For</th>
                  <th className="py-1.5 pr-2 font-medium min-w-[12rem]">표준 결제 카테고리</th>
                  <th className="py-1.5 font-medium min-w-[10rem]">지출 요약</th>
                  <th className="py-1.5 pl-1 font-medium text-right w-[3rem]">점수</th>
                </tr>
              </thead>
              <tbody>
                {autoMatchPagedProposals.map((p) => {
                  const selectedKey = autoMatchCandidateSelection[p.statement_line_id] || p.candidates[0]?.key
                  const selected = p.candidates.find((c) => c.key === selectedKey) ?? p.candidates[0]
                  const amountDiff = selected ? Math.abs(selected.expense_amount - p.line_amount) : 0
                  return (
                  <tr key={p.statement_line_id} className="border-b border-slate-100 align-top">
                    <td className="py-1.5 pr-1 text-center align-middle">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={autoMatchSelectedIds.has(p.statement_line_id)}
                        onChange={() => {
                          setAutoMatchSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(p.statement_line_id)) next.delete(p.statement_line_id)
                            else next.add(p.statement_line_id)
                            return next
                          })
                        }}
                        aria-label="이 행 저장 여부"
                      />
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-800">{p.posted_date}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      ${Number(p.line_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-800 break-words">{p.line_desc || '—'}</td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={selected?.key ?? ''}
                        onChange={(e) => {
                          const nextKey = e.target.value
                          setAutoMatchCandidateSelection((prev) => ({
                            ...prev,
                            [p.statement_line_id]: nextKey
                          }))
                        }}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                        aria-label="자동 매칭 후보 선택"
                      >
                        {p.candidates.map((c, idx) => {
                          const diff = Math.abs(c.expense_amount - p.line_amount)
                          return (
                            <option key={c.key} value={c.key}>
                              {idx + 1}. {AUTO_MATCH_SOURCE_LABEL[c.source_table]} · $
                              {c.expense_amount.toFixed(2)}
                              {diff >= 0.015 ? ` (차이 $${diff.toFixed(2)})` : ''} ·{' '}
                              {formatExpenseSubmitOnUsMdY(c.expense_registered_date)} ·{' '}
                              {c.expense_paid_for || c.expense_label}
                            </option>
                          )
                        })}
                      </select>
                      {p.candidates.length > 1 ? (
                        <p className="mt-1 text-[10px] text-slate-500">
                          후보 {p.candidates.length}개 중 선택
                        </p>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-700 whitespace-nowrap">
                      {selected ? AUTO_MATCH_SOURCE_LABEL[selected.source_table] : '—'}
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums text-slate-700">
                      {selected ? formatExpenseSubmitOnUsMdY(selected.expense_registered_date) : '—'}
                    </td>
                    <td
                      className={`py-1.5 pr-2 text-right tabular-nums ${
                        amountDiff >= 0.015 ? 'font-semibold text-amber-800' : 'text-slate-700'
                      }`}
                    >
                      {selected ? `$${selected.expense_amount.toFixed(2)}` : '—'}
                      {amountDiff >= 0.015 ? (
                        <div className="text-[10px] font-normal text-amber-700">
                          차이 ${amountDiff.toFixed(2)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-700 break-words">{selected?.expense_paid_to || '—'}</td>
                    <td className="py-1.5 pr-2 text-slate-700 break-words">{selected?.expense_paid_for || '—'}</td>
                    <td className="py-1.5 pr-2 text-slate-700 break-words">
                      {selected?.expense_standard_paid_for || '—'}
                    </td>
                    <td className="py-1.5 text-slate-700 break-words">{selected?.expense_label || '—'}</td>
                    <td className="py-1.5 pl-1 text-right tabular-nums text-slate-600">
                      {selected ? selected.score.toFixed(0) : '—'}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter className="px-4 py-3 border-t border-slate-100 shrink-0 gap-2 sm:gap-2">
            <div className="mr-auto flex items-center gap-2 text-xs text-slate-600">
              <span>
                페이지 <strong>{normalizedAutoMatchPreviewPage}</strong>/<strong>{autoMatchPreviewPageCount}</strong>
              </span>
              <span>
                현재 페이지 선택 <strong>{autoMatchPageSelectedCount}</strong>/<strong>{autoMatchPagedProposals.length}</strong>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={normalizedAutoMatchPreviewPage <= 1}
                onClick={() => setAutoMatchPreviewPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2"
                disabled={normalizedAutoMatchPreviewPage >= autoMatchPreviewPageCount}
                onClick={() => setAutoMatchPreviewPage((p) => Math.min(autoMatchPreviewPageCount, p + 1))}
              >
                다음
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={autoMatchApplying}
              onClick={() => {
                setAutoMatchPreviewOpen(false)
                setAutoMatchProposals([])
                setAutoMatchSummaryHint(null)
                setAutoMatchSelectedIds(new Set())
                setAutoMatchPreviewPage(1)
                setAutoMatchCandidateSelection({})
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={autoMatchApplying || autoMatchSelectedIds.size === 0}
              title={autoMatchSelectedIds.size === 0 ? '저장할 행을 선택하세요' : undefined}
              onClick={() => void applyAutoMatchProposals()}
            >
              {autoMatchApplying
                ? '저장 중…'
                : `선택 저장 (${autoMatchSelectedIds.size}/${autoMatchProposals.length}건)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  을 실행하면 <strong>미리보기</strong>가 나오고, 내용을 확인한 뒤 <strong>저장</strong>할 때만 DB에 반영됩니다. 표 하단 페이지네이션에서 <strong>지금 보이는 페이지</strong>에 한해, 금액이 같고 날짜가 가까운 기존 지출(회사/투어/예약/입장권 부킹)과 연결됩니다. 나머지는 페이지를 넘겨 가며 반복합니다.
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
              {accounts.map((a) => {
                const modeRaw = (a.statement_csv_direction_mode ?? 'auto') as string
                const stored: StatementCsvDirectionMode = ['auto', 'invert', 'no_invert'].includes(modeRaw)
                  ? (modeRaw as StatementCsvDirectionMode)
                  : 'auto'
                /** 라디오 표시: 예전 auto 는 계정 유형과 동일한 효과로 보여 줌 */
                const csvRadioValue: 'invert' | 'no_invert' =
                  stored === 'invert' || (stored === 'auto' && a.account_type === 'credit_card')
                    ? 'invert'
                    : 'no_invert'
                return (
                  <li
                    key={a.id}
                    className="py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between gap-x-3"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-gray-800">{a.name}</span>
                      <span className="text-gray-400 ml-2">{a.account_type}</span>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 sm:items-end w-full sm:w-auto max-w-full">
                      <fieldset className="min-w-0 w-full sm:max-w-md space-y-1.5 border-0 p-0 m-0">
                        <legend className="text-xs text-gray-500 mb-0.5">CSV 가져오기 시 지출·수입 해석</legend>
                        <div className="flex flex-col gap-2 text-xs text-gray-800">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              className="mt-0.5 shrink-0"
                              name={`statement_csv_mode_${a.id}`}
                              value="invert"
                              checked={csvRadioValue === 'invert'}
                              disabled={
                                savingStatementCsvModeFor === a.id ||
                                flippingStatementDirectionsFor === a.id ||
                                loading
                              }
                              onChange={() => void saveAccountStatementCsvDirection(a.id, 'invert')}
                            />
                            <span>항상 반전 (양수 = 지출)</span>
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              className="mt-0.5 shrink-0"
                              name={`statement_csv_mode_${a.id}`}
                              value="no_invert"
                              checked={csvRadioValue === 'no_invert'}
                              disabled={
                                savingStatementCsvModeFor === a.id ||
                                flippingStatementDirectionsFor === a.id ||
                                loading
                              }
                              onChange={() => void saveAccountStatementCsvDirection(a.id, 'no_invert')}
                            />
                            <span>반전 안 함 (음수·괄호 = 지출)</span>
                          </label>
                        </div>
                        {stored === 'auto' && (
                          <p className="text-[11px] text-amber-800/90 leading-snug">
                            현재 DB 값은 「자동」입니다. 위에서 하나를 고르면 그대로 저장되어 앞으로 CSV에 적용됩니다.
                          </p>
                        )}
                      </fieldset>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs w-full sm:w-auto shrink-0"
                        disabled={
                          !canMutateStatementUploads ||
                          Boolean(flippingStatementDirectionsFor) ||
                          savingStatementCsvModeFor === a.id ||
                          loading
                        }
                        title="이미 DB에 있는 명세 줄의 지출·수입만 반전합니다. 위 CSV 규칙과는 별개입니다."
                        onClick={() => void flipExistingStatementLineDirections(a.id)}
                      >
                        <RotateCcw
                          className={`h-3.5 w-3.5 mr-1 ${flippingStatementDirectionsFor === a.id ? 'animate-spin' : ''}`}
                        />
                        {flippingStatementDirectionsFor === a.id ? '처리 중…' : '기존 데이터 반전하기'}
                      </Button>
                    </div>
                  </li>
                )
              })}
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
                CSV 업로드·가져오기는 <strong>info@maniatour.com</strong> 또는 team 직책{' '}
                <strong>super</strong> 활성 직원만 사용할 수 있습니다. (조회·대조는 그대로 가능합니다.)
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
            <p className="text-xs text-gray-500 leading-relaxed">
              카드사 CSV마다 금액 부호가 다릅니다. 이용(지출)이 <strong>수입</strong>으로 잡히면 상단{' '}
              <strong>금융 계정</strong> 모달에서 해당 계정의 <strong>CSV 가져오기 시 지출·수입 해석</strong>을{' '}
              <strong>반전 안 함 (음수·괄호 = 지출)</strong> 또는 <strong>항상 반전 (양수 = 지출)</strong> 중 맞는 쪽으로
              고른 뒤 다시 가져오세요. (Bonvoy Amex·MGM 등은 보통 반전 안 함)
            </p>
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
            {csvImportParsePreview.status === 'need_account' && (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
                미리보기: <strong>금융 계정</strong>을 선택하면, 해당 계정에 저장된 CSV 부호 규칙과 해석 샘플이
                표시됩니다.
              </div>
            )}
            {csvImportParsePreview.status === 'need_csv' && (
              <div className="rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 space-y-1.5 text-xs text-slate-800">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>
                    <strong>{csvImportParsePreview.accountName}</strong>
                  </span>
                  <span className="text-slate-600">· 규칙: {csvImportParsePreview.ruleLabel}</span>
                  <span className="text-slate-600">
                    · 부호 반전:{' '}
                    <strong
                      className={
                        csvImportParsePreview.invertApplied ? 'text-amber-900' : 'text-slate-800'
                      }
                    >
                      {csvImportParsePreview.invertApplied ? '적용' : '미적용'}
                    </strong>
                  </span>
                </div>
                <p className="text-slate-500">CSV 내용을 붙여 넣거나 파일을 선택하면 상위 {CSV_IMPORT_PREVIEW_MAX}행 미리보기가 나옵니다.</p>
              </div>
            )}
            {csvImportParsePreview.status === 'ready' && (
              <div className="rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 space-y-2 text-xs text-slate-800">
                <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span>
                    <strong>{csvImportParsePreview.accountName}</strong>
                  </span>
                  <span className="text-slate-600">· 규칙: {csvImportParsePreview.ruleLabel}</span>
                  <span className="text-slate-600">
                    · 부호 반전:{' '}
                    <strong
                      className={
                        csvImportParsePreview.invertApplied ? 'text-amber-900' : 'text-slate-800'
                      }
                    >
                      {csvImportParsePreview.invertApplied ? '적용' : '미적용'}
                    </strong>
                  </span>
                </div>
                {csvImportParsePreview.rows.length === 0 ? (
                  <p className="text-amber-900">
                    파싱된 데이터 행이 없습니다. 첫 줄 헤더·날짜·금액 열을 확인하세요.
                  </p>
                ) : (
                  <>
                    <p className="text-slate-600">
                      해석 미리보기 (앞 {csvImportParsePreview.rows.length}행 / 파싱 성공{' '}
                      {csvImportParsePreview.totalParsed}행)
                    </p>
                    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                      <table className="w-full min-w-[280px] text-left text-[11px] sm:text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                            <th className="p-1.5 font-medium whitespace-nowrap">거래일</th>
                            <th className="p-1.5 font-medium whitespace-nowrap">구분</th>
                            <th className="p-1.5 font-medium text-right whitespace-nowrap">금액</th>
                            <th className="p-1.5 font-medium">설명</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvImportParsePreview.rows.map((r, idx) => (
                            <tr
                              key={`${r.postedDate}-${idx}-${r.description?.slice(0, 24)}`}
                              className="border-b border-slate-100 last:border-b-0"
                            >
                              <td className="p-1.5 whitespace-nowrap font-mono align-top">{r.postedDate}</td>
                              <td className="p-1.5 whitespace-nowrap align-top">
                                {r.direction === 'outflow'
                                  ? '지출'
                                  : r.direction === 'inflow'
                                    ? '수입'
                                    : r.direction}
                              </td>
                              <td className="p-1.5 text-right font-mono whitespace-nowrap align-top">
                                ${Number(r.amount).toFixed(2)}
                              </td>
                              <td
                                className="p-1.5 max-w-[10rem] sm:max-w-[22rem] truncate align-top"
                                title={formatStatementLineDescription(r.description, r.merchant)}
                              >
                                {formatStatementLineDescription(r.description, r.merchant)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
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

      <PaymentMethodFinancialAccountLinkModal
        open={paymentLinkModalOpen}
        onOpenChange={setPaymentLinkModalOpen}
        locale={locale}
        onSaved={() => {
          void loadPaymentMethods(true)
          setMessage('결제수단–금융 계정 연결을 저장했습니다.')
        }}
      />

      <FinancialAccountLinkedCardsModal
        open={linkedCardsModalOpen}
        onOpenChange={setLinkedCardsModalOpen}
        locale={locale}
        reconciliationAccounts={accountsForReconciliation}
        initialAccountId={filterAccountId}
        onOpenFlatLinkModal={() => setPaymentLinkModalOpen(true)}
        onSaved={() => {
          void loadPaymentMethods(true)
          setMessage('계정별 연결 카드를 저장했습니다.')
        }}
      />

      {reconciliationViewTab === 'statements' ? (
        <>
      <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-sm text-emerald-950 min-w-0">
            {filterAccountId
              ? `금융 계정별 명세·대조 월 통계 (${selectedAccountLabel})`
              : '금융 계정별 명세·대조 월 통계'}
          </h3>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-2 text-sm">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={reconciliationLinesLoading || !filterAccountId}
              onClick={() => {
                if (filterAccountId) void loadLinesAndMatchesForAccount(filterAccountId, { force: true })
              }}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${reconciliationLinesLoading ? 'animate-spin' : ''}`} />
              명세·통계 새로고침
            </Button>
          </div>
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
                      {reconciliationLinesLoading ? (
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

        {filterAccountId ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-gray-100 pt-2 mt-1 text-xs text-gray-700">
            <span className="font-medium text-gray-600 shrink-0">표 거래일</span>
            <input
              type="date"
              aria-label="명세 대조 표 시작일"
              className="border border-gray-200 rounded px-2 py-1 text-sm h-9 bg-white max-w-[11rem]"
              value={statementTableDateStart}
              onChange={(e) => setStatementTableDateStart(e.target.value)}
            />
            <span className="text-gray-500 shrink-0">~</span>
            <input
              type="date"
              aria-label="명세 대조 표 종료일"
              className="border border-gray-200 rounded px-2 py-1 text-sm h-9 bg-white max-w-[11rem]"
              value={statementTableDateEnd}
              onChange={(e) => setStatementTableDateEnd(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-gray-600 shrink-0"
              disabled={!statementTableDateRangeActive}
              onClick={() => {
                setStatementTableDateStart('')
                setStatementTableDateEnd('')
              }}
            >
              범위 지우기
            </Button>
            <span className="text-[10px] text-gray-500 leading-snug min-w-0 max-w-full sm:max-w-[28rem]">
              월 필터와 함께 적용됩니다. 한쪽만 넣으면 그날 이후·이전만 걸립니다.
            </span>
          </div>
        ) : null}

        {filterAccountId && (
          <p className="text-sm text-gray-600 flex flex-wrap gap-x-2 gap-y-1">
            <span>
              레지스터: <strong>{selectedAccountLabel}</strong>
            </span>
            <span>·</span>
            <span>
              DB 명세 업로드 <strong>{importsForAccount.length}</strong>건 합산 표시
            </span>
            {filterAccountId && !unmatchedSidebarOpen ? (
              <>
                <span>·</span>
                <span className="text-slate-600">
                  미매칭 지출 패널은 접혀 있어 지·입금 후보를 불러오지 않았습니다. 오른쪽(또는 아래)에서{' '}
                  <strong>펼치기</strong>를 누르면 조회합니다.
                </span>
              </>
            ) : null}
            {unmatchedExpenseQueryStart && unmatchedExpenseQueryEnd ? (
              <>
                <span>·</span>
                <span>
                  미매칭 지출 조회 {unmatchedExpenseQueryStart} ~ {unmatchedExpenseQueryEnd}
                </span>
              </>
            ) : accountExpenseWindow ? (
              <>
                <span>·</span>
                <span>
                  명세 업로드 기간 {accountExpenseWindow.period_start} ~ {accountExpenseWindow.period_end}
                </span>
              </>
            ) : null}
            {statementTableDateRangeActive ? (
              <>
                <span>·</span>
                <span>
                  표 거래일 필터{' '}
                  <strong className="tabular-nums">
                    {statementTableDateStart.trim().slice(0, 10) || '…'} ~{' '}
                    {statementTableDateEnd.trim().slice(0, 10) || '…'}
                  </strong>
                </span>
              </>
            ) : null}
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
            {reconciliationLinesLoading ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                  명세 표 불러오는 중…
                </span>
              </>
            ) : null}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={prepareAutoMatch}
            disabled={
              loading ||
              reconciliationLinesLoading ||
              !filterAccountId ||
              !accountExpenseWindow ||
              autoMatchPreviewOpen ||
              autoMatchApplying
            }
            title={`표에서 지금 보이는 페이지(최대 ${RECONCILIATION_PAGE_SIZE}행)의 출금·아직 매칭 없는 줄만 후보로 잡습니다. 미리보기에서 확인한 뒤 저장할 때만 반영됩니다.`}
          >
            <Wand2 className="h-4 w-4 mr-1" />
            <AccountingTerm termKey="자동매칭">자동 매칭</AccountingTerm>
            {reconciliationTableLines.length > RECONCILIATION_PAGE_SIZE ? (
              <span className="ml-1 text-[11px] font-normal text-slate-600">
                (페이지 {reconciliationPage}/{reconciliationPageCount})
              </span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setBulkCompanyExpenseModalOpen(true)}
            disabled={
              loading ||
              reconciliationLinesLoading ||
              !filterAccountId ||
              !accountExpenseWindow ||
              !canMutateStatementUploads ||
              bulkCompanyExpenseCandidates.length === 0
            }
            title="회사·투어·예약·입장권 지출을 미리보기에서 고른 뒤 일괄 저장합니다. 회사 지출은 규칙·과거 설명으로 제안됩니다. 대상은 표의 출금·미연결 줄 최대 200건입니다."
          >
            <ListPlus className="h-4 w-4 mr-1 shrink-0" />
            지출 일괄 입력
            {bulkCompanyExpenseCandidates.length >= 200 ? (
              <span className="ml-1 text-[11px] font-normal text-slate-600">(최대 200건)</span>
            ) : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={lockImport}
            disabled={loading || !lockTargetImport || !canMutateStatementUploads}
            title={
              !canMutateStatementUploads
                ? 'info@maniatour.com 또는 team 직책 super만 잠글 수 있습니다.'
                : importsForAccount.length > 1
                  ? '가장 최근 명세 업로드(기간 종료일 기준) 한 건을 잠급니다.'
                  : undefined
            }
          >
            <Lock className="h-4 w-4 mr-1" />
            <AccountingTerm termKey="명세잠금">명세 잠금</AccountingTerm>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-amber-300 text-amber-900 hover:bg-amber-50"
            onClick={() => setResetAllMatchesOpen(true)}
            disabled={
              loading ||
              resettingAllMatches ||
              autoMatchApplying ||
              !filterAccountId
            }
            title="모든 금융 계정 공통으로 저장된 대조 연결을 삭제합니다."
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            매칭 전부 초기화
          </Button>
        </div>

        <AlertDialog open={resetAllMatchesOpen} onOpenChange={setResetAllMatchesOpen}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>대조 매칭을 모두 초기화할까요?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-700 space-y-2">
                <span className="block">
                  <code className="text-xs bg-slate-100 px-1 rounded border">reconciliation_matches</code>의{' '}
                  <strong>모든 행</strong>이 삭제되고, 명세 줄의 대조 상태가 미대조로 돌아갑니다. 자동 매칭만이
                  아니라 수동으로 연결한 지출·입금 매칭도 함께 제거됩니다.
                </span>
                <span className="block font-medium text-amber-900">되돌릴 수 없으니 필요할 때만 실행하세요.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resettingAllMatches}>취소</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={resettingAllMatches}
                onClick={() => void resetAllReconciliationMatches()}
              >
                {resettingAllMatches ? '처리 중…' : '전부 초기화'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0 min-w-0 xl:h-[min(78vh,780px)] xl:min-h-[22rem]">
          <div className="min-w-0 flex-1 flex flex-col min-h-0 xl:min-h-0">
          <div
            className="relative flex-1 min-h-0 overflow-x-auto overflow-y-auto -mx-1 px-1 sm:mx-0 sm:px-0 touch-pan-x rounded-md border border-slate-100/80 bg-white"
            aria-busy={reconciliationLinesLoading}
          >
            {reconciliationLinesLoading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[1px]"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-8 w-8 animate-spin text-slate-600" aria-hidden />
                <span className="text-sm font-medium text-slate-700">명세 줄 불러오는 중…</span>
              </div>
            )}
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
                                    className="min-w-0 flex-1 text-[11px] leading-snug text-slate-800 space-y-0.5"
                                    title={
                                      linkedExpenseOpt
                                        ? [
                                            expenseSourceTableAriaLabel(expenseMatch.source_table),
                                            `등록: ${formatExpenseSubmitOnUsMdY(linkedExpenseOpt.submit_on)}`,
                                            `금액: $${Number(linkedExpenseOpt.amount).toFixed(2)}`,
                                            `paid_to: ${linkedExpenseOpt.paid_to || '—'}`,
                                            `paid_for: ${linkedExpenseOpt.paid_for || '—'}`,
                                            `description: ${linkedExpenseOpt.description || '—'}`
                                          ].join('\n')
                                        : `${expenseSourceTableAriaLabel(expenseMatch.source_table)} · ${expenseMatch.source_id}`
                                    }
                                  >
                                    {linkedExpenseOpt ? (
                                      <>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight">
                                          <span className="tabular-nums text-slate-700">
                                            {formatExpenseSubmitOnUsMdY(linkedExpenseOpt.submit_on)}
                                          </span>
                                          <span className="tabular-nums font-medium">
                                            ${Number(linkedExpenseOpt.amount).toFixed(2)}
                                          </span>
                                          <span className="inline-flex min-w-0 items-center gap-0.5" title="Paid to">
                                            <UserRound className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                                            <span className="max-w-[7rem] truncate">{linkedExpenseOpt.paid_to || '—'}</span>
                                          </span>
                                          <span className="inline-flex min-w-0 items-center gap-0.5" title="Paid for">
                                            <Tag className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                                            <span className="max-w-[8rem] truncate">{linkedExpenseOpt.paid_for || '—'}</span>
                                          </span>
                                          <span className="inline-flex min-w-0 items-center gap-0.5" title="Description">
                                            <FileText className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                                            <span className="max-w-[10rem] truncate">{linkedExpenseOpt.description || '—'}</span>
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-slate-600">
                                        {expenseMatch.source_id.slice(0, 8)}…
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
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-200/60 pt-1 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-0.5">
                                  <Save className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                                  <span>{displayNameForEmail(expenseMatch.matched_by)}</span>
                                </span>
                                {expenseMatch.updated_by ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Pencil className="h-3.5 w-3.5 text-red-600" aria-hidden />
                                    <span>{displayNameForEmail(expenseMatch.updated_by)}</span>
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-slate-500 underline decoration-dotted hover:bg-slate-100 hover:text-slate-800"
                                  title="매칭 이력 보기"
                                  onClick={() =>
                                    void loadMatchHistory({
                                      line,
                                      match: expenseMatch,
                                      ...(linkedExpenseOpt ? { expense: linkedExpenseOpt } : {})
                                    })
                                  }
                                >
                                  <Clock className="h-3.5 w-3.5" aria-hidden />
                                  <span>
                                    {formatReconciliationTimestamp(expenseMatch.updated_at || expenseMatch.matched_at)}
                                  </span>
                                </button>
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
          {filterAccountId && reconciliationTableLines.length === 0 && !reconciliationLinesLoading && (
            <p className="text-xs text-gray-500 py-3">
              {lines.length === 0
                ? '라인 없음'
                : reconciliationLinesBeforeSearch.length === 0
                  ? showOnlyUnmatchedLines
                    ? '이 조건에서 미대조 거래가 없습니다. 필터를 끄거나 월·거래일 범위를 바꿔 보세요.'
                    : selectedMonth !== 'all'
                      ? '선택한 월에 해당하는 거래가 없습니다.'
                      : statementTableDateRangeActive
                        ? '선택한 거래일 범위에 해당하는 거래가 없습니다. 날짜를 바꾸거나 «범위 지우기»를 눌러 보세요.'
                        : '표시할 거래가 없습니다.'
                  : reconciliationSearchQuery.trim()
                    ? '검색 결과가 없습니다. 검색어를 바꾸거나 지워 보세요.'
                    : '표시할 거래가 없습니다.'}
            </p>
          )}
          </div>
          </div>

          {filterAccountId && !unmatchedSidebarOpen ? (
            <div className="shrink-0 xl:hidden px-0.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => setUnmatchedSidebarOpen(true)}
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                미매칭 지출 펼치기 (조회 기간 후보 로드)
              </Button>
            </div>
          ) : null}

          {filterAccountId ? (
            <div className="hidden xl:flex flex-col items-center shrink-0 w-8 border-l border-slate-200 bg-slate-100/70 py-2 self-stretch">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-md text-slate-600 hover:bg-white hover:text-slate-900"
                aria-pressed={unmatchedSidebarOpen}
                aria-label={unmatchedSidebarOpen ? '미매칭 지출 패널 접기' : '미매칭 지출 패널 펼치기'}
                title={unmatchedSidebarOpen ? '미매칭 지출 패널 접기' : '미매칭 지출 패널 펼치기'}
                onClick={() => setUnmatchedSidebarOpen((o) => !o)}
              >
                {unmatchedSidebarOpen ? (
                  <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
                ) : (
                  <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
                )}
              </Button>
            </div>
          ) : null}

          <aside
            className={
              'flex flex-col min-h-0 w-full shrink-0 rounded-lg border border-slate-200 bg-slate-50/90 p-2 shadow-sm xl:h-full xl:min-h-0 ' +
              (!filterAccountId || unmatchedSidebarOpen
                ? 'xl:w-[min(100%,28rem)] xl:max-w-[30rem]'
                : 'hidden xl:hidden')
            }
          >
            <div className="flex items-start gap-2 border-b border-slate-200/80 pb-1.5 mb-1.5 shrink-0">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1">
                <h4 className="text-[11px] font-semibold text-slate-800 leading-tight">미매칭 지출</h4>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                  {unmatchedPanelListScope === 'unmatched' ? (
                    <>
                      아래 <strong>조회 기간</strong>으로 불러온 회사·투어·예약·입장권 지출 중 아직 명세와 연결되지 않은 항목입니다. 행을{' '}
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
              {filterAccountId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="xl:hidden h-8 shrink-0 px-2 text-[10px] text-slate-600 gap-0.5"
                  aria-label="미매칭 지출 패널 접기"
                  onClick={() => setUnmatchedSidebarOpen(false)}
                >
                  접기
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </Button>
              ) : null}
            </div>
            {filterAccountId ? (
              <div className="shrink-0 space-y-1 mb-2 pb-2 border-b border-slate-200/70">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                  <span className="font-medium text-slate-700 shrink-0">조회 기간</span>
                  <input
                    type="date"
                    aria-label="미매칭 지출 조회 시작일"
                    className="border border-slate-200 rounded px-1 py-0.5 bg-white text-[10px] max-w-[9.5rem]"
                    value={unmatchedExpenseQueryStart}
                    onChange={(e) => {
                      setUnmatchedExpenseQueryStart(e.target.value)
                      setUnmatchedExpenseRangeTouched(true)
                    }}
                  />
                  <span className="text-slate-500">~</span>
                  <input
                    type="date"
                    aria-label="미매칭 지출 조회 종료일"
                    className="border border-slate-200 rounded px-1 py-0.5 bg-white text-[10px] max-w-[9.5rem]"
                    value={unmatchedExpenseQueryEnd}
                    onChange={(e) => {
                      setUnmatchedExpenseQueryEnd(e.target.value)
                      setUnmatchedExpenseRangeTouched(true)
                    }}
                  />
                  <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-700 hover:bg-slate-50 shrink-0"
                    title="왼쪽 명세 대조 표의 현재 페이지 첫 행 날짜−7일 ~ 마지막 행 날짜+7일로 맞춥니다"
                    onClick={() => {
                      const { start, end } = defaultUnmatchedExpenseRange
                      if (start && end) {
                        setUnmatchedExpenseQueryStart(start)
                        setUnmatchedExpenseQueryEnd(end)
                        setUnmatchedExpenseRangeTouched(false)
                      }
                    }}
                  >
                    표 페이지 기준
                  </button>
                </div>
                <p className="text-[9px] text-slate-500 leading-snug">
                  기본: 명세 표 <strong>현재 페이지</strong> 첫·끝 거래일 각각 <strong>−7일 / +7일</strong>. 페이지를 바꾸면
                  그에 맞춰 갱신됩니다. 날짜를 직접 수정하면 그때부터는 자동 갱신을 멈추고, 다시 맞추려면 «표 페이지
                  기준»을 누르세요.
                </p>
              </div>
            ) : null}
            {!filterAccountId ? (
              <p className="text-xs text-slate-500 py-2">상단에서 금융 계정을 선택하면 목록이 표시됩니다.</p>
            ) : unmatchedExpensesLoading ? (
              <p className="text-xs text-slate-600 py-6 text-center inline-flex flex-col items-center justify-center gap-2 w-full">
                <Loader2 className="h-6 w-6 animate-spin shrink-0 text-slate-500" aria-hidden />
                지출 후보를 불러오는 중입니다…
              </p>
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
                  <div className="flex shrink-0 flex-nowrap items-center gap-1.5 min-w-0">
                    <div
                      className="flex max-w-full shrink-0 flex-wrap items-center gap-1"
                      role="tablist"
                      aria-label="지출 테이블 탭"
                    >
                      {EXPENSE_SOURCE_FILTER_OPTIONS.map((opt) => {
                        const active = unmatchedPanelSourceTableFilter === opt.value
                        const count = unmatchedExpenseSourceTabCounts[opt.value] ?? 0
                        return (
                          <button
                            key={opt.value || 'all'}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`rounded-full border px-2 py-1 text-[10px] leading-none ${
                              active
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                            onClick={() => setUnmatchedPanelSourceTableFilter(opt.value)}
                          >
                            {opt.label}{' '}
                            <span className={active ? 'text-slate-300' : 'text-slate-400'}>
                              {count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    <div
                      ref={unmatchedPmFilterWrapRef}
                      className="relative min-w-0 shrink-0 w-[min(100%,10.5rem)] max-w-[11rem]"
                    >
                      <button
                        type="button"
                        aria-label="결제방법 필터"
                        aria-expanded={unmatchedPmFilterOpen}
                        className="flex w-full min-w-0 items-center justify-between gap-1 border border-slate-200 rounded px-1.5 py-1 text-[10px] bg-white text-left"
                        onClick={() => setUnmatchedPmFilterOpen((o) => !o)}
                      >
                        <span className="min-w-0 truncate text-left">
                          {unmatchedPanelPaymentMethodFilter.length === 0
                            ? '결제방법 전체'
                            : `결제방법 (${unmatchedPanelPaymentMethodFilter.length})`}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${
                            unmatchedPmFilterOpen ? 'rotate-180' : ''
                          }`}
                          aria-hidden
                        />
                      </button>
                      {unmatchedPmFilterOpen ? (
                        <div
                          className="absolute left-0 z-50 mt-0.5 max-h-48 min-w-full w-max max-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded border border-slate-200 bg-white py-1.5 shadow-md"
                          role="listbox"
                          aria-multiselectable
                        >
                          <p className="px-2 pb-1 text-[9px] leading-snug text-slate-500">
                            여러 개 선택 시 해당 결제수단 중 하나라도 맞으면 표시됩니다. 아무 것도 선택하지 않으면
                            전체입니다.
                          </p>
                          {unmatchedPanelPaymentMethodFilter.length > 0 ? (
                            <button
                              type="button"
                              className="mb-1 w-full px-2 py-0.5 text-left text-[9px] text-slate-600 underline hover:bg-slate-50"
                              onClick={() => setUnmatchedPanelPaymentMethodFilter([])}
                            >
                              모두 해제 (전체 표시)
                            </button>
                          ) : null}
                          <label className="flex cursor-pointer items-center gap-2 px-2 py-0.5 text-[10px] hover:bg-slate-50">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={unmatchedPanelPaymentMethodFilter.includes('__none__')}
                              disabled={!unmatchedPanelPaymentFilterOptions.hasNone}
                              onChange={() => {
                                setUnmatchedPanelPaymentMethodFilter((prev) => {
                                  if (prev.includes('__none__')) return prev.filter((x) => x !== '__none__')
                                  return [...prev, '__none__']
                                })
                              }}
                            />
                            <span className={unmatchedPanelPaymentFilterOptions.hasNone ? '' : 'text-slate-400'}>
                              미지정
                            </span>
                          </label>
                          {unmatchedPanelPaymentFilterOptions.entries.map(([id, lab]) => (
                            <label
                              key={id}
                              className="flex cursor-pointer items-center gap-2 px-2 py-0.5 text-[10px] hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={unmatchedPanelPaymentMethodFilter.includes(id)}
                                onChange={() => {
                                  setUnmatchedPanelPaymentMethodFilter((prev) => {
                                    if (prev.includes(id)) return prev.filter((x) => x !== id)
                                    return [...prev, id]
                                  })
                                }}
                              />
                              <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
                                {lab}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
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
                            {expenseMatchesSelectedFinancialAccount(o) ? (
                              <span className="shrink-0 text-[9px] font-medium text-sky-800 bg-sky-100/90 px-1 py-px rounded">
                                금융계정
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
        </>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">운영 지출입 찾기</h3>
              <p className="mt-1 text-xs text-slate-600">
                예약 지출, 회사 지출, payment_records, 티켓, 호텔 부킹을 모아 보고 각 행을 카드/은행 명세에서 찾습니다.{' '}
                <strong>결제수단에 금융 계정이 연결된 행</strong>을 먼저 보여 주며, 같은 그룹 안에서는 날짜·출처 순입니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                시작
                <input
                  type="date"
                  className="rounded border border-slate-200 px-2 py-1"
                  value={operationalLedgerStart}
                  onChange={(e) => setOperationalLedgerStart(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-1">
                종료
                <input
                  type="date"
                  className="rounded border border-slate-200 px-2 py-1"
                  value={operationalLedgerEnd}
                  onChange={(e) => setOperationalLedgerEnd(e.target.value)}
                />
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => void loadOperationalLedgerRows()}
                disabled={operationalLedgerLoading}
              >
                <Search className="mr-1 h-4 w-4" />
                {operationalLedgerLoading ? '조회 중…' : '지출입 가져오기'}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              className="rounded border border-slate-200 bg-white px-2 py-1"
              value={operationalLedgerScope}
              onChange={(e) => {
                setOperationalLedgerScope(e.target.value as 'unmatched' | 'all')
                setOperationalLedgerPage(1)
              }}
            >
              <option value="unmatched">연결 안 된 행만</option>
              <option value="all">전체</option>
            </select>
            <select
              className="rounded border border-slate-200 bg-white px-2 py-1"
              value={operationalLedgerSourceFilter}
              onChange={(e) => {
                setOperationalLedgerSourceFilter(e.target.value as OperationalLedgerSourceTable | '')
                setOperationalLedgerPage(1)
              }}
            >
              <option value="">전체 테이블</option>
              {Object.entries(OPERATIONAL_LEDGER_SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="w-full rounded border border-slate-200 py-1 pl-7 pr-2"
                placeholder="금액·내용·거래처·ID 검색"
                value={operationalLedgerSearch}
                onChange={(e) => {
                  setOperationalLedgerSearch(e.target.value)
                  setOperationalLedgerPage(1)
                }}
              />
            </div>
            <span className="text-slate-500">
              표시 {operationalLedgerFilteredRows.length}건 / 로드 {operationalLedgerRows.length}건 · 쪽{' '}
              {operationalLedgerPage}/{operationalLedgerPageCount}
            </span>
          </div>

          <div className="overflow-x-auto rounded border border-slate-100">
            <table className="w-full min-w-[1180px] text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2">일자</th>
                  <th className="px-2 py-2">테이블</th>
                  <th className="px-2 py-2 text-right">금액</th>
                  <th className="px-2 py-2">결제수단</th>
                  <th className="px-2 py-2">거래처</th>
                  <th className="px-2 py-2">내용</th>
                  <th className="px-2 py-2">명세 후보</th>
                </tr>
              </thead>
              <tbody>
                {operationalLedgerLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      운영 지출입을 불러오는 중…
                    </td>
                  </tr>
                ) : operationalLedgerFilteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      조회된 운영 지출입이 없습니다. 기간을 선택하고 «지출입 가져오기»를 누르세요.
                    </td>
                  </tr>
                ) : (
                  pagedOperationalLedgerRows.map((row) => {
                    const candidates = statementCandidatesByLedgerKey[row.key]
                    const isCandidateLoading = statementCandidateLoadingKeys.has(row.key)
                    const pmLabel = paymentMethodLabelFromRows(row.payment_method, paymentMethods)
                    return (
                      <React.Fragment key={row.key}>
                      <tr className="border-t border-slate-100 align-top">
                        <td className="px-2 py-2 tabular-nums text-slate-700">{row.date}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                row.direction === 'inflow'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {row.direction === 'inflow' ? '입금' : '지출'}
                            </span>
                            <span>{OPERATIONAL_LEDGER_SOURCE_LABEL[row.source_table]}</span>
                            {row.already_matched ? (
                              <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">연결됨</span>
                            ) : null}
                          </div>
                          <code className="mt-1 block max-w-[10rem] truncate text-[10px] text-slate-400" title={row.source_id}>
                            {row.source_id}
                          </code>
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums font-medium ${row.direction === 'inflow' ? 'text-emerald-800' : 'text-rose-800'}`}
                        >
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            title="USD 금액 — 포커스를 벗어나면 저장됩니다"
                            aria-label="금액 수정"
                            disabled={row.already_matched || operationalLedgerAmountSavingKey === row.key}
                            className={`w-[7.5rem] rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right text-xs font-medium tabular-nums disabled:opacity-60 ${row.direction === 'inflow' ? 'text-emerald-800' : 'text-rose-800'}`}
                            key={`ledger-amt-${row.key}-${row.amount}-${operationalLedgerAmountInputRemount[row.key] ?? 0}`}
                            defaultValue={row.amount}
                            onBlur={(e) => void persistOperationalLedgerAmount(row, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                          />
                        </td>
                        <td className="px-2 py-2 text-slate-600">{pmLabel}</td>
                        <td className="px-2 py-2 text-slate-700">{row.party || '—'}</td>
                        <td className="px-2 py-2 text-slate-700">
                          <div className="line-clamp-2" title={[row.purpose, row.note].filter(Boolean).join(' · ')}>
                            {row.purpose || '—'}
                            {row.note ? ` · ${row.note}` : ''}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div className="space-y-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={isCandidateLoading || row.already_matched}
                              onClick={() => void findStatementCandidatesForLedgerRow(row)}
                            >
                              {isCandidateLoading
                                ? '찾는 중…'
                                : candidates
                                  ? '다시 찾기'
                                  : '금융계정 명세에서 찾기'}
                            </Button>
                            {isCandidateLoading ? (
                              <p className="text-[11px] text-slate-500">후보 로딩 중…</p>
                            ) : candidates ? (
                              <p className="text-[11px] text-slate-500">
                                {candidates.length === 0 ? '후보 없음' : `후보 ${candidates.length}건`}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isCandidateLoading || candidates ? (
                        <tr className="border-t border-slate-100 bg-slate-50/50">
                          <td colSpan={7} className="px-3 py-3">
                            {isCandidateLoading ? (
                              <p className="text-xs text-slate-500">현재 페이지의 명세 후보를 자동으로 찾는 중입니다…</p>
                            ) : candidates && candidates.length === 0 ? (
                              <p className="text-xs text-slate-500">±7일, 유사 금액 후보가 없습니다.</p>
                            ) : (
                              <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                                <table className="w-full min-w-[920px] text-[11px]">
                                  <thead className="bg-slate-50 text-left text-slate-500">
                                    <tr>
                                      <th className="px-2 py-1.5 font-medium">금융계정</th>
                                      <th className="px-2 py-1.5 font-medium">명세일</th>
                                      <th className="px-2 py-1.5 text-right font-medium">명세 금액</th>
                                      <th className="px-2 py-1.5 font-medium">금액 비교</th>
                                      <th className="px-2 py-1.5 font-medium">설명</th>
                                      <th className="px-2 py-1.5 font-medium">상태</th>
                                      <th className="px-2 py-1.5 text-right font-medium">작업</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(candidates || []).map((c) => (
                                      <tr key={c.id} className="border-t border-slate-100 align-middle">
                                        <td className="px-2 py-1.5 font-medium text-slate-900">
                                          {c.financial_account_name}
                                        </td>
                                        <td className="px-2 py-1.5 tabular-nums text-slate-700">{c.posted_date}</td>
                                        <td className="px-2 py-1.5 text-right tabular-nums font-medium text-slate-900">
                                          {formatMoneyUsd(c.amount)}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {c.amount_diff < 0.02 ? (
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-800">
                                              같은 금액
                                            </span>
                                          ) : (
                                            <span className="text-amber-700">차이 {formatMoneyUsd(c.amount_diff)}</span>
                                          )}
                                          <span className="ml-2 text-slate-500">
                                            날짜 {Number.isFinite(c.day_diff) ? `${c.day_diff.toFixed(0)}일 차이` : '—'}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-slate-600">
                                          <div className="line-clamp-2" title={c.description}>
                                            {c.description || '—'}
                                          </div>
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {c.matched_status === 'unmatched' ? (
                                            <span className="text-slate-600">미대조</span>
                                          ) : (
                                            <span className="font-medium text-red-700">이미 대조됨</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1.5 text-right">
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-7 text-[11px]"
                                            disabled={loading || row.already_matched || c.matched_status !== 'unmatched'}
                                            onClick={() => void saveOperationalLedgerMatch(row, c)}
                                          >
                                            이 명세와 매칭
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {operationalLedgerFilteredRows.length > OPERATIONAL_LEDGER_PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 bg-slate-50/60 px-2 py-2 text-xs text-slate-600">
              <span>
                표시 중{' '}
                <strong>
                  {(operationalLedgerPage - 1) * OPERATIONAL_LEDGER_PAGE_SIZE + 1}–
                  {Math.min(operationalLedgerPage * OPERATIONAL_LEDGER_PAGE_SIZE, operationalLedgerFilteredRows.length)}
                </strong>
                건 / 전체 <strong>{operationalLedgerFilteredRows.length}</strong>건 · 쪽{' '}
                <strong>
                  {operationalLedgerPage}/{operationalLedgerPageCount}
                </strong>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={operationalLedgerPage <= 1}
                  onClick={() => setOperationalLedgerPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  이전
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={operationalLedgerPage >= operationalLedgerPageCount}
                  onClick={() => setOperationalLedgerPage((p) => Math.min(operationalLedgerPageCount, p + 1))}
                >
                  다음
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      )}

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
                <span className="block mt-1 text-[11px] text-slate-500">
                  현재 금융 계정에 연결된 결제수단의 지출을 후보 상단에 표시합니다.
                </span>
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
                            {expenseMatchesSelectedFinancialAccount(o) ? (
                              <span className="text-[10px] font-medium text-sky-800 bg-sky-100 px-1.5 py-0 rounded shrink-0">
                                금융계정 우선
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
                          <span className="flex flex-wrap items-center gap-1.5 w-full">
                            <span>{formatExpensePickerLineLabel(o)}</span>
                            {expenseMatchesSelectedFinancialAccount(o) ? (
                              <span className="text-[10px] font-medium text-sky-800 bg-sky-100 px-1.5 py-0 rounded shrink-0">
                                금융계정 우선
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
              {paymentOptionsLoading ? (
                <p className="text-xs text-slate-600 inline-flex items-center gap-2 py-1">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                  입금 기록 목록을 불러오는 중입니다…
                </p>
              ) : null}
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

      <Dialog
        open={Boolean(matchHistoryTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setMatchHistoryTarget(null)
            setMatchHistoryRows([])
            setMatchHistoryError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl w-[calc(100vw-1.25rem)] max-h-[min(90vh,720px)] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 pr-12 border-b border-slate-100 shrink-0 text-left">
            <DialogTitle className="text-base">매칭 저장·수정 이력</DialogTitle>
            {matchHistoryTarget ? (
              <DialogDescription className="text-xs text-slate-600">
                명세 {matchHistoryTarget.line.posted_date} · ${Number(matchHistoryTarget.line.amount).toFixed(2)}
                {matchHistoryTarget.expense ? ` · ${matchHistoryTarget.expense.label}` : ''}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            {matchHistoryLoading ? (
              <p className="text-sm text-slate-600">이력을 불러오는 중…</p>
            ) : matchHistoryError ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {matchHistoryError}
              </p>
            ) : matchHistoryRows.length === 0 ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p>아직 별도 이력 로그가 없습니다. 현재 매칭 정보만 표시합니다.</p>
                {matchHistoryTarget ? (
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="inline-flex items-center gap-1 text-slate-700">
                      <Save className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                      저장: {displayNameForEmail(matchHistoryTarget.match.matched_by)} ·{' '}
                      {formatReconciliationTimestamp(matchHistoryTarget.match.matched_at)}
                    </div>
                    {matchHistoryTarget.match.updated_by ? (
                      <div className="mt-1 inline-flex items-center gap-1 text-slate-700">
                        <Pencil className="h-3.5 w-3.5 text-red-600" aria-hidden />
                        수정: {displayNameForEmail(matchHistoryTarget.match.updated_by)} ·{' '}
                        {formatReconciliationTimestamp(matchHistoryTarget.match.updated_at)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {matchHistoryRows.map((ev) => {
                  const isUpdate = ev.action === 'updated'
                  const isDelete = ev.action === 'deleted'
                  const Icon = isUpdate || isDelete ? Pencil : Save
                  const iconClass = isUpdate || isDelete ? 'text-red-600' : 'text-blue-600'
                  const actionLabel = ev.action === 'created' ? '저장' : ev.action === 'updated' ? '수정' : '해제'
                  return (
                    <div key={ev.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
                        <span className="font-medium text-slate-900">{actionLabel}</span>
                        <span className="text-slate-700">{displayNameForEmail(ev.actor_email)}</span>
                        <span className="tabular-nums text-slate-500">
                          {formatReconciliationTimestamp(ev.occurred_at)}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-600">
                        {ev.action === 'updated' ? (
                          <>
                            {ev.before_source_table}:{ev.before_source_id} → {ev.after_source_table}:{ev.after_source_id}
                          </>
                        ) : ev.action === 'deleted' ? (
                          <>
                            연결 해제: {ev.before_source_table}:{ev.before_source_id}
                          </>
                        ) : (
                          <>
                            연결 생성: {ev.after_source_table}:{ev.after_source_id}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
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
