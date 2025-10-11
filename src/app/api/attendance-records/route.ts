import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 출퇴근 기록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeEmail = searchParams.get('employee_email')
    const month = searchParams.get('month')

    if (!employeeEmail || !month) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 })
    }

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 해당 월의 출퇴근 기록 조회
    const monthStart = month + '-01'
    const year = parseInt(month.split('-')[0])
    const monthNum = parseInt(month.split('-')[1]) - 1
    const monthEnd = new Date(year, monthNum + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('employee_email', employeeEmail)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
      .order('check_in_time', { ascending: false })
      .order('session_number', { ascending: true })

    if (error) {
      console.error('출퇴근 기록 조회 오류:', error)
      return NextResponse.json({ error: '출퇴근 기록을 조회할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ records: data || [] })
  } catch (error) {
    console.error('출퇴근 기록 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 출퇴근 기록 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { employee_email, date, check_in_time, check_out_time, notes } = body

    if (!employee_email || !date || !check_in_time) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 직원 정보 확인
    const { data: employeeData, error: employeeError } = await supabase
      .from('team')
      .select('name_ko, email')
      .eq('email', employee_email)
      .eq('is_active', true)
      .single()

    if (employeeError || !employeeData) {
      return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    // 해당 날짜의 기존 기록 조회하여 다음 세션 번호 계산
    const { data: existingRecords } = await supabase
      .from('attendance_records')
      .select('session_number')
      .eq('employee_email', employee_email)
      .eq('date', date)
      .order('session_number', { ascending: false })
      .limit(1)

    const nextSessionNumber = existingRecords && existingRecords.length > 0 
      ? existingRecords[0].session_number + 1 
      : 1

    // 근무시간 계산 (체크아웃 시간이 있는 경우)
    let workHours = 0
    if (check_out_time) {
      const checkInTime = new Date(check_in_time)
      const checkOutTime = new Date(check_out_time)
      workHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
      workHours = Math.round(workHours * 100) / 100 // 소수점 둘째 자리까지 반올림
    }

    // 출퇴근 기록 추가
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        employee_email,
        date,
        check_in_time,
        check_out_time: check_out_time || null,
        work_hours: workHours,
        status: 'present',
        session_number: nextSessionNumber,
        notes: notes || null
      })
      .select()
      .single()

    if (error) {
      console.error('출퇴근 기록 추가 오류:', error)
      console.error('오류 상세:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        error: '출퇴근 기록을 추가할 수 없습니다',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      record: data,
      message: '출퇴근 기록이 성공적으로 추가되었습니다'
    })
  } catch (error) {
    console.error('출퇴근 기록 추가 예외:', error)
    console.error('예외 상세:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      type: typeof error
    })
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
