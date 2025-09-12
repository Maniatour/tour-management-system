import { supabase } from '@/lib/supabase'

export async function testProductSchedulesTable() {
  try {
    // 테이블 존재 여부 확인
    const { data, error } = await (supabase as any)
      .from('product_schedules')
      .select('*')
      .limit(1)

    if (error) {
      console.error('product_schedules 테이블 오류:', error)
      return { exists: false, error: error.message }
    }

    console.log('product_schedules 테이블이 존재합니다.')
    return { exists: true, data }
  } catch (error) {
    console.error('테이블 확인 중 오류:', error)
    return { exists: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
  }
}

export async function createProductSchedulesTable() {
  try {
    // 테이블 생성 SQL 실행
    const { data, error } = await (supabase as any)
      .rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS product_schedules (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            product_id TEXT NOT NULL,
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
        `
      })

    if (error) {
      console.error('테이블 생성 오류:', error)
      return { success: false, error: error.message }
    }

    console.log('product_schedules 테이블이 생성되었습니다.')
    return { success: true, data }
  } catch (error) {
    console.error('테이블 생성 중 오류:', error)
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' }
  }
}
