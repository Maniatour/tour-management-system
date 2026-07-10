import type { LegalPageSlug } from '@/lib/customerSiteRoutes'

export type LegalPageCatalogEntry = {
  slug: LegalPageSlug
  title_ko: string
  title_en: string
  description_ko: string
  description_en: string
}

export const LEGAL_PAGE_CATALOG: LegalPageCatalogEntry[] = [
  {
    slug: 'terms',
    title_ko: '이용약관',
    title_en: 'Terms & Conditions',
    description_ko: '웹사이트 및 예약 서비스 이용에 관한 약관',
    description_en: 'Terms governing website and booking services',
  },
  {
    slug: 'privacy-policy',
    title_ko: '개인정보 처리방침',
    title_en: 'Privacy Policy',
    description_ko: '개인정보 수집·이용·보관에 관한 정책',
    description_en: 'How we collect, use, and protect personal data',
  },
  {
    slug: 'sms-terms',
    title_ko: 'SMS 이용약관',
    title_en: 'SMS Terms & Conditions',
    description_ko: '예약·운영 관련 문자 메시지 수신 조건',
    description_en: 'Conditions for receiving booking and operational SMS',
  },
  {
    slug: 'cancellation-refund-policy',
    title_ko: '취소·환불 정책',
    title_en: 'Cancellation & Refund Policy',
    description_ko: '투어 취소 및 환불 기준',
    description_en: 'Tour cancellation and refund guidelines',
  },
  {
    slug: 'cookie-policy',
    title_ko: '쿠키 정책',
    title_en: 'Cookie Policy',
    description_ko: '웹사이트 쿠키 사용 및 관리 방법',
    description_en: 'How we use cookies and how you can manage them',
  },
]

export function getLegalPageCatalogEntry(slug: LegalPageSlug): LegalPageCatalogEntry {
  return LEGAL_PAGE_CATALOG.find((entry) => entry.slug === slug) ?? LEGAL_PAGE_CATALOG[0]
}
