'use client'

import { Calendar, Info, Lightbulb, MapPin, Settings, Users, Users2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'

type ProductOverview = {
  duration: string | null
  max_participants: number | null
  category: string | null
  group_size: string | null
  tags: string[] | null
  description: string | null
}

type ProductDetailsOverview = {
  slogan1: string | null
  slogan2: string | null
  slogan3: string | null
  greeting: string | null
  description: string | null
  tags: string[] | null
}

type ProductDetailOverviewTabProps = {
  product: ProductOverview
  productDetails: ProductDetailsOverview | null
  displayName: string
  durationLabel: string
  categoryLabel: string
  showDetail: (field: string) => boolean
}

export default function ProductDetailOverviewTab({
  product,
  productDetails,
  displayName,
  durationLabel,
  categoryLabel,
  showDetail,
}: ProductDetailOverviewTabProps) {
  const t = useTranslations('productDetail')

  const tags = productDetails?.tags || product.tags || []

  return (
    <div className="space-y-8">
      {productDetails &&
        (productDetails.slogan1 || productDetails.slogan2 || productDetails.slogan3) &&
        showDetail('slogan1') && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <div className="space-y-3">
              {productDetails.slogan1 && (
                <div className="text-3xl font-bold text-blue-700">{productDetails.slogan1}</div>
              )}
              {productDetails.slogan2 && (
                <div className="text-xl font-semibold text-gray-800">{productDetails.slogan2}</div>
              )}
              {productDetails.slogan3 && (
                <div className="text-base text-gray-700">{productDetails.slogan3}</div>
              )}
            </div>
          </div>
        )}

      {productDetails?.greeting && showDetail('greeting') && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-6">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Info className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{t('greeting')}</h3>
          </div>
          <div
            className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(productDetails.greeting || '') }}
          />
        </div>
      )}

      {showDetail('description') && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{t('tourOverview')}</h3>
          </div>
          <div
            className="text-gray-700 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: markdownToHtml(
                productDetails?.description || product.description || displayName || ''
              ),
            }}
          />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
          <div className="p-2 bg-green-100 rounded-lg">
            <Settings className="h-5 w-5 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">{t('keyInformation')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="p-3 bg-blue-100 rounded-lg flex-shrink-0">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-600 block mb-1">{t('duration')}</span>
              <p className="text-lg font-semibold text-gray-900">{durationLabel}</p>
            </div>
          </div>
          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="p-3 bg-green-100 rounded-lg flex-shrink-0">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-600 block mb-1">{t('maxParticipants')}</span>
              <p className="text-lg font-semibold text-gray-900">
                {product.max_participants || 0}
                {t('peopleUnit')}
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="p-3 bg-red-100 rounded-lg flex-shrink-0">
              <MapPin className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-600 block mb-1">{t('category')}</span>
              <p className="text-lg font-semibold text-gray-900">{categoryLabel}</p>
            </div>
          </div>
          {product.group_size && (
            <div className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="p-3 bg-purple-100 rounded-lg flex-shrink-0">
                <Users2 className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-600 block mb-1">{t('groupSize')}</span>
                <p className="text-lg font-semibold text-gray-900">{product.group_size}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{t('tags')}</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
