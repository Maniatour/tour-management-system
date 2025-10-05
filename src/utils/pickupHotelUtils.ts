// 픽업 호텔 그룹 번호 관련 유틸리티 함수들

export interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  description_ko: string | null
  description_en: string | null
  address: string
  pin: string | null
  link: string | null
  media: string[] | null
  is_active: boolean | null
  group_number: number | null
  created_at: string | null
  updated_at: string | null
}

/**
 * 특정 그룹 번호의 호텔을 찾아서 반올림된 그룹 번호의 호텔로 안내하는 함수
 * @param requestedGroupNumber 요청된 그룹 번호 (예: 1.1)
 * @param hotels 전체 호텔 목록
 * @returns 반올림된 그룹 번호의 호텔 정보
 */
export function findRoundedGroupHotel(requestedGroupNumber: number, hotels: PickupHotel[]): PickupHotel | null {
  // 요청된 그룹 번호를 반올림
  const roundedGroupNumber = Math.round(requestedGroupNumber)
  
  // 반올림된 그룹 번호와 일치하는 호텔 찾기
  const targetHotel = hotels.find(hotel => 
    hotel.group_number === roundedGroupNumber && 
    hotel.is_active === true
  )
  
  return targetHotel || null
}

/**
 * 그룹 번호별로 호텔들을 그룹화하는 함수
 * @param hotels 전체 호텔 목록
 * @returns 그룹화된 호텔 객체
 */
export function groupHotelsByGroupNumber(hotels: PickupHotel[]): { [key: string]: PickupHotel[] } {
  const groups: { [key: string]: PickupHotel[] } = {}
  
  hotels.forEach(hotel => {
    let groupKey = '그룹 미설정'
    
    if (hotel.group_number !== null && hotel.group_number !== undefined) {
      const mainGroup = Math.floor(hotel.group_number)
      groupKey = `그룹 ${mainGroup}`
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(hotel)
  })
  
  // 각 그룹 내에서 그룹 번호 순으로 정렬
  Object.keys(groups).forEach(groupKey => {
    groups[groupKey].sort((a, b) => {
      const aNum = a.group_number || 999
      const bNum = b.group_number || 999
      return aNum - bNum
    })
  })
  
  return groups
}

/**
 * 픽업 요청 처리 예시 함수
 * @param requestedHotelName 요청된 호텔명
 * @param hotels 전체 호텔 목록
 * @returns 안내 메시지와 대상 호텔 정보
 */
export function processPickupRequest(requestedHotelName: string, hotels: PickupHotel[]): {
  success: boolean
  message: string
  targetHotel: PickupHotel | null
  requestedHotel: PickupHotel | null
} {
  // 요청된 호텔 찾기
  const requestedHotel = hotels.find(hotel => 
    hotel.hotel.toLowerCase().includes(requestedHotelName.toLowerCase()) ||
    requestedHotelName.toLowerCase().includes(hotel.hotel.toLowerCase())
  )
  
  if (!requestedHotel || !requestedHotel.group_number) {
    return {
      success: false,
      message: `요청하신 "${requestedHotelName}" 호텔을 찾을 수 없거나 그룹 번호가 설정되지 않았습니다.`,
      targetHotel: null,
      requestedHotel: requestedHotel
    }
  }
  
  // 반올림된 그룹 번호의 호텔 찾기
  const targetHotel = findRoundedGroupHotel(requestedHotel.group_number, hotels)
  
  if (!targetHotel) {
    return {
      success: false,
      message: `그룹 ${Math.round(requestedHotel.group_number)}에 해당하는 활성 호텔을 찾을 수 없습니다.`,
      targetHotel: null,
      requestedHotel: requestedHotel
    }
  }
  
  if (requestedHotel.id === targetHotel.id) {
    return {
      success: true,
      message: `"${requestedHotel.hotel}" 호텔로 픽업이 가능합니다.`,
      targetHotel: targetHotel,
      requestedHotel: requestedHotel
    }
  }
  
  return {
    success: true,
    message: `"${requestedHotel.hotel}" 요청으로 "${targetHotel.hotel}" 호텔로 픽업 안내됩니다. (그룹 ${requestedHotel.group_number} → ${targetHotel.group_number})`,
    targetHotel: targetHotel,
    requestedHotel: requestedHotel
  }
}

/**
 * 그룹 번호 유효성 검사 함수
 * @param groupNumber 검사할 그룹 번호
 * @returns 유효성 검사 결과
 */
export function validateGroupNumber(groupNumber: number | null): {
  isValid: boolean
  message: string
} {
  if (groupNumber === null || groupNumber === undefined) {
    return {
      isValid: true,
      message: '그룹 번호는 선택사항입니다.'
    }
  }
  
  if (groupNumber <= 0) {
    return {
      isValid: false,
      message: '그룹 번호는 0보다 커야 합니다.'
    }
  }
  
  if (groupNumber > 999) {
    return {
      isValid: false,
      message: '그룹 번호는 999를 초과할 수 없습니다.'
    }
  }
  
  return {
    isValid: true,
    message: '유효한 그룹 번호입니다.'
  }
}
