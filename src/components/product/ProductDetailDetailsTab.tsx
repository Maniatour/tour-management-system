'use client'

import { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { markdownToHtml } from '@/components/LightRichEditor'
import { isProductDetailVisibleOnCustomerPage } from '@/lib/fetchProductDetailsForEmail'
import type { ProductDetailsFields, ProductDetailsTabProduct } from '@/components/product/productDetailTypes'
import CustomerPageZone from '@/components/product/CustomerPageZone'

type ProductDetailDetailsTabProps = {
  product: ProductDetailsTabProduct
  productDetails: ProductDetailsFields | null
  categoryLabel: string
  durationLabel: string
}

export default function ProductDetailDetailsTab({
  product,
  productDetails,
  categoryLabel,
  durationLabel,
}: ProductDetailDetailsTabProps) {
  const t = useTranslations('productDetail')
  const [activeDetailTab, setActiveDetailTab] = useState('basic')

  const detailTabs = [
    { id: 'basic', label: t('detailTabBasic') },
    { id: 'included', label: t('detailTabIncluded') },
    { id: 'logistics', label: t('detailTabLogistics') },
    { id: 'policy', label: t('detailTabPolicy') },
  ]

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
    <CustomerPageZone zone="detail-details-body" className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900">{t("detailedTourInformation")}</h3>
                    
                    {/* 상세정보 서브 탭 네비게이션 */}
                    <div className="border-b border-gray-200">
                      <nav className="-mb-px flex overflow-x-auto scrollbar-hide">
                        <div className="flex space-x-2 sm:space-x-8 min-w-max px-4 sm:px-0">
                          {detailTabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setActiveDetailTab(tab.id)}
                              className={`py-2 sm:py-2 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 transition-colors touch-optimized mobile-button ${
                                activeDetailTab === tab.id
                                  ? 'border-blue-500 text-blue-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </nav>
                    </div>

                    {/* 기본정보 탭 */}
                    {activeDetailTab === 'basic' && (
                      <div className="space-y-6">
                        {/* 기본 정보 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{t('keyInformation')}</h4>
                            <dl className="space-y-3 text-sm">
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
                            <h4 className="font-medium text-gray-900 mb-3">{t('ageGuidelines')}</h4>
                            <dl className="space-y-3 text-sm">
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
                            <h4 className="font-medium text-gray-900 mb-3">{t('supportedLanguages')}</h4>
                            <div className="flex flex-wrap gap-2">
                              {product.languages.map((language, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                                >
                                  {language}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 출발/도착 정보 */}
                        {(product.departure_city || product.arrival_city) && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{t('departureArrival')}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {product.departure_city && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm text-gray-600">{t('departure')}</span>
                                  <span className="text-sm font-medium">{product.departure_city}</span>
                                  {product.departure_country && (
                                    <span className="text-sm text-gray-500">({product.departure_country})</span>
                                  )}
                                </div>
                              )}
                              {product.arrival_city && (
                                <div className="flex items-center space-x-2">
                                  <MapPin className="h-4 w-4 text-green-500" />
                                  <span className="text-sm text-gray-600">{t('arrival')}</span>
                                  <span className="text-sm font-medium">{product.arrival_city}</span>
                                  {product.arrival_country && (
                                    <span className="text-sm text-gray-500">({product.arrival_country})</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 태그 */}
                        {(product.tags && product.tags.length > 0) || (productDetails?.tags && productDetails.tags.length > 0) && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">{t('tags')}</h4>
                            <div className="flex flex-wrap gap-2">
                              {(productDetails?.tags || product.tags || []).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 포함/불포함 탭 */}
                    {activeDetailTab === 'included' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {productDetails?.included && showDetailOnCustomerPage('included') && (
                            <div className="group relative overflow-hidden bg-white border border-green-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('included')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.included || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {productDetails?.not_included && showDetailOnCustomerPage('not_included') && (
                            <div className="group relative overflow-hidden bg-white border border-red-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                                    <XCircle className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('excluded')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.not_included || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!hasVisibleIncludedDetailCards && (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 mb-2 text-4xl">📋</div>
                            <p className="text-gray-600">{t('noInclusionDetails')}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 운영정보 탭 */}
                    {activeDetailTab === 'logistics' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {productDetails?.pickup_drop_info && showDetailOnCustomerPage('pickup_drop_info') && (
                            <div className="group relative overflow-hidden bg-white border border-blue-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                                    <Car className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('pickupDropInfo')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.pickup_drop_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.luggage_info && showDetailOnCustomerPage('luggage_info') && (
                            <div className="group relative overflow-hidden bg-white border border-yellow-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg">
                                    <Luggage className="w-5 h-5 text-yellow-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('luggageInfo')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.luggage_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.tour_operation_info && showDetailOnCustomerPage('tour_operation_info') && (
                            <div className="group relative overflow-hidden bg-white border border-purple-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                                    <Settings className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('tourOperations')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.tour_operation_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.preparation_info && showDetailOnCustomerPage('preparation_info') && (
                            <div className="group relative overflow-hidden bg-white border border-orange-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg">
                                    <Lightbulb className="w-5 h-5 text-orange-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('preparationTips')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.preparation_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.small_group_info && showDetailOnCustomerPage('small_group_info') && (
                            <div className="group relative overflow-hidden bg-white border border-indigo-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg">
                                    <Users2 className="w-5 h-5 text-indigo-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('smallGroupInfo')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.small_group_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {productDetails?.companion_recruitment_info && showDetailOnCustomerPage('companion_recruitment_info') && (
                            <div className="group relative overflow-hidden bg-white border border-teal-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg">
                                    <Users2 className="w-5 h-5 text-teal-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('companionRecruitment')}</h4>
                                </div>
                                <div
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: markdownToHtml(productDetails.companion_recruitment_info || '')
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.notice_info && showDetailOnCustomerPage('notice_info') && (
                            <div className="group relative overflow-hidden bg-white border border-red-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('importantNotes')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.notice_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!hasVisibleLogisticsCards && (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 mb-2 text-4xl">🚌</div>
                            <p className="text-gray-600">{t('noLogisticsInfo')}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 정책 탭 */}
                    {activeDetailTab === 'policy' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {productDetails?.important_notes && showDetailOnCustomerPage('important_notes') && (
                            <div className="group relative overflow-hidden bg-white border border-amber-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">IMPORTANT NOTES</h4>
                                </div>
                                <div
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{
                                    __html: markdownToHtml(productDetails.important_notes || '')
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          {productDetails?.private_tour_info && showDetailOnCustomerPage('private_tour_info') && (
                            <div className="group relative overflow-hidden bg-white border border-purple-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                                    <Users className="w-5 h-5 text-purple-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('privateTourInfo')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.private_tour_info || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.cancellation_policy && showDetailOnCustomerPage('cancellation_policy') && (
                            <div className="group relative overflow-hidden bg-white border border-red-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                                    <Shield className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('cancellationPolicy')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.cancellation_policy || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                          
                          {productDetails?.chat_announcement && showDetailOnCustomerPage('chat_announcement') && (
                            <div className="group relative overflow-hidden bg-white border border-blue-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"></div>
                              <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                                    <Megaphone className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <h4 className="text-lg font-semibold text-gray-900">{t('announcements')}</h4>
                                </div>
                                <div 
                                  className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: markdownToHtml(productDetails.chat_announcement || '') 
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!hasVisiblePolicyCards && (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 mb-2 text-4xl">📋</div>
                            <p className="text-gray-600">{t('noPolicyInfo')}</p>
                          </div>
                        )}
                      </div>
                    )}
    </CustomerPageZone>
  )
}
