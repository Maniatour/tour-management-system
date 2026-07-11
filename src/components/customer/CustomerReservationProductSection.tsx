'use client'

import { Calendar, MapPin } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { MultilingualProductDetails, ReservationDetails } from '@/components/customer/customerReservationTypes'
import { calculateDuration, formatTimeToAMPM } from '@/lib/reservationDisplayUtils'

type CustomerReservationProductSectionProps = {
  reservation: {
    id: string
    tour_date: string
    multilingualDetails?: MultilingualProductDetails | null
  }
  details?: ReservationDetails | null
}

export default function CustomerReservationProductSection({
  reservation,
  details,
}: CustomerReservationProductSectionProps) {
  const t = useTranslations('common')
  const locale = useLocale()

  return (
    <>
                    {/* Recruiting 상태 안내문 - Product Details 위에 표시 */}
                    {((details?.tourDetails?.tour_status?.toLowerCase() === 'recruiting' || 
                       details?.tourDetails?.status?.toLowerCase() === 'recruiting') && 
                       (details?.productDetails || reservation.multilingualDetails)) && (
                      <div className="mb-6">
                        <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3 flex-1">
                              <p className="text-sm font-semibold text-primary">
                                {t('recruitingNotice')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 상품 세부 정보 */}
                    {(details?.productDetails || reservation.multilingualDetails) && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <MapPin className="w-5 h-5 mr-2" />
                          {t('productDetails')}
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                          {/* 다국어 상품 세부 정보 우선 표시 */}
                          {reservation.multilingualDetails?.included && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('included')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.included}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.not_included && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('notIncluded')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.not_included}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.pickup_drop_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('meetingPoint')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.pickup_drop_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.cancellation_policy && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('cancellationPolicy')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.cancellation_policy}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.luggage_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('luggageInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.luggage_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.tour_operation_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('tourOperationInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.tour_operation_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.preparation_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('preparationInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.preparation_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.small_group_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('smallGroupInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.small_group_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.notice_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('noticeInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.notice_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.private_tour_info && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('privateTourInfo')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.private_tour_info}</p>
                            </div>
                          )}
                          {reservation.multilingualDetails?.chat_announcement && (
                            <div>
                              <h5 className="text-base font-bold text-gray-900 mb-3">{t('chatAnnouncement')}</h5>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{reservation.multilingualDetails.chat_announcement}</p>
                            </div>
                          )}
                          
                          {/* 기존 상품 세부 정보 (다국어 정보가 없을 때만 표시) */}
                          {!reservation.multilingualDetails && details?.productDetails && (
                            <>
                              {details?.productDetails?.description && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('productDescription')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{details?.productDetails?.description}</p>
                                </div>
                              )}
                              {details?.productDetails?.highlights && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('highlights')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{details?.productDetails?.highlights}</p>
                                </div>
                              )}
                              {details?.productDetails?.included && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('included')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{details?.productDetails?.included}</p>
                                </div>
                              )}
                              {details?.productDetails?.not_included && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('notIncluded')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{details?.productDetails?.not_included}</p>
                                </div>
                              )}
                              {details?.productDetails?.meeting_point && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('meetingPoint')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{details?.productDetails?.meeting_point}</p>
                                </div>
                              )}
                              {details?.productDetails?.cancellation_policy && (
                                <div>
                                  <h5 className="font-medium text-gray-900 mb-1">{t('cancellationPolicy')}</h5>
                                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{details?.productDetails?.cancellation_policy}</p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 상품 스케줄 */}
                    {details?.productSchedules && details?.productSchedules!.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Calendar className="w-5 h-5 mr-2" />
                          {t('tourSchedule')}
                        </h4>
                        <div className="space-y-3">
                          {details?.productSchedules!.map((schedule) => (
                            <div key={schedule.id} className="bg-gray-50 p-3 rounded-md border-l-4 border-green-500">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="space-y-2">
                                    {/* 시간 정보와 소요시간 - 같은 줄에 배치 */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                    {schedule.start_time && (
                                        <span className="text-sm font-medium text-green-700">
                                        {formatTimeToAMPM(schedule.start_time)}
                                        {schedule.end_time && ` - ${formatTimeToAMPM(schedule.end_time)}`}
                                      </span>
                                    )}
                                    {schedule.start_time && schedule.end_time && calculateDuration(schedule.start_time, schedule.end_time) && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {calculateDuration(schedule.start_time, schedule.end_time)}
                                      </span>
                                    )}
                                    </div>
                                    {/* 스케줄 제목 - 별도 줄에 표시 */}
                                    <div>
                                    <span className="text-sm font-semibold text-gray-900">
                                      {locale === 'ko' 
                                        ? (schedule.title_ko || schedule.title_en)
                                        : (schedule.title_en || schedule.title_ko)
                                      }
                                    </span>
                                    </div>
                                  </div>
                                  {(locale === 'ko' ? schedule.description_ko : schedule.description_en) && (
                                    <p className="text-xs text-gray-600 whitespace-pre-wrap">
                                      {locale === 'ko' 
                                        ? schedule.description_ko
                                        : schedule.description_en
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
    </>
  )
}
