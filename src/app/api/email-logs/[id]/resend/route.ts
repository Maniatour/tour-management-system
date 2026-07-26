import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { resendEmailFromLog } from '@/lib/emailLogResend'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/email-logs/[id]/resend
 * 반송·발송 실패된 이메일을 동일 유형으로 재발송합니다.
 * Body: { email?: string } — 선택: 수정된 수신 주소
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  if (!id?.trim()) {
    return NextResponse.json({ error: '이메일 로그 ID가 필요합니다.' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const emailOverride = typeof body.email === 'string' ? body.email.trim() : undefined

  if (!supabaseAdmin) {
    return NextResponse.json({ error: '서버 설정 오류입니다.' }, { status: 500 })
  }

  const { data: emailLog, error } = await supabaseAdmin
    .from('email_logs')
    .select('id, reservation_id, email, email_type, status, subject')
    .eq('id', id.trim())
    .maybeSingle()

  if (error) {
    console.error('[email-logs/resend] 조회 오류:', error)
    return NextResponse.json({ error: '이메일 로그를 찾을 수 없습니다.' }, { status: 500 })
  }

  if (!emailLog) {
    return NextResponse.json({ error: '이메일 로그를 찾을 수 없습니다.' }, { status: 404 })
  }

  const status = String((emailLog as { status?: string }).status ?? '').toLowerCase()
  if (status !== 'bounced' && status !== 'failed') {
    return NextResponse.json(
      { error: '반송되었거나 발송 실패한 이메일만 재발송할 수 있습니다.' },
      { status: 400 }
    )
  }

  const result = await resendEmailFromLog(request, emailLog as Parameters<typeof resendEmailFromLog>[1], {
    sentBy: auth.userEmail,
    ...(emailOverride ? { emailOverride } : {}),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    message: '이메일이 재발송되었습니다.',
  })
}
