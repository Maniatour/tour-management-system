import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeTimeInput(value: string): string {
  // 시간 입력을 정리하는 함수
  // HH:MM 형식으로 변환
  if (!value) return ''
  
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

export function formatTimeWithAMPM(timeString: string): string {
  // HH:MM 형식의 시간을 AM/PM 형식으로 변환
  if (!timeString) return ''
  
  const [hours, minutes] = timeString.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return timeString
  
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}