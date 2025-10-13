// 투어 관련 유틸리티 함수들

// 투어에 배정된 사람 수 계산
export const calculateAssignedPeople = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return 0
  
  const assignedReservationIds = tour.reservation_ids || []
  const assignedReservations = reservations.filter(r => assignedReservationIds.includes(r.id))
  
  return assignedReservations.reduce((total, reservation) => {
    return total + (reservation.adults || 0) + (reservation.children || 0)
  }, 0)
}

// 같은 상품/날짜의 모든 투어에 배정된 총 사람 수 계산
export const calculateTotalPeopleForSameProductDate = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return 0
  
  // 같은 상품/날짜의 모든 예약들
  const sameProductDateReservations = reservations.filter(r => 
    r.product_id === tour.product_id && r.tour_date === tour.tour_date
  )
  
  return sameProductDateReservations.reduce((total, reservation) => {
    return total + (reservation.adults || 0) + (reservation.children || 0)
  }, 0)
}

// 배정되지 않은 사람 수 계산
export const calculateUnassignedPeople = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return 0
  
  const assignedReservationIds = tour.reservation_ids || []
  const unassignedReservations = reservations.filter(r => 
    !assignedReservationIds.includes(r.id) && 
    r.product_id === tour.product_id && 
    r.tour_date === tour.tour_date
  )
  
  return unassignedReservations.reduce((total, reservation) => {
    return total + (reservation.adults || 0) + (reservation.children || 0)
  }, 0)
}

// 대기 중인 예약들 가져오기
export const getPendingReservations = (tour: any, reservations: any[]) => {
  if (!tour || !reservations || reservations.length === 0) return []
  
  const assignedReservationIds = tour.reservation_ids || []
  return reservations.filter(r => 
    !assignedReservationIds.includes(r.id) && 
    r.product_id === tour.product_id && 
    r.tour_date === tour.tour_date
  )
}

// 그룹별 색상 매핑 함수
export const getGroupColorClasses = (groupId: string, groupName?: string, optionName?: string) => {
  // 그룹 이름이나 ID에 따라 색상 결정
  const groupNameStr = (groupName || groupId).toLowerCase()
  const optionNameStr = (optionName || '').toLowerCase()
  
  // 특정 그룹에 대한 색상 매핑
  if (groupNameStr.includes('canyon') || groupNameStr.includes('캐년')) {
    return "text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 border border-blue-200"
  }
  if (groupNameStr.includes('hotel') || groupNameStr.includes('호텔') || groupNameStr.includes('room') || groupNameStr.includes('룸')) {
    return "text-xs px-2 py-1 rounded bg-green-100 text-green-800 border border-green-200"
  }
  if (groupNameStr.includes('meal') || groupNameStr.includes('식사') || groupNameStr.includes('food')) {
    return "text-xs px-2 py-1 rounded bg-orange-100 text-orange-800 border border-orange-200"
  }
  if (groupNameStr.includes('transport') || groupNameStr.includes('교통') || groupNameStr.includes('vehicle')) {
    return "text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200"
  }
  if (groupNameStr.includes('activity') || groupNameStr.includes('활동') || groupNameStr.includes('experience')) {
    return "text-xs px-2 py-1 rounded bg-pink-100 text-pink-800 border border-pink-200"
  }
  
  // 기본 색상 팔레트 (그룹 ID 해시 기반)
  const colorPalette = [
    "text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800 border border-indigo-200",
    "text-xs px-2 py-1 rounded bg-teal-100 text-teal-800 border border-teal-200",
    "text-xs px-2 py-1 rounded bg-cyan-100 text-cyan-800 border border-cyan-200",
    "text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 border border-emerald-200",
    "text-xs px-2 py-1 rounded bg-violet-100 text-violet-800 border border-violet-200",
    "text-xs px-2 py-1 rounded bg-rose-100 text-rose-800 border border-rose-200",
    "text-xs px-2 py-1 rounded bg-sky-100 text-sky-800 border border-sky-200",
    "text-xs px-2 py-1 rounded bg-lime-100 text-lime-800 border border-lime-200"
  ]
  
  // 그룹 ID의 해시값으로 색상 선택
  let hash = 0
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colorPalette[Math.abs(hash) % colorPalette.length]
}

// 옵션 배지 색상 배열
export const optionBadgeColors = [
  'bg-blue-100 text-blue-800',
  'bg-green-100 text-green-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-indigo-100 text-indigo-800',
  'bg-yellow-100 text-yellow-800',
  'bg-red-100 text-red-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
  'bg-cyan-100 text-cyan-800',
  'bg-lime-100 text-lime-800',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-rose-100 text-rose-800'
]

// 옵션 ID를 기반으로 색상 선택하는 함수
export const getOptionBadgeColor = (optionId: string) => {
  // 옵션 ID의 해시값을 계산하여 색상 인덱스 결정
  let hash = 0
  for (let i = 0; i < optionId.length; i++) {
    const char = optionId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 32비트 정수로 변환
  }
  const colorIndex = Math.abs(hash) % optionBadgeColors.length
  return optionBadgeColors[colorIndex]
}

// 옵션 이름 가져오기 함수
export const getOptionName = (optionId: string, productId: string, productOptionsData: any) => {
  if (!optionId || !productOptionsData || !productOptionsData[optionId]) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Option not found:', { optionId, productId, productOptionsData })
    }
    return optionId
  }
  
  const option = productOptionsData[optionId]
  const result = option.name || optionId
  if (process.env.NODE_ENV === 'development') {
    console.log('Option found:', { optionId, result, option })
  }
  return result
}