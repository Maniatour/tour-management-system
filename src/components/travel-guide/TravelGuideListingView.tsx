'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, PenLine } from 'lucide-react'
import { useContext } from 'react'
import CustomerPageShell from '@/components/customer/CustomerPageShell'
import { AuthContext } from '@/contexts/AuthContext'
import { fetchTravelGuideArticles } from '@/lib/fetchTravelGuideArticles'
import type { TravelGuideArticle } from '@/lib/travelGuideArticles'

type Props = {
  locale: string
  t: (key: string) => string
}

export default function TravelGuideListingView({ locale, t }: Props) {
  const auth = useContext(AuthContext)
  const [articles, setArticles] = useState<TravelGuideArticle[]>([])
  const [loading, setLoading] = useState(true)

  const canWrite = auth?.hasPermission('canViewAdmin') ?? false

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const rows = await fetchTravelGuideArticles({ locale, limit: 48 })
      if (!cancelled) {
        setArticles(rows)
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [locale])

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
                <Link href={`/${locale}/travel-guide/write`} className="kv-travel-guide-write-btn">
                  <PenLine className="h-4 w-4" aria-hidden />
                  {t('travelGuideWriteArticle')}
                </Link>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="kv-travel-guide-grid" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="kv-travel-guide-card kv-travel-guide-card--skeleton" />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="kv-travel-guide-empty">
              <p>{t('travelGuideEmpty')}</p>
              {canWrite ? (
                <Link href={`/${locale}/travel-guide/write`} className="kv-travel-guide-write-btn">
                  {t('travelGuideWriteFirst')}
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="kv-travel-guide-grid">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/${locale}/travel-guide/${article.slug}`}
                  className="kv-travel-guide-card group"
                >
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
                  <span className="kv-guide-category">{article.category}</span>
                  <h2 className="kv-travel-guide-card-title">{article.title}</h2>
                  {article.excerpt ? (
                    <p className="kv-travel-guide-card-excerpt">{article.excerpt}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </CustomerPageShell>
  )
}
