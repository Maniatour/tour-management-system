import { supabase } from '@/lib/supabase'

export type TagLabelMap = Record<string, { ko?: string; en?: string }>

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
    const entry: { ko?: string; en?: string } = {}
    for (const tr of translations ?? []) {
      if (tr.locale === 'ko') entry.ko = tr.label
      if (tr.locale === 'en') entry.en = tr.label
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
  if (locale === 'en') {
    return entry.en?.trim() || entry.ko?.trim() || tagKey
  }
  return entry.ko?.trim() || entry.en?.trim() || tagKey
}

export function resolveTagLabels(
  tagKeys: string[],
  locale: string,
  map: TagLabelMap
): string[] {
  return tagKeys.map((key) => resolveTagLabel(key, locale, map))
}
