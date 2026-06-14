'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Users, Calendar, DollarSign, Edit, Trash2, Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import type { Reservation, Customer } from '@/types/reservation'
import { 
  getPickupHotelDisplay, 
  getCustomerName, 
  getProductName, 
  getStatusLabel, 
  getStatusColor, 
  calculateTotalPrice 
} from '@/utils/reservationUtils'
import type { Product, ProductOptionChoice } from '@/types/reservation'

interface ReservationCardProps {
  reservation: Reservation
  customers: Customer[]
  products: Array<{ id: string; name: string }>
  channels: Array<{ id: string; name: string; favicon_url?: string }>
  productOptions: Array<{ id: string; name: string; product_id: string }>
  optionChoices: Array<{ id: string; name: string; option_id: string; adult_price: number; child_price: number; infant_price: number }>
  options: Array<{ id: string; name: string; name_ko?: string }>
  pickupHotels: Array<{ id: string; name: string; name_ko?: string; address?: string }>
  locale: string
  onEdit: (reservation: Reservation) => void
  onDelete: (id: string) => void
  onPricingInfo: (reservation: Reservation) => void
  onCreateTour: (reservation: Reservation) => void
  onPaymentRecords: (reservation: Reservation) => void
  getGroupColorClasses: (groupId: string, groupName?: string, optionName?: string) => string
}

export default function ReservationCard({
  reservation,
  customers,
  products,
  channels,
  productOptions: _productOptions,
  optionChoices,
  options,
  pickupHotels,
  locale,
  onEdit,
  onDelete,
  onPricingInfo,
  onCreateTour,
  onPaymentRecords,
  getGroupColorClasses
}: ReservationCardProps) {
  const t = useTranslations('reservations')
  const router = useRouter()

  const handleEdit = useCallback(() => {
    onEdit(reservation)
  }, [onEdit, reservation])

  const handleDelete = useCallback(() => {
    onDelete(reservation.id)
  }, [onDelete, reservation.id])

  const handlePricingInfo = useCallback(() => {
    onPricingInfo(reservation)
  }, [onPricingInfo, reservation])

  const handleCreateTour = useCallback(() => {
    onCreateTour(reservation)
  }, [onCreateTour, reservation])

  const handlePaymentRecords = useCallback(() => {
    onPaymentRecords(reservation)
  }, [onPaymentRecords, reservation])

  const handleViewDetails = useCallback(() => {
    router.push(`/${locale}/admin/reservations/${reservation.id}`)
  }, [router, locale, reservation.id])

  const customer = customers.find(c => c.id === reservation.customerId)
  const channel = channels.find(c => c.id === reservation.channelId)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* 카드 헤더 */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {getCustomerName(reservation.customerId, customers)}
              </h3>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="font-medium">#{reservation.channelRN}</span>
              <span>{getProductName(reservation.productId, products as unknown as Product[])}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={handleViewDetails}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="상세보기"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={handleEdit}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="편집"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-600"
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 카드 내용 */}
      <div className="p-4 space-y-3">
        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Calendar size={16} className="text-gray-400" />
            <span className="text-gray-600">{reservation.tourDate}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users size={16} className="text-gray-400" />
            <span className="text-gray-600">{reservation.totalPeople}명</span>
          </div>
          <div className="flex items-center space-x-2">
            <MapPin size={16} className="text-gray-400" />
            <span className="text-gray-600">{getPickupHotelDisplay(reservation.pickUpHotel, pickupHotels)}</span>
          </div>
          <div className="flex items-center space-x-2">
            <DollarSign size={16} className="text-gray-400" />
            <span className="text-gray-600">
              ${calculateTotalPrice(
                reservation,
                products as Product[],
                optionChoices as unknown as ProductOptionChoice[]
              ).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 채널 정보 */}
        {channel && (
          <div className="flex items-center space-x-2">
            {channel.favicon_url && (
              <Image
                src={channel.favicon_url}
                alt={channel.name}
                width={16}
                height={16}
                className="h-4 w-4 shrink-0 rounded"
                style={{ width: 'auto', height: 'auto' }}
              />
            )}
            <span className="text-sm text-gray-600">{channel.name}</span>
          </div>
        )}

        {/* 상태 */}
        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reservation.status)}`}>
            {getStatusLabel(reservation.status, t)}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePricingInfo}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              가격 정보
            </button>
            <button
              onClick={handleCreateTour}
              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              투어 생성
            </button>
            <button
              onClick={handlePaymentRecords}
              className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              입금 내역
            </button>
          </div>
        </div>

        {/* 선택된 옵션들 */}
        {reservation.selectedOptions && Object.keys(reservation.selectedOptions).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">선택된 옵션:</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(reservation.selectedOptions).flatMap(([groupId, choiceIds]) =>
                (choiceIds ?? []).map((choiceId, index) => {
                  const choice = optionChoices.find((c) => c.id === choiceId)
                  const option = options.find((o) => o.id === groupId)
                  const optionName = choice?.name ?? choiceId
                  const groupName = option?.name_ko ?? option?.name ?? groupId
                  return (
                    <span
                      key={`${groupId}-${choiceId}-${index}`}
                      className={getGroupColorClasses(groupId, groupName, optionName)}
                    >
                      {optionName}
                    </span>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* 특별 요청 */}
        {customer?.special_requests && (
          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
            <span className="font-medium">특별 요청:</span> {customer.special_requests}
          </div>
        )}
      </div>
    </div>
  )
}
