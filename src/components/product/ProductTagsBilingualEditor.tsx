'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import TagSelector from '@/components/admin/TagSelector'
import LocaleDropdown from '@/components/LocaleDropdown'
import { supabase } from '@/lib/supabase'
import { SITE_LOCALES, type SiteLocale } from '@/lib/siteLocales'

export type TagLocaleLabels = Partial<Record<SiteLocale, string>> & { tagId?: string }

export type TagTranslationState = Record<string, TagLocaleLabels>

type ProductTagsBilingualEditorProps = {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onTranslationsChange: (translations: TagTranslationState) => void
}

export async function loadTagTranslations(
  tagKeys: string[]
): Promise<TagTranslationState> {
  if (tagKeys.length === 0) return {}

  const { data, error } = await supabase
    .from('tags')
    .select('id, key, tag_translations(locale, label)')
    .in('key', tagKeys)

  if (error || !data) return {}

  const out: TagTranslationState = {}
  for (const row of data) {
    const r = row as {
      id: string
      key: string
      tag_translations?: { locale: string; label: string }[]
    }
    const entry: TagLocaleLabels = { tagId: r.id }
    for (const tr of r.tag_translations ?? []) {
      const locale = tr.locale === 'zh' ? 'zh-CN' : tr.locale
      if (SITE_LOCALES.some((item) => item.code === locale) && tr.label?.trim()) {
        entry[locale as SiteLocale] = tr.label
      }
    }
    out[r.key] = entry
  }
  return out
}

export async function saveProductTagsWithTranslations(
  productId: string,
  tagKeys: string[],
  translations: TagTranslationState
): Promise<void> {
  const { error: productError } = await supabase
    .from('products')
    .update({ tags: tagKeys } as never)
    .eq('id', productId)

  if (productError) throw productError

  for (const key of tagKeys) {
    const state = translations[key]
    if (!state?.tagId) continue

    for (const localeItem of SITE_LOCALES) {
      const locale = localeItem.code
      const label = state[locale]?.trim()
      if (!label) continue

      const { data: existing } = await supabase
        .from('tag_translations')
        .select('id')
        .eq('tag_id', state.tagId)
        .eq('locale', locale)
        .maybeSingle()

      if (existing?.id) {
        const { error } = await supabase
          .from('tag_translations')
          .update({ label })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tag_translations').insert({
          id: crypto.randomUUID(),
          tag_id: state.tagId,
          locale,
          label,
        })
        if (error && error.code !== '23505') throw error
      }
    }
  }
}

export default function ProductTagsBilingualEditor({
  selectedTags,
  onTagsChange,
  onTranslationsChange,
}: ProductTagsBilingualEditorProps) {
  const [translations, setTranslations] = useState<TagTranslationState>({})
  const [editLocale, setEditLocale] = useState<SiteLocale>('ko')
  const [loading, setLoading] = useState(false)
  const onTranslationsChangeRef = useRef(onTranslationsChange)

  useEffect(() => {
    onTranslationsChangeRef.current = onTranslationsChange
  }, [onTranslationsChange])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const loaded = await loadTagTranslations(selectedTags)
        if (cancelled) return
        setTranslations(loaded)
        onTranslationsChangeRef.current(loaded)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [selectedTags])

  const setLabel = (tagKey: string, value: string) => {
    setTranslations((prev) => {
      const current = prev[tagKey] || {}
      const nextEntry: TagLocaleLabels = { ...current, [editLocale]: value }
      const next: TagTranslationState = { ...prev, [tagKey]: nextEntry }
      onTranslationsChange(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">상품 태그 선택</label>
        <TagSelector selectedTags={selectedTags} onTagsChange={onTagsChange} />
        <p className="mt-1 text-[11px] text-gray-500">
          태그 키는 공통이며, 아래에서 언어별 표시명을 입력합니다.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-gray-700">태그 표시명</p>
        <LocaleDropdown
          value={editLocale}
          onChange={setEditLocale}
          size="sm"
          showLabel
          ariaLabel="Tag label language"
        />
      </div>

      {loading && (
        <div className="flex items-center py-2 text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          태그 번역 불러오는 중…
        </div>
      )}

      {!loading && selectedTags.length > 0 && (
        <div className="space-y-3">
          {selectedTags.map((tagKey) => (
            <div
              key={tagKey}
              className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <p className="font-mono text-[11px] text-gray-500">{tagKey}</p>
              <input
                type="text"
                value={translations[tagKey]?.[editLocale] ?? ''}
                onChange={(e) => setLabel(tagKey, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                placeholder={`${editLocale} label`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
