import type { CustomerPageZone } from '@/lib/customerPageZones'

export type ListingCardSlotId = Extract<
  CustomerPageZone,
  | 'listing-card-image'
  | 'listing-card-name'
  | 'listing-card-description'
  | 'listing-card-tags'
  | 'listing-card-location'
  | 'listing-card-price'
  | 'listing-card-cta'
>

export type ListingCardSlotDef = {
  slotId: ListingCardSlotId
  label: string
  description: string
  icon: string
  fixed?: 'top' | 'bottom'
}

export const LISTING_CARD_SLOTS: readonly ListingCardSlotDef[] = [
  {
    slotId: 'listing-card-image',
    label: '상품 이미지',
    description: '썸네일·운송수단 뱃지',
    icon: '🖼️',
    fixed: 'top',
  },
  {
    slotId: 'listing-card-name',
    label: '상품명',
    description: '제목 링크',
    icon: '🏷️',
  },
  {
    slotId: 'listing-card-description',
    label: '짧은 설명',
    description: '요약 텍스트',
    icon: '📝',
  },
  {
    slotId: 'listing-card-tags',
    label: '태그',
    description: '상품 태그 뱃지',
    icon: '🔖',
  },
  {
    slotId: 'listing-card-location',
    label: '위치·일정',
    description: '출발지·기간·인원',
    icon: '📍',
  },
  {
    slotId: 'listing-card-price',
    label: '가격',
    description: '시작가 표시',
    icon: '💰',
  },
  {
    slotId: 'listing-card-cta',
    label: '상세보기 버튼',
    description: '카드 하단 CTA',
    icon: '👉',
    fixed: 'bottom',
  },
] as const

export function getDefaultListingCardSlotOrder(): ListingCardSlotId[] {
  return LISTING_CARD_SLOTS.map((slot) => slot.slotId)
}

export function getListingCardSlotDef(slotId: ListingCardSlotId): ListingCardSlotDef | null {
  return LISTING_CARD_SLOTS.find((slot) => slot.slotId === slotId) ?? null
}

export function getListingCardSlotLabel(slotId: ListingCardSlotId): string {
  return getListingCardSlotDef(slotId)?.label ?? slotId
}
