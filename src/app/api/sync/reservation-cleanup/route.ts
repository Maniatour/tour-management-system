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

    // 3. product_id 통일하기 전에 _X였던 레코드들의 ID를 저장
    const { data: mdgcSunriseXRecords, error: mdgcSunriseXError } = await supabase
      .from('reservations')
      .select('id')
      .eq('product_id', 'MDGCSUNRISE_X')

    const { data: mdgc1DXRecords, error: mdgc1DXError } = await supabase
      .from('reservations')
      .select('id')
      .eq('product_id', 'MDGC1D_X')

    const mdgcSunriseXIds = mdgcSunriseXRecords?.map(r => r.id) || []
    const mdgc1DXIds = mdgc1DXRecords?.map(r => r.id) || []

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

    // 기존 MDGCSUNRISE 레코드들 (reservation_choices가 없는 경우)을 Lower Antelope Canyon으로 설정
    const { data: mdgcSunriseReservations, error: mdgcSunriseError } = await supabase
      .from('reservations')
      .select('id')
      .eq('product_id', 'MDGCSUNRISE')

    if (!mdgcSunriseError && mdgcSunriseReservations && lowerAntelopeOptionId) {
      const existingReservationChoices = await supabase
        .from('reservation_choices')
        .select('reservation_id')
        .in('reservation_id', mdgcSunriseReservations.map(r => r.id))

      const reservationsWithoutChoices = mdgcSunriseReservations.filter(r => 
        !existingReservationChoices.data?.some(rc => rc.reservation_id === r.id)
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
          console.log(`Created ${reservationsWithoutChoices.length} reservation_choices for MDGCSUNRISE → Lower Antelope Canyon`)
        }
      }
    }

    // 기존 MDGC1D 레코드들 (reservation_choices가 없는 경우)을 Lower Antelope Canyon으로 설정
    const { data: mdgc1DReservations, error: mdgc1DError } = await supabase
      .from('reservations')
      .select('id')
      .eq('product_id', 'MDGC1D')

    if (!mdgc1DError && mdgc1DReservations && lowerAntelopeOptionId1D) {
      const existingReservationChoices1D = await supabase
        .from('reservation_choices')
        .select('reservation_id')
        .in('reservation_id', mdgc1DReservations.map(r => r.id))

      const reservationsWithoutChoices1D = mdgc1DReservations.filter(r => 
        !existingReservationChoices1D.data?.some(rc => rc.reservation_id === r.id)
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
          console.log(`Created ${reservationsWithoutChoices1D.length} reservation_choices for MDGC1D → Lower Antelope Canyon`)
        }
      }
    }

    // 5. 최종 결과 확인 (새로운 초이스 시스템 기준)

    // 최종 결과 확인 (새로운 초이스 시스템 기준)
    const { data: finalReservations, error: finalReservationsError } = await supabase
      .from('reservations')
      .select('id, product_id')
      .in('product_id', ['MDGCSUNRISE', 'MDGC1D'])

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
      .in('reservation_id', finalReservations?.map(r => r.id) || [])

    if (finalReservationsError) {
      console.error('Error checking final reservations:', finalReservationsError)
    }

    if (finalChoicesError) {
      console.error('Error checking final reservation_choices:', finalChoicesError)
    }

    // 통계 계산
    const lowerAntelopeCount = finalReservationChoices?.filter(rc => 
      rc.choice_options?.option_key === 'lower_antelope'
    ).length || 0

    const antelopeXCount = finalReservationChoices?.filter(rc => 
      rc.choice_options?.option_key === 'antelope_x'
    ).length || 0

    const result = {
      success: true,
      message: 'Reservation data cleanup completed successfully with new choices system',
      details: {
        totalProcessed: finalReservations?.length || 0,
        productIds: [...new Set(finalReservations?.map(r => r.product_id) || [])],
        updatedReservations: finalReservationChoices?.length || 0,
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
