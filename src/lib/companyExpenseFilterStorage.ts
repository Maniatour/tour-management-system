import {
  COMPANY_EXPENSE_FILTER_PARAM_KEYS,
  parseCompanyExpenseFiltersFromSearchParams,
  type CompanyExpenseFilterUrlState,
} from '@/lib/companyExpenseFilterUrl'

const STORAGE_KEY = 'companyExpense.filters.v1'
const DEFAULT_PAGE_LIMIT = 20

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
}

function parsePresence(v: unknown): 'all' | 'set' | 'unset' {
  if (v === 'set' || v === 'unset') return v
  return 'all'
}

export function defaultCompanyExpenseFilters(): CompanyExpenseFilterUrlState {
  return {
    searchTerm: '',
    statusFilters: [],
    vehicleFilters: [],
    paidToFilters: [],
    standardPaidForValueFilters: [],
    paymentMethodFilters: [],
    submitByFilters: [],
    standardPaidForFilter: 'unset',
    reimbursementFilter: 'all',
    statementMatchFilter: 'all',
    dateFrom: '',
    dateTo: '',
    page: 1,
    pageLimit: DEFAULT_PAGE_LIMIT,
  }
}

export function loadCompanyExpenseFiltersFromStorage(): CompanyExpenseFilterUrlState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as Record<string, unknown>
    const page = Number(o.page)
    const pageLimit = Number(o.pageLimit)
    return {
      searchTerm: typeof o.searchTerm === 'string' ? o.searchTerm : '',
      statusFilters: asStringArray(o.statusFilters),
      vehicleFilters: asStringArray(o.vehicleFilters),
      paidToFilters: asStringArray(o.paidToFilters),
      standardPaidForValueFilters: asStringArray(o.standardPaidForValueFilters),
      paymentMethodFilters: asStringArray(o.paymentMethodFilters),
      submitByFilters: asStringArray(o.submitByFilters),
      standardPaidForFilter: parsePresence(o.standardPaidForFilter),
      reimbursementFilter:
        o.reimbursementFilter === 'employee_card' || o.reimbursementFilter === 'outstanding'
          ? o.reimbursementFilter
          : 'all',
      statementMatchFilter: o.statementMatchFilter === 'unmatched' ? 'unmatched' : 'all',
      dateFrom: typeof o.dateFrom === 'string' ? o.dateFrom : '',
      dateTo: typeof o.dateTo === 'string' ? o.dateTo : '',
      page: Number.isFinite(page) && page >= 1 ? page : 1,
      pageLimit:
        Number.isFinite(pageLimit) && pageLimit >= 10 && pageLimit <= 100
          ? pageLimit
          : DEFAULT_PAGE_LIMIT,
    }
  } catch {
    return null
  }
}

export function saveCompanyExpenseFiltersToStorage(state: CompanyExpenseFilterUrlState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota exceeded 등 — 조용히 무시 */
  }
}

export function searchParamsHasCompanyExpenseFilters(searchParams: URLSearchParams): boolean {
  return COMPANY_EXPENSE_FILTER_PARAM_KEYS.some((key) => searchParams.has(key))
}

/** 최초 렌더: URL(레거시) → localStorage → 기본값 */
export function resolveInitialCompanyExpenseFilters(
  searchParams: URLSearchParams
): CompanyExpenseFilterUrlState {
  const defaults = defaultCompanyExpenseFilters()
  if (searchParamsHasCompanyExpenseFilters(searchParams)) {
    return { ...defaults, ...parseCompanyExpenseFiltersFromSearchParams(searchParams) }
  }
  const stored = loadCompanyExpenseFiltersFromStorage()
  if (stored) return { ...defaults, ...stored }
  return defaults
}

/** tab·rs 등만 남기고 필터 쿼리 제거 — URL 길이(431) 방지 */
export function stripCompanyExpenseFilterParams(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString())
  for (const key of COMPANY_EXPENSE_FILTER_PARAM_KEYS) {
    params.delete(key)
  }
  return params
}
