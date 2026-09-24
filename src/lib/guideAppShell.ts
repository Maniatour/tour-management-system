import { SITE_LOCALE_PATH_ALT } from './siteLocales'

/** 가이드 앱 화면. 관리자·대시보드는 포함하지 않는다. */
const GUIDE_APP_PATH = new RegExp(`^/(${SITE_LOCALE_PATH_ALT})/guide(?:/|$)`)

export const GUIDE_SHELL_CACHE = 'guide-app-shell-v1'

export function isGuideAppPathname(pathname: string): boolean {
  return GUIDE_APP_PATH.test(pathname)
}

/** HTML과 RSC를 같은 URL에 덮어쓰지 않도록 캐시 키를 나눈다. */
export function guideShellCacheUrl(rawUrl: string, kind: 'html' | 'rsc'): string {
  const url = new URL(rawUrl)
  url.hash = ''
  url.searchParams.delete('__guide_sw')
  if (kind === 'rsc') {
    url.searchParams.set('__guide_sw', 'rsc')
  }
  return url.toString()
}

/** 오프라인에서 사진·나레이션으로 들어갈 화면. */
export function guideOfflineShellPaths(locale: string): string[] {
  const loc = locale || 'ko'
  return [`/${loc}/guide`, `/${loc}/guide/tour-materials`]
}
