import { supabase } from './supabase'

export interface TourAutoCreationResult {
  success: boolean
  tourId?: string
  message: string
}

/**
 * Mania Tour 또는 Mania Service 예약에 대해 자동으로 투어를 생성하거나 기존 투어에 추가하는 함수
 */
export async function autoCreateOrUpdateTour(
  productId: string,
  tourDate: string,
  reservationId: string,
  isPrivateTour?: boolean
): Promise<TourAutoCreationResult> {
  try {
    // 1. 해당 상품의 sub_category 확인
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('sub_category')
      .eq('id', productId)
      .single()

    if (productError) {
      console.error('Error fetching product:', {
        message: productError.message,
        details: productError.details,
        hint: productError.hint,
        code: productError.code
      })
      return {
        success: false,
        message: '상품 정보를 가져오는 중 오류가 발생했습니다: ' + productError.message
      }
    }

    // sub_category가 'Mania Tour' 또는 'Mania Service'가 아닌 경우 처리하지 않음
    if (!product.sub_category || !['Mania Tour', 'Mania Service'].includes(product.sub_category)) {
      return {
        success: true,
        message: '해당 상품은 자동 투어 생성 대상이 아닙니다.'
      }
    }

    // 2. 같은 날짜, 같은 product_id의 기존 투어가 있는지 확인
    const { data: existingTours, error: tourError } = await supabase
      .from('tours')
      .select('id, reservation_ids')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)

    if (tourError) {
      console.error('Error fetching existing tours:', {
        message: tourError.message,
        details: tourError.details,
        hint: tourError.hint,
        code: tourError.code
      })
      return {
        success: false,
        message: '기존 투어 정보를 가져오는 중 오류가 발생했습니다: ' + tourError.message
      }
    }

    if (existingTours && existingTours.length > 0) {
      // 3. 기존 투어가 있는 경우: reservation_ids에 새 예약 ID 추가
      const existingTour = existingTours[0]
      // reservation_ids를 TEXT[] 형식으로 처리
      const currentReservationIds = existingTour.reservation_ids || []
      const updatedReservationIds = [...currentReservationIds, reservationId]

      // 투어에 단독투어 예약이 추가되면 투어도 단독투어로 표시
      const shouldUpdateToPrivate = isPrivateTour || false

      const { error: updateError } = await supabase
        .from('tours')
        .update({ 
          reservation_ids: updatedReservationIds,
          is_private_tour: shouldUpdateToPrivate
        })
        .eq('id', existingTour.id)

      if (updateError) {
        console.error('Error updating tour:', {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code
        })
        return {
          success: false,
          message: '기존 투어 업데이트 중 오류가 발생했습니다: ' + updateError.message
        }
      }

      // 4. reservations 테이블의 tour_id 업데이트
      const { error: reservationUpdateError } = await supabase
        .from('reservations')
        .update({ tour_id: existingTour.id })
        .eq('id', reservationId)

      if (reservationUpdateError) {
        console.error('Error updating reservation tour_id:', {
          message: reservationUpdateError.message,
          details: reservationUpdateError.details,
          hint: reservationUpdateError.hint,
          code: reservationUpdateError.code
        })
        return {
          success: false,
          message: '예약의 투어 ID 업데이트 중 오류가 발생했습니다: ' + reservationUpdateError.message
        }
      }

      return {
        success: true,
        tourId: existingTour.id,
        message: '기존 투어에 예약이 추가되었습니다.'
      }
    } else {
      // 5. 기존 투어가 없는 경우: 새 투어 생성
      // TEXT 형식의 ID를 명시적으로 생성
      const tourId = `tour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const { data: newTour, error: createError } = await supabase
        .from('tours')
        .insert({
          id: tourId,
          product_id: productId,
          tour_date: tourDate,
          reservation_ids: [reservationId], // TEXT[] 형식으로 저장
          tour_status: 'scheduled',
          is_private_tour: isPrivateTour || false
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating new tour:', {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code
        })
        return {
          success: false,
          message: '새 투어 생성 중 오류가 발생했습니다: ' + createError.message
        }
      }

      // 6. reservations 테이블의 tour_id 업데이트
      const { error: reservationUpdateError } = await supabase
        .from('reservations')
        .update({ tour_id: newTour.id })
        .eq('id', reservationId)

      if (reservationUpdateError) {
        console.error('Error updating reservation tour_id:', {
          message: reservationUpdateError.message,
          details: reservationUpdateError.details,
          hint: reservationUpdateError.hint,
          code: reservationUpdateError.code
        })
        return {
          success: false,
          message: '예약의 투어 ID 업데이트 중 오류가 발생했습니다: ' + reservationUpdateError.message
        }
      }

      return {
        success: true,
        tourId: newTour.id,
        message: '새 투어가 생성되고 예약이 추가되었습니다.'
      }
    }
  } catch (error) {
    console.error('Error in autoCreateOrUpdateTour:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    return {
      success: false,
      message: '투어 자동 생성 중 예상치 못한 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류')
    }
  }
}
