'use client'

import { useTranslations } from 'next-intl'

export type CustomerReservationPricingData = {
  adults: number
  child: number
  infant: number
  total_people: number
  pricing?: {
    adult_product_price: number
    child_product_price: number
    infant_product_price: number
    product_price_total: number
    required_option_total: number
    option_total: number
    subtotal: number
    coupon_discount: number | null
    additional_discount: number | null
    additional_cost: number | null
    card_fee: number | null
    tax: number | null
    prepayment_cost: number | null
    prepayment_tip: number | null
    private_tour_additional_cost: number
    total_price: number
    deposit_amount: number
    balance_amount: number
    choices_total: number
  }
  products?: {
    base_price: number | null
  }
  payments?: Array<{
    payment_status: string
    amount: number
    payment_method: string
    note?: string
    submit_on: string
    confirmed_on?: string
    amount_krw?: number
  }>
}

type CustomerReservationPricingProps = {
  reservation: CustomerReservationPricingData
}

export default function CustomerReservationPricing({ reservation }: CustomerReservationPricingProps) {
  const t = useTranslations('common')

  return (
    <>
                 {(reservation.pricing || reservation.products?.base_price) && (
                   <div className="border-t border-gray-200 pt-4">
                     <h4 className="text-sm font-medium text-gray-900 mb-3">{t('priceInfo')}</h4>
                     <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                       {reservation.pricing ? (
                         <div className="divide-y divide-gray-200">
                           {/* 상품 가격 */}
                           <div className="p-4">
                             <div className="space-y-2 text-sm">
                              {reservation.adults > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">{t('adults')} x {reservation.adults}</span>
                                  <span className="font-medium text-gray-900">
                                    ${((reservation.pricing.adult_product_price || 0) * reservation.adults).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {reservation.child > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">{t('children')} x {reservation.child}</span>
                                  <span className="font-medium text-gray-900">
                                    ${((reservation.pricing.child_product_price || 0) * reservation.child).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {reservation.infant > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600">{t('infants')} x {reservation.infant}</span>
                                  <span className="font-medium text-gray-900">
                                    ${((reservation.pricing.infant_product_price || 0) * reservation.infant).toFixed(2)}
                                  </span>
                                </div>
                              )}
                               <div className="flex justify-between items-center pt-2 border-t border-gray-100 font-semibold">
                                 <span className="text-gray-800">{t('productTotal')}</span>
                                 <span className="text-gray-900">${(reservation.pricing.product_price_total || 0).toFixed(2)}</span>
                               </div>
                             </div>
                           </div>

                           {/* 옵션 가격 */}
                           {(reservation.pricing.required_option_total > 0 || reservation.pricing.option_total > 0) && (
                             <div className="p-4 bg-gray-50">
                               <div className="space-y-2 text-sm">
                                 {reservation.pricing.required_option_total > 0 && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('requiredOptions')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${(reservation.pricing.required_option_total || 0).toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.option_total > 0 && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('optionalOptions')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${(reservation.pricing.option_total || 0).toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-semibold">
                                   <span className="text-gray-800">{t('optionTotal')}</span>
                                   <span className="text-gray-900">
                                     ${((reservation.pricing.required_option_total || 0) + (reservation.pricing.option_total || 0)).toFixed(2)}
                                   </span>
                                 </div>
                               </div>
                             </div>
                           )}

                          {/* 소계 */}
                          <div className="p-4 bg-blue-50">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-blue-800">{t('subtotal')}</span>
                              <span className="text-lg font-bold text-blue-900">${(reservation.pricing.subtotal || 0).toFixed(2)}</span>
                            </div>
                          </div>

                          {/* 쿠폰 할인 */}
                          {reservation.pricing.coupon_discount !== 0 && reservation.pricing.coupon_discount !== null && (
                            <div className="p-4 bg-green-50">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-green-800">{t('couponDiscount')}</span>
                                <span className="text-lg font-bold text-green-900">
                                  {reservation.pricing.coupon_discount < 0 
                                    ? `-$${Math.abs(reservation.pricing.coupon_discount).toFixed(2)}` 
                                    : `$${reservation.pricing.coupon_discount.toFixed(2)}`}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Grand Total (할인 후 최종 결제액) */}
                          {reservation.pricing.coupon_discount !== 0 && reservation.pricing.coupon_discount !== null && (
                            <div className="p-4 bg-blue-100">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-blue-900">{t('grandTotal')}</span>
                                <span className="text-lg font-bold text-blue-900">
                                  ${((reservation.pricing.subtotal || 0) - Math.abs(reservation.pricing.coupon_discount || 0)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}
                          {/* 쿠폰 할인이 없을 때도 Grand Total 표시 */}
                          {(!reservation.pricing.coupon_discount || reservation.pricing.coupon_discount === 0) && (
                            <div className="p-4 bg-blue-100">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-semibold text-blue-900">{t('grandTotal')}</span>
                                <span className="text-lg font-bold text-blue-900">
                                  ${(reservation.pricing.subtotal || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* 결제 정보 */}
                          <div className="p-4 bg-gray-50">
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-1">
                                  <span className="text-gray-600">{t('deposit')}</span>
                                  {reservation.payments && reservation.payments.length > 0 && (
                                    <span className="text-xs text-gray-500">
                                      ({new Date(reservation.payments[0].submit_on).toLocaleDateString()})
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-indigo-600">${(reservation.pricing.deposit_amount || 0).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600">{t('balance')}</span>
                                <span className="font-bold text-purple-600">${(reservation.pricing.balance_amount || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          {/* 기타 할인 및 추가 비용 */}
                          {(reservation.pricing.additional_discount !== 0 || 
                            reservation.pricing.additional_cost !== 0 || reservation.pricing.card_fee !== 0 || 
                            reservation.pricing.tax !== 0 || reservation.pricing.prepayment_cost !== 0 || 
                            reservation.pricing.prepayment_tip !== 0 || reservation.pricing.private_tour_additional_cost > 0) && (
                            <div className="p-4">
                              <div className="space-y-2 text-sm">
                                 {reservation.pricing.additional_discount !== 0 && reservation.pricing.additional_discount !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('additionalDiscount')}</span>
                                     <span className="font-medium text-green-600">
                                       ${reservation.pricing.additional_discount.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.additional_cost !== 0 && reservation.pricing.additional_cost !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('additionalCost')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.additional_cost.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.card_fee !== 0 && reservation.pricing.card_fee !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('cardFee')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.card_fee.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.tax !== 0 && reservation.pricing.tax !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('tax')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.tax.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.prepayment_cost !== 0 && reservation.pricing.prepayment_cost !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('prepaymentCost')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.prepayment_cost.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.prepayment_tip !== 0 && reservation.pricing.prepayment_tip !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('prepaymentTip')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.prepayment_tip.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                                 {reservation.pricing.private_tour_additional_cost > 0 && reservation.pricing.private_tour_additional_cost !== null && (
                                   <div className="flex justify-between items-center">
                                     <span className="text-gray-600">{t('privateTourAdditionalCost')}</span>
                                     <span className="font-medium text-gray-900">
                                       ${reservation.pricing.private_tour_additional_cost.toFixed(2)}
                                     </span>
                                   </div>
                                 )}
                               </div>
                             </div>
                           )}

                         </div>
                       ) : (
                         <div className="p-4">
                           <div className="space-y-2 text-sm">
                             <div className="flex justify-between items-center">
                               <span className="text-gray-600">{t('basePrice')}</span>
                               <span className="font-medium text-gray-900">
                                 ${(reservation.products?.base_price || 0).toFixed(2)} / {t('perPerson')}
                               </span>
                             </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">{t('totalPeople')}</span>
                              <span className="font-medium text-gray-900">{reservation.total_people} {reservation.total_people === 1 ? t('person') : t('people')}</span>
                            </div>
                             <div className="flex justify-between items-center pt-2 border-t border-gray-200 font-semibold">
                               <span className="text-gray-800">{t('estimatedTotal')}</span>
                               <span className="text-gray-900">
                                 ${((reservation.products?.base_price || 0) * reservation.total_people).toFixed(2)}
                               </span>
                             </div>
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}
    </>
  )
}
