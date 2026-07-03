import type { SopDocument, SopEditLocale, SopSection } from '@/types/sopStructure'
import type { OperationsContentType, OperationsHubCategory } from '@/types/sopStructure'
import { newSopId, parseSopDocumentJson, prefillSortOrders, sopText } from '@/types/sopStructure'
import { sopSectionAnchorId } from '@/lib/sopDocumentToc'

/** @deprecated import from @/types/sopStructure */
export type { OperationsHubCategory, OperationsContentType } from '@/types/sopStructure'

/** 운영 허브 카테고리 — re-export for convenience */
export type HubEntrySource = 'article' | 'sop_section'

export type HubEntry = {
  id: string
  source: HubEntrySource
  slug?: string
  title_ko: string
  title_en: string
  summary_ko: string
  summary_en: string
  hub_category: OperationsHubCategory
  content_type: OperationsContentType
  target_roles: string[]
  sort_order: number
  /** sop_section일 때 SOP 페이지 앵커 */
  sopAnchorId?: string
}

export type KnowledgeArticleRow = {
  id: string
  slug: string
  title_ko: string
  title_en: string
  summary_ko: string
  summary_en: string
  hub_category: OperationsHubCategory
  content_type: OperationsContentType
  target_roles: string[]
  body_structure: unknown
  sort_order: number
  is_published: boolean
  published_at: string | null
  updated_at: string
}

export const HUB_CATEGORIES: Array<{
  id: OperationsHubCategory
  title_ko: string
  title_en: string
  sort_order: number
}> = [
  { id: 'onboarding', title_ko: '신규 입사 · 온보딩', title_en: 'Onboarding', sort_order: 0 },
  { id: 'reservation', title_ko: '예약 · CS', title_en: 'Reservations & CS', sort_order: 10 },
  { id: 'tour_ops', title_ko: '투어 운영 (OP)', title_en: 'Tour operations', sort_order: 20 },
  { id: 'guide', title_ko: '가이드 · 현장', title_en: 'Guide & field', sort_order: 30 },
  { id: 'office', title_ko: '사무 · 회계', title_en: 'Office & finance', sort_order: 40 },
  { id: 'system', title_ko: '시스템 사용법', title_en: 'System guides', sort_order: 50 },
  { id: 'other', title_ko: '기타 · 참고', title_en: 'Other & reference', sort_order: 99 },
]

export const CONTENT_TYPE_LABELS: Record<
  OperationsContentType,
  { ko: string; en: string }
> = {
  regulation: { ko: '규정', en: 'Regulation' },
  playbook: { ko: '워크플로', en: 'Playbook' },
  system_guide: { ko: '시스템 가이드', en: 'System guide' },
  reference: { ko: '참고', en: 'Reference' },
  onboarding: { ko: '온보딩', en: 'Onboarding' },
}

/** 팀보드 공지·업무와 동일한 직책 문자열 */
export const HUB_TARGET_ROLE_OPTIONS = [
  'super',
  'op',
  'office manager',
  'guide',
  'driver',
  'office',
] as const

const VALID_HUB_CATEGORIES = new Set<string>(HUB_CATEGORIES.map((c) => c.id))
const VALID_CONTENT_TYPES = new Set<string>(Object.keys(CONTENT_TYPE_LABELS))

export function normalizeHubCategory(raw: string | null | undefined): OperationsHubCategory {
  const v = (raw || '').trim()
  return VALID_HUB_CATEGORIES.has(v) ? (v as OperationsHubCategory) : 'other'
}

export function normalizeContentType(raw: string | null | undefined): OperationsContentType {
  const v = (raw || '').trim()
  return VALID_CONTENT_TYPES.has(v) ? (v as OperationsContentType) : 'playbook'
}

export function hubCategoryLabel(
  id: OperationsHubCategory,
  lang: SopEditLocale
): string {
  const row = HUB_CATEGORIES.find((c) => c.id === id)
  if (!row) return id
  return lang === 'en' ? row.title_en : row.title_ko
}

export function contentTypeLabel(type: OperationsContentType, lang: SopEditLocale): string {
  const row = CONTENT_TYPE_LABELS[type]
  return lang === 'en' ? row.en : row.ko
}

/** target_roles 비어 있으면 전 직원 대상 */
export function matchesHubTargetRoles(
  targetRoles: string[] | null | undefined,
  userPosition: string | null | undefined
): boolean {
  if (!targetRoles || targetRoles.length === 0) return true
  const pos = (userPosition || '').trim().toLowerCase()
  if (!pos) return true
  return targetRoles.some((r) => r.trim().toLowerCase() === pos)
}

export function hubEntryTitle(entry: HubEntry, lang: SopEditLocale): string {
  return sopText(entry.title_ko, entry.title_en, lang)
}

export function hubEntrySummary(entry: HubEntry, lang: SopEditLocale): string {
  return sopText(entry.summary_ko, entry.summary_en, lang)
}

export function articleRowToHubEntry(row: KnowledgeArticleRow): HubEntry {
  return {
    id: row.id,
    source: 'article',
    slug: row.slug,
    title_ko: row.title_ko,
    title_en: row.title_en,
    summary_ko: row.summary_ko,
    summary_en: row.summary_en,
    hub_category: normalizeHubCategory(row.hub_category),
    content_type: normalizeContentType(row.content_type),
    target_roles: row.target_roles ?? [],
    sort_order: row.sort_order,
  }
}

/** SOP 섹션 중 hub 메타가 있는 항목만 허브에 노출 (규정은 SOP 전체 링크로) */
export function sopSectionsToHubEntries(sections: SopSection[]): HubEntry[] {
  const entries: HubEntry[] = []
  for (const s of sections) {
    const hubCategory = s.hub_category ? normalizeHubCategory(s.hub_category) : null
    const contentType = s.content_type ? normalizeContentType(s.content_type) : null
    if (!hubCategory && !contentType) continue
    if (contentType === 'regulation') continue
    entries.push({
      id: `sop-sec-${s.id}`,
      source: 'sop_section',
      title_ko: s.title_ko,
      title_en: s.title_en,
      summary_ko: '',
      summary_en: '',
      hub_category: hubCategory ?? 'other',
      content_type: contentType ?? 'playbook',
      target_roles: s.target_roles ?? [],
      sort_order: s.sort_order,
      sopAnchorId: sopSectionAnchorId(s.id),
    })
  }
  return entries
}

export function mergeHubEntries(articles: HubEntry[], sopSections: HubEntry[]): HubEntry[] {
  return [...articles, ...sopSections].sort((a, b) => {
    const catA = HUB_CATEGORIES.find((c) => c.id === a.hub_category)?.sort_order ?? 99
    const catB = HUB_CATEGORIES.find((c) => c.id === b.hub_category)?.sort_order ?? 99
    if (catA !== catB) return catA - catB
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return hubEntryTitle(a, 'ko').localeCompare(hubEntryTitle(b, 'ko'), 'ko')
  })
}

export function groupHubEntriesByCategory(
  entries: HubEntry[]
): Array<{ category: (typeof HUB_CATEGORIES)[number]; entries: HubEntry[] }> {
  const grouped = new Map<OperationsHubCategory, HubEntry[]>()
  for (const e of entries) {
    const list = grouped.get(e.hub_category) ?? []
    list.push(e)
    grouped.set(e.hub_category, list)
  }
  return HUB_CATEGORIES.map((category) => ({
    category,
    entries: grouped.get(category.id) ?? [],
  })).filter((g) => g.entries.length > 0)
}

export function articleBodyToDocument(row: KnowledgeArticleRow): SopDocument | null {
  const parsed = parseSopDocumentJson(row.body_structure)
  if (parsed) return parsed
  return prefillSortOrders({
    title_ko: row.title_ko,
    title_en: row.title_en,
    sections: [
      {
        id: newSopId(),
        title_ko: row.title_ko,
        title_en: row.title_en,
        sort_order: 0,
        categories: [
          {
            id: newSopId(),
            title_ko: '내용',
            title_en: 'Content',
            content_ko: '',
            content_en: '',
            sort_order: 0,
          },
        ],
      },
    ],
  })
}

export { defaultKnowledgeArticleSeeds } from '@/lib/operationsHubTemplates'

export function slugifyHubArticleSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
