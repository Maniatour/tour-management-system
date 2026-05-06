/**
 * 브라우저가 localStorage(sb-access-token)만 쓰는 경우 App Router API에 JWT를 넘깁니다.
 * `getSupabaseForApiRoute`와 함께 사용하세요.
 */
export function apiBearerAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const t = localStorage.getItem('sb-access-token')?.trim()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
