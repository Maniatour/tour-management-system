import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'

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
  supabase: ReturnType<typeof createMiddlewareSupabase>,
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

async function verifyStaffSession(
  req: NextRequest,
  res: NextResponse
): Promise<boolean> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const supabase = createMiddlewareSupabase(req, res)

  if (token) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (!error && user?.email) {
      return isActiveStaffEmail(supabase, user.email.trim().toLowerCase())
    }
  }

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

export function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  if (isProduction()) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }

  return response
}
