/** 고객 페이지 DOM 하이라이트용 zone id (data-customer-zone) */

export type CustomerPageZone =
  | 'listing-card'
  | 'listing-card-name'
  | 'listing-card-price'
  | 'listing-card-tags'
  | 'listing-card-location'
  | 'listing-card-description'
  | 'detail-header'
  | 'detail-gallery'
  | 'detail-highlights'
  | 'detail-mobile-booking'
  | 'detail-faq-section'
  | 'detail-tabs'
  | 'detail-tab-overview'
  | 'detail-tab-itinerary'
  | 'detail-tab-schedule'
  | 'detail-tab-details'
  | 'detail-tab-faq'
  | 'detail-overview-slogan'
  | 'detail-overview-greeting'
  | 'detail-overview-description'
  | 'detail-overview-keyinfo'
  | 'detail-overview-tags'
  | 'detail-details-body'
  | 'detail-sidebar'
  | 'detail-sidebar-price'
  | 'detail-sidebar-options'
  | 'detail-sidebar-included'
  | 'booking-participants'
  | 'booking-options'
  | 'home-hero'
  | 'home-categories'
  | 'home-stats'
  | 'home-popular'
  | 'home-features'
  | 'home-cta'
  | 'tags-page-header'
  | 'tags-page-categories'
  | 'custom-tour-header'
  | 'custom-tour-builder'
  | 'reservation-check-header'
  | 'reservation-check-form'

export type CustomerPreviewPage = 'listing' | 'detail' | 'booking'

export type CustomerPreviewTarget = {
  id: string
  page: CustomerPreviewPage
  /** iframe highlight query (data-customer-zone) */
  highlightZone: CustomerPageZone
  /** 상품 상세 탭 (detail 페이지만) */
  tab?: 'overview' | 'itinerary' | 'tour-schedule' | 'details' | 'faq'
  /** UI 표시용 라벨 (breadcrumb 마지막 구간) */
  label: string
  pathLabel: string
}

const DETAIL_TAB_MAP: Record<string, CustomerPreviewTarget['tab']> = {
  개요: 'overview',
  '일정(코스)': 'itinerary',
  '투어 일정': 'tour-schedule',
  상세정보: 'details',
  FAQ: 'faq',
}

function pathToString(path: string[]): string {
  return path.join(' › ')
}

/** breadcrumb 경로 한 줄 → 미리보기 타겟 */
function resolveSinglePath(path: string[]): CustomerPreviewTarget | null {
  if (path.length === 0) return null

  const joined = path.join(' ')
  const last = path[path.length - 1] ?? ''
  const pathLabel = pathToString(path)

  if (path[0] === '상품 목록') {
    let zone: CustomerPageZone = 'listing-card'
    if (last.includes('상품명') || last.includes('카테고리')) zone = 'listing-card-name'
    else if (last.includes('가격') || last.includes('시작')) zone = 'listing-card-price'
    else if (last.includes('태그')) zone = 'listing-card-tags'
    else if (last.includes('짧은 설명') || last.includes('요약')) zone = 'listing-card-description'
    else if (last.includes('출발') || last.includes('도착') || last.includes('노출')) {
      zone = last.includes('노출') ? 'listing-card' : 'listing-card-location'
    }
    return {
      id: `listing-${zone}`,
      page: 'listing',
      highlightZone: zone,
      label: last,
      pathLabel,
    }
  }

  if (path[0] === '예약하기') {
    const zone: CustomerPageZone = joined.includes('인원') ? 'booking-participants' : 'booking-options'
    return {
      id: `booking-${zone}`,
      page: 'booking',
      highlightZone: zone,
      label: last,
      pathLabel,
    }
  }

  if (path[0] === '투어 채팅방') {
    return null
  }

  if (path[0] !== '상품 상세') return null

  // 우측 예약 패널
  if (path.includes('우측 예약 패널')) {
    let zone: CustomerPageZone = 'detail-sidebar'
    if (last.includes('가격') || last.includes('기본가') || last.includes('총액')) zone = 'detail-sidebar-price'
    else if (last.includes('옵션') || last.includes('추가')) zone = 'detail-sidebar-options'
    else if (last.includes('포함') || last.includes('불포함')) zone = 'detail-sidebar-included'
    else if (last.includes('인원') || last.includes('연령') || last.includes('투어 정보')) {
      zone = 'detail-sidebar'
    }
    return {
      id: `detail-sidebar-${zone}`,
      page: 'detail',
      highlightZone: zone,
      tab: 'overview',
      label: last,
      pathLabel,
    }
  }

  // 상단 갤러리
  if (path.includes('이미지 갤러리') || (path.includes('상단') && !path.includes('헤더'))) {
    return {
      id: 'detail-gallery',
      page: 'detail',
      highlightZone: 'detail-gallery',
      tab: 'overview',
      label: last,
      pathLabel,
    }
  }

  // 상단 헤더
  if (path.includes('상단 헤더')) {
    return {
      id: 'detail-header',
      page: 'detail',
      highlightZone: 'detail-header',
      tab: 'overview',
      label: last,
      pathLabel,
    }
  }

  // 탭별
  const tabSegment = path.find((p) => p.endsWith('탭'))
  if (tabSegment) {
    const tabName = tabSegment.replace(' 탭', '')
    const tab = DETAIL_TAB_MAP[tabName] ?? 'overview'

    let zone: CustomerPageZone =
      tab === 'overview'
        ? 'detail-tab-overview'
        : tab === 'itinerary'
          ? 'detail-tab-itinerary'
          : tab === 'tour-schedule'
            ? 'detail-tab-schedule'
            : tab === 'details'
              ? 'detail-tab-details'
              : 'detail-tab-faq'

    if (tab === 'overview') {
      if (last.includes('슬로건') && last.includes('대제목')) zone = 'detail-overview-slogan'
      else if (last.includes('슬로건')) zone = 'detail-overview-slogan'
      else if (last.includes('인사말')) zone = 'detail-overview-greeting'
      else if (last.includes('설명')) zone = 'detail-overview-description'
      else if (last.includes('소요') || last.includes('정원') || last.includes('운송') || last.includes('그룹')) {
        zone = 'detail-overview-keyinfo'
      } else if (last.includes('태그')) zone = 'detail-overview-tags'
      else if (last.includes('출발') || last.includes('도착')) zone = 'detail-overview-keyinfo'
    }

    if (tab === 'details') {
      zone = 'detail-details-body'
    }

    return {
      id: `detail-${tab}-${zone}`,
      page: 'detail',
      highlightZone: zone,
      tab,
      label: last,
      pathLabel,
    }
  }

  return {
    id: 'detail-generic',
    page: 'detail',
    highlightZone: 'detail-tabs',
    tab: 'overview',
    label: last || '상품 상세',
    pathLabel,
  }
}

export function resolvePreviewTargetsFromPaths(paths: string[][]): CustomerPreviewTarget[] {
  const seen = new Set<string>()
  const targets: CustomerPreviewTarget[] = []

  for (const path of paths) {
    const target = resolveSinglePath(path)
    if (!target || seen.has(target.id)) continue
    seen.add(target.id)
    targets.push(target)
  }

  return targets
}

export function buildCustomerPreviewUrl(
  locale: string,
  productId: string | null,
  target: CustomerPreviewTarget
): string | null {
  const params = new URLSearchParams({ preview: '1', highlight: target.highlightZone })
  if (target.tab) params.set('tab', target.tab)

  if (target.page === 'listing') {
    if (productId) params.set('productId', productId)
    return `/${locale}/products?${params.toString()}`
  }

  if (target.page === 'booking') {
    if (!productId) return null
    params.set('openBooking', '1')
    return `/${locale}/products/${productId}?${params.toString()}`
  }

  if (!productId) return null
  return `/${locale}/products/${productId}?${params.toString()}`
}
