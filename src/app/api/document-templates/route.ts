import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    console.log('API POST 요청 시작')
    const { template_key, language, name, subject, content } = await request.json()
    
    console.log('요청 데이터:', {
      template_key,
      language,
      name,
      subject: subject?.substring(0, 50) + '...',
      content_length: content?.length || 0
    })
    
    // 먼저 기존 데이터 확인
    console.log('기존 데이터 확인 중...')
    const { data: existingData, error: checkError } = await supabase
      .from('document_templates')
      .select('id')
      .eq('template_key', template_key)
      .eq('language', language)
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('기존 데이터 확인 오류:', checkError)
      return NextResponse.json({ error: `데이터 확인 실패: ${checkError.message}` }, { status: 500 })
    }
    
    console.log('기존 데이터 존재 여부:', !!existingData)
    
    let result
    if (existingData) {
      // 업데이트
      console.log('템플릿 업데이트 중...')
      result = await supabase
        .from('document_templates')
        .update({ 
          name, 
          subject, 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('template_key', template_key)
        .eq('language', language)
    } else {
      // 새로 삽입
      console.log('새 템플릿 삽입 중...')
      const newId = randomUUID()
      console.log('생성된 UUID:', newId)
      
      result = await supabase
        .from('document_templates')
        .insert({ 
          id: newId,
          template_key, 
          language, 
          name, 
          subject, 
          content,
          format: 'html',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
    }
    
    const { error, data } = result
    
    if (error) {
      console.error('Supabase 오류:', error)
      return NextResponse.json({ 
        error: error.message,
        details: error,
        code: error.code 
      }, { status: 500 })
    }
    
    console.log('템플릿 저장 성공:', data)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .order('template_key', { ascending: true })
    
    if (error) {
      console.error('템플릿 조회 오류:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ templates: data })
  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
