import {
  BadgeCheck,
  Bus,
  Camera,
  Check,
  ShoppingBag,
  Sun,
  Users2,
  type LucideIcon,
} from 'lucide-react'
import { contentFallbackOrder, isSiteLocale, SITE_LOCALES, type SiteLocale } from '@/lib/siteLocales'

export type WhyChooseContentI18n = {
  title?: Partial<Record<SiteLocale, string>>
  description?: Partial<Record<SiteLocale, string>>
}

export type WhyChooseLibraryItem = {
  id: string
  name: string
  title: string
  title_en?: string | null
  description?: string | null
  description_en?: string | null
  icon_key?: string | null
  content_i18n?: WhyChooseContentI18n | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type ProductWhyChooseLinkRow = {
  id: string
  product_id: string
  library_id: string
  order_index: number
  is_active: boolean
  why_choose_library?: WhyChooseLibraryItem | WhyChooseLibraryItem[] | null
}

export type AttachedProductWhyChoose = WhyChooseLibraryItem & {
  link_id: string
  product_id: string
  order_index: number
  link_is_active: boolean
}

export const WHY_CHOOSE_ICON_OPTIONS = [
  { key: 'users', label: '소그룹' },
  { key: 'bus', label: '차량' },
  { key: 'guide', label: '가이드' },
  { key: 'sunrise', label: '일출' },
  { key: 'camera', label: '사진' },
  { key: 'no-shopping', label: '쇼핑 없음' },
  { key: 'check', label: '체크' },
] as const

const WHY_CHOOSE_ICON_MAP: Record<string, LucideIcon> = {
  users: Users2,
  bus: Bus,
  guide: BadgeCheck,
  sunrise: Sun,
  camera: Camera,
  'no-shopping': ShoppingBag,
  check: Check,
}

export function resolveWhyChooseIcon(iconKey?: string | null): LucideIcon {
  if (!iconKey) return Check
  return WHY_CHOOSE_ICON_MAP[iconKey] ?? Check
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function getWhyChooseI18nMap(
  item: {
    title?: string | null
    title_en?: string | null
    description?: string | null
    description_en?: string | null
    content_i18n?: WhyChooseContentI18n | null
  },
  field: 'title' | 'description'
): Partial<Record<SiteLocale, string>> {
  const fromJson = {
    ...((item.content_i18n?.[field] || {}) as Partial<Record<SiteLocale, string>>),
  }
  if (field === 'title') {
    const ko = fromJson.ko || trimOrEmpty(item.title)
    const en = fromJson.en || trimOrEmpty(item.title_en)
    if (ko) fromJson.ko = ko
    else delete fromJson.ko
    if (en) fromJson.en = en
    else delete fromJson.en
  } else {
    const ko = fromJson.ko || trimOrEmpty(item.description)
    const en = fromJson.en || trimOrEmpty(item.description_en)
    if (ko) fromJson.ko = ko
    else delete fromJson.ko
    if (en) fromJson.en = en
    else delete fromJson.en
  }
  return fromJson
}

export function getWhyChooseLocalizedText(
  item: Parameters<typeof getWhyChooseI18nMap>[0],
  field: 'title' | 'description',
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const map = getWhyChooseI18nMap(item, field)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function getWhyChooseExactText(
  item: Parameters<typeof getWhyChooseI18nMap>[0],
  field: 'title' | 'description',
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  return getWhyChooseI18nMap(item, field)[preferred]?.trim() || ''
}

export function getWhyChooseFilledLocales(
  item: Parameters<typeof getWhyChooseI18nMap>[0]
): SiteLocale[] {
  const locales: SiteLocale[] = []
  for (const entry of SITE_LOCALES) {
    const title = getWhyChooseExactText(item, 'title', entry.code)
    if (title) locales.push(entry.code)
  }
  return locales
}

export function mergeWhyChooseI18n(
  existing: WhyChooseContentI18n | null | undefined,
  field: 'title' | 'description',
  locale: string,
  value: string
): WhyChooseContentI18n {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const next: WhyChooseContentI18n = {
    title: { ...(existing?.title || {}) },
    description: { ...(existing?.description || {}) },
  }
  const trimmed = value.trim()
  if (trimmed) next[field]![preferred] = trimmed
  else delete next[field]![preferred]
  return next
}

export function buildWhyChooseLibraryPayload(input: {
  name: string
  titleByLocale: Partial<Record<SiteLocale, string>>
  descriptionByLocale?: Partial<Record<SiteLocale, string>>
  iconKey?: string | null
}): Record<string, unknown> {
  const content_i18n: WhyChooseContentI18n = {
    title: { ...input.titleByLocale },
    description: { ...(input.descriptionByLocale || {}) },
  }
  const titleKo = input.titleByLocale.ko?.trim() || ''
  const titleEn = input.titleByLocale.en?.trim() || ''
  const descKo = input.descriptionByLocale?.ko?.trim() || ''
  const descEn = input.descriptionByLocale?.en?.trim() || ''

  return {
    name: input.name.trim() || titleKo || titleEn || 'Why choose item',
    title: titleKo,
    title_en: titleEn || null,
    description: descKo,
    description_en: descEn || null,
    icon_key: input.iconKey?.trim() || null,
    content_i18n,
    is_active: true,
  }
}

export function whyChooseDraftFromLibraryItem(item: WhyChooseLibraryItem): {
  name: string
  titleByLocale: Partial<Record<SiteLocale, string>>
  descriptionByLocale: Partial<Record<SiteLocale, string>>
  iconKey: string
} {
  const titleByLocale: Partial<Record<SiteLocale, string>> = {}
  const descriptionByLocale: Partial<Record<SiteLocale, string>> = {}
  for (const entry of SITE_LOCALES) {
    const title = getWhyChooseExactText(item, 'title', entry.code)
    const description = getWhyChooseExactText(item, 'description', entry.code)
    if (title) titleByLocale[entry.code] = title
    if (description) descriptionByLocale[entry.code] = description
  }
  return {
    name: item.name || '',
    titleByLocale,
    descriptionByLocale,
    iconKey: item.icon_key?.trim() || 'check',
  }
}

export function mapAttachedWhyChooseFromLink(
  row: ProductWhyChooseLinkRow
): AttachedProductWhyChoose | null {
  const library = unwrapOne(row.why_choose_library)
  if (!library || library.is_active === false) return null
  return {
    ...library,
    link_id: row.id,
    product_id: row.product_id,
    order_index: row.order_index,
    link_is_active: row.is_active !== false,
  }
}

export type SupabaseLike = {
  from: (table: string) => any
}

export async function fetchProductAttachedWhyChooseItems(
  client: SupabaseLike,
  productId: string,
  opts?: { includeInactive?: boolean }
): Promise<AttachedProductWhyChoose[]> {
  let query = client
    .from('product_why_choose_links')
    .select(
      `
      id,
      product_id,
      library_id,
      order_index,
      is_active,
      why_choose_library (
        id,
        name,
        title,
        title_en,
        description,
        description_en,
        icon_key,
        content_i18n,
        is_active,
        created_at,
        updated_at
      )
    `
    )
    .eq('product_id', productId)
    .order('order_index', { ascending: true })

  if (!opts?.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data || []) as ProductWhyChooseLinkRow[])
    .map(mapAttachedWhyChooseFromLink)
    .filter((row): row is AttachedProductWhyChoose => {
      if (!row) return false
      if (opts?.includeInactive) return true
      return row.is_active !== false && row.link_is_active !== false
    })
}

export async function fetchWhyChooseLibrary(
  client: SupabaseLike,
  opts?: { activeOnly?: boolean; search?: string }
): Promise<WhyChooseLibraryItem[]> {
  let query = client
    .from('why_choose_library')
    .select('*')
    .order('updated_at', { ascending: false })

  if (opts?.activeOnly !== false) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) throw error

  let rows = (data || []) as WhyChooseLibraryItem[]
  const search = opts?.search?.trim().toLowerCase()
  if (search) {
    rows = rows.filter((item) => {
      const hay = `${item.name} ${getWhyChooseLocalizedText(item, 'title', 'ko')} ${getWhyChooseLocalizedText(item, 'title', 'en')}`.toLowerCase()
      return hay.includes(search)
    })
  }
  return rows
}
