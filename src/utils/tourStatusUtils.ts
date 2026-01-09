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

export const getStatusText = (status: string | null, locale: string = 'ko') => {
  const translations: Record<string, Record<string, string>> = {
    ko: {
      undefined: '미정',
      recruiting: '모집중',
      'recruiting': '모집중',
      'Recruiting': '모집중',
      confirm: '확정',
      confirmed: '확정',
      'confirmed': '확정',
      'Confirmed': '확정',
      'canceled - no minimum': '취소 - 최소인원 미달',
      'Canceled - No Minimum': '취소 - 최소인원 미달',
      'canceled - by customer': '취소 - 고객 요청',
      'Canceled - by customer': '취소 - 고객 요청',
      'canceled - no answer': '취소 - 응답 없음',
      'Canceled - No Answer': '취소 - 응답 없음',
      'canceled - event closed': '취소 - 이벤트 종료',
      'Canceled - Event Closed': '취소 - 이벤트 종료',
      deleted: '삭제됨',
      'Deleted': '삭제됨',
      approved: '승인됨',
      'Approved': '승인됨',
      requested: '요청됨',
      'Requested': '요청됨',
      cancel: '취소',
      cancelled: '취소',
      complete: '완료',
      completed: '완료'
    },
    en: {
      undefined: 'Undefined',
      recruiting: 'Recruiting',
      'recruiting': 'Recruiting',
      'Recruiting': 'Recruiting',
      confirm: 'Confirmed',
      confirmed: 'Confirmed',
      'confirmed': 'Confirmed',
      'Confirmed': 'Confirmed',
      'canceled - no minimum': 'Canceled - No Minimum',
      'Canceled - No Minimum': 'Canceled - No Minimum',
      'canceled - by customer': 'Canceled - by customer',
      'Canceled - by customer': 'Canceled - by customer',
      'canceled - no answer': 'Canceled - No Answer',
      'Canceled - No Answer': 'Canceled - No Answer',
      'canceled - event closed': 'Canceled - Event Closed',
      'Canceled - Event Closed': 'Canceled - Event Closed',
      deleted: 'Deleted',
      'Deleted': 'Deleted',
      approved: 'Approved',
      'Approved': 'Approved',
      requested: 'Requested',
      'Requested': 'Requested',
      cancel: 'Cancelled',
      cancelled: 'Cancelled',
      complete: 'Completed',
      completed: 'Completed'
    }
  }
  
  if (!status) return translations[locale]?.undefined || '미정'
  
  const normalizedStatus = status.toLowerCase().trim()
  const lang = translations[locale] || translations.ko
  
  // 정확한 매칭 시도 (원본 값 먼저)
  if (lang[status]) {
    return lang[status]
  }
  
  // 소문자로 정규화한 값으로 매칭
  if (lang[normalizedStatus]) {
    return lang[normalizedStatus]
  }
  
  // 부분 매칭
  if (normalizedStatus.includes('recruiting')) return lang.recruiting || '모집중'
  if (normalizedStatus.includes('confirm')) return lang.confirmed || '확정'
  if (normalizedStatus.includes('cancel')) {
    if (normalizedStatus.includes('no minimum')) return lang['canceled - no minimum'] || '취소 - 최소인원 미달'
    if (normalizedStatus.includes('by customer')) return lang['canceled - by customer'] || '취소 - 고객 요청'
    if (normalizedStatus.includes('no answer')) return lang['canceled - no answer'] || '취소 - 응답 없음'
    if (normalizedStatus.includes('event closed')) return lang['canceled - event closed'] || '취소 - 이벤트 종료'
    return lang.cancelled || '취소'
  }
  if (normalizedStatus.includes('complete')) return lang.completed || '완료'
  if (normalizedStatus.includes('deleted')) return lang.deleted || '삭제됨'
  if (normalizedStatus.includes('approved')) return lang.approved || '승인됨'
  if (normalizedStatus.includes('requested')) return lang.requested || '요청됨'
  
  // 번역이 없으면 원본 값 반환
  return status
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

export const getAssignmentStatusText = (tour: any, locale: string = 'ko') => {
  const translations = {
    ko: {
      undefined: '미정',
      confirm: '확정',
      confirmed: '확정',
      pending: '대기'
    },
    en: {
      undefined: 'Undefined',
      confirm: 'Confirmed',
      confirmed: 'Confirmed',
      pending: 'Pending'
    }
  }
  
  if (!tour?.assignment_status) {
    return translations[locale as keyof typeof translations].undefined
  }
  
  const normalizedStatus = tour.assignment_status.toLowerCase()
  const lang = translations[locale as keyof typeof translations] || translations.ko
  
  switch (normalizedStatus) {
    case 'confirm':
    case 'confirmed': 
      return lang.confirmed
    case 'pending': 
      return lang.pending
    default: 
      return lang.undefined
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

// 투어 상태 옵션들 (데이터베이스에 저장되는 실제 값 사용)
export const tourStatusOptions = [
  { value: 'Recruiting', label: '모집중', color: 'bg-blue-100 text-blue-800' },
  { value: 'Confirmed', label: '확정', color: 'bg-green-100 text-green-800' },
  { value: 'Canceled - No Minimum', label: '취소 - 최소인원 미달', color: 'bg-red-100 text-red-800' },
  { value: 'Canceled - by customer', label: '취소 - 고객 요청', color: 'bg-red-100 text-red-800' },
  { value: 'Canceled - No Answer', label: '취소 - 응답 없음', color: 'bg-red-100 text-red-800' },
  { value: 'Canceled - Event Closed', label: '취소 - 이벤트 종료', color: 'bg-red-100 text-red-800' },
  { value: 'Deleted', label: '삭제됨', color: 'bg-gray-100 text-gray-800' },
  { value: 'Approved', label: '승인됨', color: 'bg-green-100 text-green-800' },
  { value: 'Requested', label: '요청됨', color: 'bg-yellow-100 text-yellow-800' }
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
