import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 채팅방 목록 조회
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const roomType = searchParams.get('type')

    let query = supabase
      .from('team_chat_rooms')
      .select(`
        *,
        team_chat_participants(count),
        team_chat_messages(
          id,
          message,
          sender_name,
          sender_position,
          created_at
        )
      `)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })

    if (roomType && roomType !== 'all') {
      query = query.eq('room_type', roomType)
    }

    const { data, error } = await query

    if (error) {
      console.error('채팅방 조회 오류:', error)
      return NextResponse.json({ error: '채팅방을 불러올 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ rooms: data || [] })
  } catch (error) {
    console.error('채팅방 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 새 채팅방 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { room_name, room_type, description, participant_emails, created_by } = body

    console.log('채팅방 생성 요청:', { room_name, room_type, description, created_by })

    // 필수 필드 검증
    if (!room_name || !room_type) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('인증 헤더 없음')
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('인증 오류:', authError)
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    console.log('현재 사용자:', user.email)

    // 팀 권한 확인
    const { data: teamData, error: teamError } = await supabase
      .from('team')
      .select('email, position, is_active')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (teamError || !teamData) {
      console.error('팀 권한 확인 오류:', teamError)
      return NextResponse.json({ error: '팀 권한이 없습니다' }, { status: 403 })
    }

    console.log('팀 데이터:', teamData)

    // 권한 확인 (super, op, office manager)
    const allowedPositions = ['super', 'op', 'office manager']
    const userPosition = teamData.position?.toLowerCase()
    console.log('사용자 직책:', userPosition, '허용된 직책:', allowedPositions)
    
    if (!allowedPositions.includes(userPosition)) {
      console.error('권한 부족:', userPosition)
      return NextResponse.json({ 
        error: '채팅방 생성 권한이 없습니다', 
        details: `현재 권한: ${teamData.position}, 필요 권한: ${allowedPositions.join(', ')}` 
      }, { status: 403 })
    }

    console.log('권한 확인 통과, 채팅방 생성 시도...')

    // 채팅방 생성
    const { data: room, error: roomError } = await supabase
      .from('team_chat_rooms')
      .insert({
        room_name,
        room_type,
        description,
        created_by: user.email
      })
      .select()
      .single()

    if (roomError) {
      console.error('채팅방 생성 오류:', roomError)
      console.error('요청 데이터:', { room_name, room_type, description, created_by: body.created_by })
      return NextResponse.json({ 
        error: '채팅방을 생성할 수 없습니다', 
        details: roomError.message 
      }, { status: 500 })
    }

    // 참여자 추가
    if (participant_emails && participant_emails.length > 0) {
      // 팀원 정보 조회
      const { data: teamMembers, error: teamError } = await supabase
        .from('team')
        .select('email, name_ko, position')
        .in('email', participant_emails)
        .eq('is_active', true)

      if (teamError) {
        console.error('팀원 조회 오류:', teamError)
      } else {
        const participants = participant_emails.map((email: string) => {
          const teamMember = teamMembers?.find(member => member.email === email)
          return {
            room_id: room.id,
            participant_email: email,
            participant_name: teamMember?.name_ko || email.split('@')[0],
            participant_position: teamMember?.position,
            is_admin: false
          }
        })

        const { error: participantsError } = await supabase
          .from('team_chat_participants')
          .insert(participants)

        if (participantsError) {
          console.error('참여자 추가 오류:', participantsError)
          // 채팅방은 생성되었으므로 에러를 무시하고 계속 진행
        }
      }
    }

    // 생성자도 참여자로 추가
    const { error: creatorError } = await supabase
      .from('team_chat_participants')
      .insert({
        room_id: room.id,
        participant_email: user.email,
        participant_name: teamData.name_ko || user.email.split('@')[0],
        participant_position: teamData.position,
        is_admin: true
      })

    if (creatorError) {
      console.error('생성자 참여자 추가 오류:', creatorError)
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error('채팅방 생성 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
