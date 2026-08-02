'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, isAbortLikeError } from '@/lib/supabase'
import type {
  ReservationOption,
  CreateReservationOptionData,
  UpdateReservationOptionData,
} from '@/utils/reservationOptionsShared'

export function useReservationOptions(reservationId: string) {
  const [reservationOptions, setReservationOptions] = useState<ReservationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchReservationOptions = useCallback(async () => {
    if (!reservationId) return

    setLoading(true)
    setError(null)

    try {
      const { data: reservationOptions, error: fetchError } = await supabase
        .from('reservation_options')
        .select(
          'id, reservation_id, option_id, ea, price, total_price, status, note, created_at, updated_at'
        )
        .eq('reservation_id', reservationId)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      const optionIds = (reservationOptions || [])
        .map((option) => option.option_id)
        .filter(Boolean)
      let optionNames: Record<string, string> = {}

      if (optionIds.length > 0) {
        const { data: options, error: optionsError } = await supabase
          .from('options')
          .select('id, name')
          .in('id', optionIds)

        if (!optionsError && options) {
          optionNames = options.reduce(
            (acc, option) => {
              acc[option.id] = option.name
              return acc
            },
            {} as Record<string, string>
          )
        }
      }

      const transformedOptions: ReservationOption[] = (reservationOptions || []).map((option) => ({
        id: String(option.id),
        reservation_id: String(option.reservation_id),
        option_id: String(option.option_id),
        option_name: optionNames[option.option_id] || String(option.option_id),
        ea: Number(option.ea) || 0,
        price: Number(option.price) || 0,
        total_price: Number(option.total_price) || 0,
        status: (option.status || 'active') as ReservationOption['status'],
        ...(option.note != null && String(option.note).trim() !== '' ? { note: String(option.note) } : {}),
        created_at: String(option.created_at),
        updated_at: String(option.updated_at),
      }))

      setReservationOptions(transformedOptions)
    } catch (err) {
      if (!isAbortLikeError(err)) {
        console.error('Error fetching reservation options:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      setLoading(false)
    }
  }, [reservationId])

  // 새 reservation_option 생성
  const createReservationOption = useCallback(
    async (data: CreateReservationOptionData) => {
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
        setReservationOptions((prev) => [...prev, result.reservationOption])

        return result.reservationOption
      } catch (err) {
        console.error('Error creating reservation option:', err)
        throw err
      }
    },
    [reservationId]
  )

  // reservation_option 업데이트
  const updateReservationOption = useCallback(
    async (data: UpdateReservationOptionData) => {
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
        setReservationOptions((prev) =>
          prev.map((option) => (option.id === data.id ? result.reservationOption : option))
        )

        return result.reservationOption
      } catch (err) {
        console.error('Error updating reservation option:', err)
        throw err
      }
    },
    [reservationId]
  )

  // reservation_option 삭제
  const deleteReservationOption = useCallback(
    async (optionId: string) => {
      try {
        const response = await fetch(
          `/api/reservation-options/${reservationId}?optionId=${optionId}`,
          {
            method: 'DELETE',
          }
        )

        if (!response.ok) {
          throw new Error('Failed to delete reservation option')
        }

        // 로컬 상태 업데이트
        setReservationOptions((prev) => prev.filter((option) => option.id !== optionId))

        return true
      } catch (err) {
        console.error('Error deleting reservation option:', err)
        throw err
      }
    },
    [reservationId]
  )

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
