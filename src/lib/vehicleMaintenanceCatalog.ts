import { parseVehicleMaintenanceSubcategories } from '@/lib/vehicleMaintenanceStandardCategory'
import { resolvePresetMileageInterval, resolvePresetMonthInterval } from '@/lib/vehicleMaintenanceDutyPresets'

export type MaintenanceCatalogIntervalKind = 'mileage' | 'months' | 'both' | 'inspection'

export type VehicleMaintenanceCatalogRow = {
  code: string
  label_ko: string
  label_en: string | null
  category_group: string
  default_mileage_interval: number | null
  default_month_interval: number | null
  interval_kind: MaintenanceCatalogIntervalKind
  legacy_subcategory: string | null
  sort_order: number
  is_active: boolean
  notes_ko: string | null
  notes_en: string | null
  applicable_fuel_types: string[] | null
  applicable_vehicle_classes: string[] | null
}

export type VehicleMaintenanceScheduleRow = {
  id: string
  vehicle_id: string
  catalog_code: string
  is_enabled: boolean
  custom_mileage_interval: number | null
  custom_month_interval: number | null
  last_service_date: string | null
  last_service_mileage: number | null
  next_due_mileage: number | null
  next_due_date: string | null
  notes: string | null
  last_maintenance_id: string | null
}

export const CATALOG_GROUP_ORDER = [
  'fluids_filters',
  'cooling',
  'hvac',
  'belts',
  'brakes',
  'air_brakes',
  'suspension',
  'tires',
  'drivetrain',
  'engine',
  'emissions',
  'exhaust',
  'electrical',
  'coach_body',
  'safety_compliance',
  'exterior',
  'inspection',
] as const

export type CatalogGroupKey = (typeof CATALOG_GROUP_ORDER)[number]

export function catalogGroupLabelKey(group: string): string {
  return `catalogGroups.${group}`
}

export function catalogItemLabel(
  item: Pick<VehicleMaintenanceCatalogRow, 'code' | 'label_ko' | 'label_en'>,
  locale: string
): string {
  if (locale.startsWith('en') && item.label_en?.trim()) return item.label_en.trim()
  return item.label_ko
}

/** 분류 그룹: 한글 + 영문 동시 표시 */
export function catalogGroupBilingualLabel(
  labelKo: string,
  labelEn: string | null | undefined
): { ko: string; en: string | null } {
  const ko = labelKo.trim()
  const en = labelEn?.trim() || null
  if (!en || en === ko) return { ko, en: null }
  return { ko, en }
}

/** 작업 구분 폼: 한글 + 영문 동시 표시 */
export function catalogItemBilingualLabel(
  item: Pick<VehicleMaintenanceCatalogRow, 'label_ko' | 'label_en'>
): { ko: string; en: string | null } {
  const ko = item.label_ko.trim()
  const en = item.label_en?.trim() || null
  if (!en || en === ko) return { ko, en: null }
  return { ko, en }
}

export function catalogItemMatchesSearch(
  item: Pick<VehicleMaintenanceCatalogRow, 'code' | 'label_ko' | 'label_en'>,
  query: string,
  extraText = ''
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const { ko, en } = catalogItemBilingualLabel(item)
  const text = [ko, en, item.code.replace(/_/g, ' '), extraText].join(' ').toLowerCase()
  return q.split(/\s+/).filter(Boolean).every((token) => text.includes(token))
}

export function resolveLastServiceDateForCatalog(params: {
  catalogCode: string
  catalog: VehicleMaintenanceCatalogRow[]
  vehicleId: string
  maintenances: {
    vehicle_id: string | null
    maintenance_date: string
    subcategory: string | null
  }[]
  schedule?: VehicleMaintenanceScheduleRow | null
}): string | null {
  let lastDate = params.schedule?.last_service_date ?? null
  const rows = params.maintenances.filter((m) => m.vehicle_id === params.vehicleId)
  for (const row of rows) {
    if (!maintenanceRecordMatchesCatalogCode(params.catalog, row, params.catalogCode)) continue
    const d = String(row.maintenance_date)
    if (!lastDate || d > lastDate) lastDate = d
  }
  return lastDate
}

/** 카탈로그 코드 ↔ 구 subcategory 키 매칭 */
export function catalogCodesForMaintenanceSubcategories(
  catalog: VehicleMaintenanceCatalogRow[],
  subcategoryValue: string | null | undefined
): string[] {
  const keys = parseVehicleMaintenanceSubcategories(subcategoryValue)
  const codes = new Set<string>()
  for (const key of keys) {
    const direct = catalog.find((c) => c.code === key)
    if (direct) {
      codes.add(direct.code)
      continue
    }
    const legacy = catalog.find((c) => c.legacy_subcategory === key)
    if (legacy) codes.add(legacy.code)
  }
  return [...codes]
}

export function maintenanceRecordMatchesCatalogCode(
  catalog: VehicleMaintenanceCatalogRow[],
  row: { subcategory: string | null },
  catalogCode: string
): boolean {
  const item = catalog.find((c) => c.code === catalogCode)
  if (!item) return false
  const subs = parseVehicleMaintenanceSubcategories(row.subcategory)
  if (subs.includes(catalogCode)) return true
  if (item.legacy_subcategory && subs.includes(item.legacy_subcategory)) return true
  return false
}

export function resolveCatalogMileageInterval(
  item: VehicleMaintenanceCatalogRow,
  schedule?: VehicleMaintenanceScheduleRow | null,
  recordInterval?: number | null,
  vehicleOilCycle?: number | null,
  dutyPreset?: string | null
): number | null {
  if (schedule?.custom_mileage_interval != null && schedule.custom_mileage_interval > 0) {
    return schedule.custom_mileage_interval
  }
  if (recordInterval != null && recordInterval > 0) return recordInterval
  if (item.code === 'engine_oil' && vehicleOilCycle != null && vehicleOilCycle > 0) {
    return vehicleOilCycle
  }
  const fromPreset = resolvePresetMileageInterval({
    catalogCode: item.code,
    catalogDefaultMileage: item.default_mileage_interval,
    preset: dutyPreset ?? 'standard',
  })
  if (fromPreset != null) return fromPreset
  return item.default_mileage_interval
}

export function resolveCatalogMonthInterval(
  item: VehicleMaintenanceCatalogRow,
  schedule?: VehicleMaintenanceScheduleRow | null,
  dutyPreset?: string | null
): number | null {
  if (schedule?.custom_month_interval != null && schedule.custom_month_interval > 0) {
    return schedule.custom_month_interval
  }
  return resolvePresetMonthInterval({
    catalogDefaultMonths: item.default_month_interval,
    preset: dutyPreset ?? 'standard',
  })
}

export type CatalogIntervalDisplay = {
  miles: number | null
  months: number | null
  isInspectionOnly: boolean
}

/** 폼·목록용 유효 마일/월 주기 */
export function resolveCatalogIntervalDisplay(
  item: VehicleMaintenanceCatalogRow,
  schedule?: VehicleMaintenanceScheduleRow | null,
  vehicleOilCycle?: number | null,
  dutyPreset?: string | null
): CatalogIntervalDisplay {
  const showMileage =
    item.interval_kind === 'mileage' ||
    item.interval_kind === 'both' ||
    item.interval_kind === 'inspection'
  const showMonths = item.interval_kind === 'months' || item.interval_kind === 'both'

  const miles = showMileage
    ? resolveCatalogMileageInterval(item, schedule, null, vehicleOilCycle, dutyPreset)
    : null
  const months = showMonths
    ? resolveCatalogMonthInterval(item, schedule, dutyPreset)
    : null

  const hasMiles = miles != null && miles > 0
  const hasMonths = months != null && months > 0

  return {
    miles: hasMiles ? miles : null,
    months: hasMonths ? months : null,
    isInspectionOnly: item.interval_kind === 'inspection' && !hasMiles && !hasMonths,
  }
}

/** 폼·표시용: 구 subcategory 키를 카탈로그 code로 정규화 */
export function normalizeSubcategoriesToCatalogCodes(
  subcategoryValue: string | null | undefined,
  catalog: VehicleMaintenanceCatalogRow[]
): string[] {
  const keys = parseVehicleMaintenanceSubcategories(subcategoryValue)
  const codes = new Set<string>()
  for (const key of keys) {
    const byCode = catalog.find((c) => c.code === key)
    if (byCode) {
      codes.add(byCode.code)
      continue
    }
    const byLegacy = catalog.find((c) => c.legacy_subcategory === key)
    if (byLegacy) {
      codes.add(byLegacy.code)
      continue
    }
    codes.add(key)
  }
  return [...codes]
}

export function resolveCatalogLabelForSubcategoryKey(
  key: string,
  catalog: VehicleMaintenanceCatalogRow[],
  locale: string,
  fallback: (legacyKey: string) => string
): string {
  const byCode = catalog.find((c) => c.code === key)
  if (byCode) return catalogItemLabel(byCode, locale)
  const byLegacy = catalog.find((c) => c.legacy_subcategory === key)
  if (byLegacy) return catalogItemLabel(byLegacy, locale)
  return fallback(key)
}

export function groupCatalogItems(
  catalog: VehicleMaintenanceCatalogRow[]
): Map<string, VehicleMaintenanceCatalogRow[]> {
  const map = new Map<string, VehicleMaintenanceCatalogRow[]>()
  const sorted = [...catalog].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
  for (const item of sorted) {
    const list = map.get(item.category_group) ?? []
    list.push(item)
    map.set(item.category_group, list)
  }
  return map
}
