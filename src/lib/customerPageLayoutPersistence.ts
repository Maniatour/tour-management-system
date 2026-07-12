import type { CustomerPageId } from '@/lib/customer-page-registry'
import { supabase } from '@/lib/supabase'
import {
  DEFAULT_HOME_PAGE_LAYOUT,
  ensureManiaTourHomePageLayout,
  normalizeHomePageLayout,
  type HomePageLayout,
} from '@/lib/customerPageHomeLayout'
import {
  buildDefaultPageZoneLayout,
  normalizePageZoneLayout,
  type PageZoneLayout,
} from '@/lib/customerPageZoneLayout'
import {
  buildDefaultListingCardLayout,
  normalizeListingCardLayout,
  type ListingCardLayout,
} from '@/lib/customerPageListingCardLayout'
import {
  pageSupportsZoneLayout,
  type ZoneLayoutPageId,
} from '@/lib/customerPageZoneLayoutCatalog'

export const CUSTOMER_PAGE_LAYOUTS_NAMESPACE = 'customer_page_layouts'
export const CUSTOMER_PAGE_LAYOUTS_LOCALE = 'config'
export const HOME_PAGE_LAYOUT_KEY = 'home'
export const LISTING_CARD_LAYOUT_KEY = 'listing-card-layout'

let homeLayoutCache: HomePageLayout = ensureManiaTourHomePageLayout(DEFAULT_HOME_PAGE_LAYOUT)

const zoneLayoutCaches: Partial<Record<ZoneLayoutPageId, PageZoneLayout>> = {}

let listingCardLayoutCache: ListingCardLayout = buildDefaultListingCardLayout()

export function getCustomerPageHomeLayoutCache(): HomePageLayout {
  return homeLayoutCache
}

export function setCustomerPageHomeLayoutCache(layout: HomePageLayout): void {
  homeLayoutCache = ensureManiaTourHomePageLayout(layout)
}

export function loadCustomerPageHomeLayout(): HomePageLayout {
  return ensureManiaTourHomePageLayout(homeLayoutCache)
}

export async function fetchCustomerPageHomeLayout(): Promise<HomePageLayout> {
  const layout = await fetchLayoutJson(HOME_PAGE_LAYOUT_KEY, (raw) =>
    ensureManiaTourHomePageLayout(normalizeHomePageLayout(raw))
  )
  homeLayoutCache = layout
  // DB에 구형 섹션이 남아 있으면 GYG 기본 구성으로 정리해 저장
  await upsertLayoutJson(HOME_PAGE_LAYOUT_KEY, layout)
  return layout
}

async function fetchLayoutJson<T>(
  keyPath: string,
  normalize: (raw: unknown) => T
): Promise<T> {
  const { data, error } = await supabase
    .from('translations')
    .select(
      `
      key_path,
      translation_values (
        locale,
        value
      )
    `
    )
    .eq('namespace', CUSTOMER_PAGE_LAYOUTS_NAMESPACE)
    .eq('key_path', keyPath)
    .maybeSingle()

  if (error) throw error

  const values = (data?.translation_values ?? []) as Array<{ locale: string; value: unknown }>
  const raw = values.find((value) => value.locale === CUSTOMER_PAGE_LAYOUTS_LOCALE)?.value

  if (typeof raw !== 'string' || !raw.trim()) {
    return normalize(null)
  }

  try {
    return normalize(JSON.parse(raw))
  } catch {
    return normalize(null)
  }
}

async function upsertLayoutJson(keyPath: string, layout: unknown): Promise<void> {
  const { data: existingTrans, error: findError } = await supabase
    .from('translations')
    .select('id')
    .eq('namespace', CUSTOMER_PAGE_LAYOUTS_NAMESPACE)
    .eq('key_path', keyPath)
    .maybeSingle()

  if (findError) throw findError

  let translationId = existingTrans?.id as string | undefined

  if (!translationId) {
    const { data: inserted, error: insertTransError } = await supabase
      .from('translations')
      .insert({
        id: crypto.randomUUID(),
        namespace: CUSTOMER_PAGE_LAYOUTS_NAMESPACE,
        key_path: keyPath,
        is_system: true,
      })
      .select('id')
      .single()

    if (insertTransError) throw insertTransError
    translationId = inserted.id as string
  }

  const json = JSON.stringify(layout)

  const { data: existingValue, error: valueFindError } = await supabase
    .from('translation_values')
    .select('id')
    .eq('translation_id', translationId)
    .eq('locale', CUSTOMER_PAGE_LAYOUTS_LOCALE)
    .maybeSingle()

  if (valueFindError) throw valueFindError

  if (existingValue?.id) {
    const { error: updateError } = await supabase
      .from('translation_values')
      .update({ value: json, updated_at: new Date().toISOString() })
      .eq('id', existingValue.id)
    if (updateError) throw updateError
    return
  }

  const { error: insertValueError } = await supabase.from('translation_values').insert({
    id: crypto.randomUUID(),
    translation_id: translationId,
    locale: CUSTOMER_PAGE_LAYOUTS_LOCALE,
    value: json,
  })
  if (insertValueError) throw insertValueError
}

export async function persistCustomerPageHomeLayout(layout: HomePageLayout): Promise<void> {
  const normalized = ensureManiaTourHomePageLayout(normalizeHomePageLayout(layout))
  homeLayoutCache = normalized
  await upsertLayoutJson(HOME_PAGE_LAYOUT_KEY, normalized)
}

function getZoneLayoutCache(pageId: ZoneLayoutPageId): PageZoneLayout {
  if (!zoneLayoutCaches[pageId]) {
    zoneLayoutCaches[pageId] = buildDefaultPageZoneLayout(pageId)
  }
  return zoneLayoutCaches[pageId]!
}

export function loadCustomerPageZoneLayout(pageId: ZoneLayoutPageId): PageZoneLayout {
  return getZoneLayoutCache(pageId)
}

export function setCustomerPageZoneLayoutCache(
  pageId: ZoneLayoutPageId,
  layout: PageZoneLayout
): void {
  zoneLayoutCaches[pageId] = normalizePageZoneLayout(layout, pageId)
}

export async function fetchCustomerPageZoneLayout(
  pageId: ZoneLayoutPageId
): Promise<PageZoneLayout> {
  const layout = await fetchLayoutJson(pageId, (raw) =>
    normalizePageZoneLayout(raw, pageId)
  )
  zoneLayoutCaches[pageId] = layout
  return layout
}

export async function fetchAllCustomerPageZoneLayouts(): Promise<void> {
  await Promise.all(
    (
      [
        'products-listing',
        'products-tags',
        'reservation-check',
        'custom-tour',
        'product-detail',
        'product-booking',
      ] as const
    ).map((pageId) => fetchCustomerPageZoneLayout(pageId))
  )
}

export function loadCustomerPageListingCardLayout(): ListingCardLayout {
  return listingCardLayoutCache
}

export function setCustomerPageListingCardLayoutCache(layout: ListingCardLayout): void {
  listingCardLayoutCache = normalizeListingCardLayout(layout)
}

export async function fetchCustomerPageListingCardLayout(): Promise<ListingCardLayout> {
  const layout = await fetchLayoutJson(LISTING_CARD_LAYOUT_KEY, (raw) =>
    normalizeListingCardLayout(raw)
  )
  listingCardLayoutCache = layout
  return layout
}

export async function persistCustomerPageListingCardLayout(
  layout: ListingCardLayout
): Promise<void> {
  const normalized = normalizeListingCardLayout(layout)
  listingCardLayoutCache = normalized
  await upsertLayoutJson(LISTING_CARD_LAYOUT_KEY, normalized)
}

export async function persistCustomerPageZoneLayout(
  pageId: ZoneLayoutPageId,
  layout: PageZoneLayout
): Promise<void> {
  const normalized = normalizePageZoneLayout(layout, pageId)
  zoneLayoutCaches[pageId] = normalized
  await upsertLayoutJson(pageId, normalized)
}

export function customerPageLayoutKeyForPageId(pageId: CustomerPageId): string | null {
  if (pageId === 'home') return HOME_PAGE_LAYOUT_KEY
  if (pageSupportsZoneLayout(pageId)) return pageId
  return null
}
