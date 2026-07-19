import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { applyStandardLeafToCompanyExpense } from '@/lib/companyExpenseStandardUnified'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'
import { normalizeStoredMaintenanceCategory } from '@/lib/vehicleMaintenanceStandardCategory'

type CompanyExpenseInsert = Database['public']['Tables']['company_expenses']['Insert']

export type MaintenanceExpenseSource = {
  maintenance_date: string
  category: string | null | undefined
  subcategory?: string | null
  description: string
  total_cost: number
  service_provider?: string | null
  maintenance_type?: string | null
  vehicle_id: string
  mileage?: number | null
  notes?: string | null
}

function submitOnIsoFromMaintenanceDate(ymd: string): string {
  const datePart = String(ymd).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return new Date().toISOString()
  }
  return `${datePart}T12:00:00.000Z`
}

export async function fetchExpenseStandardCategoriesForMaintenance(
  supabase: SupabaseClient
): Promise<ExpenseStandardCategoryPickRow[]> {
  const { data, error } = await supabase
    .from('expense_standard_categories')
    .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
    .order('display_order', { ascending: true })

  if (error) {
    console.error('fetchExpenseStandardCategoriesForMaintenance:', error)
    return []
  }
  return (data ?? []) as ExpenseStandardCategoryPickRow[]
}

export async function resolveMaintenanceExpenseSubmitBy(
  supabase: SupabaseClient
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim()
  if (email) return email
  if (user?.id) return user.id
  return 'unknown'
}

function standardFieldsFromMaintenanceCategory(
  category: string | null | undefined,
  cats: ExpenseStandardCategoryPickRow[]
) {
  const leafId = normalizeStoredMaintenanceCategory(category)
  const byId = new Map(cats.map((c) => [c.id, c]))
  return applyStandardLeafToCompanyExpense(leafId, byId, { paidForLanguage: 'ko' })
}

/** 정비 기록 → 회사 지출 insert 필드 (결제 내용·표준 결제 내용·카테고리) */
export function buildCompanyExpenseInsertFromMaintenance(
  maintenance: MaintenanceExpenseSource,
  cats: ExpenseStandardCategoryPickRow[],
  options: {
    id: string
    payment_method?: string | null
    submit_by: string
    autoNotes: string
    operator_id?: string
  }
): CompanyExpenseInsert {
  const applied = standardFieldsFromMaintenanceCategory(maintenance.category, cats)
  const paidTo = (maintenance.service_provider ?? '').trim()
  const desc = maintenance.description.trim()

  return {
    id: options.id,
    paid_to: paidTo || null,
    paid_for: desc || applied?.paid_for || null,
    standard_paid_for: applied?.paid_for ?? null,
    description: desc || null,
    amount: maintenance.total_cost,
    payment_method: options.payment_method ?? null,
    submit_by: options.submit_by,
    submit_on: submitOnIsoFromMaintenanceDate(maintenance.maintenance_date),
    category: applied?.category ?? 'vehicle',
    subcategory: maintenance.subcategory ?? null,
    vehicle_id: maintenance.vehicle_id,
    maintenance_type: maintenance.maintenance_type ?? null,
    notes: options.autoNotes,
    expense_type: applied?.expense_type ?? 'maintenance',
    tax_deductible: applied?.tax_deductible ?? true,
    status: 'pending',
    ...(options.operator_id ? { operator_id: options.operator_id } : {}),
  }
}

/** 정비 수정 → 연동 회사 지출 update 필드 */
export function buildCompanyExpenseUpdateFromMaintenance(
  maintenance: Partial<MaintenanceExpenseSource>,
  cats: ExpenseStandardCategoryPickRow[],
  options?: { payment_method?: string | null; includePaymentMethod?: boolean }
): Record<string, unknown> {
  const update: Record<string, unknown> = {}

  if (maintenance.total_cost != null) update.amount = maintenance.total_cost

  if (maintenance.service_provider !== undefined) {
    const paidTo = (maintenance.service_provider ?? '').trim()
    update.paid_to = paidTo || null
  }

  if (maintenance.description !== undefined) {
    const desc = maintenance.description.trim()
    update.paid_for = desc || null
    update.description = desc || null
  }

  if (maintenance.category !== undefined) {
    const applied = standardFieldsFromMaintenanceCategory(maintenance.category, cats)
    if (applied) {
      update.standard_paid_for = applied.paid_for
      update.category = applied.category
      update.expense_type = applied.expense_type
      update.tax_deductible = applied.tax_deductible
    }
  }

  if (maintenance.subcategory !== undefined) update.subcategory = maintenance.subcategory
  if (maintenance.maintenance_type !== undefined) update.maintenance_type = maintenance.maintenance_type
  if (maintenance.vehicle_id !== undefined) update.vehicle_id = maintenance.vehicle_id
  if (maintenance.maintenance_date) {
    update.submit_on = submitOnIsoFromMaintenanceDate(maintenance.maintenance_date)
  }
  if (options?.includePaymentMethod) {
    update.payment_method = options.payment_method ?? null
  }

  return update
}
