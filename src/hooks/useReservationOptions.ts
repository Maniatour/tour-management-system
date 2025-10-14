import React, { useState, useEffect, useCallback } from 'react'

export interface ReservationOption {
  id: string
  reservation_id: string
  option_id: string
  option_name?: string
  ea: number
  price: number
  total_price: number
  status: 'active' | 'cancelled' | 'refunded' | null
  note?: string
  created_at: string
  updated_at: string
}

export interface CreateReservationOptionData {
  option_id: string
  ea?: number
  price?: number
  total_price?: number
  status?: 'active' | 'cancelled' | 'refunded'
  note?: string
}

export interface UpdateReservationOptionData extends CreateReservationOptionData {
  id: string
}

export function useReservationOptions(reservationId: string) {
  const [reservationOptions, setReservationOptions] = useState<ReservationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // reservation_options 데이터 가져오기
  const fetchReservationOptions = useCallback(async () => {
    if (!reservationId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/reservation-options/${reservationId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch reservation options')
      }

      const data = await response.json()
      setReservationOptions(data.reservationOptions || [])
    } catch (err) {
      console.error('Error fetching reservation options:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  // 새 reservation_option 생성
  const createReservationOption = useCallback(async (data: CreateReservationOptionData) => {
    try {
      const response = await fetch(`/api/reservation-options/${reservationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to create reservation option')
      }

      const result = await response.json()
      
      // 로컬 상태 업데이트
      setReservationOptions(prev => [...prev, result.reservationOption])
      
      return result.reservationOption
    } catch (err) {
      console.error('Error creating reservation option:', err)
      throw err
    }
  }, [reservationId])

  // reservation_option 업데이트
  const updateReservationOption = useCallback(async (data: UpdateReservationOptionData) => {
    try {
      const response = await fetch(`/api/reservation-options/${reservationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update reservation option')
      }

      const result = await response.json()
      
      // 로컬 상태 업데이트
      setReservationOptions(prev => 
        prev.map(option => 
          option.id === data.id ? result.reservationOption : option
        )
      )
      
      return result.reservationOption
    } catch (err) {
      console.error('Error updating reservation option:', err)
      throw err
    }
  }, [reservationId])

  // reservation_option 삭제
  const deleteReservationOption = useCallback(async (optionId: string) => {
    try {
      const response = await fetch(`/api/reservation-options/${reservationId}?optionId=${optionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete reservation option')
      }

      // 로컬 상태 업데이트
      setReservationOptions(prev => prev.filter(option => option.id !== optionId))
      
      return true
    } catch (err) {
      console.error('Error deleting reservation option:', err)
      throw err
    }
  }, [reservationId])

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchReservationOptions()
  }, [fetchReservationOptions])

  return {
    reservationOptions,
    loading,
    error,
    fetchReservationOptions,
    createReservationOption,
    updateReservationOption,
    deleteReservationOption,
    setReservationOptions,
  }
}
