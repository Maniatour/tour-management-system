// 그룹별 색상 매핑 유틸리티 함수
// 여러 컴포넌트에서 공통으로 사용할 수 있는 함수

export interface GroupColorClasses {
  bg: string;
  text: string;
  border: string;
  price: string;
}

export interface GroupColorClassesString {
  className: string;
}

/**
 * 그룹 ID와 이름을 기반으로 색상 클래스를 반환하는 함수
 * @param groupId 그룹 ID
 * @param groupName 그룹 이름 (선택사항)
 * @param optionName 옵션 이름 (선택사항)
 * @param format 'object' | 'string' 반환 형식 ('object': 개별 클래스, 'string': 전체 클래스 문자열)
 * @returns 색상 클래스 객체 또는 문자열
 */
export function getGroupColorClasses(
  groupId: string, 
  groupName?: string, 
  optionName?: string,
  format: 'object' = 'object'
): GroupColorClasses | GroupColorClassesString {
  // 그룹 이름이나 ID에 따라 색상 결정
  const groupNameStr = (groupName || groupId).toLowerCase()
  const optionNameStr = (optionName || '').toLowerCase()
  
  // 특정 그룹에 대한 색상 매핑
  if (groupNameStr.includes('canyon') || groupNameStr.includes('캐년')) {
    const colors = {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      price: 'text-blue-600'
    }
    return format === 'object' ? colors : { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}` }
  }
  
  if (groupNameStr.includes('hotel') || groupNameStr.includes('호텔') || groupNameStr.includes('room') || groupNameStr.includes('룸')) {
    const colors = {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      price: 'text-green-600'
    }
    return format === 'object' ? colors : { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}` }
  }
  
  if (groupNameStr.includes('meal') || groupNameStr.includes('식사') || groupNameStr.includes('food')) {
    const colors = {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-200',
      price: 'text-orange-600'
    }
    return format === 'object' ? colors : { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}` }
  }
  
  if (groupNameStr.includes('transport') || groupNameStr.includes('교통') || groupNameStr.includes('vehicle')) {
    const colors = {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      price: 'text-purple-600'
    }
    return format === 'object' ? colors : { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}` }
  }
  
  if (groupNameStr.includes('activity') || groupNameStr.includes('활동') || groupNameStr.includes('experience')) {
    const colors = {
      bg: 'bg-pink-100',
      text: 'text-pink-800',
      border: 'border-pink-200',
      price: 'text-pink-600'
    }
    return format === 'object' ? colors : { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}` }
  }
  
  // 기본 색상 팔레트 (그룹 ID 해시 기반)
  const colorPalette = [
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', price: 'text-indigo-600' },
    { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200', price: 'text-teal-600' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-200', price: 'text-cyan-600' },
    { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', price: 'text-emerald-600' },
    { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200', price: 'text-violet-600' },
    { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', price: 'text-rose-600' },
    { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200', price: 'text-sky-600' },
    { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200', price: 'text-lime-600' }
  ]
  
  // 그룹 ID의 해시값으로 색상 선택
  let hash = 0
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  const selectedColors = colorPalette[Math.abs(hash) % colorPalette.length]
  
  return format === 'object' 
    ? selectedColors 
    : { className: `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectedColors.bg} ${selectedColors.text} border ${selectedColors.border}` }
}

/**
 * 투어 상세 페이지용 색상 클래스 (rounded 대신 rounded-full 사용)
 */
export function getGroupColorClassesForTourDetail(
  groupId: string, 
  groupName?: string, 
  optionName?: string
): string {
  const colors = getGroupColorClasses(groupId, groupName, optionName, 'object') as GroupColorClasses
  
  // 투어 상세 페이지는 rounded-full 대신 rounded 사용
  return `text-xs px-2 py-1 rounded ${colors.bg} ${colors.text} border ${colors.border}`
}

/**
 * 예약 관리 페이지용 색상 클래스
 */
export function getGroupColorClassesForReservations(
  groupId: string, 
  groupName?: string, 
  optionName?: string
): string {
  const colors = getGroupColorClasses(groupId, groupName, optionName, 'object') as GroupColorClasses
  
  return `inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`
}
