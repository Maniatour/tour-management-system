'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Plus } from 'lucide-react'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { getDemoFaq } from '@/components/home/homeExtendedSectionData'
import { MANIATOUR_CTA_IMAGE } from '@/lib/maniatourHomeData'

export type FaqStructureVariant = 'accordion' | 'two-column' | 'compact-list' | 'maniatour-faq-cta'

function FaqList({ items, compact }: { items: ReturnType<typeof getDemoFaq>; compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {items.map((item, i) => (
        <details
          key={i}
          className={`group kv-faq-item ${compact ? 'px-4 py-2' : 'px-5 py-3'}`}
        >
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-sm font-semibold text-[#1a1a1a]">
            {item.question}
            <Plus className="h-4 w-4 shrink-0 text-[#888] group-open:rotate-45 transition-transform" aria-hidden />
          </summary>
          <p className={`text-[#666] ${compact ? 'text-xs mt-2' : 'text-sm mt-3'} leading-relaxed`}>
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  )
}

export default function HomeFaqSectionView({
  variant,
  t,
  zoneId,
  locale,
  titleOverride,
  itemCount = 5,
}: {
  variant: FaqStructureVariant
  t: (key: string) => string
  zoneId: string
  locale?: string
  titleOverride?: string
  itemCount?: number
}) {
  const items = getDemoFaq(t).slice(0, itemCount)
  const title = titleOverride?.trim() || t('faqTitle')

  if (variant === 'maniatour-faq-cta') {
    return (
      <CustomerPageZone zone={zoneId}>
        <section className="kv-section">
          <div className="kv-container">
            <div className="kv-faq-cta-split">
              <div className="kv-faq-panel">
                <h2 className="kv-section-title">{t('homeFaqManiaTourTitle')}</h2>
                <FaqList items={items} />
              </div>
              <div className="kv-cta-banner">
                <Image
                  src={MANIATOUR_CTA_IMAGE}
                  alt={t('homeCtaManiaTourImageAlt')}
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="kv-cta-banner-image object-cover"
                />
                <div className="kv-cta-banner-overlay" aria-hidden />
                <div className="kv-cta-banner-content">
                  <h2 className="kv-cta-banner-title">{t('homeCtaManiaTourTitle')}</h2>
                  <p className="kv-cta-banner-subtitle">{t('homeCtaManiaTourSubtitle')}</p>
                  <Link href={`/${locale ?? 'en'}/products`} className="kv-cta-banner-btn">
                    {t('homeCtaManiaTourButton')}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </CustomerPageZone>
    )
  }

  if (variant === 'two-column') {
    const mid = Math.ceil(items.length / 2)
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="cp-ui-muted mb-8">{t('faqDesc')}</p>
          <div className="grid md:grid-cols-2 gap-6">
            <FaqList items={items.slice(0, mid)} />
            <FaqList items={items.slice(mid)} />
          </div>
        </div>
      </CustomerPageZone>
    )
  }

  if (variant === 'compact-list') {
    return (
      <CustomerPageZone zone={zoneId}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold mb-4">{title}</h2>
          <FaqList items={items} compact />
        </div>
      </CustomerPageZone>
    )
  }

  return (
    <CustomerPageZone zone={zoneId}>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">{title}</h2>
        <p className="text-center cp-ui-muted mb-8">{t('faqDesc')}</p>
        <FaqList items={items} />
      </div>
    </CustomerPageZone>
  )
}
