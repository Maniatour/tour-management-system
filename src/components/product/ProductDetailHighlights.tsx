'use client'

import { Clock, MapPin, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import { cn } from '@/lib/utils'

type ProductDetailHighlightsProps = {
  slogans: Array<string | null | undefined>
  tags: string[]
  locale: string
  tagLabelMap: TagLabelMap
  categoryLabel?: string
  durationLabel?: string
  showSlogans?: boolean
}

export default function ProductDetailHighlights({
  slogans,
  tags,
  locale,
  tagLabelMap,
  categoryLabel,
  durationLabel,
  showSlogans = true,
}: ProductDetailHighlightsProps) {
  const t = useTranslations('productDetail')

  const sloganItems = slogans.filter((s): s is string => Boolean(s?.trim()))
  const tagItems = tags.slice(0, 6).map((tag) => resolveTagLabel(tag, locale, tagLabelMap))

  if (sloganItems.length === 0 && tagItems.length === 0 && !categoryLabel && !durationLabel) {
    return null
  }

  return (
    <CustomerPageZone zone="detail-highlights" suppressEditButton>
      <section className="rounded-xl border border-slate-200/80 bg-white p-4 sm:rounded-2xl sm:p-6 sm:shadow-sm lg:p-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-lg font-bold tracking-tight sm:text-2xl lg:text-3xl">
            {t('tourHighlights')}
          </h2>
          <p className="mt-1 text-xs cp-ui-muted sm:mt-2 sm:text-base">{t('tourHighlightsSubtitle')}</p>
        </div>

        {(categoryLabel || durationLabel) && (
          <CustomerPageZone zone="detail-overview-keyinfo" className="mb-4 sm:mb-5">
            <div className="flex flex-wrap gap-2">
              {categoryLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FFB800]/15 px-2.5 py-1 text-xs font-semibold text-amber-900 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  {categoryLabel}
                </span>
              )}
              {durationLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold cp-ui-link sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
                  <Clock className="h-3.5 w-3.5 cp-ui-icon sm:h-4 sm:w-4" aria-hidden />
                  {durationLabel}
                </span>
              )}
            </div>
          </CustomerPageZone>
        )}

        {showSlogans && sloganItems.length > 0 && (
          <CustomerPageZone zone="detail-overview-slogan" className="mb-4 sm:mb-5">
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {sloganItems.map((text, index) => (
                <li
                  key={`slogan-${index}`}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl bg-blue-50/80 p-3 text-[#0B5FFF] sm:gap-3 sm:rounded-2xl sm:border sm:border-blue-100 sm:p-4 sm:transition-all sm:duration-300 sm:hover:-translate-y-0.5 sm:hover:shadow-md'
                  )}
                >
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
                  <p className="text-xs font-semibold leading-snug sm:text-sm lg:text-base">{text}</p>
                </li>
              ))}
            </ul>
          </CustomerPageZone>
        )}

        {tagItems.length > 0 && (
          <CustomerPageZone zone="detail-overview-tags">
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {tagItems.map((text, index) => (
                <li
                  key={`tag-${index}`}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-slate-700 sm:gap-3 sm:rounded-2xl sm:border sm:border-slate-200 sm:p-4 sm:transition-all sm:duration-300 sm:hover:-translate-y-0.5 sm:hover:shadow-md'
                  )}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 sm:h-5 sm:w-5" aria-hidden />
                  <p className="text-xs font-semibold leading-snug sm:text-sm lg:text-base">{text}</p>
                </li>
              ))}
            </ul>
          </CustomerPageZone>
        )}
      </section>
    </CustomerPageZone>
  )
}
