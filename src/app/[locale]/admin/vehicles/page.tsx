'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Search, Calendar, Car, Wrench, DollarSign, Edit, Trash2, Eye, Copy, Settings } from 'lucide-react'
import dynamic from 'next/dynamic'
import VehicleEditModal from '@/components/VehicleEditModal'
// 차종 관리 모달은 lazy load로 최적화
const VehicleTypeManagementModal = dynamic(() => import('@/components/VehicleTypeManagementModal'), {
  ssr: false,
  loading: () => null
})
// 렌터카 관리 모달은 더 이상 필요하지 않음
import { supabase } from '@/lib/supabase'

interface VehiclePhoto {
  id: string
  vehicle_id: string
  photo_url: string
  photo_name?: string
  description?: string
  is_primary: boolean
  display_order: number
  created_at: string
  updated_at: string
}

interface Vehicle {
  id: string
  vehicle_number: string
  vin?: string
  vehicle_type: string
  capacity: number
  year: number
  mileage_at_purchase: number
  purchase_amount: number
  purchase_date?: string
  memo?: string
  engine_oil_change_cycle: number
  current_mileage: number
  recent_engine_oil_change_mileage: number
  vehicle_status: string
  front_tire_size?: string
  rear_tire_size?: string
  windshield_wiper_size?: string
  headlight_model?: string
  headlight_model_name?: string
  is_installment: boolean
  installment_amount: number
  interest_rate: number
  monthly_payment: number
  additional_payment: number
  payment_due_date?: string
  installment_start_date?: string
  installment_end_date?: string
  vehicle_image_url?: string
  color?: string
  created_at: string
  updated_at: string
  photos?: VehiclePhoto[]
  // 렌터카 관련 필드 (간소화)
  vehicle_category?: string
  rental_company?: string
  daily_rate?: number
  rental_start_date?: string
  rental_end_date?: string
  rental_pickup_location?: string
  rental_return_location?: string
  rental_total_cost?: number
  rental_status?: string
  rental_notes?: string
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'company' | 'rental_active' | 'rental_returned' | 'vehicle_types'>('company')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [isVehicleTypeModalOpen, setIsVehicleTypeModalOpen] = useState(false)
  // 렌터카 관리 모달 상태 제거

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true)
      
      // 1. 먼저 vehicles만 빠르게 가져오기 (인덱스 활용 최적화)
      // 필요한 컬럼만 선택하여 네트워크 전송량 최소화
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select(`
          id,
          vehicle_number,
          vin,
          vehicle_type,
          capacity,
          year,
          mileage_at_purchase,
          purchase_amount,
          purchase_date,
          memo,
          engine_oil_change_cycle,
          current_mileage,
          recent_engine_oil_change_mileage,
          vehicle_status,
          front_tire_size,
          rear_tire_size,
          windshield_wiper_size,
          headlight_model,
          headlight_model_name,
          is_installment,
          installment_amount,
          interest_rate,
          monthly_payment,
          additional_payment,
          payment_due_date,
          installment_start_date,
          installment_end_date,
          vehicle_image_url,
          color,
          vehicle_category,
          rental_company,
          daily_rate,
          rental_start_date,
          rental_end_date,
          rental_pickup_location,
          rental_return_location,
          rental_total_cost,
          rental_status,
          rental_notes,
          created_at,
          updated_at
        `)
        // 인덱스가 있는 created_at으로 정렬 (인덱스 활용)
        .order('created_at', { ascending: false })

      if (vehiclesError) {
        console.error('차량 목록 조회 오류:', vehiclesError)
        throw vehiclesError
      }

      if (!vehiclesData || vehiclesData.length === 0) {
        setVehicles([])
        return
      }
      
      // 2. vehicle_image_url이 있는 차량은 즉시 사진 설정 (빠른 처리)
      const vehiclesWithLegacyPhotos = vehiclesData.map(vehicle => {
        if (vehicle.vehicle_image_url) {
          return {
            ...vehicle,
            photos: [{
              id: 'legacy',
              vehicle_id: vehicle.id,
              photo_url: vehicle.vehicle_image_url,
              is_primary: true,
              display_order: 0
            }]
          }
        }
        return { ...vehicle, photos: [] }
      })
      
      // 3. vehicle_image_url이 없는 차량들만 vehicle_photos 배치 조회 (최적화)
      const vehiclesWithoutLegacyPhotos = vehiclesWithLegacyPhotos.filter(v => !v.vehicle_image_url)
      
      if (vehiclesWithoutLegacyPhotos.length > 0) {
        const vehicleIds = vehiclesWithoutLegacyPhotos.map(v => v.id)
        
        try {
          // 배치 크기 제한: 한 번에 너무 많은 ID를 조회하면 URL이 너무 길어져 500 에러 발생
          // Supabase PostgREST 제한을 고려하여 배치 크기를 20개로 제한 (더 안전)
          const BATCH_SIZE = 20
          const photosByVehicleId = new Map<string, any[]>()
          
          // 배치로 나눠서 조회
          for (let i = 0; i < vehicleIds.length; i += BATCH_SIZE) {
            const batchIds = vehicleIds.slice(i, i + BATCH_SIZE)
            
            try {
              const { data: batchPhotos, error: photosError } = await supabase
                .from('vehicle_photos')
                .select('id, vehicle_id, photo_url, photo_name, is_primary, display_order')
                .in('vehicle_id', batchIds)
                // 주의: order by는 URL을 더 길게 만들어 500 에러를 유발할 수 있으므로 제거
                // 클라이언트 사이드에서 정렬 처리
                .limit(1000) // 각 배치당 충분한 제한

              if (!photosError && batchPhotos && batchPhotos.length > 0) {
                // vehicle_id별로 그룹화 및 정렬 (클라이언트 사이드)
                batchPhotos
                  .sort((a, b) => {
                    // 먼저 vehicle_id로 정렬
                    if (a.vehicle_id !== b.vehicle_id) {
                      return a.vehicle_id.localeCompare(b.vehicle_id)
                    }
                    // 같은 vehicle_id 내에서 is_primary 우선, 그 다음 display_order
                    if (a.is_primary && !b.is_primary) return -1
                    if (!a.is_primary && b.is_primary) return 1
                    return (a.display_order || 0) - (b.display_order || 0)
                  })
                  .forEach(photo => {
                    if (!photosByVehicleId.has(photo.vehicle_id)) {
                      photosByVehicleId.set(photo.vehicle_id, [])
                    }
                    photosByVehicleId.get(photo.vehicle_id)!.push(photo)
                  })
              }
            } catch (batchError) {
              // 개별 배치 실패는 조용히 무시하고 다음 배치 계속 진행
              console.warn(`차량 사진 배치 조회 실패 (${i}-${i + BATCH_SIZE}):`, batchError)
            }
          }

          // 각 차량에 사진 할당
          vehiclesWithoutLegacyPhotos.forEach(vehicle => {
            const vehiclePhotos = photosByVehicleId.get(vehicle.id) || []
            if (vehiclePhotos.length > 0) {
              vehicle.photos = vehiclePhotos.sort((a, b) => {
                if (a.is_primary && !b.is_primary) return -1
                if (!a.is_primary && b.is_primary) return 1
                return (a.display_order || 0) - (b.display_order || 0)
              })
            }
          })
        } catch (photoError) {
          // 전체 vehicle_photos 조회 실패는 조용히 무시 (500 에러 등)
          console.warn('차량 사진 조회 중 오류 발생 (무시됨):', photoError)
        }
      }
      
      setVehicles(vehiclesWithLegacyPhotos)
    } catch (error) {
      console.error('차량 목록을 불러오는 중 오류가 발생했습니다:', error)
      setVehicles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVehicles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEditVehicle = useCallback((vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setIsEditModalOpen(true)
  }, [])

  const handleAddVehicle = useCallback(() => {
    setSelectedVehicle(null)
    setIsEditModalOpen(true)
  }, [])

  const handleCopyVehicle = useCallback((vehicle: Vehicle) => {
    // 차량 번호 중복 방지를 위한 타임스탬프 추가
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_')
    
    // 기존 차량 정보를 복사하되, ID와 생성일시는 제외
    const copiedVehicle = {
      ...vehicle,
      id: undefined,
      vehicle_number: `${vehicle.vehicle_number}_copy_${timestamp}`,
      created_at: undefined,
      updated_at: undefined,
      // 렌터카 관련 필드들만 유지하고 나머지는 초기화
      vehicle_category: 'rental',
      rental_company: vehicle.rental_company || '',
      daily_rate: vehicle.daily_rate || 0,
      rental_start_date: '',
      rental_end_date: '',
      rental_pickup_location: vehicle.rental_pickup_location || '',
      rental_return_location: vehicle.rental_return_location || '',
      rental_total_cost: 0,
      rental_status: 'available',
      rental_notes: vehicle.rental_notes || '',
      // 회사 차량 관련 필드들은 초기화
      year: new Date().getFullYear(),
      mileage_at_purchase: 0,
      purchase_amount: 0,
      purchase_date: '',
      engine_oil_change_cycle: 10000,
      current_mileage: 0,
      recent_engine_oil_change_mileage: 0,
      vehicle_status: '운행 가능',
      front_tire_size: '',
      rear_tire_size: '',
      windshield_wiper_size: '',
      headlight_model: '',
      headlight_model_name: '',
      is_installment: false,
      installment_amount: 0,
      interest_rate: 0,
      monthly_payment: 0,
      additional_payment: 0,
      payment_due_date: '',
      installment_start_date: '',
      installment_end_date: '',
      vehicle_image_url: '',
      memo: vehicle.memo || '',
      photos: undefined
    }
    setSelectedVehicle(copiedVehicle as Vehicle)
    setIsEditModalOpen(true)
  }, [])

  const handleDeleteVehicle = useCallback(async (vehicleId: string) => {
    if (!confirm('정말로 이 차량을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId)

      if (error) throw error
      
      setVehicles(vehicles.filter(v => v.id !== vehicleId))
      alert('차량이 성공적으로 삭제되었습니다.')
    } catch (error) {
      console.error('차량 삭제 중 오류가 발생했습니다:', error)
      alert('차량 삭제 중 오류가 발생했습니다.')
    }
  }, [vehicles])

  // 필터링된 차량 목록 계산 (메모이제이션으로 성능 최적화)
  // 인덱스를 활용한 서버 사이드 필터링은 복잡하므로 클라이언트 사이드 필터링 유지
  const filteredVehicles = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return []
    
    return vehicles.filter(vehicle => {
      // 검색어 필터링 (vehicle_number, vehicle_type 인덱스 활용 가능하지만 클라이언트 사이드 처리)
      const matchesSearch = !searchTerm || 
        vehicle.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vehicle.rental_company && vehicle.rental_company.toLowerCase().includes(searchTerm.toLowerCase()))
      
      // 탭별 필터링 (vehicle_category, rental_status 인덱스 활용)
      let matchesTab = true
      if (activeTab === 'company') {
        matchesTab = vehicle.vehicle_category === 'company' || !vehicle.vehicle_category
      } else if (activeTab === 'rental_active') {
        const status = vehicle.rental_status || ''
        matchesTab = vehicle.vehicle_category === 'rental' && 
                     status !== '' && 
                     ['reserved', 'picked_up', 'in_use'].includes(status)
      } else if (activeTab === 'rental_returned') {
        matchesTab = vehicle.vehicle_category === 'rental' && 
                     vehicle.rental_status === 'returned'
      } else if (activeTab === 'vehicle_types') {
        // 차종 관리 탭에서는 차량 목록을 표시하지 않음
        matchesTab = false
      }
      
      return matchesSearch && matchesTab
    })
  }, [vehicles, searchTerm, activeTab])

  // 상태 변경 함수 (useCallback으로 메모이제이션)
  const handleStatusChange = useCallback(async (vehicleId: string, newStatus: string) => {
    try {
      setUpdatingStatus(vehicleId)
      
      const { error } = await supabase
        .from('vehicles')
        .update({ vehicle_status: newStatus })
        .eq('id', vehicleId)

      if (error) throw error
      
      // 로컬 상태 업데이트
      setVehicles(vehicles.map(v => 
        v.id === vehicleId ? { ...v, vehicle_status: newStatus } : v
      ))
      
      console.log('차량 상태가 업데이트되었습니다:', newStatus)
    } catch (error) {
      console.error('차량 상태 변경 중 오류가 발생했습니다:', error)
      alert('차량 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setUpdatingStatus(null)
    }
  }, [vehicles])

  // 렌터카 상태 변경 함수 (useCallback으로 메모이제이션)
  const handleRentalStatusChange = useCallback(async (vehicleId: string, newStatus: string) => {
    try {
      setUpdatingStatus(vehicleId)
      
      const { error } = await supabase
        .from('vehicles')
        .update({ rental_status: newStatus })
        .eq('id', vehicleId)

      if (error) throw error
      
      // 로컬 상태 업데이트
      setVehicles(vehicles.map(v => 
        v.id === vehicleId ? { ...v, rental_status: newStatus } : v
      ))
      
      console.log('렌터카 상태가 업데이트되었습니다:', newStatus)
    } catch (error) {
      console.error('렌터카 상태 변경 중 오류가 발생했습니다:', error)
      alert('렌터카 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setUpdatingStatus(null)
    }
  }, [vehicles])

  const handleSaveVehicle = useCallback(async (vehicleData: Partial<Vehicle>) => {
    try {
      // 데이터베이스에 존재하는 필드만 필터링
      const allowedFields = [
        'vehicle_number', 'vin', 'vehicle_type', 'capacity', 'year',
        'mileage_at_purchase', 'purchase_amount', 'purchase_date', 'memo',
        'engine_oil_change_cycle', 'current_mileage', 'recent_engine_oil_change_mileage',
        'vehicle_status', 'front_tire_size', 'rear_tire_size', 'windshield_wiper_size',
        'headlight_model', 'headlight_model_name', 'is_installment', 'installment_amount',
        'interest_rate', 'monthly_payment', 'additional_payment', 'payment_due_date',
        'installment_start_date', 'installment_end_date', 'vehicle_image_url',
        'vehicle_category', 'rental_company', 'daily_rate', 'rental_start_date',
        'rental_end_date', 'rental_pickup_location', 'rental_return_location',
        'rental_total_cost', 'rental_status', 'rental_notes'
      ]
      
      // 날짜 필드 정리
      const cleanedData = { ...vehicleData }
      const dateFields = [
        'purchase_date', 
        'insurance_start_date', 
        'insurance_end_date', 
        'rental_start_date', 
        'rental_end_date'
      ]
      
      dateFields.forEach(field => {
        if (cleanedData[field as keyof Vehicle] === '' || 
            cleanedData[field as keyof Vehicle] === null) {
          cleanedData[field as keyof Vehicle] = null
        }
      })

      const filteredData = Object.keys(cleanedData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          const value = cleanedData[key as keyof Vehicle]
          // 빈 문자열을 null로 변환
          obj[key] = value === '' ? null : value
          return obj
        }, {} as Partial<Vehicle>)

      console.log('저장할 데이터:', filteredData)

      if (selectedVehicle) {
        // 수정
        const { error } = await supabase
          .from('vehicles')
          .update(filteredData)
          .eq('id', selectedVehicle.id)

        if (error) throw error
        
        setVehicles(vehicles.map(v => 
          v.id === selectedVehicle.id ? { ...v, ...filteredData } : v
        ))
      } else {
        // 추가
        const { data, error } = await supabase
          .from('vehicles')
          .insert([filteredData])
          .select()
          .single()

        if (error) throw error
        
        setVehicles([data, ...vehicles])
      }
      
      setIsEditModalOpen(false)
      setSelectedVehicle(null)
      alert('차량 정보가 성공적으로 저장되었습니다.')
    } catch (error) {
      console.error('차량 저장 중 오류가 발생했습니다:', error)
      console.error('오류 상세 정보:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      })
      alert(`차량 저장 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [selectedVehicle, vehicles])


  // 헬퍼 함수들을 useCallback으로 메모이제이션
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case '운행 가능': return 'bg-green-100 text-green-800'
      case '수리 중': return 'bg-yellow-100 text-yellow-800'
      case '대기 중': return 'bg-blue-100 text-blue-800'
      case '폐차': return 'bg-gray-100 text-gray-800'
      case '사용 종료': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getRentalStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'reserved': return 'bg-yellow-100 text-yellow-800'
      case 'picked_up': return 'bg-blue-100 text-blue-800'
      case 'in_use': return 'bg-purple-100 text-purple-800'
      case 'returned': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }, [])

  const getRentalStatusText = useCallback((status: string) => {
    switch (status) {
      case 'available': return '사용가능'
      case 'reserved': return '예약됨'
      case 'picked_up': return '픽업완료'
      case 'in_use': return '사용중'
      case 'returned': return '반납완료'
      case 'cancelled': return '취소됨'
      default: return status
    }
  }, [])

  const calculateRemainingInstallment = useCallback((vehicle: Vehicle) => {
    if (!vehicle.is_installment) return 0
    
    const monthlyPayment = vehicle.monthly_payment || 0
    const installmentAmount = vehicle.installment_amount || 0
    const totalPaid = monthlyPayment * 12 // 간단한 계산
    return Math.max(0, installmentAmount - totalPaid)
  }, [])

  const needsOilChange = useCallback((vehicle: Vehicle) => {
    const currentMileage = vehicle.current_mileage || 0
    const recentOilChangeMileage = vehicle.recent_engine_oil_change_mileage || 0
    const oilChangeCycle = vehicle.engine_oil_change_cycle || 10000
    return currentMileage - recentOilChangeMileage >= oilChangeCycle
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 - 모바일에서도 제목과 버튼 한 줄 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">차량 관리</h1>
          <p className="mt-1 text-sm text-gray-500 hidden sm:block">차량 정보와 예약 일정을 관리하세요</p>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={handleAddVehicle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} />
            차량 추가
          </button>
        </div>
      </div>

      {/* 탭과 검색 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-3 sm:p-4">
          {/* 탭 - 모바일 가로 스크롤 */}
          <div className="flex overflow-x-auto gap-1.5 sm:gap-1 mb-3 sm:mb-4 -mx-1 px-1 scrollbar-hide sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'company'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              회사차 ({vehicles.filter(v => v.vehicle_category === 'company' || !v.vehicle_category).length})
            </button>
            <button
              onClick={() => setActiveTab('rental_active')}
              className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'rental_active'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              렌터카 ({vehicles.filter(v => v.vehicle_category === 'rental' && v.rental_status && ['reserved', 'picked_up', 'in_use'].includes(v.rental_status)).length})
            </button>
            <button
              onClick={() => setActiveTab('rental_returned')}
              className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'rental_returned'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              렌터카(종료) ({vehicles.filter(v => v.vehicle_category === 'rental' && v.rental_status === 'returned').length})
            </button>
            <button
              onClick={() => {
                setActiveTab('vehicle_types')
                setIsVehicleTypeModalOpen(true)
              }}
              className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md flex items-center gap-1.5 sm:gap-2 ${
                activeTab === 'vehicle_types'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              차종 관리
            </button>
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="차량 번호, 차종, 렌터카 회사로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 sm:pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
        </div>
      </div>

      {/* 차량 목록 */}
      {activeTab !== 'vehicle_types' && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredVehicles.map((vehicle) => {
          // 대표사진 찾기
          const primaryPhoto = vehicle.photos?.find(photo => photo.is_primary)
          const firstPhoto = vehicle.photos?.[0]
          
          // 사진 URL 결정: vehicle_photos > vehicle_image_url
          let photoUrl: string | null = null
          if (primaryPhoto?.photo_url) {
            photoUrl = primaryPhoto.photo_url
          } else if (firstPhoto?.photo_url) {
            photoUrl = firstPhoto.photo_url
          } else if (vehicle.vehicle_image_url) {
            photoUrl = vehicle.vehicle_image_url
          }
          
          return (
            <div key={vehicle.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* 차량 사진 */}
              <div className="aspect-[4/3] bg-gray-200 flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={vehicle.vehicle_number}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 이미지 로드 실패 시 기본 아이콘 표시
                      e.currentTarget.style.display = 'none'
                      const parent = e.currentTarget.parentElement
                      if (parent && !parent.querySelector('.fallback-icon')) {
                        parent.innerHTML = `
                          <div class="flex flex-col items-center text-gray-400 fallback-icon">
                            <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path>
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path>
                            </svg>
                            <span class="text-sm">사진 없음</span>
                          </div>
                        `
                      }
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <Car className="w-12 h-12 mb-2" />
                    <span className="text-sm">사진 없음</span>
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {vehicle.vehicle_number}
                      </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(vehicle.vehicle_status || '운행 가능')}`}>
                      {vehicle.vehicle_status || '운행 가능'}
                    </span>
                    {activeTab === 'company' ? (
                      <select
                        value={vehicle.vehicle_status || '운행 가능'}
                        onChange={(e) => handleStatusChange(vehicle.id, e.target.value)}
                        disabled={updatingStatus === vehicle.id}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="운행 가능">운행 가능</option>
                        <option value="수리 중">수리 중</option>
                        <option value="대기 중">대기 중</option>
                        <option value="폐차">폐차</option>
                        <option value="사용 종료">사용 종료</option>
                      </select>
                    ) : activeTab === 'rental_active' ? (
                      <select
                        value={vehicle.rental_status || 'available'}
                        onChange={(e) => handleRentalStatusChange(vehicle.id, e.target.value)}
                        disabled={updatingStatus === vehicle.id}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        <option value="available">사용가능</option>
                        <option value="reserved">예약됨</option>
                        <option value="picked_up">픽업완료</option>
                        <option value="in_use">사용중</option>
                        <option value="returned">반납완료</option>
                        <option value="cancelled">취소됨</option>
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                        반납완료
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p><span className="font-medium">차종:</span> {vehicle.vehicle_type}</p>
                  <p><span className="font-medium">연식:</span> {vehicle.year}년식</p>
                  <p><span className="font-medium">탑승인원:</span> {vehicle.capacity}인승</p>
                  <p><span className="font-medium">현재 마일리지:</span> {vehicle.current_mileage?.toLocaleString() || 'N/A'} miles</p>
                  
                  {/* 렌터카 정보 */}
                  {(activeTab === 'rental_active' || activeTab === 'rental_returned') && (
                    <>
                      <p><span className="font-medium">렌터카 회사:</span> {vehicle.rental_company || 'N/A'}</p>
                      <p><span className="font-medium">일일 요금:</span> ${vehicle.daily_rate?.toLocaleString() || 'N/A'}</p>
                      <p><span className="font-medium">렌탈 기간:</span> {vehicle.rental_start_date || 'N/A'} ~ {vehicle.rental_end_date || 'N/A'}</p>
                      <p><span className="font-medium">총 비용:</span> ${vehicle.rental_total_cost?.toLocaleString() || 'N/A'}</p>
                      {vehicle.rental_notes && (
                        <p><span className="font-medium">메모:</span> {vehicle.rental_notes}</p>
                      )}
                    </>
                  )}
                  
                  {/* 회사차 정보 */}
                  {activeTab === 'company' && (
                    <>
                      {vehicle.is_installment && (
                        <p className="text-orange-600">
                          <span className="font-medium">할부중</span> (남은 금액: ${calculateRemainingInstallment(vehicle).toLocaleString()})
                        </p>
                      )}
                      
                      <p><span className="font-medium">구매:</span> ${vehicle.purchase_amount?.toLocaleString() || 'N/A'}</p>
                      <p><span className="font-medium">구매시:</span> {vehicle.mileage_at_purchase?.toLocaleString() || 'N/A'} miles</p>
                      <p><span className="font-medium">최근 엔진오일 교체:</span> {vehicle.recent_engine_oil_change_mileage?.toLocaleString() || 'N/A'} miles</p>
                      
                      {needsOilChange(vehicle) && (
                        <p className="text-red-600 font-medium">엔진오일 교체 필요</p>
                      )}
                    </>
                  )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEditVehicle(vehicle)}
                      className="p-1.5 text-gray-400 hover:text-blue-600"
                      title="수정"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {/* 렌터카일 때만 복사 버튼 표시 */}
                    {vehicle.vehicle_category === 'rental' && (
                      <button
                        onClick={() => handleCopyVehicle(vehicle)}
                        className="p-1.5 text-gray-400 hover:text-green-600"
                        title="복사"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {filteredVehicles.length === 0 && activeTab !== 'vehicle_types' && (
        <div className="text-center py-12">
          <Car className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">차량이 없습니다</h3>
          <p className="mt-1 text-sm text-gray-500">새 차량을 추가해보세요.</p>
        </div>
      )}

      {/* 차종 관리 탭일 때 안내 메시지 */}
      {activeTab === 'vehicle_types' && !isVehicleTypeModalOpen && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
          <Settings className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">차종 관리</h3>
          <p className="mt-1 text-sm text-gray-500 mb-4">차종을 관리하려면 위의 "차종 관리" 버튼을 클릭하세요.</p>
          <button
            onClick={() => setIsVehicleTypeModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Settings className="w-4 h-4 mr-2" />
            차종 관리 열기
          </button>
        </div>
      )}

      {/* 차량 수정 모달 */}
      {isEditModalOpen && (
        <VehicleEditModal
          vehicle={selectedVehicle}
          onSave={handleSaveVehicle}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedVehicle(null)
          }}
        />
      )}

      {/* 차종 관리 모달 */}
      <VehicleTypeManagementModal
        isOpen={isVehicleTypeModalOpen}
        onClose={() => {
          setIsVehicleTypeModalOpen(false)
          // 차종 관리 모달을 닫을 때는 company 탭으로 돌아가기
          if (activeTab === 'vehicle_types') {
            setActiveTab('company')
          }
        }}
      />

      {/* 렌터카 관리 모달 제거됨 */}

    </div>
  )
}
