import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    // 환경 변수에서 Supabase 설정 가져오기
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    // 이 엔드포인트는 데이터 정리/수정 작업이므로 Service Role Key가 필수입니다.
    // (Anon key로는 RLS 때문에 product_choices/choice_options를 제대로 읽거나 쓰지 못해 400이 발생할 수 있음)
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables not configured')
      return NextResponse.json(
        {
          success: false,
          message:
            'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting reservation data cleanup...')

    // 1. 먼저 현재 상태 확인
    const { data: currentStatus, error: statusError } = await supabase
      .from('reservations')
      .select('product_id, id')
      .in('product_id', ['MDGCSUNRISE', 'MDGCSUNRISE_X', 'MDGC1D', 'MDGC1D_X'])

    if (statusError) {
      console.error('Error checking current status:', statusError)
      return NextResponse.json(
        { success: false, message: `Error checking current status: ${statusError.message}` },
        { status: 500 }
      )
    }

    console.log('Current reservations status:', currentStatus?.length || 0, 'records found')

    // 2. choices 컬럼이 없으면 추가 (안전한 방법)
    try {
      const { error: addColumnError } = await supabase
        .from('reservations')
        .select('choices')
        .limit(1)
      
      if (addColumnError && addColumnError.code === 'PGRST116') {
        console.warn('Choices column does not exist in reservations table. Please add it manually.')
      } else {
        console.log('Choices column exists in reservations table')
      }
    } catch (error) {
      console.warn('Warning: Could not check choices column:', error)
    }

    // 3. product_id 통일하기 전에 _X였던 레코드들의 ID를 저장 (페이지네이션으로 전체 데이터 처리)
    const mdgcSunriseXIds: string[] = []
    const mdgc1DXIds: string[] = []
    
    // MDGCSUNRISE_X 레코드 전체 조회 (페이지네이션)
    let mdgcSunriseXFrom = 0
    const mdgcSunriseXPageSize = 1000
    let hasMoreMdgcSunriseX = true
    
    while (hasMoreMdgcSunriseX) {
      const { data: mdgcSunriseXRecords, error: mdgcSunriseXError } = await supabase
        .from('reservations')
        .select('id')
        .eq('product_id', 'MDGCSUNRISE_X')
        .range(mdgcSunriseXFrom, mdgcSunriseXFrom + mdgcSunriseXPageSize - 1)
      
      if (mdgcSunriseXError) {
        console.error('Error fetching MDGCSUNRISE_X records:', mdgcSunriseXError)
        break
      }
      
      if (mdgcSunriseXRecords && mdgcSunriseXRecords.length > 0) {
        mdgcSunriseXIds.push(...mdgcSunriseXRecords.map(r => r.id))
        mdgcSunriseXFrom += mdgcSunriseXPageSize
        hasMoreMdgcSunriseX = mdgcSunriseXRecords.length >= mdgcSunriseXPageSize
      } else {
        hasMoreMdgcSunriseX = false
      }
    }
    
    // MDGC1D_X 레코드 전체 조회 (페이지네이션)
    let mdgc1DXFrom = 0
    const mdgc1DXPageSize = 1000
    let hasMoreMdgc1DX = true
    
    while (hasMoreMdgc1DX) {
      const { data: mdgc1DXRecords, error: mdgc1DXError } = await supabase
        .from('reservations')
        .select('id')
        .eq('product_id', 'MDGC1D_X')
        .range(mdgc1DXFrom, mdgc1DXFrom + mdgc1DXPageSize - 1)
      
      if (mdgc1DXError) {
        console.error('Error fetching MDGC1D_X records:', mdgc1DXError)
        break
      }
      
      if (mdgc1DXRecords && mdgc1DXRecords.length > 0) {
        mdgc1DXIds.push(...mdgc1DXRecords.map(r => r.id))
        mdgc1DXFrom += mdgc1DXPageSize
        hasMoreMdgc1DX = mdgc1DXRecords.length >= mdgc1DXPageSize
      } else {
        hasMoreMdgc1DX = false
      }
    }

    console.log(`Found ${mdgcSunriseXIds.length} MDGCSUNRISE_X records`)
    console.log(`Found ${mdgc1DXIds.length} MDGC1D_X records`)

    // MDGCSUNRISE_X를 MDGCSUNRISE로 통일
    const { error: update1Error } = await supabase
      .from('reservations')
      .update({ product_id: 'MDGCSUNRISE' })
      .eq('product_id', 'MDGCSUNRISE_X')

    if (update1Error) {
      console.error('Error updating MDGCSUNRISE_X:', update1Error)
    } else {
      console.log('Updated MDGCSUNRISE_X to MDGCSUNRISE')
    }

    // MDGC1D_X를 MDGC1D로 통일
    const { error: update2Error } = await supabase
      .from('reservations')
      .update({ product_id: 'MDGC1D' })
      .eq('product_id', 'MDGC1D_X')

    if (update2Error) {
      console.error('Error updating MDGC1D_X:', update2Error)
    } else {
      console.log('Updated MDGC1D_X to MDGC1D')
    }

    // 4. product_id만 변경 (reservation_choices는 이미 마이그레이션으로 입력되어 있으므로 그대로 유지)
    // 선택사항 마이그레이션으로 초이스가 reservation_choices에 이미 입력되어 있으므로
    // product_id만 변경하면 됨

    // 5. 최종 결과 확인 - 페이지네이션으로 전체 데이터 처리

    // 최종 예약 데이터 전체 조회 (페이지네이션)
    const allFinalReservations: Array<{ id: string; product_id: string }> = []
    let finalReservationsFrom = 0
    const finalReservationsPageSize = 1000
    let hasMoreFinalReservations = true

    while (hasMoreFinalReservations) {
      const { data: finalReservations, error: finalReservationsError } = await supabase
        .from('reservations')
        .select('id, product_id')
        .in('product_id', ['MDGCSUNRISE', 'MDGC1D'])
        .range(finalReservationsFrom, finalReservationsFrom + finalReservationsPageSize - 1)

      if (finalReservationsError) {
        console.error('Error checking final reservations:', finalReservationsError)
        break
      }

      if (finalReservations && finalReservations.length > 0) {
        allFinalReservations.push(...finalReservations)
        finalReservationsFrom += finalReservationsPageSize
        hasMoreFinalReservations = finalReservations.length >= finalReservationsPageSize
      } else {
        hasMoreFinalReservations = false
      }
    }

    // reservation_choices 통계 계산 (페이지네이션으로 처리)
    let lowerAntelopeCount = 0
    let antelopeXCount = 0
    let totalReservationChoices = 0

    // reservation_id 배열이 너무 크면 배치로 나눠서 처리
    const reservationIds = allFinalReservations.map(r => r.id)
    const batchSize = 1000 // Supabase의 IN 절 제한 고려

    for (let i = 0; i < reservationIds.length; i += batchSize) {
      const batchIds = reservationIds.slice(i, i + batchSize)
      
      let batchChoicesFrom = 0
      const batchChoicesPageSize = 1000
      let hasMoreBatchChoices = true

      while (hasMoreBatchChoices) {
        const { data: finalReservationChoices, error: finalChoicesError } = await supabase
          .from('reservation_choices')
          .select(`
            reservation_id,
            choice_id,
            option_id,
            quantity,
            total_price,
            choice_options!inner (
              option_key,
              option_name_ko
            )
          `)
          .in('reservation_id', batchIds)
          .range(batchChoicesFrom, batchChoicesFrom + batchChoicesPageSize - 1)

        if (finalChoicesError) {
          console.error('Error checking final reservation_choices:', finalChoicesError)
          break
        }

        if (finalReservationChoices && finalReservationChoices.length > 0) {
          totalReservationChoices += finalReservationChoices.length
          
          // 통계 계산
          lowerAntelopeCount += finalReservationChoices.filter(rc => 
            rc.choice_options?.option_key === 'lower_antelope'
          ).length

          antelopeXCount += finalReservationChoices.filter(rc => 
            rc.choice_options?.option_key === 'antelope_x'
          ).length

          batchChoicesFrom += batchChoicesPageSize
          hasMoreBatchChoices = finalReservationChoices.length >= batchChoicesPageSize
        } else {
          hasMoreBatchChoices = false
        }
      }
    }

    const result = {
      success: true,
      message: '예약 데이터 정리 완료: product_id만 변경되었습니다. reservation_choices는 기존 데이터를 그대로 사용합니다.',
      details: {
        totalProcessed: allFinalReservations.length,
        productIds: [...new Set(allFinalReservations.map(r => r.product_id))],
        updatedReservations: totalReservationChoices,
        mdgcSunriseXUpdated: mdgcSunriseXIds.length,
        mdgc1DXUpdated: mdgc1DXIds.length,
        lowerAntelopeCount,
        antelopeXCount
      }
    }

    console.log('Reservation cleanup completed:', result)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Reservation cleanup error:', error)
    return NextResponse.json(
      { success: false, message: `Reservation cleanup failed: ${error}` },
      { status: 500 }
    )
  }
}

// GET 요청으로 현재 상태 확인
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, message: 'Supabase configuration missing' },
        { status: 500 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 현재 상태 확인 (새로운 초이스 시스템 기준)
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, product_id, created_at')
      .in('product_id', ['MDGCSUNRISE', 'MDGCSUNRISE_X', 'MDGC1D', 'MDGC1D_X'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (reservationsError) {
      return NextResponse.json(
        { success: false, message: `Error checking reservations: ${reservationsError.message}` },
        { status: 500 }
      )
    }

    const { data: productChoices, error: productChoicesError } = await supabase
      .from('product_choices')
      .select('id, product_id, choice_group_ko')
      .in('product_id', ['MDGCSUNRISE', 'MDGC1D'])

    if (productChoicesError) {
      return NextResponse.json(
        { success: false, message: `Error checking product_choices: ${productChoicesError.message}` },
        { status: 500 }
      )
    }

    const { data: reservationChoices, error: reservationChoicesError } = await supabase
      .from('reservation_choices')
      .select(`
        reservation_id,
        choice_id,
        option_id,
        quantity,
        choice_options!inner (
          option_key,
          option_name_ko
        )
      `)
      .in('reservation_id', reservations?.map(r => r.id) || [])

    if (reservationChoicesError) {
      return NextResponse.json(
        { success: false, message: `Error checking reservation_choices: ${reservationChoicesError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        reservations: reservations || [],
        productChoices: productChoices || [],
        reservationChoices: reservationChoices || [],
        summary: {
          totalReservations: reservations?.length || 0,
          reservationsWithChoices: reservationChoices?.length || 0,
          productsWithChoices: productChoices?.length || 0,
          lowerAntelopeCount: reservationChoices?.filter(rc => 
            rc.choice_options?.option_key === 'lower_antelope'
          ).length || 0,
          antelopeXCount: reservationChoices?.filter(rc => 
            rc.choice_options?.option_key === 'antelope_x'
          ).length || 0
        }
      }
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      { success: false, message: `Status check failed: ${error}` },
      { status: 500 }
    )
  }
}
