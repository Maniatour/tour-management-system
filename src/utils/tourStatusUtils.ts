// 상태 관련 유틸리티 함수들

export const getStatusColor = (status: string | null) => {
  if (!status) return 'bg-gray-100 text-gray-800'
  
  const normalizedStatus = status.toLowerCase()
  switch (normalizedStatus) {
    case 'recruiting': return 'bg-blue-100 text-blue-800'
    case 'confirm':
    case 'confirmed': return 'bg-green-100 text-green-800'
    case 'cancel':
    case 'cancelled': return 'bg-red-100 text-red-800'
    case 'complete':
    case 'completed': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export const getStatusText = (status: string | null) => {
  if (!status) return '미정'
  
  const normalizedStatus = status.toLowerCase()
  switch (normalizedStatus) {
    case 'recruiting': return '모집중'
    case 'confirm':
    case 'confirmed': return '확정'
    case 'cancel':
    case 'cancelled': return '취소'
    case 'complete':
    case 'completed': return '완료'
    default: return '미정'
  }
}

export const getAssignmentStatusColor = (tour: any) => {
  if (!tour?.assignment_status) {
    return 'bg-gray-100 text-gray-800'
  }
  
  const normalizedStatus = tour.assignment_status.toLowerCase()
  switch (normalizedStatus) {
    case 'confirm':
    case 'confirmed': 
      return 'bg-green-100 text-green-800'
    case 'pending': 
      return 'bg-yellow-100 text-yellow-800'
    default: 
      return 'bg-gray-100 text-gray-800'
  }
}

export const getAssignmentStatusText = (tour: any) => {
  if (!tour?.assignment_status) {
    return '미정'
  }
  
  const normalizedStatus = tour.assignment_status.toLowerCase()
  switch (normalizedStatus) {
    case 'confirm':
    case 'confirmed': 
      return '확정'
    case 'pending': 
      return '대기'
    default: 
      return '미정'
  }
}

// 국가 코드 매핑
export const getCountryCode = (language: string) => {
  const languageMap: Record<string, string> = {
    'ko': 'KR',
    'en': 'US',
    'ja': 'JP',
    'zh': 'CN',
    'es': 'ES',
    'fr': 'FR',
    'de': 'DE',
    'it': 'IT',
    'pt': 'PT',
    'ru': 'RU',
    'ar': 'SA',
    'th': 'TH',
    'vi': 'VN',
    'id': 'ID',
    'ms': 'MY',
    'tl': 'PH'
  }
  return languageMap[language] || 'US'
}

// 안전한 JSON 파싱 유틸리티 함수
export const safeJsonParse = (data: string | object | null | undefined, fallback: any = null) => {
  if (data && typeof data === 'object') {
    return data;
  }
  
  if (data && typeof data === 'string' && data.trim() !== '') {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('JSON 파싱 에러:', error, '입력값:', data);
      return fallback;
    }
  }
  
  return fallback;
}

// 투어 상태 옵션들
export const tourStatusOptions = [
  { value: 'recruiting', label: '모집중', color: 'bg-blue-100 text-blue-800' },
  { value: 'Confirmed', label: '확정', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: '취소', color: 'bg-red-100 text-red-800' },
  { value: 'completed', label: '완료', color: 'bg-gray-100 text-gray-800' }
]

// 배정 상태 옵션들
export const assignmentStatusOptions = [
  { value: 'confirm', label: '확정', color: 'bg-green-100 text-green-800' },
  { value: 'pending', label: '대기', color: 'bg-yellow-100 text-yellow-800' }
]

// Google Maps 링크 열기
export const openGoogleMaps = (link: string) => {
  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer')
  }
}
