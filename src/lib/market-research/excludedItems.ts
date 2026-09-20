import { roundMoney, toMoney } from './prices'
import type { MarketCompareItemCatalog, MarketExcludedItem, MarketInclusionMap, MarketInclusionStatus, MarketSnapshot } from './types'

export type { MarketExcludedItem, MarketInclusionMap, MarketInclusionStatus }

export type MarketCompareItemDef = {
  id: string
  labelKo: string
  labelEn: string
}

export const MARKET_EXCLUDED_ITEM_PRESETS: readonly MarketCompareItemDef[] = [
  { id: 'grand_canyon', labelKo: '그랜드캐년', labelEn: 'Grand Canyon' },
  { id: 'antelope_canyon', labelKo: '앤텔롭 캐년', labelEn: 'Antelope Canyon' },
  { id: 'horseshoe_bend', labelKo: '홀스슈 밴드', labelEn: 'Horseshoe Bend' },
  { id: 'guide_tip', labelKo: '가이드 팁', labelEn: 'Guide tip' },
  { id: 'breakfast', labelKo: '아침 식사', labelEn: 'Breakfast' },
  { id: 'lunch', labelKo: '점심 식사', labelEn: 'Lunch' },
  { id: 'dinner', labelKo: '저녁 식사', labelEn: 'Dinner' },
]

export function resolveCompareItems(
  items?: readonly MarketCompareItemDef[] | null
): MarketCompareItemDef[] {
  if (items === undefined || items === null) {
    return MARKET_EXCLUDED_ITEM_PRESETS.map((row) => ({ ...row }))
  }
  return items.map((row) => ({ ...row }))
}

export function compareItemDefsFromCatalog(
  catalog: Array<Pick<MarketCompareItemCatalog, 'item_id' | 'label_ko' | 'label_en'>>
): MarketCompareItemDef[] {
  return catalog.map((row) => ({
    id: row.item_id,
    labelKo: row.label_ko,
    labelEn: row.label_en,
  }))
}

export function compareItemLabel(item: Pick<MarketCompareItemDef, 'id' | 'labelKo' | 'labelEn'>, isKo: boolean): string {
  if (isKo) return item.labelKo || item.labelEn || item.id
  return item.labelEn || item.labelKo || item.id
}

export function excludedItemPresetLabel(id: string, isKo: boolean): string | null {
  const preset = MARKET_EXCLUDED_ITEM_PRESETS.find((row) => row.id === id)
  if (!preset) return null
  return isKo ? preset.labelKo : preset.labelEn
}

export function excludedItemLabel(item: Pick<MarketExcludedItem, 'id' | 'label'>, isKo: boolean): string {
  return excludedItemPresetLabel(item.id, isKo) || item.label
}

export function inferExcludedItemId(label: string): string {
  const n = label.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!n) return ''
  if (n.includes('antelope') || n.includes('앤텔롭')) return 'antelope_canyon'
  if (n.includes('grandcanyon') || n.includes('그랜드캐년')) return 'grand_canyon'
  if (n.includes('horseshoe') || n.includes('홀스슈')) return 'horseshoe_bend'
  if (n.includes('guidetip') || n.includes('tip') || n.includes('가이드팁') || n.includes('팁')) return 'guide_tip'
  if (n.includes('breakfast') || n.includes('아침')) return 'breakfast'
  if (n.includes('lunch') || n.includes('런치') || n.includes('점심')) return 'lunch'
  if (n.includes('dinner') || n.includes('저녁')) return 'dinner'
  if (n.includes('meal') || n.includes('식사')) return 'lunch'
  return `custom:${label.trim().toLowerCase()}`
}

export function defaultInclusionMap(
  allInclusive: boolean,
  items?: readonly MarketCompareItemDef[] | null
): MarketInclusionMap {
  return Object.fromEntries(
    resolveCompareItems(items).map((row) => [row.id, allInclusive ? 'included' : 'excluded'])
  )
}

export function parseInclusionMap(
  raw: unknown,
  fallbackAllInclusive = true,
  items?: readonly MarketCompareItemDef[] | null
): MarketInclusionMap {
  const next = defaultInclusionMap(fallbackAllInclusive, items)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next
  const rec = raw as Record<string, unknown>
  for (const [id, value] of Object.entries(rec)) {
    if (!id.trim()) continue
    if (value === 'included' || value === 'excluded') next[id] = value
  }
  return next
}

export function serializeInclusionMap(
  map: MarketInclusionMap,
  items?: readonly MarketCompareItemDef[] | null
): MarketInclusionMap {
  return parseInclusionMap(map, true, items)
}

export function inclusionHasExcluded(map: MarketInclusionMap): boolean {
  return Object.values(map).some((value) => value === 'excluded')
}

export function excludedItemsFromInclusion(
  map: MarketInclusionMap,
  amounts: MarketExcludedItem[],
  isKo: boolean,
  items?: readonly MarketCompareItemDef[] | null
): MarketExcludedItem[] {
  return resolveCompareItems(items).flatMap((preset) => {
    if (map[preset.id] !== 'excluded') return []
    const found = amounts.find((row) => row.id === preset.id)
    return [
      {
        id: preset.id,
        label: compareItemLabel(preset, isKo),
        amount: found?.amount ?? 0,
      },
    ]
  })
}

export function parseExcludedItems(raw: unknown): MarketExcludedItem[] {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).excludedItems ??
        (raw as Record<string, unknown>).excluded_items
      : null
  if (!Array.isArray(rows)) return []
  const items: MarketExcludedItem[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const rec = row as Record<string, unknown>
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    const idRaw = typeof rec.id === 'string' ? rec.id.trim() : ''
    const amount = toMoney(rec.amount)
    if (amount == null || amount <= 0) continue
    const id = inferExcludedItemId(label) || idRaw
    if (!id || !label || seen.has(id)) continue
    seen.add(id)
    items.push({ id, label, amount })
  }
  return items
}

export function snapshotExcludedItems(snapshot: MarketSnapshot | null | undefined): MarketExcludedItem[] {
  if (!snapshot) return []
  if (snapshot.excluded_items.length > 0) return snapshot.excluded_items
  return parseExcludedItems(snapshot.raw_extract)
}

export function sumExcludedItems(items: MarketExcludedItem[]): number {
  return roundMoney(items.reduce((sum, item) => item.amount + sum, 0))
}

export function serializeExcludedItems(items: MarketExcludedItem[]): MarketExcludedItem[] {
  return parseExcludedItems(items)
}

export function excludedAmountFor(
  items: MarketExcludedItem[],
  itemId: string
): number | null {
  const found = items.find((row) => row.id === itemId)
  return found ? found.amount : null
}

export function collectExcludedItemIds(
  snapshots: Array<MarketSnapshot | null | undefined>,
  items?: readonly MarketCompareItemDef[] | null
): Array<{ id: string; label: string }> {
  const seen = new Map<string, string>()
  for (const snapshot of snapshots) {
    for (const item of snapshotExcludedItems(snapshot)) {
      if (!seen.has(item.id)) seen.set(item.id, item.label)
    }
  }
  const catalog = resolveCompareItems(items)
  const presets = catalog.filter((preset) => seen.has(preset.id)).map((preset) => ({
    id: preset.id,
    label: preset.labelKo,
  }))
  const custom = [...seen.entries()]
    .filter(([id]) => !catalog.some((preset) => preset.id === id))
    .map(([id, label]) => ({ id, label }))
  return [...presets, ...custom]
}
