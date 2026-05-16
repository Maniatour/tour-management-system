import { supabase } from './supabase'
import { createTourPhotosBucket } from './tourPhotoBucket'
import { generateTourId } from './entityIds'
import { canonicalReservationIdKey, normalizeReservationIds } from '@/utils/tourUtils'
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

export type ScheduleAdditionalTourReservationInput = {
  id: string
  isPrivateTour?: boolean
}

/**
 * 같은 상품·투어일에 활성 투어가 이미 있을 때, 아직 어떤 활성 투어에도 배정되지 않은 예약만 모아
 * 새 투어 한 건을 생성한다. (스케줄 셀 모달에서 2팀째 등 추가 투어용)
 */
export async function createAdditionalActiveTourForReservations(
  productId: string,
  tourDate: string,
  reservationEntries: ScheduleAdditionalTourReservationInput[]
): Promise<TourAutoCreationResult> {
  try {
    if (!reservationEntries.length) {
      return { success: false, message: '배정할 예약이 없습니다.' }
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('sub_category')
      .eq('id', productId)
      .single()

    if (productError) {
      return {
        success: false,
        message: '상품 정보를 가져오는 중 오류가 발생했습니다: ' + productError.message,
      }
    }

    if (!product.sub_category || !['Mania Tour', 'Mania Service'].includes(product.sub_category)) {
      return {
        success: true,
        message: '해당 상품은 자동 투어 생성 대상이 아닙니다.',
      }
    }

    const { data: existingTours, error: tourError } = await supabase
      .from('tours')
      .select('id, reservation_ids, tour_status')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)

    if (tourError) {
      return {
        success: false,
        message: '기존 투어 정보를 가져오는 중 오류가 발생했습니다: ' + tourError.message,
      }
    }

    const allRows = existingTours || []
    const inactiveTours = allRows.filter((t) => isTourCancelled(t.tour_status))
    const inputKeySet = new Set(
      reservationEntries.map((e) => canonicalReservationIdKey(String(e.id).trim())).filter(Boolean)
    )

    for (const t of inactiveTours) {
      const ids = normalizeReservationIds(t.reservation_ids)
      const hasOverlap = ids.some((id) => inputKeySet.has(canonicalReservationIdKey(id)))
      if (!hasOverlap) continue
      const nextIds = ids.filter((id) => !inputKeySet.has(canonicalReservationIdKey(id)))
      const { error: stripErr } = await supabase.from('tours').update({ reservation_ids: nextIds }).eq('id', t.id)
      if (stripErr) {
        return {
          success: false,
          message: '비활성 투어에서 예약 연결을 정리하는 중 오류가 발생했습니다: ' + stripErr.message,
        }
      }
    }

    const { data: freshRows, error: freshErr } = await supabase
      .from('tours')
      .select('id, reservation_ids, tour_status')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)

    if (freshErr) {
      return {
        success: false,
        message: '투어 정보를 다시 불러오는 중 오류가 발생했습니다: ' + freshErr.message,
      }
    }

    const activeTours = (freshRows || []).filter((t) => !isTourCancelled(t.tour_status))
    const assignedCanon = new Set<string>()
    for (const t of activeTours) {
      for (const rawId of normalizeReservationIds(t.reservation_ids)) {
        if (rawId) assignedCanon.add(canonicalReservationIdKey(rawId))
      }
    }

    const pendingEntries = reservationEntries.filter((e) => {
      const k = canonicalReservationIdKey(String(e.id).trim())
      return k && !assignedCanon.has(k)
    })

    if (pendingEntries.length === 0) {
      return {
        success: false,
        message:
          '확정·모집중 예약이 이미 해당 날짜의 투어에 모두 배정되어 있습니다. 다른 투어에 넣으려면 예약에서 투어 연결을 먼저 해제하세요.',
      }
    }

    const reservationIdsForTour = pendingEntries.map((e) => String(e.id).trim()).filter(Boolean)
    const isPrivate = pendingEntries.some(
      (e) => e.isPrivateTour === true || String(e.isPrivateTour ?? '').toUpperCase() === 'TRUE'
    )

    const tourId = generateTourId()
    const { data: newTour, error: createError } = await supabase
      .from('tours')
      .insert({
        id: tourId,
        product_id: productId,
        tour_date: tourDate,
        reservation_ids: reservationIdsForTour,
        tour_status: 'scheduled',
        is_private_tour: isPrivate,
      })
      .select()
      .single()

    if (createError || !newTour) {
      return {
        success: false,
        message: '새 투어 생성 중 오류가 발생했습니다: ' + (createError?.message ?? '알 수 없음'),
      }
    }

    for (const rid of reservationIdsForTour) {
      const { error: reservationUpdateError } = await supabase
        .from('reservations')
        .update({ tour_id: newTour.id })
        .eq('id', rid)

      if (reservationUpdateError) {
        return {
          success: false,
          message: '예약의 투어 ID 업데이트 중 오류가 발생했습니다: ' + reservationUpdateError.message,
        }
      }
    }

    const bucketCreated = await createTourPhotosBucket()
    if (!bucketCreated) {
      console.warn('Failed to create tour-photos bucket, but tour creation succeeded')
    }

    return {
      success: true,
      tourId: newTour.id,
      message: '추가 투어가 생성되고 예약이 배정되었습니다.',
    }
  } catch (error) {
    console.error('Error in createAdditionalActiveTourForReservations:', error)
    return {
      success: false,
      message:
        '추가 투어 생성 중 오류가 발생했습니다: ' +
        (error instanceof Error ? error.message : '알 수 없는 오류'),
    }
  }
}
