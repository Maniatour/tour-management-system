import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import { PUBLIC_OPERATOR_ID_COOKIE } from '@/lib/operators/publicOperatorHeaders'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

/**
 * Client-side: read middleware-stamped public operator cookie.
 * Server code should use getPublicOperatorId() instead.
 */
export function readPublicOperatorIdBrowser(): string {
  if (typeof document === 'undefined') {
    return KOVEgAS_OPERATOR_ID
  }
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === PUBLIC_OPERATOR_ID_COOKIE) {
      try {
        return resolveOperatorId(decodeURIComponent(rest.join('=')))
      } catch {
        return KOVEgAS_OPERATOR_ID
      }
    }
  }
  return KOVEgAS_OPERATOR_ID
}
