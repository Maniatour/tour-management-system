import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  buildCompanyExpenseStandardLeafOrClause,
  type CompanyExpenseCategoryMappingRow,
} from '@/lib/companyExpenseStandardLeafFilter'
import {
  buildUnifiedStandardLeafGroups,
  flattenUnifiedLeaves,
  resolveCompanyExpensePnlLeafId,
  VEHICLE_REPAIR_STANDARD_LEAF_ID,
} from '@/lib/companyExpenseStandardUnified'
import { VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID } from '@/lib/vehicleMaintenanceStandardCategory'
import { VEHICLE_MAINTENANCE_PAID_FOR_LABEL_CODE } from '@/lib/companyExpensePaidForLabels'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'

type CompanyExpenseRow = Database['public']['Tables']['company_expenses']['Row']
type VehicleMaintenanceInsert = Database['public']['Tables']['vehicle_maintenance']['Insert']

const VALID_MAINTENANCE_TYPES = new Set(['maintenance', 'repair', 'service', 'inspection', 'emergency'])

const EXPENSE_SCAN_LIMIT = 5_000

function buildExpenseLeafResolutionContext(
  cats: ExpenseStandardCategoryPickRow[],
  mappings: CompanyExpenseCategoryMappingRow[]
) {
  const groups = buildUnifiedStandardLeafGroups(cats, 'ko', { includeInactive: true })
  const leafIdSet = new Set(flattenUnifiedLeaves(groups).map((item) => item.id))
  const mapToLeaf = new Map<string, string>()
  for (const row of mappings) {
    if (row.source_table !== 'company_expenses') continue
    const eff = row.sub_category_id || row.standard_category_id
    if (eff) mapToLeaf.set(`${row.original_value}::${row.source_table}`, eff)
  }
  return { leafIdSet, mapToLeaf }
}

/** 회사 지출이 «차량 수리·정비»(CAT001-002) 표준 리프로 분류될 때만 정비 목록 연동 대상 */
export function companyExpenseQualifiesForVehicleMaintenanceSync(
  expense: CompanyExpenseRow,
  cats: ExpenseStandardCategoryPickRow[],
  mappings: CompanyExpenseCategoryMappingRow[]
): boolean {
  const { leafIdSet, mapToLeaf } = buildExpenseLeafResolutionContext(cats, mappings)
  const { leafId } = resolveCompanyExpensePnlLeafId(expense, cats, leafIdSet, mapToLeaf, 'ko')
  return leafId === VEHICLE_REPAIR_STANDARD_LEAF_ID
}

function ymdFromSubmitOn(submitOn: string | null): string {
  if (!submitOn) return new Date().toISOString().slice(0, 10)
  const d = new Date(submitOn)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

/** 회사 지출 한 건 → vehicle_maintenance insert 행 */
export function companyExpenseToVehicleMaintenanceInsert(
  expense: CompanyExpenseRow,
  validVehicleIds?: Set<string>
): VehicleMaintenanceInsert {
  const receipts: string[] = []
  if (expense.photo_url) receipts.push(expense.photo_url)
  if (expense.attachments?.length) receipts.push(...expense.attachments)

  const maintenanceType =
    expense.maintenance_type && VALID_MAINTENANCE_TYPES.has(expense.maintenance_type)
      ? expense.maintenance_type
      : 'repair'

  const category = VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID

  const description =
    (expense.description || expense.paid_for || expense.standard_paid_for || '차량 수리').trim() ||
    '차량 수리'

  let vehicleId = expense.vehicle_id
  let notes = expense.notes || null
  if (vehicleId && validVehicleIds && !validVehicleIds.has(vehicleId)) {
    const orphanNote = `[차량 ID ${vehicleId} — vehicles 테이블에 없어 미연결]`
    notes = notes ? `${notes}\n${orphanNote}` : orphanNote
    vehicleId = null
  }

  return {
    id: `MAINT-EXP-${expense.id}`,
    vehicle_id: vehicleId,
    maintenance_date: ymdFromSubmitOn(expense.submit_on),
    maintenance_type: maintenanceType,
    category,
    subcategory: expense.subcategory || null,
    description,
    total_cost: expense.amount ?? 0,
    service_provider: expense.paid_to || null,
    receipts: receipts.length ? receipts : null,
    notes,
    status: 'completed',
    company_expense_id: expense.id,
  }
}

/**
 * 회사 지출(표준 카테고리 «차량 수리·정비» CAT001-002) 중
 * 아직 vehicle_maintenance에 연결되지 않은 건을 정비 기록으로 가져옵니다.
 * 자동 연동(MAINT-EXP-*) 중 보험 등 비정비 건은 pruneIneligibleSyncedVehicleMaintenance 로 제거합니다.
 */
export async function pruneIneligibleSyncedVehicleMaintenance(
  supabase: SupabaseClient,
  cats: ExpenseStandardCategoryPickRow[],
  mappings: CompanyExpenseCategoryMappingRow[]
): Promise<number> {
  const { data: rows, error } = await supabase
    .from('vehicle_maintenance')
    .select('id, company_expense_id')
    .like('id', 'MAINT-EXP-%')
    .not('company_expense_id', 'is', null)
    .limit(EXPENSE_SCAN_LIMIT)

  if (error || !rows?.length) return 0

  const expenseIds = [
    ...new Set(rows.map((row) => row.company_expense_id).filter((id): id is string => Boolean(id))),
  ]
  if (expenseIds.length === 0) return 0

  const { data: expenses, error: expenseErr } = await supabase
    .from('company_expenses')
    .select('*')
    .in('id', expenseIds)

  if (expenseErr) {
    console.error('pruneIneligibleSyncedVehicleMaintenance: expense lookup failed', expenseErr)
    return 0
  }

  const expenseById = new Map((expenses ?? []).map((expense) => [expense.id, expense]))
  const toDelete = rows
    .filter((row) => {
      const expense = row.company_expense_id ? expenseById.get(row.company_expense_id) : null
      if (!expense) return false
      return !companyExpenseQualifiesForVehicleMaintenanceSync(expense, cats, mappings)
    })
    .map((row) => row.id)

  if (toDelete.length === 0) return 0

  const { error: deleteErr } = await supabase.from('vehicle_maintenance').delete().in('id', toDelete)
  if (deleteErr) {
    console.error('pruneIneligibleSyncedVehicleMaintenance: delete failed', deleteErr)
    return 0
  }
  return toDelete.length
}

export async function syncVehicleMaintenanceFromCompanyExpenses(
  supabase: SupabaseClient
): Promise<{ imported: number; skipped: number; pruned: number }> {
  const [{ data: catRows, error: catErr }, { data: mappingRows, error: mapErr }] = await Promise.all([
    supabase
      .from('expense_standard_categories')
      .select('id, name, name_ko, parent_id, tax_deductible, display_order, is_active')
      .order('display_order', { ascending: true }),
    supabase
      .from('expense_category_mappings')
      .select('original_value, source_table, standard_category_id, sub_category_id')
      .eq('source_table', 'company_expenses'),
  ])

  if (catErr || mapErr) {
    console.error('syncVehicleMaintenanceFromCompanyExpenses: category load failed', catErr ?? mapErr)
    return { imported: 0, skipped: 0, pruned: 0 }
  }

  const cats = (catRows ?? []) as ExpenseStandardCategoryPickRow[]
  const mappings = (mappingRows ?? []) as CompanyExpenseCategoryMappingRow[]
  const pruned = await pruneIneligibleSyncedVehicleMaintenance(supabase, cats, mappings)

  const orClause = buildCompanyExpenseStandardLeafOrClause(
    VEHICLE_REPAIR_STANDARD_LEAF_ID,
    cats,
    mappings
  )

  const { data: linkedRows, error: linkedErr } = await supabase
    .from('vehicle_maintenance')
    .select('company_expense_id')
    .not('company_expense_id', 'is', null)

  if (linkedErr) {
    console.error('syncVehicleMaintenanceFromCompanyExpenses: linked lookup failed', linkedErr)
    return { imported: 0, skipped: 0, pruned }
  }

  const linkedExpenseIds = new Set(
    (linkedRows ?? [])
      .map((r) => r.company_expense_id)
      .filter((id): id is string => Boolean(id))
  )

  const expenseById = new Map<string, CompanyExpenseRow>()

  const { data: labelRows } = await supabase
    .from('company_expense_paid_for_labels')
    .select('id')
    .or(
      `links_vehicle_maintenance.eq.true,code.eq.${VEHICLE_MAINTENANCE_PAID_FOR_LABEL_CODE}`
    )

  const labelIds = (labelRows ?? []).map((r) => r.id).filter(Boolean)
  if (labelIds.length > 0) {
    const { data: labelExpenses, error: labelExpenseErr } = await supabase
      .from('company_expenses')
      .select('*')
      .is('deleted_at', null)
      .in('paid_for_label_id', labelIds)
      .order('submit_on', { ascending: false })
      .limit(EXPENSE_SCAN_LIMIT)

    if (labelExpenseErr) {
      console.error('syncVehicleMaintenanceFromCompanyExpenses: label expense query failed', labelExpenseErr)
    } else {
      for (const row of labelExpenses ?? []) {
        expenseById.set(row.id, row)
      }
    }
  }

  if (orClause) {
    const { data: expenseRows, error: expenseErr } = await supabase
      .from('company_expenses')
      .select('*')
      .is('deleted_at', null)
      .or(orClause)
      .order('submit_on', { ascending: false })
      .limit(EXPENSE_SCAN_LIMIT)

    if (expenseErr) {
      console.error('syncVehicleMaintenanceFromCompanyExpenses: expense query failed', expenseErr)
    } else {
      for (const row of expenseRows ?? []) {
        expenseById.set(row.id, row)
      }
    }
  }

  const toImport = [...expenseById.values()]
    .filter((expense) => !linkedExpenseIds.has(expense.id))
    .filter((expense) => companyExpenseQualifiesForVehicleMaintenanceSync(expense, cats, mappings))
  if (toImport.length === 0) {
    return { imported: 0, skipped: expenseById.size, pruned }
  }

  const { data: vehicleRows, error: vehicleErr } = await supabase.from('vehicles').select('id')
  if (vehicleErr) {
    console.error('syncVehicleMaintenanceFromCompanyExpenses: vehicles lookup failed', vehicleErr)
    return { imported: 0, skipped: toImport.length, pruned }
  }
  const validVehicleIds = new Set((vehicleRows ?? []).map((v) => v.id))

  const inserts = toImport.map((e) => companyExpenseToVehicleMaintenanceInsert(e, validVehicleIds))

  const BATCH = 100
  let imported = 0
  for (let i = 0; i < inserts.length; i += BATCH) {
    const chunk = inserts.slice(i, i + BATCH)
    const { error: insertErr } = await supabase.from('vehicle_maintenance').insert(chunk)
    if (insertErr) {
      console.error('syncVehicleMaintenanceFromCompanyExpenses: batch insert failed', insertErr)
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from('vehicle_maintenance').insert(row)
        if (rowErr) {
          console.error('syncVehicleMaintenanceFromCompanyExpenses: row insert failed', row.id, rowErr)
        } else {
          imported += 1
        }
      }
    } else {
      imported += chunk.length
    }
  }

  return { imported, skipped: expenseById.size - imported, pruned }
}
