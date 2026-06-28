'use client'

import Image from 'next/image'
import { Car, ExternalLink, Phone, User, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { TourDetails } from '@/components/customer/customerReservationTypes'

type CustomerReservationTourSectionProps = {
  tourDetails?: TourDetails | null
  onSelectMedia: (url: string) => void
}

export default function CustomerReservationTourSection({
  tourDetails,
  onSelectMedia,
}: CustomerReservationTourSectionProps) {
  const t = useTranslations('common')
  const locale = useLocale()

  if (!tourDetails) return null

  return (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                          <Users className="w-5 h-5 mr-2" />
                          {t('tourDetails')}
                        </h4>
                        <div className="bg-green-50 p-4 rounded-lg space-y-4">
                          {/* 가이드 정보 */}
                          {tourDetails?.tour_guide && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                {t('guide')}
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">
                                  {locale === 'ko' 
                                    ? (tourDetails?.tour_guide?.name_ko || tourDetails?.tour_guide?.name_en)
                                    : (tourDetails?.tour_guide?.name_en || tourDetails?.tour_guide?.name_ko)
                                  }
                                </p>
                                {tourDetails?.tour_guide?.phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {tourDetails?.tour_guide?.phone}
                                  </p>
                                )}
                                {tourDetails?.tour_guide?.languages && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    {t('languages')}: {Array.isArray(tourDetails?.tour_guide?.languages) 
                                      ? (tourDetails?.tour_guide?.languages as string[])?.join(', ')
                                      : tourDetails?.tour_guide?.languages}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 어시스턴트 정보 */}
                          {tourDetails?.assistant && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                {t('assistant')}
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <p className="text-sm font-medium text-gray-900">
                                  {locale === 'ko' 
                                    ? (tourDetails?.assistant?.name_ko || tourDetails?.assistant?.name_en)
                                    : (tourDetails?.assistant?.name_en || tourDetails?.assistant?.name_ko)
                                  }
                                </p>
                                {tourDetails?.assistant?.phone && (
                                  <p className="text-xs text-gray-600 flex items-center mt-1">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {tourDetails?.assistant?.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 차량 정보 */}
                          {tourDetails?.vehicle && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2 flex items-center">
                                <Car className="w-4 h-4 mr-1" />
                                {t('vehicle')}
                              </h5>
                              <div className="bg-white p-3 rounded-md">
                                <div className="flex flex-col md:flex-row gap-4">
                                  {/* 차량 사진 */}
                                  {(() => {
                                    const photos = tourDetails?.vehicle?.vehicle_type_photos
                                    type PhotoType = {
                                      photo_url?: string
                                      photo_name?: string
                                      description?: string
                                      is_primary?: boolean
                                    }
                                    const primaryPhoto = photos && Array.isArray(photos) && photos.length > 0
                                      ? photos.find((p: PhotoType) => p.is_primary) || photos[0]
                                      : null
                                    
                                    if (primaryPhoto?.photo_url) {
                                      return (
                                        <div className="flex-shrink-0">
                                          <div 
                                            className="relative cursor-pointer group w-full md:w-48 h-32 rounded-lg overflow-hidden border"
                                            onClick={() => primaryPhoto.photo_url && onSelectMedia(primaryPhoto.photo_url)}
                                          >
                                            <Image 
                                              src={primaryPhoto.photo_url}
                                              alt={primaryPhoto.photo_name || 'Vehicle'}
                                              width={192}
                                              height={128}
                                              className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                              }}
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                                              <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    }
                                    return null
                                  })()}
                                  
                                  {/* 차량 정보 텍스트 */}
                                  {tourDetails?.vehicle?.vehicle_type_info && (
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {tourDetails?.vehicle?.vehicle_type_info?.name}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        {tourDetails?.vehicle?.vehicle_type_info?.brand} {tourDetails?.vehicle?.vehicle_type_info?.model}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        {t('capacity')}: {tourDetails?.vehicle?.vehicle_type_info?.passenger_capacity} {t('people')}
                                      </p>
                                      {tourDetails?.vehicle?.color && (
                                        <p className="text-xs text-gray-600">
                                          {t('color')}: {tourDetails?.vehicle?.color}
                                        </p>
                                      )}
                                      {tourDetails?.vehicle?.vehicle_type_info?.description && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          {tourDetails?.vehicle?.vehicle_type_info?.description}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {(() => {
                                  const photos = tourDetails?.vehicle?.vehicle_type_photos
                                  return photos && Array.isArray(photos) && photos.length > 0
                                })() && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {tourDetails?.vehicle?.vehicle_type_photos?.map((photo, index) => (
                                      <div 
                                        key={index}
                                        className="relative cursor-pointer group"
                                        onClick={() => photo.photo_url && onSelectMedia(photo.photo_url)}
                                      >
                                        <Image 
                                          src={photo.photo_url || ''}
                                          alt={photo.photo_name || `Vehicle ${index + 1}`}
                                          width={200}
                                          height={96}
                                          className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                          }}
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                                          <ExternalLink className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        {photo.is_primary && (
                                          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                                            {t('primary')}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
  )
}
