'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ChevronDown, ChevronUp, Library } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type TemplateOption = {
  id: string
  name: string
  name_ko: string | null
  adult_price: number | null
  child_price: number | null
  sort_order: number | null
  status: string | null
  description_ko: string | null
}

type TemplateGroup = {
  template_group: string
  template_group_ko: string
  template_group_en: string | null
  description_ko: string
  description_en: string
  count: number
  options: TemplateOption[]
}

export type ChoiceTemplatePickResult = {
  templateGroup: string
  /** Empty / undefined = load all options in the group */
  optionIds?: string[] | undefined
}

type Props = {
  onSelect: (result: ChoiceTemplatePickResult) => void
  onClose: () => void
}

export default function ChoiceTemplatePickerModal({ onSelect, onClose }: Props) {
  const params = useParams()
  const locale = (params.locale as string) || 'ko'
  const [groups, setGroups] = useState<TemplateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('options')
        .select(
          'id, name, name_ko, adult_price, child_price, sort_order, status, description_ko, template_group, template_group_ko, template_group_description_ko, template_group_description_en, is_choice_template'
        )
        .eq('is_choice_template', true)
        .not('template_group', 'is', null)
        .order('sort_order', { ascending: true })

      if (error) {
        console.error('[ChoiceTemplatePickerModal]', error)
        return
      }

      const map = new Map<string, TemplateGroup>()
      for (const row of data || []) {
        if (row.is_choice_template !== true || !row.template_group?.trim()) continue
        const key = row.template_group
        let group = map.get(key)
        if (!group) {
          group = {
            template_group: key,
            template_group_ko: row.template_group_ko || key,
            template_group_en: null,
            description_ko: row.template_group_description_ko || '',
            description_en: row.template_group_description_en || '',
            count: 0,
            options: [],
          }
          map.set(key, group)
        }
        group.options.push({
          id: row.id,
          name: row.name,
          name_ko: row.name_ko,
          adult_price: row.adult_price,
          child_price: row.child_price,
          sort_order: row.sort_order,
          status: row.status,
          description_ko: row.description_ko,
        })
        group.count = group.options.length
      }

      setGroups(
        Array.from(map.values()).sort((a, b) =>
          a.template_group_ko.localeCompare(b.template_group_ko, 'ko')
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => {
      if (g.template_group_ko.toLowerCase().includes(q)) return true
      if (g.template_group.toLowerCase().includes(q)) return true
      if (g.description_ko.toLowerCase().includes(q)) return true
      return g.options.some(
        (o) =>
          (o.name_ko || o.name || '').toLowerCase().includes(q) ||
          (o.name || '').toLowerCase().includes(q)
      )
    })
  }, [groups, search])

  const toggleExpand = (key: string) => {
    if (expanded === key) {
      setExpanded(null)
      setSelectedIds(new Set())
      return
    }
    const group = groups.find((g) => g.template_group === key)
    setExpanded(key)
    setSelectedIds(new Set(group?.options.map((o) => o.id) || []))
  }

  const toggleOption = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleLoad = (group: TemplateGroup) => {
    const ids =
      expanded === group.template_group && selectedIds.size > 0
        ? Array.from(selectedIds)
        : group.options.map((o) => o.id)

    if (ids.length === 0) {
      alert(locale === 'en' ? 'Select at least one option.' : '옵션을 하나 이상 선택하세요.')
      return
    }

    const allSelected = ids.length === group.options.length
    onSelect({
      templateGroup: group.template_group,
      ...(allSelected ? {} : { optionIds: ids }),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-lg">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold text-foreground">
            {locale === 'en' ? 'Load choice template' : '초이스 템플릿 불러오기'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {locale === 'en'
              ? 'Copies into this product. Editing here does not change the library.'
              : '이 상품에 복사됩니다. 여기서 수정해도 템플릿 원본은 바뀌지 않습니다.'}
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                locale === 'en'
                  ? 'Search templates or option names…'
                  : '템플릿·옵션명 검색…'
              }
              className="w-full rounded-lg border border-input py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {locale === 'en' ? 'Loading…' : '불러오는 중…'}
            </div>
          ) : filtered.length === 0 ? (
            <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
              <p>
                {locale === 'en'
                  ? 'No templates found.'
                  : '사용 가능한 템플릿이 없습니다.'}
              </p>
              <Link
                href={`/${locale}/admin/options?tab=choices`}
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Library className="h-4 w-4" />
                {locale === 'en'
                  ? 'Open choice template library'
                  : '초이스 템플릿 라이브러리 열기'}
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((group) => {
                const isOpen = expanded === group.template_group
                return (
                  <li
                    key={group.template_group}
                    className="rounded-lg border border-border/80 bg-card"
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(group.template_group)}
                        className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-muted"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                      >
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(group.template_group)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-medium text-foreground">
                          {group.template_group_ko}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.template_group} · {group.count}
                          {locale === 'en' ? ' options' : '개 옵션'}
                        </div>
                        {group.description_ko ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {group.description_ko}
                          </p>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoad(group)}
                        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {locale === 'en' ? 'Load' : '불러오기'}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-border/60 bg-muted/30 px-3 py-2">
                        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {locale === 'en'
                              ? 'Select options to copy'
                              : '복사할 옵션 선택'}
                          </span>
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => {
                              if (selectedIds.size === group.options.length) {
                                setSelectedIds(new Set())
                              } else {
                                setSelectedIds(
                                  new Set(group.options.map((o) => o.id))
                                )
                              }
                            }}
                          >
                            {selectedIds.size === group.options.length
                              ? locale === 'en'
                                ? 'Clear all'
                                : '전체 해제'
                              : locale === 'en'
                                ? 'Select all'
                                : '전체 선택'}
                          </button>
                        </div>
                        <ul className="max-h-48 space-y-1 overflow-y-auto">
                          {group.options.map((opt) => (
                            <li key={opt.id}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-background">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(opt.id)}
                                  onChange={() => toggleOption(opt.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-foreground">
                                    {opt.name_ko || opt.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ${Number(opt.adult_price ?? 0).toFixed(0)}
                                    {opt.status !== 'active'
                                      ? locale === 'en'
                                        ? ' · inactive'
                                        : ' · 비활성'
                                      : ''}
                                  </span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <Link
            href={`/${locale}/admin/options?tab=choices`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <Library className="h-4 w-4" />
            {locale === 'en' ? 'Manage templates' : '템플릿 관리'}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {locale === 'en' ? 'Cancel' : '취소'}
          </button>
        </div>
      </div>
    </div>
  )
}
