import { supabase } from './supabase'
import { createTourPhotosBucket } from './tourPhotoBucket'
import { generateTourId } from './entityIds'
import { normalizeReservationIds } from '@/utils/tourUtils'
import { isTourCancelled } from '@/utils/tourStatusUtils'

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

    // 2. 같은 날짜·상품의 투어 (삭제/취소는 스케줄 충돌·병합 대상에서 제외)
    const { data: existingTours, error: tourError } = await supabase
      .from('tours')
      .select('id, reservation_ids, tour_status')
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

    const allRows = existingTours || []
    const rid = String(reservationId).trim()
    const inactiveTours = allRows.filter((t) => isTourCancelled(t.tour_status))
    const activeTours = allRows.filter((t) => !isTourCancelled(t.tour_status))

    for (const t of inactiveTours) {
      const ids = normalizeReservationIds(t.reservation_ids)
      if (!ids.includes(rid)) continue
      const nextIds = ids.filter((x) => x !== rid)
      const { error: stripErr } = await supabase
        .from('tours')
        .update({ reservation_ids: nextIds })
        .eq('id', t.id)
      if (stripErr) {
        console.error('Error stripping reservation from inactive tour:', stripErr)
        return {
          success: false,
          message: '비활성 투어에서 예약 연결을 정리하는 중 오류가 발생했습니다: ' + stripErr.message,
        }
      }
    }

    if (activeTours.length > 0) {
      for (const t of activeTours) {
        if (normalizeReservationIds(t.reservation_ids).includes(rid)) {
          return {
            success: true,
            tourId: t.id,
            message: '이미 해당 날짜·상품 투어에 연결된 예약입니다.',
          }
        }
      }
      // 3. 활성 투어가 있는 경우: reservation_ids에 새 예약 ID 추가
      const existingTour = activeTours[0]
      const currentReservationIds = normalizeReservationIds(existingTour.reservation_ids)
      const updatedReservationIds = [...new Set([...currentReservationIds, rid])]

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
      // 5. 활성 투어가 없는 경우(삭제·취소만 있거나 없음): 새 투어 생성
      const tourId = generateTourId()
      
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

      // 7. tour-photos 버켓 생성 (새 투어 생성 시에만)
      const bucketCreated = await createTourPhotosBucket()
      if (!bucketCreated) {
        console.warn('Failed to create tour-photos bucket, but tour creation succeeded')
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
