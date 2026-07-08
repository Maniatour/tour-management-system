import type { ProductEmailDestinationKey } from '@/lib/productEmailDestinations'
import {
  DETAIL_FIELD_CONFIRMATION_EMAILS,
  DETAIL_FIELD_EMAIL_NOTE,
  INCLUDED_IN_EMAILS,
  PRODUCT_NAME_EMAILS,
  PRODUCT_NAME_EMAIL_NOTE,
  PRODUCT_PRICE_EMAILS,
  PRODUCT_PRICE_EMAIL_NOTE,
  PRODUCT_SCHEDULE_EMAILS,
  PRODUCT_SCHEDULE_EMAIL_NOTE,
} from '@/lib/productEmailDestinations'

/** 고객 페이지·이메일 등 노출 위치 */
export type CustomerPageLocationDef = {
  /** breadcrumb 경로. 여러 경로면 "또는" 으로 표시 */
  paths: string[][]
  /** 고객 페이지에 노출되지 않는 내부용 */
  internal?: boolean
  /** 짧은 보조 설명 */
  note?: string
  /** 포함되는 고객 이메일·알림 (내용 있을 때) */
  emails?: ProductEmailDestinationKey[]
  /** 이메일 노출 보조 설명 */
  emailNote?: string
}
/** 편집 탭 → 고객 페이지 영역 */
export const PRODUCT_EDIT_TAB_LOCATIONS: Record<string, CustomerPageLocationDef> = {
  basic: {
    paths: [
      ['상품 목록', '상품 카드'],
      ['상품 상세', '상단 헤더'],
      ['상품 상세', '개요 탭'],
      ['상품 상세', '우측 예약 패널'],
    ],
    note: '기본 정보·가격·태그 등이 목록 카드와 상세 페이지 여러 영역에 반영됩니다.',
    emails: PRODUCT_NAME_EMAILS,
    emailNote: PRODUCT_NAME_EMAIL_NOTE,
  },
  'dynamic-pricing': {
    paths: [['상품 상세', '우측 예약 패널', '가격(기본가·할인가)']],
    note: '채널·날짜별 판매가가 예약 패널 총액에 반영됩니다.',
    emails: PRODUCT_PRICE_EMAILS,
    emailNote: PRODUCT_PRICE_EMAIL_NOTE,
  },
  choices: {
    paths: [
      ['상품 상세', '우측 예약 패널', '옵션 선택'],
      ['예약하기', '옵션 단계'],
    ],
    note: '초이스 그룹·옵션이 고객 예약 화면 선택 UI에 표시됩니다.',
  },
  options: {
    paths: [['상품 상세', '우측 예약 패널', '추가 옵션']],
    note: '상품 옵션이 예약 시 선택 항목으로 노출됩니다.',
  },
  details: {
    paths: [
      ['상품 상세', '개요 탭', '슬로건·설명'],
      ['상품 상세', '상세정보 탭', '포함·안내 섹션'],
      ['상품 상세', '우측 예약 패널', '포함·불포함 요약'],
    ],
    note: '섹션별로 개요·상세정보·예약 패널 중 해당 위치에 표시됩니다.',
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  schedule: {
    paths: [['상품 상세', '투어 일정 탭', '일정 타임라인']],
    note: '「고객 노출」로 설정한 일정만 표시됩니다.',
    emails: PRODUCT_SCHEDULE_EMAILS,
    emailNote: PRODUCT_SCHEDULE_EMAIL_NOTE,
  },
  'tour-courses': {
    paths: [['상품 상세', '일정(코스) 탭', '코스·경유지']],
    note: '연결한 투어 코스가 일정 탭에 표시됩니다.',
  },
  faq: {
    paths: [['상품 상세', 'FAQ 탭', '질문·답변 목록']],
  },
  media: {
    paths: [['상품 상세', '상단', '이미지 갤러리']],
    note: '대표 이미지가 목록 카드 썸네일로도 사용될 수 있습니다.',
  },
  history: {
    paths: [],
    internal: true,
    note: '변경 내역은 관리자 전용이며 고객에게 표시되지 않습니다.',
  },
}

/** 기본정보 탭 섹션 */
export const BASIC_INFO_SECTION_LOCATIONS: Record<string, CustomerPageLocationDef> = {
  sectionTitle: {
    paths: [
      ['상품 상세', '상단 헤더', '상품명·카테고리'],
      ['상품 목록', '상품 카드', '상품명·카테고리'],
    ],
    note: '「고객용」 상품명·카테고리·판매 상태가 반영됩니다. 내부용 이름·상품 코드는 고객에게 보이지 않습니다.',
    emails: PRODUCT_NAME_EMAILS,
    emailNote: PRODUCT_NAME_EMAIL_NOTE,
  },
  departureArrival: {
    paths: [['상품 상세', '개요 탭', '출발·도착 정보']],
  },
  tourInfo: {
    paths: [['상품 상세', '개요 탭', '운송·언어·그룹 규모']],
  },
  ageSection: {
    paths: [
      ['상품 상세', '우측 예약 패널', '인원·연령'],
      ['예약하기', '인원 선택'],
    ],
  },
  priceSection: {
    paths: [
      ['상품 목록', '상품 카드', '시작 가격'],
      ['상품 상세', '우측 예약 패널', '기본가·총액'],
    ],
    emails: PRODUCT_PRICE_EMAILS,
    emailNote: PRODUCT_PRICE_EMAIL_NOTE,
  },
  productTags: {
    paths: [
      ['상품 상세', '상단 헤더', '태그 배지'],
      ['상품 목록', '상품 카드', '태그'],
      ['상품 상세', '개요 탭', '태그'],
    ],
  },
  additionalInfo: {
    paths: [
      ['상품 상세', '개요 탭', '소요 시간·정원'],
      ['상품 상세', '우측 예약 패널', '투어 정보'],
    ],
  },
  descriptionInternal: {
    paths: [
      ['상품 목록', '상품 카드', '짧은 설명'],
      ['홈', '인기 투어', '짧은 설명'],
      ['상품 상세', '개요 탭', '상품 설명'],
    ],
    note: '요약(한·영)이 없을 때 목록·홈 카드와 개요 탭에 표시됩니다. 상세정보 탭 「상품 설명」이 있으면 개요 탭에서는 그 내용이 우선입니다.',
  },
  productSummaryKo: {
    paths: [
      ['상품 목록', '상품 카드', '짧은 설명'],
      ['홈', '인기 투어', '짧은 설명'],
      ['상품 상세', '개요 탭', '상품 설명'],
    ],
    note: '한국어 페이지에서 「상품 설명 (내부)」보다 우선 표시됩니다.',
  },
  productSummaryEn: {
    paths: [
      ['상품 목록', '상품 카드', '짧은 설명'],
      ['홈', '인기 투어', '짧은 설명'],
      ['상품 상세', '개요 탭', '상품 설명'],
    ],
    note: '영어 페이지에서 「상품 설명 (내부)」보다 우선 표시됩니다.',
  },
}

/** 상세정보(세부정보) 탭 — 필드별 고객 페이지 위치 */
export const DETAIL_FIELD_LOCATIONS: Record<string, CustomerPageLocationDef> = {
  slogan1: {
    paths: [['상품 상세', '개요 탭', '상단 슬로건(대제목)']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  slogan2: {
    paths: [['상품 상세', '개요 탭', '슬로건(부제)']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  slogan3: {
    paths: [['상품 상세', '개요 탭', '슬로건(설명)']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  greeting: {
    paths: [['상품 상세', '개요 탭', '인사말 섹션']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  description: {
    paths: [['상품 상세', '개요 탭', '상품 설명']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  included: {
    paths: [
      ['상품 상세', '상세정보 탭', '포함 사항'],
      ['상품 상세', '우측 예약 패널', '포함 요약'],
    ],
    emails: INCLUDED_IN_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  not_included: {
    paths: [
      ['상품 상세', '상세정보 탭', '불포함 사항'],
      ['상품 상세', '우측 예약 패널', '불포함 요약'],
    ],
    emails: INCLUDED_IN_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  companion_recruitment_info: {
    paths: [['상품 상세', '상세정보 탭', '동행 모집 안내']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  notice_info: {
    paths: [['상품 상세', '상세정보 탭', '유의사항']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  important_notes: {
    paths: [['상품 상세', '상세정보 탭', '중요 안내']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  pickup_drop_info: {
    paths: [['상품 상세', '상세정보 탭', '픽업·드롭']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: '예약·영수증 이메일 「상품 상세 정보」의 만남 장소 항목',
  },
  preparation_info: {
    paths: [['상품 상세', '상세정보 탭', '준비물·복장']],
    emails: [...DETAIL_FIELD_CONFIRMATION_EMAILS, 'pickup_notification'],
    emailNote:
      '예약 이메일 「상품 상세 정보」 + 픽업 알림 이메일 「추천 준비물」 섹션',
  },
  cancellation_policy: {
    paths: [['상품 상세', '상세정보 탭', '취소·환불 정책']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  luggage_info: {
    paths: [['상품 상세', '상세정보 탭', '짐·수하물']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  tour_operation_info: {
    paths: [['상품 상세', '상세정보 탭', '투어 운영 안내']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  small_group_info: {
    paths: [['상품 상세', '상세정보 탭', '소그룹 안내']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  private_tour_info: {
    paths: [['상품 상세', '상세정보 탭', '단독 투어 안내']],
    emails: DETAIL_FIELD_CONFIRMATION_EMAILS,
    emailNote: DETAIL_FIELD_EMAIL_NOTE,
  },
  chat_announcement: {
    paths: [['투어 채팅방', '공지 메시지']],
    note: '상품 상세가 아닌 투어 채팅·예약 상세에 표시됩니다.',
    emails: ['customer_reservation_detail', 'tour_chat'],
    emailNote: '고객 예약 상세 화면 및 투어 채팅방 공지',
  },
}

export function getCustomerPageLocation(
  key: string,
  map: Record<string, CustomerPageLocationDef> = PRODUCT_EDIT_TAB_LOCATIONS
): CustomerPageLocationDef | undefined {
  return map[key]
}
