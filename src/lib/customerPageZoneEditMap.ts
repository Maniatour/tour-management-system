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
  /** 홈 등 — zone UI(색상·간격) 편집 지원 */
  supportsUiStyle?: boolean
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
  { key: 'guestReviewsTitle', label: '섹션 제목' },
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: [{ key: 'viewDetails', label: '버튼 문구' }],
  },
  'booking-overlay-header': {
    label: '예약 오버레이 헤더',
    editType: 'translation-fields',
    supportsUiStyle: true,
    translationNamespace: 'productDetail',
    translationFields: [],
    note: '예약하기 제목은 productDetail 번역 또는 코드 기본값을 사용합니다.',
  },
  'booking-overlay-stepper': {
    label: '예약 진행 단계',
    editType: 'admin-tab',
    adminTab: 'choices',
    supportsUiStyle: true,
    note: '단계 수·옵션 구성은 초이스·옵션 설정에 따릅니다.',
  },
  'booking-overlay-content': {
    label: '예약 단계 콘텐츠',
    editType: 'admin-tab',
    adminTab: 'choices',
    supportsUiStyle: true,
    note: '날짜·인원·옵션·고객정보·결제 UI는 예약 플로우 로직을 따릅니다.',
  },
  'booking-overlay-footer': {
    label: '예약 하단 버튼',
    editType: 'translation-fields',
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: [],
    note: '이전·다음·결제 버튼 문구는 예약 플로우 내 번역을 사용합니다.',
  },
  'detail-header': {
    label: '상단 헤더',
    editType: 'basic-fields',
    supportsUiStyle: true,
    basicFields: ['customerNameKo', 'customerNameEn'],
    note: '연결 컬럼에서 고객용·내부 상품명 중 편집할 필드를 선택할 수 있습니다. 태그는 「태그」 영역에서 편집합니다.',
  },
  'detail-header-price': {
    label: '헤더 가격·예약 CTA',
    editType: 'basic-fields',
    supportsUiStyle: true,
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
    note: '데스크톱 헤더 우측 가격·예약 버튼 영역입니다. 채널·날짜별 가격은 동적 가격 탭에서 설정합니다.',
  },
  'detail-gallery': {
    label: '이미지 갤러리',
    editType: 'admin-tab',
    adminTab: 'media',
    supportsUiStyle: true,
    note: '이미지·동영상은 미디어 탭에서 관리합니다.',
  },
  'detail-highlights': {
    label: '투어 하이라이트',
    editType: 'field-picker',
    supportsUiStyle: true,
    detailFields: ['slogan1', 'slogan2', 'slogan3', 'description'],
    note: '항목 선택 후 연결 컬럼으로 상세정보·products 요약/설명 필드를 바꿀 수 있습니다.',
  },
  'detail-mobile-booking': {
    label: '모바일 예약 카드',
    editType: 'admin-tab',
    adminTab: 'choices',
    supportsUiStyle: true,
    note: '가격·옵션·포함 사항은 예약 패널 영역별 수정을 이용하세요.',
  },
  'detail-mobile-sticky-cta': {
    label: '모바일 하단 예약 바',
    editType: 'basic-fields',
    supportsUiStyle: true,
    basicFields: ['adultBasePrice', 'childBasePrice', 'infantBasePrice'],
    note: '화면 하단 고정 가격·예약 버튼입니다. 옵션·예약 플로우는 모바일 예약 카드·옵션 영역에서 편집하세요.',
  },
  'detail-reviews-section': {
    label: '리뷰 섹션',
    editType: 'admin-tab',
    adminTab: 'overview',
    note: '실제 리뷰 데이터가 있을 때만 표시됩니다.',
    supportsUiStyle: true,
  },
  'detail-faq-section': {
    label: 'FAQ 섹션',
    editType: 'admin-tab',
    adminTab: 'faq',
    supportsUiStyle: true,
  },
  'detail-tabs': {
    label: '상세 탭',
    editType: 'admin-tab',
    adminTab: 'details',
    supportsUiStyle: true,
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
  'detail-details-body': {
    label: '상세정보 본문',
    editType: 'field-picker',
    detailFields: ALL_DETAIL_FIELDS.filter((f) => !['slogan1', 'slogan2', 'slogan3', 'greeting'].includes(f)),
  },
  'detail-sidebar': {
    label: '예약 패널',
    editType: 'basic-fields',
    supportsUiStyle: true,
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
    editType: 'translation-fields',
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: [
      { key: 'popularTours', label: '섹션 제목' },
      { key: 'popularToursDesc', label: '섹션 설명', multiline: true },
      { key: 'viewAllTours', label: '전체 투어 보기 버튼' },
    ],
    note: '섹션 제목·버튼은 여기서, 각 카드의 상품명·설명·출발지·가격·이미지는 카드 안 「수정」 버튼으로 편집합니다. 표시 상품·순서는 상품 관리 즐겨찾기·favorite_order로 설정합니다.',
  },
  'home-features': {
    label: '서비스 특징',
    editType: 'translation-fields',
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: HOME_REVIEWS_TRANSLATION_FIELDS,
    note: '동일 유형 섹션을 여러 개 추가해도 문구는 공유됩니다. 항목 수는 섹션 설정에서 조절하세요.',
  },
  'home-faq': {
    label: 'FAQ',
    editType: 'translation-fields',
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: HOME_FAQ_TRANSLATION_FIELDS,
    note: '질문·답변은 최대 5쌍까지 편집할 수 있습니다.',
  },
  'home-gallery': {
    label: '갤러리',
    editType: 'translation-fields',
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
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
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: [
      { key: 'richTextTitle', label: '섹션 제목' },
      { key: 'richTextBody', label: '본문', multiline: true },
    ],
  },
  'listing-page-header': {
    label: '상품 목록 헤더',
    editType: 'translation-fields',
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: [
      { key: 'tourProducts', label: '페이지 제목' },
      { key: 'unforgettableTravelExperience', label: '페이지 설명', multiline: true },
    ],
  },
  'listing-page-filters': {
    label: '검색·필터 바',
    editType: 'translation-fields',
    supportsUiStyle: true,
    translationNamespace: 'common',
    translationFields: [
      { key: 'searchProducts', label: '검색 placeholder' },
      { key: 'viewByTags', label: '태그별 보기 링크' },
      { key: 'groupedView', label: '카테고리별 뷰' },
      { key: 'gridView', label: '전체 그리드 뷰' },
    ],
    note: '카테고리·태그 옵션은 상품·태그 관리 데이터를 따릅니다.',
  },
  'listing-page-results': {
    label: '상품 목록 영역',
    editType: 'admin-tab',
    adminTab: 'products',
    supportsUiStyle: true,
    note: '노출 상품·순서는 상품 관리에서 조정합니다. 카드 내부 필드는 각 상품 카드의 수정 버튼으로 편집할 수 있습니다.',
  },
  'tags-page-header': {
    label: '태그 페이지 헤더',
    editType: 'translation-fields',
    supportsUiStyle: true,
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
    supportsUiStyle: true,
    note: '태그별 상품 노출은 태그 번역·상품 태그 설정으로 조정합니다. UI·색상 탭에서 카드·강조색을 바꿀 수 있습니다.',
  },
  'custom-tour-header': {
    label: '맞춤 투어 소개',
    editType: 'translation-fields',
    supportsUiStyle: true,
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
    supportsUiStyle: true,
    note: '투어 코스·비용은 투어 코스·비용 계산기 관리에서 설정합니다. UI·색상 탭에서 패널·버튼 스타일을 조정할 수 있습니다.',
  },
  'reservation-check-header': {
    label: '예약 조회 안내',
    editType: 'translation-fields',
    supportsUiStyle: true,
    translationNamespace: 'reservationCheck',
    translationFields: [
      { key: 'title', label: '페이지 제목' },
      { key: 'subtitle', label: '페이지 설명', multiline: true },
    ],
  },
  'reservation-check-form': {
    label: '예약 조회 폼',
    editType: 'translation-fields',
    supportsUiStyle: true,
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
