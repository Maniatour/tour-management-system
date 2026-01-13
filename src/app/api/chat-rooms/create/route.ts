import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * POST /api/chat-rooms/create
 * 
 * 투어 채팅방 생성 API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tourId, productId, tourDate } = body

    if (!tourId) {
      return NextResponse.json(
        { error: '투어 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 이미 채팅방이 있는지 확인
    const { data: existingRooms, error: findError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('tour_id', tourId)
      .eq('is_active', true)
      .limit(1)

    if (findError) {
      console.error('채팅방 조회 오류:', findError)
      return NextResponse.json(
        { error: '채팅방 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (existingRooms && existingRooms.length > 0) {
      return NextResponse.json({
        success: true,
        room: existingRooms[0],
        message: '이미 채팅방이 존재합니다.'
      })
    }

    // 상품명 가져오기
    let productName = '투어'
    if (productId) {
      const { data: productData } = await supabase
        .from('products')
        .select('name_ko, name_en')
        .eq('id', productId)
        .maybeSingle()

      if (productData) {
        productName = productData.name_ko || productData.name_en || '투어'
      }
    }

    // 고유한 채팅방 코드 생성
    const roomCode = `TOUR_${tourId}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`

    // 채팅방 생성
    const { data: newRoom, error: createError } = await supabase
      .from('chat_rooms')
      .insert({
        tour_id: tourId,
        room_name: `${productName} 채팅방`,
        room_code: roomCode,
        description: `${productName} 투어 관련 문의사항을 남겨주세요.`,
        is_active: true,
        created_by: 'system'
      })
      .select()
      .single()

    if (createError) {
      console.error('채팅방 생성 오류:', createError)
      return NextResponse.json(
        { error: '채팅방 생성에 실패했습니다.', details: createError.message },
        { status: 500 }
      )
    }

    console.log('채팅방 생성 성공:', {
      tourId,
      roomId: newRoom?.id,
      roomCode: newRoom?.room_code
    })

    return NextResponse.json({
      success: true,
      room: newRoom,
      message: '채팅방이 생성되었습니다.'
    })

  } catch (error) {
    console.error('채팅방 생성 오류:', error)
    return NextResponse.json(
      { error: '채팅방 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
