import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'
import { readAuthAccessTokenFromRequest } from '@/lib/authSessionCookie'

const STAFF_EMAIL_WHITELIST = new Set(['info@maniatour.com', 'wooyong.shim09@gmail.com'])

const BLOCKED_IN_PRODUCTION = [
  '/api/test-sql',
  '/api/test-sync',
  '/api/create-table',
  '/api/check-table',
  '/api/guide-costs/test',
] as const

const CRON_PATH_PREFIXES = ['/api/cron/', '/api/weather-scheduler'] as const

const CRON_EXACT_PATHS = new Set(['/api/reports/send-email'])

/** 스태프(팀) 전용 API — prefix 일치 시 인증 필수 */
const STAFF_PATH_PREFIXES = [
  '/api/sync/',
  '/api/admin/',
  '/api/email/',
  '/api/preview-',
  '/api/send-',
  '/api/expenses/',
  '/api/google-drive/',
  '/api/reservation-imports/',
] as const

const STAFF_EXACT_PATHS = new Set([
  '/api/update-products-name-en',
  '/api/weather-collector',
  '/api/translate',
  '/api/workflow-steps',
])

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix))
}

function createMiddlewareSupabase(req: NextRequest, res: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )
}

async function isActiveStaffEmail(
  supabase: SupabaseClient<Database>,
  emailLower: string
): Promise<boolean> {
  if (STAFF_EMAIL_WHITELIST.has(emailLower)) return true

  const { data: staffOk, error: staffErr } = await supabase.rpc('is_staff', {
    p_email: emailLower,
  })
  if (!staffErr && staffOk) return true

  const { data, error } = await supabase
    .from('team')
    .select('id')
    .ilike('email', emailLower)
    .or('is_active.is.null,is_active.eq.true')
    .limit(1)
    .maybeSingle()

  return !error && !!data
}

function createBearerSupabase(token: string): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )
}

async function verifyStaffSession(
  req: NextRequest,
  res: NextResponse
): Promise<boolean> {
  const token = readAuthAccessTokenFromRequest(req)

  // localStorage JWT(Bearer / tms-auth-access) — 쿠키 세션이 없어도 authenticated 로 is_staff/team 조회
  if (token) {
    const bearerSb = createBearerSupabase(token)
    const {
      data: { user },
      error,
    } = await bearerSb.auth.getUser(token)
    if (!error && user?.email) {
      return isActiveStaffEmail(bearerSb, user.email.trim().toLowerCase())
    }
  }

  const supabase = createMiddlewareSupabase(req, res)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.email) return false

  return isActiveStaffEmail(supabase, session.user.email.trim().toLowerCase())
}

function verifyCronRequest(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (isProduction()) {
    if (!cronSecret) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

function requiresStaffAuth(pathname: string, method: string): boolean {
  // 고객 결제 직후 확인 메일 — 라우트에서 소유권 검증
  if (pathname === '/api/send-email') return false
  if (matchesPrefix(pathname, STAFF_PATH_PREFIXES)) return true
  if (STAFF_EXACT_PATHS.has(pathname)) return true
  if (pathname === '/api/messenger-contact-settings' && method === 'PUT') return true
  if (pathname === '/api/reports/generate' && method === 'POST') return true
  return false
}

export async function handleApiSecurity(
  req: NextRequest
): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname
  if (!pathname.startsWith('/api/')) return null

  if (
    pathname.startsWith('/api/debug/') ||
    BLOCKED_IN_PRODUCTION.some(
      (blocked) => pathname === blocked || pathname.startsWith(`${blocked}/`)
    )
  ) {
    if (isProduction()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  if (
    matchesPrefix(pathname, CRON_PATH_PREFIXES) ||
    (CRON_EXACT_PATHS.has(pathname) && req.method === 'POST')
  ) {
    return verifyCronRequest(req)
  }

  if (!requiresStaffAuth(pathname, req.method)) {
    return null
  }

  const draft = NextResponse.next()
  const isStaff = await verifyStaffSession(req, draft)
  if (!isStaff) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  return null
}

/** 관리자 고객 페이지 작업·위치 미리보기 iframe (`?preview=1`) */
export function isCustomerPagePreviewEmbedRequest(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('preview') === '1'
}

export function applySecurityHeaders(
  response: NextResponse,
  req?: NextRequest
): NextResponse {
  const frameOptions =
    req && isCustomerPagePreviewEmbedRequest(req) ? 'SAMEORIGIN' : 'DENY'
  response.headers.set('X-Frame-Options', frameOptions)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // () = 완전 차단 → 위치/마이크/카메라가 OS·브라우저 허용과 무관하게 거부됨
  // (self) = 이 사이트에서만 허용 (투어 채팅 위치 공유, 음성통화, 영수증 카메라)
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self)'
  )

  if (isProduction()) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }

  return response
}
