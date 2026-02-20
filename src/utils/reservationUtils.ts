import type { Database } from '@/lib/supabase'
import type { 
  Customer, 
  Product, 
  Channel, 
  ProductOption, 
  ProductOptionChoice, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

// 픽업 호텔 ID로 호텔 정보를 찾는 헬퍼 함수 (id, hotel, pick_up_location만 있으면 동작)
export const getPickupHotelDisplay = (hotelId: string, pickupHotels: Array<{ id: string; hotel?: string; pick_up_location?: string | null }> | null) => {
  const hotel = pickupHotels?.find(h => h.id === hotelId)
  return hotel ? `${hotel.hotel ?? ''} - ${hotel.pick_up_location ?? ''}` : hotelId
}

// 고객 이름 가져오기
export const getCustomerName = (customerId: string, customers: Customer[] | null) => {
  return customers?.find(c => c.id === customerId)?.name || 'Unknown'
}

// 상품 이름 가져오기
export const getProductName = (productId: string, products: Product[] | null) => {
  return products?.find(p => p.id === productId)?.name || 'Unknown'
}

// 상품 이름 가져오기 (locale에 따라 name_ko / name_en 사용)
export const getProductNameForLocale = (
  productId: string,
  products: Array<{ id: string; name?: string | null; name_ko?: string | null; name_en?: string | null }> | null,
  locale: string
) => {
  const product = products?.find(p => p.id === productId)
  if (!product) return 'Unknown'
  if (locale === 'en' && product.name_en) return product.name_en
  if (product.name_ko) return product.name_ko
  return product.name || 'Unknown'
}

// 채널 이름 가져오기 (id, name만 있으면 동작)
export const getChannelName = (channelId: string, channels: Array<{ id: string; name?: string | null }> | null) => {
  return channels?.find(c => c.id === channelId)?.name || 'Unknown'
}

// 채널 정보 가져오기 (이름과 파비콘)
export const getChannelInfo = (channelId: string, channels: Channel[] | null) => {
  const channel = channels?.find(c => c.id === channelId)
  return {
    name: channel?.name || 'Unknown',
    favicon_url: (channel as any)?.favicon_url || null
  }
}

// 상태 라벨 가져오기
export const getStatusLabel = (status: string, t: (key: string) => string) => {
  return t(`status.${status}`)
}

// 상태 색상 가져오기
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800'
    case 'Confirmed': return 'bg-green-100 text-green-800'
    case 'pending': return 'bg-yellow-100 text-yellow-800'
    case 'Pending': return 'bg-yellow-100 text-yellow-800'
    case 'completed': return 'bg-blue-100 text-blue-800'
    case 'cancelled': return 'bg-red-100 text-red-800'
    case 'Canceled': return 'bg-red-100 text-red-800'
    case 'recruiting': return 'bg-purple-100 text-purple-800'
    case 'Recruiting': return 'bg-purple-100 text-purple-800'
    case 'Payment Requested': return 'bg-orange-100 text-orange-800'
    case 'deleted': return 'bg-gray-100 text-gray-600'
    case 'Deleted': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// 총 가격 계산
export const calculateTotalPrice = (reservation: Reservation, products: Product[], optionChoices: ProductOptionChoice[]) => {
  const product = products.find(p => p.id === reservation.productId)
  if (!product || !product.base_price) return 0
  
  // 기본 가격을 성인/아동/유아로 나누어 계산 (간단한 계산)
  let adultPrice = product.base_price
  let childPrice = product.base_price * 0.7 // 아동은 성인의 70%
  let infantPrice = product.base_price * 0.3 // 유아는 성인의 30%
  
  // 선택된 옵션의 가격 조정 적용
  if (reservation.selectedOptions) {
    Object.entries(reservation.selectedOptions).forEach(([optionId, choiceIds]) => {
      if (Array.isArray(choiceIds)) {
        choiceIds.forEach(choiceId => {
          const choice = optionChoices.find(c => c.id === choiceId)
          if (choice) {
            if (choice.adult_price_adjustment !== null) {
              adultPrice += choice.adult_price_adjustment
            }
            if (choice.child_price_adjustment !== null) {
              childPrice += choice.child_price_adjustment
            }
            if (choice.infant_price_adjustment !== null) {
              infantPrice += choice.infant_price_adjustment
            }
          }
        })
      }
    })
  }
  
  // 사용자가 입력한 요금 정보 적용
  if (reservation.selectedOptionPrices) {
    Object.entries(reservation.selectedOptionPrices).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (key.includes('_adult')) {
          adultPrice += value
        } else if (key.includes('_child')) {
          childPrice += value
        } else if (key.includes('_infant')) {
          infantPrice += value
        }
      }
    })
  }
  
  return (
    reservation.adults * adultPrice +
    reservation.child * childPrice +
    reservation.infant * infantPrice
  )
}

// 상품의 필수 선택 옵션을 카테고리별로 그룹화하여 가져오기
export const getRequiredOptionsForProduct = (productId: string, productOptions: ProductOption[], options: Database['public']['Tables']['options']['Row'][]) => {
  const requiredOptions = productOptions.filter(option => 
    option.product_id === productId && option.is_required === true
  )
  
  // 카테고리별로 그룹화 (options 테이블의 category 사용)
  const groupedOptions = requiredOptions.reduce((groups, option) => {
    // linked_option_id를 통해 options 테이블의 category 가져오기
    const linkedOption = options.find(opt => opt.id === option.linked_option_id)
    const category = linkedOption?.category || '기타'
    
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(option)
    return groups
  }, {} as Record<string, ProductOption[]>)
  
  return groupedOptions
}

// 상품의 선택 옵션 (is_multiple이 true인 옵션) 가져오기
export const getOptionalOptionsForProduct = (productId: string, productOptions: ProductOption[]) => {
  return productOptions.filter(option => 
    option.product_id === productId && option.is_multiple === true
  )
}

// 옵션의 선택지 가져오기 (병합된 테이블 구조)
export const getChoicesForOption = (optionId: string, productOptions: ProductOption[]) => {
  // 실제 시스템에서는 choice ID가 옵션 ID와 동일하므로 옵션 자체를 choice로 반환
  const option = productOptions.find(opt => opt.id === optionId)
  return option ? [{
    id: option.id,
    name: option.name,
    description: option.description,
    adult_price_adjustment: 0,
    child_price_adjustment: 0,
    infant_price_adjustment: 0,
    is_default: true,
    product_option_id: option.id
  }] : []
}
