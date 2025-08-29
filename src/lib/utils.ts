/**
 * 시간 문자열을 검증하고 올바른 형식으로 변환하는 유틸리티 함수들
 */

/**
 * 시간 문자열이 올바른 형식인지 검증
 * @param timeString - 검증할 시간 문자열 (예: "18:00", "09:30")
 * @returns 올바른 형식이면 true, 아니면 false
 */
export function isValidTimeFormat(timeString: string): boolean {
  if (!timeString || typeof timeString !== 'string') return false;
  
  // HH:MM 형식 검증 (24시간 형식)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}

/**
 * 시간 문자열을 정규화 (HH:MM 형식으로 변환)
 * @param timeString - 정규화할 시간 문자열
 * @returns 정규화된 시간 문자열 또는 null
 */
export function normalizeTimeString(timeString: string): string | null {
  if (!timeString || typeof timeString !== 'string') return null;
  
  // 이미 올바른 형식이면 그대로 반환
  if (isValidTimeFormat(timeString)) {
    return timeString;
  }
  
  // 다양한 형식 처리
  let normalized = timeString.trim();
  
  // "18:00:000" 같은 형식에서 밀리초 제거
  if (normalized.includes(':')) {
    const parts = normalized.split(':');
    if (parts.length >= 2) {
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      normalized = `${hours}:${minutes}`;
      
      if (isValidTimeFormat(normalized)) {
        return normalized;
      }
    }
  }
  
  // 숫자만 있는 경우 (예: "1800" -> "18:00")
  if (/^\d{3,4}$/.test(normalized)) {
    const hours = Math.floor(parseInt(normalized) / 100);
    const minutes = parseInt(normalized) % 100;
    
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  return null;
}

/**
 * 시간 입력 필드의 값을 안전하게 처리
 * @param value - 입력된 값
 * @returns 검증된 시간 문자열 또는 빈 문자열
 */
export function sanitizeTimeInput(value: string): string {
  if (!value) return '';
  
  const normalized = normalizeTimeString(value);
  return normalized || '';
}

/**
 * 시간을 12시간 형식으로 변환
 * @param timeString - 24시간 형식 시간 문자열
 * @returns 12시간 형식 문자열
 */
export function formatTime12Hour(timeString: string): string {
  if (!isValidTimeFormat(timeString)) return timeString;
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * 시간을 24시간 형식으로 변환
 * @param timeString - 12시간 형식 시간 문자열
 * @returns 24시간 형식 문자열
 */
export function formatTime24Hour(timeString: string): string {
  if (!timeString) return '';
  
  // 이미 24시간 형식이면 그대로 반환
  if (isValidTimeFormat(timeString)) {
    return timeString;
  }
  
  // 12시간 형식 처리 (예: "6:30 PM")
  const match = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  
  return timeString;
}
