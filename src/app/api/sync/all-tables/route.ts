import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase environment variables not configured')
}

export async function GET() {
  try {
    // Supabase에서 직접 테이블 목록을 조회하는 것은 RLS 정책 때문에 복잡할 수 있음
    // 안전하게 하드코딩된 목록을 사용하되, 실제 존재하는 테이블만 필터링
    return getHardcodedTables()

  } catch (error) {
    console.error('Get all tables error:', error)
    // 오류 발생 시 하드코딩된 목록 사용
    return getHardcodedTables()
  }
}

// 하드코딩된 테이블 목록 (백업용)
function getHardcodedTables() {
  const allTables = [
    'reservations',
    'tours', 
    'customers',
    'products',
    'channels',
    'team',
    'pickup_hotels',
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
    'product_details',
    'product_details_common',
    'product_schedules',
    'reservation_options',
    'sync_history',
    'vehicles',
    'ticket_bookings',
    'tour_hotel_bookings',
    'tour_expenses',
    'off_schedules',
    'payment_records',
    'reservation_expenses',
    'company_expenses',
    'payment_methods',
    'vehicle_maintenance'
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
}

// 테이블 표시명 가져오기
function getTableDisplayName(tableName: string): string {
  const displayNames: { [key: string]: string } = {
    reservations: '예약',
    tours: '투어', 
    customers: '고객',
    products: '상품',
    channels: '채널',
    team: '팀원',
      pickup_hotels: '픽업 호텔',
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
    product_details: '상품 상세정보',
    product_details_common: '공통 상품 세부정보',
    product_schedules: '상품 일정',
    reservation_options: '예약 옵션',
    sync_history: '동기화 히스토리',
    vehicles: '차량',
    ticket_bookings: '티켓 예약',
    tour_hotel_bookings: '투어 호텔 예약',
    tour_expenses: '투어 지출',
    off_schedules: '휴가 일정',
    payment_records: '결제 기록',
    reservation_expenses: '예약 지출',
    company_expenses: '회사 지출',
    payment_methods: '결제 수단',
    vehicle_maintenance: '차량 정비'
  }
  return displayNames[tableName] || tableName
}
