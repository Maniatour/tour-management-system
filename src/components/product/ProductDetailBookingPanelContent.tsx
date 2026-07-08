'use client'

import { Info, CheckCircle2, XCircle, MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { formatInclusionList } from '@/lib/formatInclusionList'
import CustomerPageZone from '@/components/product/CustomerPageZone'
import TrustBadgeRow from '@/components/product/ui/TrustBadgeRow'
import { useProductDetailTrustBadges } from '@/components/product/useProductDetailTrustBadges'
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
      <CustomerPageZone zone="detail-sidebar-price" className={cn('mb-6', isMobile && 'mb-5')}>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">{t('fromPrice')}</p>
          <div className="mt-1 flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold tracking-tight text-slate-900">${totalPrice}</span>
            <span className="text-base font-medium text-slate-500">{t('perPerson')}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t('totalPrice')}: ${totalPrice}</p>
        </div>

        <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('basePrice')}</span>
            <span className="font-medium text-slate-900">${basePrice || 0}</span>
          </div>
          {Object.values(groupedChoices).map((group) => {
            const selectedOptionId = selectedOptions[group.choice_id]
            if (!selectedOptionId) return null
            const option = group.options.find((opt) => opt.option_id === selectedOptionId)
            if (!option?.option_price || option.option_price <= 0) return null
            return (
              <div key={group.choice_id} className="flex justify-between text-sm">
                <span className="text-slate-500">{group.choice_name}</span>
                <span className="font-medium text-slate-900">+${option.option_price}</span>
              </div>
            )
          })}
        </div>
      </CustomerPageZone>

      <TrustBadgeRow items={trustBadges} className="mb-5 justify-center" compact={isMobile} />

      <div className="mb-6 space-y-3 rounded-xl bg-slate-50 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{t('maxParticipants')}</span>
          <span className="font-medium text-slate-900">
            {maxParticipants || 0}
            {t('peopleUnit')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">{t('duration')}</span>
          <span className="font-medium text-slate-900">{durationLabel}</span>
        </div>
        {groupSize && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">{t('groupSize')}</span>
            <span className="font-medium text-slate-900">{groupSize}</span>
          </div>
        )}
      </div>

      {Object.keys(groupedChoices).length > 0 && (
        <CustomerPageZone zone="detail-sidebar-options" className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold text-slate-900">{t('requiredSelection')}</h4>
            <button
              type="button"
              onClick={onCompareOptions}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 px-3 py-1.5 text-sm font-medium text-[#0B5FFF] transition-colors hover:bg-blue-50"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-[#0B5FFF] focus:outline-none focus:ring-2 focus:ring-[#0B5FFF]/20"
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
        className="w-full rounded-xl bg-[#0B5FFF] py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0952e0] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5FFF] focus-visible:ring-offset-2"
      >
        {t('bookNow')}
      </button>

      <p className="mt-3 text-center text-xs text-slate-500">{t('freeCancellationNote')}</p>

      <div className="mt-4 text-center">
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0B5FFF] transition-colors hover:text-[#0952e0]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {t('contactUs')}
        </a>
      </div>

      {(showIncluded && includedHtml) || (showNotIncluded && notIncludedHtml) ? (
        <CustomerPageZone zone="detail-sidebar-included">
          {showIncluded && includedHtml && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500 p-2.5 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-white" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-emerald-800">{t('included')}</h3>
              </div>
              <div
                className="prose prose-sm max-w-none text-sm text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(formatInclusionList(includedHtml, true)),
                }}
              />
            </div>
          )}

          {showNotIncluded && notIncludedHtml && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-50 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-red-500 p-2.5 shadow-sm">
                  <XCircle className="h-5 w-5 text-white" aria-hidden />
                </div>
                <h3 className="text-lg font-bold text-red-800">{t('excluded')}</h3>
              </div>
              <div
                className="prose prose-sm max-w-none text-sm text-slate-800"
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
