import type { LegalPageSlug } from '@/lib/customerSiteRoutes'
import { getLegalPageCatalogEntry } from '@/lib/legalPageCatalog'

export type LegalPageContent = {
  body: string
}

type LegacyLegalSection = {
  title: string
  paragraphs: string[]
  listItems?: string[]
}

type LegacyLegalPageContent = {
  title: string
  lastUpdated: string
  intro: string
  sections: LegacyLegalSection[]
}

type LegacyLocaleContent = Record<LegalPageSlug, LegacyLegalPageContent>

export function flattenLegacyLegalContent(content: LegacyLegalPageContent, locale: string): string {
  const isEn = locale === 'en'
  const parts: string[] = []

  parts.push(`# ${content.title}`)
  parts.push('')
  parts.push(
    isEn
      ? `*Last updated: ${content.lastUpdated}*`
      : `*최종 업데이트: ${content.lastUpdated}*`
  )
  parts.push('')

  if (content.intro.trim()) {
    parts.push(content.intro.trim())
    parts.push('')
  }

  for (const section of content.sections) {
    parts.push(`## ${section.title}`)
    parts.push('')

    for (const paragraph of section.paragraphs) {
      if (paragraph.trim()) {
        parts.push(paragraph.trim())
        parts.push('')
      }
    }

    if (section.listItems?.length) {
      for (const item of section.listItems) {
        if (item.trim()) {
          parts.push(`- ${item.trim()}`)
        }
      }
      parts.push('')
    }
  }

  return parts.join('\n').trim()
}

function normalizeBody(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function flattenLegacyRecord(raw: Record<string, unknown>, locale: string): string | null {
  const title = typeof raw.title === 'string' ? raw.title : ''
  const lastUpdated = typeof raw.lastUpdated === 'string' ? raw.lastUpdated : ''
  const intro = typeof raw.intro === 'string' ? raw.intro : ''
  const sections = Array.isArray(raw.sections) ? raw.sections : null

  if (!title && !intro && !sections?.length) {
    return null
  }

  const normalizedSections: LegacyLegalSection[] = (sections ?? []).map((section, index) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      return { title: `Section ${index + 1}`, paragraphs: [] }
    }

    const row = section as Record<string, unknown>
    const paragraphs = Array.isArray(row.paragraphs)
      ? row.paragraphs.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      : []
    const listItems = Array.isArray(row.listItems)
      ? row.listItems.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
      : undefined

    const normalized: LegacyLegalSection = {
      title: typeof row.title === 'string' ? row.title : `Section ${index + 1}`,
      paragraphs,
    }

    if (listItems?.length) {
      normalized.listItems = listItems
    }

    return normalized
  })

  return flattenLegacyLegalContent(
    {
      title: title || 'Policy',
      lastUpdated,
      intro,
      sections: normalizedSections,
    },
    locale
  )
}

export function extractLegalPageTitle(
  content: LegalPageContent,
  slug: LegalPageSlug,
  locale: string
): string {
  const match = content.body.match(/^#\s+(.+)$/m)
  if (match?.[1]?.trim()) {
    return match[1].trim()
  }

  const entry = getLegalPageCatalogEntry(slug)
  return locale === 'en' ? entry.title_en : entry.title_ko
}

export function normalizeLegalPageContent(
  raw: unknown,
  slug: LegalPageSlug,
  locale: string
): LegalPageContent {
  const fallback = getDefaultLegalPageContent(slug, locale)

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback
  }

  const content = raw as Record<string, unknown>

  if (typeof content.body === 'string') {
    return { body: normalizeBody(content.body, fallback.body) }
  }

  const legacyBody = flattenLegacyRecord(content, locale)
  if (legacyBody) {
    return { body: legacyBody }
  }

  return fallback
}

const LEGAL_CONTENT_KO: LegacyLocaleContent = {
  terms: {
    title: '이용약관',
    lastUpdated: '2026년 7월 9일',
    intro:
      'MANIA TOUR(이하 "회사")가 운영하는 웹사이트 및 예약 서비스(이하 "서비스")를 이용해 주셔서 감사합니다. 본 약관은 서비스 이용과 관련한 권리·의무 및 책임 사항을 규정합니다.',
    sections: [
      {
        title: '1. 약관의 동의',
        paragraphs: [
          '고객은 본 서비스를 이용함으로써 본 약관 및 개인정보 처리방침, 취소·환불 정책에 동의한 것으로 간주됩니다.',
          '회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 웹사이트를 통해 공지합니다.',
        ],
      },
      {
        title: '2. 서비스의 제공',
        paragraphs: [
          '회사는 라스베이거스 및 미국 서부 지역의 투어·액티비티 예약 중개 및 관련 고객 지원 서비스를 제공합니다.',
          '투어 일정, 가격, 포함·불포함 사항, 픽업 정보 등은 각 상품 페이지에 명시된 내용을 따릅니다.',
        ],
      },
      {
        title: '3. 예약 및 결제',
        paragraphs: [
          '예약은 웹사이트 또는 고객 지원 채널을 통해 접수되며, 결제 완료 또는 회사가 확인한 시점에 예약이 확정됩니다.',
          '표시된 가격은 미화(USD) 기준이며, 일부 상품에는 입장료·팁·세금 등이 별도로 부과될 수 있습니다. 해당 내용은 상품 상세 페이지에 안내됩니다.',
          '고객은 예약 시 정확한 연락처, 참가자 정보, 특별 요청 사항을 제공해야 합니다.',
        ],
      },
      {
        title: '4. 고객의 의무',
        paragraphs: ['고객은 다음 사항을 준수해야 합니다.'],
        listItems: [
          '예약 정보의 정확성 유지 및 변경 사항의 신속한 통지',
          '투어 당일 지정된 픽업 시간·장소 준수',
          '안전 수칙 및 가이드·운영자의 합리적인 지시 준수',
          '타 고객 또는 직원에게 피해를 주는 행위 금지',
        ],
      },
      {
        title: '5. 취소 및 환불',
        paragraphs: [
          '취소 및 환불은 별도의 취소·환불 정책에 따릅니다. 정책 전문은 취소·환불 정책 페이지에서 확인할 수 있습니다.',
        ],
      },
      {
        title: '6. 책임의 제한',
        paragraphs: [
          '천재지변, 교통 통제, 공항·국립공원 운영 변경 등 회사의 합리적 통제를 벗어난 사유로 인한 일정 변경 또는 취소에 대해서는 관련 법령 및 취소·환불 정책에 따릅니다.',
          '고객의 고의 또는 과실, 현장 안전 수칙 미준수로 발생한 손해에 대해서는 회사가 책임지지 않을 수 있습니다.',
        ],
      },
      {
        title: '7. 준거법 및 문의',
        paragraphs: [
          '본 약관은 미국 네바다주 법률을 준거법으로 합니다.',
          '서비스 이용과 관련한 문의는 웹사이트 문의 채널 또는 예약 확인 시 제공된 연락처로 접수해 주세요.',
        ],
      },
    ],
  },
  'privacy-policy': {
    title: '개인정보 처리방침',
    lastUpdated: '2026년 7월 9일',
    intro:
      'MANIA TOUR(이하 "회사")는 고객의 개인정보를 중요하게 보호하며, 관련 법령을 준수합니다. 본 방침은 수집하는 정보, 이용 목적, 보관 및 삭제에 대해 설명합니다.',
    sections: [
      {
        title: '1. 수집하는 정보',
        paragraphs: ['회사는 서비스 제공을 위해 다음과 같은 정보를 수집할 수 있습니다.'],
        listItems: [
          '예약 및 결제: 이름, 이메일, 전화번호, 국적, 참가자 정보',
          '고객 지원: 문의 내용, 예약 번호, 상담 기록',
          '투어 진행: 호텔 픽업 정보, 여권·신분증 사본(필요한 경우), 특별 요청 사항',
          '기술 정보: IP 주소, 브라우저 유형, 쿠키, 접속 일시',
        ],
      },
      {
        title: '2. 정보 이용 목적',
        paragraphs: ['수집된 정보는 다음 목적으로 이용됩니다.'],
        listItems: [
          '투어 예약 접수, 확인, 변경 및 고객 안내',
          '결제 처리 및 환불',
          '픽업·일정·안전 관련 운영 커뮤니케이션',
          '고객 문의 응대 및 서비스 품질 개선',
          '법적 의무 이행 및 분쟁 대응',
        ],
      },
      {
        title: '3. 정보 공유',
        paragraphs: [
          '회사는 원칙적으로 고객 정보를 외부에 판매하지 않습니다.',
          '다만 투어 운영, 결제 처리, 고객 지원을 위해 필요한 범위에서 신뢰할 수 있는 파트너(결제 대행사, 현지 운영사, 교통·입장권 공급업체 등)와 정보를 공유할 수 있습니다.',
        ],
      },
      {
        title: '4. 보관 및 삭제',
        paragraphs: [
          '예약 및 결제 기록은 관련 법령 및 회계·세무 목적상 필요한 기간 동안 보관됩니다.',
          '투어 진행을 위해 업로드된 패스·신분증 등 민감 정보는 투어 완료 후 개인정보 보호 정책에 따라 삭제됩니다.',
        ],
      },
      {
        title: '5. 고객 권리',
        paragraphs: [
          '고객은 본인의 개인정보에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 요청은 고객 지원 채널을 통해 접수해 주세요.',
          '마케팅 수신에 동의한 경우에도 언제든 수신 거부를 요청할 수 있습니다.',
        ],
      },
      {
        title: '6. 쿠키',
        paragraphs: [
          '웹사이트는 사용자 경험 개선, 언어 설정, 장바구니 기능 등을 위해 쿠키를 사용할 수 있습니다.',
          '브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 일부 기능이 제한될 수 있습니다.',
        ],
      },
      {
        title: '7. 문의',
        paragraphs: [
          '개인정보 처리와 관련한 문의는 웹사이트 문의 채널을 통해 접수해 주세요.',
        ],
      },
    ],
  },
  'sms-terms': {
    title: 'SMS 이용약관',
    lastUpdated: '2026년 7월 9일',
    intro:
      'MANIA TOUR(이하 "회사")는 예약 확인, 일정 안내, 현장 운영 관련 알림을 위해 SMS(문자 메시지)를 발송할 수 있습니다. 본 약관은 SMS 수신과 관련한 조건을 설명합니다.',
    sections: [
      {
        title: '1. 수신 동의',
        paragraphs: [
          '고객이 예약 시 연락처를 제공하고 SMS 수신에 동의한 경우, 서비스 관련 문자 메시지를 수신할 수 있습니다.',
          '동의는 필수 서비스 알림과 선택적 마케팅 메시지로 구분될 수 있으며, 마케팅 메시지는 별도 동의가 있는 경우에만 발송됩니다.',
        ],
      },
      {
        title: '2. 메시지 유형',
        paragraphs: ['발송될 수 있는 메시지 예시는 다음과 같습니다.'],
        listItems: [
          '예약 확인 및 결제 안내',
          '투어 전 리마인더(픽업 시간·장소 포함)',
          '일정 변경, 지연, 현장 안내',
          '고객 지원 회신',
          '동의한 경우 프로모션 및 특가 안내',
        ],
      },
      {
        title: '3. 발송 빈도',
        paragraphs: [
          '메시지 빈도는 예약 건수 및 운영 상황에 따라 달라집니다. 일반적으로 예약당 소수의 필수 알림이 발송됩니다.',
        ],
      },
      {
        title: '4. 수신 거부',
        paragraphs: [
          '마케팅 메시지는 메시지 내 안내된 방법(예: STOP 회신)으로 수신 거부할 수 있습니다.',
          '예약 확인·픽업 등 필수 운영 알림은 서비스 제공을 위해 예약 기간 동안 발송될 수 있습니다.',
        ],
      },
      {
        title: '5. 요금',
        paragraphs: [
          '회사는 SMS 발송 비용을 고객에게 별도 청구하지 않습니다. 다만 이동통신사 요금제에 따라 수신자에게 표준 메시지 및 데이터 요금이 부과될 수 있습니다.',
        ],
      },
      {
        title: '6. 지원',
        paragraphs: [
          'SMS 관련 문의는 웹사이트 문의 채널 또는 예약 시 제공된 고객 지원 연락처로 접수해 주세요.',
        ],
      },
    ],
  },
  'cancellation-refund-policy': {
    title: '취소·환불 정책',
    lastUpdated: '2026년 7월 9일',
    intro:
      'MANIA TOUR(이하 "회사")는 공정하고 투명한 취소·환불 기준을 운영합니다. 아래 정책은 일반적인 기준이며, 일부 상품은 상품 상세 페이지에 별도 정책이 명시될 수 있습니다. 상품별 정책이 있는 경우 해당 내용이 우선 적용됩니다.',
    sections: [
      {
        title: '1. 일반 취소 기준',
        paragraphs: ['투어 시작일 기준 일반적인 환불 기준은 다음과 같습니다.'],
        listItems: [
          '투어 3일 전까지 취소: 전액 환불',
          '투어 1일 전까지 취소: 50% 환불',
          '투어 당일 취소 또는 노쇼: 환불 불가',
        ],
      },
      {
        title: '2. 천재지변 및 운영 중단',
        paragraphs: [
          '천재지변, 국립공원 폐쇄, 교통 통제 등 회사 또는 현지 운영사의 통제를 벗어난 사유로 투어가 취소되는 경우, 전액 환불 또는 동등 가치의 일정 변경 중 선택할 수 있습니다.',
        ],
      },
      {
        title: '3. 포함·불포함 항목',
        paragraphs: [
          '환불 금액은 이미 사용·확정된 입장권, 항공 좌석, 숙박 등 환불 불가 항목이 있는 경우 해당 비용을 제외할 수 있습니다.',
          '입장료, 가이드 팁, 개인 경비 등 상품에 명시된 불포함 항목은 환불 대상이 아닙니다.',
        ],
      },
      {
        title: '4. 취소 방법',
        paragraphs: [
          '취소 요청은 예약 확인 페이지, 이메일, 또는 고객 지원 채널을 통해 접수해 주세요.',
          '취소 접수 시 예약 번호, 예약자 이름, 투어 날짜를 함께 알려주시면 신속히 처리됩니다.',
        ],
      },
      {
        title: '5. 환불 처리',
        paragraphs: [
          '승인된 환불은 원 결제 수단으로 처리되며, 카드사 및 결제 대행사에 따라 영업일 기준 5~10일이 소요될 수 있습니다.',
          '부분 환불 또는 크레딧 발급이 필요한 경우 고객 지원팀이 별도 안내드립니다.',
        ],
      },
      {
        title: '6. 문의',
        paragraphs: [
          '취소·환불과 관련한 문의는 웹사이트 문의 채널 또는 예약 확인 시 제공된 연락처로 접수해 주세요.',
        ],
      },
    ],
  },
  'cookie-policy': {
    title: '쿠키 정책',
    lastUpdated: '2026년 7월 9일',
    intro:
      'MANIA TOUR(이하 "회사")는 웹사이트 이용 경험 개선, 언어 설정 저장, 예약 기능 제공을 위해 쿠키 및 유사 기술을 사용할 수 있습니다. 본 정책은 쿠키의 종류, 사용 목적, 관리 방법을 설명합니다.',
    sections: [
      {
        title: '1. 쿠키란?',
        paragraphs: [
          '쿠키는 웹사이트 방문 시 브라우저에 저장되는 작은 텍스트 파일입니다. 쿠키는 사이트 기능 유지, 사용자 설정 기억, 이용 통계 분석 등에 사용됩니다.',
        ],
      },
      {
        title: '2. 사용하는 쿠키 유형',
        paragraphs: ['회사는 다음과 같은 쿠키를 사용할 수 있습니다.'],
        listItems: [
          '필수 쿠키: 로그인 상태, 언어 설정, 예약 장바구니 등 서비스 제공에 필요한 쿠키',
          '기능 쿠키: 사용자 환경 설정 및 편의 기능을 위한 쿠키',
          '분석 쿠키: 방문 통계 및 서비스 개선을 위한 익명화된 이용 데이터',
        ],
      },
      {
        title: '3. 쿠키 사용 목적',
        paragraphs: ['쿠키는 다음 목적으로 사용됩니다.'],
        listItems: [
          '웹사이트 기본 기능 및 보안 유지',
          '선호 언어 및 지역 설정 저장',
          '예약·결제 흐름 지원',
          '서비스 품질 및 이용 패턴 분석',
        ],
      },
      {
        title: '4. 쿠키 관리',
        paragraphs: [
          '브라우저 설정에서 쿠키 저장을 거부하거나 기존 쿠키를 삭제할 수 있습니다.',
          '필수 쿠키를 차단할 경우 일부 기능(예: 언어 유지, 예약 진행)이 정상적으로 동작하지 않을 수 있습니다.',
        ],
      },
      {
        title: '5. 제3자 쿠키',
        paragraphs: [
          '결제 처리, 분석 도구 등 신뢰할 수 있는 제3자 서비스가 쿠키를 설정할 수 있습니다. 해당 서비스의 정책은 각 제공업체 웹사이트에서 확인할 수 있습니다.',
        ],
      },
      {
        title: '6. 문의',
        paragraphs: [
          '쿠키 정책과 관련한 문의는 웹사이트 문의 채널을 통해 접수해 주세요.',
        ],
      },
    ],
  },
}

const LEGAL_CONTENT_EN: LegacyLocaleContent = {
  terms: {
    title: 'Terms of Service',
    lastUpdated: 'July 9, 2026',
    intro:
      'Thank you for using the website and booking services (the "Service") operated by MANIA TOUR ("Company"). These Terms govern your use of the Service and outline the rights and responsibilities of both parties.',
    sections: [
      {
        title: '1. Acceptance of Terms',
        paragraphs: [
          'By using the Service, you agree to these Terms, our Privacy Policy, and Cancellation & Refund Policy.',
          'We may update these Terms as permitted by applicable law. Material changes will be posted on this website.',
        ],
      },
      {
        title: '2. Services Provided',
        paragraphs: [
          'We provide tour and activity booking services in Las Vegas and the American Southwest, along with related customer support.',
          'Schedules, pricing, inclusions, exclusions, and pickup details are governed by the information shown on each product page.',
        ],
      },
      {
        title: '3. Booking and Payment',
        paragraphs: [
          'Bookings may be submitted through the website or customer support channels and are confirmed once payment is completed or verified by us.',
          'Prices are shown in USD. Some products may require separate fees for entrance tickets, tips, taxes, or other charges as disclosed on the product page.',
          'You must provide accurate contact details, participant information, and special requests when booking.',
        ],
      },
      {
        title: '4. Customer Responsibilities',
        paragraphs: ['You agree to the following when using our Service.'],
        listItems: [
          'Provide and maintain accurate booking information',
          'Arrive on time at the designated pickup location',
          'Follow safety instructions and reasonable directions from guides or staff',
          'Refrain from behavior that harms other guests or staff',
        ],
      },
      {
        title: '5. Cancellations and Refunds',
        paragraphs: [
          'Cancellations and refunds are governed by our separate Cancellation & Refund Policy, available on this website.',
        ],
      },
      {
        title: '6. Limitation of Liability',
        paragraphs: [
          'Schedule changes or cancellations caused by events beyond our reasonable control—such as severe weather, road closures, or national park restrictions—will be handled according to applicable law and our cancellation policy.',
          'We may not be liable for losses caused by a customer’s intentional misconduct, negligence, or failure to follow on-site safety rules.',
        ],
      },
      {
        title: '7. Governing Law and Contact',
        paragraphs: [
          'These Terms are governed by the laws of the State of Nevada, USA.',
          'For questions about the Service, please contact us through the website inquiry channels or the contact information provided with your booking.',
        ],
      },
    ],
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    lastUpdated: 'July 9, 2026',
    intro:
      'MANIA TOUR ("Company") respects your privacy and complies with applicable data protection requirements. This policy explains what information we collect, how we use it, and how we retain or delete it.',
    sections: [
      {
        title: '1. Information We Collect',
        paragraphs: ['We may collect the following information to provide our services.'],
        listItems: [
          'Booking and payment: name, email, phone number, nationality, participant details',
          'Customer support: inquiry content, reservation numbers, support history',
          'Tour operations: hotel pickup details, passport or ID copies when required, special requests',
          'Technical data: IP address, browser type, cookies, access timestamps',
        ],
      },
      {
        title: '2. How We Use Information',
        paragraphs: ['We use collected information for the following purposes.'],
        listItems: [
          'Processing, confirming, modifying, and communicating about bookings',
          'Payment processing and refunds',
          'Pickup, schedule, and safety-related operational communications',
          'Responding to inquiries and improving service quality',
          'Legal compliance and dispute resolution',
        ],
      },
      {
        title: '3. Information Sharing',
        paragraphs: [
          'We do not sell your personal information.',
          'We may share necessary information with trusted partners—such as payment processors, local operators, transportation providers, and ticket vendors—only to the extent required to operate your tour.',
        ],
      },
      {
        title: '4. Retention and Deletion',
        paragraphs: [
          'Booking and payment records are retained for the period required by applicable law and accounting obligations.',
          'Sensitive documents uploaded for tour operations, such as passport or ID copies, are deleted after tour completion according to our privacy practices.',
        ],
      },
      {
        title: '5. Your Rights',
        paragraphs: [
          'You may request access to, correction of, or deletion of your personal information by contacting customer support.',
          'If you opted in to marketing communications, you may opt out at any time.',
        ],
      },
      {
        title: '6. Cookies',
        paragraphs: [
          'We may use cookies to improve user experience, remember language preferences, and support features such as the shopping cart.',
          'You may disable cookies in your browser settings, but some features may not function properly.',
        ],
      },
      {
        title: '7. Contact',
        paragraphs: [
          'For privacy-related inquiries, please contact us through the website inquiry channels.',
        ],
      },
    ],
  },
  'sms-terms': {
    title: 'SMS Terms',
    lastUpdated: 'July 9, 2026',
    intro:
      'MANIA TOUR ("Company") may send SMS text messages for booking confirmations, schedule updates, and on-site operational notices. These SMS Terms explain the conditions of receiving text messages from us.',
    sections: [
      {
        title: '1. Consent to Receive Messages',
        paragraphs: [
          'By providing your phone number and consenting to SMS communications during booking, you may receive service-related text messages.',
          'Required service messages are separate from optional marketing messages, which are sent only with your explicit consent.',
        ],
      },
      {
        title: '2. Types of Messages',
        paragraphs: ['Examples of messages you may receive include:'],
        listItems: [
          'Booking confirmations and payment notices',
          'Pre-tour reminders including pickup time and location',
          'Schedule changes, delays, and on-site instructions',
          'Customer support replies',
          'Promotional offers, if you opted in',
        ],
      },
      {
        title: '3. Message Frequency',
        paragraphs: [
          'Message frequency varies based on your bookings and operational needs. Typically, a small number of essential messages are sent per reservation.',
        ],
      },
      {
        title: '4. Opt-Out',
        paragraphs: [
          'You may opt out of marketing messages using the method provided in the message (for example, replying STOP).',
          'Essential operational messages related to an active booking may still be sent while your tour is scheduled.',
        ],
      },
      {
        title: '5. Carrier Charges',
        paragraphs: [
          'We do not charge separately for SMS messages. Standard message and data rates from your mobile carrier may apply.',
        ],
      },
      {
        title: '6. Support',
        paragraphs: [
          'For SMS-related questions, contact us through the website inquiry channels or the support contact provided with your booking.',
        ],
      },
    ],
  },
  'cancellation-refund-policy': {
    title: 'Cancellation & Refund Policy',
    lastUpdated: 'July 9, 2026',
    intro:
      'MANIA TOUR ("Company") maintains fair and transparent cancellation standards. The policy below reflects general guidelines. Some products may display product-specific terms on their detail pages. When product-specific terms apply, those terms take precedence.',
    sections: [
      {
        title: '1. Standard Cancellation Timeline',
        paragraphs: ['General refund guidelines based on the tour start date are as follows.'],
        listItems: [
          'Cancel 3 or more days before the tour: full refund',
          'Cancel 1 day before the tour: 50% refund',
          'Cancel on the tour day or no-show: no refund',
        ],
      },
      {
        title: '2. Force Majeure and Operational Cancellation',
        paragraphs: [
          'If a tour is canceled due to events beyond our or our local partners’ reasonable control—such as severe weather, national park closures, or traffic restrictions—you may choose a full refund or rescheduling of equal value.',
        ],
      },
      {
        title: '3. Included and Non-Refundable Items',
        paragraphs: [
          'Refunds may exclude non-refundable costs already committed, such as entrance tickets, flights, or lodging when applicable.',
          'Excluded items listed on the product page—such as entrance fees, guide tips, or personal expenses—are not refundable.',
        ],
      },
      {
        title: '4. How to Cancel',
        paragraphs: [
          'Submit cancellation requests through the reservation lookup page, email, or customer support channels.',
          'Please include your reservation number, guest name, and tour date for faster processing.',
        ],
      },
      {
        title: '5. Refund Processing',
        paragraphs: [
          'Approved refunds are returned to the original payment method. Depending on your card issuer or payment processor, processing may take 5–10 business days.',
          'Partial refunds or tour credits will be communicated by our support team when applicable.',
        ],
      },
      {
        title: '6. Contact',
        paragraphs: [
          'For cancellation or refund questions, contact us through the website inquiry channels or the contact information provided with your booking.',
        ],
      },
    ],
  },
  'cookie-policy': {
    title: 'Cookie Policy',
    lastUpdated: 'July 9, 2026',
    intro:
      'MANIA TOUR ("Company") may use cookies and similar technologies to improve your browsing experience, remember language preferences, and support booking features. This policy explains the types of cookies we use, why we use them, and how you can manage them.',
    sections: [
      {
        title: '1. What Are Cookies?',
        paragraphs: [
          'Cookies are small text files stored in your browser when you visit a website. They help maintain site functionality, remember preferences, and analyze usage.',
        ],
      },
      {
        title: '2. Types of Cookies We Use',
        paragraphs: ['We may use the following categories of cookies.'],
        listItems: [
          'Essential cookies: required for core features such as language settings and booking flow',
          'Functional cookies: remember preferences and improve convenience',
          'Analytics cookies: collect anonymized usage data to improve our services',
        ],
      },
      {
        title: '3. Why We Use Cookies',
        paragraphs: ['Cookies are used for purposes such as:'],
        listItems: [
          'Maintaining website security and core functionality',
          'Saving language and regional preferences',
          'Supporting booking and checkout flows',
          'Analyzing service quality and usage patterns',
        ],
      },
      {
        title: '4. Managing Cookies',
        paragraphs: [
          'You can refuse or delete cookies through your browser settings.',
          'Blocking essential cookies may limit certain features, such as language persistence or completing a booking.',
        ],
      },
      {
        title: '5. Third-Party Cookies',
        paragraphs: [
          'Trusted third-party services—such as payment processors or analytics tools—may set their own cookies. Please refer to each provider’s policy for details.',
        ],
      },
      {
        title: '6. Contact',
        paragraphs: [
          'For questions about this Cookie Policy, please contact us through the website inquiry channels.',
        ],
      },
    ],
  },
}

export function getDefaultLegalPageContent(
  slug: LegalPageSlug,
  locale: string
): LegalPageContent {
  const content = locale === 'en' ? LEGAL_CONTENT_EN : LEGAL_CONTENT_KO
  return {
    body: flattenLegacyLegalContent(content[slug], locale),
  }
}

/** @deprecated DB 조회는 fetchLegalPageContent 사용 */
export function getLegalPageContent(slug: LegalPageSlug, locale: string): LegalPageContent {
  return getDefaultLegalPageContent(slug, locale)
}
