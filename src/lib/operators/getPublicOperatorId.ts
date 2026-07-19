import { headers, cookies } from 'next/headers'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'
import {
  PUBLIC_OPERATOR_ID_COOKIE,
  PUBLIC_OPERATOR_ID_HEADER,
} from '@/lib/operators/publicOperatorHeaders'

/**
 * Server Components / Route Handlers: read public operator stamped by middleware.
 * Does not use admin OperatorContext. Falls back to Kovegas.
 */
export async function getPublicOperatorId(): Promise<string> {
  try {
    const h = await headers()
    const fromHeader = (h.get(PUBLIC_OPERATOR_ID_HEADER) || '').trim()
    if (fromHeader) return fromHeader

    const c = await cookies()
    const fromCookie = (c.get(PUBLIC_OPERATOR_ID_COOKIE)?.value || '').trim()
    if (fromCookie) return fromCookie
  } catch {
    /* outside request context */
  }
  return KOVEgAS_OPERATOR_ID
}
