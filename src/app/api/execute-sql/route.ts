import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json()
    
    if (!sql) {
      return NextResponse.json(
        { success: false, message: 'SQL query is required' },
        { status: 400 }
      )
    }

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
