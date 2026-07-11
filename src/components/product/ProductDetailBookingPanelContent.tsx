'use client'

import { Info, CheckCircle2, XCircle, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { formatInclusionList } from '@/lib/formatInclusionList'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import TrustBadgeRow from '@/components/product/ui/TrustBadgeRow'
import { useProductDetailTrustBadges } from '@/components/product/useProductDetailTrustBadges'
import PriceDisplay from '@/components/customer/ui/PriceDisplay'
import { cn } from '@/lib/utils'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'

type ProductDetailBookingPanelContentProps = {
  basePrice: number | null
  maxParticipants: number | null
  durationLabel: string
  groupSize: string | null
  totalPrice: number
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  includedHtml?: string | null
  notIncludedHtml?: string | null
  showIncluded: boolean
  showNotIncluded: boolean
  isEnglish: boolean
  onOptionChange: (choiceId: string, optionId: string) => void
  onCompareOptions: () => void
  onBookNow: () => void
  contactEmail?: string
  variant?: 'sidebar' | 'mobile'
}

export default function ProductDetailBookingPanelContent({
  basePrice,
  maxParticipants,
  durationLabel,
  groupSize,
  totalPrice,
  groupedChoices,
  selectedOptions,
  includedHtml,
  notIncludedHtml,
  showIncluded,
  showNotIncluded,
  isEnglish,
  onOptionChange,
  onCompareOptions,
  onBookNow,
  contactEmail = 'info@maniatour.com',
  variant = 'sidebar',
}: ProductDetailBookingPanelContentProps) {
  const t = useTranslations('productDetail')
  const trustBadges = useProductDetailTrustBadges()
  const isMobile = variant === 'mobile'

  return (
    <>
      <CustomerPageZone zone="detail-sidebar-price" className={cn('mb-4', isMobile && 'mb-4')}>
        <div className="flex justify-center text-center">
          <PriceDisplay
            amount={totalPrice}
            prefixLabel={t('fromPrice')}
            suffixLabel={t('perPerson')}
            size={isMobile ? 'md' : 'lg'}
          />
          {!isMobile && (
            <p className="mt-1 text-xs cp-ui-muted">{t('totalPrice')}: ${totalPrice}</p>
          )}
        </div>

        {!isMobile && (
        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <div className="flex justify-between text-sm">
            <span className="cp-ui-muted">{t('basePrice')}</span>
            <span className="font-medium">${basePrice || 0}</span>
          </div>
          {Object.values(groupedChoices).map((group) => {
            const selectedOptionId = selectedOptions[group.choice_id]
            if (!selectedOptionId) return null
            const option = group.options.find((opt) => opt.option_id === selectedOptionId)
            if (!option?.option_price || option.option_price <= 0) return null
            return (
              <div key={group.choice_id} className="flex justify-between text-sm">
                <span className="cp-ui-muted">{group.choice_name}</span>
                <span className="font-medium">+${option.option_price}</span>
              </div>
            )
          })}
        </div>
        )}
      </CustomerPageZone>

      <TrustBadgeRow items={trustBadges} className="mb-4 justify-center sm:mb-5" compact={isMobile} />

      <div className={cn('mb-4 space-y-2.5 sm:mb-6 sm:space-y-3', isMobile ? '' : 'rounded-xl cp-ui-panel-surface p-4')}>
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="cp-ui-muted">{t('maxParticipants')}</span>
          <span className="font-medium">
            {maxParticipants || 0}
            {t('peopleUnit')}
          </span>
        </div>
        <div className="flex justify-between text-xs sm:text-sm">
          <span className="cp-ui-muted">{t('duration')}</span>
          <span className="font-medium">{durationLabel}</span>
        </div>
        {groupSize && (
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="cp-ui-muted">{t('groupSize')}</span>
            <span className="font-medium">{groupSize}</span>
          </div>
        )}
      </div>

      {Object.keys(groupedChoices).length > 0 && (
        <CustomerPageZone zone="detail-sidebar-options" className="mb-4 sm:mb-6">
          <div className="mb-2.5 flex items-center justify-between sm:mb-3">
            <h4 className="text-sm font-semibold sm:text-base">{t('requiredSelection')}</h4>
            <button
              type="button"
              onClick={onCompareOptions}
              className="cp-ui-btn-outline inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Info className="h-4 w-4" aria-hidden />
              <span>{t('compareOptions')}</span>
            </button>
          </div>
          <div className="space-y-4">
            {Object.values(groupedChoices).map((group) => (
              <div key={group.choice_id}>
                <label
                  htmlFor={`choice-${group.choice_id}-${variant}`}
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  {group.choice_name}
                </label>
                <select
                  id={`choice-${group.choice_id}-${variant}`}
                  value={selectedOptions[group.choice_id] || ''}
                  onChange={(e) => onOptionChange(group.choice_id, e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {group.options.map((option) => (
                    <option key={option.option_id} value={option.option_id}>
                      {isEnglish
                        ? option.option_name || option.option_name_ko
                        : option.option_name_ko || option.option_name}
                      {option.option_price ? ` (+$${option.option_price})` : ''}
                      {option.is_default ? t('defaultOption') : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </CustomerPageZone>
      )}

      <button
        type="button"
        onClick={onBookNow}
        className={cn(
          'cp-ui-btn-primary w-full rounded-xl font-semibold shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isMobile ? 'py-3.5 text-sm' : 'py-4 text-base hover:-translate-y-0.5 hover:shadow-xl'
        )}
      >
        {t('bookNow')}
      </button>

      <p className="mt-3 text-center text-xs cp-ui-muted">{t('freeCancellationNote')}</p>

      <div className="mt-4 text-center">
        <a
          href={`mailto:${contactEmail}`}
          className="cp-ui-link inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('contactUs')}
        </a>
      </div>

      {(showIncluded && includedHtml) || (showNotIncluded && notIncludedHtml) ? (
        <CustomerPageZone zone="detail-sidebar-included">
          {showIncluded && includedHtml && (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 sm:mt-6 sm:rounded-2xl sm:border sm:border-emerald-200 sm:p-5 sm:shadow-sm">
              <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <h3 className="text-sm font-bold text-emerald-800 sm:text-lg">{t('included')}</h3>
              </div>
              <div
                className="prose prose-sm max-w-none text-xs text-slate-800 sm:text-sm"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(formatInclusionList(includedHtml, true)),
                }}
              />
            </div>
          )}

          {showNotIncluded && notIncludedHtml && (
            <div className="mt-4 rounded-xl bg-red-50 p-4 sm:mt-6 sm:rounded-2xl sm:border sm:border-red-200 sm:p-5 sm:shadow-sm">
              <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
                <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
                <h3 className="text-sm font-bold text-red-800 sm:text-lg">{t('excluded')}</h3>
              </div>
              <div
                className="prose prose-sm max-w-none text-xs text-slate-800 sm:text-sm"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(formatInclusionList(notIncludedHtml, false)),
                }}
              />
            </div>
          )}
        </CustomerPageZone>
      ) : null}
    </>
  )
}
