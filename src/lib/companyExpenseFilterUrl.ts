import { appendMultiQueryValues, parseMultiQueryValues } from '@/lib/multiQueryParam'

export type CompanyExpenseFilterUrlState = {
  searchTerm: string
  statusFilters: string[]
  vehicleFilters: string[]
  paidToFilters: string[]
  standardPaidForValueFilters: string[]
  paymentMethodFilters: string[]
  submitByFilters: string[]
  standardPaidForFilter: 'all' | 'set' | 'unset'
  reimbursementFilter: 'all' | 'employee_card' | 'outstanding'
  statementMatchFilter: 'all' | 'unmatched'
  dateFrom: string
  dateTo: string
  page: number
  pageLimit: number
}

/** URL에서 지우는 회사 지출 필터 키 (tab·rs 등은 유지) */
export const COMPANY_EXPENSE_FILTER_PARAM_KEYS = [
  'search',
  'category',
  'status',
  'vehicle_id',
  'paid_for',
  'paid_to',
  'standard_paid_for',
  'standard_paid_for_presence',
  'payment_method',
  'submit_by',
  'standard_leaf_id',
  'reimbursement',
  'statement_match',
  'date_from',
  'date_to',
  'page',
  'limit',
] as const

const DEFAULT_PAGE_LIMIT = 20

function parseStandardPaidForPresence(raw: string | null): 'all' | 'set' | 'unset' {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'set' || v === 'unset') return v
  return 'all'
}

function parseReimbursement(raw: string | null): CompanyExpenseFilterUrlState['reimbursementFilter'] {
  const v = (raw ?? 'all').trim().toLowerCase()
  if (v === 'employee_card' || v === 'outstanding') return v
  return 'all'
}

function parseStatementMatch(raw: string | null): 'all' | 'unmatched' {
  return (raw ?? '').trim().toLowerCase() === 'unmatched' ? 'unmatched' : 'all'
}

function hasStandardPaidForUrlParams(searchParams: URLSearchParams): boolean {
  return (
    parseMultiQueryValues(searchParams, 'standard_paid_for').length > 0 ||
    searchParams.has('standard_paid_for_presence')
  )
}

export function parseCompanyExpenseFiltersFromSearchParams(
  searchParams: URLSearchParams
): CompanyExpenseFilterUrlState {
  const pageRaw = parseInt(searchParams.get('page') || '1', 10)
  const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_LIMIT), 10)
  const hasStd = hasStandardPaidForUrlParams(searchParams)
  return {
    searchTerm: (searchParams.get('search') ?? '').trim(),
    statusFilters: parseMultiQueryValues(searchParams, 'status'),
    vehicleFilters: parseMultiQueryValues(searchParams, 'vehicle_id'),
    paidToFilters: parseMultiQueryValues(searchParams, 'paid_to'),
    standardPaidForValueFilters: parseMultiQueryValues(searchParams, 'standard_paid_for'),
    paymentMethodFilters: parseMultiQueryValues(searchParams, 'payment_method'),
    submitByFilters: parseMultiQueryValues(searchParams, 'submit_by'),
    /** URL에 표준 필터가 없으면 미저장 우선(통일화 작업) */
    standardPaidForFilter: hasStd
      ? parseStandardPaidForPresence(searchParams.get('standard_paid_for_presence'))
      : 'unset',
    reimbursementFilter: parseReimbursement(searchParams.get('reimbursement')),
    statementMatchFilter: parseStatementMatch(searchParams.get('statement_match')),
    dateFrom: (searchParams.get('date_from') ?? '').trim(),
    dateTo: (searchParams.get('date_to') ?? '').trim(),
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1,
    pageLimit:
      Number.isFinite(limitRaw) && limitRaw >= 10 && limitRaw <= 100 ? limitRaw : DEFAULT_PAGE_LIMIT,
  }
}

export function applyCompanyExpenseFiltersToSearchParams(
  base: URLSearchParams,
  state: CompanyExpenseFilterUrlState
): URLSearchParams {
  const params = new URLSearchParams(base.toString())
  for (const key of COMPANY_EXPENSE_FILTER_PARAM_KEYS) {
    params.delete(key)
  }

  if (state.searchTerm) params.set('search', state.searchTerm)
  appendMultiQueryValues(params, 'status', state.statusFilters)
  appendMultiQueryValues(params, 'vehicle_id', state.vehicleFilters)
  appendMultiQueryValues(params, 'paid_to', state.paidToFilters)
  appendMultiQueryValues(params, 'standard_paid_for', state.standardPaidForValueFilters)
  appendMultiQueryValues(params, 'payment_method', state.paymentMethodFilters)
  appendMultiQueryValues(params, 'submit_by', state.submitByFilters)

  if (
    state.standardPaidForValueFilters.length === 0 &&
    (state.standardPaidForFilter === 'set' || state.standardPaidForFilter === 'unset')
  ) {
    params.set('standard_paid_for_presence', state.standardPaidForFilter)
  }
  if (state.reimbursementFilter !== 'all') {
    params.set('reimbursement', state.reimbursementFilter)
  }
  if (state.statementMatchFilter === 'unmatched') {
    params.set('statement_match', 'unmatched')
  }
  if (state.dateFrom) params.set('date_from', state.dateFrom)
  if (state.dateTo) params.set('date_to', state.dateTo)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.pageLimit !== DEFAULT_PAGE_LIMIT) params.set('limit', String(state.pageLimit))

  return params
}

/** 필터 변경 감지용(페이지·limit 제외) */
export function companyExpenseFilterKey(state: Omit<CompanyExpenseFilterUrlState, 'page' | 'pageLimit'>): string {
  const norm = (arr: string[]) => [...arr].sort().join('\u0001')
  return JSON.stringify({
    searchTerm: state.searchTerm,
    statusFilters: norm(state.statusFilters),
    vehicleFilters: norm(state.vehicleFilters),
    paidToFilters: norm(state.paidToFilters),
    standardPaidForValueFilters: norm(state.standardPaidForValueFilters),
    paymentMethodFilters: norm(state.paymentMethodFilters),
    submitByFilters: norm(state.submitByFilters),
    standardPaidForFilter: state.standardPaidForFilter,
    reimbursementFilter: state.reimbursementFilter,
    statementMatchFilter: state.statementMatchFilter,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
  })
}

export function setsFromFilterArrays(state: CompanyExpenseFilterUrlState): {
  statusFilters: Set<string>
  vehicleFilters: Set<string>
  paidToFilters: Set<string>
  standardPaidForValueFilters: Set<string>
  paymentMethodFilters: Set<string>
  submitByFilters: Set<string>
} {
  return {
    statusFilters: new Set(state.statusFilters),
    vehicleFilters: new Set(state.vehicleFilters),
    paidToFilters: new Set(state.paidToFilters),
    standardPaidForValueFilters: new Set(state.standardPaidForValueFilters),
    paymentMethodFilters: new Set(state.paymentMethodFilters),
    submitByFilters: new Set(state.submitByFilters),
  }
}
