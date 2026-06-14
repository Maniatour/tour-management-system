'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type ReservationRow = Database['public']['Tables']['reservations']['Row']

interface TourReservationManagerProps {
  tourId: string
  productId: string
  tourDate: string
  reservationIds: string[]
}

interface ReservationGroup {
  title: string
  reservations: ReservationRow[]
  count: number
}

export default function TourReservationManager({
  tourId,
  productId,
  tourDate,
  reservationIds
}: TourReservationManagerProps) {
  const [reservationGroups, setReservationGroups] = useState<ReservationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReservationGroups()
  }, [tourId, productId, tourDate, reservationIds])

  const loadReservationGroups = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 Loading reservation groups for tour:', tourId)
      console.log('📋 Product ID:', productId, 'Tour Date:', tourDate)
      console.log('📋 Reservation IDs:', reservationIds)

      // 1. 이 투어에 배정된 예약들 (reservation_ids에 있는 예약들)
      const allAssignedReservations = await loadAssignedReservations(reservationIds)
      console.log('✅ All assigned reservations:', allAssignedReservations.length)

      // cancelled 상태의 예약 분리
      const isCancelled = (status: string | null | undefined): boolean => {
        if (!status) return false
        const normalizedStatus = String(status).toLowerCase().trim()
        return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled' || normalizedStatus.includes('cancel')
      }

      const assignedReservations = allAssignedReservations.filter(r => !isCancelled(r.status))
      const cancelledFromAssigned = allAssignedReservations.filter(r => isCancelled(r.status))
      console.log('✅ Active assigned reservations:', assignedReservations.length)
      console.log('✅ Cancelled from assigned:', cancelledFromAssigned.length)

      // 2. 다른 투어에 배정된 예약들 (같은 상품/날짜의 다른 투어들)
      const allOtherToursReservations = await loadOtherToursReservations()
      console.log('✅ All other tours reservations:', allOtherToursReservations.length)

      // 다른 투어에 배정된 예약에서도 cancelled 상태 분리
      const otherToursReservations = allOtherToursReservations.filter(r => !isCancelled(r.status))
      const cancelledFromOtherTours = allOtherToursReservations.filter(r => isCancelled(r.status))
      console.log('✅ Active other tours reservations:', otherToursReservations.length)
      console.log('✅ Cancelled from other tours:', cancelledFromOtherTours.length)

      // 3. 어느 투어에도 배정되지 않은 예약들 (event_id가 비어있는 예약들)
      const unassignedReservations = await loadUnassignedReservations()
      console.log('✅ Unassigned reservations:', unassignedReservations.length)

      // 4. 취소/기타 상태 예약들 (confirmed, recruiting이 아닌 예약들)
      const inactiveReservations = await loadInactiveReservations()
      console.log('✅ Inactive reservations:', inactiveReservations.length)

      // cancelled 상태의 예약들을 inactiveReservations에 추가 (중복 제거)
      const allCancelledReservations = [...cancelledFromAssigned, ...cancelledFromOtherTours]
      const cancelledReservationIds = new Set(allCancelledReservations.map(r => r.id))
      const inactiveWithoutCancelled = inactiveReservations.filter(r => !cancelledReservationIds.has(r.id))
      const allInactiveReservations = [...inactiveWithoutCancelled, ...allCancelledReservations]

      // 그룹별로 정리
      const groups: ReservationGroup[] = [
        {
          title: '1. 이 투어에 배정된 예약',
          reservations: assignedReservations,
          count: assignedReservations.length
        },
        {
          title: '2. 다른 투어에 배정된 예약',
          reservations: otherToursReservations,
          count: otherToursReservations.length
        },
        {
          title: '3. 어느 투어에도 배정되지 않은 예약',
          reservations: unassignedReservations,
          count: unassignedReservations.length
        },
        {
          title: '4. 취소/기타 상태 예약',
          reservations: allInactiveReservations,
          count: allInactiveReservations.length
        }
      ]

      setReservationGroups(groups)
    } catch (err) {
      console.error('❌ Error loading reservation groups:', err)
      setError('예약 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 1. 이 투어에 배정된 예약들
  const loadAssignedReservations = async (reservationIds: string[]): Promise<ReservationRow[]> => {
    if (reservationIds.length === 0) return []

    console.log('🔍 Loading assigned reservations by IDs:', reservationIds)
    
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .in('id', reservationIds)

    if (error) {
      console.error('Error loading assigned reservations:', error)
      return []
    }

    console.log('📊 Assigned reservations found:', data?.length || 0)
    return data || []
  }

  // 2. 다른 투어에 배정된 예약들
  const loadOtherToursReservations = async (): Promise<ReservationRow[]> => {
    console.log('🔍 Loading other tours reservations...')

    // 같은 상품/날짜의 다른 투어들 조회
    const { data: otherTours, error: toursError } = await supabase
      .from('tours')
      .select('reservation_ids')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)
      .neq('id', tourId)

    if (toursError) {
      console.error('Error loading other tours:', toursError)
      return []
    }

    // 다른 투어들의 reservation_ids 수집
    const otherReservationIds: string[] = []
    otherTours?.forEach(tour => {
      if (tour.reservation_ids) {
        const ids = normalizeReservationIds(tour.reservation_ids)
        otherReservationIds.push(...ids)
      }
    })

    console.log('📊 Other tours reservation IDs:', otherReservationIds)

    if (otherReservationIds.length === 0) return []

    // 해당 예약들 조회
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .in('id', otherReservationIds)

    if (error) {
      console.error('Error loading other tours reservations:', error)
      return []
    }

    console.log('📊 Other tours reservations found:', data?.length || 0)
    return data || []
  }

  // 3. 어느 투어에도 배정되지 않은 예약들
  const loadUnassignedReservations = async (): Promise<ReservationRow[]> => {
    console.log('🔍 Loading unassigned reservations...')

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)
      .is('event_id', null)

    if (error) {
      console.error('Error loading unassigned reservations:', error)
      return []
    }

    console.log('📊 Unassigned reservations found:', data?.length || 0)
    return data || []
  }

  // 4. 취소/기타 상태 예약들
  const loadInactiveReservations = async (): Promise<ReservationRow[]> => {
    console.log('🔍 Loading inactive reservations...')

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('product_id', productId)
      .eq('tour_date', tourDate)
      .not('status', 'in', '(confirmed,recruiting)')

    if (error) {
      console.error('Error loading inactive reservations:', error)
      return []
    }

    console.log('📊 Inactive reservations found:', data?.length || 0)
    return data || []
  }

  // reservation_ids 정규화 함수
  const normalizeReservationIds = (reservationIds: any): string[] => {
    if (!reservationIds) return []
    
    if (Array.isArray(reservationIds)) {
      return reservationIds.map(id => String(id).trim()).filter(id => id.length > 0)
    }
    
    if (typeof reservationIds === 'string') {
      const trimmed = reservationIds.trim()
      
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed)
          return Array.isArray(parsed) ? parsed.map((v: unknown) => String(v).trim()).filter((v: string) => v.length > 0) : []
        } catch {
          return []
        }
      }
      
      if (trimmed.includes(',')) {
        return trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0)
      }
      
      return trimmed.length > 0 ? [trimmed] : []
    }
    
    return []
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-200 h-20 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {reservationGroups.map((group, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {group.title} ({group.count})
          </h3>
          
          {group.reservations.length === 0 ? (
            <p className="text-gray-500 text-sm">해당하는 예약이 없습니다.</p>
          ) : (
            <div className="grid gap-3">
              {group.reservations.map((reservation) => (
                <div key={reservation.id} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">
                        예약 ID: {reservation.id}
                      </p>
                      <p className="text-sm text-gray-600">
                        상태: {reservation.status || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        인원: {reservation.total_people || 0}명
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        고객: {reservation.customer_id || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        채널: {reservation.channel_id || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
