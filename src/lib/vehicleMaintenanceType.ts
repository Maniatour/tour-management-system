import type { VehicleMaintenanceCatalogRow } from '@/lib/vehicleMaintenanceCatalog'
import { parseVehicleMaintenanceSubcategories } from '@/lib/vehicleMaintenanceStandardCategory'

export type MaintenanceTypeBucket = 'inspection' | 'repair'

const LEGACY_INSPECTION_TYPES = new Set(['maintenance', 'service', 'inspection'])
const LEGACY_REPAIR_TYPES = new Set(['repair', 'emergency'])

/** 점검·정기 예방으로 보는 카탈로그 분류 */
const INSPECTION_CATEGORY_GROUPS = new Set([
  'inspection',
  'safety_compliance',
  'fluids_filters',
  'tires',
])

const LEGACY_INSPECTION_SUBCATEGORY_KEYS = new Set([
  'oil_change',
  'tire_rotation',
  'filter',
  'alignment',
  'car_wash',
  'windshield_wiper',
])

export function normalizeMaintenanceTypeBucket(type: string | null | undefined): MaintenanceTypeBucket {
  const v = (type ?? '').trim()
  if (LEGACY_INSPECTION_TYPES.has(v)) return 'inspection'
  if (LEGACY_REPAIR_TYPES.has(v) || v === 'repair') return 'repair'
  if (v === 'inspection') return 'inspection'
  return 'repair'
}

/** 목록 필터: 점검/수리 버킷 → DB에 저장된 legacy 값 포함 */
export function maintenanceTypesForFilter(bucket: string): string[] | null {
  if (!bucket || bucket === 'all') return null
  if (bucket === 'inspection') return ['inspection', 'maintenance', 'service']
  if (bucket === 'repair') return ['repair', 'emergency']
  return [bucket]
}

/** 작업 구분(카탈로그 코드)으로 점검 vs 수리 자동 분류 */
export function inferMaintenanceTypeFromCatalogCodes(
  codes: string[],
  catalog: VehicleMaintenanceCatalogRow[]
): MaintenanceTypeBucket {
  if (codes.length === 0) return 'repair'

  if (catalog.length > 0) {
    const items = codes
      .map((code) => catalog.find((c) => c.code === code))
      .filter((x): x is VehicleMaintenanceCatalogRow => x != null)
    if (items.length === 0) return 'repair'
    const allPreventive = items.every(
      (item) =>
        item.interval_kind === 'inspection' ||
        INSPECTION_CATEGORY_GROUPS.has(item.category_group)
    )
    return allPreventive ? 'inspection' : 'repair'
  }

  const allLegacyPreventive = codes.every((key) => LEGACY_INSPECTION_SUBCATEGORY_KEYS.has(key))
  return allLegacyPreventive ? 'inspection' : 'repair'
}

export function inferMaintenanceTypeFromSubcategoryValue(
  subcategoryValue: string | null | undefined,
  catalog: VehicleMaintenanceCatalogRow[]
): MaintenanceTypeBucket {
  return inferMaintenanceTypeFromCatalogCodes(
    parseVehicleMaintenanceSubcategories(subcategoryValue),
    catalog
  )
}
