import {
  LEGACY_HOME_SECTION_ID_TO_KIND,
  normalizeHomeSectionConfig,
} from '@/lib/customerPageHomeSectionCatalog'
import {
  DEFAULT_HOME_PAGE_LAYOUT,
  HOME_SECTION_IDS,
  layoutsEqual,
  normalizeHomePageLayout,
  type HomePageLayout,
  type HomeSectionId,
} from '@/lib/customerPageHomeLayout'
import {
  DEFAULT_HOME_PAGE_STRUCTURE,
  structuresEqual,
  type HomePageStructure,
} from '@/lib/customerPageHomeStructure'
import { getGlobalThemeById } from '@/lib/customerPageGlobalTheme'

export const DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID = 'agency-classic'

export type CustomerPageTemplateDefinition = {
  id: string
  label: string
  description: string
  tags: string[]
  themeId: string
  homeLayout: HomePageLayout
  structure: HomePageStructure
}

function buildHomeLayout(
  order: readonly HomeSectionId[],
  hidden: readonly HomeSectionId[] = []
): HomePageLayout {
  const hiddenSet = new Set(hidden)
  return {
    sections: order.map((instanceId) => ({
      instanceId,
      kind: LEGACY_HOME_SECTION_ID_TO_KIND[instanceId],
      visible: !hiddenSet.has(instanceId),
      config: normalizeHomeSectionConfig({}, LEGACY_HOME_SECTION_ID_TO_KIND[instanceId]),
    })),
  }
}

const FULL_HOME_ORDER = HOME_SECTION_IDS

export const CUSTOMER_PAGE_TEMPLATES: CustomerPageTemplateDefinition[] = [
  {
    id: 'agency-classic',
    label: '투어 에이전시 클래식',
    description: '중앙 히어로 · 아이콘 카테고리 · 3열 인기 투어 — 기본 올인원',
    tags: ['기본', '올인원'],
    themeId: 'kovegas-classic',
    homeLayout: buildHomeLayout(FULL_HOME_ORDER),
    structure: { ...DEFAULT_HOME_PAGE_STRUCTURE },
  },
  {
    id: 'editorial-split',
    label: '에디토리얼 스플릿',
    description: '2단 히어로 + 대형 타일 + 피처드 그리드 · 매거진형 레이아웃',
    tags: ['에디토리얼', '2025'],
    themeId: 'kovegas-classic',
    homeLayout: buildHomeLayout(FULL_HOME_ORDER),
    structure: {
      hero: 'split-editorial',
      categories: 'large-tiles',
      stats: 'grid-four',
      popular: 'featured-plus-grid',
      features: 'alternating-rows',
      cta: 'split-actions',
    },
  },
  {
    id: 'bento-discovery',
    label: '벤토 디스커버리',
    description: '벤토 카테고리 + 가로 스크롤 투어 · 탐색형 홈',
    tags: ['벤토', '탐색'],
    themeId: 'ocean-breeze',
    homeLayout: buildHomeLayout(FULL_HOME_ORDER),
    structure: {
      hero: 'centered-classic',
      categories: 'bento-asymmetric',
      stats: 'inline-strip',
      popular: 'horizontal-scroll',
      features: 'icon-row',
      cta: 'centered-classic',
    },
  },
  {
    id: 'scroll-magazine',
    label: '스크롤 매거진',
    description: '좌측 미니멀 히어로 · 가로 스크롤 카테고리/투어 · 라이트 톤',
    tags: ['매거진', '모바일'],
    themeId: 'light-minimal',
    homeLayout: buildHomeLayout(
      ['home-hero', 'home-categories', 'home-popular', 'home-features', 'home-cta'],
      ['home-stats']
    ),
    structure: {
      hero: 'left-minimal',
      categories: 'horizontal-scroll',
      stats: 'card-row',
      popular: 'horizontal-scroll',
      features: 'grid-two-text',
      cta: 'inline-minimal',
    },
  },
  {
    id: 'conversion-luxury',
    label: '럭셔리 전환형',
    description: '풀스크린 히어로 · 강조 밴드 · 2열 대형 카드 · 골드 프리미엄',
    tags: ['예약 전환', '럭셔리'],
    themeId: 'gold-accent',
    homeLayout: buildHomeLayout(
      ['home-hero', 'home-stats', 'home-popular', 'home-features', 'home-cta'],
      ['home-categories']
    ),
    structure: {
      hero: 'full-immersive',
      categories: 'compact-pills',
      stats: 'highlight-band',
      popular: 'grid-two-large',
      features: 'card-grid-four',
      cta: 'full-band',
    },
  },
  {
    id: 'social-proof-first',
    label: '소셜 프루프 퍼스트',
    description: '컴팩트 바 + 통계 밴드 선행 · 리스트형 인기 투어',
    tags: ['신뢰', 'B2C'],
    themeId: 'kovegas-classic',
    homeLayout: buildHomeLayout([
      'home-hero',
      'home-stats',
      'home-popular',
      'home-features',
      'home-categories',
      'home-cta',
    ]),
    structure: {
      hero: 'compact-bar',
      categories: 'grid-icons',
      stats: 'highlight-band',
      popular: 'stacked-list',
      features: 'icon-row',
      cta: 'split-actions',
    },
  },
  {
    id: 'category-hub',
    label: '카테고리 허브',
    description: '벤토 그리드 중심 · 카테고리 탐색에 최적화',
    tags: ['카테고리', '허브'],
    themeId: 'ocean-breeze',
    homeLayout: buildHomeLayout(
      ['home-hero', 'home-categories', 'home-popular', 'home-features', 'home-cta'],
      ['home-stats']
    ),
    structure: {
      hero: 'split-editorial',
      categories: 'bento-asymmetric',
      stats: 'inline-strip',
      popular: 'grid-three',
      features: 'card-grid-four',
      cta: 'centered-classic',
    },
  },
  {
    id: 'adventure-immersive',
    label: '어드벤처 이머시브',
    description: '풀스크린 + 대형 타일 + 지그재그 특징 · 감성 어드벤처',
    tags: ['어드벤처', '감성'],
    themeId: 'desert-sunset',
    homeLayout: buildHomeLayout(
      ['home-hero', 'home-categories', 'home-popular', 'home-features', 'home-stats', 'home-cta']
    ),
    structure: {
      hero: 'full-immersive',
      categories: 'large-tiles',
      stats: 'card-row',
      popular: 'grid-two-large',
      features: 'alternating-rows',
      cta: 'full-band',
    },
  },
  {
    id: 'minimal-booking',
    label: '미니멀 부킹',
    description: '좌측 히어로 · 필 태그 · 인라인 CTA · 예약 집중형',
    tags: ['미니멀', '전환'],
    themeId: 'light-minimal',
    homeLayout: buildHomeLayout(
      ['home-hero', 'home-popular', 'home-cta'],
      ['home-categories', 'home-stats', 'home-features']
    ),
    structure: {
      hero: 'left-minimal',
      categories: 'compact-pills',
      stats: 'inline-strip',
      popular: 'stacked-list',
      features: 'icon-row',
      cta: 'inline-minimal',
    },
  },
  {
    id: 'dark-premium-stack',
    label: '다크 프리미엄 스택',
    description: '스플릿 히어로 · 가로 스크롤 · 피처드+그리드 · 다크 톤',
    tags: ['다크', '프리미엄'],
    themeId: 'premium-dark',
    homeLayout: buildHomeLayout(
      ['home-hero', 'home-popular', 'home-features', 'home-cta'],
      ['home-categories', 'home-stats']
    ),
    structure: {
      hero: 'split-editorial',
      categories: 'horizontal-scroll',
      stats: 'card-row',
      popular: 'featured-plus-grid',
      features: 'card-grid-four',
      cta: 'full-band',
    },
  },
  {
    id: 'trust-cards',
    label: '트러스트 카드',
    description: '카드형 통계·특징 · 신뢰감 중심 · 포레스트 그린',
    tags: ['신뢰', '카드'],
    themeId: 'forest-retreat',
    homeLayout: buildHomeLayout([
      'home-hero',
      'home-stats',
      'home-features',
      'home-popular',
      'home-cta',
    ]),
    structure: {
      hero: 'centered-classic',
      categories: 'grid-icons',
      stats: 'card-row',
      popular: 'grid-three',
      features: 'card-grid-four',
      cta: 'split-actions',
    },
  },
]

let activeTemplateId: string | null = DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID

export function setActiveCustomerPageTemplateId(templateId: string | null): void {
  activeTemplateId = templateId ? normalizeCustomerPageTemplateId(templateId) : null
}

export function getActiveCustomerPageTemplateId(): string | null {
  return activeTemplateId
}

export function normalizeCustomerPageTemplateId(templateId: unknown): string {
  if (typeof templateId !== 'string' || !templateId.trim()) {
    return DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID
  }
  const trimmed = templateId.trim()
  return CUSTOMER_PAGE_TEMPLATES.some((template) => template.id === trimmed)
    ? trimmed
    : DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID
}

export function getCustomerPageTemplateById(
  templateId?: string | null
): CustomerPageTemplateDefinition {
  const id = templateId
    ? normalizeCustomerPageTemplateId(templateId)
    : activeTemplateId ?? DEFAULT_CUSTOMER_PAGE_TEMPLATE_ID
  return (
    CUSTOMER_PAGE_TEMPLATES.find((template) => template.id === id) ??
    CUSTOMER_PAGE_TEMPLATES[0]
  )
}

export function templateMatchesCurrentState(
  template: CustomerPageTemplateDefinition,
  themeId: string,
  homeLayout: HomePageLayout,
  structure: HomePageStructure
): boolean {
  return (
    template.themeId === themeId &&
    layoutsEqual(
      normalizeHomePageLayout(template.homeLayout),
      normalizeHomePageLayout(homeLayout)
    ) &&
    structuresEqual(template.structure, structure)
  )
}

export function detectMatchingTemplateId(
  themeId: string,
  homeLayout: HomePageLayout,
  structure: HomePageStructure
): string | null {
  for (const template of CUSTOMER_PAGE_TEMPLATES) {
    if (templateMatchesCurrentState(template, themeId, homeLayout, structure)) {
      return template.id
    }
  }
  return null
}

export function getTemplatePreviewTheme(template: CustomerPageTemplateDefinition) {
  return getGlobalThemeById(template.themeId)
}

export function getDefaultTemplateHomeLayout(): HomePageLayout {
  return {
    sections: DEFAULT_HOME_PAGE_LAYOUT.sections.map((section) => ({
      ...section,
      config: { ...section.config },
    })),
  }
}
