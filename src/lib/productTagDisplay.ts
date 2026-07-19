import { supabase } from '@/lib/supabase'
import { contentFallbackOrder, isSiteLocale, type SiteLocale } from '@/lib/siteLocales'

export type TagLabelMap = Record<string, Partial<Record<SiteLocale, string>>>

export async function fetchTagLabelMap(tagKeys: string[]): Promise<TagLabelMap> {
  const unique = [...new Set(tagKeys.map((k) => k.trim()).filter(Boolean))]
  if (unique.length === 0) return {}

  const { data, error } = await supabase
    .from('tags')
    .select('key, tag_translations(locale, label)')
    .in('key', unique)

  if (error || !data) return {}

  const map: TagLabelMap = {}
  for (const row of data) {
    const key = String((row as { key: string }).key)
    const translations = (row as { tag_translations?: { locale: string; label: string }[] })
      .tag_translations
    const entry: Partial<Record<SiteLocale, string>> = {}
    for (const tr of translations ?? []) {
      const locale = tr.locale === 'zh' ? 'zh-CN' : tr.locale
      if (isSiteLocale(locale) && tr.label?.trim()) {
        entry[locale] = tr.label.trim()
      }
    }
    map[key] = entry
  }
  return map
}

export function resolveTagLabel(
  tagKey: string,
  locale: string,
  map: TagLabelMap
): string {
  const entry = map[tagKey]
  if (!entry) return tagKey
  const preferred = isSiteLocale(locale) ? locale : 'en'
  for (const code of contentFallbackOrder(preferred)) {
    const label = entry[code]?.trim()
    if (label) return label
  }
  return tagKey
}

export function resolveTagLabels(
  tagKeys: string[],
  locale: string,
  map: TagLabelMap
): string[] {
  return tagKeys.map((key) => resolveTagLabel(key, locale, map))
}
