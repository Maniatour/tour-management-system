'use client'

import Image from 'next/image'
import { Clock, ExternalLink, User, Users } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import type { PickupSchedule } from '@/components/customer/customerReservationTypes'
import {
  calculatePickupDate,
  formatTimeToAMPM,
  isBefore48Hours,
} from '@/lib/reservationDisplayUtils'
import PickupHotelLocationDescriptionDisplay from '@/components/pickup-hotel/PickupHotelLocationDescriptionDisplay'
import type { PickupHotel } from '@/utils/pickupHotelUtils'

type CustomerReservationPickupSectionProps = {
  reservation: {
    id: string
    tour_date: string
    pickup_hotel: string | null
  }
  pickupSchedule?: PickupSchedule | null
  onSelectMedia: (url: string) => void
}

export default function CustomerReservationPickupSection({
  reservation,
  pickupSchedule,
  onSelectMedia,
}: CustomerReservationPickupSectionProps) {
  const t = useTranslations('common')
  const locale = useLocale()

  if (!pickupSchedule) return null

  return (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Clock className="w-5 h-5 mr-2" />
                          {t('pickupSchedule')}
                        </h4>
                        
                        {/* 자신의 픽업 정보 */}
                        <div className="bg-primary/5 p-4 rounded-lg mb-4">
                          <h5 className="font-semibold text-primary mb-3 flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {t('myPickup')}
                          </h5>
                          <div className="space-y-4">
                            {/* 픽업 타임만 표시 */}
                            <div>
                              <h6 className="font-medium text-gray-900 mb-2">{t('pickupTime')}</h6>
                              {(() => {
                                const pickupTime = pickupSchedule?.pickup_time
                                const tourDate = pickupSchedule?.tour_date || reservation.tour_date
                                const isBefore48H = tourDate ? isBefore48Hours(tourDate) : false
                                return pickupTime ? (
                                  <>
                                    <p className="text-sm text-gray-700">
                                      <span className={`font-semibold ${isBefore48H ? 'text-orange-600' : 'text-primary'}`}>
                                        {formatTimeToAMPM(pickupTime)}
                                      </span>
                                      {tourDate && (
                                        <span className={`ml-2 font-semibold ${isBefore48H ? 'text-orange-600' : 'text-primary'}`}>
                                          ({calculatePickupDate(pickupTime, tourDate)})
                                        </span>
                                      )}
                                      {isBefore48H && (
                                        <span className="ml-2 text-xs text-orange-600 font-medium">
                                          (대략적인 시간)
                                        </span>
                                      )}
                                    </p>
                                    {/* 48시간 전 안내문 */}
                                    {tourDate && isBefore48Hours(tourDate) && (
                                      <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r space-y-2">
                                        <p className="text-sm text-yellow-800 font-semibold">
                                          {t('pickupTimeApproximate')}
                                        </p>
                                        <p className="text-xs text-yellow-700 leading-relaxed">
                                          {t('pickupTimeNotice')}
                                        </p>
                                      </div>
                                    )}
                                    {/* 픽업 호텔 미선택 안내 */}
                                    {tourDate && isBefore48Hours(tourDate) && !reservation.pickup_hotel && (
                                      <div className="mt-2 bg-red-50 border-l-4 border-red-400 p-3 rounded-r">
                                        <p className="text-xs text-red-800 font-medium">
                                          {t('pickupHotelNotSelected')}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : null
                              })()}
                            </div>
                            
                            {/* 픽업 호텔 상세 정보 */}
                                    {(() => {
                              const pickupHotelData = pickupSchedule?.pickup_hotels;
                              if (pickupHotelData?.hotel) {
                                return (
                                  <div className="mt-4">
                                <h6 className="font-medium text-gray-900 mb-2">{t('pickupHotel')}</h6>
                                    <p className="text-sm text-gray-700">{pickupHotelData.hotel}</p>
                                    <p className="text-xs text-gray-600">{pickupHotelData.pick_up_location}</p>
                                    <div className="mt-2">
                                      <PickupHotelLocationDescriptionDisplay
                                        hotel={pickupHotelData as PickupHotel}
                                        locale={locale === 'en' ? 'en' : 'ko'}
                                        compact
                                      />
                                    </div>
                                    {pickupHotelData.address && (
                                      <p className="text-xs text-gray-600">{pickupHotelData.address}</p>
                                )}
                                <div className="mt-2 space-y-1">
                                      {pickupHotelData.link && (
                                    <a 
                                          href={pickupHotelData.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-primary hover:text-primary/80 text-xs"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                      {t('viewOnMap')}
                                    </a>
                                  )}
                                      {pickupHotelData.youtube_link && (
                                    <a 
                                          href={pickupHotelData.youtube_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center text-red-600 hover:text-red-800 text-xs"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm6.39-2.908a.75.75 0 01.766.027l3.5 2.25a.75.75 0 010 1.262l-3.5 2.25A.75.75 0 018 12.25v-4.5a.75.75 0 01.39-.658z" clipRule="evenodd" />
                                      </svg>
                                      {t('viewVideo')}
                                    </a>
                                  )}
                                </div>
                              </div>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* MEDIA 섹션 - 데스크톱 4열, 모바일 2열 */}
                            {(() => {
                              const pickupHotelData = pickupSchedule?.pickup_hotels;
                              const mediaUrls = pickupHotelData?.media;
                              
                              if (mediaUrls && Array.isArray(mediaUrls) && mediaUrls.length > 0) {
                                return (
                                  <div className="mt-4">
                                    <h6 className="font-medium text-gray-900 mb-2">{t('media')}</h6>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      {mediaUrls.filter((mediaUrl): mediaUrl is string => Boolean(mediaUrl)).map((mediaUrl: string, index: number) => (
                                        <div 
                                          key={index}
                                          className="relative cursor-pointer group"
                                          onClick={() => onSelectMedia(mediaUrl)}
                                        >
                                          <div className="aspect-[4/3] w-full">
                                            <Image 
                                              src={mediaUrl}
                                              alt={`Hotel Media ${index + 1}`}
                                              width={200}
                                              height={150}
                                              className="w-full h-full object-cover rounded-lg border hover:opacity-80 transition-opacity print:w-32 print:h-24"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                              }}
                                            />
                                          </div>
                                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                                            <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* 모든 픽업 정보 */}
                        {pickupSchedule?.allPickups && (pickupSchedule?.allPickups?.length || 0) > 0 && (
                          <div>
                            <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {t('allPickups')}
                            </h5>
                            {/* All Pickups 안내문 */}
                            {(() => {
                              const tourDate = pickupSchedule?.tour_date || reservation.tour_date
                              const isBefore48H = tourDate ? isBefore48Hours(tourDate) : false
                              return isBefore48H ? (
                                <div className="mb-3 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r space-y-2">
                                  <p className="text-sm text-yellow-800 font-semibold">
                                    {t('allPickupTimeNotice')}
                                  </p>
                                  <p className="text-xs text-yellow-700 leading-relaxed">
                                    {t('pickupTimeNotice')}
                                  </p>
                                </div>
                              ) : null
                            })()}
                            <div className="space-y-3">
                              {pickupSchedule?.allPickups!.map((pickup) => (
                                <div key={pickup.reservation_id} className={`p-3 rounded-md border-l-4 ${
                                  pickup.reservation_id === reservation.id ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50'
                                }`}>
                                  <div className="space-y-2">
                                    {/* 첫 번째 줄: 픽업 시간과 날짜 */}
                                    {(() => {
                                      const tourDate = pickupSchedule?.tour_date || reservation.tour_date
                                      const isBefore48H = tourDate ? isBefore48Hours(tourDate) : false
                                      return (
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`text-sm font-semibold ${isBefore48H ? 'text-orange-600' : 'text-primary'}`}>
                                            {formatTimeToAMPM(pickup.pickup_time)}
                                          </span>
                                          <span className={`text-sm font-semibold ${isBefore48H ? 'text-orange-600' : 'text-primary'}`}>
                                            {pickup.tour_date && calculatePickupDate(pickup.pickup_time, pickup.tour_date)}
                                          </span>
                                          {isBefore48H && (
                                            <span className="text-xs text-orange-600 font-medium">
                                              ({t('approximateTime')})
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    
                                    {/* 두 번째 줄: 호텔 이름 */}
                                    <div>
                                        <span className="text-sm font-semibold text-gray-900">
                                          {pickup.hotel}
                                        </span>
                                      </div>
                                    
                                    {/* 세 번째 줄: 픽업 장소 (크기 키우고 다른 색깔) */}
                                    <div className="text-sm text-orange-600 font-medium">
                                        <p>{pickup.pick_up_location}</p>
                                    </div>
                                    
                                    {/* 네 번째 줄: 주소 (회색) */}
                                    {pickup.address && (
                                      <div className="text-sm text-gray-600">
                                        <p>{pickup.address}</p>
                                      </div>
                                    )}
                                    
                                    {/* 다섯 번째 줄: VIEW ON MAP과 MY RESERVATION */}
                                    <div className="flex items-center justify-between">
                                        <a 
                                          href={pickup.link || `https://maps.google.com/maps?q=${encodeURIComponent(pickup.hotel + (pickup.address ? ', ' + pickup.address : ''))}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        className="inline-flex items-center text-primary hover:text-primary/80 text-xs"
                                        >
                                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                          </svg>
                                          {t('viewOnMap')}
                                        </a>
                                      {pickup.reservation_id === reservation.id && (
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                          {t('myReservation')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
  )
}
