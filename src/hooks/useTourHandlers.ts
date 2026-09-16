import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchApiWithAuth } from '@/lib/api-client-bearer'
import type { Database } from '@/lib/supabase'
import { timeToHHmm } from '@/lib/utils'
import { isTourCancelled, tourStaffVehicleAssignmentClearPatch } from '@/utils/tourStatusUtils'
import {
  dedupeReservationIdsPreservingOrder,
  reservationIdsLooselyEqual,
} from '@/utils/tourUtils'
import { exclusiveAssignReservationsToTour } from '@/lib/exclusiveTourReservationAssignment'
import {
  emitStaffAssignmentLockChanged,
  isAssistantAssignmentLocked,
  isGuideAssignmentLocked,
} from '@/lib/staffAssignmentLock'

export function useTourHandlers() {
  // 단독투어 상태 업데이트 함수
  const updatePrivateTourStatus = useCallback(async (tour: { id: string }, newValue: boolean) => {
    if (!tour) return false

    try {
      const updateData: Database['public']['Tables']['tours']['Update'] = { is_private_tour: newValue }
      const { error } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', tour.id)

      if (error) {
        console.error('Error updating private tour status:', error)
        alert('단독투어 상태 업데이트 중 오류가 발생했습니다.')
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating private tour status:', error)
      alert('단독투어 상태 업데이트 중 오류가 발생했습니다.')
      return false
    }
  }, [])

  // 투어 상태 변경 함수
  const updateTourStatus = useCallback(async (tour: { id: string }, newStatus: string, isStaff: boolean): Promise<boolean> => {
    try {
      if (!tour || !tour.id) {
        alert('투어 정보를 찾을 수 없습니다.')
        return false
      }
      
      if (!isStaff) {
        alert('투어 상태를 변경할 권한이 없습니다.')
        return false
      }
      
      console.log('데이터베이스 업데이트 시작:', { tourId: tour.id, newStatus })
      const updatePayload: Record<string, unknown> = { tour_status: newStatus }
      if (isTourCancelled(newStatus)) {
        Object.assign(updatePayload, tourStaffVehicleAssignmentClearPatch())
      }
      const { data, error } = await (supabase as any)
        .from('tours')
        .update(updatePayload)
        .eq('id', tour.id)
        .select()

      if (error) {
        console.error('데이터베이스 업데이트 오류:', error)
        throw error
      }
      
      console.log('투어 상태 업데이트 성공:', { tourId: tour.id, newStatus, updatedData: data })
      return true
      
    } catch (error) {
      console.error('투어 상태 업데이트 실패:', error)
      alert(`투어 상태 업데이트에 실패했습니다: ${(error as Error).message}`)
      return false
    }
  }, [])

  // 배정 상태 변경 함수
  const updateAssignmentStatus = useCallback(async (tour: { id: string }, newStatus: string, isStaff: boolean): Promise<boolean> => {
    try {
      if (!tour || !tour.id) {
        alert('투어 정보를 찾을 수 없습니다.')
        return false
      }
      
      if (!isStaff) {
        alert('배정 상태를 변경할 권한이 없습니다.')
        return false
      }
      
      const { error } = await (supabase as any)
        .from('tours')
        .update({ assignment_status: newStatus })
        .eq('id', tour.id)

      if (error) {
        if (error.message.includes('column "assignment_status" does not exist')) {
          const { error: noteError } = await (supabase as any)
            .from('tours')
            .update({ tour_note: `assignment_status: ${newStatus}` })
            .eq('id', tour.id)
          
          if (noteError) {
            throw noteError
          }
        } else {
          throw error
        }
      }
      
      console.log('배정 상태 업데이트 성공:', { tourId: tour.id, newStatus })
      return true
      
    } catch (error) {
      console.error('배정 상태 업데이트 실패:', error)
      alert(`배정 상태 업데이트에 실패했습니다: ${(error as Error).message}`)
      return false
    }
  }, [])

  // 팀 타입 변경 함수
  const handleTeamTypeChange = useCallback(async (tour: { id: string }, type: '1guide' | '2guide' | 'guide+driver') => {
    if (!tour) {
      console.error('Tour object is null or undefined')
      return false
    }

    console.log('팀 타입 변경 시작:', { tourId: tour.id, teamType: type })

    try {
      const { data: currentTour } = await (supabase as any)
        .from('tours')
        .select('assistant_assignment_locked, assistant_id')
        .eq('id', tour.id)
        .maybeSingle()

      if (type === '1guide' && isAssistantAssignmentLocked(currentTour)) {
        return false
      }

      const updateData: { team_type: string; assistant_id?: string | null } = { team_type: type }
      
      if (type === '1guide') {
        updateData.assistant_id = null
      }
      
      console.log('업데이트할 데이터:', updateData)
      
      const { error } = await (supabase as any)
        .from('tours')
        .update(updateData as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error updating team type:', error)
        alert(`팀 타입 업데이트 중 오류가 발생했습니다: ${error.message}`)
        return false
      }

      console.log('팀 타입이 성공적으로 업데이트되었습니다:', type)
      return true
    } catch (error) {
      console.error('Error updating team type:', error)
      alert(`팀 타입 업데이트 중 오류가 발생했습니다: ${(error as Error).message}`)
      return false
    }
  }, [])

  // 가이드 선택 함수
  const handleGuideSelect = useCallback(async (tour: { id: string }, guideEmail: string, teamType: string) => {
    if (!tour) return

    try {
      const { data: currentTour } = await (supabase as any)
        .from('tours')
        .select('guide_assignment_locked')
        .eq('id', tour.id)
        .maybeSingle()

      if (isGuideAssignmentLocked(currentTour)) {
        return false
      }

      // tour_guide_id는 team 테이블의 email 값을 직접 저장
      // 가이드 배정 변경 시 가이드에게 전달(부여) 전 대기 상태로 리셋
      const updateData: { tour_guide_id: string; assistant_id?: string | null; assignment_status?: string } = { 
        tour_guide_id: guideEmail,
        assignment_status: 'pending',
      }
      if (teamType === '1guide') {
        updateData.assistant_id = null
      }
      
      const { error } = await (supabase as any)
        .from('tours')
        .update(updateData as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error updating guide:', error)
        alert('가이드 배정 업데이트 중 오류가 발생했습니다.')
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating guide:', error)
      alert('가이드 배정 업데이트 중 오류가 발생했습니다.')
      return false
    }
  }, [])

  // 어시스턴트 선택 함수
  const handleAssistantSelect = useCallback(async (tour: { id: string }, assistantEmail: string) => {
    if (!tour) return

    try {
      const { data: currentTour } = await (supabase as any)
        .from('tours')
        .select('assistant_assignment_locked')
        .eq('id', tour.id)
        .maybeSingle()

      if (isAssistantAssignmentLocked(currentTour)) {
        return false
      }

      // assistant_id는 team 테이블의 email 값을 직접 저장
      const { error } = await supabase
        .from('tours')
        .update({
          assistant_id: assistantEmail,
          assignment_status: 'pending',
        } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error updating assistant:', error)
        alert('어시스턴트 배정 업데이트 중 오류가 발생했습니다.')
        return false
      }

      return true
    } catch (error) {
      console.error('Error updating assistant:', error)
      alert('어시스턴트 배정 업데이트 중 오류가 발생했습니다.')
      return false
    }
  }, [])

  // 투어 노트 변경 함수
  const handleStaffAssignmentLockChange = useCallback(
    async (
      tour: {
        id: string
        guide_assignment_locked?: boolean | null
        assistant_assignment_locked?: boolean | null
      },
      patch: { guide_assignment_locked?: boolean; assistant_assignment_locked?: boolean },
    ) => {
      if (!tour) return false

      try {
        const { error } = await (supabase as any)
          .from('tours')
          .update(patch as Database['public']['Tables']['tours']['Update'])
          .eq('id', tour.id)

        if (error) {
          console.error('Error updating staff assignment lock:', error)
          alert('배정 고정 상태 업데이트 중 오류가 발생했습니다.')
          return false
        }

        emitStaffAssignmentLockChanged({
          tourId: tour.id,
          guide_assignment_locked:
            patch.guide_assignment_locked ?? isGuideAssignmentLocked(tour),
          assistant_assignment_locked:
            patch.assistant_assignment_locked ?? isAssistantAssignmentLocked(tour),
        })
        return true
      } catch (error) {
        console.error('Error updating staff assignment lock:', error)
        alert('배정 고정 상태 업데이트 중 오류가 발생했습니다.')
        return false
      }
    },
    [],
  )

  const handleTourNoteChange = useCallback(async (tour: { id: string }, note: string) => {
    if (!tour) return

    try {
      const { error } = await supabase
        .from('tours')
        .update({ tour_note: note } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error updating tour note:', error)
      }
    } catch (error) {
      console.error('Error updating tour note:', error)
    }
  }, [])

  /** 다른 투어 reservation_ids에서 제거 후 대상 투어에 추가 (같은 날/상품 내 재배정) */
  const handleMoveReservationBetweenTours = useCallback(
    async (reservationId: string, fromTourId: string, toTourId: string) => {
      const rid = String(reservationId).trim()
      if (!rid || fromTourId === toTourId) return null

      try {
        const assigned = await exclusiveAssignReservationsToTour({
          tourId: toTourId,
          reservationIds: [rid],
          includeRelatedParty: true,
        })
        if (!assigned) return null

        const { data: fromRow, error: fromErr } = await supabase
          .from('tours')
          .select('reservation_ids')
          .eq('id', fromTourId)
          .maybeSingle()
        if (fromErr) {
          console.error('handleMoveReservationBetweenTours fetch from:', fromErr)
        }

        return {
          newFromIds: dedupeReservationIdsPreservingOrder(fromRow?.reservation_ids),
          newToIds: assigned.targetReservationIds,
        }
      } catch (error) {
        console.error('handleMoveReservationBetweenTours:', error)
        return null
      }
    },
    []
  )

  // 예약 배정 함수
  const handleAssignReservation = useCallback(
    async (tour: { id: string; reservation_ids?: unknown }, reservationId: string) => {
      if (!tour) return

      const rid = String(reservationId).trim()
      if (!rid) return

      try {
        const assigned = await exclusiveAssignReservationsToTour({
          tourId: tour.id,
          reservationIds: [rid],
          includeRelatedParty: true,
        })
        return assigned?.targetReservationIds
      } catch (error) {
        console.error('Error assigning reservation:', error)
        return undefined
      }
    },
    []
  )

  // 예약 배정 해제 함수
  const handleUnassignReservation = useCallback(async (tour: { id: string; reservation_ids?: string[] }, reservationId: string) => {
    if (!tour) return

    try {
      const rid = String(reservationId).trim()
      const currentReservationIds = dedupeReservationIdsPreservingOrder(tour.reservation_ids)
      const updatedReservationIds = currentReservationIds.filter(
        (id: string) => !reservationIdsLooselyEqual(id, rid)
      )

      if (updatedReservationIds.length === currentReservationIds.length) {
        console.error('Unassign: reservation id not found in tour reservation_ids', rid, currentReservationIds)
        return undefined
      }

      const { data: updatedRows, error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)
        .select('id')

      if (error) {
        console.error('Error unassigning reservation:', error)
        return undefined
      }

      if (!updatedRows?.length) {
        console.error('Unassign: tour update returned no rows (RLS or missing tour)', tour.id)
        return undefined
      }

      return updatedReservationIds
    } catch (error) {
      console.error('Error unassigning reservation:', error)
      return undefined
    }
  }, [])

  // 모든 예약 배정 함수
  const handleAssignAllReservations = useCallback(async (tour: { id: string; reservation_ids?: string[] }, pendingReservations: Array<{ id: string }>) => {
    if (!tour || pendingReservations.length === 0) return

    try {
      const pendingIds = [
        ...new Set(pendingReservations.map((r) => String(r.id).trim()).filter(Boolean)),
      ]
      if (pendingIds.length === 0) return

      const assigned = await exclusiveAssignReservationsToTour({
        tourId: tour.id,
        reservationIds: pendingIds,
        includeRelatedParty: true,
      })
      return assigned?.targetReservationIds
    } catch (error) {
      console.error('Error assigning all reservations:', error)
      return undefined
    }
  }, [])

  // 해당일 같은 상품의 모든 투어에서 예약 배정 해제
  const handleUnassignAllReservations = useCallback(async (tour: {
    id: string
    product_id?: string | null
    tour_date?: string | null
  }) => {
    if (!tour) return

    try {
      const productId = String(tour.product_id ?? '').trim()
      const tourDate = String(tour.tour_date ?? '').trim()

      const query = supabase
        .from('tours')
        .update({ reservation_ids: [] } as Database['public']['Tables']['tours']['Update'])

      const { error } =
        productId && tourDate
          ? await query.eq('product_id', productId).eq('tour_date', tourDate)
          : await query.eq('id', tour.id)

      if (error) {
        console.error('Error unassigning all reservations:', error)
        return
      }

      return []
    } catch (error) {
      console.error('Error unassigning all reservations:', error)
      return undefined
    }
  }, [])

  // 픽업 시간 저장 함수
  const handleSavePickupTime = useCallback(async (selectedReservation: { id: string }, pickupTimeValue: string, sendNotification: boolean = false) => {
    if (!selectedReservation) return

    try {
      const hhmm = timeToHHmm(pickupTimeValue || '')
      // 이미 HH:mm:ss 이면 :00 을 중복 붙이지 않음
      const timeValue = hhmm ? `${hhmm}:00` : null
      
      // 예약 정보 조회 (투어 날짜 확인용)
      const { data: reservationData, error: reservationFetchError } = await supabase
        .from('reservations')
        .select('tour_date')
        .eq('id', selectedReservation.id)
        .single()

      if (reservationFetchError) {
        console.error('Error fetching reservation:', reservationFetchError)
      }
      
      const { data: updatedRow, error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: timeValue } as Database['public']['Tables']['reservations']['Update'])
        .eq('id', selectedReservation.id)
        .select('id, pickup_time')
        .maybeSingle()

      if (error) {
        console.error('Error updating pickup time:', error)
        return false
      }

      if (!updatedRow) {
        console.error('Error updating pickup time: no rows updated (RLS or missing row)')
        return false
      }

      // 픽업 시간이 설정되었고 알림을 보내야 하는 경우
      if (timeValue && sendNotification && reservationData?.tour_date) {
        try {
          await fetchApiWithAuth('/api/send-pickup-schedule-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reservationId: selectedReservation.id,
              pickupTime: timeValue,
              tourDate: reservationData.tour_date
            })
          }).catch(error => {
            console.error('픽업 스케줄 알림 발송 오류 (무시):', error)
            // 알림 발송 실패해도 픽업 시간 저장은 성공한 것으로 처리
          })
        } catch (error) {
          console.error('픽업 스케줄 알림 발송 오류 (무시):', error)
        }
      }

      return true
    } catch (error) {
      console.error('Error saving pickup time:', error)
      return false
    }
  }, [])

  // 픽업 호텔 저장 함수
  const handleSavePickupHotel = useCallback(async (selectedReservation: { id: string }, newHotelId: string) => {
    if (!selectedReservation) return false

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ pickup_hotel: newHotelId } as Database['public']['Tables']['reservations']['Update'])
        .eq('id', selectedReservation.id)

      if (error) throw error

      return true
    } catch (error) {
      console.error('Error saving pickup hotel:', error)
      return false
    }
  }, [])

  // 차량 선택 핸들러 생성 함수
  const createVehicleSelectHandler = useCallback((
    tour: { id: string }, 
    setSelectedVehicleId: (id: string) => void, 
    vehicles: Array<{ id: string; name: string }>, 
    setAssignedVehicle: (vehicle: { id: string; name: string } | null) => void
  ) => {
    return async (vehicleId: string) => {
      if (!tour) return

      try {
        const selectedVehicle = vehicles.find(v => v.id === vehicleId)
        if (!selectedVehicle) return

        // 투어에 차량 배정 업데이트 (tour_car_id는 vehicles 테이블의 id를 저장)
        const { error } = await (supabase as any)
          .from('tours')
          .update({ tour_car_id: vehicleId } as Database['public']['Tables']['tours']['Update'])
          .eq('id', tour.id)

        if (error) {
          console.error('Error updating vehicle assignment:', error)
          alert('차량 배정 업데이트 중 오류가 발생했습니다.')
          return
        }

        setSelectedVehicleId(vehicleId)
        setAssignedVehicle(selectedVehicle)
      } catch (error) {
        console.error('Error updating vehicle assignment:', error)
        alert('차량 배정 업데이트 중 오류가 발생했습니다.')
      }
    }
  }, [])

  return {
    updatePrivateTourStatus,
    updateTourStatus,
    updateAssignmentStatus,
    handleTeamTypeChange,
    handleGuideSelect,
    handleAssistantSelect,
    handleStaffAssignmentLockChange,
    handleTourNoteChange,
    handleAssignReservation,
    handleMoveReservationBetweenTours,
    handleUnassignReservation,
    handleAssignAllReservations,
    handleUnassignAllReservations,
    handleSavePickupTime,
    handleSavePickupHotel,
    createVehicleSelectHandler
  }
}