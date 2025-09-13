import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase environment variables not configured')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 먼저 테이블이 존재하는지 확인
    const { data: existingTable, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'product_schedules')
      .eq('table_schema', 'public')

    if (checkError) {
      console.error('테이블 확인 오류:', checkError)
    }

    if (existingTable && existingTable.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'product_schedules 테이블이 이미 존재합니다.',
        exists: true
      })
    }

    // 테이블이 존재하지 않으면 생성 시도
    // Supabase에서는 직접 DDL을 실행할 수 없으므로, 
    // 대신 테이블 생성이 필요한 경우를 알려주는 응답을 반환
    return NextResponse.json({
      success: false,
      message: 'product_schedules 테이블이 존재하지 않습니다. Supabase 대시보드에서 직접 생성해주세요.',
      exists: false,
      sql: `
        CREATE TABLE IF NOT EXISTS product_schedules (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          day_number INTEGER NOT NULL,
          start_time TIME,
          end_time TIME,
          title TEXT NOT NULL,
          description TEXT,
          location TEXT,
          duration_minutes INTEGER,
          is_break BOOLEAN DEFAULT false,
          is_meal BOOLEAN DEFAULT false,
          is_transport BOOLEAN DEFAULT false,
          transport_type TEXT,
          transport_details TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_product_schedules_product_id ON product_schedules(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_schedules_day_number ON product_schedules(product_id, day_number);

        ALTER TABLE product_schedules ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Anyone can view product schedules" ON product_schedules
          FOR SELECT USING (true);

        CREATE POLICY "Authenticated users can insert product schedules" ON product_schedules
          FOR INSERT WITH CHECK (auth.role() = 'authenticated');

        CREATE POLICY "Authenticated users can update product schedules" ON product_schedules
          FOR UPDATE USING (auth.role() = 'authenticated');

        CREATE POLICY "Authenticated users can delete product schedules" ON product_schedules
          FOR DELETE USING (auth.role() = 'authenticated');
      `
    })

  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
