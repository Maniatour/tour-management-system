import { contentFallbackOrder, isSiteLocale, SITE_LOCALES, type SiteLocale } from '@/lib/siteLocales'

export type TourAudienceKind = 'recommended' | 'not_recommended'

export type TourAudienceContentI18n = {
  title?: Partial<Record<SiteLocale, string>>
}

export type TourAudienceLibraryItem = {
  id: string
  name: string
  title: string
  title_en?: string | null
  audience_kind: TourAudienceKind
  content_i18n?: TourAudienceContentI18n | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type ProductTourAudienceLinkRow = {
  id: string
  product_id: string
  library_id: string
  order_index: number
  is_active: boolean
  tour_audience_library?: TourAudienceLibraryItem | TourAudienceLibraryItem[] | null
}

export type AttachedProductTourAudience = TourAudienceLibraryItem & {
  link_id: string
  product_id: string
  order_index: number
  link_is_active: boolean
}

export const TOUR_AUDIENCE_KIND_LABELS: Record<TourAudienceKind, { ko: string; en: string }> = {
  recommended: { ko: '추천', en: 'Recommended for' },
  not_recommended: { ko: '추천하지 않는 분', en: 'Not recommended for' },
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function getTourAudienceI18nMap(item: {
  title?: string | null
  title_en?: string | null
  content_i18n?: TourAudienceContentI18n | null
}): Partial<Record<SiteLocale, string>> {
  const fromJson = {
    ...((item.content_i18n?.title || {}) as Partial<Record<SiteLocale, string>>),
  }
  const ko = fromJson.ko || trimOrEmpty(item.title)
  const en = fromJson.en || trimOrEmpty(item.title_en)
  if (ko) fromJson.ko = ko
  else delete fromJson.ko
  if (en) fromJson.en = en
  else delete fromJson.en
  return fromJson
}

export function getTourAudienceLocalizedText(
  item: Parameters<typeof getTourAudienceI18nMap>[0],
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const map = getTourAudienceI18nMap(item)
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export function getTourAudienceExactText(
  item: Parameters<typeof getTourAudienceI18nMap>[0],
  locale: string
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  return getTourAudienceI18nMap(item)[preferred]?.trim() || ''
}

export function getTourAudienceFilledLocales(
  item: Parameters<typeof getTourAudienceI18nMap>[0]
): SiteLocale[] {
  const locales: SiteLocale[] = []
  for (const entry of SITE_LOCALES) {
    if (getTourAudienceExactText(item, entry.code)) locales.push(entry.code)
  }
  return locales
}

export function buildTourAudienceLibraryPayload(input: {
  name: string
  titleByLocale: Partial<Record<SiteLocale, string>>
  audienceKind: TourAudienceKind
}): Record<string, unknown> {
  const content_i18n: TourAudienceContentI18n = {
    title: { ...input.titleByLocale },
  }
  const titleKo = input.titleByLocale.ko?.trim() || ''
  const titleEn = input.titleByLocale.en?.trim() || ''

  return {
    name: input.name.trim() || titleKo || titleEn || 'Audience item',
    title: titleKo,
    title_en: titleEn || null,
    audience_kind: input.audienceKind,
    content_i18n,
    is_active: true,
  }
}

export function tourAudienceDraftFromLibraryItem(item: TourAudienceLibraryItem): {
  name: string
  titleByLocale: Partial<Record<SiteLocale, string>>
  audienceKind: TourAudienceKind
} {
  const titleByLocale: Partial<Record<SiteLocale, string>> = {}
  for (const entry of SITE_LOCALES) {
    const title = getTourAudienceExactText(item, entry.code)
    if (title) titleByLocale[entry.code] = title
  }
  return {
    name: item.name || '',
    titleByLocale,
    audienceKind: item.audience_kind,
  }
}

export function mapAttachedTourAudienceFromLink(
  row: ProductTourAudienceLinkRow
): AttachedProductTourAudience | null {
  const library = unwrapOne(row.tour_audience_library)
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

export async function fetchProductAttachedTourAudienceItems(
  client: SupabaseLike,
  productId: string,
  opts?: { includeInactive?: boolean }
): Promise<AttachedProductTourAudience[]> {
  let query = client
    .from('product_tour_audience_links')
    .select(
      `
      id,
      product_id,
      library_id,
      order_index,
      is_active,
      tour_audience_library (
        id,
        name,
        title,
        title_en,
        audience_kind,
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

  return ((data || []) as ProductTourAudienceLinkRow[])
    .map(mapAttachedTourAudienceFromLink)
    .filter((row): row is AttachedProductTourAudience => {
      if (!row) return false
      if (opts?.includeInactive) return true
      return row.is_active !== false && row.link_is_active !== false
    })
}

export async function fetchTourAudienceLibrary(
  client: SupabaseLike,
  opts?: { activeOnly?: boolean; kind?: TourAudienceKind; search?: string }
): Promise<TourAudienceLibraryItem[]> {
  let query = client.from('tour_audience_library').select('*').order('updated_at', { ascending: false })

  if (opts?.activeOnly !== false) {
    query = query.eq('is_active', true)
  }
  if (opts?.kind) {
    query = query.eq('audience_kind', opts.kind)
  }

  const { data, error } = await query
  if (error) throw error

  let rows = (data || []) as TourAudienceLibraryItem[]
  const search = opts?.search?.trim().toLowerCase()
  if (search) {
    rows = rows.filter((item) => {
      const hay = `${item.name} ${getTourAudienceLocalizedText(item, 'ko')} ${getTourAudienceLocalizedText(item, 'en')}`.toLowerCase()
      return hay.includes(search)
    })
  }
  return rows
}

export function splitTourAudienceByKind<T extends { audience_kind: TourAudienceKind }>(items: T[]): {
  recommended: T[]
  notRecommended: T[]
} {
  const recommended: T[] = []
  const notRecommended: T[] = []
  for (const item of items) {
    if (item.audience_kind === 'not_recommended') notRecommended.push(item)
    else recommended.push(item)
  }
  return { recommended, notRecommended }
}
