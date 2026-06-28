'use client'

import Image from 'next/image'
import { Calendar, Clock, MapPin, Users, User, Phone, Mail, Printer } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import CustomerReservationPricing from '@/components/customer/CustomerReservationPricing'
import CustomerReservationProductSection from '@/components/customer/CustomerReservationProductSection'
import CustomerReservationPickupSection from '@/components/customer/CustomerReservationPickupSection'
import CustomerReservationTourSection from '@/components/customer/CustomerReservationTourSection'
import type {
  CustomerReservationCardData,
  CustomerReservationChannel,
  CustomerReservationCustomer,
  ReservationDetails,
} from '@/components/customer/customerReservationTypes'
import { calculatePickupDate, formatTimeToAMPM } from '@/lib/reservationDisplayUtils'

type CustomerReservationCardProps = {
  reservation: CustomerReservationCardData
  customer: CustomerReservationCustomer | null
  channels: CustomerReservationChannel[]
  details?: ReservationDetails | null
  onPrint: () => void
  onSelectMedia: (url: string) => void
}

export default function CustomerReservationCard({
  reservation,
  customer,
  channels,
  details,
  onPrint,
  onSelectMedia,
}: CustomerReservationCardProps) {
  const t = useTranslations('common')
  const locale = useLocale()

  const getStatusText = (status: string) => {
    switch (status) {
      case 'inquiry': return t('inquiry')
      case 'pending': return t('pending')
      case 'confirmed': return t('confirmed')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      case 'no_show': return t('no_show')
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'inquiry': return 'bg-sky-100 text-sky-900'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no_show': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getOptionDisplayName = (option?: { name_ko: string; name_en: string } | null) =>
    locale === 'ko'
      ? (option?.name_ko || option?.name_en || t('unknownOption'))
      : (option?.name_en || option?.name_ko || t('unknownOption'))

  return (
              <div key={reservation.id} id={`reservation-${reservation.id}`} className="bg-white shadow-sm p-4 sm:p-6 rounded-none sm:rounded-lg print:p-4 print:shadow-none print:border print:rounded">

                {/* 모바일에서 STATUS 버튼과 액션 버튼들을 제목 윗줄에 배치 */}
                <div className="flex items-center justify-between mb-2 sm:hidden print:hidden">
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                    {getStatusText(reservation.status)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onPrint()}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      {t('print')}
                    </button>
                  </div>
                </div>
                
                <div className="flex items-start justify-between mb-2 sm:mb-4">
                  <div className="flex-1">
                     <div className="flex items-center flex-wrap gap-2 mb-2">
                       <h3 className="text-base sm:text-xl font-semibold text-gray-900">
                         {locale === 'ko' 
                           ? (reservation.products?.customer_name_ko || reservation.products?.name || t('noProductName'))
                           : (reservation.products?.customer_name_en || reservation.products?.name || t('noProductName'))
                         }
                       </h3>
                       {/* Choice 옵션 뱃지 */}
                       {reservation.reservationChoices && reservation.reservationChoices.length > 0 && (
                         <div className="flex flex-wrap gap-1">
                           {(() => {
                            // 중복 제거: 같은 option_name을 가진 것들을 합침
                            const uniqueChoices = reservation.reservationChoices.reduce((acc: Array<{
                              choice_id: string;
                              option_id: string;
                              quantity: number;
                              total_price: number;
                              choice?: { id: string; name_ko: string; name_en: string } | null;
                              option?: { id: string; name_ko: string; name_en: string } | null;
                            }>, choice: {
                              choice_id: string;
                              option_id: string;
                              quantity: number;
                              total_price: number;
                              choice?: { id: string; name_ko: string; name_en: string } | null;
                              option?: { id: string; name_ko: string; name_en: string } | null;
                            }) => {
                               const optionName = getOptionDisplayName(choice.option);
                               
                               const existing = acc.find(item => {
                                 const itemOptionName = getOptionDisplayName(item.option);
                                 return itemOptionName === optionName;
                               });
                               
                               if (existing) {
                                 // 기존 항목이 있으면 수량과 가격을 합침
                                 existing.quantity += choice.quantity || 1;
                                 existing.total_price += choice.total_price || 0;
                               } else {
                                 // 새로운 항목 추가
                                 acc.push({ ...choice });
                               }
                               
                               return acc;
                             }, []);
                             
                             return uniqueChoices.map((choice, index) => {
                               const optionName = getOptionDisplayName(choice.option);
                               
                               return (
                                 <span
                                   key={`${choice.choice_id}-${choice.option_id}-${index}`}
                                   className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                 >
                                   {optionName}
                                 </span>
                               );
                             });
                           })()}
                         </div>
                       )}
                     </div>
                     
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      onClick={() => onPrint()}
                      className="hidden sm:inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      {t('print')}
                    </button>
                    <span className={`hidden sm:inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(reservation.status)}`}>
                    {getStatusText(reservation.status)}
                  </span>
                  </div>
                </div>

                {/* 첫 번째 줄: 이름, 전화번호, 이메일 (4열 그리드, 이메일 3-4열 머지) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 print:grid-cols-4 print:gap-6">
                  {/* 고객 이름 */}
                  {customer && (
                    <div className="flex items-center text-gray-600">
                      <User className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="text-sm font-semibold truncate">{customer.name}</span>
                    </div>
                  )}

                  {/* 고객 전화번호 */}
                  {customer && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="text-sm font-semibold truncate">{customer.phone || t('notAvailable')}</span>
                    </div>
                  )}

                  {/* 고객 이메일 - 3,4열 머지 */}
                  {(customer?.email || reservation.customer_email) && (
                    <div className="flex items-center text-gray-600 md:col-span-2 min-w-0">
                      <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="text-sm font-semibold truncate print-email-full">{customer?.email || reservation.customer_email || t('notAvailable')}</span>
                    </div>
                  )}
                </div>

                {/* 두 번째 줄: 투어날짜, 총인원, 채널 (4열 그리드, 1,2,3열에 배치, 4열 비움) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 print:grid-cols-4 print:gap-6">
                  {/* 투어 날짜 */}
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      {reservation.tour_date}
                    </span>
                  </div>

                  {/* 총 인원 */}
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {reservation.total_people === 1
                          ? t('totalOnePerson')
                          : t('totalPeopleLabel', { count: reservation.total_people })}
                      </span>
                      <span className="text-xs font-normal text-gray-500">
                        ({t('participantsBreakdown', {
                          adults: reservation.adults,
                          children: reservation.child,
                          infants: reservation.infant,
                        })})
                      </span>
                    </div>
                  </div>

                  {/* 채널 정보 */}
                  {(reservation.channel_id || reservation.channel_rn) && (
                    <div className="flex items-center text-gray-600 print:flex-col print:items-start">
                      {(() => {
                        const channel = channels.find(c => c.id === reservation.channel_id)
                        return (
                          <>
                            {channel && (
                          <>
                            <div className="flex items-center print:mb-1">
                              {channel.favicon_url ? (
                                <Image
                                  src={channel.favicon_url}
                                  alt={`${channel.name} favicon`}
                                  width={16}
                                  height={16}
                                  className="mr-2 h-4 w-4 shrink-0 rounded print:mr-2 print:h-6 print:w-6"
                                  style={{ width: 'auto', height: 'auto' }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    const parent = target.parentElement
                                    if (parent) {
                                      const fallback = document.createElement('div')
                                      fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0 mr-2'
                                      fallback.innerHTML = '🌐'
                                      parent.appendChild(fallback)
                                    }
                                  }}
                                />
                              ) : (
                                <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0 mr-2">
                                  🌐
                                </div>
                              )}
                              <span className="text-sm">{channel.name}</span>
                            </div>
                  {reservation.channel_rn && (
                                  <span className="text-sm ml-2 text-blue-600 font-medium print:ml-0 print:block">
                                    (#{reservation.channel_rn})
                      </span>
                                )}
                              </>
                            )}
                            {!channel && reservation.channel_id && (
                              <span className="text-sm">{t('channelNotFoundWithId', { id: reservation.channel_id })}</span>
                            )}
                            {!channel && !reservation.channel_id && reservation.channel_rn && (
                              <span className="text-sm text-blue-600 font-medium">
                                {t('channelReservationNumber', { number: reservation.channel_rn })}
                      </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </div>

                {/* 세 번째 줄: 픽업 시간 (1열), 픽업 호텔 및 픽업 장소 (2,3,4열 머지) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 print:grid-cols-4 print:gap-6">
                  {/* 픽업 시간 */}
                  {reservation.pickup_time && (
                    <div className="flex items-center text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">
                        {t('pickup')}: <span className="font-semibold text-blue-600">{formatTimeToAMPM(reservation.pickup_time)}</span>
                        {reservation.tour_date && (
                          <span className="ml-1 font-semibold text-blue-600">
                            ({calculatePickupDate(reservation.pickup_time, reservation.tour_date)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* 픽업 호텔 및 픽업 장소 (2,3,4열 머지) */}
                  {reservation.pickupHotelInfo && (
                    <div className="flex items-center text-gray-600 md:col-span-3">
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{reservation.pickupHotelInfo.hotel}</span>
                        {reservation.pickupHotelInfo.pick_up_location && (
                          <span className="text-xs text-gray-500 ml-2">({reservation.pickupHotelInfo.pick_up_location})</span>
                        )}
                        {reservation.pickupHotelInfo.address && (
                          <span className="text-xs text-gray-500 ml-2">- {reservation.pickupHotelInfo.address}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                 <CustomerReservationPricing reservation={reservation} />

                {/* 특이사항 */}
                {reservation.event_note && (
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-2">{t('specialNotes')}</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">
                      {reservation.event_note}
                    </p>
                  </div>
                )}

                {/* 상세 정보 */}
                  <div className="border-t border-gray-200 pt-6 mt-4 space-y-6">
                    <CustomerReservationProductSection
                      reservation={reservation}
                      details={details ?? null}
                    />
                    <CustomerReservationPickupSection
                      reservation={reservation}
                      pickupSchedule={details?.pickupSchedule ?? null}
                      onSelectMedia={onSelectMedia}
                    />
                    <CustomerReservationTourSection
                      tourDetails={details?.tourDetails ?? null}
                      onSelectMedia={onSelectMedia}
                    />

                    {/* 예약 일시 */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <p className="text-xs text-gray-500">
                          {t('reservationDate')}: {new Date(reservation.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}
                        </p>
                      </div>

                      {/* 프린트용 푸터 */}
                      <div className="hidden print:block text-center mt-8 print:mt-6 text-xs text-gray-500">
                        <p>{t('reservationPrintFooter')}</p>
                      </div>
                    </div>
                  </div>
  )
}
