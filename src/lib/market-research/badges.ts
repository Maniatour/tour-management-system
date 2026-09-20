import type { MarketBadgeCatalogItem, MarketListingBadge } from './types'

export type { MarketBadgeCatalogItem, MarketListingBadge }

export const MARKET_BADGE_PRESETS = [
  { id: 'likely_to_sell_out', labelKo: 'Likely to sell out', labelEn: 'Likely to sell out' },
  { id: 'top_pick', labelKo: 'Top Pick', labelEn: 'Top Pick' },
  { id: 'top_rated', labelKo: 'Top rated', labelEn: 'Top rated' },
  { id: 'bestseller', labelKo: 'Bestseller', labelEn: 'Bestseller' },
  { id: 'travelers_choice', labelKo: "Travelers' Choice", labelEn: "Travelers' Choice" },
  { id: 'special_offer', labelKo: 'Special offer', labelEn: 'Special offer' },
  { id: 'great_value', labelKo: 'Great value', labelEn: 'Great value' },
  { id: 'popular', labelKo: 'Popular', labelEn: 'Popular' },
  { id: 'limited_availability', labelKo: 'Limited availability', labelEn: 'Limited availability' },
] as const

export function badgeCatalogLabel(row: Pick<MarketBadgeCatalogItem, 'label_ko' | 'label_en'>, isKo: boolean): string {
  if (isKo) return row.label_ko || row.label_en
  return row.label_en || row.label_ko
}

export function listingBadgeLabel(badge: MarketListingBadge, catalog: MarketBadgeCatalogItem[], isKo: boolean): string {
  const row = catalog.find((item) => item.badge_id === badge.id)
  if (row) return badgeCatalogLabel(row, isKo)
  const preset = MARKET_BADGE_PRESETS.find((item) => item.id === badge.id)
  if (preset) return isKo ? preset.labelKo : preset.labelEn
  return badge.label
}

export function badgeIdFromLabel(label: string): string {
  const ascii = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return ascii || `custom_${Date.now().toString(36)}`
}

export function findCatalogBadgeByLabel(
  badges: MarketBadgeCatalogItem[],
  label: string
): MarketBadgeCatalogItem | undefined {
  const needle = label.trim().toLowerCase()
  if (!needle) return undefined
  const slug = badgeIdFromLabel(label)
  return badges.find(
    (row) =>
      row.badge_id === slug ||
      row.label_ko.trim().toLowerCase() === needle ||
      row.label_en.trim().toLowerCase() === needle
  )
}

export function sortBadgeCatalog(rows: MarketBadgeCatalogItem[]): MarketBadgeCatalogItem[] {
  const index = new Map<string, number>(MARKET_BADGE_PRESETS.map((preset, i) => [preset.id, i]))
  return [...rows].sort((a, b) => {
    const ai = a.is_preset ? (index.get(a.badge_id) ?? 500) : 1000 + a.sort_order
    const bi = b.is_preset ? (index.get(b.badge_id) ?? 500) : 1000 + b.sort_order
    return ai - bi || a.badge_id.localeCompare(b.badge_id)
  })
}

export function parseListingBadges(raw: unknown): MarketListingBadge[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).badges
      : null
  if (!Array.isArray(rows)) return []
  const badges: MarketListingBadge[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (typeof row === 'string') {
      const id = row.trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      const preset = MARKET_BADGE_PRESETS.find((item) => item.id === id)
      badges.push({ id, label: preset?.labelEn || id })
      continue
    }
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const rec = row as Record<string, unknown>
    const id = typeof rec.id === 'string' ? rec.id.trim() : ''
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const preset = MARKET_BADGE_PRESETS.find((item) => item.id === id)
    badges.push({ id, label: label || preset?.labelEn || id })
  }
  return badges
}

export function serializeListingBadges(badges: MarketListingBadge[]): MarketListingBadge[] {
  return parseListingBadges(badges)
}

export function snapshotListingBadges(snapshot: { badges?: MarketListingBadge[]; raw_extract?: Record<string, unknown> } | null | undefined): MarketListingBadge[] {
  if (!snapshot) return []
  if (snapshot.badges && snapshot.badges.length > 0) return snapshot.badges
  return parseListingBadges(snapshot.raw_extract)
}
