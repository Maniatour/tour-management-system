import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClientWithToken, isAbortLikeError, supabase } from '@/lib/supabase'

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.split(' ')[1]?.trim()
  return token || null
}

// 채팅방 목록 조회
export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // RLS 적용을 위해 사용자 JWT로 쿼리 (anon 키는 team_chat_* 권한 없음)
    const db = createSupabaseClientWithToken(token)

    const simulatedUserEmail = request.headers.get('x-simulated-user-email')
    const effectiveUserEmail = simulatedUserEmail || user.email
    if (!effectiveUserEmail) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomType = searchParams.get('type')

    // 사용자가 참여 중인 채팅방만 조회
    // team_chat_messages는 중첩 시 방마다 전체 메시지를 끌어와 지연·30초 fetch 타임아웃(Abort) 유발.
    // 클라이언트는 /api/team-chat/last-message 로 미리보기를 채움.
    let query = db
      .from('team_chat_rooms')
      .select(`
        *,
        team_chat_participants!inner(
          participant_email,
          participant_name,
          participant_position,
          is_admin
        )
      `)
      .eq('is_active', true)
      .eq('team_chat_participants.participant_email', effectiveUserEmail)
      .order('updated_at', { ascending: false })

    if (roomType && roomType !== 'all') {
      query = query.eq('room_type', roomType)
    }

    const { data, error } = await query

    if (error) {
      if (isAbortLikeError(error)) {
        console.warn('채팅방 조회 중단/시간 초과(네트워크·Supabase 지연):', error)
        return NextResponse.json(
          { error: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' },
          { status: 504 }
        )
      }
      console.error('채팅방 조회 오류:', error)
      return NextResponse.json(
        { error: '채팅방을 불러올 수 없습니다', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ rooms: data || [] })
  } catch (error) {
    if (isAbortLikeError(error)) {
      console.warn('채팅방 조회 중단/시간 초과:', error)
      return NextResponse.json(
        { error: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 504 }
      )
    }
    console.error('채팅방 조회 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}

// 새 채팅방 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { room_name, room_type, description, participant_emails } = body

    console.log('채팅방 생성 요청:', { room_name, room_type, description })

    if (!room_name || !room_type) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다' }, { status: 400 })
    }

    const token = getBearerToken(request)
    if (!token) {
      console.error('인증 헤더 없음')
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('인증 오류:', authError)
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    if (!user.email) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const db = createSupabaseClientWithToken(token)

    console.log('현재 사용자:', user.email)

    const { data: teamData, error: teamError } = await db
      .from('team')
      .select('email, position, is_active, name_ko')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (teamError || !teamData) {
      console.error('팀 권한 확인 오류:', teamError)
      return NextResponse.json({ error: '팀 권한이 없습니다' }, { status: 403 })
    }

    console.log('팀 데이터:', teamData)

    const allowedPositions = ['super', 'op', 'office manager']
    const userPosition = teamData.position?.toLowerCase() ?? ''
    console.log('사용자 직책:', userPosition, '허용된 직책:', allowedPositions)

    if (!allowedPositions.includes(userPosition)) {
      console.error('권한 부족:', userPosition)
      return NextResponse.json({
        error: '채팅방 생성 권한이 없습니다',
        details: `현재 권한: ${teamData.position}, 필요 권한: ${allowedPositions.join(', ')}`,
      }, { status: 403 })
    }

    console.log('권한 확인 통과, 채팅방 생성 시도...')

    const { data: room, error: roomError } = await db
      .from('team_chat_rooms')
      .insert({
        room_name,
        room_type,
        ...(description != null ? { description } : {}),
        created_by: user.email,
      })
      .select()
      .single()

    if (roomError) {
      console.error('채팅방 생성 오류:', roomError)
      console.error('요청 데이터:', { room_name, room_type, description, created_by: user.email })
      return NextResponse.json({
        error: '채팅방을 생성할 수 없습니다',
        details: roomError.message,
      }, { status: 500 })
    }

    if (participant_emails && participant_emails.length > 0) {
      const { data: teamMembers, error: membersError } = await db
        .from('team')
        .select('email, name_ko, position')
        .in('email', participant_emails)
        .eq('is_active', true)

      if (membersError) {
        console.error('팀원 조회 오류:', membersError)
      } else {
        const participants = participant_emails.map((email: string) => {
          const teamMember = teamMembers?.find(member => member.email === email)
          return {
            room_id: room.id,
            participant_email: email,
            participant_name: teamMember?.name_ko || email.split('@')[0],
            ...(teamMember?.position != null ? { participant_position: teamMember.position } : {}),
            is_admin: false,
          }
        })

        const { error: participantsError } = await db
          .from('team_chat_participants')
          .insert(participants)

        if (participantsError) {
          console.error('참여자 추가 오류:', participantsError)
        }
      }
    }

    const { error: creatorError } = await db
      .from('team_chat_participants')
      .insert({
        room_id: room.id,
        participant_email: user.email,
        participant_name: teamData.name_ko || user.email.split('@')[0],
        ...(teamData.position != null ? { participant_position: teamData.position } : {}),
        is_admin: true,
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
