import type { CustomerPageZone } from '@/lib/customerPageZones'
import type { TranslationFieldDef } from '@/lib/customerPageTranslations'

export type DetailFieldKey =
  | 'slogan1'
  | 'slogan2'
  | 'slogan3'
  | 'greeting'
  | 'description'
  | 'included'
  | 'not_included'
  | 'pickup_drop_info'
  | 'luggage_info'
  | 'tour_operation_info'
  | 'preparation_info'
  | 'small_group_info'
  | 'companion_recruitment_info'
  | 'notice_info'
  | 'important_notes'
  | 'private_tour_info'
  | 'cancellation_policy'
  | 'chat_announcement'

export type BasicFieldKey =
  | 'customerNameKo'
  | 'customerNameEn'
  | 'summaryKo'
  | 'summaryEn'
  | 'description'
  | 'tags'
  | 'departureCity'
  | 'arrivalCity'
  | 'departureCountry'
  | 'arrivalCountry'
  | 'departureCityKo'
  | 'departureCityEn'
  | 'arrivalCityKo'
  | 'arrivalCityEn'
  | 'departureCountryKo'
  | 'departureCountryEn'
  | 'arrivalCountryKo'
  | 'arrivalCountryEn'
  | 'duration'
  | 'maxParticipants'
  | 'groupSize'
  | 'languages'
  | 'transportationMethods'
  | 'adultBasePrice'
  | 'childBasePrice'
  | 'infantBasePrice'
  | 'adultAge'
  | 'childAgeMin'
  | 'childAgeMax'
  | 'infantAge'

export type ZoneEditType =
  | 'detail-fields'
  | 'basic-fields'
  | 'admin-tab'
  | 'field-picker'
  | 'info'
  | 'tags-bilingual'
  | 'translation-fields'

export type ZoneEditConfig = {
  label: string
  editType: ZoneEditType
  adminTab?: string
  detailFields?: DetailFieldKey[]
  basicFields?: BasicFieldKey[]
  translationNamespace?: string
  translationFields?: TranslationFieldDef[]
  note?: string
  /** info 타입: 안내 문구 */
  infoLines?: string[]
  /** basic-fields / detail-fields 저장 시 상품 ID 필요 */
  requiresProduct?: boolean
}

const HOME_CATEGORY_LABEL_FIELDS: TranslationFieldDef[] = [
  { key: 'antelopeCanyon', label: '앤텔롭 캐년' },
  { key: 'grandCanyon', label: '그랜드 캐년' },
  { key: 'suburbanTour', label: '근교 투어' },
  { key: 'dayTour', label: '당일 투어' },
  { key: 'accommodationTour', label: '숙박 투어' },
  { key: 'cityTour', label: '시티 투어' },
  { key: 'helicopterTour', label: '헬기 투어' },
  { key: 'lightAircraftTour', label: '경비행기 투어' },
  { key: 'busTour', label: '버스 투어' },
  { key: 'premiumTour', label: '프리미엄 투어' },
  { key: 'performanceTicket', label: '공연·티켓' },
  { key: 'attraction', label: '어트랙션' },
]

export const DETAIL_FIELD_LABELS: Record<DetailFieldKey, string> = {
  slogan1: '슬로건 (대제목)',
  slogan2: '슬로건 (부제)',
  slogan3: '슬로건 (설명)',
  greeting: '인사말',
  description: '상품 설명',
  included: '포함 사항',
  not_included: '불포함 사항',
  pickup_drop_info: '픽업·드롭',
  luggage_info: '짐·수하물',
  tour_operation_info: '투어 운영 안내',
  preparation_info: '준비물·복장',
  small_group_info: '소그룹 안내',
  companion_recruitment_info: '동행 모집 안내',
  notice_info: '유의사항',
  important_notes: '중요 안내',
  private_tour_info: '단독 투어 안내',
  cancellation_policy: '취소·환불 정책',
  chat_announcement: '채팅방 공지',
}

export const BASIC_FIELD_LABELS: Record<BasicFieldKey, string> = {
  customerNameKo: '고객용 상품명 (한국어)',
  customerNameEn: '고객용 상품명 (English)',
  summaryKo: '요약 (한국어)',
  summaryEn: '요약 (English)',
  description: '상품 설명 (내부)',
  tags: '태그',
  departureCity: '출발 도시',
  arrivalCity: '도착 도시',
  departureCountry: '출발 국가',
  arrivalCountry: '도착 국가',
  departureCityKo: '출발 도시 (한국어)',
  departureCityEn: '출발 도시 (English)',
  arrivalCityKo: '도착 도시 (한국어)',
  arrivalCityEn: '도착 도시 (English)',
  departureCountryKo: '출발 국가 (한국어)',
  departureCountryEn: '출발 국가 (English)',
  arrivalCountryKo: '도착 국가 (한국어)',
  arrivalCountryEn: '도착 국가 (English)',
  duration: '소요 시간 (시간)',
  maxParticipants: '최대 인원',
  groupSize: '그룹 규모',
  languages: '언어',
  transportationMethods: '운송 수단',
  adultBasePrice: '성인 기본가',
  childBasePrice: '아동 기본가',
  infantBasePrice: '유아 기본가',
  adultAge: '성인 연령 기준',
  childAgeMin: '아동 연령 (최소)',
  childAgeMax: '아동 연령 (최대)',
  infantAge: '유아 연령 기준',
}

export const ALL_DETAIL_FIELDS: DetailFieldKey[] = Object.keys(
  DETAIL_FIELD_LABELS
) as DetailFieldKey[]

export const ADMIN_TAB_LABELS: Record<string, string> = {
  basic: '기본정보',
  details: '상세정보',
  media: '미디어',
  schedule: '투어 일정',
  'tour-courses': '투어 코스',
  faq: 'FAQ',
  choices: '초이스',
  options: '옵션',
  'dynamic-pricing': '동적 가격',
  'tag-translations': '태그 번역',
  products: '상품 관리',
  reservations: '예약 관리',
}

/** 고객 페이지 zone → 편집 설정 */
export const CUSTOMER_PAGE_ZONE_EDIT_MAP: Record<CustomerPageZone, ZoneEditConfig> = {
  'listing-card': {
    label: '상품 카드',
    editType: 'admin-tab',
    adminTab: 'basic',
    note: '카드 전체는 기본정보·미디어 등 여러 탭의 내용으로 구성됩니다.',
  },
  'listing-card-name': {
    label: '상품명·카테고리',
    editType: 'basic-fields',
    basicFields: ['customerNameKo', 'customerNameEn'],
    requiresProduct: true,
  },
  'listing-card-price': {
    label: '시작 가격',
    editType: 'basic-fields',
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
  },
  'listing-card-tags': {
    label: '태그',
    editType: 'tags-bilingual',
    requiresProduct: true,
  },
  'listing-card-location': {
    label: '출발·도착',
    editType: 'basic-fields',
    basicFields: [
      'departureCityKo',
      'departureCityEn',
      'arrivalCityKo',
      'arrivalCityEn',
      'departureCountryKo',
      'departureCountryEn',
      'arrivalCountryKo',
      'arrivalCountryEn',
    ],
    requiresProduct: true,
  },
  'listing-card-description': {
    label: '짧은 설명',
    editType: 'basic-fields',
    basicFields: ['summaryKo', 'summaryEn', 'description'],
  },
  'detail-header': {
    label: '상단 헤더',
    editType: 'basic-fields',
    basicFields: ['customerNameKo', 'customerNameEn'],
    note: '태그는 「태그」 영역 수정에서 한·영 표시명을 편집할 수 있습니다.',
  },
  'detail-gallery': {
    label: '이미지 갤러리',
    editType: 'admin-tab',
    adminTab: 'media',
    note: '이미지·동영상은 미디어 탭에서 관리합니다.',
  },
  'detail-tabs': {
    label: '상세 탭',
    editType: 'admin-tab',
    adminTab: 'details',
    note: '각 탭 내용은 상세정보·일정·FAQ 등 해당 탭에서 편집합니다.',
  },
  'detail-tab-overview': {
    label: '개요 탭',
    editType: 'admin-tab',
    adminTab: 'details',
  },
  'detail-tab-itinerary': {
    label: '일정(코스) 탭',
    editType: 'admin-tab',
    adminTab: 'tour-courses',
  },
  'detail-tab-schedule': {
    label: '투어 일정 탭',
    editType: 'admin-tab',
    adminTab: 'schedule',
  },
  'detail-tab-details': {
    label: '상세정보 탭',
    editType: 'field-picker',
    detailFields: ALL_DETAIL_FIELDS.filter((f) => f !== 'slogan1' && f !== 'slogan2' && f !== 'slogan3' && f !== 'greeting' && f !== 'description'),
  },
  'detail-tab-faq': {
    label: 'FAQ 탭',
    editType: 'admin-tab',
    adminTab: 'faq',
  },
  'detail-overview-slogan': {
    label: '슬로건',
    editType: 'detail-fields',
    detailFields: ['slogan1', 'slogan2', 'slogan3'],
  },
  'detail-overview-greeting': {
    label: '인사말',
    editType: 'detail-fields',
    detailFields: ['greeting'],
  },
  'detail-overview-description': {
    label: '상품 설명',
    editType: 'detail-fields',
    detailFields: ['description'],
    note: '상세정보 탭의 「상품 설명」이 있으면 개요 탭에서 우선 표시됩니다.',
  },
  'detail-overview-keyinfo': {
    label: '핵심 정보',
    editType: 'basic-fields',
    basicFields: [
      'departureCityKo',
      'departureCityEn',
      'arrivalCityKo',
      'arrivalCityEn',
      'departureCountryKo',
      'departureCountryEn',
      'arrivalCountryKo',
      'arrivalCountryEn',
      'duration',
      'maxParticipants',
      'groupSize',
      'languages',
      'transportationMethods',
    ],
    note: '출발·도착은 언어별로 입력하면 고객 페이지 언어 전환 시 해당 값이 표시됩니다.',
  },
  'detail-overview-tags': {
    label: '태그',
    editType: 'tags-bilingual',
    requiresProduct: true,
  },
  'detail-details-body': {
    label: '상세정보 본문',
    editType: 'field-picker',
    detailFields: ALL_DETAIL_FIELDS.filter((f) => !['slogan1', 'slogan2', 'slogan3', 'greeting'].includes(f)),
  },
  'detail-sidebar': {
    label: '예약 패널',
    editType: 'basic-fields',
    basicFields: ['adultAge', 'childAgeMin', 'childAgeMax', 'infantAge', 'duration', 'maxParticipants', 'groupSize'],
    note: '가격·옵션은 아래 영역별 수정 버튼을 이용하세요.',
  },
  'detail-sidebar-price': {
    label: '가격',
    editType: 'basic-fields',
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
    note: '채널·날짜별 가격은 동적 가격 탭에서 설정합니다.',
  },
  'detail-sidebar-options': {
    label: '옵션 선택',
    editType: 'admin-tab',
    adminTab: 'choices',
    note: '초이스·옵션 탭에서 예약 선택 UI를 구성합니다.',
  },
  'detail-sidebar-included': {
    label: '포함·불포함 요약',
    editType: 'detail-fields',
    detailFields: ['included', 'not_included'],
  },
  'booking-participants': {
    label: '인원 선택',
    editType: 'basic-fields',
    basicFields: ['adultAge', 'childAgeMin', 'childAgeMax', 'infantAge', 'maxParticipants'],
  },
  'booking-options': {
    label: '예약 옵션',
    editType: 'admin-tab',
    adminTab: 'choices',
  },
  'home-hero': {
    label: '히어로 배너',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'unforgettable', label: '메인 타이틀 (1줄)', multiline: true },
      { key: 'specialTravelExperience', label: '메인 타이틀 (2줄)', multiline: true },
      { key: 'heroSubtitle1', label: '부제 (1줄)', multiline: true },
      { key: 'heroSubtitle2', label: '부제 (2줄)', multiline: true },
      { key: 'browseTours', label: '투어 둘러보기 버튼' },
      { key: 'watchIntroVideo', label: '소개 영상 버튼' },
    ],
  },
  'home-categories': {
    label: '카테고리 그리드',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'findToursByCategory', label: '섹션 제목' },
      { key: 'findToursByCategoryDesc', label: '섹션 설명', multiline: true },
      { key: 'viewAllTags', label: '전체 태그 보기 버튼' },
      ...HOME_CATEGORY_LABEL_FIELDS,
    ],
    note: '각 카테고리가 연결하는 태그·상품은 태그 번역·상품 태그 설정에서 조정합니다.',
  },
  'home-stats': {
    label: '통계 수치',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'satisfiedCustomers', label: '만족 고객 라벨' },
      { key: 'successfulTours', label: '성공 투어 라벨' },
      { key: 'professionalGuides', label: '전문 가이드 라벨' },
      { key: 'averageRating', label: '평균 평점 라벨' },
    ],
    note: '숫자(10,000+ 등)는 페이지 코드에 고정되어 있습니다.',
  },
  'home-popular': {
    label: '추천 투어',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'popularTours', label: '섹션 제목' },
      { key: 'popularToursDesc', label: '섹션 설명', multiline: true },
      { key: 'viewAllTours', label: '전체 투어 보기 버튼' },
    ],
    note: '표시할 상품·순서는 상품 관리에서 즐겨찾기·favorite_order로 설정합니다.',
  },
  'home-features': {
    label: '서비스 특징',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'whyChooseUs', label: '섹션 제목' },
      { key: 'whyChooseUsDesc', label: '섹션 설명', multiline: true },
      { key: 'professionalGuide', label: '특징 1 — 제목' },
      { key: 'professionalGuideDesc', label: '특징 1 — 설명', multiline: true },
      { key: 'customizedService', label: '특징 2 — 제목' },
      { key: 'customizedServiceDesc', label: '특징 2 — 설명', multiline: true },
      { key: 'safetyGuaranteed', label: '특징 3 — 제목' },
      { key: 'safetyGuaranteedDesc', label: '특징 3 — 설명', multiline: true },
      { key: 'support24_7', label: '특징 4 — 제목' },
      { key: 'support24_7Desc', label: '특징 4 — 설명', multiline: true },
    ],
  },
  'home-cta': {
    label: '하단 CTA',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'startYourJourney', label: '섹션 제목' },
      { key: 'contactUs', label: '섹션 부제', multiline: true },
      { key: 'browseTours', label: '투어 둘러보기 버튼' },
      { key: 'contact', label: '문의하기 버튼' },
    ],
  },
  'tags-page-header': {
    label: '태그 페이지 헤더',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'tagsPageTitle', label: '페이지 제목' },
      { key: 'tagsPageSubtitle', label: '페이지 설명', multiline: true },
      { key: 'tagsPageSearchPlaceholder', label: '검색 placeholder' },
    ],
  },
  'tags-page-categories': {
    label: '태그 카테고리 목록',
    editType: 'admin-tab',
    adminTab: 'tag-translations',
    note: '태그별 상품 노출은 태그 번역·상품 태그 설정으로 조정합니다.',
  },
  'custom-tour-header': {
    label: '맞춤 투어 소개',
    editType: 'translation-fields',
    translationNamespace: 'customTour',
    translationFields: [
      { key: 'title', label: '페이지 제목' },
      { key: 'subtitle', label: '페이지 설명', multiline: true },
    ],
  },
  'custom-tour-builder': {
    label: '코스·견적 빌더',
    editType: 'admin-tab',
    adminTab: 'tour-courses',
    note: '투어 코스·비용은 투어 코스·비용 계산기 관리에서 설정합니다.',
  },
  'reservation-check-header': {
    label: '예약 조회 안내',
    editType: 'translation-fields',
    translationNamespace: 'reservationCheck',
    translationFields: [
      { key: 'title', label: '페이지 제목' },
      { key: 'subtitle', label: '페이지 설명', multiline: true },
    ],
  },
  'reservation-check-form': {
    label: '예약 조회 폼',
    editType: 'translation-fields',
    translationNamespace: 'reservationCheck',
    translationFields: [
      { key: 'formTitle', label: '폼 제목' },
      { key: 'reservationIdLabel', label: '예약번호 라벨' },
      { key: 'reservationIdPlaceholder', label: '예약번호 placeholder' },
      { key: 'emailLabel', label: '이메일 라벨' },
      { key: 'emailPlaceholder', label: '이메일 placeholder' },
      { key: 'searchButton', label: '조회 버튼' },
      { key: 'searching', label: '조회 중 문구' },
    ],
    note: '예약 데이터 자체는 예약 관리에서 확인·수정합니다.',
  },
}

export function getZoneEditConfig(zone: CustomerPageZone): ZoneEditConfig | undefined {
  return CUSTOMER_PAGE_ZONE_EDIT_MAP[zone]
}
