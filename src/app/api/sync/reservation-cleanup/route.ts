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

    // 4. choice 데이터 업데이트
    const lowerAntelopeChoice = {
      required: [{
        id: 'canyon_choice',
        name: 'Canyon Choice',
        name_ko: '캐년 선택',
        description: '캐년 투어 선택',
        options: [{
          id: 'lower_antelope',
          name: 'Lower Antelope Canyon',
          name_ko: '로어 앤텔롭 캐년',
          adult_price: 0,
          child_price: 0,
          infant_price: 0,
          is_default: true
        }]
      }]
    }

    const antelopeXChoice = {
      required: [{
        id: 'canyon_choice',
        name: 'Canyon Choice',
        name_ko: '캐년 선택',
        description: '캐년 투어 선택',
        options: [{
          id: 'antelope_x',
          name: 'Antelope X Canyon',
          name_ko: '앤텔롭 X 캐년',
          adult_price: 0,
          child_price: 0,
          infant_price: 0,
          is_default: true
        }]
      }]
    }

    // MDGCSUNRISE_X였던 레코드들을 Antelope X Canyon으로 설정
    if (mdgcSunriseXIds.length > 0) {
      const { error: update3Error } = await supabase
        .from('reservations')
        .update({ choices: antelopeXChoice })
        .in('id', mdgcSunriseXIds)

      if (update3Error) {
        console.error('Error updating MDGCSUNRISE_X choices:', update3Error)
      } else {
        console.log(`Updated ${mdgcSunriseXIds.length} MDGCSUNRISE_X records to Antelope X Canyon`)
      }
    }

    // MDGC1D_X였던 레코드들을 Antelope X Canyon으로 설정
    if (mdgc1DXIds.length > 0) {
      const { error: update4Error } = await supabase
        .from('reservations')
        .update({ choices: antelopeXChoice })
        .in('id', mdgc1DXIds)

      if (update4Error) {
        console.error('Error updating MDGC1D_X choices:', update4Error)
      } else {
        console.log(`Updated ${mdgc1DXIds.length} MDGC1D_X records to Antelope X Canyon`)
      }
    }

    // 기존 MDGCSUNRISE 레코드들 (choices가 없는 경우)을 Lower Antelope Canyon으로 설정
    const { error: update5Error } = await supabase
      .from('reservations')
      .update({ choices: lowerAntelopeChoice })
      .eq('product_id', 'MDGCSUNRISE')
      .or('choices.is.null,choices.eq.{}')

    if (update5Error) {
      console.error('Error updating MDGCSUNRISE choices:', update5Error)
    } else {
      console.log('Updated MDGCSUNRISE choices to Lower Antelope Canyon')
    }

    // 기존 MDGC1D 레코드들 (choices가 없는 경우)을 Lower Antelope Canyon으로 설정
    const { error: update6Error } = await supabase
      .from('reservations')
      .update({ choices: lowerAntelopeChoice })
      .eq('product_id', 'MDGC1D')
      .or('choices.is.null,choices.eq.{}')

    if (update6Error) {
      console.error('Error updating MDGC1D choices:', update6Error)
    } else {
      console.log('Updated MDGC1D choices to Lower Antelope Canyon')
    }

    // 5. products 테이블도 업데이트
    try {
      const { error: addProductsColumnError } = await supabase
        .from('products')
        .select('choices')
        .limit(1)
      
      if (addProductsColumnError && addProductsColumnError.code === 'PGRST116') {
        console.warn('Choices column does not exist in products table. Please add it manually.')
      } else {
        console.log('Choices column exists in products table')
      }
    } catch (error) {
      console.warn('Warning: Could not check choices column in products:', error)
    }

    // products 테이블용 choices 데이터 (두 옵션 모두 포함)
    const productsChoice = {
      required: [{
        id: 'canyon_choice',
        name: 'Canyon Choice',
        name_ko: '캐년 선택',
        description: '캐년 투어 선택',
        options: [
          {
            id: 'lower_antelope',
            name: 'Lower Antelope Canyon',
            name_ko: '로어 앤텔롭 캐년',
            adult_price: 0,
            child_price: 0,
            infant_price: 0,
            is_default: true
          },
          {
            id: 'antelope_x',
            name: 'Antelope X Canyon',
            name_ko: '앤텔롭 X 캐년',
            adult_price: 0,
            child_price: 0,
            infant_price: 0,
            is_default: false
          }
        ]
      }]
    }

    // MDGCSUNRISE 상품 업데이트
    const { error: updateProduct1Error } = await supabase
      .from('products')
      .update({ choices: productsChoice })
      .eq('id', 'MDGCSUNRISE')

    if (updateProduct1Error) {
      console.error('Error updating MDGCSUNRISE product:', updateProduct1Error)
    } else {
      console.log('Updated MDGCSUNRISE product choices')
    }

    // MDGC1D 상품 업데이트
    const { error: updateProduct2Error } = await supabase
      .from('products')
      .update({ choices: productsChoice })
      .eq('id', 'MDGC1D')

    if (updateProduct2Error) {
      console.error('Error updating MDGC1D product:', updateProduct2Error)
    } else {
      console.log('Updated MDGC1D product choices')
    }

    // 6. 최종 결과 확인
    const { data: finalStatus, error: finalError } = await supabase
      .from('reservations')
      .select('product_id, choices')
      .in('product_id', ['MDGCSUNRISE', 'MDGC1D'])

    if (finalError) {
      console.error('Error checking final status:', finalError)
    }

    const result = {
      success: true,
      message: 'Reservation data cleanup completed successfully',
      details: {
        totalProcessed: finalStatus?.length || 0,
        productIds: [...new Set(finalStatus?.map(r => r.product_id) || [])],
        updatedReservations: finalStatus?.filter(r => r.choices)?.length || 0,
        mdgcSunriseXUpdated: mdgcSunriseXIds.length,
        mdgc1DXUpdated: mdgc1DXIds.length,
        lowerAntelopeCount: finalStatus?.filter(r => 
          r.choices?.required?.[0]?.options?.[0]?.id === 'lower_antelope'
        ).length || 0,
        antelopeXCount: finalStatus?.filter(r => 
          r.choices?.required?.[0]?.options?.[0]?.id === 'antelope_x'
        ).length || 0
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

    // 현재 상태 확인
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('product_id, choices, created_at')
      .in('product_id', ['MDGCSUNRISE', 'MDGCSUNRISE_X', 'MDGC1D', 'MDGC1D_X'])
      .order('created_at', { ascending: false })
      .limit(100)

    if (reservationsError) {
      return NextResponse.json(
        { success: false, message: `Error checking reservations: ${reservationsError.message}` },
        { status: 500 }
      )
    }

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, choices')
      .in('id', ['MDGCSUNRISE', 'MDGC1D'])

    if (productsError) {
      return NextResponse.json(
        { success: false, message: `Error checking products: ${productsError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        reservations: reservations || [],
        products: products || [],
        summary: {
          totalReservations: reservations?.length || 0,
          reservationsWithChoices: reservations?.filter(r => r.choices)?.length || 0,
          productsWithChoices: products?.filter(p => p.choices)?.length || 0
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
