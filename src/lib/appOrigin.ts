const OAUTH_CALLBACK_LOCALE_KEY = 'oauth_callback_locale'

/**
 * OAuth redirectTo·비밀번호 재설정 등에 쓸 앱 origin.
 * 배포 사이트에서는 브라우저 origin을 우선하고, 로컬에서만 env(Vercel/ SITE_URL)를 참고한다.
 */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return origin
    }
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

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return 'http://localhost:3000'
}

/** Supabase Redirect URLs와 정확히 맞추기 위해 쿼리 없이 /auth/callback 만 사용 */
export function getOAuthCallbackRedirectUrl(): string {
  return `${getAppOrigin()}/auth/callback`
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
