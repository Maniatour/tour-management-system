import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 값의 타입을 추론하는 함수
function getColumnType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'text' // null 값은 타입을 알 수 없으므로 기본값
  }
  
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'numeric'
  }
  
  if (typeof value === 'string') {
    // 날짜 형식 체크
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'date'
    }
    
    // 시간 형식 체크
    if (/^\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'time'
    }
    
    // 타임스탬프 형식 체크
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'timestamp'
    }
    
    // UUID 형식 체크
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return 'uuid'
    }
    
    return 'text'
  }
  
  if (Array.isArray(value)) {
    return 'array'
  }
  
  if (typeof value === 'object') {
    return 'jsonb'
  }
  
  return 'text' // 기본값
}

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

    // 환경 변수에서 Supabase 설정 가져오기
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables not configured')
      throw new Error('Supabase configuration missing')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Supabase RPC 함수를 사용하여 테이블 스키마 조회
    // 먼저 테이블이 존재하는지 확인
    const { error: tableCheckError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)

    if (tableCheckError) {
      console.error('Table does not exist or access denied:', tableCheckError)
      throw new Error(`Table '${tableName}' does not exist or access denied`)
    }

    // 테이블이 존재하면 샘플 데이터를 가져와서 컬럼 정보 추출
    const { data: sampleData, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)

    if (sampleError) {
      console.error('Error getting sample data:', sampleError)
      throw new Error(`Error accessing table '${tableName}': ${sampleError.message}`)
    }

    // 샘플 데이터에서 컬럼 정보 추출
    if (!sampleData || sampleData.length === 0) {
      // 빈 테이블인 경우 폴백 사용
      const fallbackColumns = getFallbackColumns(tableName)
      return NextResponse.json({
        success: true,
        data: {
          tableName,
          columns: fallbackColumns,
          source: 'fallback_empty_table'
        }
      })
    }

    // 첫 번째 행에서 컬럼 정보 추출
    const firstRow = sampleData[0]
    const columns = Object.keys(firstRow).map(columnName => ({
      name: columnName,
      type: getColumnType(firstRow[columnName]),
      nullable: firstRow[columnName] === null,
      default: null // 타입만으로는 기본값을 알 수 없음
    }))

    console.log(`Successfully retrieved ${columns.length} columns for table ${tableName} from sample data`)

    return NextResponse.json({
      success: true,
      data: {
        tableName,
        columns: columns,
        source: 'sample_data'
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
interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

function getFallbackColumns(tableName: string): ColumnInfo[] {
  const fallbackColumns: Record<string, ColumnInfo[]> = {
    pickup_hotels: [
      { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
      { name: 'hotel', type: 'character varying', nullable: false, default: null },
      { name: 'pick_up_location', type: 'character varying', nullable: false, default: null },
      { name: 'address', type: 'text', nullable: true, default: null },
      { name: 'pin', type: 'character varying', nullable: true, default: null },
      { name: 'link', type: 'character varying', nullable: true, default: null },
      { name: 'media', type: 'text[]', nullable: true, default: null },
      { name: 'description_ko', type: 'text', nullable: true, default: null },
      { name: 'description_en', type: 'text', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
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
      { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
      { name: 'tour_id', type: 'text', nullable: true, default: null },
      { name: 'event_date', type: 'date', nullable: false, default: null },
      { name: 'submit_on', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'check_in_date', type: 'date', nullable: false, default: null },
      { name: 'check_out_date', type: 'date', nullable: false, default: null },
      { name: 'reservation_name', type: 'character varying', nullable: false, default: null },
      { name: 'submitted_by', type: 'character varying', nullable: true, default: null },
      { name: 'cc', type: 'character varying', nullable: true, default: null },
      { name: 'rooms', type: 'integer', nullable: false, default: '1' },
      { name: 'city', type: 'character varying', nullable: false, default: null },
      { name: 'hotel', type: 'character varying', nullable: false, default: null },
      { name: 'room_type', type: 'character varying', nullable: true, default: null },
      { name: 'unit_price', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'total_price', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'payment_method', type: 'character varying', nullable: true, default: null },
      { name: 'website', type: 'character varying', nullable: true, default: null },
      { name: 'rn_number', type: 'character varying', nullable: true, default: null },
      { name: 'status', type: 'character varying', nullable: true, default: "'pending'" },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    vehicles: [
      { name: 'id', type: 'text', nullable: false, default: null },
      { name: 'vehicle_number', type: 'text', nullable: true, default: null },
      { name: 'vin', type: 'text', nullable: true, default: null },
      { name: 'vehicle_type', type: 'text', nullable: true, default: null },
      { name: 'capacity', type: 'integer', nullable: true, default: null },
      { name: 'year', type: 'integer', nullable: true, default: null },
      { name: 'mileage_at_purchase', type: 'integer', nullable: true, default: null },
      { name: 'purchase_amount', type: 'numeric', nullable: true, default: null },
      { name: 'purchase_date', type: 'date', nullable: true, default: null },
      { name: 'memo', type: 'text', nullable: true, default: null },
      { name: 'engine_oil_change_cycle', type: 'integer', nullable: true, default: null },
      { name: 'current_mileage', type: 'integer', nullable: true, default: null },
      { name: 'recent_engine_oil_change_mileage', type: 'integer', nullable: true, default: null },
      { name: 'vehicle_status', type: 'text', nullable: true, default: null },
      { name: 'front_tire_size', type: 'text', nullable: true, default: null },
      { name: 'rear_tire_size', type: 'text', nullable: true, default: null },
      { name: 'windshield_wiper_size', type: 'text', nullable: true, default: null },
      { name: 'headlight_model', type: 'text', nullable: true, default: null },
      { name: 'headlight_model_name', type: 'text', nullable: true, default: null },
      { name: 'is_installment', type: 'boolean', nullable: true, default: 'false' },
      { name: 'installment_amount', type: 'numeric', nullable: true, default: null },
      { name: 'interest_rate', type: 'numeric', nullable: true, default: null },
      { name: 'monthly_payment', type: 'numeric', nullable: true, default: null },
      { name: 'additional_payment', type: 'numeric', nullable: true, default: null },
      { name: 'payment_due_date', type: 'date', nullable: true, default: null },
      { name: 'installment_start_date', type: 'date', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp', nullable: false, default: 'now()' },
      { name: 'updated_at', type: 'timestamp', nullable: false, default: 'now()' }
    ],
    tour_expenses: [
      { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
      { name: 'tour_id', type: 'text', nullable: false, default: null },
      { name: 'submit_on', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'paid_to', type: 'character varying', nullable: true, default: null },
      { name: 'paid_for', type: 'text', nullable: false, default: null },
      { name: 'amount', type: 'numeric', nullable: false, default: null },
      { name: 'payment_method', type: 'character varying', nullable: true, default: null },
      { name: 'note', type: 'text', nullable: true, default: null },
      { name: 'tour_date', type: 'date', nullable: false, default: null },
      { name: 'product_id', type: 'text', nullable: true, default: null },
      { name: 'submitted_by', type: 'character varying', nullable: false, default: null },
      { name: 'image_url', type: 'text', nullable: true, default: null },
      { name: 'file_path', type: 'text', nullable: true, default: null },
      { name: 'audited_by', type: 'character varying', nullable: true, default: null },
      { name: 'checked_by', type: 'character varying', nullable: true, default: null },
      { name: 'checked_on', type: 'timestamp with time zone', nullable: true, default: null },
      { name: 'status', type: 'character varying', nullable: true, default: "'pending'" },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    team: [
      { name: 'email', type: 'character varying', nullable: false, default: null },
      { name: 'name_ko', type: 'character varying', nullable: false, default: null },
      { name: 'name_en', type: 'character varying', nullable: true, default: null },
      { name: 'phone', type: 'character varying', nullable: false, default: null },
      { name: 'position', type: 'character varying', nullable: true, default: null },
      { name: 'languages', type: 'text[]', nullable: true, default: "'{}'" },
      { name: 'avatar_url', type: 'text', nullable: true, default: null },
      { name: 'is_active', type: 'boolean', nullable: true, default: 'true' },
      { name: 'hire_date', type: 'date', nullable: true, default: null },
      { name: 'status', type: 'character varying', nullable: true, default: "'active'" },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'emergency_contact', type: 'character varying', nullable: true, default: null },
      { name: 'date_of_birth', type: 'date', nullable: true, default: null },
      { name: 'ssn', type: 'character varying', nullable: true, default: null },
      { name: 'personal_car_model', type: 'character varying', nullable: true, default: null },
      { name: 'car_year', type: 'integer', nullable: true, default: null },
      { name: 'car_plate', type: 'character varying', nullable: true, default: null },
      { name: 'bank_name', type: 'character varying', nullable: true, default: null },
      { name: 'account_holder', type: 'character varying', nullable: true, default: null },
      { name: 'bank_number', type: 'character varying', nullable: true, default: null },
      { name: 'routing_number', type: 'character varying', nullable: true, default: null },
      { name: 'cpr', type: 'boolean', nullable: true, default: 'false' },
      { name: 'cpr_acquired', type: 'date', nullable: true, default: null },
      { name: 'cpr_expired', type: 'date', nullable: true, default: null },
      { name: 'medical_report', type: 'boolean', nullable: true, default: 'false' },
      { name: 'medical_acquired', type: 'date', nullable: true, default: null },
      { name: 'medical_expired', type: 'date', nullable: true, default: null },
      { name: 'address', type: 'text', nullable: true, default: null }
    ],
    reservation_pricing: [
      { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
      { name: 'reservation_id', type: 'text', nullable: false, default: null },
      { name: 'adult_product_price', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'child_product_price', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'infant_product_price', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'product_price_total', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'required_options', type: 'jsonb', nullable: true, default: "'{}'" },
      { name: 'required_option_total', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'choices', type: 'jsonb', nullable: true, default: "'{}'" },
      { name: 'choices_total', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'subtotal', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'coupon_code', type: 'text', nullable: true, default: null },
      { name: 'coupon_discount', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'additional_discount', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'additional_cost', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'card_fee', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'tax', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'prepayment_cost', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'prepayment_tip', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'selected_options', type: 'jsonb', nullable: true, default: "'{}'" },
      { name: 'option_total', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
      { name: 'private_tour_additional_cost', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'total_price', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'deposit_amount', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'balance_amount', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'commission_percent', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'commission_amount', type: 'numeric', nullable: true, default: '0.00' },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    off_schedules: [
      { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
      { name: 'team_email', type: 'character varying(255)', nullable: false, default: null },
      { name: 'off_date', type: 'date', nullable: false, default: null },
      { name: 'reason', type: 'text', nullable: false, default: null },
      { name: 'status', type: 'text', nullable: false, default: "'pending'" },
      { name: 'approved_by', type: 'character varying(255)', nullable: true, default: null },
      { name: 'approved_at', type: 'timestamp with time zone', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    payment_records: [
      { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()' },
      { name: 'reservation_id', type: 'text', nullable: false, default: null },
      { name: 'payment_status', type: 'character varying(50)', nullable: false, default: "'pending'" },
      { name: 'amount', type: 'numeric(10, 2)', nullable: false, default: null },
      { name: 'payment_method', type: 'character varying(50)', nullable: false, default: null },
      { name: 'note', type: 'text', nullable: true, default: null },
      { name: 'image_file_url', type: 'text', nullable: true, default: null },
      { name: 'submit_on', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'submit_by', type: 'character varying(255)', nullable: true, default: null },
      { name: 'confirmed_on', type: 'timestamp with time zone', nullable: true, default: null },
      { name: 'confirmed_by', type: 'character varying(255)', nullable: true, default: null },
      { name: 'amount_krw', type: 'numeric(10, 2)', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ],
    reservation_options: [
      { name: 'id', type: 'text', nullable: false, default: 'gen_random_uuid()::text' },
      { name: 'reservation_id', type: 'text', nullable: false, default: null },
      { name: 'option_id', type: 'text', nullable: false, default: null },
      { name: 'ea', type: 'integer', nullable: false, default: '1' },
      { name: 'price', type: 'numeric(10, 2)', nullable: false, default: '0' },
      { name: 'total_price', type: 'numeric(10, 2)', nullable: false, default: '0' },
      { name: 'status', type: 'text', nullable: true, default: "'active'" },
      { name: 'note', type: 'text', nullable: true, default: null },
      { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
      { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
    ]
  }
  
  return fallbackColumns[tableName] || []
}