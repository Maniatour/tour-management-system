import { HOME_DESTINATIONS } from '@/lib/homeDestinationData'
import {
  getHomeCategoryIllustration,
  HOME_CATEGORY_GRID_ITEMS,
} from '@/lib/homeCategoryGridData'
import { MANIATOUR_CTA_IMAGE } from '@/lib/maniatourHomeData'
import type { CategoryTagItem } from '@/components/home/homeSectionTypes'

export type HomeDestinationContentItem = {
  id: string
  labelKey?: string
  labelKo?: string
  labelEn?: string
  tagQuery: string
  imageUrl: string
}

export type HomeAdventureContentItem = {
  id: string
  labelKey?: string
  labelKo?: string
  labelEn?: string
  tagQuery: string
  imageUrl?: string
}

export type CustomerPageHomeContent = {
  heroImageUrl: string | null
  popularProductIds: string[]
  destinations: HomeDestinationContentItem[]
  adventureCategories: HomeAdventureContentItem[]
}

export const DEFAULT_CUSTOMER_PAGE_HOME_CONTENT: CustomerPageHomeContent = {
  heroImageUrl: MANIATOUR_CTA_IMAGE,
  popularProductIds: [],
  destinations: HOME_DESTINATIONS.map((destination) => ({
    id: destination.id,
    labelKey: destination.labelKey,
    tagQuery: destination.tagQuery,
    imageUrl: destination.imageUrl,
  })),
  adventureCategories: HOME_CATEGORY_GRID_ITEMS.map((item) => {
    const id = item.labelKey ?? item.tagQuery
    const entry: HomeAdventureContentItem = {
      id,
      tagQuery: item.tagQuery,
    }
    if (item.labelKey) {
      entry.labelKey = item.labelKey
      const illustration = getHomeCategoryIllustration(item.labelKey)
      if (illustration) entry.imageUrl = illustration
    }
    return entry
  }),
}

function normalizeDestinationItem(raw: unknown): HomeDestinationContentItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = typeof item.id === 'string' ? item.id.trim() : ''
  const tagQuery = typeof item.tagQuery === 'string' ? item.tagQuery.trim() : ''
  const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : ''
  if (!id || !tagQuery || !imageUrl) return null

  return {
    id,
    tagQuery,
    imageUrl,
    ...(typeof item.labelKey === 'string' && item.labelKey.trim()
      ? { labelKey: item.labelKey.trim() }
      : {}),
    ...(typeof item.labelKo === 'string' && item.labelKo.trim()
      ? { labelKo: item.labelKo.trim() }
      : {}),
    ...(typeof item.labelEn === 'string' && item.labelEn.trim()
      ? { labelEn: item.labelEn.trim() }
      : {}),
  }
}

function normalizeAdventureItem(raw: unknown): HomeAdventureContentItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = typeof item.id === 'string' ? item.id.trim() : ''
  const tagQuery = typeof item.tagQuery === 'string' ? item.tagQuery.trim() : ''
  if (!id || !tagQuery) return null

  return {
    id,
    tagQuery,
    ...(typeof item.labelKey === 'string' && item.labelKey.trim()
      ? { labelKey: item.labelKey.trim() }
      : {}),
    ...(typeof item.labelKo === 'string' && item.labelKo.trim()
      ? { labelKo: item.labelKo.trim() }
      : {}),
    ...(typeof item.labelEn === 'string' && item.labelEn.trim()
      ? { labelEn: item.labelEn.trim() }
      : {}),
    ...(typeof item.imageUrl === 'string' && item.imageUrl.trim()
      ? { imageUrl: item.imageUrl.trim() }
      : {}),
  }
}

export function normalizeCustomerPageHomeContent(raw: unknown): CustomerPageHomeContent {
  const defaults = DEFAULT_CUSTOMER_PAGE_HOME_CONTENT
  if (!raw || typeof raw !== 'object') {
    return {
      ...defaults,
      destinations: [...defaults.destinations],
      adventureCategories: [...defaults.adventureCategories],
    }
  }

  const value = raw as Partial<CustomerPageHomeContent>
  const heroImageUrl =
    typeof value.heroImageUrl === 'string' && value.heroImageUrl.trim()
      ? value.heroImageUrl.trim()
      : defaults.heroImageUrl

  const popularProductIds = Array.isArray(value.popularProductIds)
    ? value.popularProductIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    : defaults.popularProductIds

  const destinations = Array.isArray(value.destinations)
    ? value.destinations
        .map((item) => normalizeDestinationItem(item))
        .filter((item): item is HomeDestinationContentItem => item != null)
    : defaults.destinations

  const adventureCategories = Array.isArray(value.adventureCategories)
    ? value.adventureCategories
        .map((item) => normalizeAdventureItem(item))
        .filter((item): item is HomeAdventureContentItem => item != null)
    : defaults.adventureCategories

  return {
    heroImageUrl,
    popularProductIds,
    destinations: resolveHomeDestinationsForDisplay(
      destinations.length > 0 ? destinations : defaults.destinations
    ),
    adventureCategories:
      adventureCategories.length > 0 ? adventureCategories : defaults.adventureCategories,
  }
}

export function getHomeDestinationLabel(
  destination: HomeDestinationContentItem,
  locale: string,
  t: (key: string) => string
): string {
  if (locale === 'en') {
    return destination.labelEn || (destination.labelKey ? t(destination.labelKey) : destination.labelKo || '')
  }
  return destination.labelKo || (destination.labelKey ? t(destination.labelKey) : destination.labelEn || '')
}

export function getHomeAdventureLabel(
  item: HomeAdventureContentItem,
  locale: string,
  t: (key: string) => string
): string {
  if (locale === 'en') {
    return item.labelEn || (item.labelKey ? t(item.labelKey) : item.labelKo || '')
  }
  return item.labelKo || (item.labelKey ? t(item.labelKey) : item.labelEn || '')
}

export function createEmptyHomeAdventure(index: number): HomeAdventureContentItem {
  return {
    id: `adventure-${Date.now()}-${index}`,
    labelKo: '',
    labelEn: '',
    tagQuery: '',
    imageUrl: '',
  }
}

export function buildHomeAdventureGridItems(
  locale: string,
  t: (key: string) => string,
  content: CustomerPageHomeContent = DEFAULT_CUSTOMER_PAGE_HOME_CONTENT
): CategoryTagItem[] {
  const items =
    content.adventureCategories.length > 0
      ? content.adventureCategories
      : DEFAULT_CUSTOMER_PAGE_HOME_CONTENT.adventureCategories

  return items.map((item) => {
    const gridItem: CategoryTagItem = {
      id: item.id,
      tagQuery: item.tagQuery,
      label: getHomeAdventureLabel(item, locale, t),
    }
    if (item.labelKey) gridItem.labelKey = item.labelKey
    const imageUrl =
      item.imageUrl ||
      (item.labelKey ? getHomeCategoryIllustration(item.labelKey) ?? undefined : undefined)
    if (imageUrl) gridItem.imageUrl = imageUrl
    return gridItem
  })
}

export function createEmptyHomeDestination(index: number): HomeDestinationContentItem {
  return {
    id: `destination-${Date.now()}-${index}`,
    labelKo: '',
    labelEn: '',
    tagQuery: '',
    imageUrl: '',
  }
}

const HOME_DESTINATION_BY_ID = new Map(HOME_DESTINATIONS.map((destination) => [destination.id, destination]))

/** Admin에서 직접 업로드한 이미지만 persisted URL 유지 */
export function isCustomHomeDestinationImage(imageUrl: string): boolean {
  const trimmed = imageUrl.trim()
  if (!trimmed) return false
  return trimmed.includes('supabase.co/storage') || trimmed.includes('/customer-page/')
}

/** 해당 목적지 id 폴더에 업로드된 이미지만 커스텀으로 인정 */
export function isDestinationScopedCustomUpload(imageUrl: string, destinationId: string): boolean {
  const trimmed = imageUrl.trim()
  const id = destinationId.trim()
  if (!trimmed || !id) return false

  const folder = `customer-page/destinations/${id}/`
  const encodedFolder = `customer-page%2Fdestinations%2F${encodeURIComponent(id)}%2F`
  return trimmed.includes(folder) || trimmed.includes(encodedFolder)
}

export function resolveHomeDestinationImageUrl(item: HomeDestinationContentItem): string {
  const canonical = HOME_DESTINATION_BY_ID.get(item.id)
  if (!canonical) return item.imageUrl

  if (
    isCustomHomeDestinationImage(item.imageUrl) &&
    isDestinationScopedCustomUpload(item.imageUrl, item.id)
  ) {
    return item.imageUrl
  }

  return canonical.imageUrl
}

export function resolveHomeDestinationsForDisplay(
  configured: HomeDestinationContentItem[]
): HomeDestinationContentItem[] {
  const configuredById = new Map(
    (configured.length > 0 ? configured : DEFAULT_CUSTOMER_PAGE_HOME_CONTENT.destinations).map(
      (item) => [item.id, item]
    )
  )

  return HOME_DESTINATIONS.map((canonical) => {
    const item = configuredById.get(canonical.id)
    if (!item) {
      return {
        id: canonical.id,
        labelKey: canonical.labelKey,
        tagQuery: canonical.tagQuery,
        imageUrl: canonical.imageUrl,
      }
    }

    return {
      ...item,
      labelKey: item.labelKey ?? canonical.labelKey,
      tagQuery: item.tagQuery || canonical.tagQuery,
      imageUrl: resolveHomeDestinationImageUrl(item),
    }
  })
}
