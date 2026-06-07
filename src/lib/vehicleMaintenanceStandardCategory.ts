import {
  bilingualStandardLabel,
  buildUnifiedStandardLeafGroups,
  unifiedStandardTriggerLabel,
  VEHICLE_REPAIR_STANDARD_LEAF_ID,
  type UnifiedStandardLeafGroup,
} from '@/lib/companyExpenseStandardUnified'

const DEFAULT_STANDARD_DISPLAY: Record<'en' | 'ko', string> = {
  en: 'Car and Truck Expenses › Repairs & Maintenance',
  ko: '차량비 · 수리 및 유지보수',
}

function displayLocale(locale: string): 'en' | 'ko' {
  return locale.startsWith('en') ? 'en' : 'ko'
}
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import type { ExpenseStandardCategoryPickRow } from '@/lib/expenseStandardCategoryPaidFor'

/** 차량비 — Car and Truck Expenses (IRS Schedule C Line 9) */
export const VEHICLE_STANDARD_CATEGORY_ROOT_ID = 'CAT001' as const

/** 수리 및 유지보수 — Repairs & Maintenance (차량 정비 기본 표준 리프) */
export const VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID = VEHICLE_REPAIR_STANDARD_LEAF_ID

const WORK_SUBCATEGORY_KEYS = new Set([
  'oil_change',
  'tire_rotation',
  'brake_pad',
  'battery',
  'filter',
  'belt',
  'spark_plug',
  'alignment',
  'car_wash',
  'windshield_wiper',
  'other',
])

const LEGACY_MECHANICAL_CATEGORIES = new Set([
  'engine',
  'transmission',
  'brakes',
  'tires',
  'electrical',
  'air_conditioning',
  'body',
  'interior',
  'exterior',
  'other',
])

export function isLegacyMechanicalCategory(value: string): boolean {
  return LEGACY_MECHANICAL_CATEGORIES.has(value)
}

export function isVehicleMaintenanceWorkSubcategoryKey(value: string): boolean {
  return WORK_SUBCATEGORY_KEYS.has(value)
}

/** DB category 컬럼을 표준 리프 id로 정규화 (구 부품 코드·빈 값) */
export function normalizeStoredMaintenanceCategory(category: string | null | undefined): string {
  const trimmed = (category || '').trim()
  if (!trimmed || isLegacyMechanicalCategory(trimmed)) {
    return VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID
  }
  return trimmed
}

/** 차량 정비: CAT001(차량비) 하위 표준 리프만 */
export function buildVehicleMaintenanceStandardGroups(
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): UnifiedStandardLeafGroup[] {
  return buildUnifiedStandardLeafGroups(cats, locale, { includeInactive: true }).filter(
    (g) => g.rootId === VEHICLE_STANDARD_CATEGORY_ROOT_ID
  )
}

function defaultVehicleStandardDisplayLabel(
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): string {
  const lang = displayLocale(locale)
  const vehicleGroups = buildVehicleMaintenanceStandardGroups(cats, locale)
  const fromGroups = unifiedStandardTriggerLabel(
    vehicleGroups,
    VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID
  )
  if (fromGroups) return fromGroups
  const allGroups = buildUnifiedStandardLeafGroups(cats, locale, { includeInactive: true })
  const fromAll = unifiedStandardTriggerLabel(allGroups, VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID)
  if (fromAll) return fromAll
  const leaf = cats.find((c) => c.id === VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID)
  if (leaf) {
    const root = cats.find((c) => c.id === VEHICLE_STANDARD_CATEGORY_ROOT_ID)
    const leafLabel = bilingualStandardLabel(leaf.name, leaf.name_ko)
    if (root && root.id !== leaf.id) {
      return `${bilingualStandardLabel(root.name, root.name_ko)} › ${leafLabel}`
    }
    return leafLabel
  }
  return DEFAULT_STANDARD_DISPLAY[lang]
}

export function vehicleMaintenanceCategoryFilterOptions(
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): Array<{ value: string; label: string }> {
  const groups = buildVehicleMaintenanceStandardGroups(cats, locale)
  return groups.flatMap((g) =>
    g.items.map((it) => ({
      value: it.id,
      label: unifiedStandardTriggerLabel(groups, it.id) || it.displayLabel,
    }))
  )
}

/** 목록·상세: 표준 리프 id 또는 구(부품) 카테고리 → 표준 카테고리 라벨 */
export function resolveVehicleMaintenanceCategoryDisplay(
  categoryValue: string,
  cats: ExpenseStandardCategoryPickRow[],
  locale: string
): string {
  const trimmed = (categoryValue || '').trim()
  if (!trimmed) return '—'

  const allGroups = buildUnifiedStandardLeafGroups(cats, locale, { includeInactive: true })
  const fromStandard = unifiedStandardTriggerLabel(allGroups, trimmed)
  if (fromStandard) return fromStandard

  const row = cats.find((c) => c.id === trimmed)
  if (row) {
    const parent = row.parent_id ? cats.find((c) => c.id === row.parent_id) : null
    const leafLabel = bilingualStandardLabel(row.name, row.name_ko)
    if (parent) {
      return `${bilingualStandardLabel(parent.name, parent.name_ko)} › ${leafLabel}`
    }
    return leafLabel
  }

  if (isLegacyMechanicalCategory(trimmed)) {
    return defaultVehicleStandardDisplayLabel(cats, locale)
  }

  return trimmed
}

export const VEHICLE_MAINTENANCE_SUBCATEGORY_DELIMITER = ','

/** DB subcategory 문자열 → 작업 구분 키 배열 (쉼표 구분, 단일 값 호환) */
export function parseVehicleMaintenanceSubcategories(
  subcategoryValue: string | null | undefined
): string[] {
  const raw = (subcategoryValue || '').trim()
  if (!raw) return []
  return raw
    .split(VEHICLE_MAINTENANCE_SUBCATEGORY_DELIMITER)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 작업 구분 키 배열 → DB subcategory 문자열 */
export function serializeVehicleMaintenanceSubcategories(keys: string[]): string | null {
  const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))]
  if (unique.length === 0) return null
  return unique.join(VEHICLE_MAINTENANCE_SUBCATEGORY_DELIMITER)
}

/** 작업 구분: subcategory 우선, 없으면 구 category(엔진·기타 등)를 여기에 표시 */
export function resolveVehicleMaintenanceWorkSubcategoryLabels(
  categoryValue: string,
  subcategoryValue: string | null | undefined,
  legacyLabel: (legacyKey: string) => string
): string[] {
  const parsed = parseVehicleMaintenanceSubcategories(subcategoryValue)
  if (parsed.length > 0) {
    return parsed.map(legacyLabel)
  }
  const cat = (categoryValue || '').trim()
  if (cat && isLegacyMechanicalCategory(cat)) {
    try {
      return [legacyLabel(cat)]
    } catch {
      return [cat]
    }
  }
  return []
}

export function resolveVehicleMaintenanceWorkSubcategoryDisplay(
  categoryValue: string,
  subcategoryValue: string | null | undefined,
  legacyLabel: (legacyKey: string) => string
): string {
  const labels = resolveVehicleMaintenanceWorkSubcategoryLabels(
    categoryValue,
    subcategoryValue,
    legacyLabel
  )
  return labels.length > 0 ? labels.join(', ') : ''
}

/** 목록 조회 시 구 category(other·engine 등) → 표준 리프 + subcategory 이전 */
export async function migrateLegacyVehicleMaintenanceCategories(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const legacyIds = [...LEGACY_MECHANICAL_CATEGORIES]
  const { data, error } = await supabase
    .from('vehicle_maintenance')
    .select('id, category, subcategory')
    .in('category', legacyIds)
    .limit(5000)

  if (error || !data?.length) return 0

  let updated = 0
  for (const row of data) {
    const legacyCat = (row.category || '').trim()
    if (!legacyCat) continue
    const patch: { category: string; subcategory?: string | null } = {
      category: VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID,
    }
    if (!row.subcategory?.trim()) {
      patch.subcategory = legacyCat
    }
    const { error: uerr } = await supabase.from('vehicle_maintenance').update(patch).eq('id', row.id)
    if (!uerr) updated += 1
  }
  return updated
}

/** 편집·신규 폼: 구(부품) 카테고리는 기본 표준 리프로 맞춤 */
export function categoryValueForMaintenanceForm(
  storedCategory: string,
  cats: ExpenseStandardCategoryPickRow[]
): string {
  const trimmed = (storedCategory || '').trim()
  if (trimmed && cats.some((c) => c.id === trimmed && c.is_active !== false)) {
    return trimmed
  }
  if (!trimmed || isLegacyMechanicalCategory(trimmed)) {
    return VEHICLE_MAINTENANCE_DEFAULT_STANDARD_LEAF_ID
  }
  return trimmed
}
