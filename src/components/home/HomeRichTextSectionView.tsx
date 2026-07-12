'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import HomeManiaTourSectionHeader, {
  HomeManiaTourSectionViewAllFooter,
} from '@/components/home/HomeManiaTourSectionHeader'
import { MANIATOUR_GUIDE_ITEMS } from '@/lib/maniatourHomeData'
import { fetchTravelGuideArticles } from '@/lib/fetchTravelGuideArticles'

export type RichTextStructureVariant = 'centered-prose' | 'split-media' | 'highlight-box' | 'maniatour-guides-carousel'

type GuideCard = {
  key: string
  href: string
  title: string
  category: string
  imageUrl: string
}

export default function HomeRichTextSectionView({
  variant,
  t,
  zoneId,
  locale,
  titleOverride,
}: {
  variant: RichTextStructureVariant
  t: (key: string) => string
  zoneId: string
  locale?: string
  titleOverride?: string
}) {
  const title = titleOverride?.trim() || t('richTextTitle')
  const [guides, setGuides] = useState<GuideCard[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (variant !== 'maniatour-guides-carousel' || !locale) return

    let cancelled = false

    void (async () => {
      const articles = await fetchTravelGuideArticles({ locale, limit: 10 })
      if (cancelled) return

      if (articles.length > 0) {
        setGuides(
          articles.map((article) => ({
            key: article.id,
            href: `/${locale}/travel-guide/${article.slug}`,
            title: article.title,
            category: article.category,
            imageUrl: article.coverImageUrl ?? MANIATOUR_GUIDE_ITEMS[0]?.imageUrl ?? '',
          }))
        )
      } else {
        setGuides(
          MANIATOUR_GUIDE_ITEMS.map((guide) => ({
            key: guide.titleKey,
            href: locale ? `/${locale}/travel-guide` : '#',
            title: t(guide.titleKey),
            category: t(guide.categoryKey),
            imageUrl: guide.imageUrl,
          }))
        )
      }

      setLoaded(true)
    })()

    return () => {
      cancelled = true
    }
  }, [locale, t, variant])

  if (variant === 'maniatour-guides-carousel') {
    const cards =
      guides.length > 0
        ? guides
        : MANIATOUR_GUIDE_ITEMS.map((guide) => ({
            key: guide.titleKey,
            href: locale ? `/${locale}/travel-guide` : '#',
            title: t(guide.titleKey),
            category: t(guide.categoryKey),
            imageUrl: guide.imageUrl,
          }))

    return (
      <CustomerPageZone zone={zoneId}>
        <section className="kv-section kv-section--muted">
          <div className="kv-container">
            <HomeManiaTourSectionHeader
              title={t('homeGuidesTitle')}
              {...(locale
                ? { viewAllHref: `/${locale}/travel-guide`, viewAllLabel: t('homeViewAllArticles') }
                : {})}
            />
            <div className="kv-guides-scroll" aria-busy={!loaded}>
              {cards.map((guide) => (
                <Link key={guide.key} href={guide.href} className="kv-guide-card group">
                  <article>
                    <div className="kv-guide-image">
                      <Image
                        src={guide.imageUrl}
                        alt={guide.title}
                        fill
                        sizes="260px"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <span className="kv-guide-category">{guide.category}</span>
                    <h3 className="kv-guide-title">{guide.title}</h3>
                  </article>
                </Link>
              ))}
            </div>
            {locale ? (
              <HomeManiaTourSectionViewAllFooter
                href={`/${locale}/travel-guide`}
                label={t('homeViewAllArticles')}
              />
            ) : null}
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  const body = t('richTextBody')

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">{title}</h2>
        <p className="cp-ui-muted leading-relaxed">{body}</p>
      </div>
    </CustomerPageZone>
  )
}
