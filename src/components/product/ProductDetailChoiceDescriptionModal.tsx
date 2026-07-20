'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

export type ProductChoiceGroup = {
  choice_id: string
  choice_name: string
  choice_name_ko: string | null
  choice_name_en?: string | null
  choice_type: string
  /** per_person | per_unit */
  pricing_unit?: string | null
  choice_description: string | null
  choice_description_ko?: string | null
  choice_description_en?: string | null
  options: Array<{
    option_id: string
    option_name: string
    option_name_ko: string | null
    option_price: number | null
    capacity?: number | null
    is_default: boolean | null
    option_image_url?: string | null
    option_thumbnail_url?: string | null
    option_description?: string | null
    option_description_ko?: string | null
  }>
}

type ProductDetailChoiceDescriptionModalProps = {
  groupedChoices: Record<string, ProductChoiceGroup>
  onClose: () => void
}

export default function ProductDetailChoiceDescriptionModal({
  groupedChoices,
  onClose,
}: ProductDetailChoiceDescriptionModalProps) {
  const t = useTranslations('productDetail')

  const groups = Object.values(groupedChoices)
  const hasAnyDescription = groups.some((group) =>
    Boolean(group.choice_description?.trim())
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {t('choiceGroupDescriptions')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <div className="space-y-6">
            {groups.map((group) => {
              const groupDescription = group.choice_description
              if (!groupDescription?.trim()) return null

              return (
                <div key={group.choice_id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {group.choice_name}
                  </h3>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {groupDescription}
                    </p>
                  </div>
                </div>
              )
            })}
            {!hasAnyDescription && (
              <div className="text-center py-8 text-gray-500">
                <p>{t('noChoiceGroupDescriptions')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
