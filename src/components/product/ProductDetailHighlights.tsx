'use client'

import { Clock, MapPin, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { SectionHeader } from '@/components/ui/section-header'
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
      <Section spacing="compact">
        <Container>
          <SectionHeader heading={t('tourHighlights')} subtitle={t('tourHighlightsSubtitle')} />

          {(categoryLabel || durationLabel) && (
            <CustomerPageZone zone="detail-overview-keyinfo" className="mb-5">
              <div className="flex flex-wrap gap-2">
                {categoryLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-sm font-semibold text-accent-foreground">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {categoryLabel}
                  </span>
                )}
                {durationLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 cp-ui-icon" aria-hidden />
                    {durationLabel}
                  </span>
                )}
              </div>
            </CustomerPageZone>
          )}

          {showSlogans && sloganItems.length > 0 && (
            <CustomerPageZone zone="detail-overview-slogan" className="mb-5">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sloganItems.map((text, index) => (
                  <li
                    key={`slogan-${index}`}
                    className={cn(
                      'flex items-start gap-3 rounded-feature bg-booking/5 p-4 text-foreground transition-all duration-300 hover:-translate-y-0.5'
                    )}
                  >
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-booking" aria-hidden />
                    <p className="text-sm font-semibold leading-snug lg:text-base">{text}</p>
                  </li>
                ))}
              </ul>
            </CustomerPageZone>
          )}

          {tagItems.length > 0 && (
            <CustomerPageZone zone="detail-overview-tags">
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tagItems.map((text, index) => (
                  <li
                    key={`tag-${index}`}
                    className={cn(
                      'flex items-start gap-3 rounded-feature bg-muted/50 p-4 text-foreground transition-all duration-300 hover:-translate-y-0.5'
                    )}
                  >
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    <p className="text-sm font-semibold leading-snug lg:text-base">{text}</p>
                  </li>
                ))}
              </ul>
            </CustomerPageZone>
          )}
        </Container>
      </Section>
    </CustomerPageZone>
  )
}
