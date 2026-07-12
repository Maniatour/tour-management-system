import type { CustomerPageZone } from '@/lib/customerPageZones'
import { getZoneEditConfig, resolveCustomerPageZone } from '@/lib/customerPageZoneEditMap'
import {
  BUILTIN_INSTANCE_IDS,
  createHomeSectionEntry,
  getBuiltinZoneId,
  getSectionDisplayLabel,
  getSectionKindLabel,
  LEGACY_HOME_SECTION_ID_TO_KIND,
  normalizeHomeSectionConfig,
  type HomePageSectionEntry,
  type HomeSectionKind,
  type HomeSectionConfig,
} from '@/lib/customerPageHomeSectionCatalog'

export type { HomePageSectionEntry, HomeSectionKind, HomeSectionConfig } from '@/lib/customerPageHomeSectionCatalog'

export const HOME_SECTION_IDS = [
  'home-hero',
  'home-categories',
  'home-stats',
  'home-popular',
  'home-features',
  'home-cta',
] as const satisfies readonly CustomerPageZone[]

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number]

/** @deprecated use HomePageSectionEntry */
export type HomePageSectionConfig = HomePageSectionEntry

export type HomePageLayout = {
  sections: HomePageSectionEntry[]
}

function buildSection(
  instanceId: string,
  kind: HomeSectionKind,
  configPatch: HomeSectionConfig = {},
  visible = true
): HomePageSectionEntry {
  return {
    instanceId,
    kind,
    visible,
    config: normalizeHomeSectionConfig(configPatch, kind),
  }
}

function defaultBuiltinSections(): HomePageSectionEntry[] {
  return [
    buildSection('home-hero', 'hero', { structureVariant: 'maniatour-southwest' }),
    buildSection('home-popular', 'card-list', {
      structureVariant: 'maniatour-carousel',
      cardCount: 8,
      productQuery: 'favorites',
    }),
    buildSection('home-features', 'features', { structureVariant: 'maniatour-trust-six' }),
    buildSection('home-categories', 'categories', { structureVariant: 'maniatour-destinations' }),
    buildSection('home-travel-style', 'categories', { structureVariant: 'travel-style-cards' }),
    buildSection('home-reviews', 'reviews', {
      structureVariant: 'maniatour-split-instagram',
      itemCount: 1,
    }),
    buildSection('home-guides', 'rich-text', { structureVariant: 'maniatour-guides-carousel' }),
    buildSection('home-faq', 'faq', { structureVariant: 'maniatour-faq-cta', itemCount: 4 }),
    buildSection('home-stats', 'stats', { structureVariant: 'inline-strip' }, false),
    buildSection('home-cta', 'cta', { structureVariant: 'full-band' }, false),
    buildSection(
      'home-cards-activities',
      'card-list',
      {
        structureVariant: 'activity-cards',
        cardCount: 4,
        productQuery: 'recent',
      },
      false
    ),
  ]
}

export const DEFAULT_HOME_PAGE_LAYOUT: HomePageLayout = {
  sections: defaultBuiltinSections(),
}

const MANIATOUR_HOME_INSTANCE_IDS = new Set([
  ...BUILTIN_INSTANCE_IDS,
  'home-cards-activities',
  'home-reviews',
  'home-travel-style',
  'home-guides',
  'home-faq',
])

/** 저장된 홈 레이아웃을 Mania Tour 기본 구성과 맞춤 */
export function ensureManiaTourHomePageLayout(layout: HomePageLayout): HomePageLayout {
  const normalized = normalizeHomePageLayout(layout)
  const defaults = normalizeHomePageLayout(DEFAULT_HOME_PAGE_LAYOUT)

  const mergedDefaults = defaults.sections.map((defaultSection) => {
    const existing = normalized.sections.find((section) => section.instanceId === defaultSection.instanceId)
    if (!existing) return defaultSection

    if (MANIATOUR_HOME_INSTANCE_IDS.has(defaultSection.instanceId)) {
      return defaultSection
    }

    const customTitle = existing.config.title?.trim()
    return {
      ...defaultSection,
      config: {
        ...defaultSection.config,
        ...(customTitle ? { title: customTitle } : {}),
      },
    }
  })

  const extraSections: HomePageSectionEntry[] = []

  return normalizeHomePageLayout({ sections: [...mergedDefaults, ...extraSections] })
}

/** @deprecated use ensureManiaTourHomePageLayout */
export const ensureKovegasHomePageLayout = ensureManiaTourHomePageLayout

/** @deprecated use ensureManiaTourHomePageLayout */
export const ensureGygHomePageLayout = ensureManiaTourHomePageLayout

export function isHomeSectionId(value: unknown): value is HomeSectionId {
  return typeof value === 'string' && (HOME_SECTION_IDS as readonly string[]).includes(value)
}

function migrateLegacySection(raw: unknown): HomePageSectionEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  if (typeof item.instanceId === 'string' && typeof item.kind === 'string') {
    const kind = item.kind as HomeSectionKind
    return {
      instanceId: item.instanceId,
      kind,
      visible: item.visible !== false,
      config: normalizeHomeSectionConfig(item.config, kind),
    }
  }

  if (isHomeSectionId(item.id)) {
    const kind = LEGACY_HOME_SECTION_ID_TO_KIND[item.id]
    return {
      instanceId: item.id,
      kind,
      visible: item.visible !== false,
      config: normalizeHomeSectionConfig(item.config, kind),
    }
  }

  return null
}

export function normalizeHomePageLayout(raw: unknown): HomePageLayout {
  const defaults = defaultBuiltinSections()

  if (!raw || typeof raw !== 'object') {
    return { sections: defaults.map((section) => ({ ...section, config: { ...section.config } })) }
  }

  const savedSections = (raw as HomePageLayout).sections
  if (!Array.isArray(savedSections)) {
    return { sections: defaults.map((section) => ({ ...section, config: { ...section.config } })) }
  }

  const migrated: HomePageSectionEntry[] = []
  for (const item of savedSections) {
    const section = migrateLegacySection(item)
    if (section && !migrated.some((s) => s.instanceId === section.instanceId)) {
      migrated.push(section)
    }
  }

  if (migrated.length === 0) {
    return { sections: defaults.map((section) => ({ ...section, config: { ...section.config } })) }
  }

  return { sections: migrated }
}

export function getOrderedVisibleHomeSections(layout: HomePageLayout): HomePageSectionEntry[] {
  return layout.sections.filter((section) => section.visible)
}

export function getHomeSectionLabel(sectionId: string): string {
  const fromMap = getZoneEditConfig(sectionId as HomeSectionId)?.label
  if (fromMap) return fromMap
  return sectionId
}

export function getHomeSectionEntryLabel(section: HomePageSectionEntry): string {
  if (isHomeSectionId(section.instanceId)) {
    return getZoneEditConfig(section.instanceId)?.label ?? getSectionKindLabel(section.kind)
  }
  const fromZone = getZoneEditConfig(resolveCustomerPageZone(getBuiltinZoneId(section)))?.label
  if (fromZone) return fromZone
  return getSectionDisplayLabel(section)
}

export function moveHomeSection(
  layout: HomePageLayout,
  instanceId: string,
  direction: 'up' | 'down'
): HomePageLayout {
  const index = layout.sections.findIndex((section) => section.instanceId === instanceId)
  if (index === -1) return layout

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= layout.sections.length) return layout

  const next = layout.sections.map((section) => ({ ...section, config: { ...section.config } }))
  const [moved] = next.splice(index, 1)
  next.splice(targetIndex, 0, moved)
  return { sections: next }
}

export function setHomeSectionVisible(
  layout: HomePageLayout,
  instanceId: string,
  visible: boolean
): HomePageLayout {
  return {
    sections: layout.sections.map((section) =>
      section.instanceId === instanceId ? { ...section, visible } : section
    ),
  }
}

export function addHomeSection(
  layout: HomePageLayout,
  kind: HomeSectionKind
): HomePageLayout {
  const entry = createHomeSectionEntry(kind, layout.sections)
  return { sections: [...layout.sections, entry] }
}

export function insertHomeSectionAtIndex(
  layout: HomePageLayout,
  kind: HomeSectionKind,
  index: number
): HomePageLayout {
  const entry = createHomeSectionEntry(kind, layout.sections)
  const next = layout.sections.map((section) => ({
    ...section,
    config: { ...section.config },
  }))
  const clampedIndex = Math.max(0, Math.min(index, next.length))
  next.splice(clampedIndex, 0, entry)
  return { sections: next }
}

export function updateHomeSectionStructureVariant(
  layout: HomePageLayout,
  instanceId: string,
  structureVariant: string
): HomePageLayout {
  const section = layout.sections.find((s) => s.instanceId === instanceId)
  if (!section) return layout
  return updateHomeSectionEntry(layout, instanceId, {
    config: { ...section.config, structureVariant },
  })
}

export function insertHomeSectionFromPresetAtIndex(
  layout: HomePageLayout,
  preset: { kind: HomeSectionKind; config: HomeSectionConfig },
  index: number
): HomePageLayout {
  const entry = createHomeSectionEntry(preset.kind, layout.sections)
  entry.config = normalizeHomeSectionConfig(preset.config, preset.kind)
  const next = layout.sections.map((section) => ({
    ...section,
    config: { ...section.config },
  }))
  const clampedIndex = Math.max(0, Math.min(index, next.length))
  next.splice(clampedIndex, 0, entry)
  return { sections: next }
}

export function removeHomeSection(layout: HomePageLayout, instanceId: string): HomePageLayout {
  if (layout.sections.length <= 1) return layout
  return { sections: layout.sections.filter((section) => section.instanceId !== instanceId) }
}

export function updateHomeSectionEntry(
  layout: HomePageLayout,
  instanceId: string,
  patch: Partial<HomePageSectionEntry>
): HomePageLayout {
  return {
    sections: layout.sections.map((section) =>
      section.instanceId === instanceId
        ? {
            ...section,
            ...patch,
            config: patch.config
              ? normalizeHomeSectionConfig(patch.config, patch.kind ?? section.kind)
              : section.config,
          }
        : section
    ),
  }
}

export function layoutsEqual(a: HomePageLayout, b: HomePageLayout): boolean {
  if (a.sections.length !== b.sections.length) return false
  return a.sections.every((section, index) => {
    const other = b.sections[index]
    if (!other) return false
    return (
      section.instanceId === other.instanceId &&
      section.kind === other.kind &&
      section.visible === other.visible &&
      JSON.stringify(section.config) === JSON.stringify(other.config)
    )
  })
}

export const HOME_SECTION_DESCRIPTIONS: Record<HomeSectionId, string> = {
  'home-hero': '방문자가 처음 보는 메인 배너와 CTA',
  'home-categories': '카테고리별로 투어를 찾는 그리드',
  'home-stats': '만족 고객·투어 수 등 신뢰 지표',
  'home-popular': '추천·인기 투어 카드 목록',
  'home-features': '서비스 강점·차별점 소개',
  'home-cta': '하단 예약·문의 유도 배너',
}

export function getHomeSectionDescription(section: HomePageSectionEntry): string {
  if (isHomeSectionId(section.instanceId)) {
    return HOME_SECTION_DESCRIPTIONS[section.instanceId]
  }
  if (section.kind === 'card-list') {
    const count = section.config.cardCount ?? 3
    const query = section.config.productQuery ?? 'favorites'
    return `상품 카드 ${count}개 · 데이터: ${query}`
  }
  const catalog = getSectionKindLabel(section.kind)
  const variant = section.config.structureVariant
  if (variant) return `${catalog} · ${variant}`
  return catalog
}

export function isHomeSectionZone(zone: string): zone is HomeSectionId {
  return isHomeSectionId(zone)
}

export function countVisibleHomeSections(layout: HomePageLayout): number {
  return layout.sections.filter((section) => section.visible).length
}

export function canHideHomeSection(layout: HomePageLayout, instanceId: string): boolean {
  const section = layout.sections.find((item) => item.instanceId === instanceId)
  if (!section?.visible) return true
  return countVisibleHomeSections(layout) > 1
}

export function canRemoveHomeSection(layout: HomePageLayout): boolean {
  return layout.sections.length > 1
}

export function reorderHomeSectionsAtIndex(
  layout: HomePageLayout,
  fromIndex: number,
  toIndex: number
): HomePageLayout {
  if (fromIndex === toIndex) return layout
  if (fromIndex < 0 || toIndex < 0) return layout
  if (fromIndex >= layout.sections.length || toIndex >= layout.sections.length) return layout

  const next = layout.sections.map((section) => ({ ...section, config: { ...section.config } }))
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return { sections: next }
}
