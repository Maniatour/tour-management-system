import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase environment variables not configured')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get('table')
    const spreadsheetId = searchParams.get('spreadsheetId')

    if (!tableName || !spreadsheetId) {
      return NextResponse.json({ 
        success: false, 
        message: 'table과 spreadsheetId가 필요합니다.' 
      })
    }

    // 타입 단언: 위에서 이미 체크했으므로 undefined가 아님
    const supabase = createClient(supabaseUrl as string, supabaseServiceKey as string)

    // 마지막 동기화 시간 조회
    const { data: history, error } = await supabase
      .from('sync_history')
      .select('last_sync_time')
      .eq('table_name', tableName)
      .eq('spreadsheet_id', spreadsheetId)
      .order('last_sync_time', { ascending: false })
      .limit(1)
      .single()

    // PGRST116은 "no rows found" 에러, PGRST205는 "table not found" 에러
    // 테이블이 없어도 동기화는 계속 진행할 수 있도록 조용히 처리
    if (error && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
      console.error('Error fetching sync history:', error)
      // 테이블이 없는 경우는 경고만 출력하고 계속 진행
      if (error.code === 'PGRST205') {
        console.warn('sync_history 테이블이 없습니다. 동기화는 계속 진행됩니다.')
      } else {
        return NextResponse.json({ 
          success: false, 
          message: '동기화 히스토리 조회 실패',
          error: error.message 
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        lastSyncTime: history?.last_sync_time || null
      }
    })

  } catch (error) {
    console.error('Error in sync history API:', error)
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tableName, spreadsheetId, lastSyncTime, recordCount } = body

    if (!tableName || !spreadsheetId || !lastSyncTime) {
      return NextResponse.json({ 
        success: false, 
        message: '필수 필드가 누락되었습니다.' 
      })
    }

    // 타입 단언: 위에서 이미 체크했으므로 undefined가 아님
    const supabase = createClient(supabaseUrl as string, supabaseServiceKey as string)

    // 동기화 히스토리 저장
    const { data, error } = await supabase
      .from('sync_history')
      .insert({
        table_name: tableName,
        spreadsheet_id: spreadsheetId,
        last_sync_time: lastSyncTime,
        record_count: recordCount || 0
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving sync history:', error)
      return NextResponse.json({ 
        success: false, 
        message: '동기화 히스토리 저장 실패',
        error: error.message 
      })
    }

    return NextResponse.json({
      success: true,
      data: data
    })

  } catch (error) {
    console.error('Error in sync history POST API:', error)
    return NextResponse.json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
