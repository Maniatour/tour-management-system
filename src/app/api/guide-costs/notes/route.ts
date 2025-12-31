import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 가이드비 노트 조회
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('guide_cost_notes')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single()

    if (error) {
      // 노트가 없는 경우 빈 노트 반환
      if (error.code === 'PGRST116') {
        return NextResponse.json({ note: '' })
      }
      // 테이블이 없는 경우도 빈 노트 반환
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('guide_cost_notes 테이블이 존재하지 않습니다. 마이그레이션을 실행해주세요.')
        return NextResponse.json({ note: '' })
      }
      console.error('가이드비 노트 조회 상세 오류:', error)
      throw error
    }

    return NextResponse.json({ note: data?.note || '' })
  } catch (error: any) {
    console.error('가이드비 노트 조회 오류:', error)
    const errorMessage = error?.message || '가이드비 노트 조회 중 오류가 발생했습니다.'
    return NextResponse.json({ 
      error: errorMessage,
      details: error?.details || error?.hint || ''
    }, { status: 500 })
  }
}

// 가이드비 노트 저장
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { note } = body

    if (note === undefined) {
      return NextResponse.json({ error: '노트 내용이 필요합니다.' }, { status: 400 })
    }

    const noteId = '00000000-0000-0000-0000-000000000001'

    // 먼저 기존 노트가 있는지 확인
    const { data: existingData, error: checkError } = await supabase
      .from('guide_cost_notes')
      .select('id')
      .eq('id', noteId)
      .maybeSingle()

    let data, error

    if (checkError) {
      // 테이블이 없는 경우도 처리
      if (checkError.code === '42P01' || checkError.message?.includes('does not exist')) {
        console.error('guide_cost_notes 테이블이 존재하지 않습니다. 마이그레이션을 실행해주세요.')
        return NextResponse.json({ 
          error: '데이터베이스 테이블이 존재하지 않습니다. 마이그레이션을 실행해주세요.',
          details: checkError.message
        }, { status: 500 })
      }
      throw checkError
    }

    if (!existingData) {
      // 노트가 없으면 삽입
      const { data: insertData, error: insertError } = await supabase
        .from('guide_cost_notes')
        .insert({
          id: noteId,
          note: note || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      data = insertData
      error = insertError
    } else {
      // 노트가 있으면 업데이트
      const { data: updateData, error: updateError } = await supabase
        .from('guide_cost_notes')
        .update({
          note: note || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)
        .select()
        .single()

      data = updateData
      error = updateError
    }

    if (error) {
      console.error('가이드비 노트 저장 상세 오류:', error)
      throw error
    }

    return NextResponse.json({ note: data?.note || '' })
  } catch (error: any) {
    console.error('가이드비 노트 저장 오류:', error)
    const errorMessage = error?.message || '가이드비 노트 저장 중 오류가 발생했습니다.'
    return NextResponse.json({ 
      error: errorMessage,
      details: error?.details || error?.hint || error?.code || ''
    }, { status: 500 })
  }
}

