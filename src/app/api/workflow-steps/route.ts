import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// UUID 생성 함수
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function PUT(request: NextRequest) {
  try {
    console.log('워크플로우 단계 저장 API 요청 시작')
    const stepData = await request.json()
    
    // 필수 필드 검증
    if (!stepData.id) {
      return NextResponse.json(
        {
          success: false,
          error: '단계 ID가 필요합니다.',
          message: '단계 ID를 제공해주세요.'
        },
        { status: 400 }
      )
    }
    
    if (!stepData.workflow_id) {
      return NextResponse.json(
        {
          success: false,
          error: '워크플로우 ID가 필요합니다.',
          message: '워크플로우 ID를 제공해주세요.'
        },
        { status: 400 }
      )
    }
    
    console.log('저장할 단계 데이터:', {
      id: stepData.id,
      workflow_id: stepData.workflow_id,
      step_name_ko: stepData.step_name_ko,
      step_name_en: stepData.step_name_en,
      step_type: stepData.step_type,
      rich_description_ko_length: stepData.rich_description_ko?.length || 0,
      rich_description_en_length: stepData.rich_description_en?.length || 0,
      links: stepData.links,
      images: stepData.images,
      tags: stepData.tags,
      priority: stepData.priority,
      estimated_time: stepData.estimated_time
    })
    
    // 먼저 기존 데이터 확인 (UUID 형식 검증)
    let existingData = null
    let checkError = null
    
    // UUID 형식 검증 (8-4-4-4-12 패턴)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const isValidUUID = uuidRegex.test(stepData.id)
    
    if (isValidUUID) {
      const result = await supabase
        .from('consultation_workflow_steps')
        .select('id')
        .eq('id', stepData.id)
        .single()
      
      existingData = result.data
      checkError = result.error
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('기존 데이터 확인 오류:', checkError)
        throw checkError
      }
    } else {
      console.log('UUID 형식이 아닌 ID:', stepData.id)
      // UUID 형식이 아닌 경우 새로 생성된 것으로 간주
      existingData = null
    }
    
    let result
    if (existingData) {
      // 기존 데이터 업데이트
      console.log('기존 단계 업데이트 중...')
      const { data, error } = await supabase
        .from('consultation_workflow_steps')
        .update({
          step_name_ko: stepData.step_name_ko,
          step_name_en: stepData.step_name_en,
          step_description_ko: stepData.step_description_ko,
          step_description_en: stepData.step_description_en,
          step_order: stepData.step_order,
          step_type: stepData.step_type,
          action_type: stepData.action_type,
          condition_type: stepData.condition_type,
          condition_value: stepData.condition_value,
          next_step_id: stepData.next_step_id,
          alternative_step_id: stepData.alternative_step_id,
          is_active: stepData.is_active,
          is_required: stepData.is_required,
          node_shape: stepData.node_shape,
          node_color: stepData.node_color,
          text_color: stepData.text_color,
          group_id: stepData.group_id,
          position: stepData.position,
          rich_description_ko: stepData.rich_description_ko,
          rich_description_en: stepData.rich_description_en,
          links: stepData.links,
          images: stepData.images,
          notes_ko: stepData.notes_ko,
          notes_en: stepData.notes_en,
          tags: stepData.tags,
          priority: stepData.priority,
          estimated_time: stepData.estimated_time,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepData.id)
        .select()
        .single()
      
      if (error) {
        console.error('단계 업데이트 오류:', error)
        throw error
      }
      
      result = data
      console.log('단계 업데이트 완료:', data.id)
    } else {
      // 새 데이터 생성
      console.log('새 단계 생성 중...')
      
      // UUID 형식이 아닌 경우 새 UUID 생성
      const finalId = isValidUUID ? stepData.id : generateUUID()
      
      const { data, error } = await supabase
        .from('consultation_workflow_steps')
        .insert({
          id: finalId,
          workflow_id: stepData.workflow_id,
          step_name_ko: stepData.step_name_ko,
          step_name_en: stepData.step_name_en,
          step_description_ko: stepData.step_description_ko,
          step_description_en: stepData.step_description_en,
          step_order: stepData.step_order,
          step_type: stepData.step_type,
          action_type: stepData.action_type,
          condition_type: stepData.condition_type,
          condition_value: stepData.condition_value,
          next_step_id: stepData.next_step_id,
          alternative_step_id: stepData.alternative_step_id,
          is_active: stepData.is_active,
          is_required: stepData.is_required,
          node_shape: stepData.node_shape,
          node_color: stepData.node_color,
          text_color: stepData.text_color,
          group_id: stepData.group_id,
          position: stepData.position,
          rich_description_ko: stepData.rich_description_ko,
          rich_description_en: stepData.rich_description_en,
          links: stepData.links,
          images: stepData.images,
          notes_ko: stepData.notes_ko,
          notes_en: stepData.notes_en,
          tags: stepData.tags,
          priority: stepData.priority,
          estimated_time: stepData.estimated_time,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        console.error('단계 생성 오류:', error)
        throw error
      }
      
      result = data
      console.log('단계 생성 완료:', data.id)
    }
    
    return NextResponse.json({
      success: true,
      data: result,
      message: '워크플로우 단계가 성공적으로 저장되었습니다.'
    })
    
  } catch (error) {
    console.error('워크플로우 단계 저장 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        message: '워크플로우 단계 저장에 실패했습니다.'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('워크플로우 단계 조회 API 요청 시작')
    
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflow_id')
    
    let query = supabase
      .from('consultation_workflow_steps')
      .select('*')
      .order('step_order', { ascending: true })
    
    if (workflowId) {
      query = query.eq('workflow_id', workflowId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('워크플로우 단계 조회 오류:', error)
      throw error
    }
    
    console.log(`워크플로우 단계 ${data?.length || 0}개 조회 완료`)
    
    return NextResponse.json({
      success: true,
      data: data || [],
      message: '워크플로우 단계를 성공적으로 조회했습니다.'
    })
    
  } catch (error) {
    console.error('워크플로우 단계 조회 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        message: '워크플로우 단계 조회에 실패했습니다.'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('워크플로우 단계 삭제 API 요청 시작')
    const { id } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: '단계 ID가 필요합니다.',
          message: '삭제할 단계 ID를 제공해주세요.'
        },
        { status: 400 }
      )
    }
    
    const { error } = await supabase
      .from('consultation_workflow_steps')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('워크플로우 단계 삭제 오류:', error)
      throw error
    }
    
    console.log('워크플로우 단계 삭제 완료:', id)
    
    return NextResponse.json({
      success: true,
      message: '워크플로우 단계가 성공적으로 삭제되었습니다.'
    })
    
  } catch (error) {
    console.error('워크플로우 단계 삭제 오류:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        message: '워크플로우 단계 삭제에 실패했습니다.'
      },
      { status: 500 }
    )
  }
}
