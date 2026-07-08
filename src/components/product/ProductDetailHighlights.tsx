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

  const highlightCards = [
    ...sloganItems.map((text, index) => ({
      id: `slogan-${index}`,
      text,
      icon: Sparkles,
      accent: 'from-blue-50 to-indigo-50 border-blue-100 text-[#0B5FFF]',
    })),
    ...tagItems.map((text, index) => ({
      id: `tag-${index}`,
      text,
      icon: MapPin,
      accent: 'from-slate-50 to-slate-100 border-slate-200 text-slate-700',
    })),
  ].slice(0, 6)

  if (highlightCards.length === 0 && !categoryLabel && !durationLabel) {
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
          <div className="mb-5 flex flex-wrap gap-3">
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
        )}

        {showSlogans && highlightCards.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlightCards.map(({ id, text, icon: Icon, accent }) => (
              <li
                key={id}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md',
                  accent
                )}
              >
                <div className="rounded-xl bg-white/80 p-2 shadow-sm">
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                </div>
                <p className="text-sm font-semibold leading-snug sm:text-base">{text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </CustomerPageZone>
  )
}
