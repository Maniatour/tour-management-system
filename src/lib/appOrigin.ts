const OAUTH_CALLBACK_LOCALE_KEY = 'oauth_callback_locale'
const OAUTH_CALLBACK_NEXT_PATH_KEY = 'oauth_callback_next_path'

function isSafeAppPath(path: string | null | undefined): path is string {
  return Boolean(
    path &&
      path.startsWith('/') &&
      !path.includes('undefined') &&
      !path.includes('/auth')
  )
}

/**
 * OAuth redirectTo·비밀번호 재설정 등에 쓸 앱 origin.
 * 브라우저에서는 항상 현재 origin(로컬·프리뷰·프로덕션)을 사용한다.
 * SSR/서버에서는 NEXT_PUBLIC_SITE_URL → VERCEL_URL → localhost 순으로 fallback.
 */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl) {
    return siteUrl.replace(/\/$/, '')
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL?.trim()
  if (vercelUrl) {
    const host = vercelUrl.replace(/^https?:\/\//, '')
    return `https://${host}`
  }

  return 'http://localhost:3000'
}

/**
 * Supabase Additional Redirect URLs와 맞추기: `/auth/callback`만 사용한다.
 * `?locale=` 같은 쿼리를 붙이면 대시보드의 정확 일치 URL과 안 맞아
 * Site URL(프로덕션)로 떨어진다. locale·다음 경로는 sessionStorage에 둔다.
 */
export function getOAuthCallbackRedirectUrl(
  _locale?: string,
  _postAuthPath?: string | null
): string {
  return `${getAppOrigin()}/auth/callback`
}

export function stashOAuthCallbackLocale(locale: string): void {
  if (typeof window === 'undefined') return
  if (locale === 'ko' || locale === 'en') {
    sessionStorage.setItem(OAUTH_CALLBACK_LOCALE_KEY, locale)
  }
}

export function stashOAuthCallbackNextPath(path?: string | null): void {
  if (typeof window === 'undefined') return
  if (isSafeAppPath(path)) {
    sessionStorage.setItem(OAUTH_CALLBACK_NEXT_PATH_KEY, path)
    return
  }
  sessionStorage.removeItem(OAUTH_CALLBACK_NEXT_PATH_KEY)
}

export function resolveOAuthCallbackNextPath(
  queryPath: string | null | undefined,
  fallback: string
): string {
  if (isSafeAppPath(queryPath)) return queryPath
  if (typeof window !== 'undefined') {
    const stashed = sessionStorage.getItem(OAUTH_CALLBACK_NEXT_PATH_KEY)
    sessionStorage.removeItem(OAUTH_CALLBACK_NEXT_PATH_KEY)
    if (isSafeAppPath(stashed)) return stashed
  }
  return fallback
}

export function resolveOAuthCallbackLocale(localeFromQuery: string | null | undefined): string {
  if (localeFromQuery === 'en' || localeFromQuery === 'ko') {
    return localeFromQuery
  }

  if (typeof window !== 'undefined') {
    const stashed = sessionStorage.getItem(OAUTH_CALLBACK_LOCALE_KEY)
    sessionStorage.removeItem(OAUTH_CALLBACK_LOCALE_KEY)
    if (stashed === 'en' || stashed === 'ko') return stashed

    const saved = localStorage.getItem('preferred-locale')
    if (saved === 'en' || saved === 'ko') return saved

    const browserLang = navigator.language || ''
    return browserLang.startsWith('en') ? 'en' : 'ko'
  }

  return 'ko'
}
