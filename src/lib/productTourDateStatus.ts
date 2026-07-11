export type TourDateStatus =
  | 'available'
  | 'recruiting'
  | 'confirmed'
  | 'almost_full'
  | 'closed'
  | 'past'

export function toIsoDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getTourDateStatus(
  dateString: string,
  todayIso: string,
  closedDates: Set<string>,
  reservationCounts: Record<string, number>
): TourDateStatus {
  if (dateString < todayIso) {
    return 'past'
  }

  if (closedDates.has(dateString)) {
    return 'closed'
  }

  const reservationCount = reservationCounts[dateString] || 0

  if (reservationCount >= 10) {
    return 'almost_full'
  }
  if (reservationCount >= 4) {
    return 'confirmed'
  }
  if (reservationCount >= 1) {
    return 'recruiting'
  }
  return 'available'
}

export const TOUR_DATE_STATUS_DOT_CLASS: Record<TourDateStatus, string> = {
  available: 'bg-green-500',
  recruiting: 'bg-orange-500',
  confirmed: 'bg-gray-900',
  almost_full: 'bg-yellow-500',
  closed: 'bg-red-500',
  past: 'bg-transparent',
}

export function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay.getDay()
  const cells: Array<{ date: Date | null; isCurrentMonth: boolean }> = []

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ date: null, isCurrentMonth: false })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), isCurrentMonth: true })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, isCurrentMonth: false })
  }

  return cells
}
