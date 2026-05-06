import {
  ADMIN_HEADER_QUICK_REGISTRY,
  ADMIN_SIDEBAR_REGISTRY,
  type AdminNavVisibility,
} from '@/lib/admin-site-registry'
import { ROLE_PERMISSIONS, type UserPermissions, type UserRole } from '@/lib/roles'

export type SiteAccessKind = 'cluster' | 'page' | 'tab' | 'modal' | 'virtual'

/** UI·역할 매트릭스 문서화용 (실제 RLS/페이지별 검증과 다를 수 있음) */
export type CrudCell = {
  read: boolean
  write: boolean
  update: boolean
  delete: boolean
}

export type SiteLabel =
  | { type: 'sidebar'; key: string }
  | { type: 'common'; key: string }
  | { type: 'siteDirectory'; key: string }

export type SiteAccessNode = {
  id: string
  kind: SiteAccessKind
  label: SiteLabel
  /** admin 경로 (locale 제외) — 관리자 영역 */
  adminPath?: string
  /** 로케일 기준 경로 (`admin` 아님) — 고객·가이드·공용 */
  localePath?: string
  query?: string
  registrySidebarId?: string
  registryHeaderId?: string
  /** 레지스트리 외 노출 규칙(탭 등) */
  menuVisibility?: AdminNavVisibility
  children?: SiteAccessNode[]
  /** 비어 있으면 DOC_SPEC + readGate 로 계산 */
  crudByRole?: Record<UserRole, CrudCell>
}

/** 표의「내 메뉴」열: 관리자 사이드바/헤더와 연동되는 항목만 */
export function isAdminSidebarMenuColumnRelevant(node: SiteAccessNode): boolean {
  if (node.kind === 'cluster') return false
  if (node.localePath) return false
  return Boolean(node.adminPath)
}

const Z: CrudCell = { read: false, write: false, update: false, delete: false }

const CRUD_DOC_CUSTOMER: Record<UserRole, CrudCell> = {
  customer: { read: true, write: true, update: true, delete: false },
  team_member: Z,
  manager: { read: true, write: false, update: false, delete: false },
  admin: { read: true, write: true, update: true, delete: true },
}

const CRUD_DOC_GUIDE: Record<UserRole, CrudCell> = {
  customer: Z,
  team_member: { read: true, write: true, update: true, delete: false },
  manager: { read: true, write: false, update: false, delete: false },
  admin: { read: true, write: true, update: true, delete: true },
}

const CRUD_DOC_STAFF_NAV: Record<UserRole, CrudCell> = {
  customer: Z,
  team_member: { read: true, write: true, update: true, delete: false },
  manager: { read: true, write: true, update: true, delete: true },
  admin: { read: true, write: true, update: true, delete: true },
}

const CRUD_DOC_AUTH: Record<UserRole, CrudCell> = {
  customer: { read: true, write: false, update: false, delete: false },
  team_member: { read: true, write: false, update: false, delete: false },
  manager: { read: true, write: false, update: false, delete: false },
  admin: { read: true, write: false, update: false, delete: false },
}

function otherAreaClusters(): SiteAccessNode[] {
  return [
    {
      id: 'cluster-customer',
      kind: 'cluster',
      label: { type: 'siteDirectory', key: 'treeClusterCustomer' },
      children: [
        {
          id: 'cust-dash',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerDashboard' },
          localePath: 'dashboard',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
        {
          id: 'cust-dash-res',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerReservations' },
          localePath: 'dashboard/reservations',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
        {
          id: 'cust-dash-res-detail',
          kind: 'virtual',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerReservationDetail' },
          localePath: 'dashboard/reservations/[customer_id]/[id]',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
        {
          id: 'cust-profile',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerProfile' },
          localePath: 'dashboard/profile',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
        {
          id: 'cust-profile-id',
          kind: 'virtual',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerProfileEdit' },
          localePath: 'dashboard/profile/[customer_id]',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
        {
          id: 'cust-resident',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerResidentCheck' },
          localePath: 'dashboard/resident-check',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
        {
          id: 'cust-pass',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.customerPassUpload' },
          localePath: 'dashboard/pass-upload',
          menuVisibility: { type: 'site_doc_customer' },
          crudByRole: CRUD_DOC_CUSTOMER,
        },
      ],
    },
    {
      id: 'cluster-guide',
      kind: 'cluster',
      label: { type: 'siteDirectory', key: 'treeClusterGuide' },
      children: [
        {
          id: 'guide-home',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideHome' },
          localePath: 'guide',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-tours',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTours' },
          localePath: 'guide/tours',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-tour-detail',
          kind: 'virtual',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTourDetail' },
          localePath: 'guide/tours/[id]',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-team-chat',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTeamChat' },
          localePath: 'guide/team-chat',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-team-chat-thread',
          kind: 'virtual',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTeamChatThread' },
          localePath: 'guide/team-chat/[id]',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-docs',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideDocuments' },
          localePath: 'guide/documents',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-materials',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTourMaterials' },
          localePath: 'guide/tour-materials',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-courses',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTourCourses' },
          localePath: 'guide/tour-courses',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-board',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideTeamBoard' },
          localePath: 'guide/team-board',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
        {
          id: 'guide-chat',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.guideChat' },
          localePath: 'guide/chat',
          menuVisibility: { type: 'site_doc_guide' },
          crudByRole: CRUD_DOC_GUIDE,
        },
      ],
    },
    {
      id: 'cluster-staff-nav',
      kind: 'cluster',
      label: { type: 'siteDirectory', key: 'treeClusterStaffNav' },
      children: [
        {
          id: 'staff-home',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.staffHome' },
          localePath: '',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-schedule',
          kind: 'page',
          label: { type: 'common', key: 'schedule' },
          localePath: 'schedule',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-customers',
          kind: 'page',
          label: { type: 'common', key: 'customers' },
          localePath: 'customers',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-reservations',
          kind: 'page',
          label: { type: 'common', key: 'reservations' },
          localePath: 'reservations',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-tours',
          kind: 'page',
          label: { type: 'common', key: 'tours' },
          localePath: 'tours',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-channels',
          kind: 'page',
          label: { type: 'common', key: 'channels' },
          localePath: 'channels',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-products',
          kind: 'page',
          label: { type: 'common', key: 'products' },
          localePath: 'products',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-product-detail',
          kind: 'virtual',
          label: { type: 'siteDirectory', key: 'nodesPublic.staffProductDetail' },
          localePath: 'products/[id]',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-options',
          kind: 'page',
          label: { type: 'common', key: 'options' },
          localePath: 'options',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-team',
          kind: 'page',
          label: { type: 'common', key: 'team' },
          localePath: 'team',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-courses',
          kind: 'page',
          label: { type: 'common', key: 'courses' },
          localePath: 'courses',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-off-schedule',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.staffOffSchedule' },
          localePath: 'off-schedule',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-reservation-check',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.staffReservationCheck' },
          localePath: 'reservation-check',
          menuVisibility: { type: 'site_doc_staff_nav' },
          crudByRole: CRUD_DOC_STAFF_NAV,
        },
        {
          id: 'staff-auth',
          kind: 'page',
          label: { type: 'siteDirectory', key: 'nodesPublic.publicAuth' },
          localePath: 'auth',
          menuVisibility: { type: 'site_doc_public_auth' },
          crudByRole: CRUD_DOC_AUTH,
        },
      ],
    },
  ]
}

/** 사이드바 항목 id → 문서화용 권한 키 (읽기 게이트 / 변경 권한) */
const DOC_SPEC: Record<
  string,
  { readGate?: keyof UserPermissions; manage?: keyof UserPermissions }
> = {
  products: { readGate: 'canViewAdmin', manage: 'canManageProducts' },
  options: { readGate: 'canViewAdmin', manage: 'canManageOptions' },
  'tour-courses': { readGate: 'canViewAdmin', manage: 'canManageProducts' },
  'tour-cost-calculator': { readGate: 'canViewAdmin', manage: 'canManageProducts' },
  channels: { readGate: 'canViewAdmin', manage: 'canManageChannels' },
  coupons: { readGate: 'canViewAdmin', manage: 'canManageChannels' },
  'tag-translations': { readGate: 'canViewAdmin', manage: 'canManageChannels' },
  'pickup-hotels': { readGate: 'canViewAdmin', manage: 'canManageOptions' },
  vehicles: { readGate: 'canViewAdmin', manage: 'canManageTours' },
  'vehicle-maintenance': { readGate: 'canViewAdmin', manage: 'canManageTours' },
  team: { readGate: 'canViewAdmin', manage: 'canManageTeam' },
  attendance: { readGate: 'canViewAdmin', manage: 'canManageTeam' },
  'team-chat': { readGate: 'canViewAdmin', manage: 'canManageTeam' },
  'guide-costs': { readGate: 'canViewAdmin', manage: 'canManageTours' },
  documents: { readGate: 'canViewAdmin', manage: 'canManageTours' },
  sop: { readGate: 'canViewAdmin', manage: 'canManageTeam' },
  suppliers: { readGate: 'canViewAdmin', manage: 'canManageTours' },
  'suppliers-settlement': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  expenses: { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  'company-expense-paid-for-labels': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  'partner-funds': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  'payment-methods': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  'expense-payment-method-normalize': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  'tour-materials': { readGate: 'canViewAdmin', manage: 'canManageTours' },
  'tour-photo-buckets': { readGate: 'canViewAdmin', manage: 'canManageTours' },
  'data-sync': { readGate: 'canViewAdmin', manage: 'canManageProducts' },
  'weather-records': { readGate: 'canViewAdmin', manage: 'canManageTours' },
  'data-review': { readGate: 'canViewAdmin', manage: 'canManageReservations' },
  'reservation-imports': { readGate: 'canViewAdmin', manage: 'canManageReservations' },
  'audit-logs': { readGate: 'canViewAuditLogs', manage: 'canViewAuditLogs' },
  'site-directory': { readGate: 'canViewAdmin' },
  'dev-tools': { readGate: 'canViewAdmin' },
  'reservations-statistics': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
  'statement-reconciliation': { readGate: 'canViewAdmin', manage: 'canViewFinance' },
}

const HEADER_DOC: Record<string, { readGate?: keyof UserPermissions; manage?: keyof UserPermissions }> = {
  'hq-team-board': { readGate: 'canViewAdmin', manage: 'canManageTeam' },
  'hq-consultation': { readGate: 'canViewAdmin', manage: 'canManageReservations' },
  'hq-customers': { readGate: 'canViewAdmin', manage: 'canManageCustomers' },
  'hq-reservations': { readGate: 'canViewAdmin', manage: 'canManageReservations' },
  'hq-booking': { readGate: 'canViewAdmin', manage: 'canManageBookings' },
  'hq-tours': { readGate: 'canViewAdmin', manage: 'canManageTours' },
  'hq-chat-management': { readGate: 'canViewAdmin', manage: 'canManageReservations' },
}

export function inferCrudFromDoc(spec: {
  readGate?: keyof UserPermissions
  manage?: keyof UserPermissions
}): Record<UserRole, CrudCell> {
  const roles: UserRole[] = ['customer', 'team_member', 'manager', 'admin']
  const readGate: keyof UserPermissions = spec.readGate ?? 'canViewAdmin'
  const manageKey = spec.manage

  return Object.fromEntries(
    roles.map((role) => {
      if (role === 'customer') return [role, { ...Z }]

      const p = ROLE_PERMISSIONS[role]
      const canRead = Boolean(p[readGate])
      const canMutate = manageKey ? Boolean(p[manageKey]) : false

      const cell: CrudCell = {
        read: canRead,
        write: canMutate,
        update: canMutate,
        delete: canMutate,
      }
      return [role, cell]
    })
  ) as Record<UserRole, CrudCell>
}

/** 감사 로그: 읽기만 true일 수 있음 — manage가 read와 동일 키면 R만 분리 */
function crudForSidebarId(id: string): Record<UserRole, CrudCell> {
  if (id === 'audit-logs') return inferCrudFromDoc({ readGate: 'canViewAuditLogs' })
  const spec = DOC_SPEC[id] ?? { readGate: 'canViewAdmin' as const }
  return inferCrudFromDoc(spec)
}

function crudForHeaderId(id: string): Record<UserRole, CrudCell> {
  const spec = HEADER_DOC[id] ?? { readGate: 'canViewAdmin' as const }
  return inferCrudFromDoc(spec)
}

/** 통계 탭: cash/pnl 은 Super 전용 UI — 역할 매트릭스에 주석 처리 위해 manager도 읽기 false */
function crudStatisticsFinanceTab(): Record<UserRole, CrudCell> {
  const roles: UserRole[] = ['customer', 'team_member', 'manager', 'admin']
  return Object.fromEntries(
    roles.map((role) => {
      if (role === 'customer' || role === 'team_member' || role === 'manager') return [role, { ...Z }]
      return [role, { read: true, write: false, update: false, delete: false }]
    })
  ) as Record<UserRole, CrudCell>
}

function crudStatisticsStandardTab(): Record<UserRole, CrudCell> {
  const roles: UserRole[] = ['customer', 'team_member', 'manager', 'admin']
  return Object.fromEntries(
    roles.map((role) => {
      if (role === 'customer') return [role, { ...Z }]
      const p = ROLE_PERMISSIONS[role]
      const can = p.canViewAdmin && (role === 'admin' || role === 'manager')
      const m = p.canViewFinance || p.canManageReservations
      return [
        role,
        {
          read: can,
          write: Boolean(m && (role === 'manager' || role === 'admin')),
          update: Boolean(m && (role === 'manager' || role === 'admin')),
          delete: Boolean(m && (role === 'manager' || role === 'admin')),
        },
      ]
    })
  ) as Record<UserRole, CrudCell>
}

/** 트리 단일 루트 (표시용 클러스터) */
export function buildSiteAccessTree(): SiteAccessNode {
  const headerPages: SiteAccessNode[] = ADMIN_HEADER_QUICK_REGISTRY.map((h) => ({
    id: h.id,
    kind: 'page',
    label: { type: 'common', key: h.labelKey },
    adminPath: h.path,
    registryHeaderId: h.id,
    menuVisibility: h.visibility,
    crudByRole: crudForHeaderId(h.id),
    children:
      h.id === 'hq-reservations'
        ? [
            {
              id: 'hq-reservations-view',
              kind: 'tab',
              label: { type: 'siteDirectory', key: 'nodes.resViewToggle' },
              menuVisibility: { type: 'always' },
              crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageReservations' }),
            },
            {
              id: 'hq-reservations-pipeline',
              kind: 'tab',
              label: { type: 'siteDirectory', key: 'nodes.resPipelineModal' },
              menuVisibility: { type: 'always' },
              crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageReservations' }),
            },
            {
              id: 'hq-reservations-add',
              kind: 'modal',
              label: { type: 'siteDirectory', key: 'nodes.resAddModal' },
              adminPath: 'reservations',
              query: 'add=true',
              menuVisibility: { type: 'always' },
              crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageReservations' }),
            },
            {
              id: 'hq-reservations-detail',
              kind: 'virtual',
              label: { type: 'siteDirectory', key: 'nodes.resDetailRoute' },
              adminPath: 'reservations/[id]',
              menuVisibility: { type: 'always' },
              crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageReservations' }),
            },
            {
              id: 'hq-reservations-docs',
              kind: 'modal',
              label: { type: 'siteDirectory', key: 'nodes.resDocModals' },
              adminPath: 'reservations/[id]/documents/…',
              menuVisibility: { type: 'always' },
              crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageReservations' }),
            },
          ]
        : undefined,
  }))

  const sidebarPages: SiteAccessNode[] = ADMIN_SIDEBAR_REGISTRY.map((s) => {
    const base: SiteAccessNode = {
      id: `sb-${s.id}`,
      kind: 'page',
      label: { type: 'sidebar', key: s.sidebarTranslationKey },
      adminPath: s.path,
      registrySidebarId: s.id,
      menuVisibility: s.visibility,
      crudByRole: crudForSidebarId(s.id),
    }

    if (s.id === 'products') {
      base.children = [
        {
          id: 'sb-products-favorite-modal',
          kind: 'modal',
          label: { type: 'siteDirectory', key: 'nodes.productsFavoriteOrderModal' },
          menuVisibility: { type: 'always' },
          crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageProducts' }),
        },
      ]
    }

    if (s.id === 'reservations-statistics') {
      base.children = [
        {
          id: 'sb-stat-tab-res',
          kind: 'tab',
          label: { type: 'siteDirectory', key: 'nodes.statTabReservations' },
          adminPath: 'reservations/statistics',
          query: 'tab=reservations',
          menuVisibility: { type: 'reservation_statistics' },
          crudByRole: crudStatisticsStandardTab(),
        },
        {
          id: 'sb-stat-tab-tours',
          kind: 'tab',
          label: { type: 'siteDirectory', key: 'nodes.statTabTours' },
          adminPath: 'reservations/statistics',
          query: 'tab=tours',
          menuVisibility: { type: 'reservation_statistics' },
          crudByRole: crudStatisticsStandardTab(),
        },
        {
          id: 'sb-stat-tab-settlement',
          kind: 'tab',
          label: { type: 'siteDirectory', key: 'nodes.statTabSettlement' },
          adminPath: 'reservations/statistics',
          query: 'tab=settlement',
          menuVisibility: { type: 'reservation_statistics' },
          crudByRole: crudStatisticsStandardTab(),
        },
        {
          id: 'sb-stat-tab-channel',
          kind: 'tab',
          label: { type: 'siteDirectory', key: 'nodes.statTabChannelSettlement' },
          adminPath: 'reservations/statistics',
          query: 'tab=channelSettlement',
          menuVisibility: { type: 'reservation_statistics' },
          crudByRole: crudStatisticsStandardTab(),
        },
        {
          id: 'sb-stat-tab-cash',
          kind: 'tab',
          label: { type: 'siteDirectory', key: 'nodes.statTabCash' },
          adminPath: 'reservations/statistics',
          query: 'tab=cash',
          menuVisibility: { type: 'reservation_statistics' },
          crudByRole: crudStatisticsFinanceTab(),
        },
        {
          id: 'sb-stat-tab-pnl',
          kind: 'tab',
          label: { type: 'siteDirectory', key: 'nodes.statTabPnl' },
          adminPath: 'reservations/statistics',
          query: 'tab=pnl',
          menuVisibility: { type: 'reservation_statistics' },
          crudByRole: crudStatisticsFinanceTab(),
        },
      ]
    }

    if (s.id === 'attendance') {
      base.children = [
        {
          id: 'sb-attendance-modals',
          kind: 'modal',
          label: { type: 'siteDirectory', key: 'nodes.attendanceCheckInOut' },
          menuVisibility: { type: 'always' },
          crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin', manage: 'canManageTeam' }),
        },
        {
          id: 'sb-attendance-position',
          kind: 'virtual',
          label: { type: 'siteDirectory', key: 'nodes.attendancePositionNote' },
          menuVisibility: { type: 'always' },
          crudByRole: inferCrudFromDoc({ readGate: 'canViewAdmin' }),
        },
      ]
    }

    return base
  })

  return {
    id: 'root',
    kind: 'cluster',
    label: { type: 'siteDirectory', key: 'treeRoot' },
    children: [
      {
        id: 'cluster-header',
        kind: 'cluster',
        label: { type: 'siteDirectory', key: 'treeClusterHeader' },
        children: headerPages,
      },
      {
        id: 'cluster-sidebar',
        kind: 'cluster',
        label: { type: 'siteDirectory', key: 'treeClusterSidebar' },
        children: sidebarPages,
      },
      ...otherAreaClusters(),
    ],
  }
}

export function resolveMenuVisibility(
  node: SiteAccessNode
): AdminNavVisibility | undefined {
  if (node.menuVisibility) return node.menuVisibility
  if (node.registrySidebarId) {
    const e = ADMIN_SIDEBAR_REGISTRY.find((x) => x.id === node.registrySidebarId)
    return e?.visibility
  }
  if (node.registryHeaderId) {
    const e = ADMIN_HEADER_QUICK_REGISTRY.find((x) => x.id === node.registryHeaderId)
    return e?.visibility
  }
  return undefined
}

export function computeCrudForNode(node: SiteAccessNode): Record<UserRole, CrudCell> {
  if (node.crudByRole) return node.crudByRole
  if (node.registrySidebarId) return crudForSidebarId(node.registrySidebarId)
  if (node.registryHeaderId) return crudForHeaderId(node.registryHeaderId)
  const roles: UserRole[] = ['customer', 'team_member', 'manager', 'admin']
  return Object.fromEntries(roles.map((r) => [r, { ...Z }])) as Record<UserRole, CrudCell>
}

export type FlatSiteAccessRow = { node: SiteAccessNode; depth: number }

/** 루트 제외, 깊이 순 DFS — 전체 CRUD 테이블용 */
export function flattenSiteAccessTree(root: SiteAccessNode): FlatSiteAccessRow[] {
  const rows: FlatSiteAccessRow[] = []
  const walk = (n: SiteAccessNode, depth: number) => {
    if (n.id !== 'root') {
      rows.push({ node: n, depth })
    }
    for (const c of n.children ?? []) {
      walk(c, n.id === 'root' ? 0 : depth + 1)
    }
  }
  walk(root, 0)
  return rows
}

export type SiteAccessGroup = {
  cluster: SiteAccessNode
  rows: FlatSiteAccessRow[]
}

/** 헤더 빠른 이동 / 사이드바 등 최상위 클러스터별로 묶음 — 표에서 그룹 헤더 + 들여쓰기 depth */
export function buildSiteAccessGroups(root: SiteAccessNode): SiteAccessGroup[] {
  return (root.children ?? []).map((cluster) => ({
    cluster,
    rows: flattenClusterDescendants(cluster),
  }))
}

function flattenClusterDescendants(cluster: SiteAccessNode): FlatSiteAccessRow[] {
  const rows: FlatSiteAccessRow[] = []
  const walk = (n: SiteAccessNode, depth: number) => {
    rows.push({ node: n, depth })
    for (const c of n.children ?? []) {
      walk(c, depth + 1)
    }
  }
  for (const top of cluster.children ?? []) {
    walk(top, 0)
  }
  return rows
}
