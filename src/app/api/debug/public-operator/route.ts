import { NextRequest, NextResponse } from 'next/server'
import {
  PUBLIC_OPERATOR_ID_COOKIE,
  PUBLIC_OPERATOR_ID_HEADER,
  PUBLIC_OPERATOR_SOURCE_HEADER,
  PUBLIC_OPERATOR_SUBDOMAIN_HEADER,
} from '@/lib/operators/publicOperatorHeaders'
import { resolveOperatorFromRequestHeaders } from '@/lib/operators/resolveOperatorFromHost'

/**
 * GET /api/debug/public-operator
 * Development-only echo of middleware host → operator resolution.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const resolved = await resolveOperatorFromRequestHeaders(request.headers)
  return NextResponse.json({
    ok: true,
    hostname:
      request.headers.get('x-forwarded-host') || request.headers.get('host') || null,
    resolved,
    fromMiddlewareHeaders: {
      operatorId: request.headers.get(PUBLIC_OPERATOR_ID_HEADER),
      subdomain: request.headers.get(PUBLIC_OPERATOR_SUBDOMAIN_HEADER),
      source: request.headers.get(PUBLIC_OPERATOR_SOURCE_HEADER),
    },
    fromCookie: {
      operatorId: request.cookies.get(PUBLIC_OPERATOR_ID_COOKIE)?.value ?? null,
      source: request.cookies.get('tms_public_operator_source')?.value ?? null,
      subdomain: request.cookies.get('tms_public_operator_subdomain')?.value ?? null,
    },
    env: {
      SAAS_PLATFORM_ROOT_DOMAIN: process.env.SAAS_PLATFORM_ROOT_DOMAIN || null,
      SAAS_APEX_HOSTS: process.env.SAAS_APEX_HOSTS || null,
      hasSubdomainMap: Boolean(process.env.SAAS_SUBDOMAIN_OPERATOR_MAP?.trim()),
    },
  })
}
