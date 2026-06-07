export const VEHICLE_FUEL_TYPES = ['gasoline', 'diesel'] as const
export type VehicleFuelType = (typeof VEHICLE_FUEL_TYPES)[number]

export const MAINTENANCE_VEHICLE_CLASSES = [
  'minivan',
  'minibus',
  'diesel_van',
  'motorcoach',
] as const
export type MaintenanceVehicleClass = (typeof MAINTENANCE_VEHICLE_CLASSES)[number]

export type CatalogApplicability = {
  applicable_fuel_types?: string[] | null
  applicable_vehicle_classes?: string[] | null
}

export type VehicleApplicability = {
  fuel_type?: string | null
  maintenance_vehicle_class?: string | null
}

export function normalizeFuelType(value: string | null | undefined): VehicleFuelType {
  const v = (value ?? '').trim().toLowerCase()
  if (v === 'gasoline' || v === 'gas') return 'gasoline'
  return 'diesel'
}

export function normalizeMaintenanceVehicleClass(
  value: string | null | undefined
): MaintenanceVehicleClass {
  const v = (value ?? '').trim().toLowerCase() as MaintenanceVehicleClass
  if (MAINTENANCE_VEHICLE_CLASSES.includes(v)) return v
  return 'diesel_van'
}

/** 카탈로그 항목이 해당 차량에 적용되는지 */
export function catalogAppliesToVehicle(
  item: CatalogApplicability,
  vehicle: VehicleApplicability
): boolean {
  const fuel = normalizeFuelType(vehicle.fuel_type)
  const vehicleClass = normalizeMaintenanceVehicleClass(vehicle.maintenance_vehicle_class)

  const fuels = item.applicable_fuel_types?.filter(Boolean) ?? []
  if (fuels.length > 0 && !fuels.includes(fuel)) return false

  const classes = item.applicable_vehicle_classes?.filter(Boolean) ?? []
  if (classes.length > 0 && !classes.includes(vehicleClass)) return false

  return true
}

export const FUEL_TYPE_LABELS: Record<VehicleFuelType, { ko: string; en: string }> = {
  gasoline: { ko: '휘발유', en: 'Gasoline' },
  diesel: { ko: '디젤', en: 'Diesel' },
}

export const MAINTENANCE_CLASS_LABELS: Record<
  MaintenanceVehicleClass,
  { ko: string; en: string }
> = {
  minivan: { ko: '미니밴 (Sedona 등)', en: 'Minivan (e.g. Sedona)' },
  minibus: { ko: '미니버스 (Transit 등)', en: 'Minibus (e.g. Transit)' },
  diesel_van: { ko: '디젤 투어 밴 (Sprinter 등)', en: 'Diesel tour van (Sprinter)' },
  motorcoach: { ko: '대형 코치 (SC2 등)', en: 'Motorcoach (SC2)' },
}
