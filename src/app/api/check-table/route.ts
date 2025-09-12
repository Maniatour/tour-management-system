import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tyilwbytyuqrhxekjxcd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5aWx3Ynl0eXVxcmh4ZWtqeGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3MzQwMDAsImV4cCI6MjA1MTMxMDAwMH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // product_schedules 테이블에 간단한 쿼리 시도
    const { data, error } = await supabase
      .from('product_schedules')
      .select('*')
      .limit(1)

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "product_schedules" does not exist')) {
        return NextResponse.json({
          success: false,
          exists: false,
          message: 'product_schedules 테이블이 존재하지 않습니다.',
          error: error.message
        })
      } else {
        return NextResponse.json({
          success: false,
          exists: false,
          message: '테이블 확인 중 오류가 발생했습니다.',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      exists: true,
      message: 'product_schedules 테이블이 존재합니다.',
      data: data
    })

  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
