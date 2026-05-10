import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Building,
  Calculator,
  Camera,
  Car,
  Clock,
  Cloud,
  CreditCard,
  DollarSign,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FileSearch,
  Globe,
  History,
  Landmark,
  LayoutGrid,
  Mail,
  MessageCircle,
  Replace,
  Settings,
  Tag,
  Tags,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wrench,
} from 'lucide-react'
import type { UserRole } from '@/lib/roles'

/** 사이드바·구조 페이지에서 동일 조건으로 노출 여부 판단 */
export type AdminNavVisibility =
  | { type: 'always' }
  | { type: 'admin_or_manager' }
  | { type: 'reservation_statistics' }
  | { type: 'super_only' }
  | { type: 'email_allowlist'; emailsLower: readonly string[] }
  | { type: 'dev_tools' }
  /** 사이트 구조 문서용 — 고객·가이드·직원 네비(관리자 사이드바와 무관) */
  | { type: 'site_doc_customer' }
  | { type: 'site_doc_guide' }
  | { type: 'site_doc_staff_nav' }
  | { type: 'site_doc_public_auth' }

export type AdminNavAccessContext = {
  userRole: UserRole | null
  isSuper: boolean
  canAccessReservationStatistics: boolean
  isSimulating: boolean
  authUserEmail: string | null | undefined
  /** 사이트 구조「내 메뉴」열·패치 병합용 — 생략 시 null 취급 */
  userPosition?: string | null
  /**
   * 사이드바 레지스트리 id(`products` 등) 기준 읽기 허용 — DB 매트릭스 패치 병합 결과.
   * 생략 시 기존과 동일(가시성 규칙만 적용).
   */
  siteAccessSidebarReadAllowed?: (sidebarRegistryId: string) => boolean
  /**
   * 헤더 빠른 이동 레지스트리 id(`hq-team-board` 등) 기준 읽기 허용.
   */
  siteAccessHeaderReadAllowed?: (headerRegistryId: string) => boolean
}

export function isAdminNavVisible(rule: AdminNavVisibility, ctx: AdminNavAccessContext): boolean {
  const email = (ctx.authUserEmail ?? '').trim().toLowerCase()
  switch (rule.type) {
    case 'always':
      return true
    case 'admin_or_manager':
      return ctx.userRole === 'admin' || ctx.userRole === 'manager'
    case 'reservation_statistics':
      return ctx.canAccessReservationStatistics
    case 'super_only':
      return ctx.isSuper
    case 'email_allowlist':
      return Boolean(email && rule.emailsLower.some((e) => e === email))
    case 'dev_tools':
      return ctx.userRole === 'admin' || (ctx.userRole === 'team_member' && ctx.isSimulating)
    case 'site_doc_customer':
    case 'site_doc_guide':
    case 'site_doc_staff_nav':
    case 'site_doc_public_auth':
      return true
    default:
      return false
  }
}

export type AdminSidebarRegistryEntry = {
  id: string
  /** `admin/` 이하 경로 (앞뒤 슬래시 없음) */
  path: string
  /** `useTranslations('sidebar')` 키 */
  sidebarTranslationKey: string
  icon: LucideIcon
  visibility: AdminNavVisibility
}

/**
 * 관리자 사이드바 항목 단일 출처.
 * 표시 조건을 바꿀 때는 여기와 `AdminSidebarAndHeader`의 Super/Manager 조회 로직을 함께 맞출 것.
 */
export const ADMIN_SIDEBAR_REGISTRY: readonly AdminSidebarRegistryEntry[] = [
  { id: 'products', path: 'products', sidebarTranslationKey: 'products', icon: BookOpen, visibility: { type: 'always' } },
  { id: 'options', path: 'options', sidebarTranslationKey: 'options', icon: Settings, visibility: { type: 'always' } },
  { id: 'tour-courses', path: 'tour-courses', sidebarTranslationKey: 'courses', icon: Globe, visibility: { type: 'always' } },
  { id: 'tour-cost-calculator', path: 'tour-cost-calculator', sidebarTranslationKey: 'tourCostCalculator', icon: TrendingUp, visibility: { type: 'always' } },
  { id: 'channels', path: 'channels', sidebarTranslationKey: 'channels', icon: Settings, visibility: { type: 'always' } },
  { id: 'coupons', path: 'coupons', sidebarTranslationKey: 'coupons', icon: Ticket, visibility: { type: 'always' } },
  { id: 'tag-translations', path: 'tag-translations', sidebarTranslationKey: 'tagTranslationManagement', icon: Tag, visibility: { type: 'always' } },
  { id: 'pickup-hotels', path: 'pickup-hotels', sidebarTranslationKey: 'pickupHotels', icon: Building, visibility: { type: 'always' } },
  { id: 'vehicles', path: 'vehicles', sidebarTranslationKey: 'vehicles', icon: Car, visibility: { type: 'always' } },
  { id: 'vehicle-maintenance', path: 'vehicle-maintenance', sidebarTranslationKey: 'vehicleMaintenanceManagement', icon: Wrench, visibility: { type: 'always' } },
  { id: 'team', path: 'team', sidebarTranslationKey: 'team', icon: Users, visibility: { type: 'always' } },
  { id: 'attendance', path: 'attendance', sidebarTranslationKey: 'attendance', icon: Clock, visibility: { type: 'always' } },
  { id: 'team-chat', path: 'team-chat', sidebarTranslationKey: 'teamChat', icon: MessageCircle, visibility: { type: 'always' } },
  { id: 'guide-costs', path: 'guide-costs', sidebarTranslationKey: 'guideFeeManagement', icon: Calculator, visibility: { type: 'always' } },
  { id: 'documents', path: 'documents', sidebarTranslationKey: 'documents', icon: FileText, visibility: { type: 'always' } },
  { id: 'sop', path: 'sop', sidebarTranslationKey: 'companySop', icon: FileCheck, visibility: { type: 'admin_or_manager' } },
  { id: 'suppliers', path: 'suppliers', sidebarTranslationKey: 'suppliers', icon: Truck, visibility: { type: 'always' } },
  { id: 'suppliers-settlement', path: 'suppliers/settlement', sidebarTranslationKey: 'supplierSettlement', icon: DollarSign, visibility: { type: 'always' } },
  { id: 'reservations-statistics', path: 'reservations/statistics', sidebarTranslationKey: 'reservationStats', icon: BarChart3, visibility: { type: 'reservation_statistics' } },
  { id: 'statement-reconciliation', path: 'statement-reconciliation', sidebarTranslationKey: 'statementReconciliation', icon: Landmark, visibility: { type: 'super_only' } },
  { id: 'expenses', path: 'expenses', sidebarTranslationKey: 'expenseManagement', icon: DollarSign, visibility: { type: 'always' } },
  { id: 'company-expense-paid-for-labels', path: 'company-expense-paid-for-labels', sidebarTranslationKey: 'paidForLabelManagement', icon: Tags, visibility: { type: 'always' } },
  {
    id: 'partner-funds',
    path: 'partner-funds',
    sidebarTranslationKey: 'partnerFundManagement',
    icon: Users,
    visibility: { type: 'email_allowlist', emailsLower: ['info@maniatour.com'] },
  },
  { id: 'payment-methods', path: 'payment-methods', sidebarTranslationKey: 'paymentMethodManagement', icon: CreditCard, visibility: { type: 'always' } },
  { id: 'expense-payment-method-normalize', path: 'expense-payment-method-normalize', sidebarTranslationKey: 'expensePaymentMethodNormalize', icon: Replace, visibility: { type: 'always' } },
  {
    id: 'receipt-ocr-parse-rules',
    path: 'receipt-ocr-parse-rules',
    sidebarTranslationKey: 'receiptOcrParseRules',
    icon: FileSearch,
    visibility: { type: 'always' },
  },
  { id: 'tour-materials', path: 'tour-materials', sidebarTranslationKey: 'tourMaterials', icon: FileText, visibility: { type: 'always' } },
  { id: 'tour-photo-buckets', path: 'tour-photo-buckets', sidebarTranslationKey: 'tourPhotoBuckets', icon: Camera, visibility: { type: 'always' } },
  { id: 'data-sync', path: 'data-sync', sidebarTranslationKey: 'dataSync', icon: FileSpreadsheet, visibility: { type: 'always' } },
  { id: 'weather-records', path: 'weather-records', sidebarTranslationKey: 'weatherRecords', icon: Cloud, visibility: { type: 'always' } },
  { id: 'data-review', path: 'data-review', sidebarTranslationKey: 'dataReview', icon: FileCheck, visibility: { type: 'always' } },
  { id: 'reservation-imports', path: 'reservation-imports', sidebarTranslationKey: 'reservationImports', icon: Mail, visibility: { type: 'always' } },
  { id: 'audit-logs', path: 'audit-logs', sidebarTranslationKey: 'auditLogs', icon: History, visibility: { type: 'always' } },
  { id: 'site-directory', path: 'site-directory', sidebarTranslationKey: 'siteDirectory', icon: LayoutGrid, visibility: { type: 'always' } },
  { id: 'dev-tools', path: 'dev-tools', sidebarTranslationKey: 'developerTools', icon: Settings, visibility: { type: 'dev_tools' } },
]

export type AdminHeaderQuickEntry = {
  id: string
  path: string
  labelNamespace: 'common'
  labelKey: string
  visibility: AdminNavVisibility
}

/** 헤더 데스크톱 빠른 이동 — 레이블은 `useTranslations('common')` */
export const ADMIN_HEADER_QUICK_REGISTRY: readonly AdminHeaderQuickEntry[] = [
  { id: 'hq-team-board', path: 'team-board', labelNamespace: 'common', labelKey: 'teamBoard', visibility: { type: 'always' } },
  { id: 'hq-consultation', path: 'consultation', labelNamespace: 'common', labelKey: 'consultation', visibility: { type: 'always' } },
  { id: 'hq-customers', path: 'customers', labelNamespace: 'common', labelKey: 'customers', visibility: { type: 'always' } },
  { id: 'hq-reservations', path: 'reservations', labelNamespace: 'common', labelKey: 'reservations', visibility: { type: 'always' } },
  { id: 'hq-booking', path: 'booking', labelNamespace: 'common', labelKey: 'booking', visibility: { type: 'always' } },
  { id: 'hq-tours', path: 'tours', labelNamespace: 'common', labelKey: 'tours', visibility: { type: 'always' } },
  { id: 'hq-chat-management', path: 'chat-management', labelNamespace: 'common', labelKey: 'chatManagement', visibility: { type: 'always' } },
]

/** 데스크톱 헤더 빠른 이동 버튼 스타일 — `ADMIN_HEADER_QUICK_REGISTRY` id와 동일 키 */
export const ADMIN_HEADER_QUICK_BUTTON_CLASS: Record<string, string> = {
  'hq-team-board':
    'px-3 py-1.5 text-sm border rounded-md text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white transition-colors cursor-pointer relative z-10',
  'hq-consultation':
    'px-3 py-1.5 text-sm border rounded-md text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer relative z-10',
  'hq-customers':
    'px-3 py-1.5 text-sm border rounded-md text-teal-600 border-teal-600 hover:bg-teal-600 hover:text-white transition-colors cursor-pointer relative z-10',
  'hq-reservations':
    'px-3 py-1.5 text-sm border rounded-md text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer relative z-10',
  'hq-booking':
    'px-3 py-1.5 text-sm border rounded-md text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer relative z-10',
  'hq-tours':
    'px-3 py-1.5 text-sm border rounded-md text-green-600 border-green-600 hover:bg-green-600 hover:text-white transition-colors cursor-pointer relative z-10',
  'hq-chat-management':
    'px-3 py-1.5 text-sm border rounded-md text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white transition-colors cursor-pointer relative z-10 inline-flex items-center',
}

export type BuiltAdminNavItem = {
  id: string
  name: string
  href: string
  icon: LucideIcon
}

export function buildAdminSidebarNavigation(
  locale: string,
  tSidebar: (key: string) => string,
  ctx: AdminNavAccessContext
): BuiltAdminNavItem[] {
  const base = `/${locale}/admin`
  return ADMIN_SIDEBAR_REGISTRY.filter((e) => {
    if (!isAdminNavVisible(e.visibility, ctx)) return false
    if (ctx.siteAccessSidebarReadAllowed && !ctx.siteAccessSidebarReadAllowed(e.id)) return false
    return true
  }).map((e) => ({
    id: e.id,
    name: tSidebar(e.sidebarTranslationKey),
    href: `${base}/${e.path}`,
    icon: e.icon,
  }))
}

/** 헤더 데스크톱 빠른 이동 — 가시성 + site_access 패치 읽기 */
export function visibleAdminHeaderQuickEntries(ctx: AdminNavAccessContext): readonly AdminHeaderQuickEntry[] {
  return ADMIN_HEADER_QUICK_REGISTRY.filter((e) => {
    if (!isAdminNavVisible(e.visibility, ctx)) return false
    if (ctx.siteAccessHeaderReadAllowed && !ctx.siteAccessHeaderReadAllowed(e.id)) return false
    return true
  })
}

export function adminNavVisibilityLabelKey(rule: AdminNavVisibility): string {
  switch (rule.type) {
    case 'always':
      return 'ruleAlways'
    case 'admin_or_manager':
      return 'ruleAdminOrManager'
    case 'reservation_statistics':
      return 'ruleReservationStats'
    case 'super_only':
      return 'ruleSuperOnly'
    case 'email_allowlist':
      return 'ruleEmailAllowlist'
    case 'dev_tools':
      return 'ruleDevTools'
    case 'site_doc_customer':
      return 'ruleSiteDocCustomer'
    case 'site_doc_guide':
      return 'ruleSiteDocGuide'
    case 'site_doc_staff_nav':
      return 'ruleSiteDocStaffNav'
    case 'site_doc_public_auth':
      return 'ruleSiteDocPublicAuth'
    default:
      return 'ruleAlways'
  }
}
