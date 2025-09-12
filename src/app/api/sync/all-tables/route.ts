import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // 하드코딩된 테이블 목록 (Supabase의 모든 주요 테이블)
    const allTables = [
      'reservations',
      'tours', 
      'customers',
      'products',
      'channels',
      'employees',
      'options',
      'product_options',
      'reservation_pricing',
      'dynamic_pricing',
      'suppliers',
      'rental_cars',
      'rental_car_reservations',
      'chat_rooms',
      'chat_messages',
      'chat_announcements',
      'audit_logs',
      'product_details'
    ]

    // 테이블 목록을 표시명과 함께 반환
    const tables = allTables.map(tableName => ({
      name: tableName,
      displayName: getTableDisplayName(tableName)
    }))

    return NextResponse.json({
      success: true,
      data: { tables }
    })

  } catch (error) {
    console.error('Get all tables error:', error)
    return NextResponse.json(
      { success: false, message: `Failed to get all tables: ${error}` },
      { status: 500 }
    )
  }
}

// 테이블 표시명 가져오기
function getTableDisplayName(tableName: string): string {
  const displayNames: { [key: string]: string } = {
    reservations: '예약',
    tours: '투어', 
    customers: '고객',
    products: '상품',
    channels: '채널',
    employees: '직원',
    options: '옵션',
    product_options: '상품 옵션',
    reservation_pricing: '예약 가격',
    dynamic_pricing: '동적 가격',
    suppliers: '공급업체',
    rental_cars: '렌터카',
    rental_car_reservations: '렌터카 예약',
    chat_rooms: '채팅방',
    chat_messages: '채팅 메시지',
    chat_announcements: '채팅 공지사항',
    audit_logs: '감사 로그',
    product_details: '상품 상세정보'
  }
  return displayNames[tableName] || tableName
}
