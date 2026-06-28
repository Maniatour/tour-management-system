'use client'

import { Info, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { formatInclusionList } from '@/lib/formatInclusionList'

export type ProductDetailChoiceGroup = {
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_name_en?: string | null
  choice_type: string
  choice_description: string | null
  options: Array<{
    option_id: string
    option_name: string
    option_name_ko: string | null
    option_price: number | null
    is_default: boolean | null
  }>
}

type ProductDetailBookingSidebarProps = {
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
}

export default function ProductDetailBookingSidebar({
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
}: ProductDetailBookingSidebarProps) {
  const t = useTranslations('productDetail')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-gray-900">${totalPrice}</div>
          <div className="text-sm text-gray-600 mb-2">{t('totalPrice')}</div>
          <div className="text-left border-t border-gray-200 pt-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('basePrice')}</span>
              <span className="font-medium text-gray-900">${basePrice || 0}</span>
            </div>
            {Object.values(groupedChoices).map((group) => {
              const selectedOptionId = selectedOptions[group.choice_id]
              if (!selectedOptionId) return null
              const option = group.options.find((opt) => opt.option_id === selectedOptionId)
              if (!option?.option_price || option.option_price <= 0) return null
              return (
                <div key={group.choice_id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{group.choice_name}</span>
                  <span className="font-medium text-gray-900">+${option.option_price}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('maxParticipants')}</span>
            <span className="font-medium">
              {maxParticipants || 0}
              {t('peopleUnit')}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('duration')}</span>
            <span className="font-medium">{durationLabel}</span>
          </div>
          {groupSize && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('groupSize')}</span>
              <span className="font-medium">{groupSize}</span>
            </div>
          )}
        </div>

        {Object.keys(groupedChoices).length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">{t('requiredSelection')}</h4>
              <button
                type="button"
                onClick={onCompareOptions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
              >
                <Info className="w-4 h-4" />
                <span>{t('compareOptions')}</span>
              </button>
            </div>
            <div className="space-y-4">
              {Object.values(groupedChoices).map((group) => (
                <div key={group.choice_id}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {group.choice_name}
                  </label>
                  <select
                    value={selectedOptions[group.choice_id] || ''}
                    onChange={(e) => onOptionChange(group.choice_id, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          </div>
        )}

        <button
          type="button"
          onClick={onBookNow}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          {t('bookNow')}
        </button>

        <div className="mt-4 text-center">
          <a
            href={`mailto:${contactEmail}`}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {t('contactUs')}
          </a>
        </div>

        {showIncluded && includedHtml && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg shadow-sm border-2 border-emerald-200 p-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-emerald-500 rounded-lg shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800">{t('included')}</h3>
            </div>
            <div
              className="text-sm text-gray-800 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(formatInclusionList(includedHtml, true)),
              }}
            />
          </div>
        )}

        {showNotIncluded && notIncludedHtml && (
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg shadow-sm border-2 border-red-200 p-6 mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500 rounded-lg shadow-sm">
                <XCircle className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-red-800">{t('excluded')}</h3>
            </div>
            <div
              className="text-sm text-gray-800 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(formatInclusionList(notIncludedHtml, false)),
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
