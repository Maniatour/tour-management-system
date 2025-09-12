import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tyilwbytyuqrhxekjxcd.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aWx3Ynl0eXVxcmh4ZWtqeGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTczNDAwMCwiZXhwIjoyMDUxMzEwMDAwfQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json()
    
    if (!sql) {
      return NextResponse.json(
        { success: false, message: 'SQL query is required' },
        { status: 400 }
      )
    }

    // Service role key를 사용한 Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // SQL 실행
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('SQL 실행 오류:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'SQL executed successfully'
    })

  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
