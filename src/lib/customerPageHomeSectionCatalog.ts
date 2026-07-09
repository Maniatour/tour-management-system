import type { BasicFieldKey } from '@/lib/customerPageZoneEditMap'
import { DEFAULT_HOME_PAGE_STRUCTURE, type HomePageStructure } from '@/lib/customerPageHomeStructure'

export type HomeSectionKind =
  | 'hero'
  | 'categories'
  | 'stats'
  | 'card-list'
  | 'features'
  | 'cta'
  | 'reviews'
  | 'faq'
  | 'gallery'
  | 'logos'
  | 'video'
  | 'newsletter'
  | 'promo'
  | 'rich-text'

export type HomeSectionProductQuery = 'favorites' | 'recent' | 'category' | 'tag' | 'all'

export type HomeSectionCardFieldSlot =
  | 'image'
  | 'title'
  | 'description'
  | 'price'
  | 'location'
  | 'category'

export type HomeSectionConfig = {
  cardCount?: number
  itemCount?: number
  productQuery?: HomeSectionProductQuery
  tagFilter?: string
  categoryFilter?: string
  cardFieldBindings?: Partial<Record<HomeSectionCardFieldSlot, BasicFieldKey>>
  structureVariant?: string
  uiPresetId?: string
  title?: string
}

export type HomePageSectionEntry = {
  instanceId: string
  kind: HomeSectionKind
  visible: boolean
  config: HomeSectionConfig
}

export type HomeSectionCatalogItem = {
  kind: HomeSectionKind
  label: string
  description: string
  icon: string
  allowMultiple: boolean
  defaultConfig: HomeSectionConfig
  structureVariants: Array<{ id: string; label: string }>
}

export const HOME_SECTION_CARD_FIELD_SLOTS: Array<{
  slot: HomeSectionCardFieldSlot
  label: string
  defaultField: BasicFieldKey
  options: BasicFieldKey[]
}> = [
  {
    slot: 'title',
    label: '카드 제목',
    defaultField: 'customerNameKo',
    options: ['customerNameKo', 'customerNameEn', 'internalNameKo', 'internalNameEn'],
  },
  {
    slot: 'description',
    label: '카드 설명',
    defaultField: 'summaryKo',
    options: ['summaryKo', 'summaryEn', 'description'],
  },
  {
    slot: 'price',
    label: '가격',
    defaultField: 'adultBasePrice',
    options: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
  },
  {
    slot: 'location',
    label: '출발지',
    defaultField: 'departureCityKo',
    options: [
      'departureCityKo',
      'departureCityEn',
      'departureCity',
      'departureCountryKo',
      'arrivalCityKo',
    ],
  },
]

export const HOME_SECTION_PRODUCT_QUERY_OPTIONS: Array<{
  id: HomeSectionProductQuery
  label: string
  description: string
}> = [
  { id: 'favorites', label: '즐겨찾기 투어', description: '관리자가 지정한 인기 순서' },
  { id: 'recent', label: '최신 등록', description: '최근 등록된 활성 상품' },
  { id: 'category', label: '카테고리 필터', description: '특정 카테고리 상품만' },
  { id: 'tag', label: '태그 필터', description: '태그가 포함된 상품' },
  { id: 'all', label: '전체 활성 상품', description: '활성 상품 전체' },
]

export const HOME_SECTION_CATALOG: HomeSectionCatalogItem[] = [
  {
    kind: 'hero',
    label: '히어로 배너',
    description: '메인 타이틀·CTA',
    icon: '🎯',
    allowMultiple: false,
    defaultConfig: { structureVariant: 'centered-classic', uiPresetId: 'default' },
    structureVariants: [
      { id: 'centered-classic', label: '중앙 히어로' },
      { id: 'split-editorial', label: '2단 분할' },
      { id: 'left-minimal', label: '좌측 미니멀' },
      { id: 'full-immersive', label: '풀스크린' },
      { id: 'compact-bar', label: '컴팩트 바' },
    ],
  },
  {
    kind: 'categories',
    label: '카테고리 탐색',
    description: '태그·카테고리 그리드',
    icon: '🗂️',
    allowMultiple: false,
    defaultConfig: { structureVariant: 'grid-icons', uiPresetId: 'default' },
    structureVariants: [
      { id: 'grid-icons', label: '아이콘 그리드' },
      { id: 'horizontal-scroll', label: '가로 스크롤' },
      { id: 'large-tiles', label: '대형 타일' },
      { id: 'compact-pills', label: '필 태그' },
      { id: 'bento-asymmetric', label: '벤토 그리드' },
    ],
  },
  {
    kind: 'stats',
    label: '신뢰 지표',
    description: '고객 수·평점 등',
    icon: '📊',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'grid-four', uiPresetId: 'default' },
    structureVariants: [
      { id: 'grid-four', label: '4열 그리드' },
      { id: 'inline-strip', label: '인라인 스트립' },
      { id: 'card-row', label: '카드 행' },
      { id: 'highlight-band', label: '강조 밴드' },
    ],
  },
  {
    kind: 'card-list',
    label: '카드 목록',
    description: '상품 카드 그리드·리스트',
    icon: '🃏',
    allowMultiple: true,
    defaultConfig: {
      structureVariant: 'grid-three',
      uiPresetId: 'default',
      cardCount: 3,
      productQuery: 'favorites',
      cardFieldBindings: {
        title: 'customerNameKo',
        description: 'summaryKo',
        price: 'adultBasePrice',
        location: 'departureCityKo',
      },
    },
    structureVariants: [
      { id: 'grid-three', label: '3열 카드' },
      { id: 'grid-two-large', label: '2열 대형' },
      { id: 'horizontal-scroll', label: '가로 스크롤' },
      { id: 'featured-plus-grid', label: '피처드+그리드' },
      { id: 'stacked-list', label: '리스트형' },
    ],
  },
  {
    kind: 'features',
    label: '서비스 강점',
    description: '차별점·특징 소개',
    icon: '✨',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'grid-two-text', uiPresetId: 'default' },
    structureVariants: [
      { id: 'grid-two-text', label: '2열 텍스트' },
      { id: 'card-grid-four', label: '4카드' },
      { id: 'alternating-rows', label: '지그재그' },
      { id: 'icon-row', label: '아이콘 행' },
    ],
  },
  {
    kind: 'cta',
    label: 'CTA 배너',
    description: '예약·문의 유도',
    icon: '🚀',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'centered-classic', uiPresetId: 'default' },
    structureVariants: [
      { id: 'centered-classic', label: '중앙 CTA' },
      { id: 'split-actions', label: '좌우 분할' },
      { id: 'full-band', label: '풀 밴드' },
      { id: 'inline-minimal', label: '인라인' },
    ],
  },
  {
    kind: 'reviews',
    label: '고객 후기',
    description: '리뷰·평점·인용문',
    icon: '⭐',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'card-grid', uiPresetId: 'default', itemCount: 3 },
    structureVariants: [
      { id: 'card-grid', label: '카드 그리드' },
      { id: 'carousel-strip', label: '가로 스크롤' },
      { id: 'featured-quote', label: '대형 인용' },
      { id: 'masonry-mix', label: '믹스 masonry' },
    ],
  },
  {
    kind: 'faq',
    label: 'FAQ',
    description: '자주 묻는 질문',
    icon: '❓',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'accordion', uiPresetId: 'default', itemCount: 5 },
    structureVariants: [
      { id: 'accordion', label: '아코디언' },
      { id: 'two-column', label: '2열 분할' },
      { id: 'compact-list', label: '컴팩트 리스트' },
    ],
  },
  {
    kind: 'gallery',
    label: '갤러리',
    description: '여행 사진·비주얼 그리드',
    icon: '🖼️',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'grid-four', uiPresetId: 'default', itemCount: 6 },
    structureVariants: [
      { id: 'grid-four', label: '4열 그리드' },
      { id: 'masonry', label: '메이슨리' },
      { id: 'horizontal-scroll', label: '가로 스크롤' },
      { id: 'featured-plus-grid', label: '대형+그리드' },
    ],
  },
  {
    kind: 'logos',
    label: '파트너 로고',
    description: '신뢰·제휴사 로고',
    icon: '🤝',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'row-scroll', uiPresetId: 'default', itemCount: 6 },
    structureVariants: [
      { id: 'row-scroll', label: '가로 스크롤' },
      { id: 'grid-six', label: '6열 그리드' },
      { id: 'muted-strip', label: '뮤트 스트립' },
    ],
  },
  {
    kind: 'video',
    label: '영상 소개',
    description: '프로모 영상·임베드',
    icon: '🎬',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'centered', uiPresetId: 'default' },
    structureVariants: [
      { id: 'centered', label: '중앙 영상' },
      { id: 'split-text', label: '텍스트 분할' },
      { id: 'full-width', label: '풀 너비' },
    ],
  },
  {
    kind: 'newsletter',
    label: '뉴스레터',
    description: '이메일 구독·리드 수집',
    icon: '📬',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'centered', uiPresetId: 'default' },
    structureVariants: [
      { id: 'centered', label: '중앙 폼' },
      { id: 'split-image', label: '2단 분할' },
      { id: 'inline-bar', label: '인라인 바' },
    ],
  },
  {
    kind: 'promo',
    label: '프로모 배너',
    description: '할인·이벤트 강조',
    icon: '🏷️',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'full-band', uiPresetId: 'default' },
    structureVariants: [
      { id: 'full-band', label: '풀 밴드' },
      { id: 'split-cta', label: '좌우 분할' },
      { id: 'countdown-style', label: '카운트다운형' },
    ],
  },
  {
    kind: 'rich-text',
    label: '콘텐츠 블록',
    description: '제목·본문·이미지',
    icon: '📝',
    allowMultiple: true,
    defaultConfig: { structureVariant: 'centered-prose', uiPresetId: 'default' },
    structureVariants: [
      { id: 'centered-prose', label: '중앙 본문' },
      { id: 'split-media', label: '미디어 분할' },
      { id: 'highlight-box', label: '강조 박스' },
    ],
  },
]

export type BuiltinHomeSectionId =
  | 'home-hero'
  | 'home-categories'
  | 'home-stats'
  | 'home-popular'
  | 'home-features'
  | 'home-cta'

export const LEGACY_HOME_SECTION_ID_TO_KIND: Record<BuiltinHomeSectionId, HomeSectionKind> = {
  'home-hero': 'hero',
  'home-categories': 'categories',
  'home-stats': 'stats',
  'home-popular': 'card-list',
  'home-features': 'features',
  'home-cta': 'cta',
}

export const BUILTIN_INSTANCE_IDS = Object.keys(
  LEGACY_HOME_SECTION_ID_TO_KIND
) as BuiltinHomeSectionId[]

export function getCatalogItem(kind: HomeSectionKind): HomeSectionCatalogItem {
  return HOME_SECTION_CATALOG.find((item) => item.kind === kind) ?? HOME_SECTION_CATALOG[0]
}

export function getSectionKindLabel(kind: HomeSectionKind): string {
  return getCatalogItem(kind).label
}

export function createHomeSectionEntry(
  kind: HomeSectionKind,
  existingSections: HomePageSectionEntry[]
): HomePageSectionEntry {
  const catalog = getCatalogItem(kind)
  const builtinId = BUILTIN_INSTANCE_IDS.find(
    (id) => LEGACY_HOME_SECTION_ID_TO_KIND[id] === kind
  )
  const builtinTaken =
    builtinId != null && existingSections.some((s) => s.instanceId === builtinId)

  const suffix = crypto.randomUUID().slice(0, 8)
  const useBuiltin = !catalog.allowMultiple && builtinId != null && !builtinTaken
  const instanceId = useBuiltin
    ? builtinId
    : kind === 'card-list'
      ? `home-cards-${suffix}`
      : `home-${kind}-${suffix}`

  const config: HomeSectionConfig = { ...catalog.defaultConfig }
  if (catalog.defaultConfig.cardFieldBindings) {
    config.cardFieldBindings = { ...catalog.defaultConfig.cardFieldBindings }
  }

  return {
    instanceId,
    kind,
    visible: true,
    config,
  }
}

export function normalizeHomeSectionConfig(raw: unknown, kind: HomeSectionKind): HomeSectionConfig {
  const catalog = getCatalogItem(kind)
  const defaults = catalog.defaultConfig
  if (!raw || typeof raw !== 'object') return { ...defaults }

  const o = raw as Partial<HomeSectionConfig>
  const cardCount =
    typeof o.cardCount === 'number'
      ? Math.min(12, Math.max(1, Math.round(o.cardCount)))
      : defaults.cardCount

  const itemCount =
    typeof o.itemCount === 'number'
      ? Math.min(12, Math.max(1, Math.round(o.itemCount)))
      : defaults.itemCount

  const productQuery =
    o.productQuery && HOME_SECTION_PRODUCT_QUERY_OPTIONS.some((q) => q.id === o.productQuery)
      ? o.productQuery
      : defaults.productQuery

  const structureVariant =
    o.structureVariant &&
    catalog.structureVariants.some((variant) => variant.id === o.structureVariant)
      ? o.structureVariant
      : defaults.structureVariant

  const mergedBindings =
    o.cardFieldBindings && typeof o.cardFieldBindings === 'object'
      ? { ...defaults.cardFieldBindings, ...o.cardFieldBindings }
      : defaults.cardFieldBindings
        ? { ...defaults.cardFieldBindings }
        : null

  const config: HomeSectionConfig = {}

  if (cardCount != null) config.cardCount = cardCount
  if (itemCount != null) config.itemCount = itemCount
  if (productQuery) config.productQuery = productQuery
  if (structureVariant) config.structureVariant = structureVariant
  config.uiPresetId = typeof o.uiPresetId === 'string' ? o.uiPresetId : defaults.uiPresetId ?? 'default'

  const tagFilter = typeof o.tagFilter === 'string' ? o.tagFilter : defaults.tagFilter
  const categoryFilter =
    typeof o.categoryFilter === 'string' ? o.categoryFilter : defaults.categoryFilter
  const title = typeof o.title === 'string' ? o.title : defaults.title

  if (tagFilter) config.tagFilter = tagFilter
  if (categoryFilter) config.categoryFilter = categoryFilter
  if (title) config.title = title
  if (mergedBindings) config.cardFieldBindings = mergedBindings

  return config
}

export function getGlobalStructureVariantForKind(
  kind: HomeSectionKind,
  global: HomePageStructure
): string {
  switch (kind) {
    case 'hero':
      return global.hero
    case 'categories':
      return global.categories
    case 'stats':
      return global.stats
    case 'card-list':
      return global.popular
    case 'features':
      return global.features
    case 'cta':
      return global.cta
    default:
      return DEFAULT_HOME_PAGE_STRUCTURE.hero
  }
}

export function resolveSectionStructureVariant(
  section: HomePageSectionEntry,
  globalStructure: HomePageStructure
): string {
  return (
    section.config.structureVariant ??
    getGlobalStructureVariantForKind(section.kind, globalStructure)
  )
}

export function applyGlobalStructureToSections(
  sections: HomePageSectionEntry[],
  globalStructure: HomePageStructure
): HomePageSectionEntry[] {
  return sections.map((section) => ({
    ...section,
    config: {
      ...section.config,
      structureVariant:
        section.config.structureVariant ??
        getGlobalStructureVariantForKind(section.kind, globalStructure),
    },
  }))
}

export function getSectionDisplayLabel(section: HomePageSectionEntry): string {
  if (section.config.title?.trim()) return section.config.title.trim()
  if (section.instanceId in LEGACY_HOME_SECTION_ID_TO_KIND) {
    return getSectionKindLabel(section.kind)
  }
  return `${getSectionKindLabel(section.kind)} · ${section.instanceId.replace('home-cards-', '')}`
}

export function applyTemplateStructureToSections(
  sections: HomePageSectionEntry[],
  globalStructure: HomePageStructure
): HomePageSectionEntry[] {
  return sections.map((section) => ({
    ...section,
    config: {
      ...section.config,
      structureVariant: getGlobalStructureVariantForKind(section.kind, globalStructure),
    },
  }))
}

export function getBuiltinZoneId(section: HomePageSectionEntry): string {
  if (section.instanceId in LEGACY_HOME_SECTION_ID_TO_KIND) return section.instanceId
  if (section.kind === 'card-list') return 'home-popular'
  const map: Partial<Record<HomeSectionKind, string>> = {
    hero: 'home-hero',
    categories: 'home-categories',
    stats: 'home-stats',
    features: 'home-features',
    cta: 'home-cta',
    reviews: 'home-reviews',
    faq: 'home-faq',
    gallery: 'home-gallery',
    logos: 'home-logos',
    video: 'home-video',
    newsletter: 'home-newsletter',
    promo: 'home-promo',
    'rich-text': 'home-rich-text',
  }
  return map[section.kind] ?? section.instanceId
}
