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
  ClipboardList,
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
  LayoutTemplate,
  Mail,
  MessageCircle,
  Replace,
  Settings,
  Tag,
  Tags,
  Building2,
  BookMarked,
  Share2,
  Ticket,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  Library,
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
   * Operations Suite module (fleet/HR/expense). Default true when omitted (Kovegas).
   * When false, entries with requiresOperationsModule are hidden (Phase 6a).
   */
  operationsEnabled?: boolean
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
  /**
   * 설정 시 최상위 플랫 목록에서 제외되고, 해당 그룹 패널(하위 메뉴)에만 표시.
   * 예: operator-b
   */
  groupId?: string
  /** Phase 6a: hide when active operator modules.operations !== true */
  requiresOperationsModule?: boolean
}

export type AdminSidebarGroupEntry = {
  id: string
  sidebarTranslationKey: string
  icon: LucideIcon
  /** 그룹 버튼 자체 노출 조건 (자식 중 하나라도 보이면 표시하는 쪽이 우선) */
  visibility: AdminNavVisibility
  childIds: readonly string[]
}

/** 사이드바 그룹(클릭 시 하위 메뉴 패널) */
export const ADMIN_SIDEBAR_GROUPS: readonly AdminSidebarGroupEntry[] = [
  {
    id: 'operator-b',
    sidebarTranslationKey: 'operatorB',
    icon: Building2,
    visibility: { type: 'admin_or_manager' },
    childIds: ['operator-b-manual', 'operators', 'commerce-ota-mappings'],
  },
]

/**
 * 관리자 사이드바 항목 단일 출처.
 * 표시 조건을 바꿀 때는 여기와 `AdminSidebarAndHeader`의 Super/Manager 조회 로직을 함께 맞출 것.
 */
export const ADMIN_SIDEBAR_REGISTRY: readonly AdminSidebarRegistryEntry[] = [
  { id: 'reservation-imports', path: 'reservation-imports', sidebarTranslationKey: 'reservationImports', icon: Mail, visibility: { type: 'always' } },
  {
    id: 'customer-pages',
    path: 'customer-pages',
    sidebarTranslationKey: 'customerPages',
    icon: LayoutTemplate,
    visibility: { type: 'admin_or_manager' },
  },
  { id: 'products', path: 'products', sidebarTranslationKey: 'products', icon: BookOpen, visibility: { type: 'always' } },
  {
    id: 'content-library',
    path: 'content-library',
    sidebarTranslationKey: 'contentLibrary',
    icon: Library,
    visibility: { type: 'always' },
  },
  { id: 'options', path: 'options', sidebarTranslationKey: 'options', icon: Settings, visibility: { type: 'always' } },
  { id: 'tour-courses', path: 'tour-courses', sidebarTranslationKey: 'courses', icon: Globe, visibility: { type: 'always' } },
  {
    id: 'tour-cost-calculator',
    path: 'tour-cost-calculator',
    sidebarTranslationKey: 'tourCostCalculator',
    icon: TrendingUp,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  { id: 'channels', path: 'channels', sidebarTranslationKey: 'channels', icon: Settings, visibility: { type: 'always' } },
  {
    id: 'operator-b-manual',
    path: 'operator-b/manual',
    sidebarTranslationKey: 'operatorBManual',
    icon: BookMarked,
    visibility: { type: 'admin_or_manager' },
    groupId: 'operator-b',
  },
  {
    id: 'operators',
    path: 'operators',
    sidebarTranslationKey: 'operators',
    icon: Building2,
    visibility: { type: 'super_only' },
    groupId: 'operator-b',
  },
  {
    id: 'commerce-ota-mappings',
    path: 'commerce/ota-mappings',
    sidebarTranslationKey: 'otaDistribution',
    icon: Share2,
    visibility: { type: 'admin_or_manager' },
    groupId: 'operator-b',
  },
  { id: 'coupons', path: 'coupons', sidebarTranslationKey: 'coupons', icon: Ticket, visibility: { type: 'always' } },
  { id: 'tag-translations', path: 'tag-translations', sidebarTranslationKey: 'tagTranslationManagement', icon: Tag, visibility: { type: 'always' } },
  { id: 'pickup-hotels', path: 'pickup-hotels', sidebarTranslationKey: 'pickupHotels', icon: Building, visibility: { type: 'always' } },
  {
    id: 'vehicles',
    path: 'vehicles',
    sidebarTranslationKey: 'vehicles',
    icon: Car,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'vehicle-maintenance',
    path: 'vehicle-maintenance',
    sidebarTranslationKey: 'vehicleMaintenanceManagement',
    icon: Wrench,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'team',
    path: 'team',
    sidebarTranslationKey: 'team',
    icon: Users,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'attendance',
    path: 'attendance',
    sidebarTranslationKey: 'attendance',
    icon: Clock,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'team-chat',
    path: 'team-chat',
    sidebarTranslationKey: 'teamChat',
    icon: MessageCircle,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'guide-costs',
    path: 'guide-costs',
    sidebarTranslationKey: 'guideFeeManagement',
    icon: Calculator,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'documents',
    path: 'documents',
    sidebarTranslationKey: 'documents',
    icon: FileText,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'operations-hub',
    path: 'operations-hub',
    sidebarTranslationKey: 'operationsHub',
    icon: ClipboardList,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'sop',
    path: 'sop',
    sidebarTranslationKey: 'companySop',
    icon: FileCheck,
    visibility: { type: 'admin_or_manager' },
    requiresOperationsModule: true,
  },
  {
    id: 'suppliers',
    path: 'suppliers',
    sidebarTranslationKey: 'suppliers',
    icon: Truck,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'suppliers-settlement',
    path: 'suppliers/settlement',
    sidebarTranslationKey: 'supplierSettlement',
    icon: DollarSign,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  { id: 'reservations-statistics', path: 'reservations/statistics', sidebarTranslationKey: 'reservationStats', icon: BarChart3, visibility: { type: 'reservation_statistics' } },
  { id: 'statement-reconciliation', path: 'statement-reconciliation', sidebarTranslationKey: 'statementReconciliation', icon: Landmark, visibility: { type: 'super_only' } },
  {
    id: 'expenses',
    path: 'expenses',
    sidebarTranslationKey: 'expenseManagement',
    icon: DollarSign,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'company-expense-paid-for-labels',
    path: 'company-expense-paid-for-labels',
    sidebarTranslationKey: 'paidForLabelManagement',
    icon: Tags,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'partner-funds',
    path: 'partner-funds',
    sidebarTranslationKey: 'partnerFundManagement',
    icon: Users,
    visibility: { type: 'email_allowlist', emailsLower: ['info@maniatour.com'] },
    requiresOperationsModule: true,
  },
  {
    id: 'payment-methods',
    path: 'payment-methods',
    sidebarTranslationKey: 'paymentMethodManagement',
    icon: CreditCard,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'expense-payment-method-normalize',
    path: 'expense-payment-method-normalize',
    sidebarTranslationKey: 'expensePaymentMethodNormalize',
    icon: Replace,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'receipt-ocr-parse-rules',
    path: 'receipt-ocr-parse-rules',
    sidebarTranslationKey: 'receiptOcrParseRules',
    icon: FileSearch,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'tour-materials',
    path: 'tour-materials',
    sidebarTranslationKey: 'tourMaterials',
    icon: FileText,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  {
    id: 'tour-photo-buckets',
    path: 'tour-photo-buckets',
    sidebarTranslationKey: 'tourPhotoBuckets',
    icon: Camera,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  { id: 'data-sync', path: 'data-sync', sidebarTranslationKey: 'dataSync', icon: FileSpreadsheet, visibility: { type: 'always' } },
  {
    id: 'weather-records',
    path: 'weather-records',
    sidebarTranslationKey: 'weatherRecords',
    icon: Cloud,
    visibility: { type: 'always' },
    requiresOperationsModule: true,
  },
  { id: 'data-review', path: 'data-review', sidebarTranslationKey: 'dataReview', icon: FileCheck, visibility: { type: 'always' } },
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
  // team-board: 우측 아이콘 바로가기만 유지 (텍스트 버튼 중복 제거)
  { id: 'hq-consultation', path: 'consultation', labelNamespace: 'common', labelKey: 'consultation', visibility: { type: 'always' } },
  { id: 'hq-customers', path: 'customers', labelNamespace: 'common', labelKey: 'customers', visibility: { type: 'always' } },
  { id: 'hq-reservations', path: 'reservations', labelNamespace: 'common', labelKey: 'reservations', visibility: { type: 'always' } },
  { id: 'hq-booking', path: 'booking', labelNamespace: 'common', labelKey: 'booking', visibility: { type: 'always' } },
  { id: 'hq-tours', path: 'tours', labelNamespace: 'common', labelKey: 'tours', visibility: { type: 'always' } },
  { id: 'hq-chat-management', path: 'chat-management', labelNamespace: 'common', labelKey: 'chatManagement', visibility: { type: 'always' } },
]

/** 데스크톱 헤더 빠른 이동 버튼 스타일 — `ADMIN_HEADER_QUICK_REGISTRY` id와 동일 키 */
export const ADMIN_HEADER_QUICK_BUTTON_CLASS: Record<string, string> = {
  'hq-consultation':
    'relative z-10 cursor-pointer rounded-md border border-purple-600 bg-transparent px-3 py-1.5 text-sm text-purple-600 transition-colors hover:bg-purple-600 hover:text-white',
  'hq-customers':
    'relative z-10 cursor-pointer rounded-md border border-teal-600 bg-transparent px-3 py-1.5 text-sm text-teal-600 transition-colors hover:bg-teal-600 hover:text-white',
  'hq-reservations':
    'relative z-10 cursor-pointer rounded-md border border-primary bg-transparent px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground',
  'hq-booking':
    'relative z-10 cursor-pointer rounded-md border border-indigo-600 bg-transparent px-3 py-1.5 text-sm text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white',
  'hq-tours':
    'relative z-10 cursor-pointer rounded-md border border-green-600 bg-transparent px-3 py-1.5 text-sm text-green-600 transition-colors hover:bg-green-600 hover:text-white',
  'hq-chat-management':
    'relative z-10 inline-flex cursor-pointer items-center rounded-md border border-purple-600 bg-transparent px-3 py-1.5 text-sm text-purple-600 transition-colors hover:bg-purple-600 hover:text-white',
}

export type BuiltAdminNavItem = {
  id: string
  name: string
  href: string
  icon: LucideIcon
}

export type BuiltAdminNavGroup = {
  id: string
  name: string
  icon: LucideIcon
  children: BuiltAdminNavItem[]
}

function isSidebarEntryVisible(
  e: AdminSidebarRegistryEntry,
  ctx: AdminNavAccessContext
): boolean {
  if (!isAdminNavVisible(e.visibility, ctx)) return false
  if (e.requiresOperationsModule && ctx.operationsEnabled === false) return false
  if (ctx.siteAccessSidebarReadAllowed && !ctx.siteAccessSidebarReadAllowed(e.id)) return false
  return true
}

export function buildAdminSidebarNavigation(
  locale: string,
  tSidebar: (key: string) => string,
  ctx: AdminNavAccessContext
): BuiltAdminNavItem[] {
  const base = `/${locale}/admin`
  return ADMIN_SIDEBAR_REGISTRY.filter((e) => {
    if (e.groupId) return false
    return isSidebarEntryVisible(e, ctx)
  }).map((e) => ({
    id: e.id,
    name: tSidebar(e.sidebarTranslationKey),
    href: `${base}/${e.path}`,
    icon: e.icon,
  }))
}

/** Operator B 등 — 최상위 버튼 + 패널용 하위 메뉴 */
export function buildAdminSidebarGroups(
  locale: string,
  tSidebar: (key: string) => string,
  ctx: AdminNavAccessContext
): BuiltAdminNavGroup[] {
  const base = `/${locale}/admin`
  const byId = new Map(ADMIN_SIDEBAR_REGISTRY.map((e) => [e.id, e]))

  return ADMIN_SIDEBAR_GROUPS.map((group) => {
    const children = group.childIds
      .map((id) => byId.get(id))
      .filter((e): e is AdminSidebarRegistryEntry => !!e)
      .filter((e) => isSidebarEntryVisible(e, ctx))
      .map((e) => ({
        id: e.id,
        name: tSidebar(e.sidebarTranslationKey),
        href: `${base}/${e.path}`,
        icon: e.icon,
      }))

    if (children.length === 0) return null

    return {
      id: group.id,
      name: tSidebar(group.sidebarTranslationKey),
      icon: group.icon,
      children,
    }
  }).filter((g): g is BuiltAdminNavGroup => g != null)
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
