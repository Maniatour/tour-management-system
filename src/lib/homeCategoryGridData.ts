import type { CategoryTagItem } from '@/components/home/homeSectionTypes'

/** Home category icon grid — shared between page data and admin zone labels */
export const HOME_CATEGORY_GRID_ITEMS: CategoryTagItem[] = [
  { labelKey: 'antelopeCanyon', tagQuery: '앤텔롭' },
  { labelKey: 'grandCanyon', tagQuery: '그랜드캐년' },
  { labelKey: 'suburbanTour', tagQuery: '근교' },
  { labelKey: 'dayTour', tagQuery: '당일' },
  { labelKey: 'accommodationTour', tagQuery: '숙박' },
  { labelKey: 'cityTour', tagQuery: '시티' },
  { labelKey: 'helicopterTour', tagQuery: '헬기' },
  { labelKey: 'lightAircraftTour', tagQuery: '경비행기' },
  { labelKey: 'busTour', tagQuery: '버스' },
  { labelKey: 'premiumTour', tagQuery: '프리미엄' },
  { labelKey: 'performanceTicket', tagQuery: '공연' },
  { labelKey: 'attraction', tagQuery: '어트랙션' },
  { labelKey: 'categoryEvent', tagQuery: '이벤트' },
  { labelKey: 'categoryCoupon', tagQuery: '쿠폰' },
  { labelKey: 'categoryTravelInsurance', tagQuery: '여행자보험' },
  { labelKey: 'categoryConventionSupport', tagQuery: '컨벤션' },
]

export type HomeCategoryTileStyle = {
  background: string
  iconColor: string
}

export const HOME_CATEGORY_TILE_STYLES: Record<string, HomeCategoryTileStyle> = {
  antelopeCanyon: { background: '#fce7c8', iconColor: '#c2410c' },
  grandCanyon: { background: '#fde68a', iconColor: '#b45309' },
  suburbanTour: { background: '#dbeafe', iconColor: '#1d4ed8' },
  dayTour: { background: '#fef3c7', iconColor: '#d97706' },
  accommodationTour: { background: '#e0e7ff', iconColor: '#4338ca' },
  cityTour: { background: '#f3e8ff', iconColor: '#7c3aed' },
  helicopterTour: { background: '#fce7f3', iconColor: '#db2777' },
  lightAircraftTour: { background: '#e0f2fe', iconColor: '#0284c7' },
  busTour: { background: '#fef9c3', iconColor: '#ca8a04' },
  premiumTour: { background: '#ecfdf5', iconColor: '#059669' },
  performanceTicket: { background: '#ffedd5', iconColor: '#ea580c' },
  attraction: { background: '#ede9fe', iconColor: '#6d28d9' },
  categoryEvent: { background: '#fce7f3', iconColor: '#be185d' },
  categoryCoupon: { background: '#ffe4e6', iconColor: '#e11d48' },
  categoryTravelInsurance: { background: '#dbeafe', iconColor: '#2563eb' },
  categoryConventionSupport: { background: '#d1fae5', iconColor: '#047857' },
}

export function getHomeCategoryTileStyle(labelKey: string): HomeCategoryTileStyle {
  return (
    HOME_CATEGORY_TILE_STYLES[labelKey] ?? {
      background: '#f3f4f6',
      iconColor: '#374151',
    }
  )
}

/** Choose Your Adventure — illustrated PNG icons (no circular badge) */
export const HOME_CATEGORY_ILLUSTRATION_MAP: Record<string, string> = {
  antelopeCanyon: '/images/adventure/antelope-canyon.png',
  grandCanyon: '/images/adventure/grand-canyon.png',
  suburbanTour: '/images/adventure/short-distance.png',
  dayTour: '/images/adventure/day-tour.png',
  accommodationTour: '/images/adventure/overnight-tour.png',
  cityTour: '/images/adventure/city-tour.png',
  helicopterTour: '/images/adventure/helicopter.png',
  lightAircraftTour: '/images/adventure/airplane.png',
  busTour: '/images/adventure/bus-tour.png',
  premiumTour: '/images/adventure/premium-van.png',
  performanceTicket: '/images/adventure/show-tickets.png',
  attraction: '/images/adventure/attraction.png',
  categoryEvent: '/images/adventure/event.png',
  categoryCoupon: '/images/adventure/coupon.png',
  categoryTravelInsurance: '/images/adventure/travel-insurance.png',
  categoryConventionSupport: '/images/adventure/convention.png',
}

export function getHomeCategoryIllustration(labelKey: string): string | null {
  return HOME_CATEGORY_ILLUSTRATION_MAP[labelKey] ?? null
}
