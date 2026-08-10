import { contentFallbackOrder, isSiteLocale, type SiteLocale } from '@/lib/siteLocales'
import {
  TOUR_AUDIENCE_KIND_LABELS,
  type TourAudienceKind,
} from '@/lib/tourAudienceLibrary'

export type ContentLibraryUiLabelRow = {
  key: string
  name: string
  content_i18n?: { label?: Partial<Record<SiteLocale, string>> } | null
  is_active?: boolean | null
}

const KIND_KEY: Record<TourAudienceKind, string> = {
  recommended: 'tour_audience.recommended',
  not_recommended: 'tour_audience.not_recommended',
}

export function getContentLibraryUiLabelMap(
  row: ContentLibraryUiLabelRow | null | undefined
): Partial<Record<SiteLocale, string>> {
  return { ...(row?.content_i18n?.label || {}) }
}

export function getContentLibraryUiLabelText(
  row: ContentLibraryUiLabelRow | null | undefined,
  locale: string,
  fallback?: Partial<Record<SiteLocale, string>>
): string {
  const preferred = isSiteLocale(locale) ? locale : 'en'
  const map = { ...(fallback || {}), ...getContentLibraryUiLabelMap(row) }
  for (const code of contentFallbackOrder(preferred)) {
    const value = map[code]?.trim()
    if (value) return value
  }
  return ''
}

export async function fetchContentLibraryUiLabels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any },
  keys?: string[]
): Promise<ContentLibraryUiLabelRow[]> {
  let query = client
    .from('content_library_ui_labels')
    .select('key, name, content_i18n, is_active')
    .eq('is_active', true)
    .order('key')
  if (keys?.length) query = query.in('key', keys)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as ContentLibraryUiLabelRow[]
}

export function tourAudienceKindLabelFromRows(
  rows: ContentLibraryUiLabelRow[] | null | undefined,
  kind: TourAudienceKind,
  locale: string
): string {
  const key = KIND_KEY[kind]
  const row = (rows || []).find((r) => r.key === key)
  return (
    getContentLibraryUiLabelText(row, locale, TOUR_AUDIENCE_KIND_LABELS[kind]) ||
    TOUR_AUDIENCE_KIND_LABELS[kind].en
  )
}

export function buildContentLibraryUiLabelPayload(input: {
  key: string
  name: string
  labelByLocale: Partial<Record<SiteLocale, string>>
}): Record<string, unknown> {
  return {
    key: input.key,
    name: input.name.trim() || input.key,
    content_i18n: { label: { ...input.labelByLocale } },
    is_active: true,
    updated_at: new Date().toISOString(),
  }
}
