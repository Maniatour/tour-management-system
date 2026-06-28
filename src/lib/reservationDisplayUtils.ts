export function isBefore48Hours(tourDate: string): boolean {
  if (!tourDate) return false

  try {
    const tourDateObj = new Date(tourDate)
    if (isNaN(tourDateObj.getTime())) return false

    const now = new Date()
    const diffMs = tourDateObj.getTime() - now.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    return diffHours > 48
  } catch (error) {
    console.error('날짜 계산 오류:', error)
    return false
  }
}

export function calculatePickupDate(pickupTime: string, tourDate: string): string {
  if (!pickupTime || !tourDate) return tourDate

  const time = pickupTime.split(':')[0]
  const hour = parseInt(time, 10)

  if (hour >= 21) {
    let tourDateObj: Date

    if (tourDate.includes(',')) {
      tourDateObj = new Date(tourDate)
    } else if (tourDate.includes('-')) {
      tourDateObj = new Date(tourDate)
    } else {
      tourDateObj = new Date(tourDate)
    }

    if (isNaN(tourDateObj.getTime())) {
      console.warn('Invalid tour date:', tourDate)
      return tourDate
    }

    tourDateObj.setDate(tourDateObj.getDate() - 1)
    return tourDateObj.toISOString().split('T')[0]
  }

  return tourDate
}

export function formatTimeToAMPM(timeString: string): string {
  if (!timeString) return timeString

  const [hours, minutes] = timeString.split(':')
  const hour = parseInt(hours, 10)
  const minute = parseInt(minutes, 10)

  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour

  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
}

export function calculateDuration(startTime: string, endTime: string): string | null {
  if (!startTime || !endTime) return null

  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)

  if (end < start) {
    end.setDate(end.getDate() + 1)
  }

  const diffMs = end.getTime() - start.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (diffHours > 0) {
    return diffMinutes > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffHours}h`
  }
  return `${diffMinutes}m`
}
