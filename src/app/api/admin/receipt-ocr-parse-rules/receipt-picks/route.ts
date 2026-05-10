import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase-server'
import { createSupabaseClientWithToken, supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR } from '@/lib/tourExpenseConstants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export type ReceiptPickRow = {
  id: string
  image_url: string | null
  file_path: string | null
  paid_to: string | null
  paid_for: string
  tour_date: string
  amount: number | null
  submitted_by: string
  updated_at: string | null
  /** 공개 URL 또는 Storage 경로가 있으면 true (OCR·미리보기 가능) */
  has_receipt_media: boolean
}

const ALLOWLIST = new Set(['info@maniatour.com', 'wooyong.shim09@gmail.com'])

/** PostgREST 기본 max-rows(1000) 등을 넘기지 않도록 */
const TOUR_EXPENSE_SCAN_LIMIT = 1000

function rowHasReceiptMedia(r: { image_url?: string | null; file_path?: string | null }): boolean {
  const u = String(r.image_url ?? '').trim()
  const fp = String(r.file_path ?? '').trim()
  return u.length > 0 || fp.length > 0
}

async function loadReceiptPicks(sb: SupabaseClient<Database>): Promise<ReceiptPickRow[]> {
  const { data, error } = await sb
    .from('tour_expenses')
    .select('id, image_url, file_path, paid_to, paid_for, tour_date, amount, submitted_by, updated_at')
    .order('updated_at', { ascending: false })
    .limit(TOUR_EXPENSE_SCAN_LIMIT)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const pendingLabel = TOUR_EXPENSE_RECEIPT_PENDING_PAID_FOR

  const picked = rows.filter((r) => {
    const paidFor = String(r.paid_for ?? '').trim()
    return rowHasReceiptMedia(r) || paidFor === pendingLabel
  })

  return picked.slice(0, 350).map((r) => ({
    id: r.id,
    image_url: r.image_url,
    file_path: r.file_path,
    paid_to: r.paid_to,
    paid_for: r.paid_for,
    tour_date: r.tour_date,
    amount: r.amount,
    submitted_by: r.submitted_by,
    updated_at: r.updated_at,
    has_receipt_media: rowHasReceiptMedia(r),
  }))
}

/**
 * DB `is_staff()`와 유사: 허용 이메일 또는 활성 team 행이 있으면 전역 목록 조회 허용.
 * `maybeSingle` + 중복 team 이메일은 PGRST116을 유발할 수 있어 `limit(1)`로만 조회합니다.
 */
async function mayUseServiceRoleForPicks(userEmail: string): Promise<boolean> {
  const em = userEmail.trim().toLowerCase()
  if (ALLOWLIST.has(em)) return true
  if (!supabaseAdmin) return false

  try {
    const { data, error } = await supabaseAdmin
      .from('team')
      .select('id, is_active')
      .ilike('email', userEmail.trim())
      .limit(1)

    if (error) {
      console.error('[receipt-picks] team lookup error:', error.message, error.code)
      return false
    }
    const row = data?.[0]
    if (!row?.id) return false
    return row.is_active !== false
  } catch (e) {
    console.error('[receipt-picks] team lookup exception:', e)
    return false
  }
}

/**
 * 영수증 OCR 파싱 규칙 화면용: 투어 지출 목록.
 * - 인증: 쿠키 또는 Authorization Bearer(sb-access-token)
 * - 활성 팀원·허용 이메일이면 서비스 롤로 전체 조회(RLS·이메일 불일치 이슈 회피)
 * - 그 외에는 JWT 클라이언트(RLS)로 조회
 * - 이미지 URL/경로가 있거나, `Receipt Pending`(영수증만 등록) 행은 목록에 포함
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    const supabaseCookie = await createServerSupabase()
    let {
      data: { user },
      error: authErr,
    } = await supabaseCookie.auth.getUser()

    let db: SupabaseClient<Database> = supabaseCookie

    if (!user && bearer) {
      const jwtResult = await supabaseCookie.auth.getUser(bearer)
      user = jwtResult.data.user
      authErr = jwtResult.error
      if (user) {
        db = createSupabaseClientWithToken(bearer)
      }
    }

    if (authErr || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const useServiceRole = Boolean(supabaseAdmin && (await mayUseServiceRoleForPicks(user.email)))

    let picks: ReceiptPickRow[]
    try {
      picks = await loadReceiptPicks(useServiceRole && supabaseAdmin ? supabaseAdmin : db)
    } catch (loadErr) {
      const msg = loadErr instanceof Error ? loadErr.message : String(loadErr)
      console.error('[receipt-picks] loadReceiptPicks failed:', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({
      data: picks,
      meta: { usedServiceRole: useServiceRole },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'failed'
    console.error('[receipt-picks] unhandled:', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
