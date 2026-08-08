'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Loader2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  HOME_DESTINATION_LINK_TAGS,
  HOME_TRAVEL_STYLE_LINK_TAGS,
  homeLinkTagLabel,
  type HomeLinkTagDef,
} from '@/lib/homeLinkTags'

type CatalogTag = {
  key: string
  label: string
}

type Props = {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  locale?: string
}

function TagButton({
  label,
  selected,
  onClick,
  tone = 'default',
}: {
  label: string
  selected: boolean
  onClick: () => void
  tone?: 'destination' | 'style' | 'default'
}) {
  const selectedTone =
    tone === 'destination'
      ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
      : tone === 'style'
        ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
        : 'border-indigo-600 bg-indigo-600 text-white shadow-sm'

  const idleTone =
    tone === 'destination'
      ? 'border-teal-200 bg-teal-50 text-teal-900 hover:border-teal-400 hover:bg-teal-100'
      : tone === 'style'
        ? 'border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-400 hover:bg-violet-100'
        : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        selected ? selectedTone : idleTone
      }`}
    >
      {selected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      <span>{label}</span>
    </button>
  )
}

function GroupSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div>
        <p className="text-xs font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export default function ProductHomeLinkTagPicker({
  selectedTags,
  onTagsChange,
  locale = 'ko',
}: Props) {
  const isEn = locale === 'en'
  const [loading, setLoading] = useState(true)
  const [catalog, setCatalog] = useState<CatalogTag[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('key, tag_translations(locale, label)')
          .order('key', { ascending: true })

        if (error) throw error

        const rows = (data ?? []).map((row) => {
          const translations = (row.tag_translations as Array<{ locale: string; label: string }> | null) ?? []
          const preferred =
            translations.find((item) => item.locale === locale)?.label ||
            translations.find((item) => item.locale === 'ko')?.label ||
            translations.find((item) => item.locale === 'en')?.label ||
            row.key
          return { key: row.key as string, label: preferred }
        })

        if (!cancelled) setCatalog(rows)
      } catch (error) {
        console.error('Failed to load tags for button picker:', error)
        if (!cancelled) setCatalog([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [locale])

  const linkedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const item of HOME_DESTINATION_LINK_TAGS) keys.add(item.key)
    for (const item of HOME_TRAVEL_STYLE_LINK_TAGS) keys.add(item.key)
    return keys
  }, [])

  const otherTags = useMemo(() => {
    const term = search.trim().toLowerCase()
    return catalog
      .filter((tag) => !linkedKeys.has(tag.key))
      .filter((tag) => {
        if (!term) return true
        return tag.key.toLowerCase().includes(term) || tag.label.toLowerCase().includes(term)
      })
  }, [catalog, linkedKeys, search])

  const toggle = (key: string) => {
    if (selectedTags.includes(key)) {
      onTagsChange(selectedTags.filter((item) => item !== key))
      return
    }
    onTagsChange([...selectedTags, key])
  }

  const renderLinkButtons = (defs: HomeLinkTagDef[], tone: 'destination' | 'style') =>
    defs.map((def) => (
      <TagButton
        key={`${tone}-${def.id}`}
        label={homeLinkTagLabel(def, locale)}
        selected={selectedTags.includes(def.key)}
        onClick={() => toggle(def.key)}
        tone={tone}
      />
    ))

  return (
    <div className="space-y-3">
      <GroupSection
        title={isEn ? 'Popular destinations' : '인기 목적지'}
        hint={
          isEn
            ? 'Selecting a destination tag lists this product when customers tap that home card.'
            : '선택하면 고객 홈 「인기 목적지」 해당 카드 클릭 시 이 상품이 목록에 표시됩니다.'
        }
      >
        {renderLinkButtons(HOME_DESTINATION_LINK_TAGS, 'destination')}
      </GroupSection>

      <GroupSection
        title={isEn ? 'Travel styles' : '나에게 맞는 여행 스타일'}
        hint={
          isEn
            ? 'Selecting a style tag lists this product under that travel-style card on the home page.'
            : '선택하면 고객 홈 「나에게 맞는 여행 스타일」 해당 카드 클릭 시 이 상품이 목록에 표시됩니다.'
        }
      >
        {renderLinkButtons(HOME_TRAVEL_STYLE_LINK_TAGS, 'style')}
      </GroupSection>

      <GroupSection
        title={isEn ? 'Other tags' : '기타 태그'}
        hint={
          isEn
            ? 'Extra catalog tags for filtering and display.'
            : '추가 분류·마케팅용 태그입니다.'
        }
      >
        <div className="mb-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isEn ? 'Search other tags…' : '기타 태그 검색…'}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
        </div>
        {loading ? (
          <p className="inline-flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isEn ? 'Loading…' : '불러오는 중…'}
          </p>
        ) : otherTags.length === 0 ? (
          <p className="text-xs text-slate-500">{isEn ? 'No other tags' : '기타 태그가 없습니다'}</p>
        ) : (
          otherTags.map((tag) => (
            <TagButton
              key={tag.key}
              label={tag.label}
              selected={selectedTags.includes(tag.key)}
              onClick={() => toggle(tag.key)}
              tone="default"
            />
          ))
        )}
      </GroupSection>

      {selectedTags.length > 0 ? (
        <p className="text-[11px] text-slate-500">
          {isEn ? `${selectedTags.length} selected` : `${selectedTags.length}개 선택됨`}
          <span className="ml-1 font-mono text-slate-400">({selectedTags.join(', ')})</span>
        </p>
      ) : null}
    </div>
  )
}
