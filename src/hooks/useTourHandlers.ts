import React, { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { isTourCancelled } from '@/utils/tourStatusUtils'
import { normalizeReservationIds } from '@/utils/tourUtils'

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
        updatePayload.guide_fee = 0
        updatePayload.assistant_fee = 0
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
      // tour_guide_id는 team 테이블의 email 값을 직접 저장
      // 가이드 배정 시 assignment_status를 'assigned'로 설정
      const updateData: { tour_guide_id: string; assistant_id?: string | null; assignment_status?: string } = { 
        tour_guide_id: guideEmail,
        assignment_status: 'assigned'
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
      // assistant_id는 team 테이블의 email 값을 직접 저장
      const { error } = await supabase
        .from('tours')
        .update({ assistant_id: assistantEmail } as Database['public']['Tables']['tours']['Update'])
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

  // 예약 배정 함수
  const handleAssignReservation = useCallback(async (tour: { id: string }, reservationId: string) => {
    if (!tour) return

    const rid = String(reservationId).trim()
    if (!rid) return

    try {
      const { data: conflictRows, error: conflictErr } = await supabase
        .from('tours')
        .select('id')
        .contains('reservation_ids', [rid])
        .neq('id', tour.id)
        .limit(1)

      if (conflictErr) {
        console.error('handleAssignReservation conflict check:', conflictErr)
      } else if (conflictRows && conflictRows.length > 0) {
        alert(
          '이 예약은 이미 다른 투어에 배정되어 있습니다. 해당 투어에서 해제하거나, 이 화면에서 다른 투어에 배정된 예약을 이 투어로 옮기는 기능을 사용해 주세요.'
        )
        return
      }

      const currentReservationIds = normalizeReservationIds((tour as { reservation_ids?: unknown }).reservation_ids)
      if (currentReservationIds.includes(rid)) {
        return currentReservationIds
      }

      const updatedReservationIds = [...currentReservationIds, rid]

      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error assigning reservation:', error)
        return
      }

      return updatedReservationIds
    } catch (error) {
      console.error('Error assigning reservation:', error)
    }
  }, [])

  /** 다른 투어 reservation_ids에서 제거 후 대상 투어에 추가 (같은 날/상품 내 재배정) */
  const handleMoveReservationBetweenTours = useCallback(
    async (reservationId: string, fromTourId: string, toTourId: string) => {
      const rid = String(reservationId).trim()
      if (!rid || fromTourId === toTourId) return null

      try {
        const { data: rows, error: fetchError } = await supabase
          .from('tours')
          .select('id, reservation_ids')
          .in('id', [fromTourId, toTourId])

        if (fetchError || !rows?.length) {
          console.error('handleMoveReservationBetweenTours fetch:', fetchError)
          return null
        }

        const fromRow = rows.find((r) => r.id === fromTourId) as { id: string; reservation_ids?: unknown } | undefined
        const toRow = rows.find((r) => r.id === toTourId) as { id: string; reservation_ids?: unknown } | undefined
        if (!fromRow || !toRow) return null

        const normalizeIds = (raw: unknown): string[] => {
          if (!raw || !Array.isArray(raw)) return []
          return raw.map((x) => String(x).trim()).filter(Boolean)
        }

        const fromIds = normalizeIds(fromRow.reservation_ids)
        const toIds = normalizeIds(toRow.reservation_ids)
        const newFromIds = fromIds.filter((id) => id !== rid)
        const toUnique = [...new Set(toIds.filter((id) => id !== rid))]
        const newToIds = [...toUnique, rid]

        const { error: e1 } = await supabase
          .from('tours')
          .update({ reservation_ids: newFromIds } as Database['public']['Tables']['tours']['Update'])
          .eq('id', fromTourId)

        if (e1) {
          console.error('handleMoveReservationBetweenTours update from:', e1)
          alert('기존 투어에서 예약을 빼는 중 오류가 발생했습니다.')
          return null
        }

        const { error: e2 } = await supabase
          .from('tours')
          .update({ reservation_ids: newToIds } as Database['public']['Tables']['tours']['Update'])
          .eq('id', toTourId)

        if (e2) {
          console.error('handleMoveReservationBetweenTours update to:', e2)
          await supabase
            .from('tours')
            .update({ reservation_ids: fromIds } as Database['public']['Tables']['tours']['Update'])
            .eq('id', fromTourId)
          alert('새 투어에 예약을 넣는 중 오류가 발생했습니다.')
          return null
        }

        return { newFromIds, newToIds }
      } catch (error) {
        console.error('handleMoveReservationBetweenTours:', error)
        return null
      }
    },
    []
  )

  // 예약 배정 해제 함수
  const handleUnassignReservation = useCallback(async (tour: { id: string; reservation_ids?: string[] }, reservationId: string) => {
    if (!tour) return

    try {
      const rid = String(reservationId).trim()
      const currentReservationIds = normalizeReservationIds(tour.reservation_ids)
      const updatedReservationIds = currentReservationIds.filter((id: string) => id !== rid)

      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error unassigning reservation:', error)
        return
      }

      return updatedReservationIds
    } catch (error) {
      console.error('Error unassigning reservation:', error)
    }
  }, [])

  // 모든 예약 배정 함수
  const handleAssignAllReservations = useCallback(async (tour: { id: string; reservation_ids?: string[] }, pendingReservations: Array<{ id: string }>) => {
    if (!tour || pendingReservations.length === 0) return

    try {
      const currentReservationIds = normalizeReservationIds(tour.reservation_ids)
      const pendingIds = [
        ...new Set(pendingReservations.map((r) => String(r.id).trim()).filter(Boolean)),
      ]
      const toAdd = pendingIds.filter((id) => !currentReservationIds.includes(id))
      const conflictIds: string[] = []
      for (const pid of toAdd) {
        const { data: rows, error: qErr } = await supabase
          .from('tours')
          .select('id')
          .contains('reservation_ids', [pid])
          .neq('id', tour.id)
          .limit(1)
        if (qErr) {
          console.error('handleAssignAllReservations conflict check:', qErr)
          continue
        }
        if (rows && rows.length > 0) conflictIds.push(pid)
      }
      const addable = toAdd.filter((id) => !conflictIds.includes(id))
      if (conflictIds.length > 0) {
        alert(
          '일부 예약은 이미 다른 투어에 배정되어 있어 이 투어에는 추가하지 않았습니다. 필요하면 해당 투어에서 해제한 뒤 다시 시도해 주세요.'
        )
      }
      if (addable.length === 0) return

      const updatedReservationIds = [...currentReservationIds, ...addable]

      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: updatedReservationIds } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error assigning all reservations:', error)
        return
      }

      return updatedReservationIds
    } catch (error) {
      console.error('Error assigning all reservations:', error)
    }
  }, [])

  // 모든 예약 배정 해제 함수
  const handleUnassignAllReservations = useCallback(async (tour: { id: string }) => {
    if (!tour) return

    try {
      const { error } = await supabase
        .from('tours')
        .update({ reservation_ids: [] } as Database['public']['Tables']['tours']['Update'])
        .eq('id', tour.id)

      if (error) {
        console.error('Error unassigning all reservations:', error)
        return
      }

      return []
    } catch (error) {
      console.error('Error unassigning all reservations:', error)
    }
  }, [])

  // 픽업 시간 저장 함수
  const handleSavePickupTime = useCallback(async (selectedReservation: { id: string }, pickupTimeValue: string, sendNotification: boolean = false) => {
    if (!selectedReservation) return

    try {
      const timeValue = pickupTimeValue ? `${pickupTimeValue}:00` : null
      
      // 예약 정보 조회 (투어 날짜 확인용)
      const { data: reservationData, error: reservationFetchError } = await supabase
        .from('reservations')
        .select('tour_date')
        .eq('id', selectedReservation.id)
        .single()

      if (reservationFetchError) {
        console.error('Error fetching reservation:', reservationFetchError)
      }
      
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: timeValue } as Database['public']['Tables']['reservations']['Update'])
        .eq('id', selectedReservation.id)

      if (error) {
        console.error('Error updating pickup time:', error)
        return false
      }

      // 픽업 시간이 설정되었고 알림을 보내야 하는 경우
      if (timeValue && sendNotification && reservationData?.tour_date) {
        try {
          await fetch('/api/send-pickup-schedule-notification', {
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