/** Hotel pickup vehicle access tiers (Regular / High Top / Bus) */
export const PICKUP_ACCESS_CLASSES = ['regular', 'high_top', 'bus'] as const
export type PickupAccessClass = (typeof PICKUP_ACCESS_CLASSES)[number]

export const PICKUP_ACCESS_CLASS_LABELS: Record<
  PickupAccessClass,
  { ko: string; en: string; descriptionKo: string; descriptionEn: string }
> = {
  regular: {
    ko: 'Low top',
    en: 'Low top',
    descriptionKo: '미니밴, Ford Transit 등 일반 높이 차량',
    descriptionEn: 'Minivan, Ford Transit, and similar standard-height vehicles',
  },
  high_top: {
    ko: 'High top',
    en: 'High top',
    descriptionKo: 'Sprinter, Transit Hightop, Captain Seat 등',
    descriptionEn: 'Sprinter, Transit Hightop, Captain Seat, etc.',
  },
  bus: {
    ko: 'Bus',
    en: 'Bus',
    descriptionKo: '미니버스 23인승 등 대형 버스',
    descriptionEn: 'Mini bus 23-passenger and larger buses',
  },
}

export function getPickupAccessClassLabel(
  accessClass: PickupAccessClass,
  locale: 'ko' | 'en' = 'ko'
): string {
  return PICKUP_ACCESS_CLASS_LABELS[accessClass][locale === 'en' ? 'en' : 'ko']
}

export function inferPickupAccessClassFromName(name: string): PickupAccessClass {
  const n = name.toLowerCase()
  if (/\b(mini\s*bus|minibus|23|28|coach|bus)\b/i.test(n) && !/\bmini\s*van\b/i.test(n)) {
    return 'bus'
  }
  if (/\b(sprinter|hightop|high\s*top|captain\s*seat)\b/i.test(n)) {
    return 'high_top'
  }
  return 'regular'
}

export function isPickupAccessClass(value: string): value is PickupAccessClass {
  return (PICKUP_ACCESS_CLASSES as readonly string[]).includes(value)
}

export function normalizeAllowedPickupAccessClasses(
  classes: PickupAccessClass[] | null | undefined
): PickupAccessClass[] | null {
  if (!classes || classes.length === 0) return null
  const unique = PICKUP_ACCESS_CLASSES.filter((c) => classes.includes(c))
  if (unique.length === PICKUP_ACCESS_CLASSES.length) return null
  return unique
}

export const PICKUP_ACCESS_CLASS_BADGE_STYLES: Record<PickupAccessClass, string> = {
  regular: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  high_top: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
  bus: 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200',
}

export function resolvePickupAccessClass(value: PickupAccessClass | null | undefined): PickupAccessClass {
  return value && isPickupAccessClass(value) ? value : 'regular'
}
