/** PWA 홈 화면 바로가기 복원용 (localStorage + 쿠키 — 미들웨어가 `/` 에서 읽을 수 있어야 함) */

export const PWA_START_PATH_COOKIE = 'pwa_start_path'

const PWA_SAVED_PATH_RE =
  /^\/(chat\/|(ko|en)\/(guide|admin)(\/|$))/

export function isSafePwaStartPath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('//') || path.includes('..')) return false
  return PWA_SAVED_PATH_RE.test(path)
}

/** 브라우저에서만 호출. localStorage + 쿠키에 저장. */
export function persistPwaStartPath(path: string): void {
  if (typeof window === 'undefined') return
  if (!isSafePwaStartPath(path)) return
  try {
    localStorage.setItem('pwa_install_url', path)
  } catch {
    /* ignore */
  }
  try {
    const maxAge = 60 * 60 * 24 * 400
    document.cookie = `${PWA_START_PATH_COOKIE}=${encodeURIComponent(path)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  } catch {
    /* ignore */
  }
}
