import type { Product } from '@/components/product/productDetailTypes'

const CATEGORY_LABELS_EN: Record<string, string> = {
  city: 'City',
  nature: 'Nature',
  culture: 'Culture',
  adventure: 'Adventure',
  food: 'Food',
  tour: 'Tour',
  sightseeing: 'Sightseeing',
  outdoor: 'Outdoor',
}

const CATEGORY_LABELS_KO: Record<string, string> = {
  city: '도시',
  nature: '자연',
  culture: '문화',
  adventure: '모험',
  food: '음식',
  tour: '투어',
  sightseeing: '관광',
  outdoor: '야외활동',
}

export function getProductCategoryLabel(category: string, isEnglish: boolean): string {
  const labels = isEnglish ? CATEGORY_LABELS_EN : CATEGORY_LABELS_KO
  return labels[category] || category
}

export function getProductCustomerDisplayName(product: Product, locale: string): string {
  if (locale === 'en' && product.customer_name_en) {
    return product.customer_name_en
  }
  return product.customer_name_ko || product.name_ko || product.name
}

/** HH:MM:SS 등 시간 문자열을 일수·시간 표기로 변환 */
export function formatProductDuration(duration: string | null, isEnglish: boolean): string {
  if (!duration) return isEnglish ? 'Not specified' : '미정'

  const timeMatch = duration.match(/^(\d+):(\d+):(\d+)$/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const seconds = parseInt(timeMatch[3], 10)
    const totalHours = hours + minutes / 60 + seconds / 3600
    const days = Math.ceil(totalHours / 24)

    if (days === 1) {
      if (hours === 0 && minutes > 0) {
        return isEnglish ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes}분`
      }
      if (hours > 0 && minutes === 0) {
        return isEnglish ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours}시간`
      }
      if (hours > 0 && minutes > 0) {
        const hourLabel = isEnglish ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : `${hours}시간`
        const minuteLabel = isEnglish ? `${minutes} minute${minutes === 1 ? '' : 's'}` : `${minutes}분`
        return `${hourLabel} ${minuteLabel}`
      }
      const formattedHours = Math.round(totalHours * 10) / 10
      return isEnglish ? `${formattedHours} hours` : `${formattedHours}시간`
    }

    if (days === 2) return isEnglish ? '1 night 2 days' : '1박 2일'
    if (days === 3) return isEnglish ? '2 nights 3 days' : '2박 3일'
    if (days === 4) return isEnglish ? '3 nights 4 days' : '3박 4일'
    if (days === 5) return isEnglish ? '4 nights 5 days' : '4박 5일'
    if (days === 6) return isEnglish ? '5 nights 6 days' : '5박 6일'
    if (days === 7) return isEnglish ? '6 nights 7 days' : '6박 7일'

    const nights = days - 1
    return isEnglish
      ? `${nights} night${nights === 1 ? '' : 's'} ${days} day${days === 1 ? '' : 's'}`
      : `${nights}박 ${days}일`
  }

  return duration
}
