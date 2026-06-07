import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

function parseMileage(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normalizeVehicleId(vehicleId: string | null | undefined): string | null {
  if (!vehicleId || vehicleId === 'none') return null
  return vehicleId
}

/** 회사 지출 저장 시 차량 마일리지 → vehicles.current_mileage 및 연결 정비 기록 반영 */
export async function applyCompanyExpenseVehicleMileage(
  supabase: SupabaseClient<Database>,
  opts: { expenseId: string; vehicleId: string | null | undefined; mileage: unknown }
): Promise<void> {
  const vehicleId = normalizeVehicleId(opts.vehicleId)
  const mileage = parseMileage(opts.mileage)
  if (!vehicleId || mileage == null) return

  const { error: vehicleErr } = await supabase
    .from('vehicles')
    .update({ current_mileage: mileage })
    .eq('id', vehicleId)

  if (vehicleErr) {
    console.error('applyCompanyExpenseVehicleMileage: vehicle update failed', vehicleErr)
  }

  const maintenanceId = `MAINT-EXP-${opts.expenseId}`
  const { error: byIdErr } = await supabase
    .from('vehicle_maintenance')
    .update({ mileage })
    .eq('id', maintenanceId)

  if (byIdErr) {
    console.error('applyCompanyExpenseVehicleMileage: maintenance by id update failed', byIdErr)
  }

  const { error: byExpenseErr } = await supabase
    .from('vehicle_maintenance')
    .update({ mileage })
    .eq('company_expense_id', opts.expenseId)

  if (byExpenseErr) {
    console.error('applyCompanyExpenseVehicleMileage: maintenance by expense update failed', byExpenseErr)
  }
}
