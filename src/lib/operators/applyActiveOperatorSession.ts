/**
 * Request-scoped set_current_operator_id (Phase 6c.9 prep).
 * Call at the start of authenticated API handlers so Postgres GUC is set
 * for that PostgREST/DB round-trip chain on the same client.
 * Staff RLS lock-down remains deferred until this path is proven.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import {
  ACTIVE_OPERATOR_ID_COOKIE,
  ACTIVE_OPERATOR_ID_HEADER,
  readActiveOperatorIdFromRequestLike,
} from '@/lib/operators/activeOperatorCookie'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'

export type ApplyActiveOperatorResult = {
  operatorId: string
  applied: boolean
  source: 'header_or_cookie' | 'query' | 'fallback'
  error?: string
}

export async function applyActiveOperatorSession(
  supabase: SupabaseClient,
  request: NextRequest,
  explicitOperatorId?: string | null
): Promise<ApplyActiveOperatorResult> {
  const fromExplicit = explicitOperatorId?.trim() || null
  const fromRequest = readActiveOperatorIdFromRequestLike(request)
  const fromQuery = request.nextUrl.searchParams.get('operatorId')

  let source: ApplyActiveOperatorResult['source'] = 'fallback'
  let raw: string | null = null
  if (fromExplicit) {
    raw = fromExplicit
    source = 'query'
  } else if (fromRequest) {
    raw = fromRequest
    source = 'header_or_cookie'
  } else if (fromQuery) {
    raw = fromQuery
    source = 'query'
  }

  const operatorId = resolveOperatorId(raw)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('set_current_operator_id', {
      p_operator_id: operatorId,
    })
    if (error) {
      return {
        operatorId,
        applied: false,
        source,
        error: error.message || 'set_current_operator_id failed',
      }
    }
    return { operatorId, applied: true, source }
  } catch (err) {
    return {
      operatorId,
      applied: false,
      source,
      error: err instanceof Error ? err.message : 'set_current_operator_id threw',
    }
  }
}

export function evaluateActiveOperatorCookiePrep(request: NextRequest): {
  /** True when cookie/header is a valid UUID (synced). False if missing or malformed. */
  ok: boolean
  /** True unless cookie is present but malformed. */
  notBroken: boolean
  cookiePresent: boolean
  cookieValid: boolean
  headerPresent: boolean
  operatorId: string | null
  detail: string
} {
  const cookieRaw = request.cookies.get(ACTIVE_OPERATOR_ID_COOKIE)?.value ?? null
  const cookieId = readActiveOperatorIdFromRequestLike({
    cookies: request.cookies,
    headers: { get: () => null },
  })
  const headerId = readActiveOperatorIdFromRequestLike({
    headers: request.headers,
    cookies: { get: () => undefined },
  })

  const cookiePresent = Boolean(cookieRaw && cookieRaw.trim())
  const cookieValid = cookieId != null
  const headerPresent = headerId != null
  const synced = cookieValid || headerPresent
  const notBroken = !cookiePresent || cookieValid

  return {
    ok: synced,
    notBroken,
    cookiePresent,
    cookieValid,
    headerPresent,
    operatorId: headerId || cookieId,
    detail: !cookiePresent && !headerPresent
      ? `No ${ACTIVE_OPERATOR_ID_COOKIE} yet — switch tenant in header once to sync`
      : synced
        ? `${ACTIVE_OPERATOR_ID_COOKIE}/${ACTIVE_OPERATOR_ID_HEADER} ready operator_id=${headerId || cookieId}`
        : `Malformed ${ACTIVE_OPERATOR_ID_COOKIE} cookie (not a uuid)`,
  }
}
