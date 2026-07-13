export const PRODUCT_LISTING_RIBBON_TAG_PREFIX = 'listing-ribbon:'

/** @deprecated legacy explicit show tag */
export const PRODUCT_LISTING_RIBBON_SHOW_TAG = 'likely-to-sell-out'
/** @deprecated legacy explicit hide tag */
export const PRODUCT_LISTING_RIBBON_HIDE_TAG = 'hide-likely-to-sell-out'

const SMALL_GROUP_MAX_PARTICIPANTS = 20

export type ProductListingRibbonId =
  | 'likely-to-sell-out'
  | 'best-seller'
  | 'popular'
  | 'best'
  | 'new'
  | 'best-value'

export type ProductListingRibbonSelection = 'auto' | 'none' | ProductListingRibbonId

export type ProductListingRibbonOption = {
  id: ProductListingRibbonSelection
  labelKey: string
  variant?: ProductListingRibbonId
}

export const PRODUCT_LISTING_RIBBON_OPTIONS: ProductListingRibbonOption[] = [
  { id: 'auto', labelKey: 'listingRibbonAuto' },
  { id: 'none', labelKey: 'listingRibbonNone' },
  { id: 'likely-to-sell-out', labelKey: 'likelyToSellOut', variant: 'likely-to-sell-out' },
  { id: 'best-seller', labelKey: 'maniatourBadgeBestSeller', variant: 'best-seller' },
  { id: 'popular', labelKey: 'maniatourBadgePopular', variant: 'popular' },
  { id: 'best', labelKey: 'maniatourBadgeBest', variant: 'best' },
  { id: 'new', labelKey: 'maniatourBadgeNew', variant: 'new' },
  { id: 'best-value', labelKey: 'maniatourBadgeBestValue', variant: 'best-value' },
]

const RIBBON_IDS = new Set<ProductListingRibbonId>(
  PRODUCT_LISTING_RIBBON_OPTIONS.filter(
    (option): option is ProductListingRibbonOption & { id: ProductListingRibbonId } =>
      option.id !== 'auto' && option.id !== 'none'
  ).map((option) => option.id)
)

type RibbonProduct = {
  max_participants?: number | null
  tags?: string[] | null
}

export type ResolvedProductListingRibbon = {
  id: ProductListingRibbonId
  variant: ProductListingRibbonId
  source: 'explicit' | 'legacy' | 'auto'
}

function isRibbonId(value: string): value is ProductListingRibbonId {
  return RIBBON_IDS.has(value as ProductListingRibbonId)
}

function stripListingRibbonTags(tags: string[]): string[] {
  return tags.filter((tag) => {
    if (tag === PRODUCT_LISTING_RIBBON_SHOW_TAG) return false
    if (tag === PRODUCT_LISTING_RIBBON_HIDE_TAG) return false
    if (tag.startsWith(PRODUCT_LISTING_RIBBON_TAG_PREFIX)) return false
    return true
  })
}

function getExplicitRibbonFromTags(tags: string[]): ProductListingRibbonId | 'none' | null {
  const prefixed = tags
    .filter((tag) => tag.startsWith(PRODUCT_LISTING_RIBBON_TAG_PREFIX))
    .map((tag) => tag.slice(PRODUCT_LISTING_RIBBON_TAG_PREFIX.length))

  if (prefixed.includes('none')) return 'none'
  const explicit = prefixed.find(isRibbonId)
  return explicit ?? null
}

export function getProductListingRibbonSelection(product: RibbonProduct): ProductListingRibbonSelection {
  const tags = product.tags ?? []

  if (tags.includes(PRODUCT_LISTING_RIBBON_HIDE_TAG)) return 'none'

  const explicit = getExplicitRibbonFromTags(tags)
  if (explicit === 'none') return 'none'
  if (explicit) return explicit

  if (tags.includes(PRODUCT_LISTING_RIBBON_SHOW_TAG)) return 'likely-to-sell-out'

  return 'auto'
}

export function resolveProductListingRibbon(product: RibbonProduct): ResolvedProductListingRibbon | null {
  const tags = product.tags ?? []
  const selection = getProductListingRibbonSelection(product)

  if (selection === 'none') return null

  if (selection !== 'auto') {
    return {
      id: selection,
      variant: selection,
      source: tags.includes(`${PRODUCT_LISTING_RIBBON_TAG_PREFIX}${selection}`)
        ? 'explicit'
        : 'legacy',
    }
  }

  if (product.max_participants != null && product.max_participants <= SMALL_GROUP_MAX_PARTICIPANTS) {
    return {
      id: 'likely-to-sell-out',
      variant: 'likely-to-sell-out',
      source: 'auto',
    }
  }

  return null
}

/** @deprecated use resolveProductListingRibbon instead */
export function hasProductListingSelloutRibbon(product: RibbonProduct): boolean {
  return resolveProductListingRibbon(product)?.id === 'likely-to-sell-out'
}

export function getProductListingRibbonLabelKey(id: ProductListingRibbonId): string {
  return PRODUCT_LISTING_RIBBON_OPTIONS.find((option) => option.id === id)?.labelKey ?? 'likelyToSellOut'
}

export function applyProductListingRibbonSelection(
  currentTags: string[] | null | undefined,
  selection: ProductListingRibbonSelection
): string[] {
  const cleaned = stripListingRibbonTags(currentTags ?? [])

  if (selection === 'auto') return cleaned
  if (selection === 'none') return [...cleaned, `${PRODUCT_LISTING_RIBBON_TAG_PREFIX}none`]

  return [...cleaned, `${PRODUCT_LISTING_RIBBON_TAG_PREFIX}${selection}`]
}

/** @deprecated use applyProductListingRibbonSelection instead */
export function getNextProductListingRibbonTags(
  currentTags: string[] | null | undefined,
  product: RibbonProduct
): string[] {
  const resolved = resolveProductListingRibbon(product)
  return applyProductListingRibbonSelection(currentTags, resolved ? 'none' : 'likely-to-sell-out')
}

export function getProductListingRibbonVariantClass(variant: ProductListingRibbonId): string {
  return `gyg-listing-ribbon gyg-listing-ribbon--${variant}`
}
