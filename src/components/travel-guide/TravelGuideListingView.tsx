'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, PenLine, Search, X } from 'lucide-react'
import { useContext } from 'react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import TravelGuideEditorModal from '@/components/travel-guide/TravelGuideEditorModal'
import { AuthContext } from '@/contexts/AuthContext'
import { fetchTravelGuideArticles } from '@/lib/fetchTravelGuideArticles'
import { fetchTravelGuideArticlesForStaff } from '@/lib/fetchTravelGuideArticlesForStaff'
import { formatTravelGuideDisplayDate } from '@/lib/travelGuideAuthorDisplay'
import {
  mapTravelGuideArticle,
  type TravelGuideArticle,
} from '@/lib/travelGuideArticles'
import { filterTravelGuideRowsByQuery } from '@/lib/travelGuideSearch'

type Props = {
  locale: string
  t: (key: string, values?: Record<string, string | number>) => string
}

function TravelGuideArticleCard({
  article,
  locale,
  t,
  canWrite,
  onEditDraft,
}: {
  article: TravelGuideArticle
  locale: string
  t: Props['t']
  canWrite: boolean
  onEditDraft?: (articleId: string) => void
}) {
  const isDraft = !article.isPublished
  const showDraftBadge = canWrite && isDraft
  const editDraft = canWrite && isDraft && onEditDraft

  const body = (
    <>
      <div className="kv-travel-guide-card-image">
        {article.coverImageUrl ? (
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="kv-travel-guide-card-placeholder" aria-hidden />
        )}
      </div>
      <div className="kv-travel-guide-card-badges">
        {showDraftBadge ? (
          <span className="kv-travel-guide-draft-badge">{t('travelGuideDraftBadge')}</span>
        ) : null}
        <span className="kv-guide-category">{article.category}</span>
      </div>
      <h2 className="kv-travel-guide-card-title">{article.title}</h2>
      {article.excerpt ? <p className="kv-travel-guide-card-excerpt">{article.excerpt}</p> : null}
      {article.authorName || article.updatedAt ? (
        <p className="kv-travel-guide-card-meta">
          {article.authorName ? (
            <span className="kv-travel-guide-card-meta-author">{article.authorName}</span>
          ) : null}
          {article.authorName && article.updatedAt ? (
            <span className="kv-travel-guide-card-meta-sep" aria-hidden>
              ·
            </span>
          ) : null}
          {article.updatedAt ? (
            <time className="kv-travel-guide-card-meta-date" dateTime={article.updatedAt}>
              {t('travelGuideCardUpdated', {
                date: formatTravelGuideDisplayDate(article.updatedAt, locale),
              })}
            </time>
          ) : null}
        </p>
      ) : null}
    </>
  )

  if (editDraft) {
    return (
      <button
        type="button"
        onClick={() => onEditDraft(article.id)}
        className="kv-travel-guide-card group kv-travel-guide-card--button"
      >
        {body}
      </button>
    )
  }

  return (
    <Link
      href={`/${locale}/travel-guide/${article.slug}`}
      className="kv-travel-guide-card group"
    >
      {body}
    </Link>
  )
}

export default function TravelGuideListingView({ locale, t }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useContext(AuthContext)
  const initialQuery = searchParams.get('q')?.trim() ?? ''

  const [articles, setArticles] = useState<TravelGuideArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorArticleId, setEditorArticleId] = useState<string | undefined>()
  const [searchInput, setSearchInput] = useState(initialQuery)
  const [searchQuery, setSearchQuery] = useState(initialQuery)

  const authReady = auth ? !auth.loading : true
  const canWrite = authReady && (auth?.hasPermission('canViewAdmin') ?? false)
  const hasSearchQuery = searchQuery.length > 0

  const loadArticles = useCallback(
    async (query: string) => {
      if (!authReady) return

      setLoading(true)

      if (canWrite) {
        const rows = await fetchTravelGuideArticlesForStaff()
        const filtered = filterTravelGuideRowsByQuery(rows, query).slice(0, 48)
        setArticles(filtered.map((row) => mapTravelGuideArticle(row, locale)))
      } else {
        const rows = await fetchTravelGuideArticles({
          locale,
          limit: 48,
          ...(query ? { query } : {}),
        })
        setArticles(rows)
      }

      setLoading(false)
    },
    [authReady, canWrite, locale]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const nextQuery = searchQuery.trim()
    const currentQuery = searchParams.get('q')?.trim() ?? ''
    if (nextQuery === currentQuery) return

    const nextUrl = nextQuery
      ? `/${locale}/travel-guide?q=${encodeURIComponent(nextQuery)}`
      : `/${locale}/travel-guide`

    router.replace(nextUrl, { scroll: false })
  }, [locale, router, searchParams, searchQuery])

  useEffect(() => {
    if (!authReady) return

    let cancelled = false

    void (async () => {
      setLoading(true)

      if (canWrite) {
        const rows = await fetchTravelGuideArticlesForStaff()
        if (cancelled) return
        const filtered = filterTravelGuideRowsByQuery(rows, searchQuery).slice(0, 48)
        setArticles(filtered.map((row) => mapTravelGuideArticle(row, locale)))
      } else {
        const rows = await fetchTravelGuideArticles({
          locale,
          limit: 48,
          ...(searchQuery ? { query: searchQuery } : {}),
        })
        if (cancelled) return
        setArticles(rows)
      }

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [authReady, canWrite, locale, searchQuery])

  const openCreateModal = () => {
    setEditorArticleId(undefined)
    setEditorOpen(true)
  }

  const openEditModal = (articleId: string) => {
    setEditorArticleId(articleId)
    setEditorOpen(true)
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
  }

  return (
    <CustomerPageShell locale={locale} className="travel-guide-page">
      <section className="kv-section">
        <div className="kv-container">
          <div className="kv-travel-guide-top">
            <Link href={`/${locale}`} className="kv-travel-guide-back">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {t('travelGuideBackHome')}
            </Link>

            <div className="kv-travel-guide-header">
              <div>
                <h1 className="kv-section-title">{t('homeGuidesTitle')}</h1>
                <p className="kv-section-subtitle">{t('travelGuideListingSubtitle')}</p>
              </div>
              {canWrite ? (
                <button type="button" onClick={openCreateModal} className="kv-travel-guide-write-btn">
                  <PenLine className="h-4 w-4" aria-hidden />
                  {t('travelGuideWriteArticle')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="kv-travel-guide-search">
            <label htmlFor="travel-guide-search" className="sr-only">
              {t('travelGuideSearchPlaceholder')}
            </label>
            <Search className="kv-travel-guide-search-icon" aria-hidden />
            <input
              id="travel-guide-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('travelGuideSearchPlaceholder')}
              className="kv-travel-guide-search-input"
              autoComplete="off"
              enterKeyHint="search"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={clearSearch}
                className="kv-travel-guide-search-clear"
                aria-label={t('travelGuideSearchClear')}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>

          {hasSearchQuery && !loading ? (
            <p className="kv-travel-guide-search-summary">
              {t('travelGuideSearchResults', { count: articles.length })}
            </p>
          ) : null}

          {loading || !authReady ? (
            <div className="kv-travel-guide-grid" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="kv-travel-guide-card kv-travel-guide-card--skeleton" />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="kv-travel-guide-empty">
              {hasSearchQuery ? (
                <>
                  <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden />
                  <p className="text-lg font-semibold text-foreground">{t('noSearchResults')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t('tryDifferentSearch')}</p>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="kv-travel-guide-write-btn mt-4"
                  >
                    {t('travelGuideSearchClear')}
                  </button>
                </>
              ) : (
                <>
                  <p>{canWrite ? t('travelGuideEmptyStaff') : t('travelGuideEmpty')}</p>
                  {canWrite ? (
                    <button type="button" onClick={openCreateModal} className="kv-travel-guide-write-btn">
                      {t('travelGuideWriteFirst')}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : (
            <div className="kv-travel-guide-grid">
              {articles.map((article) => (
                <TravelGuideArticleCard
                  key={article.id}
                  article={article}
                  locale={locale}
                  t={t}
                  canWrite={canWrite}
                  onEditDraft={openEditModal}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {canWrite ? (
        <TravelGuideEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          articleId={editorArticleId}
          t={t}
          onSaved={(article) => {
            void loadArticles(searchQuery)
            if (article.isPublished) {
              router.push(`/${locale}/travel-guide/${article.slug}`)
            }
          }}
          onDeleted={() => void loadArticles(searchQuery)}
        />
      ) : null}
    </CustomerPageShell>
  )
}
