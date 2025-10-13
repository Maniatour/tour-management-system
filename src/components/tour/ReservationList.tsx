import React from 'react'
import { Check, X, Edit, MapPin, Clock, User, Users, Eye } from 'lucide-react'
// @ts-ignore
import ReactCountryFlag from 'react-country-flag'
import { formatCustomerNameEnhanced } from '@/utils/koreanTransliteration'
import { formatTimeWithAMPM } from '@/lib/utils'
import { getGroupColorClasses, getOptionBadgeColor, getOptionName } from '@/utils/tourUtils'

interface ReservationListProps {
  assignedReservations: any[]
  pendingReservations: any[]
  otherToursAssignedReservations: any[]
  customers: any[]
  pickupHotels: any[]
  channels: any[]
  productOptions: any[]
  tour: any
  product: any
  onAssignReservation: (id: string) => void
  onUnassignReservation: (id: string) => void
  onReassignFromOtherTour: (reservationId: string, fromTourId: string) => void
  onEditReservationClick: (reservation: any) => void
  onEditPickupTime: (reservation: any) => void
  onEditPickupHotel: (reservation: any) => void
  editingPickupTime: any
  editingPickupHotel: any
  onSavePickupTime: () => void
  onCancelEditPickupTime: () => void
  onSavePickupHotel: (hotelId: string) => void
  onCancelEditPickupHotel: () => void
  getCustomerName: (id: string) => string
  getCustomerLanguage: (id: string) => string
  getPickupHotelName: (id: string) => string
  getChannelInfo: (id: string) => any
  getChannelIcon: (channelInfo: any) => React.ReactNode
  getCountryCode: (language: string) => string
}

export const ReservationList: React.FC<ReservationListProps> = ({
  assignedReservations,
  pendingReservations,
  otherToursAssignedReservations,
  customers,
  pickupHotels,
  channels,
  productOptions,
  tour,
  product,
  onAssignReservation,
  onUnassignReservation,
  onReassignFromOtherTour,
  onEditReservationClick,
  onEditPickupTime,
  onEditPickupHotel,
  editingPickupTime,
  editingPickupHotel,
  onSavePickupTime,
  onCancelEditPickupTime,
  onSavePickupHotel,
  onCancelEditPickupHotel,
  getCustomerName,
  getCustomerLanguage,
  getPickupHotelName,
  getChannelInfo,
  getChannelIcon,
  getCountryCode
}) => {
  return (
    <div className="space-y-6">
      {/* 배정된 예약 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            배정된 예약 ({assignedReservations.length}명)
          </h3>
        </div>
        <div className="p-4">
          {assignedReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>배정된 예약이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignedReservations.map((reservation: any) => (
                <div key={reservation.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <ReactCountryFlag 
                            countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id))} 
                            svg 
                            className="w-5 h-5"
                          />
                          <span className="font-medium text-gray-900">
                            {formatCustomerNameEnhanced(getCustomerName(reservation.customer_id))}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          ({getCustomerLanguage(reservation.customer_id)})
                        </span>
                        {getChannelIcon(getChannelInfo(reservation.channel_id))}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {editingPickupTime?.id === reservation.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="time"
                                  value={editingPickupTime.time}
                                  onChange={(e) => setEditingPickupTime({...editingPickupTime, time: e.target.value})}
                                  className="px-2 py-1 border rounded text-sm"
                                />
                                <button
                                  onClick={onSavePickupTime}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={onCancelEditPickupTime}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span onClick={() => onEditPickupTime(reservation)} className="cursor-pointer hover:text-blue-600">
                                {reservation.pickup_time ? formatTimeWithAMPM(reservation.pickup_time) : '시간 미설정'}
                              </span>
                            )}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {editingPickupHotel?.id === reservation.id ? (
                              <div className="flex items-center space-x-2">
                                <select
                                  value={editingPickupHotel.hotelId}
                                  onChange={(e) => setEditingPickupHotel({...editingPickupHotel, hotelId: e.target.value})}
                                  className="px-2 py-1 border rounded text-sm"
                                >
                                  <option value="">호텔 선택</option>
                                  {pickupHotels.map((hotel: any) => (
                                    <option key={hotel.id} value={hotel.id}>
                                      {hotel.name_ko}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => onSavePickupHotel(editingPickupHotel.hotelId)}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={onCancelEditPickupHotel}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span onClick={() => onEditPickupHotel(reservation)} className="cursor-pointer hover:text-blue-600">
                                {getPickupHotelName(reservation.pickup_hotel_id)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* 선택된 옵션들 표시 */}
                      {reservation.selected_options && Object.keys(reservation.selected_options).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(reservation.selected_options).map(([groupId, optionIds]: [string, any]) => (
                            <div key={groupId} className="flex flex-wrap gap-1">
                              {Array.isArray(optionIds) ? optionIds.map((optionId: string) => (
                                <span
                                  key={optionId}
                                  className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionId)}`}
                                >
                                  {getOptionName(optionId, reservation.product_id, productOptions)}
                                </span>
                              )) : (
                                <span
                                  key={optionIds}
                                  className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionIds)}`}
                                >
                                  {getOptionName(optionIds, reservation.product_id, productOptions)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => onEditReservationClick(reservation)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="예약 수정"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onUnassignReservation(reservation.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="배정 해제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 대기 중인 예약 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <User className="w-5 h-5 mr-2 text-orange-600" />
            대기 중인 예약 ({pendingReservations.length}명)
          </h3>
        </div>
        <div className="p-4">
          {pendingReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>대기 중인 예약이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingReservations.map((reservation: any) => (
                <div key={reservation.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <ReactCountryFlag 
                            countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id))} 
                            svg 
                            className="w-5 h-5"
                          />
                          <span className="font-medium text-gray-900">
                            {formatCustomerNameEnhanced(getCustomerName(reservation.customer_id))}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          ({getCustomerLanguage(reservation.customer_id)})
                        </span>
                        {getChannelIcon(getChannelInfo(reservation.channel_id))}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {reservation.pickup_time ? formatTimeWithAMPM(reservation.pickup_time) : '시간 미설정'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>{getPickupHotelName(reservation.pickup_hotel_id)}</span>
                        </div>
                      </div>
                      
                      {/* 선택된 옵션들 표시 */}
                      {reservation.selected_options && Object.keys(reservation.selected_options).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(reservation.selected_options).map(([groupId, optionIds]: [string, any]) => (
                            <div key={groupId} className="flex flex-wrap gap-1">
                              {Array.isArray(optionIds) ? optionIds.map((optionId: string) => (
                                <span
                                  key={optionId}
                                  className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionId)}`}
                                >
                                  {getOptionName(optionId, reservation.product_id, productOptions)}
                                </span>
                              )) : (
                                <span
                                  key={optionIds}
                                  className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionIds)}`}
                                >
                                  {getOptionName(optionIds, reservation.product_id, productOptions)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => onEditReservationClick(reservation)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="예약 수정"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onAssignReservation(reservation.id)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="투어에 배정"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 다른 투어에 배정된 예약 목록 */}
      {otherToursAssignedReservations.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Eye className="w-5 h-5 mr-2 text-purple-600" />
              다른 투어에 배정된 예약 ({otherToursAssignedReservations.length}명)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              같은 날짜, 같은 상품의 다른 투어에 배정된 예약들입니다.
            </p>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {otherToursAssignedReservations.map((reservation: any) => (
                <div key={reservation.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex items-center space-x-2">
                          <ReactCountryFlag 
                            countryCode={getCountryCode(getCustomerLanguage(reservation.customer_id))} 
                            svg 
                            className="w-5 h-5"
                          />
                          <span className="font-medium text-gray-900">
                            {formatCustomerNameEnhanced(getCustomerName(reservation.customer_id))}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          ({getCustomerLanguage(reservation.customer_id)})
                        </span>
                        {getChannelIcon(getChannelInfo(reservation.channel_id))}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {reservation.pickup_time ? formatTimeWithAMPM(reservation.pickup_time) : '시간 미설정'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4" />
                          <span>{getPickupHotelName(reservation.pickup_hotel_id)}</span>
                        </div>
                      </div>
                      
                      {/* 선택된 옵션들 표시 */}
                      {reservation.selected_options && Object.keys(reservation.selected_options).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(reservation.selected_options).map(([groupId, optionIds]: [string, any]) => (
                            <div key={groupId} className="flex flex-wrap gap-1">
                              {Array.isArray(optionIds) ? optionIds.map((optionId: string) => (
                                <span
                                  key={optionId}
                                  className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionId)}`}
                                >
                                  {getOptionName(optionId, reservation.product_id, productOptions)}
                                </span>
                              )) : (
                                <span
                                  key={optionIds}
                                  className={`text-xs px-2 py-1 rounded ${getOptionBadgeColor(optionIds)}`}
                                >
                                  {getOptionName(optionIds, reservation.product_id, productOptions)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => onReassignFromOtherTour(reservation.id, reservation.tour_id)}
                        className="px-3 py-1 text-sm bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors"
                        title="이 투어로 재배정"
                      >
                        재배정
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
