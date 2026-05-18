import { getAccessTokenForApi, getStoredAccessTokenIfValid, supabase } from '@/lib/supabase'

/**
 * 브라우저가 localStorage(sb-access-token)만 쓰는 경우 App Router API에 JWT를 넘깁니다.
 * 만료된 토큰은 보내지 않습니다(만료 JWT를 Bearer로내면 쿠키 폴백도 막힐 수 있음).
 * `getSupabaseForApiRoute`와 함께 사용하세요.
 */
export function apiBearerAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const t = getStoredAccessTokenIfValid(0)
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/**
 * REST와 동일한 순서로 JWT를 찾습니다.
 * (GoTrue 메모리 세션만 있거나 localStorage만 있는 AuthContext 패턴 대응)
 */
export async function resolveAccessTokenForApi(): Promise<string | null> {
  const stored = getStoredAccessTokenIfValid(30)
  if (stored) return stored

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) return session.access_token

  const refreshed = await getAccessTokenForApi(0)
  if (refreshed) return refreshed

  return getStoredAccessTokenIfValid(0)
}

/** GoTrue 세션·localStorage·refresh 후 유효 JWT를 사용합니다. */
export async function apiBearerAuthHeadersAsync(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {}
  const t = await resolveAccessTokenForApi()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/** App Router API — Bearer(갱신된 JWT) + 쿠키 세션(`getSupabaseForApiRoute` 폴백) */
export async function fetchApiWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Authorization')) {
    const bearer = await apiBearerAuthHeadersAsync()
    for (const [key, value] of Object.entries(bearer)) {
      headers.set(key, value)
    }
  }
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? 'same-origin',
    headers,
  })
}
