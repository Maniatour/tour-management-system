
export const CATALOG_INTERVAL_KINDS = ['mileage', 'months', 'both', 'inspection'] as const

export type CatalogIntervalKind = (typeof CATALOG_INTERVAL_KINDS)[number]

export const CATALOG_SELECT_FIELDS =
  'code, label_ko, label_en, category_group, default_mileage_interval, default_month_interval, interval_kind, legacy_subcategory, sort_order, is_active, notes_ko, notes_en, applicable_fuel_types, applicable_vehicle_classes'

export function slugCatalogCode(input: string): string {
  const trimmed = input.trim().toLowerCase().replace(/\s+/g, '_')
  const cleaned = trimmed.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return cleaned.slice(0, 80) || 'item'
}

export function parseOptionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = parseInt(String(value), 10)
  return Number.isFinite(n) ? n : null
}

export function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

export function isValidCategoryGroup(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && /^[a-z][a-z0-9_]*$/.test(trimmed)
}

export function isValidIntervalKind(value: string): value is CatalogIntervalKind {
  return (CATALOG_INTERVAL_KINDS as readonly string[]).includes(value)
}
