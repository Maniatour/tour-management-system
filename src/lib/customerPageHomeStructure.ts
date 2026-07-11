import type { HomeSectionId } from '@/lib/customerPageHomeLayout'

export type HeroStructureVariant =
  | 'centered-classic'
  | 'split-editorial'
  | 'left-minimal'
  | 'full-immersive'
  | 'compact-bar'
  | 'search-discovery'

export type CategoriesStructureVariant =
  | 'grid-icons'
  | 'horizontal-scroll'
  | 'large-tiles'
  | 'compact-pills'
  | 'bento-asymmetric'
  | 'destination-cities'

export type StatsStructureVariant =
  | 'grid-four'
  | 'inline-strip'
  | 'card-row'
  | 'highlight-band'

export type PopularStructureVariant =
  | 'grid-three'
  | 'grid-two-large'
  | 'horizontal-scroll'
  | 'featured-plus-grid'
  | 'stacked-list'
  | 'attraction-cards'
  | 'activity-cards'

export type FeaturesStructureVariant =
  | 'grid-two-text'
  | 'card-grid-four'
  | 'alternating-rows'
  | 'icon-row'

export type CtaStructureVariant =
  | 'centered-classic'
  | 'split-actions'
  | 'full-band'
  | 'inline-minimal'

export type HomePageStructure = {
  hero: HeroStructureVariant
  categories: CategoriesStructureVariant
  stats: StatsStructureVariant
  popular: PopularStructureVariant
  features: FeaturesStructureVariant
  cta: CtaStructureVariant
}

export const DEFAULT_HOME_PAGE_STRUCTURE: HomePageStructure = {
  hero: 'search-discovery',
  categories: 'destination-cities',
  stats: 'grid-four',
  popular: 'attraction-cards',
  features: 'grid-two-text',
  cta: 'centered-classic',
}

export const HOME_STRUCTURE_LABELS: Record<
  keyof HomePageStructure,
  Record<string, string>
> = {
  hero: {
    'centered-classic': '중앙 히어로',
    'split-editorial': '2단 분할',
    'left-minimal': '좌측 미니멀',
    'full-immersive': '풀스크린',
    'compact-bar': '컴팩트 바',
    'search-discovery': '검색 히어로',
  },
  categories: {
    'grid-icons': '아이콘 그리드',
    'horizontal-scroll': '가로 스크롤',
    'large-tiles': '대형 타일',
    'compact-pills': '필 태그',
    'bento-asymmetric': '벤토 그리드',
    'destination-cities': '목적지 도시',
  },
  stats: {
    'grid-four': '4열 그리드',
    'inline-strip': '인라인 스트립',
    'card-row': '카드 행',
    'highlight-band': '강조 밴드',
  },
  popular: {
    'grid-three': '3열 카드',
    'grid-two-large': '2열 대형',
    'horizontal-scroll': '가로 스크롤',
    'featured-plus-grid': '피처드+그리드',
    'stacked-list': '리스트형',
    'attraction-cards': '명소 카드',
    'activity-cards': '액티비티 카드',
  },
  features: {
    'grid-two-text': '2열 텍스트',
    'card-grid-four': '4카드',
    'alternating-rows': '지그재그',
    'icon-row': '아이콘 행',
  },
  cta: {
    'centered-classic': '중앙 CTA',
    'split-actions': '좌우 분할',
    'full-band': '풀 밴드',
    'inline-minimal': '인라인',
  },
}

export function getStructureSummary(structure: HomePageStructure): string[] {
  return (Object.keys(structure) as Array<keyof HomePageStructure>).map(
    (key) => HOME_STRUCTURE_LABELS[key][structure[key]] ?? structure[key]
  )
}

export function structuresEqual(a: HomePageStructure, b: HomePageStructure): boolean {
  return (
    a.hero === b.hero &&
    a.categories === b.categories &&
    a.stats === b.stats &&
    a.popular === b.popular &&
    a.features === b.features &&
    a.cta === b.cta
  )
}

let activeHomeStructure: HomePageStructure = { ...DEFAULT_HOME_PAGE_STRUCTURE }

export function setActiveHomePageStructure(structure: HomePageStructure): void {
  activeHomeStructure = { ...structure }
}

export function getActiveHomePageStructure(): HomePageStructure {
  return activeHomeStructure
}

export function normalizeHomePageStructure(raw: unknown): HomePageStructure {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_HOME_PAGE_STRUCTURE }
  }
  const o = raw as Partial<HomePageStructure>
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fallback

  return {
    hero: pick(o.hero, ['centered-classic', 'split-editorial', 'left-minimal', 'full-immersive', 'compact-bar', 'search-discovery'], DEFAULT_HOME_PAGE_STRUCTURE.hero),
    categories: pick(o.categories, ['grid-icons', 'horizontal-scroll', 'large-tiles', 'compact-pills', 'bento-asymmetric', 'destination-cities'], DEFAULT_HOME_PAGE_STRUCTURE.categories),
    stats: pick(o.stats, ['grid-four', 'inline-strip', 'card-row', 'highlight-band'], DEFAULT_HOME_PAGE_STRUCTURE.stats),
    popular: pick(o.popular, ['grid-three', 'grid-two-large', 'horizontal-scroll', 'featured-plus-grid', 'stacked-list', 'attraction-cards', 'activity-cards'], DEFAULT_HOME_PAGE_STRUCTURE.popular),
    features: pick(o.features, ['grid-two-text', 'card-grid-four', 'alternating-rows', 'icon-row'], DEFAULT_HOME_PAGE_STRUCTURE.features),
    cta: pick(o.cta, ['centered-classic', 'split-actions', 'full-band', 'inline-minimal'], DEFAULT_HOME_PAGE_STRUCTURE.cta),
  }
}

/** 템플릿 미리보기용 — 섹션별 레이아웃 스켈레톤 */
export function structureSkeletonHeights(structure: HomePageStructure): number[] {
  const heroH =
    structure.hero === 'full-immersive' ? 28 : structure.hero === 'compact-bar' ? 10 : 18
  const catH =
    structure.categories === 'horizontal-scroll' ? 12 : structure.categories === 'bento-asymmetric' ? 20 : 14
  const statsH = structure.stats === 'highlight-band' ? 8 : 10
  const popH =
    structure.popular === 'horizontal-scroll' ? 16 : structure.popular === 'stacked-list' ? 18 : 14
  const featH = structure.features === 'card-grid-four' ? 12 : 10
  const ctaH = structure.cta === 'full-band' ? 12 : 8
  return [heroH, catH, statsH, popH, featH, ctaH]
}

export const HOME_STRUCTURE_SECTION_KEYS: Array<keyof HomePageStructure> = [
  'hero',
  'categories',
  'stats',
  'popular',
  'features',
  'cta',
]

export function mapStructureKeyToSectionId(key: keyof HomePageStructure): HomeSectionId {
  const map: Record<keyof HomePageStructure, HomeSectionId> = {
    hero: 'home-hero',
    categories: 'home-categories',
    stats: 'home-stats',
    popular: 'home-popular',
    features: 'home-features',
    cta: 'home-cta',
  }
  return map[key]
}
