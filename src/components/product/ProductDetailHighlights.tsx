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
    <CustomerPageZone zone="detail-highlights">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t('tourHighlights')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">{t('tourHighlightsSubtitle')}</p>
        </div>

        {(categoryLabel || durationLabel) && (
          <CustomerPageZone zone="detail-overview-keyinfo" className="mb-5">
            <div className="flex flex-wrap gap-3">
              {categoryLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB800]/15 px-3 py-1.5 text-sm font-semibold text-amber-900">
                  <MapPin className="h-4 w-4" aria-hidden />
                  {categoryLabel}
                </span>
              )}
              {durationLabel && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-[#0B5FFF]">
                  <Clock className="h-4 w-4" aria-hidden />
                  {durationLabel}
                </span>
              )}
            </div>
          </CustomerPageZone>
        )}

        {showSlogans && sloganItems.length > 0 && (
          <CustomerPageZone zone="detail-overview-slogan" className="mb-5">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sloganItems.map((text, index) => (
                <li
                  key={`slogan-${index}`}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 p-5 text-[#0B5FFF] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
                  )}
                >
                  <div className="rounded-xl bg-white/80 p-2 shadow-sm">
                    <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold leading-snug sm:text-base">{text}</p>
                </li>
              ))}
            </ul>
          </CustomerPageZone>
        )}

        {tagItems.length > 0 && (
          <CustomerPageZone zone="detail-overview-tags">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tagItems.map((text, index) => (
                <li
                  key={`tag-${index}`}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200 p-5 text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
                  )}
                >
                  <div className="rounded-xl bg-white/80 p-2 shadow-sm">
                    <MapPin className="h-5 w-5 shrink-0" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold leading-snug sm:text-base">{text}</p>
                </li>
              ))}
            </ul>
          </CustomerPageZone>
        )}
      </section>
    </CustomerPageZone>
  )
}
