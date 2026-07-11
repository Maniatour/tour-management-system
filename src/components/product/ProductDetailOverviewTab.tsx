'use client'



import { Calendar, Info, Lightbulb, MapPin, Settings, Users, Users2 } from 'lucide-react'

import { useTranslations } from 'next-intl'

import { markdownToHtml } from '@/components/LightRichEditor'

import CustomerPageZone from '@/components/product/CustomerPageZone'

import ProductDetailSectionCard from '@/components/product/ui/ProductDetailSectionCard'

import { getProductOverviewDescription } from '@/lib/productDetailDisplay'
import {
  getPreviewDetailFieldHtml,
  getPreviewOverviewDescription,
} from '@/lib/customerPageDisplayFromBindings'
import { useCustomerPageDisplayBindings } from '@/hooks/useCustomerPageDisplayBindings'

import { resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'



type ProductOverview = {

  duration: string | null

  max_participants: number | null

  category: string | null

  group_size: string | null

  tags: string[] | null

  description: string | null

  summary_ko?: string | null

  summary_en?: string | null

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

  locale: string

  showDetail: (field: string) => boolean

  tagLabelMap: TagLabelMap

}



export default function ProductDetailOverviewTab({

  product,

  productDetails,

  displayName,

  durationLabel,

  categoryLabel,

  locale,

  showDetail,

  tagLabelMap,

}: ProductDetailOverviewTabProps) {

  const t = useTranslations('productDetail')
  const { active: bindingsActive, revision: bindingRevision } = useCustomerPageDisplayBindings()

  const tags = productDetails?.tags || product.tags || []

  const greetingHtml = (() => {
    void bindingRevision
    if (bindingsActive) {
      return getPreviewDetailFieldHtml(
        'detail-overview-greeting',
        'greeting',
        product as Record<string, unknown>,
        productDetails as Record<string, unknown> | null,
        productDetails?.greeting ?? null
      )
    }
    return productDetails?.greeting ?? ''
  })()

  const overviewDescription = (() => {
    void bindingRevision
    if (bindingsActive) {
      return getPreviewOverviewDescription(
        'detail-overview-description',
        product,
        productDetails?.description,
        productDetails as Record<string, unknown> | null,
        locale,
        displayName
      )
    }
    return getProductOverviewDescription(
      product,
      productDetails?.description,
      locale,
      displayName
    )
  })()

  return (

    <div className="space-y-4 sm:space-y-8">

      {productDetails &&

        (productDetails.slogan1 || productDetails.slogan2 || productDetails.slogan3) &&

        showDetail('slogan1') && (

          <CustomerPageZone zone="detail-overview-slogan">

            <div className="rounded-feature border border-border/60 bg-booking/5 p-4 sm:p-8">

              <div className="space-y-3">

                {productDetails.slogan1 && (

                  <div className="text-xl font-bold text-booking sm:text-3xl">{productDetails.slogan1}</div>

                )}

                {productDetails.slogan2 && (

                  <div className="text-base font-semibold text-slate-800 sm:text-xl">{productDetails.slogan2}</div>

                )}

                {productDetails.slogan3 && (

                  <div className="text-sm leading-relaxed text-slate-600 sm:text-base">{productDetails.slogan3}</div>

                )}

              </div>

            </div>

          </CustomerPageZone>

        )}



      {greetingHtml && showDetail('greeting') && (

        <CustomerPageZone zone="detail-overview-greeting">

          <ProductDetailSectionCard

            title={t('greeting')}

            icon={Info}

            iconBgClassName="bg-emerald-50"

            iconClassName="text-emerald-600"

            className="border-emerald-100"

          >

            <div

              className="prose prose-sm max-w-none text-xs leading-relaxed text-slate-700 sm:prose-base sm:text-base"

              dangerouslySetInnerHTML={{ __html: markdownToHtml(greetingHtml) }}

            />

          </ProductDetailSectionCard>

        </CustomerPageZone>

      )}



      {showDetail('description') && (

        <CustomerPageZone zone="detail-overview-description">

          <ProductDetailSectionCard title={t('tourOverview')} icon={Info}>

            <div

              className="prose prose-sm max-w-none text-xs leading-relaxed text-slate-700 sm:prose-base sm:text-base"

              dangerouslySetInnerHTML={{

                __html: markdownToHtml(overviewDescription),

              }}

            />

          </ProductDetailSectionCard>

        </CustomerPageZone>

      )}



      <CustomerPageZone zone="detail-overview-keyinfo">

        <ProductDetailSectionCard

          title={t('keyInformation')}

          icon={Settings}

          iconBgClassName="bg-green-50"

          iconClassName="text-green-600"

        >

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-4">

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 sm:gap-4 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-4">

              <div className="shrink-0 rounded-lg bg-booking/10 p-2 sm:rounded-xl sm:p-3">

                <Calendar className="h-5 w-5 text-booking sm:h-6 sm:w-6" aria-hidden />

              </div>

              <div className="min-w-0 flex-1">

                <span className="mb-0.5 block text-xs font-medium text-slate-500 sm:mb-1 sm:text-sm">{t('duration')}</span>

                <p className="text-sm font-semibold text-slate-900 sm:text-lg">{durationLabel}</p>

              </div>

            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 sm:gap-4 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-4">

              <div className="shrink-0 rounded-lg bg-green-50 p-2 sm:rounded-xl sm:p-3">

                <Users className="h-5 w-5 text-green-600 sm:h-6 sm:w-6" aria-hidden />

              </div>

              <div className="min-w-0 flex-1">

                <span className="mb-0.5 block text-xs font-medium text-slate-500 sm:mb-1 sm:text-sm">{t('maxParticipants')}</span>

                <p className="text-sm font-semibold text-slate-900 sm:text-lg">

                  {product.max_participants || 0}

                  {t('peopleUnit')}

                </p>

              </div>

            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 sm:gap-4 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-4">

              <div className="shrink-0 rounded-lg bg-red-50 p-2 sm:rounded-xl sm:p-3">

                <MapPin className="h-5 w-5 text-red-500 sm:h-6 sm:w-6" aria-hidden />

              </div>

              <div className="min-w-0 flex-1">

                <span className="mb-0.5 block text-xs font-medium text-slate-500 sm:mb-1 sm:text-sm">{t('category')}</span>

                <p className="text-sm font-semibold text-slate-900 sm:text-lg">{categoryLabel}</p>

              </div>

            </div>

            {product.group_size && (

              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 sm:gap-4 sm:rounded-2xl sm:border sm:border-slate-100 sm:p-4">

                <div className="shrink-0 rounded-lg bg-purple-50 p-2 sm:rounded-xl sm:p-3">

                  <Users2 className="h-5 w-5 text-purple-600 sm:h-6 sm:w-6" aria-hidden />

                </div>

                <div className="min-w-0 flex-1">

                  <span className="mb-0.5 block text-xs font-medium text-slate-500 sm:mb-1 sm:text-sm">{t('groupSize')}</span>

                  <p className="text-sm font-semibold text-slate-900 sm:text-lg">{product.group_size}</p>

                </div>

              </div>

            )}

          </div>

        </ProductDetailSectionCard>

      </CustomerPageZone>



      {tags.length > 0 && (

        <CustomerPageZone zone="detail-overview-tags">

          <ProductDetailSectionCard

            title={t('tags')}

            icon={Lightbulb}

            iconBgClassName="bg-amber-50"

            iconClassName="text-amber-600"

          >

            <div className="flex flex-wrap gap-3">

              {tags.map((tag, index) => (

                <span

                  key={index}

                  className="inline-flex items-center rounded-lg bg-booking/10 px-2.5 py-1 text-xs font-medium text-booking sm:rounded-xl sm:border sm:border-border/60 sm:px-4 sm:py-2 sm:text-sm"

                >

                  {resolveTagLabel(tag, locale, tagLabelMap)}

                </span>

              ))}

            </div>

          </ProductDetailSectionCard>

        </CustomerPageZone>

      )}

    </div>

  )

}

