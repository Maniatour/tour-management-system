/**
 * Ops finance tenancy smoke (Phase 6c.0).
 * Read-only — verifies operator_id stamp coverage after Phase 6b.*
 * Does not change booking/payment/checkout logic.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

type Db = SupabaseClient<Database>

export type OpsFinanceCheckId =
  | 'stampVehicles'
  | 'stampCompanyExpenses'
  | 'stampCashFinancial'
  | 'stampStatement'
  | 'stampMatchTables'
  | 'stampPaymentRecords'
  | 'kovegasPaymentBaseline'
  | 'tenantPartitionPayments'
  | 'paymentRecordsSelectRls'
  | 'opsFinanceSelectRls'
  | 'companyExpensesSelectRls'
  | 'stampJournal'
  | 'journalSelectRls'
  | 'fleetSelectRls'
  | 'attendanceSelectRls'
  | 'tipMealSelectRls'
  | 'tourResExpensesSelectRls'
  | 'staffTenantLockPilot'

export type OpsFinanceCheckResult = {
  id: OpsFinanceCheckId
  ok: boolean
  detail: string
}

export type OpsFinanceIsolationReport = {
  operatorId: string
  isKovegas: boolean
  checks: OpsFinanceCheckResult[]
  passedCount: number
  totalCount: number
  allOk: boolean
}

type CountResult = { count: number | null; error: { message?: string } | null }

async function countNullOperatorId(db: Db, table: string): Promise<CountResult> {
  const { count, error } = await fromUntypedTable(db, table)
    .select('id', { count: 'exact', head: true })
    .is('operator_id', null)
  return { count: count ?? null, error }
}

async function countForOperator(db: Db, table: string, operatorId: string): Promise<CountResult> {
  const { count, error } = await fromUntypedTable(db, table)
    .select('id', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
  return { count: count ?? null, error }
}

async function countAll(db: Db, table: string): Promise<CountResult> {
  const { count, error } = await fromUntypedTable(db, table).select('id', {
    count: 'exact',
    head: true,
  })
  return { count: count ?? null, error }
}

function stampCheck(
  id: OpsFinanceCheckId,
  tableLabel: string,
  results: CountResult[]
): OpsFinanceCheckResult {
  for (const r of results) {
    if (r.error) {
      return {
        id,
        ok: false,
        detail: `${tableLabel}: ${r.error.message || 'query failed'} — apply Phase 6b migrations?`,
      }
    }
  }
  const nullTotal = results.reduce((sum, r) => sum + (r.count ?? 0), 0)
  return {
    id,
    ok: nullTotal === 0,
    detail:
      nullTotal === 0
        ? `${tableLabel}: operator_id NOT NULL (stamp ok)`
        : `${tableLabel}: ${nullTotal} rows with NULL operator_id`,
  }
}

export async function evaluateOpsFinanceIsolation(
  db: Db,
  operatorIdRaw?: string | null
): Promise<OpsFinanceIsolationReport> {
  const operatorId = resolveOperatorId(operatorIdRaw)
  const isKovegas = operatorId === KOVEgAS_OPERATOR_ID

  const [
    nullVehicles,
    nullCompany,
    nullCash,
    nullAccounts,
    nullImports,
    nullLines,
    nullRecon,
    nullCashMatch,
    nullPayments,
    nullJournalEntries,
    nullJournalLines,
    kovegasPayments,
    activePayments,
    allPayments,
    rlsReady,
    opsFinanceRlsReady,
    companyExpensesRlsReady,
    journalRlsReady,
    fleetRlsReady,
    attendanceRlsReady,
    tipMealRlsReady,
    tourResExpensesRlsReady,
    staffLockPilotReady,
  ] = await Promise.all([
    countNullOperatorId(db, 'vehicles'),
    countNullOperatorId(db, 'company_expenses'),
    countNullOperatorId(db, 'cash_transactions'),
    countNullOperatorId(db, 'financial_accounts'),
    countNullOperatorId(db, 'statement_imports'),
    countNullOperatorId(db, 'statement_lines'),
    countNullOperatorId(db, 'reconciliation_matches'),
    countNullOperatorId(db, 'expense_cash_ledger_matches'),
    countNullOperatorId(db, 'payment_records'),
    countNullOperatorId(db, 'journal_entries'),
    countNullOperatorId(db, 'journal_lines'),
    countForOperator(db, 'payment_records', KOVEgAS_OPERATOR_ID),
    countForOperator(db, 'payment_records', operatorId),
    countAll(db, 'payment_records'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_payment_records_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_ops_finance_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_company_expenses_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_journal_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_fleet_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_attendance_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_ops_tip_meal_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_ops_tour_reservation_expenses_select_rls_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).rpc('saas_staff_tenant_lock_pilot_ready') as Promise<{
      data: boolean | null
      error: { message?: string } | null
    }>,
  ])

  const checks: OpsFinanceCheckResult[] = [
    stampCheck('stampVehicles', 'vehicles', [nullVehicles]),
    stampCheck('stampCompanyExpenses', 'company_expenses', [nullCompany]),
    stampCheck('stampCashFinancial', 'cash_transactions+financial_accounts', [
      nullCash,
      nullAccounts,
    ]),
    stampCheck('stampStatement', 'statement_imports+lines', [nullImports, nullLines]),
    stampCheck('stampMatchTables', 'recon+cash_ledger matches', [nullRecon, nullCashMatch]),
    stampCheck('stampPaymentRecords', 'payment_records', [nullPayments]),
    stampCheck('stampJournal', 'journal_entries+lines', [nullJournalEntries, nullJournalLines]),
  ]

  if (kovegasPayments.error) {
    checks.push({
      id: 'kovegasPaymentBaseline',
      ok: false,
      detail: kovegasPayments.error.message || 'Kovegas payment_records count failed',
    })
  } else {
    const n = kovegasPayments.count ?? 0
    checks.push({
      id: 'kovegasPaymentBaseline',
      ok: n > 0,
      detail:
        n > 0
          ? `Kovegas payment_records=${n} (Tenant #1 baseline present)`
          : 'Kovegas payment_records=0 — unexpected empty baseline (or migrations not applied)',
    })
  }

  if (allPayments.error || activePayments.error || kovegasPayments.error) {
    checks.push({
      id: 'tenantPartitionPayments',
      ok: false,
      detail: 'Could not compare payment_records tenant partitions',
    })
  } else {
    const total = allPayments.count ?? 0
    const k = kovegasPayments.count ?? 0
    const active = activePayments.count ?? 0
    // Partition sanity: active tenant slice cannot exceed total; Kovegas slice ≤ total.
    const partitionOk = active <= total && k <= total && (nullPayments.count ?? 0) === 0
    checks.push({
      id: 'tenantPartitionPayments',
      ok: partitionOk,
      detail: isKovegas
        ? `total=${total} Kovegas=${k} — switch header to B and confirm B UI lists only B deposits`
        : `total=${total} Kovegas=${k} active(B)=${active} — B list must not show Kovegas deposits`,
    })
  }

  if (rlsReady.error) {
    checks.push({
      id: 'paymentRecordsSelectRls',
      ok: false,
      detail:
        rlsReady.error.message ||
        'saas_payment_records_select_rls_ready() missing — apply Phase 6c.1 migration',
    })
  } else {
    const ready = rlsReady.data === true
    checks.push({
      id: 'paymentRecordsSelectRls',
      ok: ready,
      detail: ready
        ? 'SELECT: staff_can_select_operator_row OR strict member OR assignee/customer (Phase 6d.1); writes unchanged'
        : 'payment_records SELECT scoped policy not found — apply 20260719230000 + 20260719320000',
    })
  }

  if (opsFinanceRlsReady.error) {
    checks.push({
      id: 'opsFinanceSelectRls',
      ok: false,
      detail:
        opsFinanceRlsReady.error.message ||
        'saas_ops_finance_select_rls_ready() missing — apply Phase 6c.2 migration',
    })
  } else {
    const ready = opsFinanceRlsReady.data === true
    checks.push({
      id: 'opsFinanceSelectRls',
      ok: ready,
      detail: ready
        ? 'ops finance SELECT uses staff_can_select_operator_row (Phase 6d.1–6d.2); writes unchanged'
        : 'Ops finance SELECT scoped policies missing — apply 20260719240000 … 20260719330000',
    })
  }

  if (companyExpensesRlsReady.error) {
    checks.push({
      id: 'companyExpensesSelectRls',
      ok: false,
      detail:
        companyExpensesRlsReady.error.message ||
        'saas_company_expenses_select_rls_ready() missing — apply Phase 6c.3 migration',
    })
  } else {
    const ready = companyExpensesRlsReady.data === true
    checks.push({
      id: 'companyExpensesSelectRls',
      ok: ready,
      detail: ready
        ? 'company_expenses SELECT uses staff_can_select_operator_row (Phase 6d.0+); writes unchanged'
        : 'company_expenses SELECT scoped policy missing — apply 20260719250000 + 20260719310000',
    })
  }

  if (journalRlsReady.error) {
    checks.push({
      id: 'journalSelectRls',
      ok: false,
      detail:
        journalRlsReady.error.message ||
        'saas_journal_select_rls_ready() missing — apply Phase 6c.4 migration',
    })
  } else {
    const ready = journalRlsReady.data === true
    checks.push({
      id: 'journalSelectRls',
      ok: ready,
      detail: ready
        ? 'journal_* SELECT uses staff_can_select_operator_row (Phase 6d.3); writes unchanged'
        : 'journal_* scoped SELECT missing — apply 20260719260000 + 20260719340000',
    })
  }

  if (fleetRlsReady.error) {
    checks.push({
      id: 'fleetSelectRls',
      ok: false,
      detail:
        fleetRlsReady.error.message ||
        'saas_fleet_select_rls_ready() missing — apply Phase 6c.5 migration',
    })
  } else {
    const ready = fleetRlsReady.data === true
    checks.push({
      id: 'fleetSelectRls',
      ok: ready,
      detail: ready
        ? 'vehicles/maintenance/schedules SELECT member path (Phase 6c.5)'
        : 'fleet SELECT member policies missing — apply 20260719270000 migration',
    })
  }

  if (attendanceRlsReady.error) {
    checks.push({
      id: 'attendanceSelectRls',
      ok: false,
      detail:
        attendanceRlsReady.error.message ||
        'saas_attendance_select_rls_ready() missing — apply Phase 6c.6 migration',
    })
  } else {
    const ready = attendanceRlsReady.data === true
    checks.push({
      id: 'attendanceSelectRls',
      ok: ready,
      detail: ready
        ? 'attendance SELECT: own/admin/non-staff tenant HR (Phase 6c.6); Kovegas staff privacy kept'
        : 'attendance SELECT tenancy missing — apply 20260719280000 migration',
    })
  }

  if (tipMealRlsReady.error) {
    checks.push({
      id: 'tipMealSelectRls',
      ok: false,
      detail:
        tipMealRlsReady.error.message ||
        'saas_ops_tip_meal_select_rls_ready() missing — apply Phase 6c.7 migration',
    })
  } else {
    const ready = tipMealRlsReady.data === true
    checks.push({
      id: 'tipMealSelectRls',
      ok: ready,
      detail: ready
        ? 'tip/meal SELECT tenant HR path (Phase 6c.7); Kovegas tip privacy kept'
        : 'tip/meal SELECT tenant HR missing — apply 20260719290000 migration',
    })
  }

  if (tourResExpensesRlsReady.error) {
    checks.push({
      id: 'tourResExpensesSelectRls',
      ok: false,
      detail:
        tourResExpensesRlsReady.error.message ||
        'saas_ops_tour_reservation_expenses_select_rls_ready() missing — apply Phase 6c.8 migration',
    })
  } else {
    const ready = tourResExpensesRlsReady.data === true
    checks.push({
      id: 'tourResExpensesSelectRls',
      ok: ready,
      detail: ready
        ? 'tour/reservation expenses SELECT staff|member|assignee (Phase 6c.8); writes unchanged'
        : 'tour/reservation expenses SELECT member missing — apply 20260719300000 migration',
    })
  }

  if (staffLockPilotReady.error) {
    checks.push({
      id: 'staffTenantLockPilot',
      ok: false,
      detail:
        staffLockPilotReady.error.message ||
        'saas_staff_tenant_lock_pilot_ready() missing — apply Phase 6d.0–6d.4 migrations',
    })
  } else {
    const ready = staffLockPilotReady.data === true
    checks.push({
      id: 'staffTenantLockPilot',
      ok: ready,
      detail: ready
        ? 'ops finance + journal SELECT use staff lock (Phase 6d.3); SAAS_STAFF_TENANT_LOCK + JWT'
        : 'staff tenant lock incomplete — apply 20260719310000 … 20260719340000 migrations',
    })
  }

  const passedCount = checks.filter((c) => c.ok).length
  return {
    operatorId,
    isKovegas,
    checks,
    passedCount,
    totalCount: checks.length,
    allOk: passedCount === checks.length,
  }
}
