import { AUTH_ACCESS_COOKIE } from '@/lib/authSessionCookie'

/** React 이전에 localStorage JWT → 쿠키 동기화 (다음 새로고침부터 미들웨어 선검증 가능) */
export const AUTH_SESSION_COOKIE_INLINE_SCRIPT = `
(function () {
  try {
    var token = localStorage.getItem('sb-access-token');
    var expRaw = localStorage.getItem('sb-expires-at');
    if (!token || !expRaw) {
      document.cookie = '${AUTH_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax';
      return;
    }
    var exp = parseInt(expRaw, 10);
    if (!exp || isNaN(exp)) return;
    var maxAge = exp - Math.floor(Date.now() / 1000);
    if (maxAge <= 0) {
      document.cookie = '${AUTH_ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax';
      return;
    }
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = '${AUTH_ACCESS_COOKIE}=' + encodeURIComponent(token.trim())
      + '; Path=/; Max-Age=' + maxAge + '; SameSite=Lax' + secure;
  } catch (e) {}
})();
`.trim()

/** Root layout 전용 — next/script 대신 서버 HTML script (React 19 호환) */
export default function AuthSessionCookieInlineScript() {
  return (
    <script
      id="tms-auth-session-cookie-sync"
      dangerouslySetInnerHTML={{ __html: AUTH_SESSION_COOKIE_INLINE_SCRIPT }}
    />
  )
}
