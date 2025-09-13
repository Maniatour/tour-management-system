import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables not configured')
}

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
