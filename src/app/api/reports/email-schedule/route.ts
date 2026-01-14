import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { enabled, time, period } = body

    // 기존 스케줄 조회
    const { data: existingSchedule } = await supabase
      .from('report_email_schedules')
      .select('id')
      .eq('period', period)
      .maybeSingle()

    if (existingSchedule) {
      // 업데이트
      const { error } = await supabase
        .from('report_email_schedules')
        .update({
          enabled,
          send_time: time,
          updated_by: user.email
        })
        .eq('id', existingSchedule.id)

      if (error) throw error
    } else {
      // 생성
      const { error } = await supabase
        .from('report_email_schedules')
        .insert({
          enabled,
          period,
          send_time: time,
          created_by: user.email,
          updated_by: user.email
        })

      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      message: '이메일 스케줄이 저장되었습니다.',
      schedule: { enabled, time, period }
    })
  } catch (error) {
    console.error('이메일 스케줄 저장 오류:', error)
    return NextResponse.json(
      { error: '이메일 스케줄 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { data: schedules, error } = await supabase
      .from('report_email_schedules')
      .select('*')
      .order('period')

    if (error) throw error

    return NextResponse.json({
      success: true,
      schedules: schedules || []
    })
  } catch (error) {
    console.error('이메일 스케줄 조회 오류:', error)
    return NextResponse.json(
      { error: '이메일 스케줄 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
