import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

    // 실제 데이터베이스 스키마 (마이그레이션 파일 기반)
    const tableSchemas: Record<string, any[]> = {
      reservations: [
        { name: 'id', type: 'uuid', nullable: false, default: 'gen_random_uuid()' },
        { name: 'customer_id', type: 'text', nullable: true, default: '' },
        { name: 'product_id', type: 'text', nullable: true, default: '' },
        { name: 'tour_id', type: 'text', nullable: true, default: '' },
        { name: 'tour_date', type: 'date', nullable: false, default: '' },
        { name: 'tour_time', type: 'time', nullable: true, default: '' },
        { name: 'pickup_hotel', type: 'character varying', nullable: true, default: '' },
        { name: 'pickup_time', type: 'time', nullable: true, default: '' },
        { name: 'adults', type: 'integer', nullable: true, default: '0' },
        { name: 'child', type: 'integer', nullable: true, default: '0' },
        { name: 'infant', type: 'integer', nullable: true, default: '0' },
        { name: 'total_people', type: 'integer', nullable: false, default: '' },
        { name: 'channel_id', type: 'text', nullable: true, default: '' },
        { name: 'channel_rn', type: 'character varying', nullable: true, default: '' },
        { name: 'added_by', type: 'character varying', nullable: true, default: '' },
        { name: 'status', type: 'character varying', nullable: true, default: "'pending'" },
        { name: 'event_note', type: 'text', nullable: true, default: '' },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
        { name: 'selected_options', type: 'jsonb', nullable: true, default: "'{}'" },
        { name: 'selected_option_prices', type: 'jsonb', nullable: true, default: "'{}'" },
        { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
      ],
      tours: [
        { name: 'id', type: 'text', nullable: false, default: 'extensions.uuid_generate_v4()' },
        { name: 'product_id', type: 'text', nullable: true, default: '' },
        { name: 'tour_date', type: 'date', nullable: false, default: '' },
        { name: 'tour_guide_id', type: 'text', nullable: true, default: '' },
        { name: 'assistant_id', type: 'text', nullable: true, default: '' },
        { name: 'tour_car_id', type: 'character varying', nullable: true, default: '' },
        { name: 'tour_status', type: 'character varying', nullable: true, default: "'scheduled'" },
        { name: 'tour_start_datetime', type: 'timestamp with time zone', nullable: true, default: '' },
        { name: 'tour_end_datetime', type: 'timestamp with time zone', nullable: true, default: '' },
        { name: 'guide_fee', type: 'numeric', nullable: true, default: '0' },
        { name: 'assistant_fee', type: 'numeric', nullable: true, default: '0' },
        { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'tour_note', type: 'text', nullable: true, default: '' },
        { name: 'reservation_ids', type: 'text[]', nullable: true, default: '' },
        { name: 'team_type', type: 'text', nullable: true, default: "'1guide'" },
        { name: 'is_private_tour', type: 'boolean', nullable: true, default: 'false' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
      ],
      customers: [
        { name: 'id', type: 'text', nullable: false, default: '' },
        { name: 'name', type: 'character varying', nullable: false, default: '' },
        { name: 'email', type: 'character varying', nullable: true, default: '' },
        { name: 'phone', type: 'character varying', nullable: true, default: '' },
        { name: 'nationality', type: 'character varying', nullable: true, default: '' },
        { name: 'language', type: 'character varying', nullable: true, default: "'ko'" },
        { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
      ],
      products: [
        { name: 'id', type: 'text', nullable: false, default: '' },
        { name: 'name_ko', type: 'character varying', nullable: false, default: '' },
        { name: 'name_en', type: 'character varying', nullable: false, default: '' },
        { name: 'description', type: 'text', nullable: true, default: '' },
        { name: 'price', type: 'decimal', nullable: true, default: '' },
        { name: 'duration', type: 'integer', nullable: true, default: '' },
        { name: 'max_participants', type: 'integer', nullable: true, default: '' },
        { name: 'is_active', type: 'boolean', nullable: true, default: 'true' },
        { name: 'created_at', type: 'timestamp with time zone', nullable: true, default: 'now()' },
        { name: 'updated_at', type: 'timestamp with time zone', nullable: true, default: 'now()' }
      ]
    }

    const transformedData = tableSchemas[tableName] || []

    return NextResponse.json({
      success: true,
      data: {
        tableName,
        columns: transformedData
      }
    })

  } catch (error) {
    console.error('Get table schema error:', error)
    return NextResponse.json(
      { success: false, message: `Failed to get table schema: ${error}` },
      { status: 500 }
    )
  }
}
