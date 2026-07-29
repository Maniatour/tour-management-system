const OAUTH_CALLBACK_LOCALE_KEY = 'oauth_callback_locale'

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

/** Supabase Redirect URLs와 정확히 맞추기: /{locale}/auth/callback */
export function getOAuthCallbackRedirectUrl(
  locale: string,
  postAuthPath?: string | null
): string {
  const loc = locale === 'en' || locale === 'ko' ? locale : 'ko'
  const base = `${getAppOrigin()}/${loc}/auth/callback`
  if (
    postAuthPath &&
    postAuthPath.startsWith('/') &&
    !postAuthPath.includes('undefined') &&
    !postAuthPath.includes('/auth')
  ) {
    return `${base}?redirectTo=${encodeURIComponent(postAuthPath)}`
  }
  return base
}

export function stashOAuthCallbackLocale(locale: string): void {
  if (typeof window === 'undefined') return
  if (locale === 'ko' || locale === 'en') {
    sessionStorage.setItem(OAUTH_CALLBACK_LOCALE_KEY, locale)
  }
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
