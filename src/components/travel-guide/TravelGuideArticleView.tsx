'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PenLine } from 'lucide-react'
import { useContext } from 'react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import TravelGuideEditorModal from '@/components/travel-guide/TravelGuideEditorModal'
import { AuthContext } from '@/contexts/AuthContext'
import { fetchTravelGuideArticle } from '@/lib/fetchTravelGuideArticles'
import { markdownToHtml } from '@/lib/markdownToHtml'
import type { TravelGuideArticle } from '@/lib/travelGuideArticles'

type Props = {
  locale: string
  slug: string
  t: (key: string) => string
}

export default function TravelGuideArticleView({ locale, slug, t }: Props) {
  const router = useRouter()
  const auth = useContext(AuthContext)
  const [article, setArticle] = useState<TravelGuideArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const canWrite = auth?.hasPermission('canViewAdmin') ?? false

  const reloadArticle = useCallback(async () => {
    setLoading(true)
    const row = await fetchTravelGuideArticle({ locale, slug })
    if (!row) {
      setNotFound(true)
      setArticle(null)
    } else {
      setNotFound(false)
      setArticle(row)
    }
    setLoading(false)
  }, [locale, slug])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const row = await fetchTravelGuideArticle({ locale, slug })
      if (cancelled) return
      if (!row) {
        setNotFound(true)
      } else {
        setArticle(row)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [locale, slug])

  return (
    <CustomerPageShell locale={locale} className="travel-guide-page">
      <section className="kv-section">
        <div className="kv-container kv-travel-guide-article-wrap">
          <Link href={`/${locale}/travel-guide`} className="kv-travel-guide-back">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t('travelGuideBackToArticles')}
          </Link>

          {loading ? (
            <div className="kv-travel-guide-article-skeleton" aria-busy="true" />
          ) : notFound || !article ? (
            <div className="kv-travel-guide-empty">
              <h1 className="kv-section-title">{t('travelGuideNotFoundTitle')}</h1>
              <p>{t('travelGuideNotFoundBody')}</p>
              <Link href={`/${locale}/travel-guide`} className="kv-travel-guide-write-btn">
                {t('travelGuideBackToArticles')}
              </Link>
            </div>
          ) : (
            <article className="kv-travel-guide-article">
              {article.coverImageUrl ? (
                <div className="kv-travel-guide-hero">
                  <Image
                    src={article.coverImageUrl}
                    alt={article.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 960px"
                    className="object-cover"
                  />
                  <div className="kv-travel-guide-hero-overlay" />
                </div>
              ) : null}

              <div className="kv-travel-guide-article-body">
                <div className="kv-travel-guide-article-meta">
                  <span className="kv-guide-category">{article.category}</span>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => setEditorOpen(true)}
                      className="kv-travel-guide-inline-edit"
                    >
                      <PenLine className="h-4 w-4" aria-hidden />
                      {t('travelGuideEditArticle')}
                    </button>
                  ) : null}
                </div>

                <h1 className="kv-travel-guide-article-title">{article.title}</h1>
                {article.excerpt ? (
                  <p className="kv-travel-guide-article-excerpt">{article.excerpt}</p>
                ) : null}

                <div
                  className="kv-travel-guide-prose"
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(article.body) }}
                />
              </div>
            </article>
          )}
        </div>
      </section>

      {canWrite && article ? (
        <TravelGuideEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          articleId={article.id}
          t={t}
          onSaved={(saved) => {
            if (saved.slug !== slug) {
              router.replace(`/${locale}/travel-guide/${saved.slug}`)
              return
            }
            void reloadArticle()
          }}
          onDeleted={() => router.push(`/${locale}/travel-guide`)}
        />
      ) : null}
    </CustomerPageShell>
  )
}
