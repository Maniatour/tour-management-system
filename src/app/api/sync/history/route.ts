import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

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

    const supabase = await createServerSupabase()

    // 마지막 동기화 시간 조회
    const { data: history, error } = await supabase
      .from('sync_history')
      .select('last_sync_time')
      .eq('table_name', tableName)
      .eq('spreadsheet_id', spreadsheetId)
      .order('last_sync_time', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116은 "no rows found" 에러
      console.error('Error fetching sync history:', error)
      return NextResponse.json({ 
        success: false, 
        message: '동기화 히스토리 조회 실패',
        error: error.message 
      })
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

    const supabase = await createServerSupabase()

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
