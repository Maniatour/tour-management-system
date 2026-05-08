import {
  ADMIN_HEADER_QUICK_REGISTRY,
  ADMIN_SIDEBAR_REGISTRY,
} from '@/lib/admin-site-registry'

/**
 * 어드민 경로의 브라우저 탭 제목을 결정하기 위한 번역 키 정보.
 * - `namespace`: `next-intl`의 `useTranslations` 네임스페이스
 * - `key`: 해당 네임스페이스의 번역 키
 */
export type AdminPageTitleSpec = {
  namespace: 'sidebar' | 'common' | 'admin'
  key: string
}

/**
 * 사이드바·헤더 레지스트리에 없는 어드민 페이지를 위한 보조 매핑.
 * 키는 `/{locale}/admin/` 이하의 상대 경로(앞뒤 슬래시 없음).
 * 더 긴 경로가 우선되도록 매칭 시 정렬한다.
 */
const EXTRA_ADMIN_PATH_TITLES: ReadonlyArray<{
  path: string
  spec: AdminPageTitleSpec
}> = [
  { path: 'off-schedule', spec: { namespace: 'admin', key: 'offSchedule' } },
  { path: 'tour-reports', spec: { namespace: 'admin', key: 'tourReports' } },
  {
    path: 'company-expenses',
    spec: { namespace: 'admin', key: 'companyExpenseManagement' },
  },
  {
    path: 'reservation-expenses',
    spec: { namespace: 'admin', key: 'reservationExpenseManagement' },
  },
  {
    path: 'dev-tools/customer-simulator',
    spec: { namespace: 'sidebar', key: 'developerTools' },
  },
  {
    path: 'dev-tools/position-simulator',
    spec: { namespace: 'sidebar', key: 'developerTools' },
  },
]

type ResolverEntry = {
  path: string
  spec: AdminPageTitleSpec
}

let cachedEntries: ReadonlyArray<ResolverEntry> | null = null

function getResolverEntries(): ReadonlyArray<ResolverEntry> {
  if (cachedEntries) return cachedEntries
  const sidebarEntries: ResolverEntry[] = ADMIN_SIDEBAR_REGISTRY.map((entry) => ({
    path: entry.path,
    spec: { namespace: 'sidebar', key: entry.sidebarTranslationKey },
  }))
  const headerEntries: ResolverEntry[] = ADMIN_HEADER_QUICK_REGISTRY.map((entry) => ({
    path: entry.path,
    spec: { namespace: entry.labelNamespace, key: entry.labelKey },
  }))
  const extraEntries: ResolverEntry[] = EXTRA_ADMIN_PATH_TITLES.map((entry) => ({
    path: entry.path,
    spec: entry.spec,
  }))
  // 더 구체적인(긴) 경로가 먼저 매칭되도록 길이 내림차순 정렬
  cachedEntries = [...sidebarEntries, ...headerEntries, ...extraEntries].sort(
    (a, b) => b.path.length - a.path.length,
  )
  return cachedEntries
}

function stripLocaleAdminPrefix(pathname: string, locale: string): string | null {
  const normalized = pathname.replace(/\/+$/, '')
  const prefixWithLocale = `/${locale}/admin`
  if (normalized === prefixWithLocale) return ''
  if (normalized.startsWith(`${prefixWithLocale}/`)) {
    return normalized.slice(prefixWithLocale.length + 1)
  }
  // locale이 없는 `/admin` 경로(레거시) 호환
  const prefixNoLocale = '/admin'
  if (normalized === prefixNoLocale) return ''
  if (normalized.startsWith(`${prefixNoLocale}/`)) {
    return normalized.slice(prefixNoLocale.length + 1)
  }
  return null
}

/**
 * 현재 pathname이 어드민 경로일 때 제목 번역 키를 반환한다.
 * 어드민 경로가 아니거나 매칭되는 항목이 없으면 `null`.
 */
export function resolveAdminPageTitleSpec(
  pathname: string | null | undefined,
  locale: string,
): AdminPageTitleSpec | null {
  if (!pathname) return null
  const sub = stripLocaleAdminPrefix(pathname, locale)
  if (sub === null) return null
  if (sub === '') return { namespace: 'admin', key: 'dashboard' }
  for (const entry of getResolverEntries()) {
    if (sub === entry.path || sub.startsWith(`${entry.path}/`)) {
      return entry.spec
    }
  }
  return null
}
