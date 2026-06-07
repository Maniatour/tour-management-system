import {
  maintenanceRecordMatchesCatalogCode,
  resolveCatalogMileageInterval,
  resolveCatalogMonthInterval,
  type VehicleMaintenanceCatalogRow,
  type VehicleMaintenanceScheduleRow,
} from '@/lib/vehicleMaintenanceCatalog'
import {
  dueSoonMilesForPreset,
  maintenanceDutyPresetMeta,
  type MaintenanceDutyPresetId,
} from '@/lib/vehicleMaintenanceDutyPresets'
import { catalogAppliesToVehicle } from '@/lib/vehicleMaintenanceApplicability'

export type MaintenanceDueStatus = 'overdue' | 'due_soon' | 'ok' | 'no_record' | 'disabled'

export type MaintenanceDueItem = {
  vehicleId: string
  catalogCode: string
  categoryGroup: string
  lastMaintenanceDate: string | null
  lastMaintenanceMileage: number | null
  intervalMiles: number | null
  intervalMonths: number | null
  dueAtMileage: number | null
  currentMileage: number | null
  milesSinceLast: number | null
  milesUntilDue: number | null
  status: MaintenanceDueStatus
  isEnabled: boolean
  scheduleId: string | null
  scheduleNotes: string | null
  intervalKind: string
  dutyPreset: MaintenanceDutyPresetId
  dutyPresetLabel: string
}

type MaintenanceRow = {
  id: string
  vehicle_id: string | null
  maintenance_date: string
  mileage: number | null
  subcategory: string | null
  mileage_interval: number | null
  next_maintenance_mileage: number | null
}

type VehicleRow = {
  id: string
  current_mileage: number | null
  engine_oil_change_cycle: number | null
  recent_engine_oil_change_mileage: number | null
  maintenance_duty_preset?: string | null
  fuel_type?: string | null
  maintenance_vehicle_class?: string | null
}

function compareMaintenanceRecency(a: MaintenanceRow, b: MaintenanceRow): number {
  const dateCmp = String(b.maintenance_date).localeCompare(String(a.maintenance_date))
  if (dateCmp !== 0) return dateCmp
  return (b.mileage ?? 0) - (a.mileage ?? 0)
}

function latestMaintenanceForCatalog(
  rows: MaintenanceRow[],
  catalog: VehicleMaintenanceCatalogRow[],
  catalogCode: string
): MaintenanceRow | null {
  const matches = rows.filter((r) => maintenanceRecordMatchesCatalogCode(catalog, r, catalogCode))
  if (matches.length === 0) return null
  return [...matches].sort(compareMaintenanceRecency)[0] ?? null
}

function resolveDueStatusMileage(
  currentMileage: number,
  dueAtMileage: number,
  dueSoonMiles: number
): Exclude<MaintenanceDueStatus, 'no_record' | 'disabled'> {
  if (currentMileage >= dueAtMileage) return 'overdue'
  if (currentMileage >= dueAtMileage - dueSoonMiles) return 'due_soon'
  return 'ok'
}

function buildCatalogDueItem(params: {
  vehicle: VehicleRow
  catalogItem: VehicleMaintenanceCatalogRow
  schedule: VehicleMaintenanceScheduleRow | null
  maintenanceRows: MaintenanceRow[]
}): MaintenanceDueItem {
  const { vehicle, catalogItem, schedule, maintenanceRows } = params
  const isEnabled = schedule?.is_enabled ?? true
  const presetMeta = maintenanceDutyPresetMeta(vehicle.maintenance_duty_preset)
  const dueSoonMiles = dueSoonMilesForPreset(vehicle.maintenance_duty_preset)

  const base: MaintenanceDueItem = {
    vehicleId: vehicle.id,
    catalogCode: catalogItem.code,
    categoryGroup: catalogItem.category_group,
    lastMaintenanceDate: schedule?.last_service_date ?? null,
    lastMaintenanceMileage: schedule?.last_service_mileage ?? null,
    intervalMiles: resolveCatalogMileageInterval(
      catalogItem,
      schedule,
      null,
      vehicle.engine_oil_change_cycle,
      vehicle.maintenance_duty_preset
    ),
    intervalMonths: resolveCatalogMonthInterval(catalogItem, schedule, vehicle.maintenance_duty_preset),
    dueAtMileage: schedule?.next_due_mileage ?? null,
    currentMileage: vehicle.current_mileage,
    milesSinceLast: null,
    milesUntilDue: null,
    status: 'no_record',
    isEnabled,
    scheduleId: schedule?.id ?? null,
    scheduleNotes: schedule?.notes ?? null,
    intervalKind: catalogItem.interval_kind,
    dutyPreset: presetMeta.id,
    dutyPresetLabel: presetMeta.labelKo,
  }

  if (!isEnabled) {
    return { ...base, status: 'disabled' }
  }

  const latest = latestMaintenanceForCatalog(maintenanceRows, [catalogItem], catalogItem.code)
  let lastMileage = schedule?.last_service_mileage ?? latest?.mileage ?? null
  let lastDate = schedule?.last_service_date ?? latest?.maintenance_date ?? null

  if (catalogItem.code === 'engine_oil') {
    const vehicleRecent = vehicle.recent_engine_oil_change_mileage ?? 0
    if (vehicleRecent > 0 && (lastMileage == null || vehicleRecent > lastMileage)) {
      lastMileage = vehicleRecent
    }
  }

  const intervalMiles = resolveCatalogMileageInterval(
    catalogItem,
    schedule,
    latest?.mileage_interval,
    vehicle.engine_oil_change_cycle,
    vehicle.maintenance_duty_preset
  )

  let dueAtMileage =
    schedule?.next_due_mileage ?? latest?.next_maintenance_mileage ?? null

  const currentMileage = vehicle.current_mileage

  if (
    intervalMiles != null &&
    intervalMiles > 0 &&
    lastMileage != null &&
    lastMileage > 0 &&
    (dueAtMileage == null || dueAtMileage <= 0)
  ) {
    dueAtMileage = lastMileage + intervalMiles
  }

  if (
    currentMileage == null ||
    currentMileage <= 0 ||
    lastMileage == null ||
    lastMileage <= 0 ||
    intervalMiles == null ||
    intervalMiles <= 0 ||
    dueAtMileage == null
  ) {
    return {
      ...base,
      lastMaintenanceDate: lastDate,
      lastMaintenanceMileage: lastMileage,
      intervalMiles,
      dueAtMileage,
      milesSinceLast:
        currentMileage != null && lastMileage != null ? currentMileage - lastMileage : null,
      status: 'no_record',
    }
  }

  const milesSinceLast = currentMileage - lastMileage
  const milesUntilDue = dueAtMileage - currentMileage

  return {
    ...base,
    lastMaintenanceDate: lastDate,
    lastMaintenanceMileage: lastMileage,
    intervalMiles,
    dueAtMileage,
    currentMileage,
    milesSinceLast,
    milesUntilDue,
    status: resolveDueStatusMileage(currentMileage, dueAtMileage, dueSoonMiles),
  }
}

const STATUS_SORT_ORDER: Record<MaintenanceDueStatus, number> = {
  overdue: 0,
  due_soon: 1,
  no_record: 2,
  ok: 3,
  disabled: 4,
}

function compareDueItems(a: MaintenanceDueItem, b: MaintenanceDueItem): number {
  const statusCmp = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]
  if (statusCmp !== 0) return statusCmp
  const aDue = a.milesUntilDue ?? Number.MAX_SAFE_INTEGER
  const bDue = b.milesUntilDue ?? Number.MAX_SAFE_INTEGER
  if (aDue !== bDue) return aDue - bDue
  return a.catalogCode.localeCompare(b.catalogCode)
}

export type ComputeScheduleOptions = {
  vehicleIds?: string[]
  includeOk?: boolean
  includeDisabled?: boolean
  includeNoRecord?: boolean
  catalogCodes?: string[]
}

/** 카탈로그·스케줄·정비 기록 기반 정기점검 예정 목록 */
export function computeVehicleMaintenanceDueList(
  vehicles: VehicleRow[],
  catalog: VehicleMaintenanceCatalogRow[],
  schedules: VehicleMaintenanceScheduleRow[],
  maintenances: MaintenanceRow[],
  options?: ComputeScheduleOptions
): MaintenanceDueItem[] {
  const activeCatalog = catalog.filter((c) => c.is_active)
  const vehicleIdSet = options?.vehicleIds ? new Set(options.vehicleIds) : null
  const catalogCodeSet = options?.catalogCodes ? new Set(options.catalogCodes) : null
  const scopedVehicles = vehicles.filter((v) => !vehicleIdSet || vehicleIdSet.has(v.id))

  const schedulesByVehicle = new Map<string, VehicleMaintenanceScheduleRow[]>()
  for (const row of schedules) {
    const list = schedulesByVehicle.get(row.vehicle_id) ?? []
    list.push(row)
    schedulesByVehicle.set(row.vehicle_id, list)
  }

  const rowsByVehicle = new Map<string, MaintenanceRow[]>()
  for (const row of maintenances) {
    if (!row.vehicle_id) continue
    const list = rowsByVehicle.get(row.vehicle_id) ?? []
    list.push(row)
    rowsByVehicle.set(row.vehicle_id, list)
  }

  const items: MaintenanceDueItem[] = []

  for (const vehicle of scopedVehicles) {
    const vehicleSchedules = schedulesByVehicle.get(vehicle.id) ?? []
    const maintenanceRows = rowsByVehicle.get(vehicle.id) ?? []
    const scheduleByCode = new Map(vehicleSchedules.map((s) => [s.catalog_code, s]))

    for (const catalogItem of activeCatalog) {
      if (catalogCodeSet && !catalogCodeSet.has(catalogItem.code)) continue
      if (!catalogAppliesToVehicle(catalogItem, vehicle)) continue
      const schedule = scheduleByCode.get(catalogItem.code) ?? null
      const item = buildCatalogDueItem({
        vehicle,
        catalogItem,
        schedule,
        maintenanceRows,
      })

      if (!options?.includeDisabled && item.status === 'disabled') continue
      if (!options?.includeNoRecord && item.status === 'no_record') continue
      if (!options?.includeOk && item.status === 'ok') continue

      items.push(item)
    }
  }

  return items.sort(compareDueItems)
}

export function buildScheduleUpsertFromMaintenance(params: {
  vehicleId: string
  catalogCode: string
  maintenanceId: string
  maintenanceDate: string
  mileage: number | null
  mileageInterval: number | null
}): Partial<VehicleMaintenanceScheduleRow> & {
  vehicle_id: string
  catalog_code: string
} {
  const lastMileage = params.mileage ?? null
  const interval = params.mileageInterval ?? null
  const nextDue =
    lastMileage != null && interval != null && interval > 0 ? lastMileage + interval : null

  return {
    vehicle_id: params.vehicleId,
    catalog_code: params.catalogCode,
    is_enabled: true,
    last_service_date: params.maintenanceDate,
    last_service_mileage: lastMileage,
    next_due_mileage: nextDue,
    last_maintenance_id: params.maintenanceId,
  }
}
