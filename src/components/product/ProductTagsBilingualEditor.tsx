'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import TagSelector from '@/components/admin/TagSelector'
import { supabase } from '@/lib/supabase'

type TagTranslationState = Record<string, { ko: string; en: string; tagId?: string }>

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
    const ko = r.tag_translations?.find((t) => t.locale === 'ko')?.label ?? ''
    const en = r.tag_translations?.find((t) => t.locale === 'en')?.label ?? ''
    out[r.key] = { ko, en, tagId: r.id }
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

    for (const locale of ['ko', 'en'] as const) {
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

  const setLabel = (tagKey: string, locale: 'ko' | 'en', value: string) => {
    setTranslations((prev) => {
      const current = prev[tagKey]
      const entry: { ko: string; en: string; tagId?: string } = {
        ko: current?.ko ?? '',
        en: current?.en ?? '',
      }
      if (current?.tagId) entry.tagId = current.tagId
      entry[locale] = value

      const next: TagTranslationState = { ...prev, [tagKey]: entry }
      onTranslationsChange(next)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">상품 태그 선택</label>
        <TagSelector selectedTags={selectedTags} onTagsChange={onTagsChange} />
        <p className="text-[11px] text-gray-500 mt-1">
          태그 키는 공통이며, 아래에서 한국어·영어 표시명을 각각 입력합니다.
        </p>
      </div>

      {loading && (
        <div className="flex items-center text-sm text-gray-500 py-2">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          태그 번역 불러오는 중…
        </div>
      )}

      {!loading && selectedTags.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-700">태그 표시명 (한국어 / English)</p>
          {selectedTags.map((tagKey) => (
            <div
              key={tagKey}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2"
            >
              <p className="text-[11px] font-mono text-gray-500">{tagKey}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-gray-600 mb-0.5">한국어</label>
                  <input
                    type="text"
                    value={translations[tagKey]?.ko ?? ''}
                    onChange={(e) => setLabel(tagKey, 'ko', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="한국어 태그명"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-600 mb-0.5">English</label>
                  <input
                    type="text"
                    value={translations[tagKey]?.en ?? ''}
                    onChange={(e) => setLabel(tagKey, 'en', e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md text-sm"
                    placeholder="English tag label"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export type { TagTranslationState }
