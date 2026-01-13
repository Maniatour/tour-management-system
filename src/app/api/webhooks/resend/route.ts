import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/webhooks/resend
 * 
 * Resend Webhook 엔드포인트
 * 이메일 읽음 추적 이벤트를 처리합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const event = body

    console.log('[webhook/resend] 이벤트 수신:', {
      type: event.type,
      email_id: event.data?.email_id,
      timestamp: new Date().toISOString()
    })

    const emailId = event.data?.email_id
    
    if (!emailId) {
      console.error('[webhook/resend] email_id가 없습니다.')
      return NextResponse.json({ error: 'email_id is required' }, { status: 400 })
    }

    // email_logs에서 해당 이메일 찾기
    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('id, opened_at, opened_count, delivered_at, bounced_at, clicked_at, clicked_count')
      .eq('resend_email_id', emailId)
      .maybeSingle()

    if (findError) {
      console.error('[webhook/resend] 이메일 로그 조회 오류:', findError)
      return NextResponse.json({ error: 'Failed to find email log' }, { status: 500 })
    }

    if (!emailLog) {
      console.log('[webhook/resend] 해당 이메일 로그를 찾을 수 없습니다:', emailId)
      // 로그가 없어도 200 반환 (이미 삭제되었거나 다른 시스템에서 발송된 이메일일 수 있음)
      return NextResponse.json({ success: true, message: 'Email log not found' })
    }

    // 이벤트 타입별 처리
    if (event.type === 'email.delivered') {
      // 이메일 전달 성공
      if (!emailLog.delivered_at) {
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            delivered_at: new Date().toISOString(),
            status: 'delivered'
          })
          .eq('id', emailLog.id)

        if (updateError) {
          console.error('[webhook/resend] 전달 상태 업데이트 오류:', updateError)
          return NextResponse.json({ error: 'Failed to update delivered status' }, { status: 500 })
        }

        console.log('[webhook/resend] 이메일 전달 상태 업데이트 완료:', {
          email_id: emailId,
          delivered_at: new Date().toISOString()
        })
      }
    } else if (event.type === 'email.bounced') {
      // 이메일 반송
      const bounceReason = event.data?.bounce_type || event.data?.reason || 'Unknown'
      
      if (!emailLog.bounced_at) {
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            bounced_at: new Date().toISOString(),
            bounce_reason: bounceReason,
            status: 'bounced'
          })
          .eq('id', emailLog.id)

        if (updateError) {
          console.error('[webhook/resend] 반송 상태 업데이트 오류:', updateError)
          return NextResponse.json({ error: 'Failed to update bounced status' }, { status: 500 })
        }

        console.log('[webhook/resend] 이메일 반송 상태 업데이트 완료:', {
          email_id: emailId,
          bounced_at: new Date().toISOString(),
          bounce_reason: bounceReason
        })
      }
    } else if (event.type === 'email.opened') {
      // 이메일 읽음
      if (emailLog.opened_at) {
        // 이미 읽은 적이 있는 경우 opened_count만 증가
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            opened_count: (emailLog.opened_count || 0) + 1
          })
          .eq('id', emailLog.id)

        if (updateError) {
          console.error('[webhook/resend] 읽음 횟수 업데이트 오류:', updateError)
          return NextResponse.json({ error: 'Failed to update opened_count' }, { status: 500 })
        }

        console.log('[webhook/resend] 읽음 횟수 업데이트 완료:', {
          email_id: emailId,
          opened_count: (emailLog.opened_count || 0) + 1
        })
      } else {
        // 처음 읽은 경우 opened_at과 opened_count 설정
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            opened_at: new Date().toISOString(),
            opened_count: 1
          })
          .eq('id', emailLog.id)

        if (updateError) {
          console.error('[webhook/resend] 읽음 상태 업데이트 오류:', updateError)
          return NextResponse.json({ error: 'Failed to update opened status' }, { status: 500 })
        }

        console.log('[webhook/resend] 이메일 읽음 상태 업데이트 완료:', {
          email_id: emailId,
          opened_at: new Date().toISOString()
        })
      }
    } else if (event.type === 'email.clicked') {
      // 링크 클릭
      if (emailLog.clicked_at) {
        // 이미 클릭한 적이 있는 경우 clicked_count만 증가
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            clicked_count: (emailLog.clicked_count || 0) + 1
          })
          .eq('id', emailLog.id)

        if (updateError) {
          console.error('[webhook/resend] 클릭 횟수 업데이트 오류:', updateError)
          return NextResponse.json({ error: 'Failed to update clicked_count' }, { status: 500 })
        }

        console.log('[webhook/resend] 클릭 횟수 업데이트 완료:', {
          email_id: emailId,
          clicked_count: (emailLog.clicked_count || 0) + 1
        })
      } else {
        // 처음 클릭한 경우 clicked_at과 clicked_count 설정
        const { error: updateError } = await supabase
          .from('email_logs')
          .update({
            clicked_at: new Date().toISOString(),
            clicked_count: 1
          })
          .eq('id', emailLog.id)

        if (updateError) {
          console.error('[webhook/resend] 클릭 상태 업데이트 오류:', updateError)
          return NextResponse.json({ error: 'Failed to update clicked status' }, { status: 500 })
        }

        console.log('[webhook/resend] 이메일 클릭 상태 업데이트 완료:', {
          email_id: emailId,
          clicked_at: new Date().toISOString()
        })
      }
    }

    return NextResponse.json({ success: true, message: 'Event processed' })
  } catch (error) {
    console.error('[webhook/resend] Webhook 처리 오류:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET 요청은 webhook 설정 확인용
export async function GET() {
  return NextResponse.json({ 
    message: 'Resend Webhook Endpoint',
    status: 'active',
    supported_events: [
      'email.delivered',  // 이메일 전달 성공
      'email.bounced',    // 이메일 반송
      'email.opened',     // 이메일 읽음
      'email.clicked'     // 링크 클릭
    ]
  })
}
