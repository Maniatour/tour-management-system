'use client'

import { useMemo, useState } from 'react'
import { BookOpen, FileText, Loader2 } from 'lucide-react'
import { HUB_CATEGORIES } from '@/lib/operationsHub'
import { filterHubArticleLinks } from '@/lib/hubArticleSearch'
import {
  hubArticleLinkLabel,
  hubArticleLinkMeta,
  type HubArticleLinkOption,
} from '@/lib/hubArticleManualLink'
import { HubDocumentsSearchField } from '@/components/team-board/HubDocumentsSearchField'
import type { OperationsHubCategory, SopEditLocale } from '@/types/sopStructure'

type HubCategoryFilter = 'all' | OperationsHubCategory

type AdminWorkHubDocumentsPanelProps = {
  locale: string
  articles: HubArticleLinkOption[]
  loading: boolean
  onOpenArticle: (articleId: string) => void
}

export function AdminWorkHubDocumentsPanel({
  locale,
  articles,
  loading,
  onOpenArticle,
}: AdminWorkHubDocumentsPanelProps) {
  const isKo = locale === 'ko'
  const viewLang: SopEditLocale = isKo ? 'ko' : 'en'
  const [categoryFilter, setCategoryFilter] = useState<HubCategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const searchFilteredArticles = useMemo(
    () => filterHubArticleLinks(articles, searchQuery, viewLang),
    [articles, searchQuery, viewLang]
  )

  const countsByCategory = useMemo(() => {
    const map = new Map<OperationsHubCategory, number>()
    for (const article of searchFilteredArticles) {
      map.set(article.hub_category, (map.get(article.hub_category) ?? 0) + 1)
    }
    return map
  }, [searchFilteredArticles])

  const categoryTabs = useMemo(() => {
    const tabs: Array<{ id: HubCategoryFilter; label: string; count: number }> = [
      {
        id: 'all',
        label: isKo ? '전체' : 'All',
        count: searchFilteredArticles.length,
      },
    ]
    for (const cat of HUB_CATEGORIES) {
      tabs.push({
        id: cat.id,
        label: isKo ? cat.title_ko : cat.title_en,
        count: countsByCategory.get(cat.id) ?? 0,
      })
    }
    return tabs
  }, [countsByCategory, isKo, searchFilteredArticles.length])

  const filteredArticles = useMemo(() => {
    const list =
      categoryFilter === 'all'
        ? searchFilteredArticles
        : searchFilteredArticles.filter((a) => a.hub_category === categoryFilter)
    return [...list].sort((a, b) => {
      const catA = HUB_CATEGORIES.find((c) => c.id === a.hub_category)?.sort_order ?? 99
      const catB = HUB_CATEGORIES.find((c) => c.id === b.hub_category)?.sort_order ?? 99
      if (catA !== catB) return catA - catB
      return a.slug.localeCompare(b.slug)
    })
  }, [categoryFilter, searchFilteredArticles])

  if (loading && articles.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {loading && articles.length > 0 && (
        <div className="flex items-center justify-center gap-1.5 rounded-md bg-gray-50 py-1 text-[10px] text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {isKo ? '목록 갱신 중…' : 'Refreshing…'}
        </div>
      )}
      <HubDocumentsSearchField
        locale={locale}
        value={searchQuery}
        onChange={setSearchQuery}
        compact
      />
      {searchQuery.trim() ? (
        <p className="text-[10px] text-gray-500">
          {isKo ? `${searchFilteredArticles.length}개 문서` : `${searchFilteredArticles.length} found`}
        </p>
      ) : null}
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategoryFilter(tab.id)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              categoryFilter === tab.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            <span className={`ml-1 tabular-nums ${categoryFilter === tab.id ? 'text-white/80' : 'text-gray-400'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {filteredArticles.length === 0 ? (
        <p className="py-10 text-center text-xs text-gray-400">
          {searchQuery.trim()
            ? isKo
              ? '검색 결과가 없습니다.'
              : 'No documents match your search.'
            : isKo
              ? '표시할 문서가 없습니다.'
              : 'No documents in this category.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {filteredArticles.map((article) => {
            const title = hubArticleLinkLabel(article, viewLang)
            const meta = hubArticleLinkMeta(article, viewLang)
            return (
              <li key={article.id}>
                <button
                  type="button"
                  onClick={() => onOpenArticle(article.id)}
                  className="group flex w-full items-start gap-2 rounded-md border border-gray-200 bg-white p-2.5 text-left shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200">
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-1.5">
                      <span className="line-clamp-2 text-sm font-medium leading-snug text-gray-900 group-hover:text-indigo-900">
                        {title}
                      </span>
                      {!article.is_published && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          {isKo ? '초안' : 'Draft'}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-gray-500">
                      <span>{meta}</span>
                      {article.slug ? (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="truncate font-mono text-gray-400">{article.slug}</span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <BookOpen className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300 group-hover:text-indigo-600" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
