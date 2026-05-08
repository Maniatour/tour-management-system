'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useMessages } from 'next-intl'
import {
  resolveAdminPageTitleSpec,
  type AdminPageTitleSpec,
} from '@/lib/admin-page-titles'

const APP_TITLE = 'MANIATOUR'

interface AdminPageTitleProps {
  locale: string
}

/**
 * 어드민 페이지에서 현재 경로에 해당하는 메뉴 이름을 브라우저 탭 제목에 표시한다.
 * `useTranslations`/`t()`는 DB 번역 병합 과정에서 일부 키가 객체로 덮어써져 누락처럼 보이는 케이스가 있어,
 * 메시지 객체를 직접 탐색해 문자열 값만 사용한다. 매칭 실패 시 로케일별 기본 라벨로 폴백한다.
 */
export default function AdminPageTitle({ locale }: AdminPageTitleProps) {
  const pathname = usePathname()
  const messages = useMessages() as Record<string, unknown>

  useEffect(() => {
    if (typeof document === 'undefined') return

    const spec = resolveAdminPageTitleSpec(pathname ?? '', locale)
    const pageName = spec ? resolvePageName(spec, messages, locale) : null

    document.title = pageName ? `${pageName} | ${APP_TITLE}` : APP_TITLE
  }, [pathname, locale, messages])

  return null
}

function resolvePageName(
  spec: AdminPageTitleSpec,
  messages: Record<string, unknown>,
  locale: string,
): string | null {
  const fromMessages = readStringFromMessages(messages, spec.namespace, spec.key)
  if (fromMessages) return fromMessages

  // 메시지 누락/형식 이상 시 하드코딩 폴백 (사이드바·헤더 등록 항목 단위)
  const fallback = FALLBACK_TITLES[`${spec.namespace}.${spec.key}`]
  if (fallback) return locale === 'en' ? fallback.en : fallback.ko
  return null
}

function readStringFromMessages(
  messages: Record<string, unknown>,
  namespace: string,
  key: string,
): string | null {
  const ns = messages?.[namespace]
  if (!ns || typeof ns !== 'object') return null
  const value = (ns as Record<string, unknown>)[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * 메시지 객체에 값이 비거나 객체로 깨져 있을 때를 대비한 최종 폴백.
 * 사이드바/헤더 등록 항목과 admin-page-titles의 보조 매핑을 모두 커버한다.
 */
const FALLBACK_TITLES: Record<string, { ko: string; en: string }> = {
  // 사이드바
  'sidebar.products': { ko: '상품 관리', en: 'Products' },
  'sidebar.options': { ko: '옵션 관리', en: 'Options' },
  'sidebar.courses': { ko: '투어 코스', en: 'Tour Courses' },
  'sidebar.tourCostCalculator': { ko: '투어 비용 계산기', en: 'Tour Cost Calculator' },
  'sidebar.channels': { ko: '채널 관리', en: 'Channels' },
  'sidebar.coupons': { ko: '쿠폰 관리', en: 'Coupons' },
  'sidebar.tagTranslationManagement': { ko: '태그 번역 관리', en: 'Tag Translation' },
  'sidebar.pickupHotels': { ko: '픽업 호텔', en: 'Pickup Hotels' },
  'sidebar.vehicles': { ko: '차량 관리', en: 'Vehicles' },
  'sidebar.vehicleMaintenanceManagement': { ko: '차량 정비 관리', en: 'Vehicle Maintenance' },
  'sidebar.team': { ko: '팀 관리', en: 'Team' },
  'sidebar.attendance': { ko: '출퇴근 관리', en: 'Attendance' },
  'sidebar.teamChat': { ko: '팀 채팅', en: 'Team Chat' },
  'sidebar.guideFeeManagement': { ko: '가이드비 관리', en: 'Guide Fees' },
  'sidebar.documents': { ko: '문서 관리', en: 'Documents' },
  'sidebar.companySop': { ko: '회사 SOP', en: 'Company SOP' },
  'sidebar.suppliers': { ko: '공급사 관리', en: 'Suppliers' },
  'sidebar.supplierSettlement': { ko: '공급사 정산', en: 'Supplier Settlement' },
  'sidebar.reservationStats': { ko: '예약 통계', en: 'Reservation Statistics' },
  'sidebar.statementReconciliation': { ko: '명세서 정합성', en: 'Statement Reconciliation' },
  'sidebar.expenseManagement': { ko: '입금-지출 관리', en: 'Expense Management' },
  'sidebar.paidForLabelManagement': { ko: '지출 대상 관리', en: 'Paid-For Labels' },
  'sidebar.partnerFundManagement': { ko: '파트너 자금 관리', en: 'Partner Funds' },
  'sidebar.paymentMethodManagement': { ko: '결제 방법 관리', en: 'Payment Methods' },
  'sidebar.expensePaymentMethodNormalize': { ko: '결제 방법 정규화', en: 'Payment Normalize' },
  'sidebar.tourMaterials': { ko: '투어 자료', en: 'Tour Materials' },
  'sidebar.tourPhotoBuckets': { ko: '투어 사진 버킷', en: 'Tour Photo Buckets' },
  'sidebar.dataSync': { ko: '데이터 동기화', en: 'Data Sync' },
  'sidebar.weatherRecords': { ko: '날씨 기록', en: 'Weather Records' },
  'sidebar.dataReview': { ko: '데이터 검토', en: 'Data Review' },
  'sidebar.reservationImports': { ko: '예약 가져오기', en: 'Reservation Imports' },
  'sidebar.auditLogs': { ko: '감사 로그', en: 'Audit Logs' },
  'sidebar.siteDirectory': { ko: '사이트 구조', en: 'Site Directory' },
  'sidebar.developerTools': { ko: '개발자 도구', en: 'Developer Tools' },
  // 헤더 빠른 이동
  'common.teamBoard': { ko: '팀 게시판', en: 'Team Board' },
  'common.consultation': { ko: '상담', en: 'Consultation' },
  'common.customers': { ko: '고객 관리', en: 'Customers' },
  'common.reservations': { ko: '예약 관리', en: 'Reservations' },
  'common.booking': { ko: '부킹', en: 'Booking' },
  'common.tours': { ko: '투어 관리', en: 'Tours' },
  'common.chatManagement': { ko: '채팅 관리', en: 'Chat Management' },
  // 보조 매핑
  'admin.dashboard': { ko: '대시보드', en: 'Dashboard' },
  'admin.offSchedule': { ko: '스케줄 외 관리', en: 'Off Schedule' },
  'admin.tourReports': { ko: '투어 리포트', en: 'Tour Reports' },
  'admin.companyExpenseManagement': { ko: '회사 지출 관리', en: 'Company Expenses' },
  'admin.reservationExpenseManagement': { ko: '예약 지출 관리', en: 'Reservation Expenses' },
}
