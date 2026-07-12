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
  | 'internalNameKo'
  | 'internalNameEn'
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
  | 'home-settings'

export type HomeSettingsKind = 'hero' | 'popular' | 'destinations' | 'adventure'

export type ZoneEditConfig = {
  label: string
  editType: ZoneEditType
  homeSettingsKind?: HomeSettingsKind
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
  internalNameKo: '내부 상품명 (한국어)',
  internalNameEn: '내부 상품명 (English)',
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
const HOME_REVIEWS_TRANSLATION_FIELDS: TranslationFieldDef[] = [
  { key: 'homeReviewsManiaTourTitle', label: '후기 섹션 제목' },
  { key: 'homeReviewsManiaTourSubtitle', label: '후기 섹션 부제', multiline: true },
  { key: 'homeInstagramTitle', label: '인스타그램 제목' },
  { key: 'homeInstagramHandle', label: '인스타그램 핸들' },
  { key: 'guestReviewsTitle', label: '섹션 제목 (레거시)' },
  { key: 'guestReviewsDesc', label: '섹션 설명', multiline: true },
  { key: 'reviewGuest1Name', label: '후기 1 — 이름' },
  { key: 'reviewGuest1Country', label: '후기 1 — 국가' },
  { key: 'reviewGuest1Quote', label: '후기 1 — 내용', multiline: true },
  { key: 'reviewGuest2Name', label: '후기 2 — 이름' },
  { key: 'reviewGuest2Country', label: '후기 2 — 국가' },
  { key: 'reviewGuest2Quote', label: '후기 2 — 내용', multiline: true },
  { key: 'reviewGuest3Name', label: '후기 3 — 이름' },
  { key: 'reviewGuest3Country', label: '후기 3 — 국가' },
  { key: 'reviewGuest3Quote', label: '후기 3 — 내용', multiline: true },
]

const HOME_FAQ_TRANSLATION_FIELDS: TranslationFieldDef[] = [
  { key: 'faqTitle', label: '섹션 제목' },
  { key: 'faqDesc', label: '섹션 설명', multiline: true },
  { key: 'faqQ1', label: '질문 1' },
  { key: 'faqA1', label: '답변 1', multiline: true },
  { key: 'faqQ2', label: '질문 2' },
  { key: 'faqA2', label: '답변 2', multiline: true },
  { key: 'faqQ3', label: '질문 3' },
  { key: 'faqA3', label: '답변 3', multiline: true },
  { key: 'faqQ4', label: '질문 4' },
  { key: 'faqA4', label: '답변 4', multiline: true },
  { key: 'faqQ5', label: '질문 5' },
  { key: 'faqA5', label: '답변 5', multiline: true },
]

const HOME_PARTNER_LOGO_FIELDS: TranslationFieldDef[] = [
  { key: 'partnerLogo1', label: '로고 1' },
  { key: 'partnerLogo2', label: '로고 2' },
  { key: 'partnerLogo3', label: '로고 3' },
  { key: 'partnerLogo4', label: '로고 4' },
  { key: 'partnerLogo5', label: '로고 5' },
  { key: 'partnerLogo6', label: '로고 6' },
]

export const CUSTOMER_PAGE_ZONE_EDIT_MAP: Record<CustomerPageZone, ZoneEditConfig> = {
  'listing-card': {
    label: '상품 카드',
    editType: 'admin-tab',
    adminTab: 'basic',
    note: '카드 전체는 기본정보·미디어 등 여러 탭의 내용으로 구성됩니다. UI·색상 탭에서 카드 스타일을 조정할 수 있습니다.',
  },
  'listing-card-image': {
    label: '카드 이미지',
    editType: 'admin-tab',
    adminTab: 'media',
    note: '대표 이미지·갤러리는 미디어 탭에서 관리합니다.',
  },
  'listing-card-name': {
    label: '상품명·카테고리',
    editType: 'basic-fields',
    basicFields: ['customerNameKo', 'customerNameEn'],
    requiresProduct: true,
    note: '각 입력칸에서 「연결 컬럼」으로 고객용·내부 상품명 중 무엇을 편집할지 선택할 수 있습니다.',
  },
  'listing-card-price': {
    label: '시작 가격',
    editType: 'basic-fields',
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
    requiresProduct: true,
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
    note: '연결 컬럼에서 언어별·레거시(단일) 출발/도착 컬럼을 선택할 수 있습니다.',
  },
  'listing-card-description': {
    label: '짧은 설명',
    editType: 'basic-fields',
    basicFields: ['summaryKo', 'summaryEn'],
    note: '연결 컬럼에서 요약(한·영) 또는 내부 description 컬럼을 선택할 수 있습니다.',
  },
  'listing-card-cta': {
    label: '상세보기 버튼',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [{ key: 'viewDetails', label: '버튼 문구' }],
  },
  'booking-overlay-header': {
    label: '예약 오버레이 헤더',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [],
    note: '예약하기 제목은 productDetail 번역 또는 코드 기본값을 사용합니다.',
  },
  'booking-overlay-stepper': {
    label: '예약 진행 단계',
    editType: 'admin-tab',
    adminTab: 'choices',
    note: '단계 수·옵션 구성은 초이스·옵션 설정에 따릅니다.',
  },
  'booking-overlay-content': {
    label: '예약 단계 콘텐츠',
    editType: 'admin-tab',
    adminTab: 'choices',
    note: '날짜·인원·옵션·고객정보·결제 UI는 예약 플로우 로직을 따릅니다.',
  },
  'booking-overlay-footer': {
    label: '예약 하단 버튼',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [],
    note: '이전·다음·결제 버튼 문구는 예약 플로우 내 번역을 사용합니다.',
  },
  'detail-header': {
    label: '상단 헤더',
    editType: 'basic-fields',
    basicFields: ['customerNameKo', 'customerNameEn'],
    note: '연결 컬럼에서 고객용·내부 상품명 중 편집할 필드를 선택할 수 있습니다. 태그는 「태그」 영역에서 편집합니다.',
  },
  'detail-header-price': {
    label: '헤더 가격·예약 CTA',
    editType: 'basic-fields',
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
    note: '데스크톱 헤더 우측 가격·예약 버튼 영역입니다. 채널·날짜별 가격은 동적 가격 탭에서 설정합니다.',
  },
  'detail-gallery': {
    label: '이미지 갤러리',
    editType: 'admin-tab',
    adminTab: 'media',
    note: '이미지·동영상은 미디어 탭에서 관리합니다.',
  },
  'detail-highlights': {
    label: '투어 하이라이트',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'tourHighlights', label: '섹션 제목' },
      { key: 'tourHighlightsSubtitle', label: '섹션 부제', multiline: true },
      { key: 'trustLicensedOperator', label: '신뢰 배지 — 라이선스' },
      { key: 'trustSmallGroup', label: '신뢰 배지 — 소그룹' },
      { key: 'trustFreeCancellation', label: '신뢰 배지 — 무료 취소' },
      { key: 'trustInstantConfirmation', label: '신뢰 배지 — 즉시 확정' },
    ],
    note: '슬로건 문구는 「슬로건」 영역, 핵심 정보(시간·인원)는 「핵심 정보」 영역에서 편집합니다.',
  },
  'detail-mobile-booking': {
    label: '모바일 예약 카드',
    editType: 'admin-tab',
    adminTab: 'choices',
    note: '가격·옵션·포함 사항은 예약 패널 영역별 수정을 이용하세요.',
  },
  'detail-mobile-sticky-cta': {
    label: '모바일 하단 예약 바',
    editType: 'basic-fields',
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
    note: '화면 하단 고정 가격·예약 버튼입니다. 옵션·예약 플로우는 모바일 예약 카드·옵션 영역에서 편집하세요.',
  },
  'detail-reviews-section': {
    label: '리뷰 섹션',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'guestReviewsTitle', label: '섹션 제목' },
      { key: 'guestReviewsSubtitle', label: '섹션 부제', multiline: true },
    ],
    note: '실제 리뷰 데이터가 있을 때만 표시됩니다.',
  },
  'detail-faq-section': {
    label: 'FAQ 섹션',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'faqSectionTitle', label: '섹션 제목' },
      { key: 'noFaqRegistered', label: 'FAQ 없음 안내' },
    ],
    note: 'FAQ 질문·답변은 상품 관리 FAQ 탭에서 편집합니다.',
  },
  'detail-promo-codes': {
    label: '프로모 코드',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'promoCodesTitle', label: '프로모 박스 제목' },
      { key: 'platformPromoCode', label: '플랫폼 프로모 코드' },
      { key: 'platformPromoDiscountPercent', label: '할인율 (숫자만, 예: 10)' },
      { key: 'promoWelcomeTitle', label: '프로모 안내 제목' },
      { key: 'promoApplied', label: '적용됨 문구' },
      { key: 'promoInvalid', label: '유효하지 않음 문구' },
    ],
    note: '플랫폼 기본 프로모 코드·할인율을 사이트 전체 상품 상세에 표시합니다.',
  },
  'detail-tabs': {
    label: '상세 탭',
    editType: 'admin-tab',
    adminTab: 'details',
    note: '각 탭 내용은 상세정보·일정·FAQ 등 해당 탭에서 편집합니다.',
  },
  'detail-tab-overview': {
    label: '투어 소개',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'aboutThisTour', label: '섹션 제목' },
      { key: 'tourOverview', label: '개요 부제' },
      { key: 'keyInformation', label: '핵심 정보 제목' },
    ],
    note: '본문(인사말·설명·포함 등)은 아래 「슬로건」「인사말」「상품 설명」 영역에서 편집합니다.',
  },
  'detail-tab-itinerary': {
    label: '일정(코스)',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'tabItinerary', label: '섹션 제목' },
      { key: 'tourCourseDescription', label: '코스 설명 라벨' },
    ],
    note: '코스·정류장 내용은 관리자 「투어 코스」 탭에서 편집합니다.',
  },
  'detail-tab-schedule': {
    label: '투어 일정',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'pickupTitle', label: '픽업 섹션 제목' },
      { key: 'tourScheduleDisclaimer', label: '일정 면책 문구', multiline: true },
      { key: 'sunrisePickupDifferentDateTitle', label: '일출 픽업 — 제목' },
      { key: 'sunrisePickupDifferentDateBody', label: '일출 픽업 — 설명', multiline: true },
    ],
    note: '일정 데이터는 「투어 일정」 탭, 픽업 안내는 「픽업·드롭」 상세 필드에서 편집합니다.',
  },
  'detail-tab-details': {
    label: '알아두실 사항',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [
      { key: 'thingsToKnow', label: '섹션 제목' },
      { key: 'thingsToKnowSubtitle', label: '섹션 부제', multiline: true },
      { key: 'detailTabBasic', label: '아코디언 — 기본 정보' },
      { key: 'detailTabIncluded', label: '아코디언 — 포함/불포함' },
      { key: 'detailTabLogistics', label: '아코디언 — 운영 정보' },
      { key: 'detailTabPolicy', label: '아코디언 — 정책' },
    ],
    note: '각 항목 본문은 「상세정보 본문」 영역 또는 상품 상세정보 탭에서 편집합니다.',
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
    note: '슬로건은 상세정보 테이블 컬럼에 저장됩니다.',
  },
  'detail-overview-greeting': {
    label: '인사말',
    editType: 'detail-fields',
    detailFields: ['greeting'],
    note: '연결 컬럼에서 상세정보 인사말 또는 products 요약 필드를 선택할 수 있습니다.',
  },
  'detail-overview-description': {
    label: '상품 설명',
    editType: 'detail-fields',
    detailFields: ['description'],
    note: '연결 컬럼에서 상세정보 설명·products.description·요약(한·영) 중 편집할 필드를 선택할 수 있습니다.',
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
    note: '출발·도착은 연결 컬럼에서 언어별·레거시 컬럼을 선택할 수 있습니다.',
  },
  'detail-overview-tags': {
    label: '태그',
    editType: 'tags-bilingual',
    requiresProduct: true,
  },
  'detail-tour-offers-heading': {
    label: '투어 제공 항목 제목',
    editType: 'translation-fields',
    translationNamespace: 'productDetail',
    translationFields: [{ key: 'whatThisTourOffers', label: '섹션 제목' }],
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
    note: '연결 컬럼에서 상세정보 포함/불포함 또는 products.description을 선택할 수 있습니다.',
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
    editType: 'home-settings',
    homeSettingsKind: 'hero',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homeManiaTourHeroTitle', label: '메인 타이틀', multiline: true },
      { key: 'homeManiaTourHeroSubtitle', label: '부제', multiline: true },
      { key: 'homeManiaTourHeroCta', label: 'CTA 버튼' },
      { key: 'homeHeroStatReviewsNumber', label: '리뷰 수치' },
      { key: 'homeHeroStatReviews', label: '리뷰 라벨' },
      { key: 'homeHeroStatTravelersNumber', label: '여행자 수치' },
      { key: 'homeHeroStatTravelers', label: '여행자 라벨' },
      { key: 'homeHeroStatSmallGroupNumber', label: '소그룹 수치' },
      { key: 'homeHeroStatSmallGroup', label: '소그룹 라벨' },
      { key: 'homeHeroStatSinceNumber', label: '경력 수치' },
      { key: 'homeHeroStatSince', label: '경력 라벨' },
      { key: 'unforgettable', label: '메인 타이틀 (1줄)', multiline: true },
      { key: 'specialTravelExperience', label: '메인 타이틀 (2줄)', multiline: true },
      { key: 'heroSubtitle1', label: '부제 (1줄)', multiline: true },
      { key: 'heroSubtitle2', label: '부제 (2줄)', multiline: true },
      { key: 'browseTours', label: '투어 둘러보기 버튼' },
      { key: 'watchIntroVideo', label: '소개 영상 버튼' },
    ],
  },
  'home-categories': {
    label: 'Explore Top Destinations',
    editType: 'home-settings',
    homeSettingsKind: 'destinations',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homeDestinationsManiaTourTitle', label: '목적지 섹션 제목' },
      { key: 'homeViewAllDestinations', label: '전체 보기 버튼' },
      { key: 'homeDestinationsTitle', label: '목적지 제목 (GYG)' },
      { key: 'findToursByCategory', label: '카테고리 섹션 제목' },
      { key: 'findToursByCategoryDesc', label: '카테고리 섹션 설명', multiline: true },
      { key: 'viewAllTags', label: '전체 태그 보기 버튼' },
    ],
    note: '목적지 이름·태그·이미지는 아래에서 설정합니다. 클릭 시 해당 태그 투어 목록으로 이동합니다.',
  },
  'home-stats': {
    label: '통계 수치',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'statsSatisfiedCustomersNumber', label: '만족 고객 수치' },
      { key: 'satisfiedCustomers', label: '만족 고객 라벨' },
      { key: 'statsSuccessfulToursNumber', label: '성공 투어 수치' },
      { key: 'successfulTours', label: '성공 투어 라벨' },
      { key: 'statsProfessionalGuidesNumber', label: '전문 가이드 수치' },
      { key: 'professionalGuides', label: '전문 가이드 라벨' },
      { key: 'statsAverageRatingNumber', label: '평균 평점 수치' },
      { key: 'averageRating', label: '평균 평점 라벨' },
    ],
  },
  'home-popular': {
    label: 'Most Popular Tours',
    editType: 'home-settings',
    homeSettingsKind: 'popular',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homePopularToursTitle', label: '섹션 제목' },
      { key: 'homePopularToursSubtitle', label: '섹션 부제', multiline: true },
      { key: 'homeAttractionsTitle', label: '명소 섹션 제목' },
      { key: 'maniatourBadgeBestSeller', label: 'Best Seller 뱃지' },
      { key: 'maniatourBadgePopular', label: 'Popular 뱃지' },
      { key: 'homeViewAllTours', label: '전체 보기 버튼' },
      { key: 'maniatourPerPerson', label: '1인당 가격 라벨' },
    ],
    note: '표시할 투어 목록은 아래에서 직접 선택할 수 있습니다. 비워두면 즐겨찾기 순서를 사용합니다.',
  },
  'home-cards-activities': {
    label: '액티비티 카드 섹션',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homeActivitiesTitle', label: '섹션 제목' },
    ],
    note: '최근 등록 상품을 액티비티 카드 캐러셀로 표시합니다. 카드 콘텐츠는 카드 안 「수정」 버튼으로 편집합니다.',
  },
  'home-features': {
    label: '서비스 특징',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homeWhyManiaTourTitle', label: '섹션 제목' },
      { key: 'homeWhyManiaTourSubtitle', label: '섹션 설명', multiline: true },
      { key: 'maniatourFeatureSmallGroup', label: '특징 1 — 제목' },
      { key: 'maniatourFeatureSmallGroupDesc', label: '특징 1 — 설명', multiline: true },
      { key: 'maniatourFeatureGuides', label: '특징 2 — 제목' },
      { key: 'maniatourFeatureGuidesDesc', label: '특징 2 — 설명', multiline: true },
      { key: 'maniatourFeaturePickup', label: '특징 3 — 제목' },
      { key: 'maniatourFeaturePickupDesc', label: '특징 3 — 설명', multiline: true },
      { key: 'maniatourFeaturePhotos', label: '특징 4 — 제목' },
      { key: 'maniatourFeaturePhotosDesc', label: '특징 4 — 설명', multiline: true },
      { key: 'maniatourFeatureReviews', label: '특징 5 — 제목' },
      { key: 'maniatourFeatureReviewsDesc', label: '특징 5 — 설명', multiline: true },
      { key: 'maniatourFeatureLocal', label: '특징 6 — 제목' },
      { key: 'maniatourFeatureLocalDesc', label: '특징 6 — 설명', multiline: true },
      { key: 'whyChooseUs', label: '섹션 제목 (레거시)' },
      { key: 'whyChooseUsDesc', label: '섹션 설명 (레거시)', multiline: true },
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
  'home-reviews': {
    label: '고객 후기',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: HOME_REVIEWS_TRANSLATION_FIELDS,
    note: '동일 유형 섹션을 여러 개 추가해도 문구는 공유됩니다. 항목 수는 섹션 설정에서 조절하세요.',
  },
  'home-faq': {
    label: 'FAQ',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      ...HOME_FAQ_TRANSLATION_FIELDS,
      { key: 'homeFaqManiaTourTitle', label: 'FAQ 섹션 제목' },
      { key: 'homeCtaManiaTourTitle', label: 'CTA 배너 제목', multiline: true },
      { key: 'homeCtaManiaTourSubtitle', label: 'CTA 배너 부제', multiline: true },
      { key: 'homeCtaManiaTourButton', label: 'CTA 버튼' },
    ],
    note: '질문·답변은 최대 5쌍까지 편집할 수 있습니다.',
  },
  'home-travel-style': {
    label: 'Choose Your Adventure',
    editType: 'home-settings',
    homeSettingsKind: 'adventure',
    translationNamespace: 'common',
    translationFields: [{ key: 'homeTravelStyleTitle', label: '섹션 제목' }],
    note: '카테고리 이름·태그·아이콘 이미지는 아래에서 설정합니다. 클릭 시 /products?tag=... 로 이동합니다.',
  },
  'home-guides': {
    label: '여행 가이드',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homeGuidesTitle', label: '섹션 제목' },
      { key: 'homeGuidesSubtitle', label: '섹션 설명', multiline: true },
      { key: 'homeGuide1Title', label: '가이드 1 제목' },
      { key: 'homeGuide2Title', label: '가이드 2 제목' },
      { key: 'homeGuide3Title', label: '가이드 3 제목' },
      { key: 'homeGuide4Title', label: '가이드 4 제목' },
      { key: 'homeGuide5Title', label: '가이드 5 제목' },
    ],
  },
  'home-gallery': {
    label: '갤러리',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'galleryTitle', label: '섹션 제목' },
      { key: 'galleryDesc', label: '섹션 설명', multiline: true },
    ],
    note: '이미지는 추후 업로드·상품 연동 예정입니다. 현재는 플레이스홀더로 표시됩니다.',
  },
  'home-logos': {
    label: '파트너 로고',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'partnersTitle', label: '섹션 제목' },
      ...HOME_PARTNER_LOGO_FIELDS,
    ],
    note: '로고 이미지 업로드는 추후 지원 예정입니다.',
  },
  'home-video': {
    label: '영상 소개',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'videoSectionTitle', label: '섹션 제목' },
      { key: 'videoSectionDesc', label: '섹션 설명', multiline: true },
      { key: 'watchIntroVideo', label: '재생 안내 문구' },
    ],
    note: '영상 URL 임베드 설정은 추후 섹션 설정에서 지원 예정입니다.',
  },
  'home-newsletter': {
    label: '뉴스레터',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'newsletterTitle', label: '섹션 제목' },
      { key: 'newsletterDesc', label: '섹션 설명', multiline: true },
      { key: 'newsletterPlaceholder', label: '이메일 placeholder' },
      { key: 'newsletterCta', label: '구독 버튼' },
    ],
    note: '구독 폼은 UI만 제공됩니다. 메일 연동은 별도 설정이 필요합니다.',
  },
  'home-promo': {
    label: '프로모 배너',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'promoTitle', label: '프로모 제목' },
      { key: 'promoDesc', label: '프로모 설명', multiline: true },
      { key: 'promoCta', label: 'CTA 버튼' },
      { key: 'promoLimited', label: '한정 기간 라벨' },
    ],
  },
  'home-rich-text': {
    label: '콘텐츠 블록',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'richTextTitle', label: '섹션 제목' },
      { key: 'richTextBody', label: '본문', multiline: true },
    ],
  },
  'listing-page-header': {
    label: '상품 목록 헤더',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'listingPageTitle', label: '페이지 제목' },
      { key: 'navThingsToDo', label: '브레드크럼 (Things to do)' },
      { key: 'home', label: '브레드크럼 (홈)' },
    ],
  },
  'listing-page-filters': {
    label: '검색·필터',
    editType: 'translation-fields',
    translationNamespace: 'common',
    translationFields: [
      { key: 'homeSearchPlaceholder', label: '검색 placeholder' },
      { key: 'homeSearchAnytime', label: '날짜 placeholder' },
      { key: 'homeSearchParticipants', label: '인원 placeholder' },
      { key: 'search', label: '검색 버튼' },
      { key: 'all', label: '필터 — 전체' },
    ],
    note: '필터 pill·카테고리 옵션은 상품 데이터를 따릅니다.',
  },
  'listing-page-results': {
    label: '상품 목록 영역',
    editType: 'admin-tab',
    adminTab: 'products',
    note: '노출 상품·순서는 상품 관리에서 조정합니다. 카드 내부 필드는 각 상품 카드의 수정 버튼으로 편집할 수 있습니다.',
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
    note: '태그별 상품 노출은 태그 번역·상품 태그 설정으로 조정합니다. UI·색상 탭에서 카드·강조색을 바꿀 수 있습니다.',
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
    note: '투어 코스·비용은 투어 코스·비용 계산기 관리에서 설정합니다. UI·색상 탭에서 패널·버튼 스타일을 조정할 수 있습니다.',
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

const DYNAMIC_HOME_SECTION_KINDS = [
  'reviews',
  'faq',
  'gallery',
  'logos',
  'video',
  'newsletter',
  'promo',
  'rich-text',
] as const

/** 동적 instanceId(home-cards-*, home-reviews-*) → canonical zone */
export function resolveCustomerPageZone(zone: string): CustomerPageZone {
  if (zone in CUSTOMER_PAGE_ZONE_EDIT_MAP) {
    return zone as CustomerPageZone
  }
  if (zone.startsWith('home-cards-') && zone in CUSTOMER_PAGE_ZONE_EDIT_MAP) {
    return zone as CustomerPageZone
  }
  if (zone.startsWith('home-cards-')) {
    return 'home-popular'
  }
  for (const kind of DYNAMIC_HOME_SECTION_KINDS) {
    if (zone.startsWith(`home-${kind}-`)) {
      return `home-${kind}` as CustomerPageZone
    }
  }
  return zone as CustomerPageZone
}

export function getZoneEditConfig(zone: string): ZoneEditConfig | undefined {
  return CUSTOMER_PAGE_ZONE_EDIT_MAP[resolveCustomerPageZone(zone)]
}
