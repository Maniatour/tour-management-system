import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

export function useTourHandlers() {
  // 단독투어 상태 업데이트 함수
  const updatePrivateTourStatus = useCallback(async (tour: any, newValue: boolean) => {
    if (!tour) return false

    try {
      const updateData: Database['public']['Tables']['tours']['Update'] = { is_private_tour: newValue }
      const { error } = await (supabase as any)
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
  const updateTourStatus = useCallback(async (tour: any, newStatus: string, isStaff: boolean) => {
    try {
      if (!tour || !tour.id) {
        alert('투어 정보를 찾을 수 없습니다.')
        return
      }
      
      if (!isStaff) {
        alert('투어 상태를 변경할 권한이 없습니다.')
        return
      }
      
      const { error } = await (supabase as any)
        .from('tours')
        .update({ tour_status: newStatus })
        .eq('id', tour.id)

      if (error) {
        throw error
      }
      
    } catch (error) {
      console.error('투어 상태 업데이트 실패:', error)
      alert(`투어 상태 업데이트에 실패했습니다: ${(error as Error).message}`)
    }
  }, [])

  // 배정 상태 변경 함수
  const updateAssignmentStatus = useCallback(async (tour: any, newStatus: string, isStaff: boolean) => {
    try {
      if (!tour || !tour.id) {
        alert('투어 정보를 찾을 수 없습니다.')
        return
      }
      
      if (!isStaff) {
        alert('배정 상태를 변경할 권한이 없습니다.')
        return
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
      
    } catch (error) {
      console.error('배정 상태 업데이트 실패:', error)
      alert(`배정 상태 업데이트에 실패했습니다: ${(error as Error).message}`)
    }
  }, [])

  // 팀 타입 변경 함수
  const handleTeamTypeChange = useCallback(async (tour: any, type: '1guide' | '2guide' | 'guide+driver') => {
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
  const handleGuideSelect = useCallback(async (tour: any, guideEmail: string, teamType: string) => {
    if (!tour) return

    try {
      // tour_guide_id는 team 테이블의 email 값을 직접 저장
      const updateData: { tour_guide_id: string; assistant_id?: string | null } = { tour_guide_id: guideEmail }
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
  const handleAssistantSelect = useCallback(async (tour: any, assistantEmail: string) => {
    if (!tour) return

    try {
      // assistant_id는 team 테이블의 email 값을 직접 저장
      const { error } = await (supabase as any)
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
  const handleTourNoteChange = useCallback(async (tour: any, note: string) => {
    if (!tour) return

    try {
      const { error } = await (supabase as any)
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
  const handleAssignReservation = useCallback(async (tour: any, reservationId: string) => {
    if (!tour) return

    try {
      const currentReservationIds = (tour as any).reservation_ids || []
      const updatedReservationIds = [...currentReservationIds, reservationId]

      const { error } = await (supabase as any)
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

  // 예약 배정 해제 함수
  const handleUnassignReservation = useCallback(async (tour: any, reservationId: string) => {
    if (!tour) return

    try {
      const currentReservationIds = (tour as any).reservation_ids || []
      const updatedReservationIds = currentReservationIds.filter((id: string) => id !== reservationId)

      const { error } = await (supabase as any)
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
  const handleAssignAllReservations = useCallback(async (tour: any, pendingReservations: any[]) => {
    if (!tour || pendingReservations.length === 0) return

    try {
      const currentReservationIds = (tour as any).reservation_ids || []
      const newReservationIds = pendingReservations.map((r: any) => r.id)
      const updatedReservationIds = [...currentReservationIds, ...newReservationIds]

      const { error } = await (supabase as any)
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
  const handleUnassignAllReservations = useCallback(async (tour: any) => {
    if (!tour) return

    try {
      const { error } = await (supabase as any)
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
  const handleSavePickupTime = useCallback(async (selectedReservation: any, pickupTimeValue: string) => {
    if (!selectedReservation) return

    try {
      const timeValue = pickupTimeValue ? `${pickupTimeValue}:00` : null
      
      const { error } = await (supabase as any)
        .from('reservations')
        .update({ pickup_time: timeValue } as Database['public']['Tables']['reservations']['Update'])
        .eq('id', selectedReservation.id)

      if (error) {
        console.error('Error updating pickup time:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error saving pickup time:', error)
      return false
    }
  }, [])

  // 픽업 호텔 저장 함수
  const handleSavePickupHotel = useCallback(async (selectedReservation: any, newHotelId: string) => {
    if (!selectedReservation) return false

    try {
      const { error } = await (supabase as any)
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
  const createVehicleSelectHandler = useCallback((tour: any, setSelectedVehicleId: any, vehicles: any[], setAssignedVehicle: any) => {
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
    handleUnassignReservation,
    handleAssignAllReservations,
    handleUnassignAllReservations,
    handleSavePickupTime,
    handleSavePickupHotel,
    createVehicleSelectHandler
  }
}