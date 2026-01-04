import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// 서비스 롤 키를 사용한 Supabase 클라이언트 생성 (RLS 우회)
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service role key is required for API routes')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

// 고객용 채팅 메시지 전송 (인증 불필요)
export async function POST(request: NextRequest) {
  try {
    // 서비스 롤 키 확인
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
      return NextResponse.json({ 
        error: '서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다',
        details: 'Please set SUPABASE_SERVICE_ROLE_KEY in environment variables'
      }, { status: 500 })
    }

    const body = await request.json()
    const { 
      room_id, 
      sender_name,
      sender_type = 'customer',
      sender_avatar,
      message, 
      message_type = 'text',
      file_url,
      file_name,
      file_size
    } = body

    // 필수 필드 검증 (이미지 메시지인 경우 message는 빈 문자열일 수 있음)
    if (!room_id || !sender_name) {
      return NextResponse.json({ 
        error: '필수 필드가 누락되었습니다',
        details: { room_id: !!room_id, sender_name: !!sender_name }
      }, { status: 400 })
    }
    
    // 텍스트 메시지인 경우 message 필수, 이미지 메시지인 경우 file_url 필수
    if (message_type === 'text' && !message) {
      return NextResponse.json({ 
        error: '메시지 내용이 필요합니다',
        details: { message: !!message }
      }, { status: 400 })
    }
    
    if (message_type === 'image' && !file_url) {
      return NextResponse.json({ 
        error: '이미지 URL이 필요합니다',
        details: { file_url: !!file_url }
      }, { status: 400 })
    }

    // 서비스 롤 클라이언트 사용 (RLS 우회)
    const supabaseAdmin = getSupabaseAdmin()

    // 채팅방이 활성화되어 있는지 확인
    const { data: room, error: roomError } = await supabaseAdmin
      .from('chat_rooms')
      .select('id, is_active, room_code')
      .eq('id', room_id)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ 
        error: '채팅방을 찾을 수 없습니다',
        details: roomError?.message 
      }, { status: 404 })
    }

    if (!room.is_active) {
      return NextResponse.json({ 
        error: '비활성화된 채팅방입니다' 
      }, { status: 403 })
    }

    // 메시지 생성 (서버 측에서 삽입하여 RLS 우회)
    const messageData: any = {
      room_id: room_id,
      sender_type: sender_type,
      sender_name: sender_name,
      sender_email: null, // 고객은 이메일 없음
      message: message || '',
      message_type: message_type
    }
    
    // 아바타가 있으면 추가
    if (sender_avatar) {
      messageData.sender_avatar = sender_avatar
    }
    
    // 이미지 메시지인 경우 파일 정보 추가
    if (message_type === 'image') {
      if (file_url) messageData.file_url = file_url
      if (file_name) messageData.file_name = file_name
      if (file_size) messageData.file_size = file_size
    }

    console.log('Inserting message with data:', {
      room_id,
      sender_type,
      sender_name,
      sender_avatar: sender_avatar ? 'present' : 'missing',
      message_length: message.length,
      message_type
    })

    let newMessage
    let insertError

    // sender_avatar 컬럼이 없을 수 있으므로, 먼저 시도하고 실패하면 제거 후 재시도
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single()

    if (error) {
      // sender_avatar 관련 에러인 경우 (예: 컬럼이 없음)
      if (error.code === '42703' || error.message?.includes('sender_avatar') || error.message?.includes('column')) {
        console.warn('sender_avatar 컬럼이 없는 것으로 보입니다. 아바타 없이 재시도합니다.')
        // sender_avatar를 제거하고 재시도
        const { sender_avatar, ...messageDataWithoutAvatar } = messageData
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('chat_messages')
          .insert(messageDataWithoutAvatar)
          .select()
          .single()
        
        if (retryError) {
          insertError = retryError
        } else {
          newMessage = retryData
        }
      } else {
        insertError = error
      }
    } else {
      newMessage = data
    }

    if (insertError) {
      const errorInfo = {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        messageData: {
          ...messageData,
          message: messageData.message?.substring(0, 50) + '...' // 메시지 일부만 로그
        }
      }
      console.error('Error inserting message:', JSON.stringify(errorInfo, null, 2))
      return NextResponse.json({ 
        error: '메시지 전송에 실패했습니다',
        details: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        fullError: errorInfo
      }, { status: 500 })
    }

    return NextResponse.json({ message: newMessage })
  } catch (error) {
    console.error('Error in chat message API:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

