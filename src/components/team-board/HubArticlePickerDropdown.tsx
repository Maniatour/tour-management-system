'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { filterHubArticleLinks } from '@/lib/hubArticleSearch'
import {
  groupHubArticleLinksByCategory,
  hubArticleLinkLabel,
  hubArticleLinkMeta,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import { HubDocumentsSearchField } from '@/components/team-board/HubDocumentsSearchField'
import type { OperationsHubCategory, SopEditLocale } from '@/types/sopStructure'

type HubArticlePickerDropdownBaseProps = {
  locale: string
  hubArticles: HubArticleLinkOption[]
  loading?: boolean
  loadFailed?: boolean
  onRetry?: (() => void) | undefined
  compact?: boolean
  label?: ReactNode
  hint?: string | undefined
  disabled?: boolean
  zIndexClass?: string
}

type HubArticlePickerDropdownSingleProps = HubArticlePickerDropdownBaseProps & {
  mode: 'single'
  value: string | null | undefined
  onChange: (articleId: string | null) => void
  placeholder?: string
  showClearLink?: boolean
  showNoneOption?: boolean
}

type HubArticlePickerDropdownMultipleProps = HubArticlePickerDropdownBaseProps & {
  mode: 'multiple'
  value: string[]
  onChange: (articleIds: string[]) => void
  placeholder?: string
}

export type HubArticlePickerDropdownProps =
  | HubArticlePickerDropdownSingleProps
  | HubArticlePickerDropdownMultipleProps

function draftSuffix(isKo: boolean, isPublished: boolean): string {
  if (isPublished) return ''
  return isKo ? ' (초안)' : ' (draft)'
}

export function HubArticlePickerDropdown(props: HubArticlePickerDropdownProps) {
  const {
    locale,
    hubArticles,
    loading = false,
    loadFailed = false,
    onRetry,
    compact = false,
    label,
    hint,
    disabled = false,
    zIndexClass = 'z-[90]',
  } = props

  const isKo = locale === 'ko'
  const viewLang: SopEditLocale = isKo ? 'ko' : 'en'
  const rootRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<OperationsHubCategory | null>(null)

  const isMultiple = props.mode === 'multiple'
  const singleValue = props.mode === 'single' ? props.value?.trim() || '' : ''
  const selectedIds = useMemo(() => {
    if (isMultiple) return new Set(props.value)
    const id = props.value?.trim() || ''
    return id ? new Set([id]) : new Set<string>()
  }, [isMultiple, props])

  const selectedArticles = useMemo(
    () => hubArticles.filter((article) => selectedIds.has(article.id)),
    [hubArticles, selectedIds]
  )

  const filteredArticles = useMemo(
    () => filterHubArticleLinks(hubArticles, searchQuery, viewLang),
    [hubArticles, searchQuery, viewLang]
  )

  const groupedArticles = useMemo(
    () => groupHubArticleLinksByCategory(filteredArticles, viewLang),
    [filteredArticles, viewLang]
  )

  const activeGroup = useMemo(() => {
    if (groupedArticles.length === 0) return null
    if (activeCategory) {
      return groupedArticles.find((group) => group.category === activeCategory) ?? groupedArticles[0]
    }
    return groupedArticles[0]
  }, [activeCategory, groupedArticles])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
    }
  }, [open])

  useEffect(() => {
    if (groupedArticles.length === 0) {
      setActiveCategory(null)
      return
    }
    if (!isMultiple) {
      const selected = hubArticles.find((article) => article.id === singleValue)
      if (selected && filteredArticles.some((article) => article.id === selected.id)) {
        setActiveCategory(selected.hub_category)
        return
      }
    }
    setActiveCategory((prev) => {
      if (prev && groupedArticles.some((group) => group.category === prev)) return prev
      return groupedArticles[0]?.category ?? null
    })
  }, [groupedArticles, filteredArticles, hubArticles, isMultiple, singleValue])

  const handleOpen = () => {
    if (loading || loadFailed || disabled) return
    setOpen((prev) => !prev)
  }

  const handleSelectSingle = (articleId: string | null) => {
    if (props.mode !== 'single') return
    props.onChange(articleId)
    setOpen(false)
  }

  const handleToggleMultiple = (articleId: string) => {
    if (props.mode !== 'multiple') return
    const next = new Set(props.value)
    if (next.has(articleId)) next.delete(articleId)
    else next.add(articleId)
    props.onChange([...next])
  }

  const removeSelected = (articleId: string) => {
    if (props.mode !== 'multiple') return
    props.onChange(props.value.filter((id) => id !== articleId))
  }

  const triggerLabel = useMemo(() => {
    if (loading) return isKo ? '불러오는 중…' : 'Loading…'
    if (isMultiple) {
      if (selectedArticles.length === 0) {
        return props.placeholder ?? (isKo ? '문서 선택…' : 'Select documents…')
      }
      if (selectedArticles.length === 1) {
        const article = selectedArticles[0]!
        return hubArticleLinkLabel(article, viewLang) + draftSuffix(isKo, article.is_published)
      }
      return isKo
        ? `${selectedArticles.length}개 문서 선택됨`
        : `${selectedArticles.length} documents selected`
    }
    const selected = selectedArticles[0]
    if (!selected) {
      return props.placeholder ?? (isKo ? '메뉴얼 선택…' : 'Select manual…')
    }
    return hubArticleLinkLabel(selected, viewLang) + draftSuffix(isKo, selected.is_published)
  }, [isKo, isMultiple, loading, props, selectedArticles, viewLang])

  const showNoneOption = props.mode === 'single' && (props.showNoneOption ?? true)
  const showClearLink = props.mode === 'single' && (props.showClearLink ?? true) && selectedArticles.length > 0

  return (
    <div ref={rootRef} className={`relative ${compact ? 'space-y-1' : 'space-y-2'}`}>
      {label ? (
        <div className={`font-medium text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</div>
      ) : null}

      {isMultiple && selectedArticles.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedArticles.map((article) => (
            <span
              key={article.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-950"
            >
              <span className="truncate">
                {hubArticleLinkLabel(article, viewLang)}
                {draftSuffix(isKo, article.is_published)}
              </span>
              <button
                type="button"
                onClick={() => removeSelected(article.id)}
                className="rounded p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                aria-label={isKo ? '선택 제거' : 'Remove selection'}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleOpen}
        disabled={loading || disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white text-left text-gray-900 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        }`}
      >
        <span
          className={`min-w-0 truncate ${
            selectedArticles.length > 0 ? 'font-medium' : 'text-gray-500'
          }`}
        >
          {triggerLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className={`absolute left-0 right-0 ${zIndexClass} mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg`}
          role="listbox"
        >
          <div className="border-b border-gray-100 p-2">
            <HubDocumentsSearchField
              locale={locale}
              value={searchQuery}
              onChange={setSearchQuery}
              compact
              className="[&_input]:text-xs"
            />
            {searchQuery.trim() ? (
              <p className="mt-1.5 text-[10px] text-gray-500">
                {isKo
                  ? `${filteredArticles.length}개 검색됨`
                  : `${filteredArticles.length} found`}
              </p>
            ) : null}
          </div>

          {groupedArticles.length > 0 ? (
            <>
              <div className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-gray-50 p-1.5 scrollbar-thin">
                {groupedArticles.map((group) => (
                  <button
                    key={group.category}
                    type="button"
                    onClick={() => setActiveCategory(group.category)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      activeGroup?.category === group.category
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {group.label}
                    <span
                      className={`ml-1 tabular-nums ${
                        activeGroup?.category === group.category ? 'text-white/80' : 'text-gray-400'
                      }`}
                    >
                      {group.articles.length}
                    </span>
                  </button>
                ))}
              </div>

              <div className="max-h-52 overflow-y-auto p-1.5">
                {showNoneOption ? (
                  <button
                    type="button"
                    onClick={() => handleSelectSingle(null)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
                      selectedIds.size === 0 ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-600'
                    }`}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {selectedIds.size === 0 ? <Check className="h-3.5 w-3.5 text-indigo-600" /> : null}
                    </span>
                    {isKo ? '연결 없음' : 'No manual linked'}
                  </button>
                ) : null}

                {activeGroup?.articles.map((article) => {
                  const isSelected = selectedIds.has(article.id)
                  return (
                    <button
                      key={article.id}
                      type="button"
                      onClick={() =>
                        isMultiple ? handleToggleMultiple(article.id) : handleSelectSingle(article.id)
                      }
                      className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-indigo-50/60 ${
                        isSelected ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isMultiple
                            ? isSelected
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-gray-300 bg-white'
                            : ''
                        }`}
                      >
                        {isSelected ? (
                          <Check
                            className={`h-3 w-3 ${isMultiple ? 'text-white' : 'text-indigo-600'}`}
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block ${isSelected ? 'font-medium text-gray-900' : 'text-gray-800'}`}
                        >
                          {hubArticleLinkLabel(article, viewLang)}
                          {draftSuffix(isKo, article.is_published)}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {hubArticleLinkMeta(article, viewLang)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="px-3 py-4 text-center text-xs text-gray-500">
              {searchQuery.trim()
                ? isKo
                  ? '검색 결과가 없습니다.'
                  : 'No documents found.'
                : isKo
                  ? '연결 가능한 메뉴얼이 없습니다.'
                  : 'No manuals available.'}
            </p>
          )}
        </div>
      ) : null}

      {showClearLink && !open ? (
        <button
          type="button"
          onClick={() => props.mode === 'single' && props.onChange(null)}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
        >
          <X className="h-3 w-3" />
          {isKo ? '연결 해제' : 'Clear link'}
        </button>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-1 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          {isKo ? '메뉴얼 목록 불러오는 중…' : 'Loading manuals…'}
        </p>
      ) : loadFailed ? (
        <div className="space-y-1">
          <p className="text-xs text-amber-600">
            {isKo
              ? '운영 허브 문서를 불러오지 못했습니다.'
              : 'Could not load Operations Hub documents.'}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={() => void onRetry()}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              {isKo ? '다시 불러오기' : 'Retry'}
            </button>
          ) : null}
        </div>
      ) : hint ? (
        <p className="text-xs text-gray-400">{hint}</p>
      ) : props.mode === 'single' && selectedArticles[0] ? (
        <p className="text-xs text-gray-500">
          {hubArticleLinkMeta(selectedArticles[0], viewLang)}
        </p>
      ) : null}
    </div>
  )
}
