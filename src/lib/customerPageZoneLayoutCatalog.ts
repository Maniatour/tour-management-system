import type { CustomerPageId } from '@/lib/customer-page-registry'
import type { CustomerPageZone } from '@/lib/customerPageZones'

export type ZoneLayoutPageId = Extract<
  CustomerPageId,
  | 'products-listing'
  | 'products-tags'
  | 'reservation-check'
  | 'custom-tour'
  | 'product-detail'
  | 'product-booking'
>

export type PageZoneBlockDef = {
  zoneId: CustomerPageZone
  label: string
  description: string
  icon: string
  /** 드래그 순서에서 고정 위치 (헤더·사이드바 등) */
  fixed?: 'top' | 'sidebar' | 'bottom'
}

export const ZONE_LAYOUT_PAGE_IDS: readonly ZoneLayoutPageId[] = [
  'products-listing',
  'products-tags',
  'reservation-check',
  'custom-tour',
  'product-detail',
  'product-booking',
] as const

const PAGE_ZONE_BLOCKS: Record<ZoneLayoutPageId, PageZoneBlockDef[]> = {
  'products-listing': [
    {
      zoneId: 'listing-page-header',
      label: '페이지 헤더',
      description: '제목·부제목 영역',
      icon: '📋',
    },
    {
      zoneId: 'listing-page-filters',
      label: '검색·필터',
      description: '검색, 카테고리·태그·가격 필터, 뷰 모드',
      icon: '🔎',
    },
    {
      zoneId: 'listing-page-results',
      label: '상품 목록',
      description: '카테고리별·그리드 상품 카드',
      icon: '🛍️',
    },
  ],
  'product-booking': [
    {
      zoneId: 'booking-overlay-header',
      label: '오버레이 헤더',
      description: '예약하기 제목·상품명·닫기',
      icon: '📋',
      fixed: 'top',
    },
    {
      zoneId: 'booking-overlay-stepper',
      label: '진행 단계',
      description: '예약 단계 표시줄',
      icon: '🧭',
    },
    {
      zoneId: 'booking-overlay-content',
      label: '단계 콘텐츠',
      description: '날짜·옵션·고객정보·결제 영역',
      icon: '📄',
    },
    {
      zoneId: 'booking-overlay-footer',
      label: '하단 버튼',
      description: '이전·다음·결제 버튼',
      icon: '⬇️',
      fixed: 'bottom',
    },
  ],
  'products-tags': [
    {
      zoneId: 'tags-page-header',
      label: '페이지 헤더',
      description: '제목·부제목 영역',
      icon: '📋',
    },
    {
      zoneId: 'tags-page-categories',
      label: '태그 카테고리',
      description: '태그별 상품 카드 그리드',
      icon: '🏷️',
    },
  ],
  'reservation-check': [
    {
      zoneId: 'reservation-check-header',
      label: '페이지 헤더',
      description: '제목·뒤로가기 영역',
      icon: '📋',
    },
    {
      zoneId: 'reservation-check-form',
      label: '예약 조회 폼',
      description: '예약번호·이메일 입력 및 결과',
      icon: '🔍',
    },
  ],
  'custom-tour': [
    {
      zoneId: 'custom-tour-header',
      label: '페이지 헤더',
      description: '맞춤 투어 제목·설명',
      icon: '📋',
    },
    {
      zoneId: 'custom-tour-builder',
      label: '투어 빌더',
      description: '코스 선택·일정·견적 영역',
      icon: '🗺️',
    },
  ],
  'product-detail': [
    {
      zoneId: 'detail-header',
      label: '상품 헤더',
      description: '상품명·가격·예약 CTA',
      icon: '📌',
      fixed: 'top',
    },
    {
      zoneId: 'detail-gallery',
      label: '갤러리',
      description: '상품 이미지·사진',
      icon: '🖼️',
    },
    {
      zoneId: 'detail-mobile-booking',
      label: '모바일 예약 카드',
      description: '모바일 전용 예약 패널',
      icon: '📱',
    },
    {
      zoneId: 'detail-highlights',
      label: '하이라이트',
      description: '슬로건·태그·핵심 정보',
      icon: '✨',
    },
    {
      zoneId: 'detail-tabs',
      label: '상세 탭',
      description: '개요·일정·FAQ 등 탭 패널',
      icon: '📑',
    },
    {
      zoneId: 'detail-faq-section',
      label: 'FAQ 섹션',
      description: '자주 묻는 질문',
      icon: '❓',
    },
    {
      zoneId: 'detail-sidebar',
      label: '예약 사이드바',
      description: '데스크톱 예약 패널',
      icon: '🛒',
      fixed: 'sidebar',
    },
  ],
}

export function pageSupportsZoneLayout(pageId: CustomerPageId): pageId is ZoneLayoutPageId {
  return (ZONE_LAYOUT_PAGE_IDS as readonly CustomerPageId[]).includes(pageId)
}

export function getPageZoneBlocks(pageId: ZoneLayoutPageId): PageZoneBlockDef[] {
  return PAGE_ZONE_BLOCKS[pageId].map((block) => ({ ...block }))
}

export function getDefaultPageZoneOrder(pageId: ZoneLayoutPageId): CustomerPageZone[] {
  return getPageZoneBlocks(pageId).map((block) => block.zoneId)
}

export function getPageZoneBlockDef(
  pageId: ZoneLayoutPageId,
  zoneId: CustomerPageZone
): PageZoneBlockDef | null {
  return getPageZoneBlocks(pageId).find((block) => block.zoneId === zoneId) ?? null
}

export function getPageZoneBlockLabel(pageId: ZoneLayoutPageId, zoneId: CustomerPageZone): string {
  return getPageZoneBlockDef(pageId, zoneId)?.label ?? zoneId
}
