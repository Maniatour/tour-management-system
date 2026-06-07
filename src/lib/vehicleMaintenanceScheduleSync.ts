import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  catalogCodesForMaintenanceSubcategories,
  type VehicleMaintenanceCatalogRow,
} from '@/lib/vehicleMaintenanceCatalog'
import { buildScheduleUpsertFromMaintenance } from '@/lib/vehicleMaintenanceSchedule'

type MaintenanceLike = {
  id: string
  vehicle_id: string | null
  maintenance_date: string
  mileage: number | null
  subcategory: string | null
  mileage_interval: number | null
}

export async function loadActiveMaintenanceCatalog(
  supabase: SupabaseClient<Database>
): Promise<VehicleMaintenanceCatalogRow[]> {
  const { data, error } = await supabase
    .from('vehicle_maintenance_catalog')
    .select(
      'code, label_ko, label_en, category_group, default_mileage_interval, default_month_interval, interval_kind, legacy_subcategory, sort_order, is_active, notes_ko, notes_en'
    )
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('vehicle_maintenance_catalog load error:', error)
    return []
  }
  return (data ?? []) as VehicleMaintenanceCatalogRow[]
}

/** 정비 기록 저장 시 해당 작업의 차량 스케줄 갱신 */
export async function syncVehicleMaintenanceSchedulesFromRecord(
  supabase: SupabaseClient<Database>,
  maintenance: MaintenanceLike,
  catalog?: VehicleMaintenanceCatalogRow[]
): Promise<number> {
  if (!maintenance.vehicle_id) return 0

  const catalogRows = catalog ?? (await loadActiveMaintenanceCatalog(supabase))
  const codes = catalogCodesForMaintenanceSubcategories(catalogRows, maintenance.subcategory)
  if (codes.length === 0) return 0

  let updated = 0
  for (const catalogCode of codes) {
    const patch = buildScheduleUpsertFromMaintenance({
      vehicleId: maintenance.vehicle_id,
      catalogCode,
      maintenanceId: maintenance.id,
      maintenanceDate: maintenance.maintenance_date,
      mileage: maintenance.mileage,
      mileageInterval: maintenance.mileage_interval,
    })

    const { error } = await supabase.from('vehicle_maintenance_schedules').upsert(
      {
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vehicle_id,catalog_code' }
    )

    if (!error) updated += 1
  }

  return updated
}
