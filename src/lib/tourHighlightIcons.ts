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
  icons?: Partial<Record<TourHighlightItemId, string>> | null
): LucideIcon {
  const iconKey = icons?.[itemId]?.trim() || DEFAULT_TOUR_HIGHLIGHT_ICONS[itemId]
  return resolveTourHighlightIconComponent(iconKey)
}

export function parseTourHighlightIcons(
  raw: unknown
): Partial<Record<TourHighlightItemId, string>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Partial<Record<TourHighlightItemId, string>> = {}
  for (const id of TOUR_HIGHLIGHT_ITEM_IDS) {
    const value = (raw as Record<string, unknown>)[id]
    if (typeof value === 'string' && value.trim()) {
      result[id] = value.trim()
    }
  }
  return result
}

export function serializeTourHighlightIcons(
  icons: Partial<Record<TourHighlightItemId, string>>
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const id of TOUR_HIGHLIGHT_ITEM_IDS) {
    const value = icons[id]?.trim()
    if (value) result[id] = value
  }
  return result
}

export type TourHighlightDisplayItem = {
  id: TourHighlightItemId
  label: string
  iconKey: string
  languageChips?: TourHighlightLanguageChip[]
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
  icons?: Partial<Record<TourHighlightItemId, string>> | null
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

  return items
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

export const TRUST_TOUR_HIGHLIGHT_ITEM_IDS = [
  'trustLicensedOperator',
  'trustSmallGroup',
  'trustFreeCancellation',
] as const satisfies readonly TourHighlightItemId[]

export type TrustTourHighlightItemId = (typeof TRUST_TOUR_HIGHLIGHT_ITEM_IDS)[number]

/** item id → locale → custom label (신뢰 배지 등 상품별 문구) */
export type TourHighlightLabelStore = Partial<
  Record<TourHighlightItemId, Partial<Record<string, string>>>
>

export function parseTourHighlightLabels(raw: unknown): TourHighlightLabelStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: TourHighlightLabelStore = {}
  for (const id of TOUR_HIGHLIGHT_ITEM_IDS) {
    const value = (raw as Record<string, unknown>)[id]
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
  for (const id of TOUR_HIGHLIGHT_ITEM_IDS) {
    const locales = labels[id]
    if (!locales) continue
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

export function resolveTourHighlightLabel(
  labels: TourHighlightLabelStore | null | undefined,
  itemId: TourHighlightItemId,
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
