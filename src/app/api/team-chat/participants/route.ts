import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 참여자 목록 조회
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
    const roomId = searchParams.get('room_id')

    if (!roomId) {
      return NextResponse.json({ error: '채팅방 ID가 필요합니다' }, { status: 400 })
    }

    console.log('참여자 조회 요청:', { roomId, userEmail: user.email })

    const { data: participants, error } = await supabase
      .from('team_chat_participants')
      .select(`
        *,
        team:participant_email(
          name_ko,
          name_en,
          position,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('참여자 조회 오류:', error)
      return NextResponse.json({ 
        error: '참여자를 불러올 수 없습니다', 
        details: error.message 
      }, { status: 500 })
    }

    console.log('참여자 조회 결과:', { participantsCount: participants?.length || 0 })

    return NextResponse.json({ participants: participants || [] })
  } catch (error) {
    console.error('참여자 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 참여자 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { room_id, participant_emails } = body

    if (!room_id || !participant_emails || !Array.isArray(participant_emails)) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    // 팀원 정보 조회
    const { data: teamMembers, error: teamError } = await supabase
      .from('team')
      .select('email, name_ko, name_en, position')
      .in('email', participant_emails)
      .eq('is_active', true)

    if (teamError) {
      console.error('팀원 조회 오류:', teamError)
      return NextResponse.json({ error: '팀원 정보를 조회할 수 없습니다' }, { status: 500 })
    }

    // 참여자 데이터 준비
    const participants = participant_emails.map((email: string) => {
      const teamMember = teamMembers?.find(member => member.email === email)
      return {
        room_id,
        participant_email: email,
        participant_name: teamMember?.name_ko || email.split('@')[0],
        participant_position: teamMember?.position,
        is_admin: false
      }
    })

    const { data: newParticipants, error } = await supabase
      .from('team_chat_participants')
      .insert(participants)
      .select()

    if (error) {
      console.error('참여자 추가 오류:', error)
      return NextResponse.json({ error: '참여자를 추가할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ participants: newParticipants })
  } catch (error) {
    console.error('참여자 추가 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 참여자 제거
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('room_id')
    const participantEmail = searchParams.get('participant_email')

    if (!roomId || !participantEmail) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    const { error } = await supabase
      .from('team_chat_participants')
      .update({ is_active: false })
      .eq('room_id', roomId)
      .eq('participant_email', participantEmail)

    if (error) {
      console.error('참여자 제거 오류:', error)
      return NextResponse.json({ error: '참여자를 제거할 수 없습니다' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('참여자 제거 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
