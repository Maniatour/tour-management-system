import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const roomId = formData.get('roomId') as string

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
    }

    if (!roomId) {
      return NextResponse.json({ error: '채팅방 ID가 필요합니다' }, { status: 400 })
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: '파일 크기는 10MB를 초과할 수 없습니다' }, { status: 400 })
    }

    // 허용된 파일 타입
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: '지원하지 않는 파일 형식입니다',
        allowedTypes: allowedTypes
      }, { status: 400 })
    }

    // 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = `team-chat/${roomId}/${fileName}`

    // Supabase Storage에 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('team-chat-files')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('파일 업로드 오류:', uploadError)
      return NextResponse.json({ error: '파일 업로드에 실패했습니다' }, { status: 500 })
    }

    // 공개 URL 생성
    const { data: { publicUrl } } = supabase.storage
      .from('team-chat-files')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        url: publicUrl,
        path: filePath
      }
    })
  } catch (error) {
    console.error('파일 업로드 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
