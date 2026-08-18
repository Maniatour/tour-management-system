'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations, useLocale } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useOperatorOptional } from '@/contexts/OperatorContext'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Edit, Trash2, ArrowDownCircle, ArrowUpCircle, DollarSign, TrendingUp, TrendingDown, History, ChevronLeft, ChevronRight, Wand2, Landmark } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTimeForDatetimeLocalInput, parseDatetimeLocalInputToISOString } from '@/utils/datetimeLocal'
import { fetchReconciledSourceIds } from '@/lib/reconciliation-match-queries'
import { fetchCashLedgerMatchedCashTransactionIds, fetchCashLedgerMatchedExpenseIds } from '@/lib/expense-cash-ledger-match'
import {
  fetchReconciliationExemptKeysForSources,
} from '@/lib/expense-reconciliation-exemptions'
import ExpenseReconciliationExemptToggle from '@/components/reconciliation/ExpenseReconciliationExemptToggle'
import type { ExpenseReconSourceTable, ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import CashTransactionBulkAutoMatchModal, {
  AMOUNT_EQUAL_EPS,
} from '@/components/reconciliation/CashTransactionBulkAutoMatchModal'
import type { CashAutoMatchInputRow } from '@/lib/cash-transaction-auto-match'
import type { ExpenseAutoMatchInputRow } from '@/lib/expense-statement-auto-match'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import { DROPDOWN_Z_INDEX } from '@/lib/dialogZIndex'
import { getCashPaymentMethodFilterValues } from '@/lib/cashPaymentMethodValues'
import {
  buildCashTransactionsSearchOr,
  buildPaymentRecordsNoteSearchOr,
  buildCashCompanyExpenseSearchOr,
  buildCashReservationExpenseSearchOr,
} from '@/lib/cashTransactionSearch'
import { ExpensePaidToCombobox } from '@/components/expense/ExpensePaidToCombobox'
import { isReusableExpenseVendor } from '@/lib/expenseVendors'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import CashColumnHeader from '@/components/expenses/CashColumnHeader'
import CashColumnFiltersBar, {
  type CashColFilterField,
} from '@/components/expenses/CashColumnFiltersBar'
import CashLedgerReviewControls from '@/components/expenses/CashLedgerReviewControls'
import ProfitShareOffsetQuickButtons from '@/components/expenses/ProfitShareOffsetQuickButtons'
import ProfitShareExcludeFields from '@/components/expenses/ProfitShareOffsetFields'
import ProfitShareSplitFields, { ProfitSharePaidToPresets } from '@/components/expenses/ProfitShareSplitFields'
import { MoveExpenseTableButton } from '@/components/expenses/MoveExpenseTableDialog'
import { isMovableExpenseTable, type MoveExpenseItem } from '@/lib/moveExpenseTable'
import type { StringMultiSelectOption } from '@/components/filters/StringMultiSelectFilter'
import UnreceivedAssignedCashBalancePanel from '@/components/reports/UnreceivedAssignedCashBalancePanel'
import { getDefaultLedgerBaseDate } from '@/lib/fiscal-settings'
import { isCashLedgerRefundPaymentRecord } from '@/utils/reservationPricingBalance'
import {
  applyProfitSharePaidToChange,
  applyProfitShareSplitHalves,
  cashDirectEntryDescription,
  cashDirectEntryTitle,
  canToggleProfitShareExcluded,
  classifyProfitSharePartner,
  emptyProfitShareExcludeForm,
  excludeFormFromTransaction,
  ensureBankDepositDescription,
  formatProfitShareExcludeLabel,
  formatProfitShareSplitLabel,
  isBankDepositDescription,
  isLikelyProfitShareCashOut,
  isProfitShareExcluded,
  presetCashDirectEntry,
  resolveProfitShareSplitPayload,
  splitFormFromTransaction,
  summarizeProfitShareRows,
  emptyProfitShareSplitForm,
  type CashDirectEntryKind,
  type ProfitShareExcludeFormFields,
  type ProfitShareSplitFormFields,
} from '@/lib/cashTransactionPurpose'
import {
  CASH_LEDGER_REVIEW_CHANGED_EVENT,
  CASH_LEDGER_REVIEW_OPTIONS,
  cashLedgerRefFromRow,
  cashLedgerReviewKey,
  cashLedgerReviewStatusOf,
  fetchCashLedgerReviewMap,
  upsertCashLedgerReview,
  bulkUpsertCashLedgerReviews,
  type CashLedgerReviewStatus,
} from '@/lib/cashLedgerReview'

const DEFAULT_CASH_PERIOD_START = getDefaultLedgerBaseDate()

interface CashTransaction {
  id: string
  transaction_date: string
  transaction_type: 'deposit' | 'withdrawal'
  amount: number
  description: string | null
  category: string | null
  reference_type: string | null
  reference_id: string | null
  created_by: string
  notes: string | null
  created_at: string
  updated_at: string
  source?: 'cash_transactions' | 'payment_records' | 'company_expenses' | 'reservation_expenses' // 데이터 출처
  created_by_name?: string // team 테이블 display_name (없으면 name_ko)
  /** payment_records 출처만 — DB payment_status */
  payment_status?: string | null
  /** 회사·예약 지출 또는 현금 관리 직접 입력의 결제처(paid_to) */
  paid_to?: string | null
  offset_paid_to?: string | null
  offset_amount?: number | null
  offset_method?: string | null
  share_chad_amount?: number | null
  share_joey_amount?: number | null
  profit_share_excluded?: boolean | null
}

interface TransactionHistory {
  id: string
  transaction_id: string
  source_table: string
  modified_by: string
  modified_at: string
  change_type: 'created' | 'updated' | 'deleted'
  old_values: any
  new_values: any
  modified_by_name?: string
}

interface CashTransactionFormData extends ProfitShareExcludeFormFields, ProfitShareSplitFormFields {
  transaction_date: string
  transaction_type: 'deposit' | 'withdrawal' | 'bank_deposit'
  amount: string
  description: string
  paid_to: string
}

function emptyCashFormData(kind: CashDirectEntryKind = 'deposit'): CashTransactionFormData {
  const preset = presetCashDirectEntry(kind)
  return {
    transaction_date: formatDateTimeForDatetimeLocalInput(new Date()),
    transaction_type: preset.transaction_type,
    amount: '',
    description: preset.description,
    paid_to: '',
    ...emptyProfitShareExcludeForm(),
    ...emptyProfitShareSplitForm(),
  }
}

function cashSourceBadge(source: CashTransaction['source']): {
  label: string
  variant: NonNullable<BadgeProps['variant']>
} {
  switch (source) {
    case 'payment_records':
      return { label: '예약 결제', variant: 'success' }
    case 'company_expenses':
      return { label: '회사 지출', variant: 'warning' }
    case 'reservation_expenses':
      return { label: '예약 지출', variant: 'booking' }
    default:
      return { label: '현금 관리', variant: 'default' }
  }
}

type CashSourceValue = NonNullable<CashTransaction['source']>

const CASH_SOURCE_OPTIONS: StringMultiSelectOption[] = [
  { value: 'cash_transactions', label: cashSourceBadge('cash_transactions').label },
  { value: 'payment_records', label: cashSourceBadge('payment_records').label },
  { value: 'company_expenses', label: cashSourceBadge('company_expenses').label },
  { value: 'reservation_expenses', label: cashSourceBadge('reservation_expenses').label },
]

const CASH_TYPE_OPTIONS: StringMultiSelectOption[] = [
  { value: 'deposit', label: '입금' },
  { value: 'withdrawal', label: '출금' },
  { value: 'bank_deposit', label: '은행 Deposit' },
]

const CASH_REVIEW_OPTIONS: StringMultiSelectOption[] = CASH_LEDGER_REVIEW_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

const EMPTY_COL_FILTER = '__empty__'

function HoverDetailText({
  text,
  empty = '—',
  className,
}: {
  text: string | null | undefined
  empty?: string
  className?: string
}) {
  const trimmed = (text ?? '').trim()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, maxWidth: 360 })
  const ref = useRef<HTMLSpanElement>(null)

  const show = () => {
    if (!trimmed) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxWidth = Math.min(384, Math.max(160, window.innerWidth - 24))
    let left = r.left
    if (left + maxWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - maxWidth - 8)
    }
    setPos({ top: r.bottom + 6, left, maxWidth })
    setOpen(true)
  }

  const hide = () => setOpen(false)

  if (!trimmed) {
    return <span className={className}>{empty}</span>
  }

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        className={`block min-w-0 truncate cursor-default outline-none ${className ?? ''}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {trimmed}
      </span>
      {open
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                maxWidth: pos.maxWidth,
                zIndex: DROPDOWN_Z_INDEX,
              }}
              className="pointer-events-none whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-800 shadow-md"
            >
              {trimmed}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function cashTypeFilterValue(tx: CashTransaction): string {
  const isBankDeposit = isBankDepositDescription(tx.description)
  if (isBankDeposit) return 'bank_deposit'
  return tx.transaction_type
}

function cashPaidToFilterValue(tx: CashTransaction): string {
  const v = tx.paid_to?.trim()
  return v || EMPTY_COL_FILTER
}

function cashCategoryFilterValue(tx: CashTransaction): string {
  const v = tx.category?.trim()
  return v || EMPTY_COL_FILTER
}

function cashAuthorFilterValue(tx: CashTransaction): string {
  const v = (tx.created_by_name || tx.created_by || '').trim()
  return v || EMPTY_COL_FILTER
}

function cashPaymentStatusFilterValue(tx: CashTransaction): string {
  if (tx.source !== 'payment_records') return EMPTY_COL_FILTER
  const v = tx.payment_status?.trim()
  return v || EMPTY_COL_FILTER
}

function cashSourceFilterValue(tx: CashTransaction): CashSourceValue {
  if (tx.source === 'payment_records') return 'payment_records'
  if (tx.source === 'company_expenses') return 'company_expenses'
  if (tx.source === 'reservation_expenses') return 'reservation_expenses'
  return 'cash_transactions'
}

function uniqueColOptions(
  rows: CashTransaction[],
  valueFn: (tx: CashTransaction) => string,
  labelFn: (value: string) => string,
  locale: string
): StringMultiSelectOption[] {
  const map = new Map<string, string>()
  for (const row of rows) {
    const value = valueFn(row)
    if (!map.has(value)) map.set(value, labelFn(value))
  }
  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], locale === 'en' ? 'en' : 'ko'))
    .map(([value, label]) => ({ value, label }))
}

function matchesColFilter(selected: ReadonlySet<string>, value: string): boolean {
  return selected.size === 0 || selected.has(value)
}

function colEmptyLabel(value: string): string {
  return value === EMPTY_COL_FILTER ? '—' : value
}

function reconSourceFromCashTransaction(
  tx: CashTransaction
): { sourceTable: ExpenseReconSourceTable; sourceId: string } | null {
  if (tx.source === 'payment_records' && tx.id.startsWith('pr_')) {
    return { sourceTable: 'payment_records', sourceId: tx.id.slice(3) }
  }
  if (tx.source === 'company_expenses' && tx.id.startsWith('ce_')) {
    return { sourceTable: 'company_expenses', sourceId: tx.id.slice(3) }
  }
  if (tx.source === 'reservation_expenses' && tx.id.startsWith('re_')) {
    return { sourceTable: 'reservation_expenses', sourceId: tx.id.slice(3) }
  }
  if (tx.source === 'cash_transactions') {
    return { sourceTable: 'cash_transactions', sourceId: tx.id }
  }
  return null
}

function cashMoveExpenseItem(tx: CashTransaction): MoveExpenseItem | null {
  const recon = reconSourceFromCashTransaction(tx)
  if (!recon || !isMovableExpenseTable(recon.sourceTable)) return null
  if (recon.sourceTable === 'cash_transactions' && tx.transaction_type !== 'withdrawal') return null
  return { table: recon.sourceTable, id: recon.sourceId }
}

function cashTransactionDateYmd(tx: CashTransaction): string {
  const d = new Date(tx.transaction_date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function isCashRowReconciled(
  tx: CashTransaction,
  reconciledKeys: Set<string>,
  exemptKeys: Set<string>
): boolean {
  const r = reconSourceFromCashTransaction(tx)
  if (r) {
    const key = `${r.sourceTable}:${r.sourceId}`
    if (exemptKeys.has(key)) return true
    if (reconciledKeys.has(key)) return true
  }
  if (
    tx.source === 'cash_transactions' &&
    tx.reference_type === 'payment_record' &&
    tx.reference_id
  ) {
    return true
  }
  return false
}

function cashReconKey(tx: CashTransaction): string | null {
  const r = reconSourceFromCashTransaction(tx)
  return r ? `${r.sourceTable}:${r.sourceId}` : null
}

function isCashRowExempt(tx: CashTransaction, exemptKeys: Set<string>): boolean {
  const key = cashReconKey(tx)
  return key ? exemptKeys.has(key) : false
}

function isCashRowStmtMatched(tx: CashTransaction, reconciledKeys: Set<string>): boolean {
  const key = cashReconKey(tx)
  if (key && reconciledKeys.has(key)) return true
  return (
    tx.source === 'cash_transactions' &&
    tx.reference_type === 'payment_record' &&
    Boolean(tx.reference_id)
  )
}

export default function CashManagement() {
  const { operatorId } = useOperatorOptional()
  const activeOperatorId = resolveOperatorId(operatorId)
  useTranslations('cashManagement')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch (error) {
    console.warn('로케일을 가져올 수 없습니다. 기본값(ko)을 사용합니다.', error)
  }
  const { user } = useAuth()
  const tStmt = useTranslations('expenses.statementRecon')
  const tBulkAutoMatch = useTranslations('expenses.statementRecon.cashBulkAutoMatch')
  const [reconciledCashRowKeys, setReconciledCashRowKeys] = useState<Set<string>>(() => new Set())
  const [exemptCashRowKeys, setExemptCashRowKeys] = useState<Set<string>>(() => new Set())
  const [stmtReconOpen, setStmtReconOpen] = useState(false)
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [bulkAutoMatchOpen, setBulkAutoMatchOpen] = useState(false)
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offsetSavingId, setOffsetSavingId] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const loadTransactionsGenRef = useRef(0)
  const [typeColFilters, setTypeColFilters] = useState<Set<string>>(() => new Set())
  const [paidToColFilters, setPaidToColFilters] = useState<Set<string>>(() => new Set())
  const [categoryColFilters, setCategoryColFilters] = useState<Set<string>>(() => new Set())
  const [sourceColFilters, setSourceColFilters] = useState<Set<string>>(() => new Set())
  const [paymentStatusColFilters, setPaymentStatusColFilters] = useState<Set<string>>(() => new Set())
  const [authorColFilters, setAuthorColFilters] = useState<Set<string>>(() => new Set())
  const [reviewColFilters, setReviewColFilters] = useState<Set<string>>(() => new Set())
  const [reviewByKey, setReviewByKey] = useState<Map<string, CashLedgerReviewStatus>>(() => new Map())
  const [reviewSavingKey, setReviewSavingKey] = useState<string | null>(null)
  const [reviewSelectedIds, setReviewSelectedIds] = useState<Set<string>>(() => new Set())
  const [reviewBulkSaving, setReviewBulkSaving] = useState(false)
  const [startDate, setStartDate] = useState(DEFAULT_CASH_PERIOD_START)
  const [endDate, setEndDate] = useState('')
  const [teamMembers, setTeamMembers] = useState<Map<string, string>>(new Map()) // email(lower) -> display_name
  const [showHistory, setShowHistory] = useState(false)
  const [, setSelectedTransactionId] = useState<string | null>(null)
  const [transactionHistory, setTransactionHistory] = useState<TransactionHistory[]>([])
  const [showPaymentRecordModal, setShowPaymentRecordModal] = useState(false)
  const [showCompanyExpenseModal, setShowCompanyExpenseModal] = useState(false)
  const [editingPaymentRecord, setEditingPaymentRecord] = useState<any>(null)
  const [editingCompanyExpense, setEditingCompanyExpense] = useState<any>(null)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null)
  const [showReservationExpenseModal, setShowReservationExpenseModal] = useState(false)
  const [editingReservationExpense, setEditingReservationExpense] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [cashTableSortKey, setCashTableSortKey] = useState<string>('date')
  const [cashTableSortDir, setCashTableSortDir] = useState<SortDir>('desc')

  const [formData, setFormData] = useState<CashTransactionFormData>(emptyCashFormData)
  const [paidToOptions, setPaidToOptions] = useState<string[]>([])

  const teamDisplayLabel = useCallback(
    (email: string) => {
      const e = String(email || '').trim()
      if (!e) return ''
      return teamMembers.get(e.toLowerCase()) || ''
    },
    [teamMembers]
  )

  // team 멤버 로드
  const loadTeamMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, display_name, name_ko')
      
      if (error) throw error
      
      const memberMap = new Map<string, string>()
      for (const member of data ?? []) {
        const email = String(member.email || '').trim()
        if (!email) continue
        const dn = member.display_name != null ? String(member.display_name).trim() : ''
        const ko = member.name_ko != null ? String(member.name_ko).trim() : ''
        const label = dn || ko || email
        memberMap.set(email.toLowerCase(), label)
      }
      setTeamMembers(memberMap)
    } catch (error) {
      console.error('팀 멤버 로드 오류:', error)
    }
  }, [])

  const loadPaidToOptions = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('expense_vendors').select('name, usage_type').order('name')
      if (error) throw error
      const names = new Set<string>()
      for (const row of data ?? []) {
        if (!isReusableExpenseVendor({ usage_type: row.usage_type === 'one_time' ? 'one_time' : 'reusable' })) continue
        const name = String(row.name ?? '').trim()
        if (name) names.add(name)
      }
      setPaidToOptions([...names])
    } catch (error) {
      console.error('결제처 목록 로드 오류:', error)
    }
  }, [])

  const cashPaidToComboboxOptions = useMemo(() => {
    const names = new Set(paidToOptions)
    const current = formData.paid_to.trim()
    if (current) names.add(current)
    return [...names]
  }, [paidToOptions, formData.paid_to])

  // 수정 히스토리 로드
  const loadTransactionHistory = useCallback(async (transactionId: string, sourceTable: string) => {
    try {
      const { data, error } = await supabase
        .from('cash_transaction_history')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('source_table', sourceTable)
        .order('modified_at', { ascending: false })
      
      if (error) throw error
      
      // team 멤버 이름 매핑
      const historyWithNames = (data || []).map(history => ({
        ...history,
        modified_by_name: teamDisplayLabel(history.modified_by)
      }))
      
      setTransactionHistory(
        historyWithNames.map((history) => ({
          ...history,
          change_type: history.change_type as TransactionHistory['change_type'],
        }))
      )
    } catch (error) {
      console.error('수정 히스토리 로드 오류:', error)
      toast.error('수정 히스토리를 불러오는 중 오류가 발생했습니다.')
    }
  }, [teamDisplayLabel, toast])

  const loadTransactions = useCallback(async () => {
    const gen = ++loadTransactionsGenRef.current
    try {
      setLoading(true)
      const cashPaymentMethods = await getCashPaymentMethodFilterValues()
      if (gen !== loadTransactionsGenRef.current) return

      const searchOrCash = searchTerm ? buildCashTransactionsSearchOr(searchTerm) : null
      const searchOrPayment = searchTerm ? buildPaymentRecordsNoteSearchOr(searchTerm) : null
      const searchOrCompany = searchTerm ? buildCashCompanyExpenseSearchOr(searchTerm) : null
      const searchOrReservation = searchTerm ? buildCashReservationExpenseSearchOr(searchTerm) : null

      // 1. cash_transactions 테이블에서 데이터 가져오기
      let cashTransactionsQuery = supabase
        .from('cash_transactions')
        .select('*')
        .eq('operator_id', activeOperatorId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (searchOrCash) {
        cashTransactionsQuery = cashTransactionsQuery.or(searchOrCash)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        cashTransactionsQuery = cashTransactionsQuery.gte('transaction_date', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        cashTransactionsQuery = cashTransactionsQuery.lte('transaction_date', end.toISOString())
      }

      const { data: cashTransactions, error: cashError } = await cashTransactionsQuery
      if (cashError) throw cashError

      // 2. payment_records 테이블에서 현금 입금 (PAYM032/PAYM001 + payment_method cash)
      let paymentRecordsQuery = supabase
        .from('payment_records')
        .select('id, amount, submit_on, submit_by, note, reservation_id, payment_status')
        .eq('operator_id', activeOperatorId)
        .in('payment_method', cashPaymentMethods)
        .order('submit_on', { ascending: false })

      if (searchOrPayment) {
        paymentRecordsQuery = paymentRecordsQuery.or(searchOrPayment)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        paymentRecordsQuery = paymentRecordsQuery.gte('submit_on', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        paymentRecordsQuery = paymentRecordsQuery.lte('submit_on', end.toISOString())
      }

      const { data: paymentRecordsRaw, error: paymentError } = await paymentRecordsQuery
      if (paymentError) {
        console.warn('payment_records 로드 오류:', paymentError)
      }
      /** 보증금 요청 단계(미입금) — 실현 거래가 아니므로 현금 거래 내역에서 제외 */
      const paymentRecords = (paymentRecordsRaw || []).filter(
        (pr) => String(pr.payment_status ?? '').trim() !== 'Deposit Requested'
      )

      // 3. company_expenses 테이블에서 현금 결제 데이터 가져오기
      let companyExpensesQuery = supabase
        .from('company_expenses')
        .select('id, amount, submit_on, submit_by, description, notes, paid_for, paid_to')
        .eq('operator_id', activeOperatorId)
        .in('payment_method', cashPaymentMethods)
        .order('submit_on', { ascending: false })

      if (searchOrCompany) {
        companyExpensesQuery = companyExpensesQuery.or(searchOrCompany)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        companyExpensesQuery = companyExpensesQuery.gte('submit_on', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        companyExpensesQuery = companyExpensesQuery.lte('submit_on', end.toISOString())
      }

      const { data: companyExpenses, error: companyError } = await companyExpensesQuery
      if (companyError) {
        console.warn('company_expenses 로드 오류:', companyError)
      }

      // 4. reservation_expenses 테이블에서 Cash (현금) 데이터 가져오기
      let reservationExpensesQuery = supabase
        .from('reservation_expenses')
        .select('id, amount, submit_on, submitted_by, note, paid_for, paid_to, reservation_id')
        .eq('operator_id', activeOperatorId)
        .in('payment_method', cashPaymentMethods)
        .order('submit_on', { ascending: false })

      if (searchOrReservation) {
        reservationExpensesQuery = reservationExpensesQuery.or(searchOrReservation)
      }

      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        reservationExpensesQuery = reservationExpensesQuery.gte('submit_on', start.toISOString())
      }

      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        reservationExpensesQuery = reservationExpensesQuery.lte('submit_on', end.toISOString())
      }

      const { data: reservationExpenses, error: reservationExpensesError } = await reservationExpensesQuery
      if (reservationExpensesError) {
        console.warn('reservation_expenses 로드 오류:', reservationExpensesError)
      }

      // 5. 데이터 변환 및 통합
      const allTransactions: CashTransaction[] = []

      // cash_transactions 변환
      if (cashTransactions) {
        const converted: CashTransaction[] = cashTransactions.map((t) => ({
          ...t,
          transaction_type: t.transaction_type as CashTransaction['transaction_type'],
          source: 'cash_transactions' as const,
          created_by_name: teamDisplayLabel(t.created_by),
          created_at: t.created_at ?? '',
          updated_at: t.updated_at ?? '',
          paid_to: t.paid_to || null,
          offset_paid_to: t.offset_paid_to || null,
          offset_amount: t.offset_amount != null ? Number(t.offset_amount) : null,
          offset_method: t.offset_method || null,
          share_chad_amount: t.share_chad_amount != null ? Number(t.share_chad_amount) : null,
          share_joey_amount: t.share_joey_amount != null ? Number(t.share_joey_amount) : null,
          profit_share_excluded: Boolean(t.profit_share_excluded) || Boolean(t.offset_paid_to),
        }))
        allTransactions.push(...converted)
      }

      // payment_records 변환 — 수령은 입금, 환불(우리·파트너)은 출금
      if (paymentRecords) {
        const converted = paymentRecords.map((pr) => {
          const status = pr.payment_status != null ? String(pr.payment_status) : null
          const isRefund = isCashLedgerRefundPaymentRecord(status, pr.note)
          const amount = Math.abs(Number(pr.amount) || 0)
          return {
            id: `pr_${pr.id}`,
            transaction_date: pr.submit_on || new Date().toISOString(),
            transaction_type: isRefund ? ('withdrawal' as const) : ('deposit' as const),
            amount,
            description: pr.note || `예약 결제 (${pr.reservation_id})`,
            category: isRefund ? '예약 환불' : '예약 수입',
            reference_type: 'reservation',
            reference_id: pr.reservation_id,
            created_by: pr.submit_by || '',
            created_by_name: teamDisplayLabel(pr.submit_by || ''),
            notes: pr.note || null,
            created_at: pr.submit_on || new Date().toISOString(),
            updated_at: pr.submit_on || new Date().toISOString(),
            source: 'payment_records' as const,
            payment_status: status,
          }
        })
        allTransactions.push(...converted)
      }

      // company_expenses 변환 (출금으로 처리)
      if (companyExpenses) {
        const converted = companyExpenses.map(ce => ({
          id: `ce_${ce.id}`,
          transaction_date: ce.submit_on || new Date().toISOString(),
          transaction_type: 'withdrawal' as const,
          amount: Number(ce.amount),
          description: ce.description || ce.notes || `${ce.paid_to} - ${ce.paid_for}`,
          category: ce.paid_for || '회사 지출',
          reference_type: 'company_expense',
          reference_id: ce.id,
          created_by: ce.submit_by || '',
          created_by_name: teamDisplayLabel(ce.submit_by || ''),
          notes: ce.notes || null,
          created_at: ce.submit_on || new Date().toISOString(),
          updated_at: ce.submit_on || new Date().toISOString(),
          source: 'company_expenses' as const,
          paid_to: ce.paid_to || null,
        }))
        allTransactions.push(...converted)
      }

      // reservation_expenses 변환 (출금으로 처리)
      if (reservationExpenses) {
        const converted = reservationExpenses.map(re => ({
          id: `re_${re.id}`,
          transaction_date: re.submit_on || new Date().toISOString(),
          transaction_type: 'withdrawal' as const,
          amount: Number(re.amount),
          description: re.note || `${re.paid_to || ''} - ${re.paid_for || ''}`.trim() || `예약 지출 (${re.reservation_id})`,
          category: re.paid_for || '예약 지출',
          reference_type: 'reservation',
          reference_id: re.reservation_id,
          created_by: re.submitted_by || '',
          created_by_name: teamDisplayLabel(re.submitted_by || ''),
          notes: re.note || null,
          created_at: re.submit_on || new Date().toISOString(),
          updated_at: re.submit_on || new Date().toISOString(),
          source: 'reservation_expenses' as const,
          paid_to: re.paid_to || null,
        }))
        allTransactions.push(...converted)
      }

      // 날짜순 정렬
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.transaction_date).getTime()
        const dateB = new Date(b.transaction_date).getTime()
        if (dateA !== dateB) return dateB - dateA
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      setTransactions(allTransactions)

      const reviewRefs = allTransactions
        .map((tx) => cashLedgerRefFromRow(tx))
        .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      setReviewByKey(await fetchCashLedgerReviewMap(reviewRefs))
      
      // 잔액 계산 (모든 거래 포함)
      const calculatedBalance = allTransactions.reduce((sum, transaction) => {
        if (transaction.transaction_type === 'deposit') {
          return sum + transaction.amount
        } else {
          return sum - transaction.amount
        }
      }, 0)
      
      setBalance(calculatedBalance)
    } catch (error) {
      if (gen !== loadTransactionsGenRef.current) return
      console.error('현금 거래 내역 로드 오류:', error)
      toast.error('현금 거래 내역을 불러오는 중 오류가 발생했습니다.')
    } finally {
      if (gen === loadTransactionsGenRef.current) {
        setLoading(false)
      }
    }
  }, [searchTerm, startDate, endDate, teamDisplayLabel, activeOperatorId])

  const applySearch = useCallback(() => {
    setSearchTerm(searchInput.trim())
  }, [searchInput])

  useEffect(() => {
    loadTeamMembers()
    void loadPaidToOptions()
  }, [loadTeamMembers, loadPaidToOptions])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  useEffect(() => {
    const onChanged = () => {
      const refs = transactions
        .map((tx) => cashLedgerRefFromRow(tx))
        .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      void fetchCashLedgerReviewMap(refs).then(setReviewByKey)
    }
    window.addEventListener(CASH_LEDGER_REVIEW_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(CASH_LEDGER_REVIEW_CHANGED_EVENT, onChanged)
  }, [transactions])

  // 수정 히스토리 저장
  const saveHistory = async (
    transactionId: string,
    sourceTable: string,
    changeType: 'created' | 'updated' | 'deleted',
    oldValues: any,
    newValues: any
  ) => {
    try {
      await supabase
        .from('cash_transaction_history')
        .insert({
          transaction_id: transactionId,
          source_table: sourceTable,
          change_type: changeType,
          old_values: oldValues,
          new_values: newValues,
          modified_by: user?.email || '',
          modified_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('수정 히스토리 저장 오류:', error)
    }
  }

  const handleSetReview = useCallback(
    async (transaction: CashTransaction, status: CashLedgerReviewStatus) => {
      const ref = cashLedgerRefFromRow(transaction)
      if (!ref) return
      const key = cashLedgerReviewKey(ref.source, ref.sourceId)
      const previous = cashLedgerReviewStatusOf(transaction, reviewByKey)
      setReviewSavingKey(key)
      setReviewByKey((prev) => {
        const next = new Map(prev)
        next.set(key, status)
        return next
      })
      const ok = await upsertCashLedgerReview({
        source: ref.source,
        sourceId: ref.sourceId,
        status,
        reviewedBy: user?.email || '',
      })
      if (!ok) {
        setReviewByKey((prev) => {
          const next = new Map(prev)
          next.set(key, previous)
          return next
        })
        toast.error('검토 상태를 저장하지 못했습니다.')
      }
      setReviewSavingKey(null)
    },
    [reviewByKey, user?.email]
  )

  const toggleReviewSelect = useCallback((id: string, checked: boolean) => {
    setReviewSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('금액을 입력해주세요.')
      return
    }

    try {
      setSaving(true)

      const paidToTrim = formData.paid_to.trim()
      if (formData.transaction_type === 'withdrawal' && !paidToTrim) {
        toast.error('Profit Share 수령인을 입력해주세요. (Chad / Joey)')
        setSaving(false)
        return
      }

      const cashAmount = parseFloat(formData.amount)
      const isSplitPaidTo = classifyProfitSharePartner(paidToTrim) === 'split'
      const excludeFields = {
        profit_share_excluded:
          formData.transaction_type === 'withdrawal' && formData.profit_share_excluded,
        offset_paid_to: null as string | null,
        offset_amount: null as number | null,
        offset_method: null as string | null,
      }
      const splitResult = resolveProfitShareSplitPayload({
        isSplit: formData.transaction_type === 'withdrawal' && isSplitPaidTo,
        cashAmount,
        shareChad: formData.share_chad_amount,
        shareJoey: formData.share_joey_amount,
      })
      if (!splitResult.ok) {
        toast.error(splitResult.error)
        setSaving(false)
        return
      }
      const splitFields = splitResult.fields

      if (
        paidToTrim &&
        !paidToOptions.some((name) => name.toLowerCase() === paidToTrim.toLowerCase())
      ) {
        try {
          await supabase.from('expense_vendors').insert({ name: paidToTrim, usage_type: 'one_time' })
          await loadPaidToOptions()
        } catch (vendorErr) {
          console.warn('결제처 목록 자동 추가 실패:', vendorErr)
        }
      }

      if (editingTransaction) {
        // 기존 값 저장 (히스토리용)
        const oldValues = {
          transaction_date: editingTransaction.transaction_date,
          transaction_type: editingTransaction.transaction_type,
          amount: editingTransaction.amount,
          description: editingTransaction.description,
          paid_to: editingTransaction.paid_to,
          offset_paid_to: editingTransaction.offset_paid_to,
          offset_amount: editingTransaction.offset_amount,
          offset_method: editingTransaction.offset_method,
          share_chad_amount: editingTransaction.share_chad_amount,
          share_joey_amount: editingTransaction.share_joey_amount,
          category: editingTransaction.category,
        }

        // 새 값 (bank_deposit은 withdrawal로 변환)
        const dbTransactionType = formData.transaction_type === 'bank_deposit' ? 'withdrawal' : formData.transaction_type
        const description = ensureBankDepositDescription(
          formData.transaction_type,
          formData.description
        ) || null
        const category =
          formData.transaction_type === 'withdrawal'
            ? 'Profit Share'
            : formData.transaction_type === 'bank_deposit'
              ? null
              : editingTransaction.category
        const newValues = {
          transaction_date: parseDatetimeLocalInputToISOString(formData.transaction_date),
          transaction_type: dbTransactionType,
          amount: parseFloat(formData.amount),
          description,
          paid_to: paidToTrim || null,
          category,
          notes: null as string | null,
          ...excludeFields,
          ...splitFields,
        }

        // 출처별로 수정
        if (editingTransaction.source === 'cash_transactions') {
          console.log('현금 거래 수정 시작:', { id: editingTransaction.id, newValues })
          const { data: updatedData, error } = await supabase
            .from('cash_transactions')
            .update({
              transaction_date: newValues.transaction_date,
              transaction_type: newValues.transaction_type,
              amount: newValues.amount,
              description: newValues.description,
              paid_to: newValues.paid_to,
              category: newValues.category,
              notes: newValues.notes,
              offset_paid_to: newValues.offset_paid_to,
              offset_amount: newValues.offset_amount,
              offset_method: newValues.offset_method,
              share_chad_amount: newValues.share_chad_amount,
              share_joey_amount: newValues.share_joey_amount,
              profit_share_excluded: newValues.profit_share_excluded,
              updated_at: new Date().toISOString()
            })
            .eq('operator_id', activeOperatorId)
            .eq('id', editingTransaction.id)
            .select()

          if (error) {
            console.error('현금 거래 수정 오류:', error)
            throw error
          }
          
          console.log('현금 거래 수정 완료:', updatedData)
          
          // 히스토리 저장
          await saveHistory(editingTransaction.id, 'cash_transactions', 'updated', oldValues, newValues)
        } else if (editingTransaction.source === 'payment_records') {
          const originalId = editingTransaction.id.replace('pr_', '')
          const { error } = await supabase
            .from('payment_records')
            .update({
              submit_on: newValues.transaction_date,
              amount: newValues.amount,
              note: newValues.description || null
            })
            .eq('id', originalId)

          if (error) throw error
          
          // 히스토리 저장
          await saveHistory(originalId, 'payment_records', 'updated', oldValues, newValues)
        } else if (editingTransaction.source === 'company_expenses') {
          const originalId = editingTransaction.id.replace('ce_', '')
          const { error } = await supabase
            .from('company_expenses')
            .update({
              submit_on: newValues.transaction_date,
              amount: newValues.amount,
              description: newValues.description,
              notes: editingTransaction.notes,
              paid_for: newValues.category
            })
            .eq('id', originalId)

          if (error) throw error
          
          // 히스토리 저장
          await saveHistory(originalId, 'company_expenses', 'updated', oldValues, newValues)
        }

        toast.success('현금 거래가 수정되었습니다.')
      } else {
        // 추가 (bank_deposit은 withdrawal로 변환)
        const dbTransactionType = formData.transaction_type === 'bank_deposit' ? 'withdrawal' : formData.transaction_type
        const description = ensureBankDepositDescription(
          formData.transaction_type,
          formData.description
        ) || null
        const category =
          formData.transaction_type === 'withdrawal'
            ? 'Profit Share'
            : formData.transaction_type === 'bank_deposit'
              ? null
              : null
        const newValues = {
          transaction_date: parseDatetimeLocalInputToISOString(formData.transaction_date),
          transaction_type: dbTransactionType,
          amount: parseFloat(formData.amount),
          description,
          paid_to: paidToTrim || null,
          category,
          notes: null as string | null,
          ...excludeFields,
          ...splitFields,
        }

        const { data, error } = await supabase
          .from('cash_transactions')
          .insert({
            transaction_date: newValues.transaction_date,
            transaction_type: newValues.transaction_type,
            amount: newValues.amount,
            description: newValues.description,
            paid_to: newValues.paid_to,
            category: newValues.category,
            notes: newValues.notes,
            offset_paid_to: newValues.offset_paid_to,
            offset_amount: newValues.offset_amount,
            offset_method: newValues.offset_method,
            share_chad_amount: newValues.share_chad_amount,
            share_joey_amount: newValues.share_joey_amount,
            profit_share_excluded: newValues.profit_share_excluded,
            created_by: user?.email || '',
            operator_id: activeOperatorId,
          })
          .select()
          .single()

        if (error) throw error

        // 히스토리 저장
        if (data) {
          await saveHistory(data.id, 'cash_transactions', 'created', null, newValues)
        }

        toast.success('현금 거래가 추가되었습니다.')
      }

      // 데이터 다시 로드 (DB 업데이트가 완료되도록 약간의 지연 후 로드)
      console.log('데이터 리로드 시작')
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadTransactions()
      console.log('데이터 리로드 완료')
      
      // 모달 닫기 및 상태 초기화 (데이터 로드 완료 후)
      setIsDialogOpen(false)
      setEditingTransaction(null)
      setFormData(emptyCashFormData())
    } catch (error) {
      console.error('현금 거래 저장 오류:', error)
      toast.error('현금 거래를 저장하는 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleProfitShareExcluded = async (
    transaction: CashTransaction,
    excluded: boolean
  ) => {
    if (transaction.source !== 'cash_transactions') return
    const fields = {
      profit_share_excluded: excluded,
      offset_paid_to: null as string | null,
      offset_amount: null as number | null,
      offset_method: null as string | null,
    }
    const oldValues = {
      profit_share_excluded: transaction.profit_share_excluded,
      offset_paid_to: transaction.offset_paid_to,
    }
    try {
      setOffsetSavingId(transaction.id)
      const { error } = await supabase
        .from('cash_transactions')
        .update({
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq('operator_id', activeOperatorId)
        .eq('id', transaction.id)
      if (error) throw error
      await saveHistory(transaction.id, 'cash_transactions', 'updated', oldValues, fields)
      await loadTransactions()
      toast.success(excluded ? '50/50에서 제외했습니다.' : '50/50에 다시 포함했습니다.')
    } catch (error) {
      console.error('상계 저장 오류:', error)
      toast.error('상계를 저장하는 중 오류가 발생했습니다.')
    } finally {
      setOffsetSavingId(null)
    }
  }

  const handleEdit = async (transaction: CashTransaction) => {
    if (transaction.source === 'payment_records') {
      // payment_records 원본 데이터 가져오기
      const originalId = transaction.id.replace('pr_', '')
      const { data, error } = await supabase
        .from('payment_records')
        .select('*')
        .eq('id', originalId)
        .single()
      
      if (error) {
        toast.error('결제 기록을 불러오는 중 오류가 발생했습니다.')
        return
      }
      
      setEditingPaymentRecord(data)
      setShowPaymentRecordModal(true)
    } else if (transaction.source === 'company_expenses') {
      // company_expenses 원본 데이터 가져오기
      const originalId = transaction.id.replace('ce_', '')
      const { data, error } = await supabase
        .from('company_expenses')
        .select('*')
        .eq('id', originalId)
        .single()
      
      if (error) {
        toast.error('회사 지출을 불러오는 중 오류가 발생했습니다.')
        return
      }
      
      setEditingCompanyExpense(data)
      setShowCompanyExpenseModal(true)
    } else if (transaction.source === 'reservation_expenses') {
      // reservation_expenses 원본 데이터 가져오기
      const originalId = transaction.id.replace('re_', '')
      const { data, error } = await supabase
        .from('reservation_expenses')
        .select('*')
        .eq('id', originalId)
        .single()
      
      if (error) {
        toast.error('예약 지출을 불러오는 중 오류가 발생했습니다.')
        return
      }
      
      setEditingReservationExpense(data)
      setShowReservationExpenseModal(true)
    } else {
      // cash_transactions는 기존 모달 사용
      setEditingTransaction(transaction)
      // description이 "은행 Deposit"인 경우 bank_deposit으로 설정
      const isBankDeposit = isBankDepositDescription(transaction.description)
      setFormData({
        transaction_date: formatDateTimeForDatetimeLocalInput(transaction.transaction_date),
        transaction_type: isBankDeposit ? 'bank_deposit' : transaction.transaction_type,
        amount: transaction.amount.toString(),
        description: transaction.description || '',
        paid_to: transaction.paid_to || '',
        ...excludeFormFromTransaction(transaction),
        ...splitFormFromTransaction(transaction),
      })
      setIsDialogOpen(true)
    }
  }

  const handleDelete = async (id: string) => {
    const transaction = transactions.find(t => t.id === id)
    if (!transaction) return

    try {
      const oldValues = {
        transaction_date: transaction.transaction_date,
        transaction_type: transaction.transaction_type,
        amount: transaction.amount,
        description: transaction.description,
        category: transaction.category,
        notes: transaction.notes
      }

      // 출처별로 삭제
      if (transaction.source === 'cash_transactions') {
        const { error } = await supabase
          .from('cash_transactions')
          .delete()
          .eq('operator_id', activeOperatorId)
          .eq('id', id)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(id, 'cash_transactions', 'deleted', oldValues, null)
      } else if (transaction.source === 'payment_records') {
        const originalId = id.replace('pr_', '')
        const { error } = await supabase
          .from('payment_records')
          .delete()
          .eq('id', originalId)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(originalId, 'payment_records', 'deleted', oldValues, null)
      } else if (transaction.source === 'company_expenses') {
        const originalId = id.replace('ce_', '')
        const { error } = await supabase
          .from('company_expenses')
          .delete()
          .eq('id', originalId)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(originalId, 'company_expenses', 'deleted', oldValues, null)
      } else if (transaction.source === 'reservation_expenses') {
        const originalId = id.replace('re_', '')
        const { error } = await supabase
          .from('reservation_expenses')
          .delete()
          .eq('id', originalId)

        if (error) throw error
        
        // 히스토리 저장
        await saveHistory(originalId, 'reservation_expenses', 'deleted', oldValues, null)
      }

      toast.success('현금 거래가 삭제되었습니다.')
      loadTransactions()
    } catch (error) {
      console.error('현금 거래 삭제 오류:', error)
      toast.error('현금 거래를 삭제하는 중 오류가 발생했습니다.')
    }
  }

  const handleViewHistory = async (transaction: CashTransaction) => {
    const originalId = transaction.id.replace(/^(pr_|ce_|re_)/, '')
    const sourceTable = transaction.source || 'cash_transactions'
    setSelectedTransactionId(transaction.id)
    setShowHistory(true)
    await loadTransactionHistory(originalId, sourceTable)
  }

  const handleNewTransaction = (kind: CashDirectEntryKind) => {
    setEditingTransaction(null)
    setFormData(emptyCashFormData(kind))
    setIsDialogOpen(true)
  }

  const paidToFilterOptions = useMemo(
    () => uniqueColOptions(transactions, cashPaidToFilterValue, colEmptyLabel, locale),
    [transactions, locale]
  )
  const categoryFilterOptions = useMemo(
    () => uniqueColOptions(transactions, cashCategoryFilterValue, colEmptyLabel, locale),
    [transactions, locale]
  )
  const authorFilterOptions = useMemo(
    () => uniqueColOptions(transactions, cashAuthorFilterValue, colEmptyLabel, locale),
    [transactions, locale]
  )
  const paymentStatusFilterOptions = useMemo(
    () => uniqueColOptions(transactions, cashPaymentStatusFilterValue, colEmptyLabel, locale),
    [transactions, locale]
  )

  const cashColFilterFields = useMemo((): CashColFilterField[] => {
    return [
      {
        key: 'type',
        label: '유형',
        options: CASH_TYPE_OPTIONS,
        selected: typeColFilters,
        onChange: setTypeColFilters,
        searchable: false,
      },
      {
        key: 'paid_to',
        label: '결제처',
        options: paidToFilterOptions,
        selected: paidToColFilters,
        onChange: setPaidToColFilters,
      },
      {
        key: 'category',
        label: '카테고리',
        options: categoryFilterOptions,
        selected: categoryColFilters,
        onChange: setCategoryColFilters,
      },
      {
        key: 'source',
        label: '출처',
        options: CASH_SOURCE_OPTIONS,
        selected: sourceColFilters,
        onChange: setSourceColFilters,
        searchable: false,
      },
      {
        key: 'payment_status',
        label: '결제 상태',
        options: paymentStatusFilterOptions,
        selected: paymentStatusColFilters,
        onChange: setPaymentStatusColFilters,
      },
      {
        key: 'author',
        label: '작성자',
        options: authorFilterOptions,
        selected: authorColFilters,
        onChange: setAuthorColFilters,
      },
      {
        key: 'review',
        label: '검토',
        options: CASH_REVIEW_OPTIONS,
        selected: reviewColFilters,
        onChange: setReviewColFilters,
        searchable: false,
      },
    ]
  }, [
    typeColFilters,
    paidToColFilters,
    categoryColFilters,
    sourceColFilters,
    paymentStatusColFilters,
    authorColFilters,
    reviewColFilters,
    paidToFilterOptions,
    categoryFilterOptions,
    paymentStatusFilterOptions,
    authorFilterOptions,
  ])

  const columnFilteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      return (
        matchesColFilter(typeColFilters, cashTypeFilterValue(tx)) &&
        matchesColFilter(paidToColFilters, cashPaidToFilterValue(tx)) &&
        matchesColFilter(categoryColFilters, cashCategoryFilterValue(tx)) &&
        matchesColFilter(sourceColFilters, cashSourceFilterValue(tx)) &&
        matchesColFilter(paymentStatusColFilters, cashPaymentStatusFilterValue(tx)) &&
        matchesColFilter(authorColFilters, cashAuthorFilterValue(tx)) &&
        matchesColFilter(reviewColFilters, cashLedgerReviewStatusOf(tx, reviewByKey))
      )
    })
  }, [
    transactions,
    typeColFilters,
    paidToColFilters,
    categoryColFilters,
    sourceColFilters,
    paymentStatusColFilters,
    authorColFilters,
    reviewColFilters,
    reviewByKey,
  ])

  const hasActiveColFilters =
    typeColFilters.size > 0 ||
    paidToColFilters.size > 0 ||
    categoryColFilters.size > 0 ||
    sourceColFilters.size > 0 ||
    paymentStatusColFilters.size > 0 ||
    authorColFilters.size > 0 ||
    reviewColFilters.size > 0

  // 전체 통계 (컬럼 필터 반영, 잔액 카드는 별도)
  const totalDeposits = columnFilteredTransactions
    .filter(t => t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalWithdrawals = columnFilteredTransactions
    .filter(t => t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)

  // 기간별 통계 계산
  const periodTransactions = columnFilteredTransactions.filter(t => {
    if (!startDate && !endDate) return true
    const transactionDate = new Date(t.transaction_date)
    if (startDate && transactionDate < new Date(startDate)) return false
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      if (transactionDate > end) return false
    }
    return true
  })

  const periodDeposits = periodTransactions
    .filter(t => t.transaction_type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const periodWithdrawals = periodTransactions
    .filter(t => t.transaction_type === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const periodBalance = periodDeposits - periodWithdrawals

  const profitShareSummary = useMemo(() => {
    const rows = periodTransactions.filter((tx) => isLikelyProfitShareCashOut(tx))
    return summarizeProfitShareRows(rows)
  }, [periodTransactions])

  const handleCashTableSort = useCallback(
    (key: string) => {
      if (cashTableSortKey === key) {
        setCashTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setCashTableSortKey(key)
        setCashTableSortDir('asc')
      }
    },
    [cashTableSortKey]
  )

  const cashSortLocale = locale === 'en' ? 'en' : 'ko'

  const cashTypeSortValue = useCallback((tx: CashTransaction) => {
    const isBankDeposit = isBankDepositDescription(tx.description)
    if (isBankDeposit) return 'bank_deposit'
    return tx.transaction_type
  }, [])

  const cashSourceSortValue = useCallback((tx: CashTransaction) => {
    if (tx.source === 'payment_records') return 'payment_records'
    if (tx.source === 'company_expenses') return 'company_expenses'
    if (tx.source === 'reservation_expenses') return 'reservation_expenses'
    return 'cash_transactions'
  }, [])

  const sortedTransactions = useMemo(() => {
    const rows = [...columnFilteredTransactions]
    rows.sort((a, b) => {
      let va: unknown
      let vb: unknown
      switch (cashTableSortKey) {
        case 'date':
          va = a.transaction_date
          vb = b.transaction_date
          break
        case 'type':
          va = cashTypeSortValue(a)
          vb = cashTypeSortValue(b)
          break
        case 'amount':
          va = a.amount
          vb = b.amount
          break
        case 'description':
          va = a.description
          vb = b.description
          break
        case 'paid_to':
          va = a.paid_to
          vb = b.paid_to
          break
        case 'category':
          va = a.category
          vb = b.category
          break
        case 'source':
          va = cashSourceSortValue(a)
          vb = cashSourceSortValue(b)
          break
        case 'payment_status':
          va = a.payment_status
          vb = b.payment_status
          break
        case 'notes':
          va = a.notes
          vb = b.notes
          break
        case 'author':
          va = a.created_by_name || a.created_by
          vb = b.created_by_name || b.created_by
          break
        case 'review':
          va = cashLedgerReviewStatusOf(a, reviewByKey)
          vb = cashLedgerReviewStatusOf(b, reviewByKey)
          break
        default:
          va = a.transaction_date
          vb = b.transaction_date
      }
      return compareSortValues(va, vb, cashTableSortDir, cashSortLocale)
    })
    return rows
  }, [
    columnFilteredTransactions,
    cashTableSortKey,
    cashTableSortDir,
    cashSortLocale,
    cashTypeSortValue,
    cashSourceSortValue,
    reviewByKey,
  ])

  // 페이지네이션 계산
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex)
  const reviewPageIds = useMemo(
    () => paginatedTransactions.map((tx) => tx.id),
    [paginatedTransactions]
  )
  const reviewAllPageSelected =
    reviewPageIds.length > 0 && reviewPageIds.every((id) => reviewSelectedIds.has(id))
  const reviewSomePageSelected = reviewPageIds.some((id) => reviewSelectedIds.has(id))

  const handleBulkSetReview = useCallback(
    async (status: CashLedgerReviewStatus) => {
      const selected = sortedTransactions.filter((tx) => reviewSelectedIds.has(tx.id))
      const refs = selected
        .map((tx) => cashLedgerRefFromRow(tx))
        .filter((ref): ref is NonNullable<typeof ref> => Boolean(ref))
      if (refs.length === 0) {
        toast.error('검토할 거래를 선택하세요.')
        return
      }
      const previous = new Map(reviewByKey)
      setReviewBulkSaving(true)
      setReviewByKey((prev) => {
        const next = new Map(prev)
        for (const ref of refs) {
          next.set(cashLedgerReviewKey(ref.source, ref.sourceId), status)
        }
        return next
      })
      const result = await bulkUpsertCashLedgerReviews({
        refs,
        status,
        reviewedBy: user?.email || '',
      })
      if (result.failed > 0) {
        setReviewByKey(previous)
        toast.error(
          result.updated > 0
            ? `${result.updated}건 저장, ${result.failed}건 실패`
            : '일괄 검토를 저장하지 못했습니다.'
        )
      } else {
        toast.success(
          `${result.updated}건을 ${
            status === 'approved' ? '승인' : status === 'flagged' ? '플래그' : '비승인'
          } 처리했습니다.`
        )
        setReviewSelectedIds(new Set())
      }
      setReviewBulkSaving(false)
    },
    [sortedTransactions, reviewSelectedIds, reviewByKey, user?.email]
  )

  const autoMatchCashTargets = useMemo((): CashAutoMatchInputRow[] => {
    const out: CashAutoMatchInputRow[] = []
    for (const tx of sortedTransactions) {
      if (tx.source !== 'cash_transactions') continue
      if (isCashRowReconciled(tx, reconciledCashRowKeys, exemptCashRowKeys)) continue
      const isBankDeposit =
        tx.description?.includes('은행 Deposit') || tx.description === '은행 Deposit'
      if (isBankDeposit) continue
      out.push({
        id: tx.id,
        transaction_date: tx.transaction_date,
        amount: Math.abs(Number(tx.amount ?? 0)),
        transaction_type: tx.transaction_type === 'deposit' ? 'deposit' : 'withdrawal',
        description: tx.description ?? '',
        paid_to: tx.paid_to ?? '',
        category: tx.category,
        linked_payment_record_id:
          tx.reference_type === 'payment_record' ? tx.reference_id : null,
      })
    }
    return out.filter((r) => r.amount > AMOUNT_EQUAL_EPS)
  }, [sortedTransactions, reconciledCashRowKeys, exemptCashRowKeys])

  const autoMatchLedgerTargets = useMemo((): ExpenseAutoMatchInputRow[] => {
    const out: ExpenseAutoMatchInputRow[] = []
    for (const tx of sortedTransactions) {
      if (isCashRowReconciled(tx, reconciledCashRowKeys, exemptCashRowKeys)) continue
      const r = reconSourceFromCashTransaction(tx)
      if (!r || r.sourceTable === 'cash_transactions') continue
      out.push({
        id: r.sourceId,
        submit_on: tx.transaction_date,
        amount: Math.abs(Number(tx.amount ?? 0)),
        paid_to: tx.paid_to?.trim() || tx.description || '',
        paid_for: tx.category ?? '',
        payment_method: null,
        sourceTable: r.sourceTable,
      })
    }
    return out.filter((e) => Math.abs(Number(e.amount ?? 0)) > AMOUNT_EQUAL_EPS)
  }, [sortedTransactions, reconciledCashRowKeys, exemptCashRowKeys])

  const cashReconPageKey = useMemo(
    () =>
      paginatedTransactions
        .map((tx) => {
          const r = reconSourceFromCashTransaction(tx)
          return r ? `${r.sourceTable}:${r.sourceId}` : `—:${tx.id}`
        })
        .join('|'),
    [paginatedTransactions]
  )

  const paginatedTransactionsRef = useRef(paginatedTransactions)
  paginatedTransactionsRef.current = paginatedTransactions

  const loadCashReconKeys = useCallback(async () => {
    const byTable = new Map<string, string[]>()
    for (const tx of paginatedTransactionsRef.current) {
      const r = reconSourceFromCashTransaction(tx)
      if (!r) continue
      const arr = byTable.get(r.sourceTable) ?? []
      arr.push(r.sourceId)
      byTable.set(r.sourceTable, arr)
    }
    if (byTable.size === 0) {
      setReconciledCashRowKeys(new Set())
      setExemptCashRowKeys(new Set())
      return
    }
    const keys = new Set<string>()
    const exemptKeys = await fetchReconciliationExemptKeysForSources(supabase, byTable)
    for (const [table, ids] of byTable) {
      const unique = [...new Set(ids)]
      if (unique.length === 0) continue
      try {
        if (table === 'cash_transactions') {
          const [cashMatched, stmtMatched] = await Promise.all([
            fetchCashLedgerMatchedCashTransactionIds(supabase, unique),
            fetchReconciledSourceIds(supabase, table, unique),
          ])
          for (const id of cashMatched) keys.add(`${table}:${id}`)
          for (const id of stmtMatched) keys.add(`${table}:${id}`)
        } else {
          const [stmtMatched, cashLedgerMatched] = await Promise.all([
            fetchReconciledSourceIds(supabase, table, unique),
            fetchCashLedgerMatchedExpenseIds(supabase, table, unique),
          ])
          for (const id of stmtMatched) keys.add(`${table}:${id}`)
          for (const id of cashLedgerMatched) keys.add(`${table}:${id}`)
        }
      } catch {
        /* ignore row errors */
      }
    }
    setReconciledCashRowKeys(keys)
    setExemptCashRowKeys(exemptKeys)
  }, [])

  useEffect(() => {
    void loadCashReconKeys()
  }, [cashReconPageKey, loadCashReconKeys])

  const openCashStmtRecon = useCallback((tx: CashTransaction) => {
    const src = reconSourceFromCashTransaction(tx)
    if (!src) return
    const ymd = cashTransactionDateYmd(tx)
    if (!ymd) return
    setStmtReconCtx({
      sourceTable: src.sourceTable,
      sourceId: src.sourceId,
      dateYmd: ymd,
      amount: Math.abs(Number(tx.amount ?? 0)),
      direction: tx.transaction_type === 'deposit' ? 'inflow' : 'outflow'
    })
    setStmtReconOpen(true)
  }, [])

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, typeColFilters, paidToColFilters, categoryColFilters, sourceColFilters, paymentStatusColFilters, authorColFilters, reviewColFilters, startDate, endDate])

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* 기간 필터 - 모바일 컴팩트 */}
      <Card className="border rounded-lg min-w-0 max-w-full">
        <CardHeader className="p-3 sm:p-4 lg:p-6 pb-0">
          <CardTitle className="text-sm sm:text-base">기간 필터</CardTitle>
          <CardDescription className="text-xs hidden sm:block">조회할 기간을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 pt-3">
          <div className="flex flex-wrap gap-2 sm:gap-4 items-end min-w-0">
            <div className="space-y-1 sm:space-y-2 min-w-0 w-full sm:w-auto">
              <Label htmlFor="start_date" className="text-xs sm:text-sm">시작일</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-w-0 max-w-full sm:max-w-[200px] h-8 sm:h-10 text-sm"
              />
            </div>
            <div className="space-y-1 sm:space-y-2 min-w-0 w-full sm:w-auto">
              <Label htmlFor="end_date" className="text-xs sm:text-sm">종료일</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-w-0 max-w-full sm:max-w-[200px] h-8 sm:h-10 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm h-8 sm:h-10"
              onClick={() => {
                setStartDate(DEFAULT_CASH_PERIOD_START)
                setEndDate('')
              }}
            >
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 현금 잔액 카드 - 모바일 컴팩트 */}
      <div className="grid grid-cols-1 min-w-0 md:grid-cols-3 gap-2 sm:gap-4">
        <Card className="border rounded-lg min-w-0 max-w-full">
          <CardHeader className="p-3 sm:pb-3 lg:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              {startDate || endDate ? '기간 잔액' : '현재 현금 잔액'}
            </CardTitle>
            {startDate || endDate ? (
              <CardDescription className="text-xs">
                {startDate && endDate 
                  ? `${startDate} ~ ${endDate}`
                  : startDate 
                    ? `${startDate} 이후`
                    : `${endDate} 이전`}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xl sm:text-3xl font-bold text-gray-900 truncate">
                  ${(startDate || endDate ? periodBalance : balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {startDate || endDate ? (
                  <div className="text-xs text-gray-500 mt-1">
                    전체: ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border rounded-lg min-w-0 max-w-full">
          <CardHeader className="p-3 sm:pb-3 lg:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              {startDate || endDate ? '기간 입금' : '총 입금'}
            </CardTitle>
            {startDate || endDate ? (
              <CardDescription className="text-xs">
                {startDate && endDate 
                  ? `${startDate} ~ ${endDate}`
                  : startDate 
                    ? `${startDate} 이후`
                    : `${endDate} 이전`}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xl sm:text-3xl font-bold text-primary truncate">
                  ${(startDate || endDate ? periodDeposits : totalDeposits).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {startDate || endDate ? (
                  <div className="text-xs text-gray-500 mt-1">
                    전체: ${totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border rounded-lg min-w-0 max-w-full">
          <CardHeader className="p-3 sm:pb-3 lg:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-600">
              {startDate || endDate ? '기간 출금' : '총 출금'}
            </CardTitle>
            {startDate || endDate ? (
              <CardDescription className="text-xs">
                {startDate && endDate 
                  ? `${startDate} ~ ${endDate}`
                  : startDate 
                    ? `${startDate} 이후`
                    : `${endDate} 이전`}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-red-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xl sm:text-3xl font-bold text-red-600 truncate">
                  ${(startDate || endDate ? periodWithdrawals : totalWithdrawals).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                {startDate || endDate ? (
                  <div className="text-xs text-gray-500 mt-1">
                    전체: ${totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <UnreceivedAssignedCashBalancePanel />

      {profitShareSummary.pairTotal > 0.005 || profitShareSummary.split > 0.005 ? (
        <Card className="border rounded-lg min-w-0 max-w-full">
          <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2">
            <CardTitle className="text-sm sm:text-base">Profit Share 분배</CardTitle>
            <CardDescription className="text-xs">
              현금 직접 지출 중 Chad / Joey 수령분입니다. 상계로 표시한 건은 현금 잔액에는 남고 여기 비율에서는 빠집니다. 회사·투어 운영비와 은행 Deposit은 제외합니다. 기준은 50% / 50%입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                <div className="text-xs text-gray-500">Chad</div>
                <div className="text-lg font-semibold tabular-nums">
                  ${profitShareSummary.chad.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-500 tabular-nums">
                  {profitShareSummary.pairTotal > 0.005 ? `${profitShareSummary.chadPct.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
                <div className="text-xs text-gray-500">Joey</div>
                <div className="text-lg font-semibold tabular-nums">
                  ${profitShareSummary.joey.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-500 tabular-nums">
                  {profitShareSummary.pairTotal > 0.005 ? `${profitShareSummary.joeyPct.toFixed(1)}%` : '—'}
                </div>
              </div>
              <div
                className={`rounded-lg border p-3 ${
                  profitShareSummary.unbalanced
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50/70'
                }`}
              >
                <div className="text-xs text-gray-500">차이 (50/50)</div>
                <div className="text-lg font-semibold tabular-nums">
                  ${profitShareSummary.gap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-600">
                  {profitShareSummary.unbalanced
                    ? '5%p 이상 벌어져 있습니다. 수령인·금액을 확인하세요.'
                    : '균형 범위 안입니다.'}
                </div>
              </div>
            </div>
            {profitShareSummary.split > 0.005 ? (
              <p className="text-xs text-gray-500 mt-2">
                합산 기재 ${profitShareSummary.split.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}는 Chad / Joey 개인 몫으로 나눠 비율에 포함했습니다. 기본은 반반이며, 건을 열어 금액을 바꿀 수 있습니다.
              </p>
            ) : null}
            {profitShareSummary.excluded > 0.005 ? (
              <p className="text-xs text-gray-500 mt-2">
                상계 ${profitShareSummary.excluded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}는 50/50에서 제외했습니다.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* 필터 및 거래 내역 - 모바일 컴팩트 */}
      <Card className="border rounded-lg min-w-0 max-w-full">
        <CardHeader className="p-3 sm:p-4 lg:p-6 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">현금 거래 내역</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-sm"
                title={tBulkAutoMatch('buttonTitle')}
                onClick={() => setBulkAutoMatchOpen(true)}
              >
                <Wand2 className="w-4 h-4 mr-1.5 sm:mr-2" />
                <span className="hidden sm:inline">{tBulkAutoMatch('button')}</span>
                <span className="sm:hidden">{tBulkAutoMatch('buttonShort')}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-sm border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                onClick={() => handleNewTransaction('deposit')}
              >
                <ArrowUpCircle className="w-4 h-4 mr-1.5 sm:mr-2" />
                입금 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-sm border-rose-300 text-rose-800 hover:bg-rose-50"
                onClick={() => handleNewTransaction('withdrawal')}
              >
                <ArrowDownCircle className="w-4 h-4 mr-1.5 sm:mr-2" />
                지출 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-sm border-violet-300 text-violet-800 hover:bg-violet-50"
                onClick={() => handleNewTransaction('bank_deposit')}
              >
                <Landmark className="w-4 h-4 mr-1.5 sm:mr-2" />
                은행 Deposit 추가
              </Button>
            </div>
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open)
                if (!open) setEditingTransaction(null)
              }}
            >
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {cashDirectEntryTitle(formData.transaction_type, Boolean(editingTransaction))}
                  </DialogTitle>
                  <DialogDescription>
                    {cashDirectEntryDescription(formData.transaction_type)}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="transaction_date">거래 일시 *</Label>
                      <Input
                        id="transaction_date"
                        type="datetime-local"
                        step={60}
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                        required
                        className="min-w-0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>거래 유형</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                        {formData.transaction_type === 'bank_deposit'
                          ? '은행 Deposit'
                          : formData.transaction_type === 'withdrawal'
                            ? '지출 (Profit Share)'
                            : '입금'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">금액 *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData(
                          formData.transaction_type === 'withdrawal' &&
                            classifyProfitSharePartner(formData.paid_to) === 'split'
                            ? applyProfitShareSplitHalves(formData, e.target.value)
                            : { ...formData, amount: e.target.value }
                        )
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="paid_to">
                      {formData.transaction_type === 'withdrawal' ? '수령인 *' : '결제처'}
                    </Label>
                    <ExpensePaidToCombobox
                      id="paid_to"
                      value={formData.paid_to}
                      onChange={(paid_to) => setFormData(applyProfitSharePaidToChange(formData, paid_to))}
                      options={cashPaidToComboboxOptions}
                      placeholder={
                        formData.transaction_type === 'withdrawal'
                          ? 'Chad, Joey 또는 둘 다'
                          : '결제처 선택 또는 입력'
                      }
                      parentOpen={isDialogOpen}
                      disabled={saving}
                    />
                    {formData.transaction_type === 'withdrawal' ? (
                      <ProfitSharePaidToPresets
                        value={formData.paid_to}
                        disabled={saving}
                        onChange={(paid_to) => setFormData(applyProfitSharePaidToChange(formData, paid_to))}
                      />
                    ) : null}
                  </div>

                  {formData.transaction_type === 'withdrawal' &&
                  classifyProfitSharePartner(formData.paid_to) === 'split' ? (
                    <ProfitShareSplitFields
                      form={formData}
                      disabled={saving}
                      onChange={setFormData}
                    />
                  ) : null}

                  {formData.transaction_type === 'withdrawal' ? (
                    <ProfitShareExcludeFields
                      excluded={formData.profit_share_excluded}
                      disabled={saving}
                      onChange={(profit_share_excluded) => setFormData({ ...formData, profit_share_excluded })}
                    />
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="description">설명</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={
                        formData.transaction_type === 'withdrawal'
                          ? 'Profit Share'
                          : formData.transaction_type === 'bank_deposit'
                            ? '은행 Deposit'
                            : '거래 설명을 입력하세요'
                      }
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false)
                        setEditingTransaction(null)
                      }}
                    >
                      취소
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? '저장 중...' : editingTransaction ? '수정' : '추가'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <div className="space-y-3 sm:space-y-4">
            {/* 필터 - 모바일 컴팩트 */}
            <div className="flex flex-wrap gap-2 sm:gap-4 min-w-0">
              <div className="flex flex-1 min-w-0 gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="search"
                    placeholder="검색..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        applySearch()
                      }
                    }}
                    className="pl-8 h-8 sm:h-10 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  className="shrink-0 h-8 sm:h-10 text-sm px-3"
                  onClick={applySearch}
                >
                  <Search className="w-4 h-4 mr-1" />
                  검색
                </Button>
              </div>
              <CashColumnFiltersBar fields={cashColFilterFields} />
            </div>

            {/* 거래 내역 */}
            {loading ? (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">로딩 중...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-sm">거래 내역이 없습니다.</div>
            ) : (
              <>
                <div className="flex flex-col gap-2 rounded-lg border border-gray-200/80 bg-gray-50/50 p-2 sm:p-3 sm:flex-row sm:flex-wrap sm:items-center mb-3">
                  <span className="text-xs text-muted-foreground">
                    {reviewSelectedIds.size}건 선택
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reviewBulkSaving || reviewPageIds.length === 0}
                    onClick={() => {
                      setReviewSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (reviewAllPageSelected) {
                          for (const id of reviewPageIds) next.delete(id)
                        } else {
                          for (const id of reviewPageIds) next.add(id)
                        }
                        return next
                      })
                    }}
                  >
                    {reviewAllPageSelected ? '이 페이지 해제' : '이 페이지 선택'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reviewBulkSaving || sortedTransactions.length === 0}
                    onClick={() => setReviewSelectedIds(new Set(sortedTransactions.map((tx) => tx.id)))}
                  >
                    현재 목록 전체
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reviewBulkSaving || reviewSelectedIds.size === 0}
                    onClick={() => setReviewSelectedIds(new Set())}
                  >
                    선택 해제
                  </Button>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <span className="text-xs text-muted-foreground">일괄 검토</span>
                    <CashLedgerReviewControls
                      status={null}
                      showLabel
                      disabled={reviewBulkSaving || reviewSelectedIds.size === 0}
                      onChange={(next) => void handleBulkSetReview(next)}
                    />
                  </div>
                </div>
                {/* 모바일: 카드 리스트 - 라벨/값 구조 */}
                <div className="md:hidden space-y-3">
                  {paginatedTransactions.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      {hasActiveColFilters ? '선택한 필터에 맞는 거래가 없습니다.' : '거래 내역이 없습니다.'}
                    </div>
                  ) : (
                  paginatedTransactions.map((transaction) => {
                    const isBankDeposit = transaction.description?.includes('은행 Deposit') || transaction.description === '은행 Deposit'
                    const displayType = isBankDeposit ? '은행' : (transaction.transaction_type === 'deposit' ? '입금' : '출금')
                    const date = new Date(transaction.transaction_date)
                    const dateStr = `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`
                    const sourceBadge = cashSourceBadge(transaction.source)
                    const reconSrc = reconSourceFromCashTransaction(transaction)
                    const rowExempt = isCashRowExempt(transaction, exemptCashRowKeys)
                    const rowMatched = isCashRowStmtMatched(transaction, reconciledCashRowKeys)
                    return (
                      <div key={transaction.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:bg-gray-50/80 active:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-2">
                            <Checkbox
                              className="mt-1"
                              checked={reviewSelectedIds.has(transaction.id)}
                              onCheckedChange={(c) => toggleReviewSelect(transaction.id, c === true)}
                              aria-label="검토 선택"
                              disabled={reviewBulkSaving}
                            />
                            <div className="flex items-start gap-1">
                            <ExpenseStatementReconIcon
                              matched={rowMatched}
                              exempt={rowExempt}
                              disabled={!reconSrc}
                              titleMatched={tStmt('matchedTitle')}
                              titleUnmatched={tStmt('unmatchedTitle')}
                              titleExempt={tStmt('exemptTitle')}
                              titleDisabled={tStmt('disabledTitle')}
                              onClick={() => openCashStmtRecon(transaction)}
                            />
                            {reconSrc ? (
                              <ExpenseReconciliationExemptToggle
                                compact
                                sourceTable={reconSrc.sourceTable}
                                sourceId={reconSrc.sourceId}
                                exempt={rowExempt}
                                onChanged={() => void loadCashReconKeys()}
                              />
                            ) : null}
                            <div>
                              <p className="text-xs text-gray-500">{dateStr}</p>
                              <Badge variant={transaction.transaction_type === 'deposit' ? 'default' : 'destructive'} className="text-xs mt-1">
                                {displayType}
                              </Badge>
                            </div>
                            </div>
                          </div>
                          <p className={`text-lg font-bold ${transaction.transaction_type === 'deposit' ? 'text-primary' : 'text-red-600'}`}>
                            {transaction.transaction_type === 'deposit' ? '+' : '-'}
                            ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                          <span className="text-gray-400">설명</span>
                          <span className="truncate">{transaction.description || '-'}</span>
                          <span className="text-gray-400">결제처</span>
                          <span className="truncate">{transaction.paid_to?.trim() || '—'}</span>
                          {formatProfitShareExcludeLabel(transaction) ? (
                            <>
                              <span className="text-gray-400">상계</span>
                              <span className="truncate">{formatProfitShareExcludeLabel(transaction)}</span>
                            </>
                          ) : null}
                          {formatProfitShareSplitLabel(transaction) ? (
                            <>
                              <span className="text-gray-400">분배</span>
                              <span className="truncate">{formatProfitShareSplitLabel(transaction)}</span>
                            </>
                          ) : null}
                          <span className="text-gray-400">카테고리</span>
                          <span>{transaction.category || '-'}</span>
                          <span className="text-gray-400">출처</span>
                          <span>
                            <Badge variant={sourceBadge.variant} className="text-xs whitespace-nowrap">
                              {sourceBadge.label}
                            </Badge>
                          </span>
                          {transaction.source === 'payment_records' ? (
                            <>
                              <span className="text-gray-400">결제 상태</span>
                              <span className="truncate" title={transaction.payment_status || ''}>
                                {transaction.payment_status?.trim() || '—'}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
                          {(() => {
                            const ref = cashLedgerRefFromRow(transaction)
                            const key = ref ? cashLedgerReviewKey(ref.source, ref.sourceId) : ''
                            return (
                              <CashLedgerReviewControls
                                status={cashLedgerReviewStatusOf(transaction, reviewByKey)}
                                disabled={!ref || reviewSavingKey === key || reviewBulkSaving}
                                showLabel
                                onChange={(next) => void handleSetReview(transaction, next)}
                              />
                            )
                          })()}
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                          {canToggleProfitShareExcluded(transaction) ? (
                            <ProfitShareOffsetQuickButtons
                              excluded={isProfitShareExcluded(transaction)}
                              disabled={offsetSavingId === transaction.id || saving}
                              onChange={(excluded) => void handleToggleProfitShareExcluded(transaction, excluded)}
                            />
                          ) : null}
                          <Button variant="ghost" size="sm" className="h-10 w-10 p-0 min-h-[44px]" onClick={() => handleViewHistory(transaction)} title="히스토리">
                            <History className="w-4 h-4" />
                          </Button>
                          {cashMoveExpenseItem(transaction) ? (
                            <MoveExpenseTableButton
                              iconOnly
                              variant="ghost"
                              items={[cashMoveExpenseItem(transaction)!]}
                              onMoved={() => void loadTransactions()}
                            />
                          ) : null}
                          <Button variant="ghost" size="sm" className="h-10 w-10 p-0 min-h-[44px]" onClick={() => handleEdit(transaction)} title="수정">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-red-600 min-h-[44px]" title="삭제">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>거래 삭제 확인</AlertDialogTitle>
                                <AlertDialogDescription>이 거래를 삭제하시겠습니까?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(transaction.id)}>삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )
                  })
                  )}
                </div>
                {/* 데스크톱: 테이블 */}
                <div className="hidden md:block border rounded-lg overflow-x-auto max-w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 w-10 text-center">
                        <Checkbox
                          checked={
                            reviewAllPageSelected
                              ? true
                              : reviewSomePageSelected
                                ? 'indeterminate'
                                : false
                          }
                          onCheckedChange={() => {
                            setReviewSelectedIds((prev) => {
                              const next = new Set(prev)
                              if (reviewAllPageSelected) {
                                for (const id of reviewPageIds) next.delete(id)
                              } else {
                                for (const id of reviewPageIds) next.add(id)
                              }
                              return next
                            })
                          }}
                          aria-label="이 페이지 전체 선택"
                          disabled={reviewBulkSaving || reviewPageIds.length === 0}
                        />
                      </TableHead>
                      <TableHead className="py-2 w-12 text-center" title={tStmt('unmatchedTitle')}>
                        {tStmt('columnHeaderShort')}
                      </TableHead>
                      <TableHead className="py-2 w-[7.25rem] min-w-[7.25rem] max-w-[7.25rem] pr-2 align-bottom">
                        <TableSortHeaderButton
                          label="날짜"
                          active={cashTableSortKey === 'date'}
                          dir={cashTableSortDir}
                          onClick={() => handleCashTableSort('date')}
                        />
                      </TableHead>
                      <TableHead className="w-32 min-w-[8rem] max-w-[8.5rem] pl-2 py-2 align-bottom">
                        <CashColumnHeader
                          label="유형"
                          sortKey="type"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={CASH_TYPE_OPTIONS}
                          filterSelected={typeColFilters}
                          onFilterChange={setTypeColFilters}
                          searchable={false}
                        />
                      </TableHead>
                      <TableHead className="py-2 align-bottom">
                        <TableSortHeaderButton
                          label="금액"
                          active={cashTableSortKey === 'amount'}
                          dir={cashTableSortDir}
                          onClick={() => handleCashTableSort('amount')}
                        />
                      </TableHead>
                      <TableHead className="py-2 align-bottom">
                        <TableSortHeaderButton
                          label="설명"
                          active={cashTableSortKey === 'description'}
                          dir={cashTableSortDir}
                          onClick={() => handleCashTableSort('description')}
                        />
                      </TableHead>
                      <TableHead className="w-44 min-w-[10rem] py-2 align-bottom">
                        <CashColumnHeader
                          label="결제처"
                          sortKey="paid_to"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={paidToFilterOptions}
                          filterSelected={paidToColFilters}
                          onFilterChange={setPaidToColFilters}
                        />
                      </TableHead>
                      <TableHead className="w-44 min-w-[10rem] py-2 align-bottom">
                        <CashColumnHeader
                          label="카테고리"
                          sortKey="category"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={categoryFilterOptions}
                          filterSelected={categoryColFilters}
                          onFilterChange={setCategoryColFilters}
                        />
                      </TableHead>
                      <TableHead className="w-44 min-w-[11rem] py-2 align-bottom">
                        <CashColumnHeader
                          label="출처"
                          sortKey="source"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={CASH_SOURCE_OPTIONS}
                          filterSelected={sourceColFilters}
                          onFilterChange={setSourceColFilters}
                          searchable={false}
                        />
                      </TableHead>
                      <TableHead className="min-w-[9rem] max-w-[12rem] py-2 align-bottom">
                        <CashColumnHeader
                          label="결제 상태"
                          sortKey="payment_status"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={paymentStatusFilterOptions}
                          filterSelected={paymentStatusColFilters}
                          onFilterChange={setPaymentStatusColFilters}
                        />
                      </TableHead>
                      <TableHead className="w-[5.25rem] min-w-[5.25rem] max-w-[5.25rem] py-2 align-bottom">
                        <CashColumnHeader
                          label="작성자"
                          sortKey="author"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={authorFilterOptions}
                          filterSelected={authorColFilters}
                          onFilterChange={setAuthorColFilters}
                        />
                      </TableHead>
                      <TableHead className="w-[6.75rem] min-w-[6.75rem] py-2 align-bottom">
                        <CashColumnHeader
                          label="검토"
                          sortKey="review"
                          activeSortKey={cashTableSortKey}
                          sortDir={cashTableSortDir}
                          onSort={handleCashTableSort}
                          filterOptions={CASH_REVIEW_OPTIONS}
                          filterSelected={reviewColFilters}
                          onFilterChange={setReviewColFilters}
                          searchable={false}
                        />
                      </TableHead>
                      <TableHead className="text-right w-64 min-w-[16rem] py-2">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-8 text-center text-sm text-gray-500">
                          {hasActiveColFilters ? '선택한 필터에 맞는 거래가 없습니다.' : '거래 내역이 없습니다.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                    paginatedTransactions.map((transaction) => {
                      const sourceBadge = cashSourceBadge(transaction.source)
                      const reconSrc = reconSourceFromCashTransaction(transaction)
                      const rowExempt = isCashRowExempt(transaction, exemptCashRowKeys)
                      const rowMatched = isCashRowStmtMatched(transaction, reconciledCashRowKeys)
                      
                      return (
                        <TableRow key={transaction.id} className="h-10">
                          <TableCell className="py-1 w-10 text-center align-middle">
                            <Checkbox
                              checked={reviewSelectedIds.has(transaction.id)}
                              onCheckedChange={(c) => toggleReviewSelect(transaction.id, c === true)}
                              aria-label="검토 선택"
                              disabled={reviewBulkSaving}
                            />
                          </TableCell>
                          <TableCell className="py-1 w-12 text-center align-middle">
                            <div className="inline-flex items-center gap-0.5">
                              <ExpenseStatementReconIcon
                                matched={rowMatched}
                                exempt={rowExempt}
                                disabled={!reconSrc}
                                titleMatched={tStmt('matchedTitle')}
                                titleUnmatched={tStmt('unmatchedTitle')}
                                titleExempt={tStmt('exemptTitle')}
                                titleDisabled={tStmt('disabledTitle')}
                                onClick={() => openCashStmtRecon(transaction)}
                              />
                              {reconSrc ? (
                                <ExpenseReconciliationExemptToggle
                                  compact
                                  sourceTable={reconSrc.sourceTable}
                                  sourceId={reconSrc.sourceId}
                                  exempt={rowExempt}
                                  onChanged={() => void loadCashReconKeys()}
                                />
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-1 w-[7.25rem] max-w-[7.25rem] pr-2 whitespace-nowrap">
                            {(() => {
                              // ISO 형식의 날짜를 로컬 시간대로 변환하여 날짜만 표시
                              const date = new Date(transaction.transaction_date)
                              // 로컬 시간대의 날짜 부분만 추출
                              const year = date.getFullYear()
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const day = String(date.getDate()).padStart(2, '0')
                              return `${year}. ${month}. ${day}.`
                            })()}
                          </TableCell>
                          <TableCell className="w-32 max-w-[8.5rem] pl-2 py-1">
                            {(() => {
                              const isBankDeposit = transaction.description?.includes('은행 Deposit') || transaction.description === '은행 Deposit'
                              const displayType = isBankDeposit ? '은행 Deposit' : (transaction.transaction_type === 'deposit' ? '입금' : '출금')
                              return (
                                <Badge
                                  variant={transaction.transaction_type === 'deposit' ? 'default' : 'destructive'}
                                  className="flex items-center gap-1 w-fit text-xs"
                                >
                                  {transaction.transaction_type === 'deposit' ? (
                                    <ArrowDownCircle className="w-3 h-3" />
                                  ) : (
                                    <ArrowUpCircle className="w-3 h-3" />
                                  )}
                                  {displayType}
                                </Badge>
                              )
                            })()}
                          </TableCell>
                          <TableCell className="font-medium py-1 text-sm">
                            <span className={transaction.transaction_type === 'deposit' ? 'text-primary' : 'text-red-600'}>
                              {transaction.transaction_type === 'deposit' ? '+' : '-'}
                              ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                          <TableCell className="py-1 text-sm">
                            {(transaction.source === 'payment_records' || transaction.source === 'reservation_expenses') && transaction.reference_id ? (
                              <button
                                onClick={() => {
                                  setSelectedReservationId(transaction.reference_id)
                                  setShowReservationModal(true)
                                }}
                                className="text-primary hover:text-primary/80 hover:underline cursor-pointer"
                                title="예약 상세 보기"
                              >
                                {transaction.description || (transaction.source === 'payment_records' ? `예약 결제 (${transaction.reference_id})` : `예약 지출 (${transaction.reference_id})`)}
                              </button>
                            ) : (
                              transaction.description || '-'
                            )}
                          </TableCell>
                          <TableCell
                            className="w-40 min-w-[8rem] py-1 text-sm"
                            title={
                              [
                                transaction.paid_to?.trim() || '',
                                formatProfitShareExcludeLabel(transaction) || '',
                                formatProfitShareSplitLabel(transaction) || '',
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            }
                          >
                            <div className="truncate">{transaction.paid_to?.trim() || '—'}</div>
                            {formatProfitShareExcludeLabel(transaction) ? (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {formatProfitShareExcludeLabel(transaction)}
                              </div>
                            ) : null}
                            {formatProfitShareSplitLabel(transaction) ? (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {formatProfitShareSplitLabel(transaction)}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="w-40 py-1">
                            {transaction.category ? (
                              <Badge variant="outline" className="text-xs">{transaction.category}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="w-44 min-w-[11rem] py-1">
                            <Badge variant={sourceBadge.variant} className="text-xs whitespace-nowrap">
                              {sourceBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="min-w-[7rem] max-w-[10rem] py-1 text-xs text-gray-800" title={transaction.payment_status || ''}>
                            {transaction.source === 'payment_records'
                              ? transaction.payment_status?.trim() || '—'
                              : '—'}
                          </TableCell>
                          <TableCell className="w-[5.25rem] max-w-[5.25rem] text-sm text-gray-500 py-1">
                            <HoverDetailText text={transaction.created_by_name} />
                          </TableCell>
                          <TableCell className="w-[6.75rem] py-1">
                            {(() => {
                              const ref = cashLedgerRefFromRow(transaction)
                              const key = ref ? cashLedgerReviewKey(ref.source, ref.sourceId) : ''
                              return (
                                <CashLedgerReviewControls
                                  status={cashLedgerReviewStatusOf(transaction, reviewByKey)}
                                  disabled={!ref || reviewSavingKey === key || reviewBulkSaving}
                                  onChange={(next) => void handleSetReview(transaction, next)}
                                />
                              )
                            })()}
                          </TableCell>
                          <TableCell className="text-right w-64 min-w-[16rem] py-1">
                            <div className="flex justify-end gap-1 flex-wrap items-center">
                              {canToggleProfitShareExcluded(transaction) ? (
                                <ProfitShareOffsetQuickButtons
                                  excluded={isProfitShareExcluded(transaction)}
                                  disabled={offsetSavingId === transaction.id || saving}
                                  onChange={(excluded) => void handleToggleProfitShareExcluded(transaction, excluded)}
                                />
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewHistory(transaction)}
                                title="수정 히스토리"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                              {cashMoveExpenseItem(transaction) ? (
                                <MoveExpenseTableButton
                                  iconOnly
                                  variant="ghost"
                                  size="sm"
                                  items={[cashMoveExpenseItem(transaction)!]}
                                  onMoved={() => void loadTransactions()}
                                />
                              ) : null}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(transaction)}
                                title="수정"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" title="삭제">
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>거래 삭제 확인</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 거래를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(transaction.id)}>
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                    )}
                  </TableBody>
                </Table>
                </div>
              </>
            )}

            {/* 페이지네이션 - 모바일 컴팩트 */}
            {sortedTransactions.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm text-gray-600">페이지당:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">
                    전체 {sortedTransactions.length}개 중 {startIndex + 1}-{Math.min(endIndex, sortedTransactions.length)}개 표시
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 수정 히스토리 다이얼로그 */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>수정 히스토리</DialogTitle>
            <DialogDescription>
              거래의 수정 내역을 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {transactionHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">수정 히스토리가 없습니다.</div>
            ) : (
              <div className="space-y-4">
                {transactionHistory.map((history) => (
                  <Card key={history.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            {history.change_type === 'created' ? '생성' : 
                             history.change_type === 'updated' ? '수정' : '삭제'}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {new Date(history.modified_at).toLocaleString('ko-KR')}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {history.modified_by_name || '—'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {history.change_type === 'updated' && history.old_values && history.new_values && (
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="font-semibold text-red-600 mb-2">변경 전</div>
                              <div className="space-y-1">
                                <div>날짜: {new Date(history.old_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                                <div>유형: {(() => {
                                  const isBankDeposit = history.old_values.description?.includes('은행 Deposit') || history.old_values.description === '은행 Deposit'
                                  return isBankDeposit ? '은행 Deposit' : (history.old_values.transaction_type === 'deposit' ? '입금' : '출금')
                                })()}</div>
                                <div>금액: ${Number(history.old_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                <div>결제처: {history.old_values.paid_to || '-'}</div>
                                <div>설명: {history.old_values.description || '-'}</div>
                                <div>카테고리: {history.old_values.category || '-'}</div>
                                <div>메모: {history.old_values.notes || '-'}</div>
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-green-600 mb-2">변경 후</div>
                              <div className="space-y-1">
                                <div>날짜: {new Date(history.new_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                                <div>유형: {(() => {
                                  const isBankDeposit = history.new_values.description?.includes('은행 Deposit') || history.new_values.description === '은행 Deposit'
                                  return isBankDeposit ? '은행 Deposit' : (history.new_values.transaction_type === 'deposit' ? '입금' : '출금')
                                })()}</div>
                                <div>금액: ${Number(history.new_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                <div>결제처: {history.new_values.paid_to || '-'}</div>
                                <div>설명: {history.new_values.description || '-'}</div>
                                <div>카테고리: {history.new_values.category || '-'}</div>
                                <div>메모: {history.new_values.notes || '-'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {history.change_type === 'created' && history.new_values && (
                        <div className="text-sm space-y-1">
                          <div>날짜: {new Date(history.new_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                          <div>유형: {(() => {
                            const isBankDeposit = history.new_values.description?.includes('은행 Deposit') || history.new_values.description === '은행 Deposit'
                            return isBankDeposit ? '은행 Deposit' : (history.new_values.transaction_type === 'deposit' ? '입금' : '출금')
                          })()}</div>
                          <div>금액: ${Number(history.new_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div>결제처: {history.new_values.paid_to || '-'}</div>
                          <div>설명: {history.new_values.description || '-'}</div>
                        </div>
                      )}
                      {history.change_type === 'deleted' && history.old_values && (
                        <div className="text-sm space-y-1 text-red-600">
                          <div>날짜: {new Date(history.old_values.transaction_date).toLocaleDateString('ko-KR')}</div>
                          <div>유형: {(() => {
                            const isBankDeposit = history.old_values.description?.includes('은행 Deposit') || history.old_values.description === '은행 Deposit'
                            return isBankDeposit ? '은행 Deposit' : (history.old_values.transaction_type === 'deposit' ? '입금' : '출금')
                          })()}</div>
                          <div>금액: ${Number(history.old_values.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div>결제처: {history.old_values.paid_to || '-'}</div>
                          <div>설명: {history.old_values.description || '-'}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Record 수정 모달 */}
      <Dialog open={showPaymentRecordModal} onOpenChange={setShowPaymentRecordModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 결제 수정</DialogTitle>
            <DialogDescription>
              예약 결제 기록을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editingPaymentRecord && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.currentTarget)
                const oldValues = {
                  amount: editingPaymentRecord.amount,
                  payment_method: editingPaymentRecord.payment_method,
                  note: editingPaymentRecord.note,
                  submit_on: editingPaymentRecord.submit_on,
                  payment_status: editingPaymentRecord.payment_status
                }

                const { error } = await supabase
                  .from('payment_records')
                  .update({
                    amount: parseFloat(formData.get('amount') as string),
                    note: formData.get('note') as string || null,
                    submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                    payment_status: formData.get('payment_status') as string || 'pending',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', editingPaymentRecord.id)

                if (error) throw error

                const newValues = {
                  amount: parseFloat(formData.get('amount') as string),
                  payment_method: editingPaymentRecord.payment_method,
                  note: formData.get('note') as string || null,
                  submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                  payment_status: formData.get('payment_status') as string || 'pending'
                }

                // 히스토리 저장
                await saveHistory(editingPaymentRecord.id, 'payment_records', 'updated', oldValues, newValues)

                toast.success('예약 결제가 수정되었습니다.')
                setShowPaymentRecordModal(false)
                setEditingPaymentRecord(null)
                loadTransactions()
              } catch (error) {
                console.error('예약 결제 수정 오류:', error)
                toast.error('예약 결제를 수정하는 중 오류가 발생했습니다.')
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pr_amount">금액 *</Label>
                  <Input
                    id="pr_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingPaymentRecord.amount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr_submit_on">제출일시 *</Label>
                  <Input
                    id="pr_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={new Date(editingPaymentRecord.submit_on).toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pr_payment_status">결제 상태</Label>
                <input
                  type="hidden"
                  name="payment_status"
                  id="pr_payment_status_hidden"
                  defaultValue={editingPaymentRecord.payment_status || 'pending'}
                />
                <Select
                  defaultValue={editingPaymentRecord.payment_status || 'pending'}
                  onValueChange={(value) => {
                    const hiddenInput = document.getElementById('pr_payment_status_hidden') as HTMLInputElement
                    if (hiddenInput) hiddenInput.value = value
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">대기</SelectItem>
                    <SelectItem value="confirmed">확인됨</SelectItem>
                    <SelectItem value="rejected">거부됨</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pr_note">메모</Label>
                <Textarea
                  id="pr_note"
                  name="note"
                  defaultValue={editingPaymentRecord.note || ''}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPaymentRecordModal(false)
                    setEditingPaymentRecord(null)
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Company Expense 수정 모달 */}
      <Dialog open={showCompanyExpenseModal} onOpenChange={setShowCompanyExpenseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>회사 지출 수정</DialogTitle>
            <DialogDescription>
              회사 지출 기록을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editingCompanyExpense && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.currentTarget)
                const oldValues = {
                  amount: editingCompanyExpense.amount,
                  paid_to: editingCompanyExpense.paid_to,
                  paid_for: editingCompanyExpense.paid_for,
                  description: editingCompanyExpense.description,
                  notes: editingCompanyExpense.notes,
                  submit_on: editingCompanyExpense.submit_on
                }

                const { error } = await supabase
                  .from('company_expenses')
                  .update({
                    amount: parseFloat(formData.get('amount') as string),
                    paid_to: formData.get('paid_to') as string,
                    paid_for: formData.get('paid_for') as string,
                    description: formData.get('description') as string || null,
                    notes: formData.get('notes') as string || null,
                    submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                    updated_at: new Date().toISOString(),
                    updated_by: user?.email || null
                  })
                  .eq('id', editingCompanyExpense.id)

                if (error) throw error

                const newValues = {
                  amount: parseFloat(formData.get('amount') as string),
                  paid_to: formData.get('paid_to') as string,
                  paid_for: formData.get('paid_for') as string,
                  description: formData.get('description') as string || null,
                  notes: formData.get('notes') as string || null,
                  submit_on: new Date(formData.get('submit_on') as string).toISOString()
                }

                // 히스토리 저장
                await saveHistory(editingCompanyExpense.id, 'company_expenses', 'updated', oldValues, newValues)

                toast.success('회사 지출이 수정되었습니다.')
                setShowCompanyExpenseModal(false)
                setEditingCompanyExpense(null)
                loadTransactions()
              } catch (error) {
                console.error('회사 지출 수정 오류:', error)
                toast.error('회사 지출을 수정하는 중 오류가 발생했습니다.')
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ce_amount">금액 *</Label>
                  <Input
                    id="ce_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingCompanyExpense.amount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ce_submit_on">제출일시 *</Label>
                  <Input
                    id="ce_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={new Date(editingCompanyExpense.submit_on).toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ce_paid_to">결제처 *</Label>
                  <Input
                    id="ce_paid_to"
                    name="paid_to"
                    defaultValue={editingCompanyExpense.paid_to}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ce_paid_for">결제내용 *</Label>
                  <Input
                    id="ce_paid_for"
                    name="paid_for"
                    defaultValue={editingCompanyExpense.paid_for}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ce_description">상세 설명</Label>
                <Input
                  id="ce_description"
                  name="description"
                  defaultValue={editingCompanyExpense.description || ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ce_notes">메모</Label>
                <Textarea
                  id="ce_notes"
                  name="notes"
                  defaultValue={editingCompanyExpense.notes || ''}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCompanyExpenseModal(false)
                    setEditingCompanyExpense(null)
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Reservation Expense (예약 지출) 수정 모달 */}
      <Dialog open={showReservationExpenseModal} onOpenChange={setShowReservationExpenseModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예약 지출 수정</DialogTitle>
            <DialogDescription>
              예약 지출(현금) 기록을 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editingReservationExpense && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              try {
                const amountRaw = formData.get('amount') as string
                const amountParsed = parseFloat(amountRaw)
                if (amountRaw === '' || !Number.isFinite(amountParsed)) {
                  toast.error('금액을 확인하세요.')
                  return
                }
                const oldValues = {
                  amount: editingReservationExpense.amount,
                  submit_on: editingReservationExpense.submit_on,
                  note: editingReservationExpense.note,
                  paid_for: editingReservationExpense.paid_for,
                  paid_to: editingReservationExpense.paid_to
                }
                const newValues = {
                  amount: amountParsed,
                  submit_on: new Date(formData.get('submit_on') as string).toISOString(),
                  note: (formData.get('note') as string) || null,
                  paid_for: (formData.get('paid_for') as string) || null,
                  paid_to: (formData.get('paid_to') as string) || null
                }
                const { error } = await supabase
                  .from('reservation_expenses')
                  .update({
                    amount: newValues.amount,
                    submit_on: newValues.submit_on,
                    note: newValues.note,
                    paid_for: newValues.paid_for,
                    paid_to: newValues.paid_to,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', editingReservationExpense.id)

                if (error) throw error
                await saveHistory(editingReservationExpense.id, 'reservation_expenses', 'updated', oldValues, newValues)
                toast.success('예약 지출이 수정되었습니다.')
                setShowReservationExpenseModal(false)
                setEditingReservationExpense(null)
                loadTransactions()
              } catch (error) {
                console.error('예약 지출 수정 오류:', error)
                toast.error('예약 지출을 수정하는 중 오류가 발생했습니다.')
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="re_amount">금액 *</Label>
                  <Input
                    id="re_amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={editingReservationExpense.amount}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="re_submit_on">제출일시 *</Label>
                  <Input
                    id="re_submit_on"
                    name="submit_on"
                    type="datetime-local"
                    defaultValue={editingReservationExpense.submit_on ? new Date(editingReservationExpense.submit_on).toISOString().slice(0, 16) : ''}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="re_paid_to">결제처</Label>
                  <Input
                    id="re_paid_to"
                    name="paid_to"
                    defaultValue={editingReservationExpense.paid_to || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="re_paid_for">결제내용</Label>
                  <Input
                    id="re_paid_for"
                    name="paid_for"
                    defaultValue={editingReservationExpense.paid_for || ''}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="re_note">메모</Label>
                <Textarea
                  id="re_note"
                  name="note"
                  defaultValue={editingReservationExpense.note || ''}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowReservationExpenseModal(false)
                    setEditingReservationExpense(null)
                  }}
                >
                  취소
                </Button>
                <Button type="submit">수정</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 예약 상세 모달 */}
      <Dialog open={showReservationModal} onOpenChange={setShowReservationModal}>
        <DialogContent className="max-w-[95vw] w-full p-0" style={{ height: '90vh', maxHeight: '90vh' }}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>예약 상세 정보</DialogTitle>
            <DialogDescription>
              예약 ID: {selectedReservationId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden" style={{ height: 'calc(90vh - 100px)' }}>
            {selectedReservationId && (
              <iframe
                src={`/${locale}/admin/reservations/${selectedReservationId}`}
                className="w-full h-full border-0"
                title="예약 상세 정보"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(o) => {
          setStmtReconOpen(o)
          if (!o) setStmtReconCtx(null)
        }}
        context={stmtReconCtx}
        onApplied={() => void loadTransactions()}
      />

      <CashTransactionBulkAutoMatchModal
        open={bulkAutoMatchOpen}
        onOpenChange={setBulkAutoMatchOpen}
        cashTargets={autoMatchCashTargets}
        ledgerTargets={autoMatchLedgerTargets}
        onApplied={() => void loadTransactions()}
      />
    </div>
  )
}
