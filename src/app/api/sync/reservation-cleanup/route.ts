import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    // 환경 변수에서 Supabase 설정 가져오기
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase environment variables not configured')
      return NextResponse.json(
        { success: false, message: 'Supabase configuration missing' },
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

    // 4. 새로운 초이스 시스템에 맞게 데이터 생성 및 마이그레이션
    
    // 먼저 기존 product_choices 데이터 확인 및 삭제
    const { error: deleteExistingChoicesError } = await supabase
      .from('product_choices')
      .delete()
      .in('product_id', ['MDGCSUNRISE', 'MDGC1D'])

    if (deleteExistingChoicesError) {
      console.error('Error deleting existing product_choices:', deleteExistingChoicesError)
    } else {
      console.log('Deleted existing product_choices for MDGCSUNRISE and MDGC1D')
    }

    // 새로운 product_choices 데이터 생성
    const canyonChoiceData = {
      product_id: 'MDGCSUNRISE',
      choice_group: 'canyon_choice',
      choice_group_ko: '캐년 선택',
      choice_type: 'single',
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: 1
    }

    const canyonChoiceData1D = {
      product_id: 'MDGC1D',
      choice_group: 'canyon_choice',
      choice_group_ko: '캐년 선택',
      choice_type: 'single',
      is_required: true,
      min_selections: 1,
      max_selections: 1,
      sort_order: 1
    }

    // product_choices 삽입
    const { data: insertedChoices, error: insertChoicesError } = await supabase
      .from('product_choices')
      .insert([canyonChoiceData, canyonChoiceData1D])
      .select()

    if (insertChoicesError) {
      console.error('Error inserting product_choices:', insertChoicesError)
      return NextResponse.json(
        { success: false, message: `Error creating product choices: ${insertChoicesError.message}` },
        { status: 500 }
      )
    }

    console.log('Created product_choices:', insertedChoices)

    // choice_options 데이터 생성
    const choiceOptions = [
      // Lower Antelope Canyon 옵션들
      {
        choice_id: insertedChoices[0].id,
        option_key: 'lower_antelope',
        option_name: 'Lower Antelope Canyon',
        option_name_ko: '로어 앤텔롭 캐년',
        adult_price: 0,
        child_price: 0,
        infant_price: 0,
        capacity: 999,
        is_default: true,
        is_active: true,
        sort_order: 1
      },
      {
        choice_id: insertedChoices[0].id,
        option_key: 'antelope_x',
        option_name: 'Antelope X Canyon',
        option_name_ko: '앤텔롭 X 캐년',
        adult_price: 0,
        child_price: 0,
        infant_price: 0,
        capacity: 999,
        is_default: false,
        is_active: true,
        sort_order: 2
      },
      // MDGC1D용 옵션들
      {
        choice_id: insertedChoices[1].id,
        option_key: 'lower_antelope',
        option_name: 'Lower Antelope Canyon',
        option_name_ko: '로어 앤텔롭 캐년',
        adult_price: 0,
        child_price: 0,
        infant_price: 0,
        capacity: 999,
        is_default: true,
        is_active: true,
        sort_order: 1
      },
      {
        choice_id: insertedChoices[1].id,
        option_key: 'antelope_x',
        option_name: 'Antelope X Canyon',
        option_name_ko: '앤텔롭 X 캐년',
        adult_price: 0,
        child_price: 0,
        infant_price: 0,
        capacity: 999,
        is_default: false,
        is_active: true,
        sort_order: 2
      }
    ]

    const { data: insertedOptions, error: insertOptionsError } = await supabase
      .from('choice_options')
      .insert(choiceOptions)
      .select()

    if (insertOptionsError) {
      console.error('Error inserting choice_options:', insertOptionsError)
      return NextResponse.json(
        { success: false, message: `Error creating choice options: ${insertOptionsError.message}` },
        { status: 500 }
      )
    }

    console.log('Created choice_options:', insertedOptions)

    // Lower Antelope Canyon 옵션 ID 찾기
    const lowerAntelopeOptionId = insertedOptions.find(opt => 
      opt.choice_id === insertedChoices[0].id && opt.option_key === 'lower_antelope'
    )?.id

    const lowerAntelopeOptionId1D = insertedOptions.find(opt => 
      opt.choice_id === insertedChoices[1].id && opt.option_key === 'lower_antelope'
    )?.id

    // Antelope X Canyon 옵션 ID 찾기
    const antelopeXOptionId = insertedOptions.find(opt => 
      opt.choice_id === insertedChoices[0].id && opt.option_key === 'antelope_x'
    )?.id

    const antelopeXOptionId1D = insertedOptions.find(opt => 
      opt.choice_id === insertedChoices[1].id && opt.option_key === 'antelope_x'
    )?.id

    // 기존 reservation_choices 데이터 삭제
    const { error: deleteReservationChoicesError } = await supabase
      .from('reservation_choices')
      .delete()
      .in('reservation_id', [...mdgcSunriseXIds, ...mdgc1DXIds])

    if (deleteReservationChoicesError) {
      console.error('Error deleting existing reservation_choices:', deleteReservationChoicesError)
    }

    // MDGCSUNRISE_X였던 레코드들을 Antelope X Canyon으로 설정
    if (mdgcSunriseXIds.length > 0 && antelopeXOptionId) {
      const antelopeXReservationChoices = mdgcSunriseXIds.map(reservationId => ({
        reservation_id: reservationId,
        choice_id: insertedChoices[0].id,
        option_id: antelopeXOptionId,
        quantity: 1,
        total_price: 0
      }))

      const { error: insertReservationChoicesError } = await supabase
        .from('reservation_choices')
        .insert(antelopeXReservationChoices)

      if (insertReservationChoicesError) {
        console.error('Error inserting reservation_choices for MDGCSUNRISE_X:', insertReservationChoicesError)
      } else {
        console.log(`Created ${mdgcSunriseXIds.length} reservation_choices for MDGCSUNRISE_X → Antelope X Canyon`)
      }
    }

    // MDGC1D_X였던 레코드들을 Antelope X Canyon으로 설정
    if (mdgc1DXIds.length > 0 && antelopeXOptionId1D) {
      const antelopeXReservationChoices1D = mdgc1DXIds.map(reservationId => ({
        reservation_id: reservationId,
        choice_id: insertedChoices[1].id,
        option_id: antelopeXOptionId1D,
        quantity: 1,
        total_price: 0
      }))

      const { error: insertReservationChoicesError1D } = await supabase
        .from('reservation_choices')
        .insert(antelopeXReservationChoices1D)

      if (insertReservationChoicesError1D) {
        console.error('Error inserting reservation_choices for MDGC1D_X:', insertReservationChoicesError1D)
      } else {
        console.log(`Created ${mdgc1DXIds.length} reservation_choices for MDGC1D_X → Antelope X Canyon`)
      }
    }

    // 기존 MDGCSUNRISE 레코드들 (reservation_choices가 없는 경우)을 Lower Antelope Canyon으로 설정 (페이지네이션으로 전체 데이터 처리)
    if (lowerAntelopeOptionId) {
      let mdgcSunriseFrom = 0
      const mdgcSunrisePageSize = 1000
      let hasMoreMdgcSunrise = true
      let totalProcessedMdgcSunrise = 0
      
      while (hasMoreMdgcSunrise) {
        const { data: mdgcSunriseReservations, error: mdgcSunriseError } = await supabase
          .from('reservations')
          .select('id')
          .eq('product_id', 'MDGCSUNRISE')
          .range(mdgcSunriseFrom, mdgcSunriseFrom + mdgcSunrisePageSize - 1)

        if (mdgcSunriseError) {
          console.error('Error fetching MDGCSUNRISE records:', mdgcSunriseError)
          break
        }

        if (mdgcSunriseReservations && mdgcSunriseReservations.length > 0) {
          // 현재 배치의 reservation_choices 확인
          const reservationIds = mdgcSunriseReservations.map(r => r.id)
          const { data: existingReservationChoices } = await supabase
            .from('reservation_choices')
            .select('reservation_id')
            .in('reservation_id', reservationIds)

          const reservationsWithoutChoices = mdgcSunriseReservations.filter(r => 
            !existingReservationChoices?.some(rc => rc.reservation_id === r.id)
          )

          if (reservationsWithoutChoices.length > 0) {
            const lowerAntelopeReservationChoices = reservationsWithoutChoices.map(reservation => ({
              reservation_id: reservation.id,
              choice_id: insertedChoices[0].id,
              option_id: lowerAntelopeOptionId,
              quantity: 1,
              total_price: 0
            }))

            const { error: insertLowerAntelopeError } = await supabase
              .from('reservation_choices')
              .insert(lowerAntelopeReservationChoices)

            if (insertLowerAntelopeError) {
              console.error('Error inserting reservation_choices for MDGCSUNRISE:', insertLowerAntelopeError)
            } else {
              console.log(`Created ${reservationsWithoutChoices.length} reservation_choices for MDGCSUNRISE → Lower Antelope Canyon (batch starting at ${mdgcSunriseFrom})`)
              totalProcessedMdgcSunrise += reservationsWithoutChoices.length
            }
          }

          mdgcSunriseFrom += mdgcSunrisePageSize
          hasMoreMdgcSunrise = mdgcSunriseReservations.length >= mdgcSunrisePageSize
        } else {
          hasMoreMdgcSunrise = false
        }
      }
      
      if (totalProcessedMdgcSunrise > 0) {
        console.log(`Total: Created ${totalProcessedMdgcSunrise} reservation_choices for MDGCSUNRISE → Lower Antelope Canyon`)
      }
    }

    // 기존 MDGC1D 레코드들 (reservation_choices가 없는 경우)을 Lower Antelope Canyon으로 설정 (페이지네이션으로 전체 데이터 처리)
    if (lowerAntelopeOptionId1D) {
      let mdgc1DFrom = 0
      const mdgc1DPageSize = 1000
      let hasMoreMdgc1D = true
      let totalProcessedMdgc1D = 0
      
      while (hasMoreMdgc1D) {
        const { data: mdgc1DReservations, error: mdgc1DError } = await supabase
          .from('reservations')
          .select('id')
          .eq('product_id', 'MDGC1D')
          .range(mdgc1DFrom, mdgc1DFrom + mdgc1DPageSize - 1)

        if (mdgc1DError) {
          console.error('Error fetching MDGC1D records:', mdgc1DError)
          break
        }

        if (mdgc1DReservations && mdgc1DReservations.length > 0) {
          // 현재 배치의 reservation_choices 확인
          const reservationIds = mdgc1DReservations.map(r => r.id)
          const { data: existingReservationChoices1D } = await supabase
            .from('reservation_choices')
            .select('reservation_id')
            .in('reservation_id', reservationIds)

          const reservationsWithoutChoices1D = mdgc1DReservations.filter(r => 
            !existingReservationChoices1D?.some(rc => rc.reservation_id === r.id)
          )

          if (reservationsWithoutChoices1D.length > 0) {
            const lowerAntelopeReservationChoices1D = reservationsWithoutChoices1D.map(reservation => ({
              reservation_id: reservation.id,
              choice_id: insertedChoices[1].id,
              option_id: lowerAntelopeOptionId1D,
              quantity: 1,
              total_price: 0
            }))

            const { error: insertLowerAntelopeError1D } = await supabase
              .from('reservation_choices')
              .insert(lowerAntelopeReservationChoices1D)

            if (insertLowerAntelopeError1D) {
              console.error('Error inserting reservation_choices for MDGC1D:', insertLowerAntelopeError1D)
            } else {
              console.log(`Created ${reservationsWithoutChoices1D.length} reservation_choices for MDGC1D → Lower Antelope Canyon (batch starting at ${mdgc1DFrom})`)
              totalProcessedMdgc1D += reservationsWithoutChoices1D.length
            }
          }

          mdgc1DFrom += mdgc1DPageSize
          hasMoreMdgc1D = mdgc1DReservations.length >= mdgc1DPageSize
        } else {
          hasMoreMdgc1D = false
        }
      }
      
      if (totalProcessedMdgc1D > 0) {
        console.log(`Total: Created ${totalProcessedMdgc1D} reservation_choices for MDGC1D → Lower Antelope Canyon`)
      }
    }

    // 5. 최종 결과 확인 (새로운 초이스 시스템 기준) - 페이지네이션으로 전체 데이터 처리

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
      message: 'Reservation data cleanup completed successfully with new choices system',
      details: {
        totalProcessed: allFinalReservations.length,
        productIds: [...new Set(allFinalReservations.map(r => r.product_id))],
        updatedReservations: totalReservationChoices,
        mdgcSunriseXUpdated: mdgcSunriseXIds.length,
        mdgc1DXUpdated: mdgc1DXIds.length,
        lowerAntelopeCount,
        antelopeXCount,
        productChoicesCreated: insertedChoices?.length || 0,
        choiceOptionsCreated: insertedOptions?.length || 0
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
