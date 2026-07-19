import type { NextRequest, NextResponse } from 'next/server'
import {
  PUBLIC_OPERATOR_ID_COOKIE,
  PUBLIC_OPERATOR_ID_HEADER,
  PUBLIC_OPERATOR_SOURCE_HEADER,
  PUBLIC_OPERATOR_SUBDOMAIN_HEADER,
} from '@/lib/operators/publicOperatorHeaders'
import {
  resolveOperatorFromRequestHeaders,
  type ResolvedPublicOperator,
} from '@/lib/operators/resolveOperatorFromHost'

export async function resolvePublicOperatorForRequest(
  req: NextRequest
): Promise<ResolvedPublicOperator> {
  return resolveOperatorFromRequestHeaders(req.headers)
}

/** Stamp request headers (readable via next/headers in RSC). */
export function setPublicOperatorRequestHeaders(
  requestHeaders: Headers,
  resolved: ResolvedPublicOperator
): void {
  requestHeaders.set(PUBLIC_OPERATOR_ID_HEADER, resolved.operatorId)
  requestHeaders.set(PUBLIC_OPERATOR_SUBDOMAIN_HEADER, resolved.subdomain || '')
  requestHeaders.set(PUBLIC_OPERATOR_SOURCE_HEADER, resolved.source)
}

/** Stamp response cookie for client/layout fallback. */
export function setPublicOperatorResponseCookie(
  res: NextResponse,
  resolved: ResolvedPublicOperator
): void {
  res.cookies.set(PUBLIC_OPERATOR_ID_COOKIE, resolved.operatorId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })
  // Non-httpOnly mirrors for light client diagnostics (not secrets)
  res.cookies.set('tms_public_operator_source', resolved.source, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })
  if (resolved.subdomain) {
    res.cookies.set('tms_public_operator_subdomain', resolved.subdomain, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    })
  }
}

export function applyPublicOperatorToNextResponse(
  res: NextResponse,
  requestHeaders: Headers,
  resolved: ResolvedPublicOperator
): NextResponse {
  setPublicOperatorRequestHeaders(requestHeaders, resolved)
  setPublicOperatorResponseCookie(res, resolved)
  return res
}
