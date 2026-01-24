'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Calendar, MapPin, Users, DollarSign, Eye, Clock, Mail, ChevronDown, Edit, MessageSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getChannelName, 
  getStatusLabel, 
  getStatusColor, 
  calculateTotalPrice 
} from '@/utils/reservationUtils'
import { ResidentStatusIcon } from '@/components/reservation/ResidentStatusIcon'
import { ChoicesDisplay } from '@/components/reservation/ChoicesDisplay'
import type { Reservation, Customer } from '@/types/reservation'

interface ReservationCardItemProps {
  reservation: Reservation
  customers: Customer[]
  products: Array<{ id: string; name: string; sub_category?: string }>
  channels: Array<{ id: string; name: string; favicon_url?: string }>
  pickupHotels: Array<{ id: string; hotel?: string | null; name?: string | null; name_ko?: string | null; pick_up_location?: string | null }>
  productOptions: Array<{ id: string; name: string; is_required?: boolean }>
  optionChoices: Array<{ id: string; name: string }>
  tourInfoMap: Map<string, {
    totalPeople: number
    otherReservationsTotalPeople: number
    allDateTotalPeople: number
    status: string
    guideName: string
    assistantName: string
    vehicleName: string
    tourDate: string
    tourStartDatetime: string | null
    isAssigned: boolean
    reservationIds: string[]
    productId: string | null
  }>
  reservationPricingMap: Map<string, {
    total_price: number
    balance_amount: number
    adult_product_price?: number
    child_product_price?: number
    infant_product_price?: number
    product_price_total?: number
    coupon_discount?: number
    additional_discount?: number
    additional_cost?: number
    commission_percent?: number
    commission_amount?: number
    currency?: string
  }>
  locale: string
  emailDropdownOpen: string | null
  sendingEmail: string | null
  onPricingInfoClick: (reservation: Reservation) => void
  onCreateTour: (reservation: Reservation) => void
  onPickupTimeClick: (reservation: Reservation, e: React.MouseEvent) => void
  onPickupHotelClick: (reservation: Reservation, e: React.MouseEvent) => void
  onPaymentClick: (reservation: Reservation) => void
  onDetailClick: (reservation: Reservation) => void
  onReviewClick: (reservation: Reservation) => void
  onEmailPreview: (reservation: Reservation, emailType: 'confirmation' | 'departure' | 'pickup') => void
  onEmailLogsClick: (reservationId: string) => void
  onEmailDropdownToggle: (reservationId: string) => void
  onEditClick: (reservationId: string) => void
  onCustomerClick: (customer: Customer) => void
  onRefreshReservations: () => void
  generatePriceCalculation: (reservation: Reservation, pricing: any) => string
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
  getSelectedChoicesFromNewSystem: (reservationId: string) => Promise<Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>
  choicesCacheRef: React.MutableRefObject<Map<string, Array<{
    choice_id: string
    option_id: string
    quantity: number
    choice_options: {
      option_key: string
      option_name: string
      option_name_ko: string
      product_choices: {
        choice_group_ko: string
      }
    }
  }>>>
  showResidentStatusIcon?: boolean
}

export const ReservationCardItem = React.memo(function ReservationCardItem({
  reservation,
  customers,
  products,
  channels,
  pickupHotels,
  productOptions,
  optionChoices,
  tourInfoMap,
  reservationPricingMap,
  locale,
  emailDropdownOpen,
  sendingEmail,
  onPricingInfoClick,
  onCreateTour,
  onPickupTimeClick,
  onPickupHotelClick,
  onPaymentClick,
  onDetailClick,
  onReviewClick,
  onEmailPreview,
  onEmailLogsClick,
  onEmailDropdownToggle,
  onEditClick,
  onCustomerClick,
  onRefreshReservations,
  generatePriceCalculation,
  getGroupColorClasses,
  getSelectedChoicesFromNewSystem,
  choicesCacheRef,
  showResidentStatusIcon = false
}: ReservationCardItemProps) {
  const t = useTranslations('reservations')
  const router = useRouter()

  return (
    <div
      key={reservation.id}
      className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 group"
    >
      {/* 카드 헤더 - 상태 표시 */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-start mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
            {getStatusLabel(reservation.status, t)}
          </span>
          <div className="flex items-center space-x-2">
            {(() => {
              const channel = channels?.find(c => c.id === reservation.channelId)
              return (
                <>
                  {channel?.favicon_url ? (
                    <Image 
                      src={channel.favicon_url} 
                      alt={`${channel.name || 'Channel'} favicon`} 
                      width={16}
                      height={16}
                      className="rounded flex-shrink-0"
                      style={{ width: 'auto', height: 'auto' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0'
                          fallback.innerHTML = '🌐'
                          parent.appendChild(fallback)
                        }
                      }}
                    />
                  ) : (
                    <div className="h-4 w-4 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 text-xs">🌐</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-600">{getChannelName(reservation.channelId, channels || [])}</span>
                  <span className="text-xs text-gray-400">RN: {reservation.channelRN}</span>
                </>
              )
            })()}
          </div>
        </div>
        
        {/* 고객 이름 */}
        <div className="mb-2">
          <div 
            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline flex items-center space-x-2"
            onClick={(e) => {
              e.stopPropagation()
              const customer = customers.find(c => c.id === reservation.customerId)
              if (customer) {
                onCustomerClick(customer)
              }
            }}
          >
            {/* 언어별 국기 아이콘 */}
            {(() => {
              const customer = customers.find(c => c.id === reservation.customerId)
              if (!customer?.language) return null
              
              const language = customer.language.toLowerCase()
              if (language === 'kr' || language === 'ko' || language === '한국어') {
                return <span className="mr-2 text-xs">🇰🇷</span>
              } else if (language === 'en' || language === '영어') {
                return <span className="mr-2 text-xs">🇺🇸</span>
              } else if (language === 'jp' || language === '일본어') {
                return <span className="mr-2 text-xs">🇯🇵</span>
              } else if (language === 'cn' || language === '중국어') {
                return <span className="mr-2 text-xs">🇨🇳</span>
              }
              return null
            })()}
            
            {/* 거주 상태 아이콘 */}
            {showResidentStatusIcon && (
              <ResidentStatusIcon
                reservationId={reservation.id}
                customerId={reservation.customerId}
                totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}
                onUpdate={onRefreshReservations}
              />
            )}
            
            <span>{getCustomerName(reservation.customerId, customers || [])}</span>
            {/* 인원 정보 */}
            {(() => {
              const hasChild = reservation.child > 0
              const hasInfant = reservation.infant > 0
              const hasAdult = reservation.adults > 0
              
              if (!hasAdult) return null
              
              return (
                <span className="flex items-center space-x-1 text-xs text-gray-600 ml-2">
                  <Users className="h-3 w-3" />
                  <span>{reservation.adults}명</span>
                  {hasChild && <span className="text-orange-600">{reservation.child}아</span>}
                  {hasInfant && <span className="text-blue-600">{reservation.infant}유</span>}
                </span>
              )
            })()}
          </div>
          <a 
            href={`mailto:${customers.find(c => c.id === reservation.customerId)?.email || ''}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer block"
          >
            {customers.find(c => c.id === reservation.customerId)?.email}
          </a>
          {/* 전화번호와 등록일 - 같은 줄에 배치 */}
          <div className="flex items-center justify-between">
            <a 
              href={`tel:${customers.find(c => c.id === reservation.customerId)?.phone || ''}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-500 hover:text-blue-600 hover:underline cursor-pointer"
            >
              {customers.find(c => c.id === reservation.customerId)?.phone || '-'}
            </a>
            {reservation.addedTime ? (
              <span className="text-xs text-gray-500">
                {new Date(reservation.addedTime).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* 카드 본문 */}
      <div className="p-4 space-y-3">
        {/* 상품 정보 */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="text-sm font-medium text-gray-900">{getProductName(reservation.productId, products as any || [])}</div>
            
            {/* 새로운 초이스 시스템 뱃지 표시 */}
            <ChoicesDisplay 
              reservation={reservation}
              getGroupColorClasses={getGroupColorClasses}
              getSelectedChoicesFromNewSystem={getSelectedChoicesFromNewSystem}
              choicesCacheRef={choicesCacheRef}
            />
          </div>
          
          {/* 기존 selectedOptions 표시 (필요한 경우) */}
          {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
            <div className="mt-1 space-y-1">
              {Object.entries(reservation.selectedOptions).map(([optionId, choiceIds]) => {
                if (!choiceIds || choiceIds.length === 0) return null
                
                const option = productOptions?.find(opt => opt.id === optionId)
                
                if (!option) return null
                
                // 필수 옵션만 표시 (is_required가 true인 옵션만)
                if (!option.is_required) return null
                
                return (
                  <div key={optionId} className="text-xs text-gray-600">
                    <span className="font-medium">{option.name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 투어 날짜 및 픽업 시간 */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          {(() => {
            const pickupTime = reservation.pickUpTime || ''
            let displayDate = reservation.tourDate
            
            // 픽업 시간이 21시(9PM) 이후면 날짜를 -1일
            if (pickupTime) {
              const timeMatch = pickupTime.match(/(\d{1,2}):(\d{2})/)
              if (timeMatch) {
                const hour = parseInt(timeMatch[1], 10)
                if (hour >= 21) {
                  const date = new Date(reservation.tourDate)
                  date.setDate(date.getDate() - 1)
                  displayDate = date.toISOString().split('T')[0]
                }
              }
            }
            
            return (
              <>
                <span className="text-sm text-gray-900">{displayDate}</span>
                {pickupTime && (
                  <>
                    <span className="text-gray-400">|</span>
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span 
                      className="text-sm text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
                      onClick={(e) => onPickupTimeClick(reservation, e)}
                    >
                      {pickupTime}
                    </span>
                  </>
                )}
              </>
            )
          })()}
        </div>

        {/* 픽업 호텔 정보 */}
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span 
            className={`text-sm hover:text-blue-600 hover:underline cursor-pointer ${
              reservation.pickUpHotel 
                ? 'text-gray-900' 
                : 'text-gray-500 italic'
            }`}
            onClick={(e) => onPickupHotelClick(reservation, e)}
          >
            {reservation.pickUpHotel 
              ? getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels as any || [])
              : '픽업 호텔 미정'
            }
          </span>
        </div>

        {/* Net Price 계산식 표시 */}
        <div className="pt-2 border-t border-gray-100">
          {(() => {
            const pricing = reservationPricingMap.get(reservation.id)
            if (!pricing || !pricing.total_price) {
              const totalPrice = reservation.totalPrice || reservation.pricingInfo?.totalPrice || calculateTotalPrice(reservation, (products || []) as any, optionChoices || [])
              return (
                <div className="text-xs text-gray-700">
                  <div className="text-gray-600 break-words font-medium">
                    ${totalPrice.toLocaleString()}
                  </div>
                </div>
              )
            }
            
            const calculationString = generatePriceCalculation(reservation, pricing)
            const currency = pricing.currency || 'USD'
            const currencySymbol = currency === 'KRW' ? '₩' : '$'
            
            return (
              <div className="text-xs text-gray-700">
                <div className="text-gray-600 break-words font-medium">
                  {calculationString || `${currencySymbol}${pricing.total_price.toFixed(2)}`}
                </div>
                {pricing.balance_amount > 0 && (
                  <div className="text-red-600 font-medium mt-1">
                    Balance: {currencySymbol}{pricing.balance_amount.toFixed(2)}
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* 연결된 투어 정보 */}
        {(() => {
          const statusLower = reservation.status?.toLowerCase() || ''
          if (statusLower === 'cancelled' || statusLower === 'canceled') {
            return null
          }
          
          const tourId = reservation.tourId || (reservation as any).tour_id
          if (!tourId || tourId.trim() === '' || tourId === 'null' || tourId === 'undefined') {
            return null
          }
          
          // tourInfoMap이 아직 준비되지 않았거나 해당 tourId가 없는 경우
          if (tourInfoMap.size === 0 || !tourInfoMap.has(tourId)) {
            return null
          }
          
          const tourInfo = tourInfoMap.get(tourId)!
          
          // tourInfo에서 이미 계산된 인원 수 사용
          const assignedTourTotalPeople = tourInfo.totalPeople
          const finalAllDateTotalPeople = tourInfo.allDateTotalPeople || assignedTourTotalPeople
          
          const getStatusColor = (status: string) => {
            const statusLower = status.toLowerCase()
            if (statusLower === 'confirmed') return 'bg-green-100 text-green-800'
            if (statusLower === 'completed') return 'bg-blue-100 text-blue-800'
            if (statusLower === 'cancelled') return 'bg-red-100 text-red-800'
            return 'bg-gray-100 text-gray-800'
          }
          
          return (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div 
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/${locale}/admin/tours/${tourId}`)
                }}
                className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-gray-900">
                    배정된 투어 ({assignedTourTotalPeople}명) / 총 {finalAllDateTotalPeople}명
                  </div>
                  <div className="flex items-center space-x-2">
                    {tourInfo.isAssigned && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        배정됨
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(tourInfo.status)}`}>
                      {tourInfo.status}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-gray-500 mb-2 font-mono">
                  ID: {tourId}
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {tourInfo.guideName !== '-' && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      {tourInfo.guideName}
                    </span>
                  )}
                  {tourInfo.assistantName !== '-' && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                      {tourInfo.assistantName}
                    </span>
                  )}
                  {tourInfo.vehicleName !== '-' && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {tourInfo.vehicleName}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* 버튼들 - 가장 아래에 배치 */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPricingInfoClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>{t('actions.price')}</span>
            </button>
            
            {/* 투어 생성 버튼 - Mania Tour/Service이고 투어가 없을 때만 표시 */}
            {(() => {
              const product = products?.find(p => p.id === reservation.productId)
              const isManiaTour = product?.sub_category === 'Mania Tour' || product?.sub_category === 'Mania Service'
              
              if (isManiaTour && !reservation.hasExistingTour) {
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateTour(reservation)
                    }}
                    className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200"
                    title="투어 생성"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('actions.tour')}</span>
                  </button>
                )
              }
              return null
            })()}

            {/* 입금 내역 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPaymentClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors flex items-center space-x-1 border border-blue-200"
              title="입금 내역 관리"
            >
              <DollarSign className="w-3 h-3" />
              <span>{t('actions.deposit')}</span>
            </button>
            
            {/* 고객 보기 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDetailClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors flex items-center space-x-1 border border-purple-200"
              title="고객 보기"
            >
              <Eye className="w-3 h-3" />
              <span>고객 보기</span>
            </button>

            {/* 후기 관리 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReviewClick(reservation)
              }}
              className="px-2 py-1 text-xs bg-pink-50 text-pink-600 rounded-md hover:bg-pink-100 transition-colors flex items-center space-x-1 border border-pink-200"
              title="후기 관리"
            >
              <MessageSquare className="w-3 h-3" />
              <span>후기</span>
            </button>

            {/* 이메일 발송 드롭다운 */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEmailDropdownToggle(reservation.id)
                }}
                disabled={sendingEmail === reservation.id}
                className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded-md hover:bg-green-100 transition-colors flex items-center space-x-1 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="이메일 발송"
              >
                <Mail className="w-3 h-3" />
                <span>{sendingEmail === reservation.id ? '발송 중...' : '이메일'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {emailDropdownOpen === reservation.id && (
                <div 
                  className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onEmailPreview(reservation, 'confirmation')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Mail className="w-3 h-3" />
                    <span>예약 확인 이메일</span>
                  </button>
                  <button
                    onClick={() => onEmailPreview(reservation, 'departure')}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <Mail className="w-3 h-3" />
                    <span>투어 출발 확정 이메일</span>
                  </button>
                  <button
                    onClick={() => onEmailPreview(reservation, 'pickup')}
                    disabled={!reservation.pickUpTime || !reservation.tourDate}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-3 h-3" />
                    <span>픽업 notification 이메일</span>
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEmailLogsClick(reservation.id)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 flex items-center space-x-2"
                  >
                    <Clock className="w-3 h-3" />
                    <span>이메일 발송 내역</span>
                  </button>
                </div>
              )}
            </div>

            {/* 수정 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEditClick(reservation.id)
              }}
              className="px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 transition-colors flex items-center space-x-1 border border-orange-200"
              title="예약 수정"
            >
              <Edit className="w-3 h-3" />
              <span>수정</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // 메모이제이션 비교: reservation.id와 주요 props만 비교하여 불필요한 리렌더링 방지
  return (
    prevProps.reservation.id === nextProps.reservation.id &&
    prevProps.emailDropdownOpen === nextProps.emailDropdownOpen &&
    prevProps.sendingEmail === nextProps.sendingEmail &&
    prevProps.reservation.status === nextProps.reservation.status &&
    prevProps.reservation.tourId === nextProps.reservation.tourId &&
    prevProps.reservationPricingMap.get(prevProps.reservation.id) === nextProps.reservationPricingMap.get(nextProps.reservation.id)
  )
})
