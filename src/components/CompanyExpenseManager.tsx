'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { apiBearerAuthHeaders } from '@/lib/api-client-bearer'
import { fetchUploadApi } from '@/lib/uploadClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Plus,
  AlertTriangle,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Receipt,
  Wrench,
  BarChart3,
  BookOpen,
  ListOrdered,
} from 'lucide-react'
import ExpenseStatementSimilarLinesModal from '@/components/reconciliation/ExpenseStatementSimilarLinesModal'
import ExpenseVendorManagerModal from '@/components/expense/ExpenseVendorManagerModal'
import type { ExpenseVendorRecord } from '@/lib/expenseVendors'
import { isReusableExpenseVendor } from '@/lib/expenseVendors'
import { ExpenseStatementReconIcon } from '@/components/reconciliation/ExpenseStatementReconIcon'
import type { ExpenseStatementReconContext } from '@/lib/expense-reconciliation-similar-lines'
import { fetchReconciledSourceIds } from '@/lib/reconciliation-match-queries'
import { toast } from 'sonner'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import { VehicleRepairCostReportModal } from '@/components/company-expense/VehicleRepairCostReportModal'
import CompanyExpenseDuplicateCheckModal from '@/components/reconciliation/CompanyExpenseDuplicateCheckModal'
import { CompanyExpenseListDesktopTableBody } from '@/components/company-expense/CompanyExpenseListDesktopTableBody'
import { PaidForNormalizationModal } from '@/components/company-expense/PaidForNormalizationModal'
import { UnifiedStandardLeafPicker } from '@/components/company-expense/UnifiedStandardLeafPicker'
import { CompanyExpenseMaintenanceLinksSection } from '@/components/company-expense/CompanyExpenseMaintenanceLinksSection'
import { CogsVsExpensesManualDialog } from '@/components/company-expense/CogsVsExpensesManualDialog'
import { VEHICLE_MAINTENANCE_PAID_FOR_LABEL_CODE } from '@/lib/companyExpensePaidForLabels'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import {
  applyStandardLeafToCompanyExpense,
  buildUnifiedStandardLeafGroups,
  flattenUnifiedLeaves,
  matchUnifiedLeafIdFromForm,
  VEHICLE_REPAIR_STANDARD_LEAF_ID,
  type UnifiedStandardLeafGroup,
} from '@/lib/companyExpenseStandardUnified'
import {
  standardLeafDoubleCheckMessageKeys,
  standardLeafRequiresDoubleCheck,
  type StandardLeafDoubleCheckId,
} from '@/lib/companyExpenseStandardLeafDoubleCheck'
import { parseReimbursedAmount, reimbursementOutstanding } from '@/lib/expenseReimbursement'
import { cn } from '@/lib/utils'
import { compareSortValues, type SortDir } from '@/lib/clientTableSort'
import { paidForComboboxHelpWhenStandardUnset } from '@/lib/companyExpenseFormCopy'
import { collectPaidForFromStandardUnsetExpenses } from '@/lib/companyExpensePaidForSuggestions'
import { appendMultiQueryValues } from '@/lib/multiQueryParam'
import {
  companyExpenseFilterKey,
  parseCompanyExpenseFiltersFromSearchParams,
  setsFromFilterArrays,
  type CompanyExpenseFilterUrlState,
} from '@/lib/companyExpenseFilterUrl'
import {
  resolveInitialCompanyExpenseFilters,
  saveCompanyExpenseFiltersToStorage,
  searchParamsHasCompanyExpenseFilters,
  stripCompanyExpenseFilterParams,
} from '@/lib/companyExpenseFilterStorage'
import StringMultiSelectFilter from '@/components/filters/StringMultiSelectFilter'
import TableSortHeaderButton from '@/components/expenses/TableSortHeaderButton'
import ReservationExpenseTabPager, {
  RESERVATION_EXPENSE_PAGE_SIZES,
} from '@/components/expenses/ReservationExpenseTabPager'
import { lvYmdFromSubmitOnIso } from '@/lib/lasVegasCalendar'

type CompanyExpense = Database['public']['Tables']['company_expenses']['Row']
type Vehicle = Database['public']['Tables']['vehicles']['Row']
type TeamMember = Database['public']['Tables']['team']['Row']

function ymdFromLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** DB submit_on(ISO) → date input 값 (LV 달력 — API 날짜 필터와 동일) */
function ymdFromSubmitOnIso(iso: string | null | undefined): string {
  return lvYmdFromSubmitOnIso(iso)
}

/** date input(YYYY-MM-DD) → 명세·회사지출과 동일하게 정오 UTC ISO */
function submitOnIsoFromYmd(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return `${ymdFromLocalDate(new Date())}T12:00:00.000Z`
  }
  return `${ymd}T12:00:00.000Z`
}

/** DB reimbursed_on(DATE 또는 ISO) → date input */
function ymdFromReimbursedOn(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return s.slice(0, 10)
}

interface CompanyExpenseFormData {
  id: string
  /** YYYY-MM-DD — 표시·편집용 */
  submit_on: string
  paid_to: string
  paid_for: string
  description: string
  amount: string
  payment_method: string
  submit_by: string
  photo_url: string
  category: string
  subcategory: string
  vehicle_id: string
  /** 차량 선택 시 입력 — vehicles.current_mileage 및 연결 정비 기록에 반영 */
  mileage: string
  maintenance_type: string
  notes: string
  expense_type: string
  tax_deductible: boolean
  uploaded_files: File[]
  /** 표준 결제 내용 라벨 UUID (없으면 빈 문자열) */
  paid_for_label_id: string
  reimbursed_amount: string
  reimbursed_on: string
  reimbursement_note: string
}

/** GET /api/vehicle-maintenance/integration 응답 한 행 */
interface VehicleMaintenanceIntegrationRow {
  id: string
  vehicle_id: string | null
  maintenance_date: string
  maintenance_type: string
  category: string
  subcategory: string | null
  description: string
  total_cost: number
  service_provider: string | null
  status: string | null
  vehicles?: { id: string; vehicle_number?: string; vehicle_type?: string; vehicle_category?: string | null } | null
}

type CompanyExpenseManagerProps = {
  /** 지출 통합 페이지 상단 등에서 중복 점검을 열 때 사용. 전달 시 매니저 내부의 동일 버튼은 숨깁니다. */
  registerOpenLedgerDuplicateCheck?: (open: (() => void) | null) => void
}

export default function CompanyExpenseManager({
  registerOpenLedgerDuplicateCheck,
}: CompanyExpenseManagerProps = {}) {
  const t = useTranslations('companyExpense')
  const tVm = useTranslations('vehicleMaintenance')
  const tTour = useTranslations('tours.tourExpense')
  let locale = 'ko'
  try {
    locale = useLocale()
  } catch (error) {
    console.warn('로케일을 가져올 수 없습니다. 기본값(ko)을 사용합니다.', error)
  }
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const urlInit = resolveInitialCompanyExpenseFilters(searchParams)
  const urlInitSets = setsFromFilterArrays(urlInit)
  const filterStorageBootRef = useRef(false)
  const prevFilterKeyRef = useRef<string | null>(null)

  const { paymentMethodOptions, paymentMethodMap } = usePaymentMethodOptions()
  const [expenses, setExpenses] = useState<CompanyExpense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [teamMembers, setTeamMembers] = useState<Map<string, TeamMember>>(new Map())
  const [teamList, setTeamList] = useState<Array<{ email: string; name_ko: string | null; display_name: string | null; is_active: boolean }>>([])
  const [employeeEmailTab, setEmployeeEmailTab] = useState<'active' | 'inactive'>('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<CompanyExpense | null>(null)
  const [searchTerm, setSearchTerm] = useState(urlInit.searchTerm)
  const [statusFilters, setStatusFilters] = useState<Set<string>>(() => new Set(urlInitSets.statusFilters))
  const [vehicleFilters, setVehicleFilters] = useState<Set<string>>(() => new Set(urlInitSets.vehicleFilters))
  const [paidToFilters, setPaidToFilters] = useState<Set<string>>(() => new Set(urlInitSets.paidToFilters))
  /** 표준 결제내용(standard_paid_for) 텍스트 다중 선택 */
  const [standardPaidForValueFilters, setStandardPaidForValueFilters] = useState<Set<string>>(
    () => new Set(urlInitSets.standardPaidForValueFilters)
  )
  const [paymentMethodFilters, setPaymentMethodFilters] = useState<Set<string>>(
    () => new Set(urlInitSets.paymentMethodFilters)
  )
  const [submitByFilters, setSubmitByFilters] = useState<Set<string>>(() => new Set(urlInitSets.submitByFilters))
  /** 표준 결제내용(standard_paid_for) 저장 여부: all | set | unset — 값 다중 선택이 없을 때만 적용 */
  const [standardPaidForFilter, setStandardPaidForFilter] = useState<'all' | 'set' | 'unset'>(
    urlInit.standardPaidForFilter
  )
  /** 환급 목록 필터 — API `reimbursement` 쿼리와 동일 */
  const [reimbursementFilter, setReimbursementFilter] = useState<'all' | 'employee_card' | 'outstanding'>(
    urlInit.reimbursementFilter
  )
  /** 지출 등록·수정 모달: 환급 입력란 표시 여부 */
  const [reimbursementSectionOpen, setReimbursementSectionOpen] = useState(false)
  /** 명세 대조: 전체 | reconciliation_matches 미연결만 */
  const [statementMatchFilter, setStatementMatchFilter] = useState<'all' | 'unmatched'>(
    urlInit.statementMatchFilter
  )
  const [dateFrom, setDateFrom] = useState(urlInit.dateFrom)
  const [dateTo, setDateTo] = useState(urlInit.dateTo)
  const [page, setPage] = useState(urlInit.page)
  const [pageLimit, setPageLimit] = useState(urlInit.pageLimit)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [expenseSuggestions, setExpenseSuggestions] = useState<{
    paid_to: string[]
    paid_for: string[]
    /** standard_paid_for 미저장 지출에 저장된 paid_for 목록 */
    paid_for_standard_unset: string[]
    payment_method: string[]
    payment_method_filters: { value: string; count: number }[]
    standard_paid_for_filters: { value: string; count: number }[]
    standard_paid_for: string[]
    submit_by: string[]
  } | null>(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [expenseVendors, setExpenseVendors] = useState<ExpenseVendorRecord[]>([])
  const [vendorManagerOpen, setVendorManagerOpen] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  /** reconciliation_matches에 연결된 회사 지출 id */
  const [reconciledExpenseIds, setReconciledExpenseIds] = useState<Set<string>>(() => new Set())
  const [vehicleMaintenanceOpen, setVehicleMaintenanceOpen] = useState(false)
  const [vehicleMaintenanceForId, setVehicleMaintenanceForId] = useState<string | null>(null)
  const [vehicleMaintenanceRows, setVehicleMaintenanceRows] = useState<VehicleMaintenanceIntegrationRow[]>([])
  const [vehicleMaintenanceLoading, setVehicleMaintenanceLoading] = useState(false)
  const [vehicleMaintenanceError, setVehicleMaintenanceError] = useState<string | null>(null)
  const [vehicleRepairReportOpen, setVehicleRepairReportOpen] = useState(false)
  /** 목록 행: 표준 결제내용·결제방법·차량 빠른 수정 */
  const [listQuickField, setListQuickField] = useState<
    null | { type: 'standard'; expense: CompanyExpense } | { type: 'payment'; expense: CompanyExpense } | { type: 'vehicle'; expense: CompanyExpense }
  >(null)
  const [listQuickStandardLeafId, setListQuickStandardLeafId] = useState('')
  const [listQuickPaymentMethodId, setListQuickPaymentMethodId] = useState('')
  const [listQuickVehicleId, setListQuickVehicleId] = useState('')
  const [listQuickSaving, setListQuickSaving] = useState(false)
  /** 목록 표준 결제 빠른 수정: 콤보 목록이 열리면 모달을 더 높게 */
  const [listQuickStandardListOpen, setListQuickStandardListOpen] = useState(false)
  const [paidForLabels, setPaidForLabels] = useState<
    Array<{
      id: string
      code: string
      label_ko: string
      label_en: string | null
      links_vehicle_maintenance: boolean
      is_active?: boolean
    }>
  >([])
  const [paidForNormModalOpen, setPaidForNormModalOpen] = useState(false)
  const [ledgerDupModalOpen, setLedgerDupModalOpen] = useState(false)
  const tStmtRecon = useTranslations('expenses.statementRecon')
  const [stmtReconOpen, setStmtReconOpen] = useState(false)
  const [stmtReconCtx, setStmtReconCtx] = useState<ExpenseStatementReconContext | null>(null)
  const [companyTableSortKey, setCompanyTableSortKey] = useState<string>('submit_on')
  const [companyTableSortDir, setCompanyTableSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    registerOpenLedgerDuplicateCheck?.(() => setLedgerDupModalOpen(true))
    return () => registerOpenLedgerDuplicateCheck?.(null)
  }, [registerOpenLedgerDuplicateCheck])

  const [expenseStandardCategories, setExpenseStandardCategories] = useState<ExpenseStandardCategoryPickRow[]>([])
  /** 표준 결제 내용: 선택된 표준 리프(하위) id */
  const [standardHierarchyLeafId, setStandardHierarchyLeafId] = useState('')
  const [standardLeafConfirmOpen, setStandardLeafConfirmOpen] = useState(false)
  const [pendingStandardLeafConfirm, setPendingStandardLeafConfirm] =
    useState<StandardLeafDoubleCheckId | null>(null)
  const [cogsExpensesManualOpen, setCogsExpensesManualOpen] = useState(false)
  /** 목록에서 일괄 표준 카테고리 적용용 선택 id (현재 페이지·필터 결과 내) */
  const [listSelectedIds, setListSelectedIds] = useState<Set<string>>(() => new Set())
  const [listBatchLeafId, setListBatchLeafId] = useState('')
  const [listBatchApplying, setListBatchApplying] = useState(false)
  const [listBatchDeleting, setListBatchDeleting] = useState(false)
  const [listBatchDeleteConfirmOpen, setListBatchDeleteConfirmOpen] = useState(false)
  /** 표준 리프 재확인 다이얼로그: 폼 vs 목록 일괄 */
  const [standardLeafConfirmSource, setStandardLeafConfirmSource] = useState<
    'form' | 'listBatch' | 'listQuickStandard'
  >('form')

  const [formData, setFormData] = useState<CompanyExpenseFormData>({
    id: '',
    submit_on: ymdFromLocalDate(new Date()),
    paid_to: '',
    paid_for: '',
    description: '',
    amount: '',
    payment_method: '',
    submit_by: user?.email || '',
    photo_url: '',
    category: '',
    subcategory: '',
    vehicle_id: '',
    mileage: '',
    maintenance_type: '',
    notes: '',
    expense_type: '',
    tax_deductible: true,
    uploaded_files: [],
    paid_for_label_id: '',
    reimbursed_amount: '',
    reimbursed_on: '',
    reimbursement_note: ''
  })

  const isAbortError = (err: unknown) => {
    if (err instanceof Error)
      return err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('signal is aborted')
    const msg = typeof (err as { message?: string })?.message === 'string' ? (err as { message: string }).message : ''
    return msg.includes('AbortError') || msg.includes('aborted') || msg.includes('signal is aborted')
  }

  const openStmtReconForExpense = useCallback((expense: CompanyExpense) => {
    const ymd = lvYmdFromSubmitOnIso(expense.submit_on)
    if (!ymd) return
    setStmtReconCtx({
      sourceTable: 'company_expenses',
      sourceId: expense.id,
      dateYmd: ymd,
      amount: Math.abs(Number(expense.amount ?? 0)),
      direction: 'outflow'
    })
    setStmtReconOpen(true)
  }, [])

  const filterUrlState = useMemo((): CompanyExpenseFilterUrlState => {
    return {
      searchTerm,
      statusFilters: [...statusFilters],
      vehicleFilters: [...vehicleFilters],
      paidToFilters: [...paidToFilters],
      standardPaidForValueFilters: [...standardPaidForValueFilters],
      paymentMethodFilters: [...paymentMethodFilters],
      submitByFilters: [...submitByFilters],
      standardPaidForFilter,
      reimbursementFilter,
      statementMatchFilter,
      dateFrom,
      dateTo,
      page,
      pageLimit,
    }
  }, [
    searchTerm,
    statusFilters,
    vehicleFilters,
    paidToFilters,
    standardPaidForValueFilters,
    paymentMethodFilters,
    submitByFilters,
    standardPaidForFilter,
    reimbursementFilter,
    statementMatchFilter,
    dateFrom,
    dateTo,
    page,
    pageLimit,
  ])

  /** 레거시 URL 필터 → localStorage 이전 후 URL 정리(431 방지) */
  useEffect(() => {
    if (filterStorageBootRef.current) return
    filterStorageBootRef.current = true

    if (searchParamsHasCompanyExpenseFilters(searchParams)) {
      saveCompanyExpenseFiltersToStorage(parseCompanyExpenseFiltersFromSearchParams(searchParams))
    }

    const cleaned = stripCompanyExpenseFilterParams(new URLSearchParams(searchParams.toString()))
    const nextQs = cleaned.toString()
    const curQs = searchParams.toString()
    if (nextQs !== curQs) {
      router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false })
    }
  }, [pathname, router, searchParams])

  useEffect(() => {
    saveCompanyExpenseFiltersToStorage(filterUrlState)
  }, [filterUrlState])

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageLimit))
      if (searchTerm) params.append('search', searchTerm)
      appendMultiQueryValues(params, 'status', statusFilters)
      appendMultiQueryValues(params, 'vehicle_id', vehicleFilters)
      appendMultiQueryValues(params, 'paid_to', paidToFilters)
      appendMultiQueryValues(params, 'standard_paid_for', standardPaidForValueFilters)
      appendMultiQueryValues(params, 'payment_method', paymentMethodFilters)
      appendMultiQueryValues(params, 'submit_by', submitByFilters)
      if (
        standardPaidForValueFilters.size === 0 &&
        (standardPaidForFilter === 'set' || standardPaidForFilter === 'unset')
      ) {
        params.append('standard_paid_for_presence', standardPaidForFilter)
      }
      if (reimbursementFilter !== 'all') {
        params.append('reimbursement', reimbursementFilter)
      }
      if (statementMatchFilter === 'unmatched' && !searchTerm.trim()) {
        params.append('statement_match', 'unmatched')
      }
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      
      const response = await fetch(`/api/company-expenses?${params.toString()}`, {
        headers: apiBearerAuthHeaders(),
      })
      const result = await response.json()
      
      if (response.ok) {
        setExpenses(result.data || [])
        setPagination(result.pagination || { page: 1, limit: pageLimit, total: 0, totalPages: 1 })
      } else {
        toast.error(result.error || '지출 목록을 불러올 수 없습니다.')
      }
    } catch (error) {
      if (isAbortError(error)) return
      console.error('지출 목록 로드 오류:', error)
      toast.error('지출 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [
    searchTerm,
    statusFilters,
    vehicleFilters,
    paidToFilters,
    standardPaidForValueFilters,
    paymentMethodFilters,
    submitByFilters,
    standardPaidForFilter,
    reimbursementFilter,
    statementMatchFilter,
    dateFrom,
    dateTo,
    page,
    pageLimit,
  ])

  useEffect(() => {
    const ids = expenses.map((e) => e.id)
    if (ids.length === 0) {
      setReconciledExpenseIds(new Set())
      return
    }
    let cancelled = false
    void fetchReconciledSourceIds(supabase, 'company_expenses', ids).then((set) => {
      if (!cancelled) setReconciledExpenseIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [expenses])

  const loadVehicles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('vehicle_number')
      
      if (error) throw error
      setVehicles(data || [])
    } catch (error) {
      if (isAbortError(error)) return
      console.error('차량 목록 로드 오류:', error)
    }
  }, [supabase])

  const loadTeamMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, name_en, display_name, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko')
      
      if (error) {
        if (isAbortError(error)) return
        console.error('팀 멤버 조회 오류:', error)
        return
      }
      
      const list = (data || []).map((m: any) => ({
        email: m.email,
        name_ko: m.name_ko ?? null,
        display_name: m.display_name ?? null,
        is_active: m.is_active !== false
      }))
      setTeamList(list)
      
      const memberMap = new Map<string, TeamMember>()
      if (data) {
        data.forEach((member: any) => {
          if (member && member.email) {
            memberMap.set(member.email.toLowerCase(), member)
          }
        })
      }
      setTeamMembers(memberMap)
    } catch (error) {
      if (isAbortError(error)) return
      console.error('팀 멤버 목록 로드 오류:', error)
      setTeamMembers(new Map())
      setTeamList([])
    }
  }, [])

  // 필터 변경 시 1페이지로 (URL 복원·최초 마운트는 제외)
  const filterKeySansPage = useMemo(
    () =>
      companyExpenseFilterKey({
        searchTerm,
        statusFilters: [...statusFilters],
        vehicleFilters: [...vehicleFilters],
        paidToFilters: [...paidToFilters],
        standardPaidForValueFilters: [...standardPaidForValueFilters],
        paymentMethodFilters: [...paymentMethodFilters],
        submitByFilters: [...submitByFilters],
        standardPaidForFilter,
        reimbursementFilter,
        statementMatchFilter,
        dateFrom,
        dateTo,
      }),
    [
      searchTerm,
      statusFilters,
      vehicleFilters,
      paidToFilters,
      standardPaidForValueFilters,
      paymentMethodFilters,
      submitByFilters,
      standardPaidForFilter,
      reimbursementFilter,
      statementMatchFilter,
      dateFrom,
      dateTo,
    ]
  )

  useEffect(() => {
    if (prevFilterKeyRef.current === null) {
      prevFilterKeyRef.current = filterKeySansPage
      return
    }
    if (prevFilterKeyRef.current !== filterKeySansPage) {
      prevFilterKeyRef.current = filterKeySansPage
      setPage(1)
    }
  }, [filterKeySansPage])

  const loadExpenseStandardCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expense_standard_categories')
        .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
        .or('is_active.is.null,is_active.eq.true')
        .order('display_order', { ascending: true })
      if (error) {
        setExpenseStandardCategories([])
        return
      }
      setExpenseStandardCategories((data as ExpenseStandardCategoryPickRow[]) || [])
    } catch {
      setExpenseStandardCategories([])
    }
  }, [])

  const loadPaidForLabels = useCallback(async () => {
    try {
      const res = await fetch('/api/company-expenses/paid-for-labels?includeInactive=1', {
        headers: apiBearerAuthHeaders(),
      })
      const json = await res.json()
      if (res.ok && Array.isArray(json.data)) {
        setPaidForLabels(json.data)
      } else {
        setPaidForLabels([])
      }
    } catch {
      setPaidForLabels([])
    }
  }, [])

  useEffect(() => {
    void loadPaidForLabels()
  }, [loadPaidForLabels])

  useEffect(() => {
    void loadExpenseStandardCategories()
  }, [loadExpenseStandardCategories])

  const loadExpenseVendors = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('expense_vendors').select('id, name, usage_type').order('name')
      if (error) throw error
      setExpenseVendors(
        ((data ?? []) as Array<{ id: string; name: string; usage_type?: string | null }>).map((row) => ({
          id: row.id,
          name: row.name,
          usage_type: row.usage_type === 'one_time' ? 'one_time' : 'reusable',
        }))
      )
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('결제처 목록 로드 오류:', error)
      }
    }
  }, [])

  useEffect(() => {
    loadExpenses()
    loadVehicles()
    loadTeamMembers()
    void loadExpenseVendors()
  }, [loadExpenses, loadVehicles, loadTeamMembers, loadExpenseVendors])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setSuggestionsLoading(true)
      try {
        const res = await fetch('/api/company-expenses/suggestions', {
          headers: apiBearerAuthHeaders(),
        })
        const json = await res.json()
        if (cancelled) return
        if (res.ok && json && typeof json === 'object' && !Array.isArray(json)) {
          const asStr = (v: unknown) =>
            Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string') : []
          const parseCountRows = (raw: unknown) =>
            Array.isArray(raw)
              ? raw
                  .filter(
                    (r: unknown): r is { value: string; count: number } =>
                      !!r &&
                      typeof r === 'object' &&
                      typeof (r as { value?: unknown }).value === 'string' &&
                      typeof (r as { count?: unknown }).count === 'number'
                  )
                  .map((r: { value: string; count: number }) => ({
                    value: r.value.trim(),
                    count: r.count,
                  }))
              : []
          setExpenseSuggestions({
            paid_to: asStr(json.paid_to),
            paid_for: asStr(json.paid_for),
            paid_for_standard_unset: asStr(json.paid_for_standard_unset),
            payment_method: asStr(json.payment_method),
            payment_method_filters: parseCountRows(json.payment_method_filters),
            standard_paid_for_filters: parseCountRows(json.standard_paid_for_filters),
            standard_paid_for: asStr(json.standard_paid_for),
            submit_by: asStr(json.submit_by),
          })
        } else {
          setExpenseSuggestions({
            paid_to: [],
            paid_for: [],
            paid_for_standard_unset: [],
            payment_method: [],
            payment_method_filters: [],
            standard_paid_for_filters: [],
            standard_paid_for: [],
            submit_by: [],
          })
          if (!res.ok) toast.error(t('messages.suggestionsLoadError'))
        }
      } catch {
        if (!cancelled) {
          setExpenseSuggestions({
            paid_to: [],
            paid_for: [],
            paid_for_standard_unset: [],
            payment_method: [],
            payment_method_filters: [],
            standard_paid_for_filters: [],
            standard_paid_for: [],
            submit_by: [],
          })
          toast.error(t('messages.suggestionsLoadError'))
        }
      } finally {
        if (!cancelled) setSuggestionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  const reusablePaidToOptions = useMemo(() => {
    const s = new Set<string>()
    expenseVendors.filter(isReusableExpenseVendor).forEach((v) => {
      if (v.name) s.add(v.name)
    })
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [expenseVendors])

  /** 직접 입력 시 datalist 힌트 (재사용 + 현재 값) */
  const paidToDatalistOptions = useMemo(() => {
    const s = new Set(reusablePaidToOptions)
    const cur = formData.paid_to.trim()
    if (cur) s.add(cur)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [reusablePaidToOptions, formData.paid_to])

  const unifiedStandardGroups: UnifiedStandardLeafGroup[] = useMemo(
    () =>
      buildUnifiedStandardLeafGroups(expenseStandardCategories, locale, {
        includeInactive: true,
      }),
    [expenseStandardCategories, locale]
  )

  const unifiedFlatLeaves = useMemo(() => flattenUnifiedLeaves(unifiedStandardGroups), [unifiedStandardGroups])

  const listPageIds = useMemo(() => expenses.map((e) => e.id), [expenses])
  const listAllPageSelected =
    listPageIds.length > 0 && listPageIds.every((id) => listSelectedIds.has(id))
  const listSomePageSelected = listPageIds.some((id) => listSelectedIds.has(id))

  useEffect(() => {
    const allowed = new Set(expenses.map((e) => e.id))
    setListSelectedIds((prev) => {
      let removed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (allowed.has(id)) next.add(id)
        else removed = true
      }
      if (!removed && next.size === prev.size) return prev
      return next
    })
  }, [expenses])

  const applyStandardHierarchyLeaf = useCallback(
    (leafId: string) => {
      const byId = new Map(expenseStandardCategories.map((c) => [c.id, c]))
      const applied = applyStandardLeafToCompanyExpense(leafId, byId, { paidForLanguage: 'en' })
      if (!applied) return
      setStandardHierarchyLeafId(leafId)
      setFormData((prev) => ({
        ...prev,
        paid_for: applied.paid_for,
        category: applied.category,
        expense_type: applied.expense_type,
        tax_deductible: applied.tax_deductible,
        paid_for_label_id: '',
      }))
    },
    [expenseStandardCategories]
  )

  const handleUnifiedStandardLeafPick = useCallback(
    (leafId: string | null) => {
      if (!leafId) {
        setStandardHierarchyLeafId('')
        setFormData((prev) => ({
          ...prev,
          paid_for: '',
          category: '',
          expense_type: '',
          paid_for_label_id: '',
        }))
        return
      }
      if (standardLeafRequiresDoubleCheck(leafId)) {
        setStandardLeafConfirmSource('form')
        setPendingStandardLeafConfirm(leafId)
        setStandardLeafConfirmOpen(true)
        return
      }
      applyStandardHierarchyLeaf(leafId)
    },
    [applyStandardHierarchyLeaf]
  )

  const handleListBatchStandardPick = useCallback((leafId: string | null) => {
    setListBatchLeafId(leafId ?? '')
  }, [])

  const toggleListExpenseSelect = useCallback((id: string, selected: boolean) => {
    setListSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleListSelectAllPage = useCallback(() => {
    setListSelectedIds((prev) => {
      const ids = expenses.map((e) => e.id)
      const allOn = ids.length > 0 && ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allOn) {
        ids.forEach((id) => next.delete(id))
      } else {
        ids.forEach((id) => next.add(id))
      }
      return next
    })
  }, [expenses])

  const executeListBatchStandardApply = useCallback(
    async (standardLeafId: string) => {
      const expenseIds = [...listSelectedIds]
      if (expenseIds.length === 0) return
      setListBatchApplying(true)
      try {
        const res = await fetch('/api/company-expenses/batch-apply-standard-leaf', {
          method: 'POST',
          headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ expenseIds, standardLeafId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error(typeof json.error === 'string' ? json.error : t('listBatchStandard.applyError'))
          return
        }
        const updated = typeof json.updatedCount === 'number' ? json.updatedCount : 0
        const requested = typeof json.requestedCount === 'number' ? json.requestedCount : expenseIds.length
        if (updated < requested) {
          toast.message(t('listBatchStandard.applyPartial', { updated, requested }))
        } else {
          toast.success(t('listBatchStandard.applySuccess', { count: updated }))
        }
        setListSelectedIds(new Set())
        await loadExpenses()
      } catch {
        toast.error(t('listBatchStandard.applyError'))
      } finally {
        setListBatchApplying(false)
      }
    },
    [listSelectedIds, loadExpenses, t]
  )

  const submitListBatchStandardApply = useCallback(() => {
    if (listSelectedIds.size === 0) {
      toast.error(t('listBatchStandard.noSelectionToast'))
      return
    }
    if (!listBatchLeafId.trim()) {
      toast.error(t('listBatchStandard.noStandardLeafToast'))
      return
    }
    if (standardLeafRequiresDoubleCheck(listBatchLeafId)) {
      setStandardLeafConfirmSource('listBatch')
      setPendingStandardLeafConfirm(listBatchLeafId)
      setStandardLeafConfirmOpen(true)
      return
    }
    void executeListBatchStandardApply(listBatchLeafId)
  }, [listBatchLeafId, listSelectedIds, executeListBatchStandardApply, t])

  const executeListBatchDelete = useCallback(async () => {
    const expenseIds = [...listSelectedIds]
    if (expenseIds.length === 0) return
    setListBatchDeleting(true)
    try {
      const res = await fetch('/api/company-expenses/batch-delete', {
        method: 'POST',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseIds }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof json.error === 'string' ? json.error : t('listBatchDelete.deleteError'))
        return
      }
      const deleted = typeof json.deletedCount === 'number' ? json.deletedCount : 0
      const requested = typeof json.requestedCount === 'number' ? json.requestedCount : expenseIds.length
      if (deleted < requested) {
        toast.message(t('listBatchDelete.deletePartial', { deleted, requested }))
      } else {
        toast.success(t('listBatchDelete.deleteSuccess', { count: deleted }))
      }
      setListSelectedIds(new Set())
      setListBatchDeleteConfirmOpen(false)
      await loadExpenses()
    } catch {
      toast.error(t('listBatchDelete.deleteError'))
    } finally {
      setListBatchDeleting(false)
    }
  }, [listSelectedIds, loadExpenses, t])

  const openListBatchDeleteConfirm = useCallback(() => {
    if (listSelectedIds.size === 0) {
      toast.error(t('listBatchDelete.noSelectionToast'))
      return
    }
    setListBatchDeleteConfirmOpen(true)
  }, [listSelectedIds.size, t])

  useEffect(() => {
    if (!isDialogOpen || unifiedStandardGroups.length === 0) return
    if (standardHierarchyLeafId) return
    const m = matchUnifiedLeafIdFromForm(
      formData.paid_for,
      formData.category,
      formData.expense_type,
      expenseStandardCategories,
      locale
    )
    if (m === '__custom__') return
    const g = unifiedStandardGroups.find((gr) => gr.items.some((i) => i.id === m))
    if (!g) return
    setStandardHierarchyLeafId(m)
  }, [
    isDialogOpen,
    unifiedStandardGroups,
    expenseStandardCategories,
    locale,
    formData.paid_for,
    formData.category,
    formData.expense_type,
    standardHierarchyLeafId,
  ])

  /** 표준 결제 내용 피커가 «선택 안 함»(미저장)일 때 결제 내용 datalist 소스 전환 */
  const isStandardPaidForUnsetInForm = !standardHierarchyLeafId.trim()

  const paidForDatalistOptions = useMemo(() => {
    const s = new Set<string>()
    if (isStandardPaidForUnsetInForm) {
      collectPaidForFromStandardUnsetExpenses(expenseSuggestions, expenses).forEach((x) => s.add(x))
    } else {
      expenseSuggestions?.paid_for?.forEach((x) => {
        if (x) s.add(x)
      })
      unifiedFlatLeaves.forEach((o) => {
        if (o.paidForText) s.add(o.paidForText)
      })
    }
    const cur = formData.paid_for.trim()
    if (cur) s.add(cur)
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [
    expenseSuggestions,
    expenses,
    formData.paid_for,
    isStandardPaidForUnsetInForm,
    unifiedFlatLeaves,
  ])

  const multiSelectedCountLabel = useCallback(
    (count: number) => t('filters.multiSelectedCount', { count }),
    [t]
  )

  const paidToFilterOptions = useMemo(() => {
    const s = new Set<string>()
    expenseSuggestions?.paid_to?.forEach((x) => {
      const t0 = x.trim()
      if (t0) s.add(t0)
    })
    paidToFilters.forEach((v) => s.add(v))
    return Array.from(s)
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map((value) => ({ value, label: value }))
  }, [expenseSuggestions, paidToFilters])

  const standardPaidForValueFilterOptions = useMemo(() => {
    const byValue = new Map<string, number>()
    for (const row of expenseSuggestions?.standard_paid_for_filters ?? []) {
      if (row.value) byValue.set(row.value, row.count)
    }
    expenseSuggestions?.standard_paid_for?.forEach((x) => {
      const t0 = x.trim()
      if (t0 && !byValue.has(t0)) byValue.set(t0, 0)
    })
    standardPaidForValueFilters.forEach((v) => {
      if (v && !byValue.has(v)) byValue.set(v, 0)
    })
    return Array.from(byValue.entries())
      .map(([value, count]) => ({
        value,
        label:
          count > 0
            ? t('filters.standardPaidForWithCount', { label: value, count })
            : value,
        searchText: value,
      }))
      .sort((a, b) => {
        const ca = byValue.get(a.value) ?? 0
        const cb = byValue.get(b.value) ?? 0
        return cb - ca || a.label.localeCompare(b.label, 'ko')
      })
  }, [expenseSuggestions, standardPaidForValueFilters, t])

  const paymentMethodFilterOptions = useMemo(() => {
    const byValue = new Map<string, number>()
    for (const row of expenseSuggestions?.payment_method_filters ?? []) {
      if (row.value) byValue.set(row.value, row.count)
    }
    for (const id of paymentMethodFilters) {
      if (id && !byValue.has(id)) byValue.set(id, 0)
    }
    return Array.from(byValue.entries())
      .map(([value, count]) => {
        const baseLabel = paymentMethodMap[value] || value
        return {
          value,
          label: t('filters.paymentMethodWithCount', { label: baseLabel, count }),
          searchText: baseLabel,
        }
      })
      .sort((a, b) => {
        const ca = byValue.get(a.value) ?? 0
        const cb = byValue.get(b.value) ?? 0
        return cb - ca || a.label.localeCompare(b.label, 'ko')
      })
  }, [expenseSuggestions, paymentMethodFilters, paymentMethodMap, t])

  const submitByFilterOptions = useMemo(() => {
    const map = new Map<string, string>()
    teamList.forEach((m) => {
      const email = m.email.trim()
      if (!email) return
      map.set(email, m.name_ko || m.display_name || email)
    })
    expenseSuggestions?.submit_by?.forEach((email) => {
      const e = email.trim()
      if (!e) return
      if (!map.has(e)) {
        map.set(e, teamMembers.get(e.toLowerCase())?.name_ko || e)
      }
    })
    submitByFilters.forEach((email) => {
      if (!map.has(email)) map.set(email, teamMembers.get(email.toLowerCase())?.name_ko || email)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'ko'))
      .map(([value, label]) => ({ value, label, searchText: value }))
  }, [teamList, teamMembers, expenseSuggestions, submitByFilters])

  const applyStandardPaidForPresence = useCallback((presence: 'all' | 'set' | 'unset') => {
    setStandardPaidForFilter(presence)
    if (presence !== 'all') setStandardPaidForValueFilters(new Set())
  }, [])

  const openStandardUnifyWorkflow = useCallback(() => {
    applyStandardPaidForPresence('unset')
    setPaidForNormModalOpen(true)
  }, [applyStandardPaidForPresence])

  // 파일 업로드 핸들러
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setFormData(prev => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, ...files]
    }))
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      toast.error('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
      toast.success(`${validFiles.length}개 파일이 추가되었습니다.`)
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
      toast.success(`${files.length}개 파일이 붙여넣기되었습니다.`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // ID는 자동 생성되므로 검증에서 제외 (paid_for는 선택)
    if (!formData.paid_to || !formData.amount || !formData.payment_method?.trim()) {
      toast.error('필수 필드를 모두 입력해주세요.')
      return
    }

    const amtNum = parseFloat(formData.amount)
    const reimbNum = reimbursementSectionOpen ? parseReimbursedAmount(formData.reimbursed_amount) : 0
    if (!Number.isFinite(reimbNum)) {
      toast.error(tTour('reimbursementInvalidNonNegative'))
      return
    }
    if (Number.isFinite(amtNum) && amtNum > 0 && reimbNum > amtNum + 0.001) {
      toast.error(tTour('reimbursementExceedsAmount'))
      return
    }

    try {
      setSaving(true)

      const paidToTrim = formData.paid_to.trim()
      if (
        paidToTrim &&
        showCustomPaidTo &&
        !expenseVendors.some((v) => v.name.toLowerCase() === paidToTrim.toLowerCase())
      ) {
        try {
          await supabase.from('expense_vendors').insert({ name: paidToTrim, usage_type: 'one_time' })
          await loadExpenseVendors()
        } catch (vendorErr) {
          console.warn('결제처 목록 자동 추가 실패:', vendorErr)
        }
      }
      
       // 파일 업로드 처리
       let uploadedFileUrls: string[] = []
       if (formData.uploaded_files.length > 0) {
         setIsUploading(true)
         try {
           const uploadFormData = new FormData()
           uploadFormData.append('bucketType', 'company_expenses')
           formData.uploaded_files.forEach(file => {
             uploadFormData.append('files', file)
           })
           
           const uploadResponse = await fetchUploadApi(uploadFormData)
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json()
            uploadedFileUrls = uploadResult.urls
            toast.success(`${uploadedFileUrls.length}개 파일이 업로드되었습니다.`)
          } else {
            console.error('파일 업로드 실패')
            toast.error('파일 업로드에 실패했습니다.')
          }
        } finally {
          setIsUploading(false)
        }
      }
      
      // 지출 데이터 준비 (수정 시 새 파일이 없으면 기존 첨부 유지 — 빈 배열로 덮어쓰지 않음)
      const attachmentsPayload =
        uploadedFileUrls.length > 0
          ? [
              ...(Array.isArray(editingExpense?.attachments)
                ? editingExpense.attachments.filter(Boolean)
                : []),
              ...uploadedFileUrls,
            ]
          : editingExpense
            ? Array.isArray(editingExpense.attachments)
              ? editingExpense.attachments
              : null
            : null

      const stdLeaf = standardHierarchyLeafId.trim()
      const stdApplied = stdLeaf
        ? applyStandardLeafToCompanyExpense(
            stdLeaf,
            new Map(expenseStandardCategories.map((c) => [c.id, c])),
            { paidForLanguage: 'ko' }
          )
        : null

      const submitData = {
        ...formData,
        paid_for: (formData.paid_for ?? '').trim(),
        standard_paid_for: stdApplied?.paid_for ?? null,
        submit_on: submitOnIsoFromYmd(formData.submit_on),
        photo_url: formData.photo_url || uploadedFileUrls[0] || '', // 첫 번째 파일을 메인 이미지로
        attachments: attachmentsPayload,
        uploaded_files: undefined, // 서버로 전송하지 않음
        paid_for_label_id: formData.paid_for_label_id?.trim() || null,
        reimbursed_amount:
          reimbursementSectionOpen && Number.isFinite(amtNum) && amtNum > 0 ? reimbNum : 0,
        reimbursed_on:
          reimbursementSectionOpen &&
          Number.isFinite(amtNum) &&
          amtNum > 0 &&
          formData.reimbursed_on.trim()
            ? formData.reimbursed_on.trim().slice(0, 10)
            : null,
        reimbursement_note:
          reimbursementSectionOpen &&
          Number.isFinite(amtNum) &&
          amtNum > 0 &&
          formData.reimbursement_note.trim()
            ? formData.reimbursement_note.trim()
            : null,
      }
      
      const url = editingExpense ? `/api/company-expenses/${editingExpense.id}` : '/api/company-expenses'
      const method = editingExpense ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          ...apiBearerAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(editingExpense ? t('messages.expenseUpdated') : t('messages.expenseAdded'))
        setIsDialogOpen(false)
        setEditingExpense(null)
        resetForm()
        loadExpenses()
      } else {
        toast.error(result.error || '지출 저장 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('지출 저장 오류:', error)
      toast.error('지출 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (expense: CompanyExpense) => {
    setEditingExpense(expense)
    const amountStr = expense.amount != null ? String(expense.amount) : ''
    setFormData({
      id: expense.id ?? '',
      submit_on: ymdFromSubmitOnIso(
        (expense as { submit_on?: string | null }).submit_on ?? null
      ),
      paid_to: expense.paid_to ?? '',
      paid_for: expense.paid_for ?? '',
      description: expense.description ?? '',
      amount: amountStr,
      payment_method: expense.payment_method ?? '',
      submit_by: expense.submit_by ?? '',
      photo_url: expense.photo_url ?? '',
      category: expense.category ?? '',
      subcategory: expense.subcategory ?? '',
      vehicle_id: expense.vehicle_id ?? '',
      mileage: vehicleMileagePrefill(expense.vehicle_id ?? ''),
      maintenance_type: expense.maintenance_type ?? '',
      notes: expense.notes ?? '',
      expense_type: expense.expense_type ?? '',
      tax_deductible: expense.tax_deductible ?? true,
      uploaded_files: [], // 기존 데이터에는 없으므로 빈 배열
      paid_for_label_id: expense.paid_for_label_id ? String(expense.paid_for_label_id) : '',
      reimbursed_amount: expense.reimbursed_amount != null ? String(expense.reimbursed_amount) : '',
      reimbursed_on: ymdFromReimbursedOn(expense.reimbursed_on),
      reimbursement_note: expense.reimbursement_note ?? ''
    })
    setReimbursementSectionOpen(
      parseReimbursedAmount(expense.reimbursed_amount) > 0.009 ||
        Boolean(String(expense.reimbursed_on ?? '').trim()) ||
        Boolean(String(expense.reimbursement_note ?? '').trim())
    )
    const groups = buildUnifiedStandardLeafGroups(expenseStandardCategories, locale, { includeInactive: true })
    setStandardHierarchyLeafId('')
    if (groups.length > 0) {
      const matchPaidFor =
        (expense.standard_paid_for ?? '').trim() || (expense.paid_for ?? '').trim()
      const m = matchUnifiedLeafIdFromForm(
        matchPaidFor,
        expense.category ?? '',
        expense.expense_type ?? '',
        expenseStandardCategories,
        locale
      )
      if (m !== '__custom__') {
        const g = groups.find((gr) => gr.items.some((i) => i.id === m))
        if (g) setStandardHierarchyLeafId(m)
      }
    }
    setShowCustomPaidTo(
      Boolean((expense.paid_to ?? '').trim()) &&
        !reusablePaidToOptions.includes(expense.paid_to ?? '')
    )
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/company-expenses/${id}`, {
        method: 'DELETE',
        headers: apiBearerAuthHeaders(),
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(t('messages.expenseDeleted'))
        loadExpenses()
      } else {
        toast.error(result.error || '지출 삭제 중 오류가 발생했습니다.')
      }
    } catch (error) {
      console.error('지출 삭제 오류:', error)
      toast.error('지출 삭제 중 오류가 발생했습니다.')
    }
  }

  const updatePaidToEmployeeEmail = async (expenseId: string, email: string | null) => {
    try {
      const { error } = await fromUntypedTable(supabase, 'company_expenses')
        .update({ paid_to_employee_email: email || null, updated_at: new Date().toISOString() })
        .eq('id', expenseId)
      if (error) throw error
      setExpenses(prev =>
        prev.map((e) => (e.id === expenseId ? { ...e, paid_to_employee_email: email || null } as CompanyExpense : e))
      )
      toast.success('직원(이메일)이 저장되었습니다.')
    } catch (err) {
      if (isAbortError(err)) return
      console.error('직원 이메일 수정 오류:', err)
      toast.error('직원(이메일) 저장에 실패했습니다.')
    }
  }

  const resetForm = () => {
    setFormData({
      id: '',
      submit_on: ymdFromLocalDate(new Date()),
      paid_to: '',
      paid_for: '',
      description: '',
      amount: '',
      payment_method: '',
      submit_by: user?.email || '',
      photo_url: '',
      category: '',
      subcategory: '',
      vehicle_id: '',
      mileage: '',
      maintenance_type: '',
      notes: '',
      expense_type: '',
      tax_deductible: true,
      uploaded_files: [],
      paid_for_label_id: '',
      reimbursed_amount: '',
      reimbursed_on: '',
      reimbursement_note: ''
    })
    setReimbursementSectionOpen(false)
    setStandardHierarchyLeafId('')
    setStandardLeafConfirmOpen(false)
    setPendingStandardLeafConfirm(null)
    setShowCustomPaidTo(false)
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) {
      status = 'pending'
    }
    
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
      paid: { color: 'bg-blue-100 text-blue-800', icon: DollarSign }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon
    
    return (
      <Badge className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const categories = [
    { value: 'office', label: t('categories.office') },
    { value: 'marketing', label: t('categories.marketing') },
    { value: 'utilities', label: t('categories.utilities') },
    { value: 'vehicle', label: t('categories.vehicle') },
    { value: 'travel', label: t('categories.travel') },
    { value: 'meals', label: t('categories.meals') },
    { value: 'equipment', label: t('categories.equipment') },
    { value: 'maintenance', label: t('categories.maintenance') },
    { value: 'other', label: t('categories.other') },
    { value: '인건비', label: t('categories.laborCost') }
  ]

  const categoryKeys = new Set(categories.map((c) => c.value))
  const statusFilterOptions = [
    { value: 'pending', label: tTour('filterPending') },
    { value: 'approved', label: tTour('filterApproved') },
    { value: 'rejected', label: tTour('filterRejected') },
    { value: 'paid', label: t('status.paid') },
  ]
  const vehicleFilterOptions = vehicles.map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} (${vehicle.vehicle_category || 'N/A'})`,
  }))
  const getCategoryLabel = (category: string) => {
    if (category === '인건비') return t('categories.laborCost')
    return categoryKeys.has(category) ? t(`categories.${category}`) : category
  }

  const expenseTypes = [
    { value: 'operating', label: t('expenseTypes.operating') },
    { value: 'capital', label: t('expenseTypes.capital') },
    { value: 'marketing', label: t('expenseTypes.marketing') },
    { value: 'travel', label: t('expenseTypes.travel') },
    { value: 'maintenance', label: t('expenseTypes.maintenance') },
    { value: 'other', label: t('expenseTypes.other') }
  ]

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const parseExpenseAmount = (e: CompanyExpense) => parseFloat(String(e.amount ?? 0)) || 0

  const totalAmount = useMemo(
    () => expenses.reduce((sum, e) => sum + parseExpenseAmount(e), 0),
    [expenses]
  )
  const pendingAmount = useMemo(
    () =>
      expenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + parseExpenseAmount(e), 0),
    [expenses]
  )
  const approvedAmount = useMemo(
    () =>
      expenses.filter((e) => e.status === 'approved').reduce((sum, e) => sum + parseExpenseAmount(e), 0),
    [expenses]
  )
  const reimbursedPageTotal = useMemo(
    () => expenses.reduce((sum, e) => sum + parseReimbursedAmount(e.reimbursed_amount), 0),
    [expenses]
  )
  const outstandingPageTotal = useMemo(
    () =>
      expenses.reduce((sum, e) => {
        const a = parseExpenseAmount(e)
        if (a <= 0) return sum
        return sum + reimbursementOutstanding(a, e.reimbursed_amount)
      }, 0),
    [expenses]
  )

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilters(new Set())
    setVehicleFilters(new Set())
    setPaidToFilters(new Set())
    setStandardPaidForValueFilters(new Set())
    setPaymentMethodFilters(new Set())
    setSubmitByFilters(new Set())
    setStandardPaidForFilter('unset')
    setReimbursementFilter('all')
    setStatementMatchFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
    setPageLimit(20)
  }

  const isSubmitYearFilterActive = useCallback(
    (year: number) => dateFrom === `${year}-01-01` && dateTo === `${year}-12-31`,
    [dateFrom, dateTo]
  )

  const applySubmitYearFilter = useCallback((year: number) => {
    setDateFrom(`${year}-01-01`)
    setDateTo(`${year}-12-31`)
  }, [])

  const getVehicleLineLabel = (vehicleId: string) => {
    const v = vehicles.find((x) => x.id === vehicleId)
    if (!v) return vehicleId
    const nick = (v as Vehicle & { nick?: string | null }).nick?.trim()
    return nick || v.vehicle_number || v.vehicle_type || 'Unknown'
  }

  const hasUsableVehicleId = (id: string | null | undefined) => Boolean(id && id !== 'none')

  const vehicleMileagePrefill = (vehicleId: string) => {
    if (!hasUsableVehicleId(vehicleId)) return ''
    const v = vehicles.find((x) => x.id === vehicleId)
    return v?.current_mileage != null && v.current_mileage > 0 ? String(v.current_mileage) : ''
  }

  const handleVehicleIdChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      vehicle_id: value,
      mileage: hasUsableVehicleId(value) ? vehicleMileagePrefill(value) : '',
    }))
  }

  const handleCompanyTableSort = useCallback(
    (key: string) => {
      if (companyTableSortKey === key) {
        setCompanyTableSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setCompanyTableSortKey(key)
        setCompanyTableSortDir('asc')
      }
    },
    [companyTableSortKey]
  )

  const sortedExpenses = useMemo(() => {
    const rows = [...expenses]
    const loc = locale === 'en' ? 'en' : 'ko'
    rows.sort((a, b) => {
      let va: unknown
      let vb: unknown
      switch (companyTableSortKey) {
        case 'submit_on':
          va = a.submit_on || ''
          vb = b.submit_on || ''
          break
        case 'paid_to':
          va = a.paid_to
          vb = b.paid_to
          break
        case 'paid_for':
          va = a.paid_for
          vb = b.paid_for
          break
        case 'standard_paid_for':
          va = a.standard_paid_for
          vb = b.standard_paid_for
          break
        case 'description':
          va = a.description
          vb = b.description
          break
        case 'amount':
          va = parseExpenseAmount(a)
          vb = parseExpenseAmount(b)
          break
        case 'reimbursed':
          va = parseReimbursedAmount(a.reimbursed_amount)
          vb = parseReimbursedAmount(b.reimbursed_amount)
          break
        case 'outstanding':
          va = reimbursementOutstanding(parseExpenseAmount(a), a.reimbursed_amount)
          vb = reimbursementOutstanding(parseExpenseAmount(b), b.reimbursed_amount)
          break
        case 'payment_method':
          va = paymentMethodMap[a.payment_method || ''] || a.payment_method
          vb = paymentMethodMap[b.payment_method || ''] || b.payment_method
          break
        case 'category':
          va = a.category ? getCategoryLabel(a.category) : ''
          vb = b.category ? getCategoryLabel(b.category) : ''
          break
        case 'vehicle':
          va = hasUsableVehicleId(a.vehicle_id) ? getVehicleLineLabel(a.vehicle_id!) : ''
          vb = hasUsableVehicleId(b.vehicle_id) ? getVehicleLineLabel(b.vehicle_id!) : ''
          break
        case 'status':
          va = a.status
          vb = b.status
          break
        case 'employee': {
          const ae = (a as { paid_to_employee_email?: string | null }).paid_to_employee_email
          const be = (b as { paid_to_employee_email?: string | null }).paid_to_employee_email
          va = ae || ''
          vb = be || ''
          break
        }
        case 'submit_by': {
          const la = !a.submit_by
            ? ''
            : teamMembers.get(a.submit_by.toLowerCase())?.name_ko || a.submit_by
          const lb = !b.submit_by
            ? ''
            : teamMembers.get(b.submit_by.toLowerCase())?.name_ko || b.submit_by
          va = la
          vb = lb
          break
        }
        default:
          va = a.submit_on || ''
          vb = b.submit_on || ''
      }
      return compareSortValues(va, vb, companyTableSortDir, loc)
    })
    return rows
  }, [
    expenses,
    companyTableSortKey,
    companyTableSortDir,
    locale,
    paymentMethodMap,
    getCategoryLabel,
    getVehicleLineLabel,
    teamMembers,
  ])

  const selectedPaidForLabel = useMemo(
    () => paidForLabels.find((l) => l.id === formData.paid_for_label_id),
    [paidForLabels, formData.paid_for_label_id]
  )

  const openVehicleMaintenanceHistory = (vehicleId: string) => {
    setVehicleMaintenanceForId(vehicleId)
    setVehicleMaintenanceOpen(true)
    setVehicleMaintenanceError(null)
    setVehicleMaintenanceRows([])
    setVehicleMaintenanceLoading(true)
    void (async () => {
      try {
        const res = await fetch(
          `/api/vehicle-maintenance/integration?vehicle_id=${encodeURIComponent(vehicleId)}`,
          { headers: apiBearerAuthHeaders() }
        )
        const json: { data?: VehicleMaintenanceIntegrationRow[]; error?: string } = await res.json()
        if (!res.ok) {
          setVehicleMaintenanceError(
            typeof json.error === 'string' ? json.error : t('vehicleMaintenanceHistory.loadError')
          )
          setVehicleMaintenanceRows([])
          return
        }
        setVehicleMaintenanceRows(json.data ?? [])
      } catch {
        setVehicleMaintenanceError(t('vehicleMaintenanceHistory.loadError'))
        setVehicleMaintenanceRows([])
      } finally {
        setVehicleMaintenanceLoading(false)
      }
    })()
  }

  const putExpenseFromListRow = useCallback(
    async (
      expense: CompanyExpense,
      overrides: Partial<{
        standard_paid_for: string | null
        category: string | null
        expense_type: string | null
        tax_deductible: boolean
        payment_method: string
        vehicle_id: string | null
      }>
    ) => {
      const payment_method = (overrides.payment_method ?? expense.payment_method ?? '').toString().trim()
      if (!payment_method) {
        toast.error(t('listQuickEdit.paymentRequired'))
        return false
      }
      let vehicle_id: string | null
      if (overrides.vehicle_id !== undefined) {
        vehicle_id =
          overrides.vehicle_id === 'none' || !overrides.vehicle_id || overrides.vehicle_id === ''
            ? null
            : overrides.vehicle_id
      } else {
        vehicle_id =
          expense.vehicle_id && String(expense.vehicle_id) !== 'none' ? String(expense.vehicle_id) : null
      }
      const submitOn =
        expense.submit_on && String(expense.submit_on).trim() !== ''
          ? String(expense.submit_on)
          : submitOnIsoFromYmd(ymdFromSubmitOnIso(expense.submit_on))
      const body = {
        paid_to: (expense.paid_to ?? '').trim(),
        paid_for: (expense.paid_for ?? '').trim(),
        description: expense.description ?? null,
        amount: expense.amount != null ? Number(expense.amount) : 0,
        payment_method,
        submit_by: (expense.submit_by ?? '').trim() || user?.email || '',
        submit_on: submitOn,
        photo_url: expense.photo_url ?? null,
        category: overrides.category !== undefined ? overrides.category : expense.category ?? null,
        subcategory: expense.subcategory ?? null,
        vehicle_id,
        maintenance_type: expense.maintenance_type ?? null,
        notes: expense.notes ?? null,
        attachments: expense.attachments ?? null,
        expense_type: overrides.expense_type !== undefined ? overrides.expense_type : expense.expense_type ?? null,
        tax_deductible:
          overrides.tax_deductible !== undefined ? overrides.tax_deductible : expense.tax_deductible !== false,
        status: expense.status || 'pending',
        paid_for_label_id: expense.paid_for_label_id ? String(expense.paid_for_label_id) : null,
        standard_paid_for:
          overrides.standard_paid_for !== undefined
            ? overrides.standard_paid_for
            : (expense.standard_paid_for ?? null),
        reimbursed_amount:
          expense.reimbursed_amount != null ? Number(expense.reimbursed_amount) : 0,
        reimbursed_on: expense.reimbursed_on ?? null,
        reimbursement_note: expense.reimbursement_note ?? null,
      }
      const res = await fetch(`/api/company-expenses/${encodeURIComponent(expense.id)}`, {
        method: 'PUT',
        headers: { ...apiBearerAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { data?: CompanyExpense; error?: string }
      if (!res.ok) {
        toast.error(json.error || t('listQuickEdit.saveError'))
        return false
      }
      if (json.data) {
        setExpenses((prev) => prev.map((e) => (e.id === expense.id ? (json.data as CompanyExpense) : e)))
      }
      toast.success(t('messages.expenseUpdated'))
      return true
    },
    [t, user?.email]
  )

  const openListQuickStandard = useCallback(
    (expense: CompanyExpense) => {
      const pf = (expense.standard_paid_for ?? '').trim() || (expense.paid_for ?? '').trim()
      const m = matchUnifiedLeafIdFromForm(
        pf,
        (expense.category ?? '').trim(),
        (expense.expense_type ?? '').trim(),
        expenseStandardCategories,
        locale
      )
      setListQuickStandardLeafId(m !== '__custom__' && m ? m : '')
      setListQuickField({ type: 'standard', expense })
    },
    [expenseStandardCategories, locale]
  )

  const openListQuickPayment = useCallback((expense: CompanyExpense) => {
    setListQuickPaymentMethodId((expense.payment_method ?? '').trim())
    setListQuickField({ type: 'payment', expense })
  }, [])

  const openListQuickVehicle = useCallback((expense: CompanyExpense) => {
    setListQuickVehicleId(
      expense.vehicle_id && String(expense.vehicle_id) !== 'none' ? String(expense.vehicle_id) : 'none'
    )
    setListQuickField({ type: 'vehicle', expense })
  }, [])

  const saveListQuickStandardWithLeaf = useCallback(
    async (leafId: string) => {
      const q = listQuickField
      if (!q || q.type !== 'standard') return
      const byId = new Map(expenseStandardCategories.map((c) => [c.id, c]))
      const applied = applyStandardLeafToCompanyExpense(leafId, byId, { paidForLanguage: 'en' })
      if (!applied) {
        toast.error(t('listQuickEdit.saveError'))
        return
      }
      setListQuickSaving(true)
      try {
        const ok = await putExpenseFromListRow(q.expense, {
          standard_paid_for: applied.paid_for,
          category: applied.category,
          expense_type: applied.expense_type,
          tax_deductible: applied.tax_deductible,
        })
        if (ok) {
          setListQuickField(null)
          setListQuickStandardLeafId('')
        }
      } finally {
        setListQuickSaving(false)
      }
    },
    [listQuickField, expenseStandardCategories, putExpenseFromListRow, t]
  )

  const submitListQuickStandardModal = useCallback(() => {
    const q = listQuickField
    if (!q || q.type !== 'standard') return
    if (!listQuickStandardLeafId.trim()) {
      void (async () => {
        setListQuickSaving(true)
        try {
          const ok = await putExpenseFromListRow(q.expense, { standard_paid_for: null })
          if (ok) {
            setListQuickField(null)
            setListQuickStandardLeafId('')
          }
        } finally {
          setListQuickSaving(false)
        }
      })()
      return
    }
    if (standardLeafRequiresDoubleCheck(listQuickStandardLeafId)) {
      setStandardLeafConfirmSource('listQuickStandard')
      setPendingStandardLeafConfirm(listQuickStandardLeafId)
      setStandardLeafConfirmOpen(true)
      return
    }
    void saveListQuickStandardWithLeaf(listQuickStandardLeafId)
  }, [
    listQuickField,
    listQuickStandardLeafId,
    putExpenseFromListRow,
    saveListQuickStandardWithLeaf,
  ])

  const submitListQuickPaymentModal = useCallback(async () => {
    const q = listQuickField
    if (!q || q.type !== 'payment') return
    setListQuickSaving(true)
    try {
      const ok = await putExpenseFromListRow(q.expense, { payment_method: listQuickPaymentMethodId.trim() })
      if (ok) setListQuickField(null)
    } finally {
      setListQuickSaving(false)
    }
  }, [listQuickField, listQuickPaymentMethodId, putExpenseFromListRow])

  const submitListQuickVehicleModal = useCallback(async () => {
    const q = listQuickField
    if (!q || q.type !== 'vehicle') return
    setListQuickSaving(true)
    try {
      const vid = listQuickVehicleId === 'none' || !listQuickVehicleId ? null : listQuickVehicleId
      const ok = await putExpenseFromListRow(q.expense, { vehicle_id: vid })
      if (ok) setListQuickField(null)
    } finally {
      setListQuickSaving(false)
    }
  }, [listQuickField, listQuickVehicleId, putExpenseFromListRow])

  const renderEmployeeEmailCell = (expense: CompanyExpense) => (
    <TableCell className="min-w-0 px-1.5 py-1 align-middle" onClick={(e) => e.stopPropagation()}>
      {(() => {
        const currentEmail = (expense as { paid_to_employee_email?: string | null }).paid_to_employee_email || null
        const filtered = employeeEmailTab === 'active' ? teamList.filter((m) => m.is_active) : teamList.filter((m) => !m.is_active)
        const currentInFiltered = currentEmail ? filtered.find((m) => m.email === currentEmail) : null
        const currentMember = currentEmail ? teamList.find((m) => m.email === currentEmail) : null
        const options = currentInFiltered ? filtered : (currentMember ? [currentMember, ...filtered] : filtered)
        return (
          <Select
            value={currentEmail || '__none__'}
            onValueChange={(value) => updatePaidToEmployeeEmail(expense.id, value === '__none__' ? null : value)}
          >
            <SelectTrigger className="h-7 max-w-full min-w-0 text-[11px] px-1.5 [&>span]:truncate">
              <SelectValue placeholder="미지정" />
            </SelectTrigger>
            <SelectContent>
              <div
                className="flex rounded border border-gray-200 p-0.5 bg-gray-100 mb-2 sticky top-0 z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setEmployeeEmailTab('active')
                  }}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    employeeEmailTab === 'active' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setEmployeeEmailTab('inactive')
                  }}
                  className={`flex-1 px-2 py-1 text-xs rounded ${
                    employeeEmailTab === 'inactive' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Inactive
                </button>
              </div>
              <SelectItem value="__none__">미지정</SelectItem>
              {options.map((m) => (
                <SelectItem key={m.email} value={m.email}>
                  {(m.display_name || m.name_ko) || m.email}
                  {!m.is_active ? ' (Inactive)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })()}
    </TableCell>
  )

  const formatVmMaintenanceType = useCallback(
    (type: string) => {
      const v = (type || '').trim()
      if (!v) return '—'
      const known = new Set(['maintenance', 'repair', 'service', 'inspection', 'emergency'])
      return known.has(v) ? tVm(`maintenanceTypes.${v}` as never) : v
    },
    [tVm]
  )

  const formatVmStatus = useCallback(
    (status: string | null | undefined) => {
      const v = (status || 'completed').trim()
      const known = new Set(['scheduled', 'in_progress', 'completed', 'cancelled'])
      return known.has(v) ? tVm(`status.${v}` as never) : v
    },
    [tVm]
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-gray-50 rounded-lg p-2 sm:p-3 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-stretch">
          <div className="flex flex-1 gap-2 min-w-0">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder={t('filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 text-sm py-1.5 sm:py-2 px-3 sm:px-4 border-gray-300 flex items-center gap-1.5"
              onClick={() => setVendorManagerOpen(true)}
            >
              <ListOrdered className="w-4 h-4" />
              <span className="hidden sm:inline">결제처 정리</span>
              <span className="sm:hidden">결제처</span>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto shrink-0 text-sm py-1.5 sm:py-2 px-3 sm:px-4 border-gray-300 flex items-center justify-center gap-1.5 sm:gap-2"
            onClick={() => setVehicleRepairReportOpen(true)}
          >
            <BarChart3 className="w-4 h-4 text-blue-700" />
            {t('vehicleRepairReport.openButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto shrink-0 text-sm py-1.5 sm:py-2 px-3 sm:px-4 border-gray-300"
            onClick={() => setPaidForNormModalOpen(true)}
          >
            {t('paidForNormalization.openButton')}
          </Button>
          {!registerOpenLedgerDuplicateCheck ? (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto shrink-0 text-sm py-1.5 sm:py-2 px-3 sm:px-4 border-amber-200 text-amber-950 flex items-center justify-center gap-1.5 sm:gap-2"
              onClick={() => setLedgerDupModalOpen(true)}
              title="회사·투어·예약·입장권(확정) 지출 전체를 한데 비교합니다. 출처가 달라도 금액·등록일이 비슷하면 한 그룹으로 묶습니다."
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              회사·투어·예약·입장권 지출 중복 점검
            </Button>
          ) : null}
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                setReimbursementSectionOpen(false)
                setStandardHierarchyLeafId('')
                setStandardLeafConfirmOpen(false)
                setPendingStandardLeafConfirm(null)
                setShowCustomPaidTo(false)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  resetForm()
                  setEditingExpense(null)
                }}
                className="w-full sm:w-auto shrink-0 text-sm py-1.5 sm:py-2 px-3 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2"
              >
                <Plus className="w-4 h-4" />
                {t('addExpense')}
              </Button>
            </DialogTrigger>
          
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? t('buttons.edit') : t('addExpense')}
              </DialogTitle>
              <DialogDescription>
                {editingExpense ? '지출 정보를 수정하세요.' : '새로운 지출을 등록하세요.'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="submit_on">{t('form.date')} *</Label>
                  <Input
                    id="submit_on"
                    type="date"
                    value={formData.submit_on}
                    onChange={(e) => setFormData({ ...formData, submit_on: e.target.value })}
                    required
                    className="block w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="amount">{t('form.amount')} *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                
                {editingExpense && (
                  <div className="sm:col-span-2">
                    <Label htmlFor="id">{t('form.id')}</Label>
                    <Input
                      id="id"
                      value={formData.id}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                )}
              </div>

              {parseFloat(formData.amount || '0') > 0 && (
                <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-3 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="co_reimbursement_toggle"
                      checked={reimbursementSectionOpen}
                      onCheckedChange={(checked) => {
                        const on = checked === true
                        setReimbursementSectionOpen(on)
                        if (!on) {
                          setFormData((prev) => ({
                            ...prev,
                            reimbursed_amount: '',
                            reimbursed_on: '',
                            reimbursement_note: '',
                          }))
                        }
                      }}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label htmlFor="co_reimbursement_toggle" className="text-sm font-medium text-amber-950 cursor-pointer">
                        {tTour('reimbursementToggleLabel')}
                      </Label>
                    </div>
                  </div>
                  {reimbursementSectionOpen && (
                    <>
                      <p className="text-xs font-medium text-amber-900">{tTour('reimbursementSectionTitle')}</p>
                      <p className="text-[11px] text-amber-800/90">{tTour('reimbursementSectionHint')}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="co_reimbursed_amount" className="text-xs">
                            {tTour('reimbursedAmount')}
                          </Label>
                          <Input
                            id="co_reimbursed_amount"
                            type="number"
                            min={0}
                            step="0.01"
                            value={formData.reimbursed_amount}
                            onChange={(e) => setFormData((prev) => ({ ...prev, reimbursed_amount: e.target.value }))}
                            placeholder="0"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="co_reimbursed_on" className="text-xs">
                            {tTour('reimbursedOn')}
                          </Label>
                          <Input
                            id="co_reimbursed_on"
                            type="date"
                            value={formData.reimbursed_on}
                            onChange={(e) => setFormData((prev) => ({ ...prev, reimbursed_on: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="co_reimbursement_note" className="text-xs">
                          {tTour('reimbursementNote')}
                        </Label>
                        <Input
                          id="co_reimbursement_note"
                          type="text"
                          value={formData.reimbursement_note}
                          onChange={(e) => setFormData((prev) => ({ ...prev, reimbursement_note: e.target.value }))}
                          placeholder={tTour('reimbursementNotePlaceholder')}
                          className="mt-1"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {unifiedStandardGroups.length > 0 && (
                <UnifiedStandardLeafPicker
                  groups={unifiedStandardGroups}
                  value={standardHierarchyLeafId}
                  onPick={handleUnifiedStandardLeafPick}
                  parentOpen={isDialogOpen}
                  headerTrailing={
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                      title={t('form.cogsVsExpensesManualOpenTitle')}
                      aria-label={t('form.cogsVsExpensesManualOpenTitle')}
                      onClick={() => setCogsExpensesManualOpen(true)}
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                  }
                  summary={
                    standardHierarchyLeafId ? (
                      <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 px-2 py-1.5">
                        {t('form.unifiedSummaryPrefix')}
                        <span className="font-medium text-foreground">{formData.paid_for}</span>
                        {' · '}
                        {getCategoryLabel(formData.category)}
                        {' · '}
                        {expenseTypes.find((x) => x.value === formData.expense_type)?.label ??
                          formData.expense_type}
                      </p>
                    ) : undefined
                  }
                />
              )}

              <div
                className={cn(
                  'grid gap-4',
                  unifiedStandardGroups.length > 0 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                )}
              >
                <div>
                  <Label htmlFor="paid_to">{t('form.paidTo')} *</Label>
                  {!showCustomPaidTo ? (
                    <div className="space-y-2">
                      <Select
                        value={formData.paid_to || ''}
                        onValueChange={(value) => {
                          if (value === '__custom__') {
                            setFormData((prev) => ({ ...prev, paid_to: '' }))
                            setShowCustomPaidTo(true)
                            return
                          }
                          setFormData((prev) => ({ ...prev, paid_to: value }))
                        }}
                      >
                        <SelectTrigger id="paid_to">
                          <SelectValue placeholder={t('form.suggestOrType')} />
                        </SelectTrigger>
                        <SelectContent>
                          {reusablePaidToOptions.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">직접 입력…</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        id="paid_to"
                        list="company-expense-datalist-paid-to"
                        autoComplete="off"
                        value={formData.paid_to}
                        onChange={(e) => setFormData({ ...formData, paid_to: e.target.value })}
                        required
                        placeholder="결제처 직접 입력"
                      />
                      <datalist id="company-expense-datalist-paid-to">
                        {paidToDatalistOptions.map((v) => (
                          <option key={v} value={v} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => {
                          setShowCustomPaidTo(false)
                          setFormData((prev) => ({ ...prev, paid_to: '' }))
                        }}
                      >
                        목록에서 선택
                      </button>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs mt-1">
                    {suggestionsLoading ? t('form.suggestionsLoading') : '목록에서 선택하거나 직접 입력할 수 있습니다.'}
                  </p>
                </div>

                {unifiedStandardGroups.length === 0 && (
                  <div>
                    <Label htmlFor="paid_for">
                      {t('form.paidFor')}
                      <span className="text-muted-foreground font-normal"> · {t('form.paidForOptional')}</span>
                    </Label>
                    <Input
                      id="paid_for"
                      list="company-expense-datalist-paid-for"
                      autoComplete="off"
                      value={formData.paid_for}
                      onChange={(e) =>
                        setFormData({ ...formData, paid_for: e.target.value, paid_for_label_id: '' })
                      }
                      placeholder={t('form.paidForPlaceholder')}
                    />
                    <datalist id="company-expense-datalist-paid-for">
                      {paidForDatalistOptions.map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                    <p className="text-muted-foreground text-xs mt-1">
                      {suggestionsLoading
                        ? t('form.suggestionsLoading')
                        : isStandardPaidForUnsetInForm && unifiedStandardGroups.length > 0
                          ? paidForComboboxHelpWhenStandardUnset(locale)
                          : t('form.paidForComboboxHelp')}
                    </p>
                  </div>
                )}
              </div>

              {unifiedStandardGroups.length === 0 && (
                <div className="space-y-2">
                  <Label htmlFor="paid_for_label">{t('form.paidForStandardLabel')}</Label>
                  <Select
                    value={formData.paid_for_label_id || '__none__'}
                    onValueChange={(value) => {
                      if (value === '__none__') {
                        setFormData((prev) => ({ ...prev, paid_for_label_id: '' }))
                        return
                      }
                      const lab = paidForLabels.find((l) => l.id === value)
                      setFormData((prev) => ({
                        ...prev,
                        paid_for_label_id: value,
                        paid_for: lab?.label_ko ?? prev.paid_for
                      }))
                    }}
                  >
                    <SelectTrigger id="paid_for_label">
                      <SelectValue placeholder={t('form.paidForStandardPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t('form.paidForStandardNone')}</SelectItem>
                      {paidForLabels.filter((l) => l.is_active !== false).map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.label_ko}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">{t('form.paidForStandardHint')}</p>
                </div>
              )}
              
              <div>
                <Label htmlFor="description">{t('form.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {unifiedStandardGroups.length === 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">{t('form.category')}</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="expense_type">{t('form.expenseType')}</Label>
                    <Select
                      value={formData.expense_type}
                      onValueChange={(value) => setFormData({ ...formData, expense_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="지출 유형 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicle_id">{t('form.vehicleId')}</Label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
                    <Select
                      value={formData.vehicle_id}
                      onValueChange={handleVehicleIdChange}
                    >
                      <SelectTrigger className="w-full sm:flex-1">
                        <SelectValue placeholder="차량 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">차량 없음</SelectItem>
                        {vehicles.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {`${vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} (${vehicle.vehicle_category || 'N/A'})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasUsableVehicleId(formData.vehicle_id) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 sm:self-start"
                        onClick={() => openVehicleMaintenanceHistory(formData.vehicle_id)}
                      >
                        <Wrench className="w-4 h-4 sm:mr-1.5" />
                        {t('vehicleMaintenanceHistory.openButton')}
                      </Button>
                    )}
                  </div>
                  {hasUsableVehicleId(formData.vehicle_id) && (
                    <div className="mt-2">
                      <Label htmlFor="mileage">{tVm('form.mileage')}</Label>
                      <Input
                        id="mileage"
                        type="number"
                        min={0}
                        step={1}
                        value={formData.mileage}
                        onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                        placeholder={t('form.mileagePlaceholder')}
                        className="mt-1"
                      />
                      <p className="text-muted-foreground text-xs mt-1">{t('form.mileageHint')}</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="payment_method">{t('form.paymentMethod')} *</Label>
                  <PaymentMethodAutocomplete
                    options={paymentMethodOptions}
                    valueId={formData.payment_method || ''}
                    onChange={(id) => setFormData({ ...formData, payment_method: id })}
                    disabled={saving}
                    pleaseSelectLabel={t('form.selectPaymentMethodPlaceholder')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-muted-foreground text-xs mt-1">
                    {t('form.paymentMethodHint')}
                  </p>
                </div>

                {(selectedPaidForLabel?.code === VEHICLE_MAINTENANCE_PAID_FOR_LABEL_CODE ||
                  standardHierarchyLeafId === VEHICLE_REPAIR_STANDARD_LEAF_ID) &&
                  hasUsableVehicleId(formData.vehicle_id) && (
                    <div className="sm:col-span-2">
                      <CompanyExpenseMaintenanceLinksSection
                        expenseId={editingExpense?.id ?? null}
                        vehicleId={formData.vehicle_id}
                        enabled
                      />
                    </div>
                  )}
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tax_deductible"
                  checked={formData.tax_deductible}
                  onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                />
                <Label htmlFor="tax_deductible">{t('form.taxDeductible')}</Label>
              </div>
              
              {/* 파일 업로드 섹션 */}
              <div>
                <Label htmlFor="file_upload">영수증/인보이스 첨부</Label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                    isUploading 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : isDragOver 
                        ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                  }`}
                  onDragOver={!isUploading ? handleDragOver : undefined}
                  onDragEnter={!isUploading ? handleDragEnter : undefined}
                  onDragLeave={!isUploading ? handleDragLeave : undefined}
                  onDrop={!isUploading ? handleDrop : undefined}
                  onPaste={!isUploading ? handlePaste : undefined}
                  tabIndex={!isUploading ? 0 : -1}
                  onClick={!isUploading ? () => document.getElementById('file_upload')?.click() : undefined}
                >
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                      isUploading 
                        ? 'bg-blue-100' 
                        : isDragOver 
                          ? 'bg-blue-200' 
                          : 'bg-gray-100'
                    }`}>
                      {isUploading ? (
                        <div className="animate-spin">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </div>
                      ) : isDragOver ? (
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium transition-colors ${
                        isDragOver ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {isUploading 
                          ? '파일 업로드 중...' 
                          : isDragOver 
                            ? '파일을 여기에 놓으세요' 
                            : '파일을 드래그하여 놓거나 클릭하여 선택하세요'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        또는 클립보드에서 붙여넣기 (Ctrl+V)
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      지원 형식: JPG, PNG, GIF, PDF, DOC, DOCX (최대 10MB)
                    </div>
                  </div>
                  
                  <input
                    id="file_upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  
                  {/* 업로드된 파일 목록 */}
                  {formData.uploaded_files.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-medium mb-3 text-gray-900">업로드된 파일 ({formData.uploaded_files.length}개)</h4>
                      <div className="space-y-2">
                        {formData.uploaded_files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                {file.type.startsWith('image/') ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(index)
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                {editingExpense && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        type="button" 
                        variant="destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>지출 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('messages.confirmDelete')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (editingExpense) {
                              handleDelete(editingExpense.id)
                              setIsDialogOpen(false)
                              setEditingExpense(null)
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <div className="flex justify-end space-x-2 ml-auto">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t('buttons.cancel')}
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : t('buttons.save')}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
        </div>

        <div className="rounded-md border border-gray-200/90 bg-white/80 p-1.5 sm:p-2 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/70 px-2 py-1.5">
            <span className="text-[10px] font-medium text-amber-950 shrink-0">{t('filters.standardPaidFor')}</span>
            <button
              type="button"
              onClick={() => applyStandardPaidForPresence('unset')}
              aria-pressed={standardPaidForFilter === 'unset' && standardPaidForValueFilters.size === 0}
              className={`h-7 px-2 text-[11px] rounded-md border transition-colors ${
                standardPaidForFilter === 'unset' && standardPaidForValueFilters.size === 0
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {t('filters.standardPaidForUnset')}
            </button>
            <button
              type="button"
              onClick={() => applyStandardPaidForPresence('set')}
              aria-pressed={standardPaidForFilter === 'set' && standardPaidForValueFilters.size === 0}
              className={`h-7 px-2 text-[11px] rounded-md border transition-colors ${
                standardPaidForFilter === 'set' && standardPaidForValueFilters.size === 0
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {t('filters.standardPaidForSet')}
            </button>
            <button
              type="button"
              onClick={() => applyStandardPaidForPresence('all')}
              aria-pressed={standardPaidForFilter === 'all' && standardPaidForValueFilters.size === 0}
              className={`h-7 px-2 text-[11px] rounded-md border transition-colors ${
                standardPaidForFilter === 'all' && standardPaidForValueFilters.size === 0
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {t('filters.all')}
            </button>
            <div className="min-w-[9rem] flex-1 basis-[9rem] max-w-xs">
              <StringMultiSelectFilter
                compact
                id="co-filter-standard-paid-for-values"
                groupLabel={t('filters.standardPaidForPick')}
                options={standardPaidForValueFilterOptions}
                selected={standardPaidForValueFilters}
                onChange={(next) => {
                  setStandardPaidForValueFilters(next)
                  if (next.size > 0) setStandardPaidForFilter('all')
                }}
                searchable
                searchPlaceholder={t('filters.searchInList')}
                allLabel={t('filters.all')}
                clearLabel={t('filters.clear')}
                selectedCountLabel={multiSelectedCountLabel}
                emptySearchLabel={t('filters.searchEmpty')}
                disabled={suggestionsLoading}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px] border-amber-400 text-amber-950 hover:bg-amber-100"
              onClick={openStandardUnifyWorkflow}
            >
              {t('filters.standardUnifyAction')}
            </Button>
            {standardPaidForFilter === 'unset' && standardPaidForValueFilters.size === 0 ? (
              <span className="text-[10px] text-amber-900/80">
                {t('filters.standardUnsetListHint', { count: pagination.total })}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
            <StringMultiSelectFilter
              compact
              id="co-filter-status"
              groupLabel={tTour('statusLabel')}
              options={statusFilterOptions}
              selected={statusFilters}
              onChange={setStatusFilters}
              allLabel={tTour('filterAll')}
              clearLabel={t('filters.clear')}
              selectedCountLabel={multiSelectedCountLabel}
            />
            <StringMultiSelectFilter
              compact
              id="co-filter-payment-method"
              groupLabel={t('form.paymentMethod')}
              options={paymentMethodFilterOptions}
              selected={paymentMethodFilters}
              onChange={setPaymentMethodFilters}
              searchable
              searchPlaceholder={t('filters.searchInList')}
              allLabel={t('filters.all')}
              clearLabel={t('filters.clear')}
              selectedCountLabel={multiSelectedCountLabel}
              emptySearchLabel={t('filters.searchEmpty')}
            />
            <StringMultiSelectFilter
              compact
              id="co-filter-submit-by"
              groupLabel={t('filters.submitBy')}
              options={submitByFilterOptions}
              selected={submitByFilters}
              onChange={setSubmitByFilters}
              searchable
              searchPlaceholder={t('filters.searchInList')}
              allLabel={t('filters.all')}
              clearLabel={t('filters.clear')}
              selectedCountLabel={multiSelectedCountLabel}
              emptySearchLabel={t('filters.searchEmpty')}
              disabled={suggestionsLoading}
            />
            <StringMultiSelectFilter
              compact
              id="co-filter-paid-to"
              groupLabel={t('form.paidTo')}
              options={paidToFilterOptions}
              selected={paidToFilters}
              onChange={setPaidToFilters}
              searchable
              searchPlaceholder={t('filters.searchInList')}
              allLabel={t('filters.all')}
              clearLabel={t('filters.clear')}
              selectedCountLabel={multiSelectedCountLabel}
              emptySearchLabel={t('filters.searchEmpty')}
              disabled={suggestionsLoading}
            />
            <StringMultiSelectFilter
              compact
              id="co-filter-vehicle"
              groupLabel={t('filters.vehicle')}
              options={vehicleFilterOptions}
              selected={vehicleFilters}
              onChange={setVehicleFilters}
              allLabel={t('filters.all')}
              clearLabel={t('filters.clear')}
              selectedCountLabel={multiSelectedCountLabel}
            />
            <div className="min-w-0">
              <label
                className="block text-[10px] font-medium text-gray-600 mb-0 leading-tight truncate"
                htmlFor="co-filter-date-from"
              >
                {t('filters.dateFromShort')}
              </label>
              <input
                id="co-filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-7 w-full px-1.5 text-[11px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="min-w-0">
              <label
                className="block text-[10px] font-medium text-gray-600 mb-0 leading-tight truncate"
                htmlFor="co-filter-date-to"
              >
                {t('filters.dateToShort')}
              </label>
              <input
                id="co-filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-7 w-full px-1.5 text-[11px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-1.5">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-gray-500">{t('filters.submitYearPresetLabel')}</span>
              {[2025, 2026].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => applySubmitYearFilter(year)}
                  aria-pressed={isSubmitYearFilterActive(year)}
                  aria-label={t('filters.submitYearPresetAria', { year })}
                  className={`h-7 min-w-[2.5rem] px-2 text-[11px] rounded-md border transition-colors ${
                    isSubmitYearFilterActive(year)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
            <div className="min-w-[6.5rem] shrink-0">
              <label
                className="block text-[10px] font-medium text-gray-600 mb-0 leading-tight truncate"
                htmlFor="co-filter-statement-match"
              >
                {t('filters.statementMatch')}
              </label>
              <select
                id="co-filter-statement-match"
                value={statementMatchFilter}
                onChange={(e) => setStatementMatchFilter(e.target.value as 'all' | 'unmatched')}
                title={
                  statementMatchFilter === 'unmatched'
                    ? searchTerm.trim()
                      ? t('filters.statementMatchUnmatchedSearchHint')
                      : t('filters.statementMatchUnmatchedHint')
                    : undefined
                }
                className="h-7 w-full px-1.5 text-[11px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="all">{t('filters.statementMatchAll')}</option>
                <option value="unmatched">{t('filters.statementMatchUnmatched')}</option>
              </select>
            </div>
            <div className="min-w-[6.5rem] shrink-0">
              <label
                className="block text-[10px] font-medium text-gray-600 mb-0 leading-tight truncate"
                htmlFor="co-filter-reimbursement"
              >
                {tTour('reimbursementFilterLabel')}
              </label>
              <select
                id="co-filter-reimbursement"
                value={reimbursementFilter}
                onChange={(e) =>
                  setReimbursementFilter(e.target.value as 'all' | 'employee_card' | 'outstanding')
                }
                className="h-7 w-full px-1.5 text-[11px] border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
              >
                <option value="all">{tTour('reimbursementFilterAll')}</option>
                <option value="employee_card">{tTour('reimbursementFilterEmployeeCard')}</option>
                <option value="outstanding">{tTour('reimbursementFilterOutstanding')}</option>
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] shrink-0"
              onClick={resetFilters}
            >
              {t('buttons.resetFilters')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 pt-2 border-t border-gray-200/80">
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-100/80">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('totalExpenseSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-gray-900 truncate">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-2 sm:p-3 border border-yellow-100/80">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('pendingSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-yellow-600 truncate">{formatCurrency(pendingAmount)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-2 sm:p-3 border border-green-100/80">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('approvedSum')}</div>
            <div className="text-base sm:text-2xl font-bold text-green-600 truncate">{formatCurrency(approvedAmount)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 sm:p-3 border border-slate-100">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('reimbursedTotalLabel')}</div>
            <div className="text-base sm:text-2xl font-bold text-slate-800 truncate">
              {formatCurrency(reimbursedPageTotal)}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 sm:p-3 border border-amber-100 col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="text-xs sm:text-sm text-gray-600">{tTour('outstandingTotalLabel')}</div>
            <div className="text-base sm:text-2xl font-bold text-amber-800 truncate">
              {formatCurrency(outstandingPageTotal)}
            </div>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500">{t('statsPageNote')}</p>
      </div>

      {/* 지출 목록 */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <p className="text-xs sm:text-sm text-gray-600">
            {t('expenseList')}
            {pagination.total > 0
              ? ` · ${t('listCountLabel', { count: pagination.total })}${pagination.totalPages > 1 ? ` · ${page} / ${pagination.totalPages}` : ''}`
              : ''}
          </p>
        </div>
        {!loading && expenses.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200/80 bg-gray-50/50 p-2 sm:p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-medium text-gray-700">{t('listBatchStandard.toolbarTitle')}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{t('listBatchStandard.preservePaidForHint')}</p>
              {unifiedStandardGroups.length > 0 ? (
                <UnifiedStandardLeafPicker
                  groups={unifiedStandardGroups}
                  value={listBatchLeafId}
                  onPick={handleListBatchStandardPick}
                  allowClear
                  parentOpen={!isDialogOpen}
                  className="max-w-xl"
                />
              ) : (
                <p className="text-xs text-muted-foreground">{t('listBatchStandard.noStandardData')}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {t('listBatchStandard.selectedCount', { count: listSelectedIds.size })}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleListSelectAllPage}
                disabled={listPageIds.length === 0}
                className="md:hidden"
              >
                {listAllPageSelected ? t('listBatchStandard.deselectPage') : t('listBatchStandard.selectPage')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setListSelectedIds(new Set())}
                disabled={listSelectedIds.size === 0}
              >
                {t('listBatchStandard.clearSelection')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submitListBatchStandardApply}
                disabled={
                  listBatchApplying ||
                  listBatchDeleting ||
                  listSelectedIds.size === 0 ||
                  !listBatchLeafId.trim() ||
                  unifiedStandardGroups.length === 0
                }
              >
                {listBatchApplying ? t('listBatchStandard.applying') : t('listBatchStandard.apply')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={listBatchApplying || listBatchDeleting || listSelectedIds.size === 0}
                onClick={openListBatchDeleteConfirm}
              >
                <Trash2 className="h-4 w-4 mr-1.5 shrink-0" aria-hidden />
                {listBatchDeleting ? t('listBatchDelete.deleting') : t('listBatchDelete.deleteButton')}
              </Button>
              <AlertDialog open={listBatchDeleteConfirmOpen} onOpenChange={setListBatchDeleteConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('listBatchDelete.confirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('listBatchDelete.confirmDescription', { count: listSelectedIds.size })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={listBatchDeleting}>{t('listBatchDelete.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={listBatchDeleting}
                      className="bg-red-600 hover:bg-red-700"
                      onClick={(e) => {
                        e.preventDefault()
                        void executeListBatchDelete()
                      }}
                    >
                      {listBatchDeleting ? t('listBatchDelete.deleting') : t('listBatchDelete.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
          {loading ? (
            <div className="text-center py-6 sm:py-8">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="text-gray-500 mt-2 text-sm">{t('loading')}</p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm">
              <Receipt className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 text-gray-300" />
              <p>{t('noExpenses')}</p>
            </div>
          ) : (
            <>
              {/* 모바일: 카드 리스트 - 라벨/값 구조로 가독성 개선 */}
              <div className="md:hidden space-y-3">
                {sortedExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    onClick={() => handleEdit(expense)}
                    className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm cursor-pointer hover:bg-gray-50/80 active:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className="shrink-0 pt-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        <Checkbox
                          checked={listSelectedIds.has(expense.id)}
                          onCheckedChange={(c) => toggleListExpenseSelect(expense.id, c === true)}
                          aria-label={t('listBatchStandard.selectRowAria')}
                        />
                      </div>
                      <div className="font-semibold text-gray-900 text-sm flex-1 flex flex-col gap-1 min-w-0">
                        <p className="flex items-center gap-1.5 min-w-0">
                          <ExpenseStatementReconIcon
                            matched={reconciledExpenseIds.has(expense.id)}
                            titleMatched={tStmtRecon('matchedTitle')}
                            titleUnmatched={tStmtRecon('unmatchedTitle')}
                            onClick={() => openStmtReconForExpense(expense)}
                          />
                          <span className="truncate">{expense.paid_to || '—'}</span>
                        </p>
                      </div>
                      <p className="text-lg font-bold text-green-600 whitespace-nowrap">
                        ${expense.amount ? parseFloat(expense.amount.toString()).toLocaleString() : '0'}
                      </p>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                      <span className="text-gray-400">제출일</span>
                      <span>{expense.submit_on ? lvYmdFromSubmitOnIso(expense.submit_on) : '-'}</span>
                      <span className="text-gray-400">결제처</span>
                      <span className="truncate">{expense.paid_to}</span>
                      <span className="text-gray-400">{t('listStandardPaidFor.column')}</span>
                      <span className="min-w-0 text-right">
                        <button
                          type="button"
                          className="truncate max-w-full text-left text-blue-700 underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            openListQuickStandard(expense)
                          }}
                        >
                          {expense.standard_paid_for || t('listQuickEdit.tapToSetStandard')}
                        </button>
                      </span>
                      <span className="text-gray-400">{t('form.paymentMethod')}</span>
                      <span className="min-w-0 text-right">
                        <button
                          type="button"
                          className="truncate max-w-full text-left text-blue-700 underline-offset-2 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            openListQuickPayment(expense)
                          }}
                        >
                          {expense.payment_method
                            ? paymentMethodMap[expense.payment_method] || expense.payment_method
                            : t('listQuickEdit.tapToSetPayment')}
                        </button>
                      </span>
                      <span className="text-gray-400">직원(이메일)</span>
                      <span className="truncate">
                        {(() => {
                          const email = (expense as { paid_to_employee_email?: string | null }).paid_to_employee_email
                          if (!email) return '미지정'
                          const m = teamList.find((x) => x.email === email)
                          const name = (m?.display_name || m?.name_ko) || email
                          return m && !m.is_active ? `${name} (Inactive)` : name
                        })()}
                      </span>
                      <span className="text-gray-400">차량</span>
                      <div className="flex items-center justify-end gap-1 min-w-0 text-right">
                        {hasUsableVehicleId(expense.vehicle_id) ? (
                          <button
                            type="button"
                            className="truncate flex-1 min-w-0 text-left text-blue-700 underline-offset-2 hover:underline"
                            title={t('listQuickEdit.openVehicleHint')}
                            onClick={(e) => {
                              e.stopPropagation()
                              openListQuickVehicle(expense)
                            }}
                          >
                            {getVehicleLineLabel(expense.vehicle_id!)}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                        {hasUsableVehicleId(expense.vehicle_id) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              openVehicleMaintenanceHistory(expense.vehicle_id!)
                            }}
                            title={t('vehicleMaintenanceHistory.openButton')}
                          >
                            <Wrench className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <span className="text-gray-400">상태</span>
                      <span>{getStatusBadge(expense.status || 'pending')}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* 데스크톱: 열이 많아 가로 스크롤로 전체 표시 */}
              <div className="hidden md:block w-full min-w-0">
              <div className="overflow-x-auto rounded-lg border border-gray-200/80 [-webkit-overflow-scrolling:touch]">
              <Table
                wrapperClassName="overflow-visible min-w-0"
                className="min-w-[1180px] w-full border-collapse text-xs [&_th]:h-auto [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-[11px] [&_th]:leading-tight [&_th]:whitespace-nowrap [&_td]:px-2 [&_td]:py-1"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">
                      <Checkbox
                        checked={listAllPageSelected ? true : listSomePageSelected ? 'indeterminate' : false}
                        onCheckedChange={() => toggleListSelectAllPage()}
                        aria-label={t('listBatchStandard.selectAllPageAria')}
                        className="h-3.5 w-3.5"
                      />
                    </TableHead>
                    <TableHead className="text-center" title={tStmtRecon('unmatchedTitle')}>
                      {tStmtRecon('columnHeaderShort')}
                    </TableHead>
                    <TableHead className="align-bottom">
                      <TableSortHeaderButton
                        label="제출일"
                        active={companyTableSortKey === 'submit_on'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('submit_on')}
                      />
                    </TableHead>
                    <TableHead className="align-bottom">
                      <TableSortHeaderButton
                        label="결제처"
                        active={companyTableSortKey === 'paid_to'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('paid_to')}
                      />
                    </TableHead>
                    <TableHead className="min-w-[7.5rem] whitespace-normal align-bottom" title={t('listStandardPaidFor.columnHint')}>
                      <TableSortHeaderButton
                        label={t('listStandardPaidFor.column')}
                        active={companyTableSortKey === 'standard_paid_for'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('standard_paid_for')}
                      />
                    </TableHead>
                    <TableHead className="min-w-[8rem] max-w-[12rem] whitespace-normal align-bottom">
                      <TableSortHeaderButton
                        label="설명"
                        active={companyTableSortKey === 'description'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('description')}
                      />
                    </TableHead>
                    <TableHead className="text-right align-bottom">
                      <div className="flex justify-end">
                        <TableSortHeaderButton
                          label="금액"
                          active={companyTableSortKey === 'amount'}
                          dir={companyTableSortDir}
                          onClick={() => handleCompanyTableSort('amount')}
                          className="text-right"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="align-bottom">
                      <TableSortHeaderButton
                        label="결제방법"
                        active={companyTableSortKey === 'payment_method'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('payment_method')}
                      />
                    </TableHead>
                    <TableHead className="whitespace-normal align-bottom">
                      <TableSortHeaderButton
                        label={t('filters.vehicle')}
                        active={companyTableSortKey === 'vehicle'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('vehicle')}
                      />
                    </TableHead>
                    <TableHead className="text-center px-1" title={t('vehicleMaintenanceHistory.modalTitle')}>
                      {t('vehicleMaintenanceHistory.listColumnHeader')}
                    </TableHead>
                    <TableHead className="align-bottom">
                      <TableSortHeaderButton
                        label="상태"
                        active={companyTableSortKey === 'status'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('status')}
                      />
                    </TableHead>
                    <TableHead className="whitespace-normal align-bottom">
                      <TableSortHeaderButton
                        label="직원(이메일)"
                        active={companyTableSortKey === 'employee'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('employee')}
                      />
                    </TableHead>
                    <TableHead className="align-bottom">
                      <TableSortHeaderButton
                        label="제출자"
                        active={companyTableSortKey === 'submit_by'}
                        dir={companyTableSortDir}
                        onClick={() => handleCompanyTableSort('submit_by')}
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <CompanyExpenseListDesktopTableBody
                  expenses={sortedExpenses}
                  handleEdit={handleEdit}
                  reconciledExpenseIds={reconciledExpenseIds}
                  onOpenStatementRecon={openStmtReconForExpense}
                  paymentMethodMap={paymentMethodMap}
                  getStatusBadge={getStatusBadge}
                  hasUsableVehicleId={hasUsableVehicleId}
                  getVehicleLineLabel={getVehicleLineLabel}
                  openVehicleMaintenanceHistory={openVehicleMaintenanceHistory}
                  renderEmployeeEmailCell={renderEmployeeEmailCell}
                  teamMembers={teamMembers}
                  locale={locale}
                  t={t}
                  selectedExpenseIds={listSelectedIds}
                  onToggleExpenseSelect={toggleListExpenseSelect}
                  onOpenQuickStandard={openListQuickStandard}
                  onOpenQuickPayment={openListQuickPayment}
                  onOpenQuickVehicle={openListQuickVehicle}
                  formatCurrency={formatCurrency}
                />
              </Table>
              </div>
              </div>
              {pagination.total > 0 && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <ReservationExpenseTabPager
                    page={page}
                    totalPages={pagination.totalPages}
                    pageSize={pageLimit}
                    totalFiltered={pagination.total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      if (!(RESERVATION_EXPENSE_PAGE_SIZES as readonly number[]).includes(size)) return
                      setPageLimit(size)
                      setPage(1)
                    }}
                  />
                </div>
              )}
            </>
          )}
      </div>

      <Dialog
        open={vehicleMaintenanceOpen}
        onOpenChange={(open) => {
          setVehicleMaintenanceOpen(open)
          if (!open) {
            setVehicleMaintenanceForId(null)
            setVehicleMaintenanceError(null)
            setVehicleMaintenanceRows([])
          }
        }}
      >
        <DialogContent className="w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] max-h-[min(90vh,880px)] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {t('vehicleMaintenanceHistory.modalTitle')}
              {vehicleMaintenanceForId ? (
                <span className="block sm:inline sm:ml-1 text-base font-normal text-muted-foreground">
                  — {getVehicleLineLabel(vehicleMaintenanceForId)}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>{t('vehicleMaintenanceHistory.modalDescription')}</DialogDescription>
          </DialogHeader>
          {vehicleMaintenanceError && (
            <p className="text-sm text-destructive -mt-1">{vehicleMaintenanceError}</p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            {vehicleMaintenanceLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('vehicleMaintenanceHistory.loading')}
              </div>
            ) : vehicleMaintenanceRows.length > 0 ? (
              <div className="overflow-x-auto min-h-0">
                <Table
                  wrapperClassName="overflow-visible"
                  className="table-fixed w-full min-w-[40rem]"
                >
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[5.5rem] whitespace-nowrap bg-background">
                        {t('vehicleMaintenanceHistory.tableDate')}
                      </TableHead>
                      <TableHead className="w-[4.5rem] whitespace-nowrap bg-background">
                        {t('vehicleMaintenanceHistory.tableType')}
                      </TableHead>
                      <TableHead className="min-w-[10rem] w-[38%] bg-background">
                        {t('vehicleMaintenanceHistory.tableDescription')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap bg-background">
                        {t('vehicleMaintenanceHistory.tableCost')}
                      </TableHead>
                      <TableHead className="hidden md:table-cell min-w-[6rem] bg-background">
                        {t('vehicleMaintenanceHistory.tableProvider')}
                      </TableHead>
                      <TableHead className="whitespace-nowrap bg-background">
                        {t('vehicleMaintenanceHistory.tableStatus')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicleMaintenanceRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">
                          {row.maintenance_date
                            ? new Date(row.maintenance_date).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatVmMaintenanceType(row.maintenance_type)}
                        </TableCell>
                        <TableCell className="text-sm align-top">
                          <div className="line-clamp-2 break-words leading-snug" title={row.description}>
                            {row.description}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-right font-medium whitespace-nowrap">
                          {formatCurrency(Number(row.total_cost))}
                        </TableCell>
                        <TableCell
                          className="hidden md:table-cell text-sm text-muted-foreground max-w-[9rem] truncate"
                          title={row.service_provider || undefined}
                        >
                          {row.service_provider || '—'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatVmStatus(row.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : vehicleMaintenanceError ? null : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t('vehicleMaintenanceHistory.empty')}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={listQuickField != null}
        onOpenChange={(open) => {
          if (!open) {
            setListQuickField(null)
            setListQuickStandardListOpen(false)
            setListQuickStandardLeafId('')
            setListQuickPaymentMethodId('')
            setListQuickVehicleId('')
          }
        }}
      >
        <DialogContent
          className={cn(
            'max-w-lg overflow-y-auto transition-[min-height,max-height] duration-200 ease-out',
            listQuickField?.type === 'standard' && listQuickStandardListOpen
              ? 'min-h-[min(72vh,560px)] max-h-[min(94vh,860px)]'
              : 'max-h-[min(90vh,640px)]',
          )}
        >
          {listQuickField?.type === 'standard' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('listQuickEdit.standardTitle')}</DialogTitle>
                <DialogDescription>{t('listQuickEdit.standardDescription')}</DialogDescription>
              </DialogHeader>
              {unifiedStandardGroups.length > 0 ? (
                <UnifiedStandardLeafPicker
                  groups={unifiedStandardGroups}
                  value={listQuickStandardLeafId}
                  onPick={(id) => setListQuickStandardLeafId(id ?? '')}
                  allowClear
                  parentOpen={listQuickField != null}
                  placeholderWhenEmpty={t('paidForNormalization.pickerNoSelection')}
                  clearOptionLabel={t('paidForNormalization.pickerNoSelection')}
                  onListboxOpenChange={setListQuickStandardListOpen}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t('listBatchStandard.noStandardData')}</p>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setListQuickField(null)}
                  disabled={listQuickSaving}
                >
                  {t('buttons.cancel')}
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitListQuickStandardModal()}
                  disabled={listQuickSaving || unifiedStandardGroups.length === 0}
                >
                  {listQuickSaving ? t('listQuickEdit.saving') : t('buttons.save')}
                </Button>
              </DialogFooter>
            </>
          )}
          {listQuickField?.type === 'payment' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('listQuickEdit.paymentTitle')}</DialogTitle>
                <DialogDescription>{t('listQuickEdit.paymentDescription')}</DialogDescription>
              </DialogHeader>
              <PaymentMethodAutocomplete
                options={paymentMethodOptions}
                valueId={listQuickPaymentMethodId}
                onChange={setListQuickPaymentMethodId}
                disabled={listQuickSaving}
                pleaseSelectLabel={t('form.selectPaymentMethodPlaceholder')}
                className="h-10 w-full min-w-0 border border-input rounded-md bg-background px-2"
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setListQuickField(null)}
                  disabled={listQuickSaving}
                >
                  {t('buttons.cancel')}
                </Button>
                <Button type="button" onClick={() => void submitListQuickPaymentModal()} disabled={listQuickSaving}>
                  {listQuickSaving ? t('listQuickEdit.saving') : t('buttons.save')}
                </Button>
              </DialogFooter>
            </>
          )}
          {listQuickField?.type === 'vehicle' && (
            <>
              <DialogHeader>
                <DialogTitle>{t('listQuickEdit.vehicleTitle')}</DialogTitle>
                <DialogDescription>{t('listQuickEdit.vehicleDescription')}</DialogDescription>
              </DialogHeader>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                value={listQuickVehicleId}
                onChange={(e) => setListQuickVehicleId(e.target.value)}
                disabled={listQuickSaving}
              >
                <option value="none">{t('listInlineEdit.noVehicle')}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {`${vehicle.vehicle_number || vehicle.vehicle_type || 'Unknown'} (${vehicle.vehicle_category || 'N/A'})`}
                  </option>
                ))}
              </select>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setListQuickField(null)}
                  disabled={listQuickSaving}
                >
                  {t('buttons.cancel')}
                </Button>
                <Button type="button" onClick={() => void submitListQuickVehicleModal()} disabled={listQuickSaving}>
                  {listQuickSaving ? t('listQuickEdit.saving') : t('buttons.save')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CogsVsExpensesManualDialog open={cogsExpensesManualOpen} onOpenChange={setCogsExpensesManualOpen} />

      <AlertDialog
        open={standardLeafConfirmOpen}
        onOpenChange={(open) => {
          setStandardLeafConfirmOpen(open)
          if (!open) {
            setPendingStandardLeafConfirm(null)
            setStandardLeafConfirmSource('form')
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-base">
              {pendingStandardLeafConfirm
                ? t(
                    `standardLeafDoubleCheck.${standardLeafDoubleCheckMessageKeys(pendingStandardLeafConfirm).titleKey}` as 'standardLeafDoubleCheck.bentoCogsTitle'
                  )
                : t('standardLeafDoubleCheck.dialogTitle')}
            </AlertDialogTitle>
            {pendingStandardLeafConfirm ? (
              <AlertDialogDescription className="whitespace-pre-line text-left text-sm">
                {t(
                  `standardLeafDoubleCheck.${standardLeafDoubleCheckMessageKeys(pendingStandardLeafConfirm).bodyKey}` as 'standardLeafDoubleCheck.bentoCogsBody'
                )}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('standardLeafDoubleCheck.cancelButton')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const leaf = pendingStandardLeafConfirm
                const src = standardLeafConfirmSource
                if (leaf) {
                  if (src === 'listBatch') {
                    void executeListBatchStandardApply(leaf)
                  } else if (src === 'listQuickStandard') {
                    void saveListQuickStandardWithLeaf(leaf)
                  } else {
                    applyStandardHierarchyLeaf(leaf)
                  }
                }
                setStandardLeafConfirmOpen(false)
                setPendingStandardLeafConfirm(null)
                setStandardLeafConfirmSource('form')
              }}
            >
              {t('standardLeafDoubleCheck.confirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VehicleRepairCostReportModal
        open={vehicleRepairReportOpen}
        onOpenChange={setVehicleRepairReportOpen}
      />

      <PaidForNormalizationModal
        open={paidForNormModalOpen}
        onOpenChange={setPaidForNormModalOpen}
        onApplied={() => {
          void loadExpenses()
          void loadPaidForLabels()
        }}
      />

      <ExpenseStatementSimilarLinesModal
        open={stmtReconOpen}
        onOpenChange={(o) => {
          setStmtReconOpen(o)
          if (!o) setStmtReconCtx(null)
        }}
        context={stmtReconCtx}
        onApplied={() => {
          void loadExpenses()
        }}
      />

      <CompanyExpenseDuplicateCheckModal
        open={ledgerDupModalOpen}
        onOpenChange={setLedgerDupModalOpen}
        mode="ledger"
        createdByEmail={user?.email ?? null}
        onAfterLedgerMutation={() => {
          void loadExpenses()
        }}
      />

      <ExpenseVendorManagerModal
        open={vendorManagerOpen}
        onOpenChange={setVendorManagerOpen}
        onUpdated={() => {
          void loadExpenseVendors()
        }}
      />
    </div>
  )
}
