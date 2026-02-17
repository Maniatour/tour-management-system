'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'
import { autoCreateOrUpdateTour } from '@/lib/tourAutoCreation'
import { createTourPhotosBucket } from '@/lib/tourPhotoBucket'
import { Plus, Calendar, Users, MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import type { Reservation } from '@/types/reservation'

interface Tour {
  id: string
  product_id: string
  tour_date: string
  tour_guide_id?: string
  assistant_id?: string
  tour_car_id?: string
  reservation_ids: string[]
  tour_status: string
  tour_start_datetime?: string
  tour_end_datetime?: string
  guide_fee?: number
  assistant_fee?: number
  tour_note?: string
  is_private_tour?: boolean
  created_at: string
  // 가이드 정보
  guide?: {
    name_ko: string
    name_en: string | null
  }
  assistant?: {
    name_ko: string
    name_en: string | null
  }
  // 차량 정보
  vehicle?: {
    vehicle_number: string
  }
}

interface TourConnectionSectionProps {
  reservation: Reservation
  onTourCreated?: () => void
}

export default function TourConnectionSection({ reservation, onTourCreated }: TourConnectionSectionProps) {
  const t = useTranslations('reservations')
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingTour, setCreatingTour] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 가이드 정보를 별도로 가져오는 함수 (email 기준 조회, 결과 없음은 에러로 로깅하지 않음)
  const fetchGuideInfo = async (guideIdOrEmail: string | null) => {
    if (!guideIdOrEmail?.trim()) return null

    const value = guideIdOrEmail.trim()
    try {
      // maybeSingle 사용: 결과 0건이어도 에러가 아니므로 "Both failed" 로그 방지
      const { data: directData, error: directError } = await supabase
        .from('team')
        .select('name_ko, name_en, nick_name')
        .eq('email', value)
        .maybeSingle()

      if (!directError && directData) return directData

      // 실제 에러(RLS/네트워크 등)인 경우에만 RPC 폴백 시도. PGRST116(0 rows)은 무시
      if (directError && directError.code !== 'PGRST116') {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_team_member_info', { p_email: value })
        if (!rpcError && rpcData && rpcData.length > 0) return rpcData[0]
        if (rpcError) {
          console.error('RPC get_team_member_info failed:', rpcError.message, rpcError.code)
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching guide info:', error)
      return null
    }
  }

  // 차량 정보를 가져오는 함수
  const fetchVehicleInfo = async (vehicleId: string | null) => {
    if (!vehicleId) return null
    
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('vehicle_number')
        .eq('id', vehicleId)
        .maybeSingle()
      
      if (error) {
        // PGRST116 에러는 결과가 없을 때 발생하는 정상적인 경우이므로 조용히 처리
        if (error.code !== 'PGRST116') {
          console.error('Error fetching vehicle info:', error)
        }
        return null
      }
      
      return data
    } catch (error) {
      // 에러가 발생해도 조용히 처리 (차량 정보가 없는 경우)
      return null
    }
  }

  // 같은 날짜, 같은 상품의 투어들 가져오기
  useEffect(() => {
    const fetchTours = async () => {
      if (!reservation.productId || !reservation.tourDate) {
        setLoading(false)
        setError(null)
        return
      }

      try {
        setError(null)
        console.log('Fetching tours for:', {
          productId: reservation.productId,
          tourDate: reservation.tourDate
        })

        const { data, error } = await supabase
          .from('tours')
          .select('*')
          .eq('product_id', reservation.productId)
          .eq('tour_date', reservation.tourDate)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error fetching tours:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          setError(`투어 정보를 가져오는 중 오류가 발생했습니다: ${error.message}`)
          setTours([])
          return
        }

        console.log('Fetched tours:', data)
        
        // 가이드 정보와 차량 정보를 추가로 가져오기
        if (data && data.length > 0) {
          const toursWithGuides = await Promise.all(
            data.map(async (tour) => {
              const guide = await fetchGuideInfo(tour.tour_guide_id)
              const assistant = await fetchGuideInfo(tour.assistant_id)
              const vehicle = await fetchVehicleInfo(tour.tour_car_id)
              
              return {
                ...tour,
                guide,
                assistant,
                vehicle
              }
            })
          )
          
          setTours(toursWithGuides)
        } else {
          setTours([])
        }
      } catch (error) {
        console.error('Error fetching tours:', error)
        setError('투어 정보를 가져오는 중 오류가 발생했습니다.')
        setTours([])
      } finally {
        setLoading(false)
      }
    }

    fetchTours()
  }, [reservation.productId, reservation.tourDate])

  // 투어 생성 함수
  const handleCreateTour = async () => {
    if (!reservation.productId || !reservation.tourDate || !reservation.id) return

    setCreatingTour(true)
    setError(null)
    try {
      const result = await autoCreateOrUpdateTour(
        reservation.productId,
        reservation.tourDate,
        reservation.id,
        reservation.isPrivateTour
      )

      if (result.success) {
        // 투어 생성 성공 시 tour-photos 버켓도 생성
        const bucketCreated = await createTourPhotosBucket()
        if (!bucketCreated) {
          console.warn('Failed to create tour-photos bucket, but tour creation succeeded')
        }
        
        alert('투어가 성공적으로 생성되었습니다!')
        
        // 투어 목록 새로고침
        try {
          const { data, error } = await supabase
            .from('tours')
            .select('*')
            .eq('product_id', reservation.productId)
            .eq('tour_date', reservation.tourDate)
            .order('created_at', { ascending: true })

          if (error) {
            console.error('Error refreshing tours after creation:', error)
          } else if (data && data.length > 0) {
            // 가이드 정보와 차량 정보를 추가로 가져오기
            const toursWithGuides = await Promise.all(
              data.map(async (tour) => {
                const guide = await fetchGuideInfo(tour.tour_guide_id)
                const assistant = await fetchGuideInfo(tour.assistant_id)
                const vehicle = await fetchVehicleInfo(tour.tour_car_id)
                
                return {
                  ...tour,
                  guide,
                  assistant,
                  vehicle
                }
              })
            )
            
            setTours(toursWithGuides)
          } else {
            setTours([])
          }
        } catch (refreshError) {
          console.error('Error refreshing tours after creation:', refreshError)
        }

        // 부모 컴포넌트에 알림
        if (onTourCreated) {
          onTourCreated()
        }
      } else {
        setError('투어 생성 중 오류가 발생했습니다: ' + result.message)
        alert('투어 생성 중 오류가 발생했습니다: ' + result.message)
      }
    } catch (error) {
      console.error('Error creating tour:', error)
      setError('투어 생성 중 오류가 발생했습니다.')
      alert('투어 생성 중 오류가 발생했습니다.')
    } finally {
      setCreatingTour(false)
    }
  }

  // 투어 상태에 따른 색상 반환
  const getTourStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 투어 상태 한글 변환
  const getTourStatusText = (status: string) => {
    switch (status) {
      case 'scheduled':
        return '예정'
      case 'in_progress':
        return '진행중'
      case 'completed':
        return '완료'
      case 'cancelled':
        return '취소'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xs font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-1.5" />
          연결된 투어
        </h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xs font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-1.5" />
          연결된 투어
        </h3>
        <div className="text-center py-8 text-red-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <p className="text-lg font-medium mb-2">오류가 발생했습니다</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              // useEffect가 다시 실행되도록 강제 새로고침
              window.location.reload()
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-900 flex items-center">
          <Calendar className="w-3.5 h-3.5 mr-1.5" />
          연결된 투어
        </h3>
        {tours.length === 0 && (
          <button
            onClick={handleCreateTour}
            disabled={creatingTour}
            className="flex items-center px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {creatingTour ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
            ) : (
              <Plus className="w-3 h-3 mr-1" />
            )}
            투어 생성
          </button>
        )}
      </div>

      {tours.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium mb-1">연결된 투어가 없습니다</p>
          <p className="text-xs mb-3">
            {reservation.tourDate}에 {reservation.productId} 상품의 투어가 존재하지 않습니다.
          </p>
          <button
            onClick={handleCreateTour}
            disabled={creatingTour}
            className="flex items-center mx-auto px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {creatingTour ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
            ) : (
              <Plus className="w-3 h-3 mr-2" />
            )}
            투어 생성하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tours.map((tour) => {
            const isAssignedToThisTour = tour.reservation_ids?.includes(reservation.id)
            
            return (
                <div
                key={tour.id}
                onClick={() => {
                  const locale = window.location.pathname.split('/')[1]
                  window.location.href = `/${locale}/admin/tours/${tour.id}`
                }}
                className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow ${
                  isAssignedToThisTour 
                    ? 'border-green-500 bg-green-50 hover:bg-green-100' 
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTourStatusColor(tour.tour_status)}`}>
                      {getTourStatusText(tour.tour_status)}
                    </span>
                    {isAssignedToThisTour && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        배정됨
                      </span>
                    )}
                    {tour.is_private_tour && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        단독투어
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-2 text-gray-400" />
                    <span>{tour.tour_date}</span>
                    {tour.tour_start_datetime && (
                      <>
                        <Clock className="w-3 h-3 ml-3 mr-1 text-gray-400" />
                        <span>
                          {new Date(tour.tour_start_datetime).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center">
                      <Users className="w-3 h-3 mr-1 text-gray-400" />
                      <span className="font-medium">총인원:</span>
                      <span className="ml-1">{tour.reservation_ids?.length || 0}명</span>
                    </div>

                    {tour.guide && (
                      <div className="flex items-center">
                        <Users className="w-3 h-3 mr-1 text-gray-400" />
                        <span className="font-medium">가이드:</span>
                        <span className="ml-1">{(tour.guide as any).nick_name || tour.guide.name_ko}</span>
                      </div>
                    )}

                    {tour.assistant && (
                      <div className="flex items-center">
                        <Users className="w-3 h-3 mr-1 text-gray-400" />
                        <span className="font-medium">어시스턴트:</span>
                        <span className="ml-1">{(tour.assistant as any).nick_name || tour.assistant.name_ko}</span>
                      </div>
                    )}

                    {tour.vehicle && (
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                        <span className="font-medium">차량:</span>
                        <span className="ml-1">{tour.vehicle.vehicle_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {tour.tour_note && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700">
                    <strong>메모:</strong> {tour.tour_note}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
