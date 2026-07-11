'use client'

import Link from 'next/link'
import { ArrowLeft, Clock, Users2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import TrustBadgeRow from '@/components/product/ui/TrustBadgeRow'
import { useProductDetailTrustBadges } from '@/components/product/useProductDetailTrustBadges'

type ProductDetailHeaderProps = {
  locale: string
  displayName: string
  categoryLabel: string
  primaryTag?: string | null
  durationLabel?: string
  groupSize?: string | null
  totalPrice?: number
  onBookNow?: () => void
}

export default function ProductDetailHeader({
  locale,
  displayName,
  categoryLabel,
  primaryTag,
  durationLabel,
  groupSize,
  totalPrice,
  onBookNow,
}: ProductDetailHeaderProps) {
  const t = useTranslations('productDetail')
  const trustBadges = useProductDetailTrustBadges()

  return (
    <CustomerPageZone zone="detail-header" className="border-b cp-ui-panel-surface">
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
          <div className="min-w-0 flex-1">
            <Link
              href={`/${locale}/products`}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium cp-ui-muted transition-colors hover:opacity-80 sm:mb-4 sm:gap-2 sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              {t('backToProductList')}
            </Link>

            <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:mb-3 sm:gap-2">
              <span className="cp-ui-badge inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:px-3 sm:py-1 sm:text-sm">
                {categoryLabel}
              </span>
              {primaryTag && (
                <CustomerPageZone zone="detail-overview-tags">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 sm:px-3 sm:py-1 sm:text-sm">
                    {primaryTag}
                  </span>
                </CustomerPageZone>
              )}
            </div>

            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {displayName}
            </h1>

            {(durationLabel || groupSize) && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs cp-ui-muted sm:mt-4 sm:gap-4 sm:text-base">
                {durationLabel && (
                  <span className="inline-flex items-center gap-2">
                    <Clock className="h-4 w-4 cp-ui-icon" aria-hidden />
                    {durationLabel}
                  </span>
                )}
                {groupSize && (
                  <span className="inline-flex items-center gap-2">
                    <Users2 className="h-4 w-4 cp-ui-icon" aria-hidden />
                    {groupSize}
                  </span>
                )}
              </div>
            )}

            <TrustBadgeRow items={trustBadges} className="mt-3 sm:mt-5" compact />
          </div>

          {typeof totalPrice === 'number' && onBookNow && (
            <CustomerPageZone zone="detail-header-price" className="hidden shrink-0 lg:block">
            <div className="rounded-2xl cp-ui-panel-surface p-5 lg:min-w-[280px]">
              <p className="text-sm font-medium cp-ui-muted">{t('fromPrice')}</p>
              <p className="mt-1 text-3xl font-bold cp-ui-price">
                ${totalPrice}
                <span className="ml-1 text-base font-medium cp-ui-muted">{t('perPerson')}</span>
              </p>
              <button
                type="button"
                onClick={onBookNow}
                className="cp-ui-btn-primary mt-4 w-full rounded-xl py-3.5 text-base font-semibold shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                {t('checkAvailability')}
              </button>
            </div>
            </CustomerPageZone>
          )}
        </div>
      </div>
    </CustomerPageZone>
  )
}
