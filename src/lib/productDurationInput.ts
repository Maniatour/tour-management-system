export type ProductDurationParts = {
  hours: number
  minutes: number
}

const MAX_DURATION_MINUTES = 168 * 60

export function normalizeDurationParts(parts: ProductDurationParts): ProductDurationParts {
  let { hours, minutes } = parts
  if (!Number.isFinite(hours) || hours < 0) hours = 0
  if (!Number.isFinite(minutes) || minutes < 0) minutes = 0

  if (minutes >= 60) {
    hours += Math.floor(minutes / 60)
    minutes = minutes % 60
  }

  return { hours, minutes }
}

export function getTotalDurationMinutes(parts: ProductDurationParts): number {
  const normalized = normalizeDurationParts(parts)
  return normalized.hours * 60 + normalized.minutes
}

export function isValidProductDuration(parts: ProductDurationParts): boolean {
  const total = getTotalDurationMinutes(parts)
  return total > 0 && total <= MAX_DURATION_MINUTES
}

/** DB에 저장된 duration 문자열 → 시간·분 */
export function parseStoredProductDuration(value: string | null | undefined): ProductDurationParts {
  if (!value?.trim()) return { hours: 0, minutes: 0 }

  const trimmed = value.trim()
  const timeMatch = trimmed.match(/^(\d+):(\d+)(?::(\d+))?$/)
  if (timeMatch) {
    return normalizeDurationParts({
      hours: parseInt(timeMatch[1]!, 10),
      minutes: parseInt(timeMatch[2]!, 10),
    })
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const totalHours = parseFloat(trimmed)
    const hours = Math.floor(totalHours)
    const minutes = Math.round((totalHours - hours) * 60)
    return normalizeDurationParts({ hours, minutes })
  }

  return { hours: 0, minutes: 0 }
}

/** 자유 입력(1시간 20분, 80분, 1:20, 1.5 등) → 시간·분 */
export function parseFlexibleDurationInput(input: string): ProductDurationParts | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const colonMatch = trimmed.match(/^(\d+)\s*[:：]\s*(\d{1,2})$/)
  if (colonMatch) {
    return normalizeDurationParts({
      hours: parseInt(colonMatch[1]!, 10),
      minutes: parseInt(colonMatch[2]!, 10),
    })
  }

  const koHourMinuteMatch = trimmed.match(/^(\d+)\s*시간\s*(\d+)\s*분$/)
  if (koHourMinuteMatch) {
    return normalizeDurationParts({
      hours: parseInt(koHourMinuteMatch[1]!, 10),
      minutes: parseInt(koHourMinuteMatch[2]!, 10),
    })
  }

  const koMinuteOnlyMatch = trimmed.match(/^(\d+)\s*분$/)
  if (koMinuteOnlyMatch) {
    return normalizeDurationParts({
      hours: 0,
      minutes: parseInt(koMinuteOnlyMatch[1]!, 10),
    })
  }

  const koHourOnlyMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*시간$/)
  if (koHourOnlyMatch) {
    const totalHours = parseFloat(koHourOnlyMatch[1]!)
    const hours = Math.floor(totalHours)
    const minutes = Math.round((totalHours - hours) * 60)
    return normalizeDurationParts({ hours, minutes })
  }

  const enHourMinuteMatch = trimmed.match(/^(\d+)\s*h(?:ours?)?\s*(\d+)\s*m(?:in(?:ute)?s?)?$/i)
  if (enHourMinuteMatch) {
    return normalizeDurationParts({
      hours: parseInt(enHourMinuteMatch[1]!, 10),
      minutes: parseInt(enHourMinuteMatch[2]!, 10),
    })
  }

  const enMinuteOnlyMatch = trimmed.match(/^(\d+)\s*m(?:in(?:ute)?s?)?$/i)
  if (enMinuteOnlyMatch) {
    return normalizeDurationParts({
      hours: 0,
      minutes: parseInt(enMinuteOnlyMatch[1]!, 10),
    })
  }

  const enHourOnlyMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?$/i)
  if (enHourOnlyMatch) {
    const totalHours = parseFloat(enHourOnlyMatch[1]!)
    const hours = Math.floor(totalHours)
    const minutes = Math.round((totalHours - hours) * 60)
    return normalizeDurationParts({ hours, minutes })
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseStoredProductDuration(trimmed)
  }

  return null
}

/** 시간·분 → DB 저장용 문자열 (분이 있으면 H:MM:00, 없으면 시간만) */
export function formatProductDurationForStorage(parts: ProductDurationParts): string {
  const { hours, minutes } = normalizeDurationParts(parts)
  if (hours === 0 && minutes === 0) return ''
  if (minutes === 0) return String(hours)
  return `${hours}:${String(minutes).padStart(2, '0')}:00`
}
