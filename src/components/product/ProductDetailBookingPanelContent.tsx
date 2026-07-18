'use client'

import { Info, CheckCircle2, XCircle, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { formatInclusionList } from '@/lib/formatInclusionList'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import TrustBadgeRow from '@/components/product/ui/TrustBadgeRow'
import { useProductDetailTrustBadges } from '@/components/product/useProductDetailTrustBadges'
import PriceDisplay from '@/components/customer/ui/PriceDisplay'
import ProductDetailQuantityChoiceGroup from '@/components/product/ProductDetailQuantityChoiceGroup'
import { cn } from '@/lib/utils'
import { usesQuantitySelection } from '@/lib/choiceOptionCapacity'
import type { ProductDetailChoiceGroup } from '@/components/product/ProductDetailBookingSidebar'

type ProductDetailBookingPanelContentProps = {
  basePrice: number | null
  maxParticipants: number | null
  durationLabel: string
  groupSize: string | null
  totalPrice: number
  groupedChoices: Record<string, ProductDetailChoiceGroup>
  selectedOptions: Record<string, string>
  selectedChoiceQuantities?: Record<string, Record<string, number>>
  partySize?: number
  includedHtml?: string | null
  notIncludedHtml?: string | null
  showIncluded: boolean
  showNotIncluded: boolean
  isEnglish: boolean
  onOptionChange: (choiceId: string, optionId: string) => void
  onQuantityChange?: (choiceId: string, optionId: string, quantity: number) => void
  onCompareOptions: () => void
  onBookNow: () => void
  contactEmail?: string
  variant?: 'sidebar' | 'mobile' | 'airbnb'
  bookDisabled?: boolean
}

export default function ProductDetailBookingPanelContent({
  basePrice,
  maxParticipants,
  durationLabel,
  groupSize,
  totalPrice,
  groupedChoices,
  selectedOptions,
  selectedChoiceQuantities = {},
  partySize = 0,
  includedHtml,
  notIncludedHtml,
  showIncluded,
  showNotIncluded,
  isEnglish,
  onOptionChange,
  onQuantityChange,
  onCompareOptions,
  onBookNow,
  contactEmail = 'info@maniatour.com',
  variant = 'sidebar',
  bookDisabled = false,
}: ProductDetailBookingPanelContentProps) {
  const t = useTranslations('productDetail')
  const trustBadges = useProductDetailTrustBadges()
  const isMobile = variant === 'mobile'
  const isAirbnb = variant === 'airbnb'

  return (
    <>
      <CustomerPageZone zone="detail-sidebar-price" className={cn('mb-4', isMobile && 'mb-4')}>
        <div className={cn(isAirbnb ? 'text-left' : 'flex justify-center text-center')}>
          <PriceDisplay
            amount={totalPrice}
            prefixLabel={t('fromPrice')}
            suffixLabel={t('perPerson')}
            size={isMobile ? 'md' : 'lg'}
          />
          {!isMobile && !isAirbnb && (
            <p className="mt-1 text-xs cp-ui-muted">{t('totalPrice')}: ${totalPrice}</p>
          )}
        </div>

        {(isAirbnb || !isMobile) && (
        <div className={cn('mt-5 space-y-2 border-t border-slate-100 pt-4', isAirbnb && 'border-[#e5e7eb]')}>
          <div className="flex justify-between text-sm">
            <span className="cp-ui-muted">{t('basePrice')}</span>
            <span className="font-medium">${basePrice || 0}</span>
          </div>
          {Object.values(groupedChoices).flatMap((group) => {
            const choiceLabel = group.choice_name_ko || group.choice_name || group.choice_name_en
            if (usesQuantitySelection(group.choice_type, group.options, choiceLabel)) {
              const quantities = selectedChoiceQuantities[group.choice_id] ?? {}
              return group.options
                .filter((opt) => (quantities[opt.option_id] ?? 0) > 0 && (opt.option_price ?? 0) > 0)
                .map((opt) => {
                  const qty = quantities[opt.option_id] ?? 0
                  const label = isEnglish
                    ? opt.option_name || opt.option_name_ko
                    : opt.option_name_ko || opt.option_name
                  return (
                    <div key={`${group.choice_id}-${opt.option_id}`} className="flex justify-between text-sm">
                      <span className="cp-ui-muted">
                        {label} × {qty}
                      </span>
                      <span className="font-medium">+${(opt.option_price ?? 0) * qty}</span>
                    </div>
                  )
                })
            }
            const selectedOptionId = selectedOptions[group.choice_id]
            if (!selectedOptionId) return []
            const option = group.options.find((opt) => opt.option_id === selectedOptionId)
            if (!option?.option_price || option.option_price <= 0) return []
            return [
              <div key={group.choice_id} className="flex justify-between text-sm">
                <span className="cp-ui-muted">{group.choice_name}</span>
                <span className="font-medium">+${option.option_price}</span>
              </div>,
            ]
          })}
        </div>
        )}
      </CustomerPageZone>

      <TrustBadgeRow
        items={trustBadges}
        className={cn('mb-4 sm:mb-5', isAirbnb ? 'justify-start' : 'justify-center')}
        compact={isMobile}
      />

      <div
        className={cn(
          'mb-4 space-y-2.5 sm:mb-6 sm:space-y-3',
          isMobile ? '' : isAirbnb ? 'rounded-xl border border-[#e5e7eb] p-4' : 'rounded-xl cp-ui-panel-surface p-4'
        )}
      >
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
            {Object.values(groupedChoices).map((group) => {
              const choiceLabel = group.choice_name_ko || group.choice_name || group.choice_name_en
              const isQuantityGroup = usesQuantitySelection(
                group.choice_type,
                group.options,
                choiceLabel
              )
              return (
                <div key={group.choice_id}>
                  <label
                    htmlFor={
                      isQuantityGroup ? undefined : `choice-${group.choice_id}-${variant}`
                    }
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    {group.choice_name}
                  </label>
                  {isQuantityGroup && onQuantityChange ? (
                    group.options.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('noRoomsForPartySize')}</p>
                    ) : (
                      <ProductDetailQuantityChoiceGroup
                        group={group}
                        quantities={selectedChoiceQuantities[group.choice_id] ?? {}}
                        partySize={partySize}
                        isEnglish={isEnglish}
                        compact
                        onQuantityChange={(optionId, quantity) =>
                          onQuantityChange(group.choice_id, optionId, quantity)
                        }
                      />
                    )
                  ) : (
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
                  )}
                </div>
              )
            })}
          </div>
        </CustomerPageZone>
      )}

      <button
        type="button"
        onClick={onBookNow}
        disabled={bookDisabled}
        className={cn(
          isAirbnb
            ? 'airbnb-detail-reserve-btn'
            : 'cp-ui-btn-primary w-full rounded-xl font-semibold shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isMobile ? 'py-3.5 text-sm' : 'py-4 text-base hover:-translate-y-0.5 hover:shadow-xl',
          bookDisabled && 'cursor-not-allowed opacity-50'
        )}
      >
        {isAirbnb ? t('checkAvailability') : t('bookNow')}
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
        !isAirbnb ? (
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
        ) : null
      ) : null}
    </>
  )
}
