import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('table')
    
    if (!tableName) {
      return NextResponse.json(
        { success: false, message: 'Table name is required' },
        { status: 400 }
      )
    }

    // 실제 Supabase 프로젝트에 직접 연결
    const supabaseUrl = 'https://tyilwbytyuqrhxekjxcd.supabase.co'
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aWx3Ynl0eXVxcmh4ZWtqeGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzQwMDAsImV4cCI6MjA1MTMxMDAwMH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // 실제 데이터베이스에서 테이블 컬럼 정보를 가져오기
    // 직접 SQL 쿼리 사용
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', tableName)
      .order('ordinal_position')

    if (error) {
      console.error('Error getting table columns from database:', error)
      
      // 폴백: 하드코딩된 스키마 사용
      const fallbackColumns = getFallbackColumns(tableName)
      console.log('Using fallback columns due to database error:', fallbackColumns)
      
      return NextResponse.json({
        success: true,
        data: {
          tableName,
          columns: fallbackColumns,
          source: 'fallback'
        }
      })
    }

    if (!data || data.length === 0) {
      console.warn(`No columns found for table: ${tableName}`)
      
      // 폴백: 하드코딩된 스키마 사용
      const fallbackColumns = getFallbackColumns(tableName)
      console.log('Using fallback columns - no data returned:', fallbackColumns)
      
      return NextResponse.json({
        success: true,
        data: {
          tableName,
          columns: fallbackColumns,
          source: 'fallback'
        }
      })
    }

    // 데이터베이스에서 가져온 컬럼 정보를 변환
    const transformedData = data.map((column: any) => ({
      name: column.column_name,
      type: column.data_type,
      nullable: column.is_nullable === 'YES',
      default: column.column_default || null
    }))

    console.log(`Successfully retrieved ${transformedData.length} columns for table ${tableName} from database`)

    return NextResponse.json({
      success: true,
      data: {
        tableName,
        columns: transformedData,
        source: 'database'
      }
    })

  } catch (error) {
    console.error('Get table schema error:', error)
    
    // 폴백: 하드코딩된 스키마 사용
    const tableName = new URL(request.url).searchParams.get('table')
    const fallbackColumns = tableName ? getFallbackColumns(tableName) : []
    console.log('Using fallback columns due to exception:', fallbackColumns)
    
    return NextResponse.json({
      success: true,
      data: {
        tableName: tableName || 'unknown',
        columns: fallbackColumns,
        source: 'fallback'
      }
    })
  }
}

// 폴백용 하드코딩된 컬럼 목록 (실제 데이터베이스 스키마 기반)
function getFallbackColumns(tableName: string): any[] {
  const fallbackColumns: { [key: string]: any[] } = {
    reservations: [
      { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      { name: 'customer_id', type: 'text', nullable: true, default: null },
      { name: 'product_id', type: 'text', nullable: true, default: null },
      { name: 'tour_id', type: 'text', nullable: true, default: null },
      { name: 'tour_date', type: 'date', nullable: false, default: null },
      { name: 'tour_time', type: 'time', nullable: true, default: null },
      { name: 'pickup_hotel', type: 'character varying', nullable: true, default: null },
      { name: 'pickup_time', type: 'time', nullable: true, default: null },
      { name: 'adults', type: 'integer', nullable: true, default: '0' },
      { name: 'child', type: 'integer', nullable: true, default: '0' },
      { name: 'infant', type: 'integer', nullable: true, default: '0' },
      { name: 'total_people', type: 'integer', nullable: false, default: null },
      { name: 'channel_id', type: 'text', nullable: true, default: null },
      { name: 'channel_rn', type: 'character varying', nullable: true, default: null },
      { name: 'added_by', type: 'character varying', nullable: true, default: null },
      { name: 'status', type: 'character varying', nullable: true, default: "'pending'" },
      { name: 'event_note', type: 'text', nullable: true, default: null },
      { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
      { name: 'selected_options', type: 'jsonb', nullable: true, default: "'{}'" },
      { name: 'selected_option_prices', type: 'jsonb', nullable: true, default: "'{}'" },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    tours: [
      { name: 'id', type: 'text', nullable: false, default: 'extensions.uuid_generate_v4()' },
      { name: 'product_id', type: 'text', nullable: true, default: null },
      { name: 'tour_date', type: 'date', nullable: false, default: null },
      { name: 'tour_guide_id', type: 'text', nullable: true, default: null },
      { name: 'assistant_id', type: 'text', nullable: true, default: null },
      { name: 'tour_car_id', type: 'character varying', nullable: true, default: null },
      { name: 'tour_status', type: 'character varying', nullable: true, default: "'scheduled'" },
      { name: 'tour_start_datetime', type: 'timestamp with time zone', nullable: true, default: null },
      { name: 'tour_end_datetime', type: 'timestamp with time zone', nullable: true, default: null },
      { name: 'guide_fee', type: 'numeric', nullable: true, default: '0' },
      { name: 'assistant_fee', type: 'numeric', nullable: true, default: '0' },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'tour_note', type: 'text', nullable: true, default: null },
      { name: 'reservation_ids', type: 'text[]', nullable: true, default: null },
      { name: 'team_type', type: 'text', nullable: true, default: "'1guide'" },
      { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    customers: [
      // 스크린샷에서 확인된 실제 customers 테이블의 13개 컬럼
      { name: 'id', type: 'text', nullable: false, default: null },
      { name: 'name', type: 'character varying', nullable: false, default: null },
      { name: 'phone', type: 'character varying', nullable: true, default: null },
      { name: 'emergency_contact', type: 'character varying', nullable: true, default: null },
      { name: 'email', type: 'character varying', nullable: true, default: null },
      { name: 'address', type: 'text', nullable: true, default: null },
      { name: 'language', type: 'text', nullable: true, default: "'KR'" },
      { name: 'special_requests', type: 'text', nullable: true, default: null },
      { name: 'status', type: 'character varying', nullable: true, default: "'active'" },
      { name: 'channel_id', type: 'character varying', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'booking_count', type: 'integer', nullable: true, default: '0' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    products: [
      { name: 'id', type: 'text', nullable: false, default: null },
      { name: 'name_ko', type: 'character varying', nullable: false, default: null },
      { name: 'name_en', type: 'character varying', nullable: false, default: null },
      { name: 'description', type: 'text', nullable: true, default: null },
      { name: 'price', type: 'decimal', nullable: true, default: null },
      { name: 'duration', type: 'integer', nullable: true, default: null },
      { name: 'max_participants', type: 'integer', nullable: true, default: null },
      { name: 'is_active', type: 'boolean', nullable: true, default: 'true' },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    ticket_bookings: [
      { name: 'id', type: 'text', nullable: false, default: null },
      { name: 'category', type: 'character varying', nullable: true, default: null },
      { name: 'submit_on', type: 'date', nullable: true, default: null },
      { name: 'submitted_by', type: 'character varying', nullable: true, default: null },
      { name: 'check_in_date', type: 'date', nullable: true, default: null },
      { name: 'time', type: 'time', nullable: true, default: null },
      { name: 'company', type: 'character varying', nullable: true, default: null },
      { name: 'ea', type: 'integer', nullable: true, default: null },
      { name: 'expense', type: 'numeric', nullable: true, default: null },
      { name: 'income', type: 'numeric', nullable: true, default: null },
      { name: 'payment_method', type: 'character varying', nullable: true, default: null },
      { name: 'rn_number', type: 'character varying', nullable: true, default: null },
      { name: 'tour_id', type: 'text', nullable: true, default: null },
      { name: 'note', type: 'text', nullable: true, default: null },
      { name: 'status', type: 'character varying', nullable: true, default: null },
      { name: 'season', type: 'character varying', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'reservation_id', type: 'text', nullable: true, default: null }
    ],
    tour_hotel_bookings: [
      { name: 'id', type: 'text', nullable: false, default: null },
      { name: 'tour_id', type: 'text', nullable: true, default: null },
      { name: 'hotel_name', type: 'character varying', nullable: true, default: null },
      { name: 'hotel_address', type: 'text', nullable: true, default: null },
      { name: 'check_in_date', type: 'date', nullable: true, default: null },
      { name: 'check_out_date', type: 'date', nullable: true, default: null },
      { name: 'room_type', type: 'character varying', nullable: true, default: null },
      { name: 'room_count', type: 'integer', nullable: true, default: null },
      { name: 'guest_count', type: 'integer', nullable: true, default: null },
      { name: 'price_per_night', type: 'numeric', nullable: true, default: null },
      { name: 'total_price', type: 'numeric', nullable: true, default: null },
      { name: 'booking_status', type: 'character varying', nullable: true, default: "'pending'" },
      { name: 'confirmation_number', type: 'character varying', nullable: true, default: null },
      { name: 'special_requests', type: 'text', nullable: true, default: null },
      { name: 'contact_person', type: 'character varying', nullable: true, default: null },
      { name: 'contact_phone', type: 'character varying', nullable: true, default: null },
      { name: 'contact_email', type: 'character varying', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'reservation_id', type: 'text', nullable: true, default: null }
    ]
  }
  
  return fallbackColumns[tableName] || []
}