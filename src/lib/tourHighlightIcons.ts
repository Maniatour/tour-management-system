import {
  Award,
  BadgeCheck,
  Bus,
  Calendar,
  Camera,
  Car,
  Check,
  Clock,
  Globe,
  Heart,
  Hotel,
  MapPin,
  Mountain,
  Plane,
  Shield,
  Star,
  Sun,
  Users,
  Users2,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { TourHighlightLanguageChip } from '@/lib/tourHighlightLanguages'

export type TourHighlightItemId =
  | 'duration'
  | 'groupSize'
  | 'category'
  | 'languages'
  | 'departureArrival'
  | 'trustLicensedOperator'
  | 'trustSmallGroup'
  | 'trustFreeCancellation'

export const TOUR_HIGHLIGHT_ITEM_IDS = [
  'duration',
  'groupSize',
  'category',
  'languages',
  'departureArrival',
  'trustLicensedOperator',
  'trustSmallGroup',
  'trustFreeCancellation',
] as const

const BUILTIN_ID_SET = new Set<string>(TOUR_HIGHLIGHT_ITEM_IDS)

/** icons JSON에 저장하는 항목 순서 메타 키 */
export const TOUR_HIGHLIGHT_ORDER_META_KEY = '_order'

export const CUSTOM_TOUR_HIGHLIGHT_ID_PREFIX = 'custom_'

export function isBuiltinTourHighlightItemId(id: string): id is TourHighlightItemId {
  return BUILTIN_ID_SET.has(id)
}

export function isCustomTourHighlightItemId(id: string): boolean {
  return id.startsWith(CUSTOM_TOUR_HIGHLIGHT_ID_PREFIX)
}

export function createCustomTourHighlightItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${CUSTOM_TOUR_HIGHLIGHT_ID_PREFIX}${crypto.randomUUID()}`
  }
  return `${CUSTOM_TOUR_HIGHLIGHT_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const DEFAULT_TOUR_HIGHLIGHT_ICONS: Record<TourHighlightItemId, string> = {
  duration: 'clock',
  groupSize: 'users2',
  category: 'map-pin',
  languages: 'globe',
  departureArrival: 'map-pin',
  trustLicensedOperator: 'badge-check',
  trustSmallGroup: 'bus',
  trustFreeCancellation: 'shield',
}

export const TOUR_HIGHLIGHT_ICON_OPTIONS = [
  { key: 'clock', label: '시계' },
  { key: 'users2', label: '그룹' },
  { key: 'users', label: '인원' },
  { key: 'map-pin', label: '위치' },
  { key: 'badge-check', label: '인증' },
  { key: 'bus', label: '버스' },
  { key: 'shield', label: '보호' },
  { key: 'check', label: '체크' },
  { key: 'star', label: '별' },
  { key: 'calendar', label: '일정' },
  { key: 'camera', label: '사진' },
  { key: 'mountain', label: '자연' },
  { key: 'sun', label: '일출' },
  { key: 'hotel', label: '호텔' },
  { key: 'plane', label: '항공' },
  { key: 'car', label: '차량' },
  { key: 'heart', label: '하트' },
  { key: 'zap', label: '즉시' },
  { key: 'award', label: '상' },
  { key: 'globe', label: '세계' },
] as const

const TOUR_HIGHLIGHT_ICON_MAP: Record<string, LucideIcon> = {
  clock: Clock,
  users2: Users2,
  users: Users,
  'map-pin': MapPin,
  'badge-check': BadgeCheck,
  bus: Bus,
  shield: Shield,
  check: Check,
  star: Star,
  calendar: Calendar,
  camera: Camera,
  mountain: Mountain,
  sun: Sun,
  hotel: Hotel,
  plane: Plane,
  car: Car,
  heart: Heart,
  zap: Zap,
  award: Award,
  globe: Globe,
}

export function resolveTourHighlightIconComponent(iconKey?: string | null): LucideIcon {
  if (!iconKey?.trim()) return Check
  return TOUR_HIGHLIGHT_ICON_MAP[iconKey.trim()] ?? Check
}

export function resolveTourHighlightIcon(
  itemId: TourHighlightItemId,
  icons?: Partial<Record<string, string>> | null
): LucideIcon {
  const iconKey = icons?.[itemId]?.trim() || DEFAULT_TOUR_HIGHLIGHT_ICONS[itemId]
  return resolveTourHighlightIconComponent(iconKey)
}

function isHighlightStorageKey(key: string): boolean {
  return isBuiltinTourHighlightItemId(key) || isCustomTourHighlightItemId(key)
}

export function parseTourHighlightIcons(raw: unknown): Partial<Record<string, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Partial<Record<string, string>> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isHighlightStorageKey(key)) continue
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim()
    }
  }
  return result
}

export function serializeTourHighlightIcons(
  icons: Partial<Record<string, string>>,
  order?: string[] | null
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [id, value] of Object.entries(icons)) {
    if (!isHighlightStorageKey(id)) continue
    const trimmed = value?.trim()
    if (trimmed) result[id] = trimmed
  }
  if (order && order.length > 0) {
    result[TOUR_HIGHLIGHT_ORDER_META_KEY] = order.filter(isHighlightStorageKey).join(',')
  }
  return result
}

export function parseTourHighlightOrder(rawIcons: unknown): string[] {
  if (!rawIcons || typeof rawIcons !== 'object' || Array.isArray(rawIcons)) return []
  const raw = (rawIcons as Record<string, unknown>)[TOUR_HIGHLIGHT_ORDER_META_KEY]
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(isHighlightStorageKey)
}

/** order가 비어 있으면 기본 빌트인 전체 + 커스텀 ID */
export function resolveTourHighlightOrder(
  savedOrder: string[],
  customIds: string[]
): string[] {
  if (savedOrder.length > 0) {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const id of savedOrder) {
      if (!isHighlightStorageKey(id) || seen.has(id)) continue
      seen.add(id)
      ordered.push(id)
    }
    for (const id of customIds) {
      if (seen.has(id)) continue
      seen.add(id)
      ordered.push(id)
    }
    return ordered
  }
  return [...TOUR_HIGHLIGHT_ITEM_IDS, ...customIds.filter((id) => !BUILTIN_ID_SET.has(id))]
}

export type TourHighlightDisplayItem = {
  id: string
  label: string
  iconKey: string
  languageChips?: TourHighlightLanguageChip[]
  isCustom?: boolean
}

export type BuildTourHighlightItemsInput = {
  durationLabel?: string | null
  groupSize?: string | null
  categoryLabel?: string | null
  locationLine?: string | null
  languageChips?: TourHighlightLanguageChip[] | null
  departureArrivalLabel?: string | null
  trustLicensedOperator?: string
  trustSmallGroup?: string
  trustFreeCancellation?: string
  icons?: Partial<Record<string, string>> | null
  customItems?: TourHighlightDisplayItem[] | null
}

export function buildTourHighlightItems(
  input: BuildTourHighlightItemsInput
): TourHighlightDisplayItem[] {
  const icons = input.icons ?? {}
  const items: TourHighlightDisplayItem[] = []

  if (input.durationLabel) {
    items.push({
      id: 'duration',
      label: input.durationLabel,
      iconKey: icons.duration ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.duration,
    })
  }
  if (input.groupSize) {
    items.push({
      id: 'groupSize',
      label: input.groupSize,
      iconKey: icons.groupSize ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.groupSize,
    })
  }
  if (input.categoryLabel) {
    const location = input.locationLine?.trim() || 'Las Vegas'
    items.push({
      id: 'category',
      label: `${input.categoryLabel} · ${location}`,
      iconKey: icons.category ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.category,
    })
  }
  if (input.languageChips && input.languageChips.length > 0) {
    items.push({
      id: 'languages',
      label: input.languageChips.map((chip) => chip.label).join(' · '),
      iconKey: icons.languages ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.languages,
      languageChips: input.languageChips,
    })
  }
  if (input.departureArrivalLabel) {
    items.push({
      id: 'departureArrival',
      label: input.departureArrivalLabel,
      iconKey: icons.departureArrival ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.departureArrival,
    })
  }
  if (input.trustLicensedOperator) {
    items.push({
      id: 'trustLicensedOperator',
      label: input.trustLicensedOperator,
      iconKey: icons.trustLicensedOperator ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.trustLicensedOperator,
    })
  }
  if (input.trustSmallGroup) {
    items.push({
      id: 'trustSmallGroup',
      label: input.trustSmallGroup,
      iconKey: icons.trustSmallGroup ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.trustSmallGroup,
    })
  }
  if (input.trustFreeCancellation) {
    items.push({
      id: 'trustFreeCancellation',
      label: input.trustFreeCancellation,
      iconKey: icons.trustFreeCancellation ?? DEFAULT_TOUR_HIGHLIGHT_ICONS.trustFreeCancellation,
    })
  }

  if (input.customItems?.length) {
    items.push(...input.customItems)
  }

  return items
}

export function orderTourHighlightItems(
  items: TourHighlightDisplayItem[],
  order: string[],
  options?: { includeUnlisted?: boolean }
): TourHighlightDisplayItem[] {
  if (order.length === 0) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered: TourHighlightDisplayItem[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const item = byId.get(id)
    if (!item || seen.has(id)) continue
    seen.add(id)
    ordered.push(item)
  }
  if (options?.includeUnlisted) {
    for (const item of items) {
      if (seen.has(item.id)) continue
      ordered.push(item)
    }
  }
  return ordered
}

export const TOUR_HIGHLIGHT_ITEM_LABELS: Record<TourHighlightItemId, string> = {
  duration: '소요 시간',
  groupSize: '그룹 규모',
  category: '카테고리 · 출발 도시',
  languages: '지원 언어',
  departureArrival: '출발 / 도착',
  trustLicensedOperator: '공식 라이선스',
  trustSmallGroup: '소그룹 투어',
  trustFreeCancellation: '무료 취소',
}

export function getTourHighlightItemTitle(itemId: string): string {
  if (isBuiltinTourHighlightItemId(itemId)) {
    return TOUR_HIGHLIGHT_ITEM_LABELS[itemId]
  }
  return '커스텀 항목'
}

export const TRUST_TOUR_HIGHLIGHT_ITEM_IDS = [
  'trustLicensedOperator',
  'trustSmallGroup',
  'trustFreeCancellation',
] as const satisfies readonly TourHighlightItemId[]

export type TrustTourHighlightItemId = (typeof TRUST_TOUR_HIGHLIGHT_ITEM_IDS)[number]

/** item id → locale → custom label (신뢰 배지·커스텀 항목 등) */
export type TourHighlightLabelStore = Partial<Record<string, Partial<Record<string, string>>>>

export function parseTourHighlightLabels(raw: unknown): TourHighlightLabelStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: TourHighlightLabelStore = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isHighlightStorageKey(id)) continue
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const locales: Partial<Record<string, string>> = {}
    for (const [locale, label] of Object.entries(value as Record<string, unknown>)) {
      if (typeof label === 'string' && label.trim()) {
        locales[locale] = label.trim()
      }
    }
    if (Object.keys(locales).length > 0) {
      result[id] = locales
    }
  }
  return result
}

export function serializeTourHighlightLabels(
  labels: TourHighlightLabelStore
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const [id, locales] of Object.entries(labels)) {
    if (!isHighlightStorageKey(id) || !locales) continue
    const serialized: Record<string, string> = {}
    for (const [locale, label] of Object.entries(locales)) {
      const trimmed = typeof label === 'string' ? label.trim() : ''
      if (trimmed) serialized[locale] = trimmed
    }
    if (Object.keys(serialized).length > 0) {
      result[id] = serialized
    }
  }
  return result
}

export function collectCustomTourHighlightIds(
  icons: Partial<Record<string, string>>,
  labels: TourHighlightLabelStore,
  visibility: TourHighlightVisibilityStore
): string[] {
  const ids = new Set<string>()
  for (const source of [icons, labels, visibility]) {
    for (const key of Object.keys(source)) {
      if (isCustomTourHighlightItemId(key)) ids.add(key)
    }
  }
  return [...ids]
}

export function buildCustomTourHighlightItems(
  customIds: string[],
  labels: TourHighlightLabelStore,
  icons: Partial<Record<string, string>>,
  locale: string
): TourHighlightDisplayItem[] {
  const items: TourHighlightDisplayItem[] = []
  for (const id of customIds) {
    const label = resolveTourHighlightLabel(labels, id, locale, '')
    if (!label.trim()) continue
    items.push({
      id,
      label,
      iconKey: icons[id]?.trim() || 'star',
      isCustom: true,
    })
  }
  return items
}

/** item id → false 이면 고객 페이지에서 숨김 (키 없음 = 표시) */
export type TourHighlightVisibilityStore = Partial<Record<string, boolean>>

export function emptyTourHighlightItemVisibility(): Record<TourHighlightItemId, boolean> {
  return Object.fromEntries(
    TOUR_HIGHLIGHT_ITEM_IDS.map((id) => [id, true])
  ) as Record<TourHighlightItemId, boolean>
}

export function parseTourHighlightVisibility(raw: unknown): TourHighlightVisibilityStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: TourHighlightVisibilityStore = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isHighlightStorageKey(id)) continue
    if (value === false) result[id] = false
  }
  return result
}

export function mergeTourHighlightVisibilityDefaults(
  raw: TourHighlightVisibilityStore,
  customIds: string[] = []
): Record<string, boolean> {
  const result: Record<string, boolean> = { ...emptyTourHighlightItemVisibility() }
  for (const id of customIds) {
    result[id] = raw[id] !== false
  }
  for (const id of Object.keys(raw)) {
    if (!isHighlightStorageKey(id)) continue
    if (raw[id] === false) result[id] = false
    else if (!(id in result)) result[id] = true
  }
  return result
}

export function serializeTourHighlightVisibility(
  visibility: Partial<Record<string, boolean>>
): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const [id, value] of Object.entries(visibility)) {
    if (!isHighlightStorageKey(id)) continue
    if (value === false) result[id] = false
  }
  return result
}

export function readTourHighlightItemVisibility(
  visibility: TourHighlightVisibilityStore | null | undefined,
  itemId: string
): boolean {
  return visibility?.[itemId] !== false
}

export function filterVisibleTourHighlightItems(
  items: TourHighlightDisplayItem[],
  visibility: TourHighlightVisibilityStore | null | undefined
): TourHighlightDisplayItem[] {
  return items.filter((item) => readTourHighlightItemVisibility(visibility, item.id))
}

export function resolveTourHighlightLabel(
  labels: TourHighlightLabelStore | null | undefined,
  itemId: string,
  locale: string,
  fallback: string
): string {
  const locales = labels?.[itemId]
  if (!locales) return fallback

  const candidates = [locale, 'ko', 'en']
  for (const code of candidates) {
    const value = locales[code]?.trim()
    if (value) return value
  }

  for (const value of Object.values(locales)) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }

  return fallback
}
