import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('예약 데이터 정리 시작...')

    // 1. MDGCSUNRISE_X를 MDGCSUNRISE로 변경하고 Antelope X Canyon 옵션 추가
    const { data: mdgcSunriseXReservations, error: mdgcSunriseXError } = await supabase
      .from('reservations')
      .select('id, product_id')
      .eq('product_id', 'MDGCSUNRISE_X')

    if (mdgcSunriseXError) {
      console.error('MDGCSUNRISE_X 예약 조회 오류:', mdgcSunriseXError)
      return NextResponse.json({
        success: false,
        message: `MDGCSUNRISE_X 예약 조회 오류: ${mdgcSunriseXError.message}`
      })
    }

    let mdgcSunriseXUpdated = 0
    if (mdgcSunriseXReservations && mdgcSunriseXReservations.length > 0) {
      console.log(`MDGCSUNRISE_X 예약 ${mdgcSunriseXReservations.length}개 발견`)

      for (const reservation of mdgcSunriseXReservations) {
        // 상품 ID를 MDGCSUNRISE로 변경
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            product_id: 'MDGCSUNRISE',
            updated_at: new Date().toISOString()
          })
          .eq('id', reservation.id)

        if (updateError) {
          console.error(`예약 ${reservation.id} 업데이트 오류:`, updateError)
        } else {
          mdgcSunriseXUpdated++
          
          // Antelope X Canyon 옵션 추가
          const { error: optionError } = await supabase
            .from('reservation_options')
            .upsert({
              reservation_id: reservation.id,
              option_name: 'Antelope X Canyon',
              option_value: 'Antelope X Canyon',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (optionError) {
            console.error(`예약 ${reservation.id} 옵션 추가 오류:`, optionError)
          }
        }
      }
    }

    // 2. MDGC1D_X를 MDGC1D로 변경하고 Antelope X Canyon 옵션 추가
    const { data: mdgc1DXReservations, error: mdgc1DXError } = await supabase
      .from('reservations')
      .select('id, product_id')
      .eq('product_id', 'MDGC1D_X')

    if (mdgc1DXError) {
      console.error('MDGC1D_X 예약 조회 오류:', mdgc1DXError)
      return NextResponse.json({
        success: false,
        message: `MDGC1D_X 예약 조회 오류: ${mdgc1DXError.message}`
      })
    }

    let mdgc1DXUpdated = 0
    if (mdgc1DXReservations && mdgc1DXReservations.length > 0) {
      console.log(`MDGC1D_X 예약 ${mdgc1DXReservations.length}개 발견`)

      for (const reservation of mdgc1DXReservations) {
        // 상품 ID를 MDGC1D로 변경
        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            product_id: 'MDGC1D',
            updated_at: new Date().toISOString()
          })
          .eq('id', reservation.id)

        if (updateError) {
          console.error(`예약 ${reservation.id} 업데이트 오류:`, updateError)
        } else {
          mdgc1DXUpdated++
          
          // Antelope X Canyon 옵션 추가
          const { error: optionError } = await supabase
            .from('reservation_options')
            .upsert({
              reservation_id: reservation.id,
              option_name: 'Antelope X Canyon',
              option_value: 'Antelope X Canyon',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (optionError) {
            console.error(`예약 ${reservation.id} 옵션 추가 오류:`, optionError)
          }
        }
      }
    }

    // 3. 기존 MDGCSUNRISE 예약에 Lower Antelope Canyon 옵션 추가 (옵션이 없는 경우)
    const { data: mdgcSunriseReservations, error: mdgcSunriseError } = await supabase
      .from('reservations')
      .select('id')
      .eq('product_id', 'MDGCSUNRISE')

    if (mdgcSunriseError) {
      console.error('MDGCSUNRISE 예약 조회 오류:', mdgcSunriseError)
      return NextResponse.json({
        success: false,
        message: `MDGCSUNRISE 예약 조회 오류: ${mdgcSunriseError.message}`
      })
    }

    let mdgcSunriseUpdated = 0
    if (mdgcSunriseReservations && mdgcSunriseReservations.length > 0) {
      console.log(`MDGCSUNRISE 예약 ${mdgcSunriseReservations.length}개 확인`)

      for (const reservation of mdgcSunriseReservations) {
        // 이미 옵션이 있는지 확인
        const { data: existingOptions } = await supabase
          .from('reservation_options')
          .select('id')
          .eq('reservation_id', reservation.id)
          .eq('option_name', 'Lower Antelope Canyon')

        if (!existingOptions || existingOptions.length === 0) {
          // Lower Antelope Canyon 옵션 추가
          const { error: optionError } = await supabase
            .from('reservation_options')
            .upsert({
              reservation_id: reservation.id,
              option_name: 'Lower Antelope Canyon',
              option_value: 'Lower Antelope Canyon',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (optionError) {
            console.error(`예약 ${reservation.id} 옵션 추가 오류:`, optionError)
          } else {
            mdgcSunriseUpdated++
          }
        }
      }
    }

    // 4. 기존 MDGC1D 예약에 Lower Antelope Canyon 옵션 추가 (옵션이 없는 경우)
    const { data: mdgc1DReservations, error: mdgc1DError } = await supabase
      .from('reservations')
      .select('id')
      .eq('product_id', 'MDGC1D')

    if (mdgc1DError) {
      console.error('MDGC1D 예약 조회 오류:', mdgc1DError)
      return NextResponse.json({
        success: false,
        message: `MDGC1D 예약 조회 오류: ${mdgc1DError.message}`
      })
    }

    let mdgc1DUpdated = 0
    if (mdgc1DReservations && mdgc1DReservations.length > 0) {
      console.log(`MDGC1D 예약 ${mdgc1DReservations.length}개 확인`)

      for (const reservation of mdgc1DReservations) {
        // 이미 옵션이 있는지 확인
        const { data: existingOptions } = await supabase
          .from('reservation_options')
          .select('id')
          .eq('reservation_id', reservation.id)
          .eq('option_name', 'Lower Antelope Canyon')

        if (!existingOptions || existingOptions.length === 0) {
          // Lower Antelope Canyon 옵션 추가
          const { error: optionError } = await supabase
            .from('reservation_options')
            .upsert({
              reservation_id: reservation.id,
              option_name: 'Lower Antelope Canyon',
              option_value: 'Lower Antelope Canyon',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (optionError) {
            console.error(`예약 ${reservation.id} 옵션 추가 오류:`, optionError)
          } else {
            mdgc1DUpdated++
          }
        }
      }
    }

    const totalUpdated = mdgcSunriseXUpdated + mdgc1DXUpdated + mdgcSunriseUpdated + mdgc1DUpdated

    console.log('예약 데이터 정리 완료:', {
      mdgcSunriseXUpdated,
      mdgc1DXUpdated,
      mdgcSunriseUpdated,
      mdgc1DUpdated,
      totalUpdated
    })

    return NextResponse.json({
      success: true,
      message: `예약 데이터 정리 완료: 총 ${totalUpdated}개 예약 처리`,
      data: {
        mdgcSunriseXUpdated,
        mdgc1DXUpdated,
        mdgcSunriseUpdated,
        mdgc1DUpdated,
        totalUpdated
      }
    })

  } catch (error) {
    console.error('예약 데이터 정리 오류:', error)
    return NextResponse.json({
      success: false,
      message: `예약 데이터 정리 중 오류 발생: ${error}`
    })
  }
}
