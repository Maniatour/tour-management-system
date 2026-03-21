import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converts any time string to HH:mm (24-hour) for use in <input type="time">.
 * Accepts: "12:00 AM", "1:30 PM", "09:00", "09:00:00", etc.
 */
export function timeToHHmm(value: string): string {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''

  // Already HH:mm or HH:mm:ss or HH:mm:ss.SSS (24h)
  const hhmmMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d{1,3})?)?$/i)
  if (hhmmMatch) return `${hhmmMatch[1].padStart(2, '0')}:${hhmmMatch[2]}`

  // 12-hour with AM/PM: "12:00 AM", "1:30 PM", "9:45 am"
  const amPmMatch = trimmed.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)/i)
  if (amPmMatch) {
    let h = parseInt(amPmMatch[1], 10)
    const m = amPmMatch[2]
    const isPm = amPmMatch[3].toUpperCase() === 'PM'
    if (isPm && h !== 12) h += 12
    if (!isPm && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${m}`
  }

  return ''
}

export function sanitizeTimeInput(value: string): string {
  // 시간 입력을 정리하는 함수
  // HH:MM 형식으로 변환
  if (!value) return ''
  // 12:00 AM 등 AM/PM 형식이면 먼저 24h로 변환
  const hhmm = timeToHHmm(value)
  if (hhmm) return hhmm
  // 숫자만 추출
  const numbers = value.replace(/\D/g, '')
  
  if (numbers.length === 0) return ''
  if (numbers.length === 1) return `0${numbers}:00`
  if (numbers.length === 2) return `${numbers}:00`
  if (numbers.length === 3) return `0${numbers[0]}:${numbers.slice(1)}`
  if (numbers.length === 4) return `${numbers.slice(0, 2)}:${numbers.slice(2)}`
  
  // 4자리 이상인 경우 앞의 4자리만 사용
  return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`
}

/**
 * dynamic_pricing.date 등 DB 비교용: HTML date 입력·이메일 파싱값을 YYYY-MM-DD 로 통일
 */
export function normalizeTourDateForDb(input: string | undefined | null): string {
  if (input == null || typeof input !== 'string') return ''
  const s = input.trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    const mm = mdy[1].padStart(2, '0')
    const dd = mdy[2].padStart(2, '0')
    const yyyy = mdy[3]
    return `${yyyy}-${mm}-${dd}`
  }
  const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (ymdSlash) {
    return `${ymdSlash[1]}-${ymdSlash[2].padStart(2, '0')}-${ymdSlash[3].padStart(2, '0')}`
  }
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    const yyyy = dmy[3]
    return `${yyyy}-${mm}-${dd}`
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return s
}

export function formatTimeWithAMPM(timeString: string): string {
  // HH:MM 형식의 시간을 AM/PM 형식으로 변환
  if (!timeString) return ''
  
  const [hours, minutes] = timeString.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return timeString
  
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}