'use client'

import { useMemo, type ComponentProps } from 'react'
import {
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  Car,
  Luggage,
  Settings,
  Lightbulb,
  Users2,
  AlertTriangle,
  Shield,
  Megaphone,
  ClipboardList,
  Bus,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import {
  getProductArrivalCity,
  getProductArrivalCountry,
  getProductDepartureCity,
  getProductDepartureCountry,
} from '@/lib/productDetailDisplay'
import { resolveTagLabel, type TagLabelMap } from '@/lib/productTagDisplay'
import type { ProductDetailsFields, ProductDetailsTabProduct } from '@/components/product/productDetailTypes'
import CustomerPageZone from '@/components/product/CustomerPageZone'

export type ProductDetailSection = 'basic' | 'included' | 'logistics' | 'policy'

function DetailInfoBlock({
  icon: Icon,
  iconClassName,
  title,
  html,
  variant = 'default',
}: {
  icon: LucideIcon
  iconClassName: string
  title: string
  html: string
  variant?: 'default' | 'airbnb'
}) {
  return (
    <div
      className={
        variant === 'airbnb'
          ? 'airbnb-detail-info-block'
          : 'rounded-xl bg-slate-50 p-4 sm:border sm:border-slate-200 sm:bg-white sm:p-6 sm:shadow-sm'
      }
    >
      <div
        className={
          variant === 'airbnb'
            ? 'airbnb-detail-info-block-header'
            : 'mb-2.5 flex items-center gap-2 sm:mb-3 sm:gap-2.5'
        }
      >
        <Icon
          className={`${variant === 'airbnb' ? 'airbnb-detail-info-block-icon' : 'h-4 w-4 shrink-0 sm:h-5 sm:w-5'} ${iconClassName}`}
          aria-hidden
        />
        <h4
          className={
            variant === 'airbnb'
              ? 'airbnb-detail-info-block-title'
              : 'text-sm font-semibold text-gray-900 sm:text-lg'
          }
        >
          {title}
        </h4>
      </div>
      <div
        className="prose prose-sm max-w-none text-xs leading-relaxed text-gray-700 sm:text-sm"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(html) }}
      />
    </div>
  )
}

function DetailEmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="rounded-feature border border-dashed border-border/60 bg-muted/30 py-8 text-center sm:py-12">
      <Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground sm:h-10 sm:w-10" aria-hidden />
      <p className="text-xs text-muted-foreground sm:text-sm">{message}</p>
    </div>
  )
}

type ProductDetailDetailsTabProps = {
  product: ProductDetailsTabProduct
  productDetails: ProductDetailsFields | null
  categoryLabel: string
  durationLabel: string
  locale: string
  tagLabelMap: TagLabelMap
  section: ProductDetailSection
  variant?: 'default' | 'airbnb'
}

export default function ProductDetailDetailsTab({
  product,
  productDetails,
  categoryLabel,
  durationLabel,
  locale,
  tagLabelMap,
  section,
  variant = 'default',
}: ProductDetailDetailsTabProps) {
  const t = useTranslations('productDetail')

  const InfoBlock = (
    props: Omit<ComponentProps<typeof DetailInfoBlock>, 'variant'>
  ) => <DetailInfoBlock {...props} variant={variant} />

  const showDetailOnCustomerPage = (field: string) =>
    isProductDetailVisibleOnCustomerPage(productDetails?.customer_page_visibility, field)

  const hasVisibleIncludedDetailCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.included && s('included')) ||
      (productDetails.not_included && s('not_included'))
    )
  }, [productDetails])

  const hasVisibleLogisticsCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.pickup_drop_info && s('pickup_drop_info')) ||
      (productDetails.luggage_info && s('luggage_info')) ||
      (productDetails.tour_operation_info && s('tour_operation_info')) ||
      (productDetails.preparation_info && s('preparation_info')) ||
      (productDetails.small_group_info && s('small_group_info')) ||
      (productDetails.companion_recruitment_info && s('companion_recruitment_info')) ||
      (productDetails.notice_info && s('notice_info'))
    )
  }, [productDetails])

  const hasVisiblePolicyCards = useMemo(() => {
    if (!productDetails) return false
    const s = showDetailOnCustomerPage
    return !!(
      (productDetails.important_notes && s('important_notes')) ||
      (productDetails.private_tour_info && s('private_tour_info')) ||
      (productDetails.cancellation_policy && s('cancellation_policy')) ||
      (productDetails.chat_announcement && s('chat_announcement'))
    )
  }, [productDetails])

  return (
    <CustomerPageZone zone="detail-details-body" className="space-y-4 sm:space-y-6">
                    {/* 기본정보 */}
                    {section === 'basic' && (
                      <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                          <div>
                            <h4 className="mb-2 text-sm font-medium text-gray-900 sm:mb-3">{t('keyInformation')}</h4>
                            <dl className="space-y-2.5 text-xs sm:space-y-3 sm:text-sm">
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{t('category')}</dt>
                                <dd className="text-gray-900">{categoryLabel}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{t('subcategory')}</dt>
                                <dd className="text-gray-900">{product.sub_category || t('notSpecified')}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{t('duration')}</dt>
                                <dd className="text-gray-900">{durationLabel}</dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{t('maxParticipants')}</dt>
                                <dd className="text-gray-900">
                                  {product.max_participants || 0}
                                  {t('peopleUnit')}
                                </dd>
                              </div>
                              <div className="flex justify-between">
                                <dt className="text-gray-600">{t('status')}</dt>
                                <dd className="text-gray-900">{product.status || t('notSpecified')}</dd>
                              </div>
                              {product.group_size && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{t('groupSize')}</dt>
                                  <dd className="text-gray-900">{product.group_size}</dd>
                                </div>
                              )}
                            </dl>
                          </div>

                          <div>
                            <h4 className="mb-2 text-sm font-medium text-gray-900 sm:mb-3">{t('ageGuidelines')}</h4>
                            <dl className="space-y-2.5 text-xs sm:space-y-3 sm:text-sm">
                              {product.adult_age && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{t('adultAge')}</dt>
                                  <dd className="text-gray-900">
                                    {t('adultAgeValue', { age: product.adult_age })}
                                  </dd>
                                </div>
                              )}
                              {product.child_age_min && product.child_age_max && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{t('childAge')}</dt>
                                  <dd className="text-gray-900">
                                    {t('childAgeValue', {
                                      min: product.child_age_min,
                                      max: product.child_age_max,
                                    })}
                                  </dd>
                                </div>
                              )}
                              {product.infant_age && (
                                <div className="flex justify-between">
                                  <dt className="text-gray-600">{t('infantAge')}</dt>
                                  <dd className="text-gray-900">
                                    {t('infantAgeValue', { age: product.infant_age })}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        </div>

                        {/* 언어 정보 */}
                        {product.languages && product.languages.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-sm font-medium text-gray-900 sm:mb-3">{t('supportedLanguages')}</h4>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {product.languages.map((language, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 sm:px-3 sm:py-1 sm:text-sm"
                                >
                                  {language}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 출발/도착 정보 */}
                        {(getProductDepartureCity(product, locale) ||
                          getProductArrivalCity(product, locale)) && (
                          <div>
                            <h4 className="mb-2 text-sm font-medium text-gray-900 sm:mb-3">{t('departureArrival')}</h4>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
                              {getProductDepartureCity(product, locale) && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-booking sm:h-4 sm:w-4" />
                                  <span className="text-gray-600">{t('departure')}</span>
                                  <span className="font-medium text-gray-900">
                                    {getProductDepartureCity(product, locale)}
                                  </span>
                                  {getProductDepartureCountry(product, locale) && (
                                    <span className="text-gray-500">
                                      ({getProductDepartureCountry(product, locale)})
                                    </span>
                                  )}
                                </div>
                              )}
                              {getProductArrivalCity(product, locale) && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-green-500 sm:h-4 sm:w-4" />
                                  <span className="text-gray-600">{t('arrival')}</span>
                                  <span className="font-medium text-gray-900">
                                    {getProductArrivalCity(product, locale)}
                                  </span>
                                  {getProductArrivalCountry(product, locale) && (
                                    <span className="text-gray-500">
                                      ({getProductArrivalCountry(product, locale)})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {(product.tags && product.tags.length > 0) || (productDetails?.tags && productDetails.tags.length > 0) ? (
                          <div>
                            <h4 className="mb-2 text-sm font-medium text-gray-900 sm:mb-3">{t('tags')}</h4>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {(productDetails?.tags || product.tags || []).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 sm:px-3 sm:py-1 sm:text-sm"
                                >
                                  {resolveTagLabel(tag, locale, tagLabelMap)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* 포함/불포함 */}
                    {section === 'included' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                          {productDetails?.included && showDetailOnCustomerPage('included') && (
<InfoBlock
                              icon={CheckCircle2}
                              iconClassName="text-green-600"
                              title={t('included')}
                              html={productDetails.included}
                            />
                          )}
                          {productDetails?.not_included && showDetailOnCustomerPage('not_included') && (
<InfoBlock
                              icon={XCircle}
                              iconClassName="text-red-600"
                              title={t('excluded')}
                              html={productDetails.not_included}
                            />
                          )}
                        </div>

                        {!hasVisibleIncludedDetailCards && (
                          <DetailEmptyState icon={ClipboardList} message={t('noInclusionDetails')} />
                        )}
                      </div>
                    )}

                    {/* 운영정보 */}
                    {section === 'logistics' && (
                      <div className="space-y-4">
                        <div
                          className={
                            variant === 'airbnb'
                              ? 'airbnb-detail-section-stack'
                              : 'grid grid-cols-1 gap-4'
                          }
                        >
                          {productDetails?.pickup_drop_info && showDetailOnCustomerPage('pickup_drop_info') && (
<InfoBlock
                              icon={Car}
                              iconClassName="text-booking"
                              title={t('pickupDropInfo')}
                              html={productDetails.pickup_drop_info}
                            />
                          )}
                          {productDetails?.luggage_info && showDetailOnCustomerPage('luggage_info') && (
<InfoBlock
                              icon={Luggage}
                              iconClassName="text-yellow-600"
                              title={t('luggageInfo')}
                              html={productDetails.luggage_info}
                            />
                          )}
                          {productDetails?.tour_operation_info && showDetailOnCustomerPage('tour_operation_info') && (
<InfoBlock
                              icon={Settings}
                              iconClassName="text-purple-600"
                              title={t('tourOperations')}
                              html={productDetails.tour_operation_info}
                            />
                          )}
                          {productDetails?.preparation_info && showDetailOnCustomerPage('preparation_info') && (
<InfoBlock
                              icon={Lightbulb}
                              iconClassName="text-orange-600"
                              title={t('preparationTips')}
                              html={productDetails.preparation_info}
                            />
                          )}
                          {productDetails?.small_group_info && showDetailOnCustomerPage('small_group_info') && (
<InfoBlock
                              icon={Users2}
                              iconClassName="text-indigo-600"
                              title={t('smallGroupInfo')}
                              html={productDetails.small_group_info}
                            />
                          )}
                          {productDetails?.companion_recruitment_info &&
                            showDetailOnCustomerPage('companion_recruitment_info') && (
  <InfoBlock
                                icon={Users2}
                                iconClassName="text-teal-600"
                                title={t('companionRecruitment')}
                                html={productDetails.companion_recruitment_info}
                              />
                            )}
                          {productDetails?.notice_info && showDetailOnCustomerPage('notice_info') && (
<InfoBlock
                              icon={AlertTriangle}
                              iconClassName="text-red-600"
                              title={t('importantNotes')}
                              html={productDetails.notice_info}
                            />
                          )}
                        </div>

                        {!hasVisibleLogisticsCards && (
                          <DetailEmptyState icon={Bus} message={t('noLogisticsInfo')} />
                        )}
                      </div>
                    )}

                    {/* 정책 */}
                    {section === 'policy' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          {productDetails?.important_notes && showDetailOnCustomerPage('important_notes') && (
<InfoBlock
                              icon={AlertTriangle}
                              iconClassName="text-amber-600"
                              title="IMPORTANT NOTES"
                              html={productDetails.important_notes}
                            />
                          )}
                          {productDetails?.private_tour_info && showDetailOnCustomerPage('private_tour_info') && (
<InfoBlock
                              icon={Users}
                              iconClassName="text-purple-600"
                              title={t('privateTourInfo')}
                              html={productDetails.private_tour_info}
                            />
                          )}
                          {productDetails?.cancellation_policy && showDetailOnCustomerPage('cancellation_policy') && (
<InfoBlock
                              icon={Shield}
                              iconClassName="text-red-600"
                              title={t('cancellationPolicy')}
                              html={productDetails.cancellation_policy}
                            />
                          )}
                          {productDetails?.chat_announcement && showDetailOnCustomerPage('chat_announcement') && (
<InfoBlock
                              icon={Megaphone}
                              iconClassName="text-booking"
                              title={t('announcements')}
                              html={productDetails.chat_announcement}
                            />
                          )}
                        </div>

                        {!hasVisiblePolicyCards && (
                          <DetailEmptyState icon={ClipboardList} message={t('noPolicyInfo')} />
                        )}
                      </div>
                    )}
    </CustomerPageZone>
  )
}
