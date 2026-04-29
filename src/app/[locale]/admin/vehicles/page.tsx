'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Search, Calendar, Car, Wrench, DollarSign, Edit, Trash2, Eye, Copy, Settings, Building2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import VehicleEditModal from '@/components/VehicleEditModal'
// 차종 관리 모달은 lazy load로 최적화
const VehicleTypeManagementModal = dynamic(() => import('@/components/VehicleTypeManagementModal'), {
  ssr: false,
  loading: () => null
})
// 렌터카 관리 모달은 더 이상 필요하지 않음
import { supabase } from '@/lib/supabase'
import {
  getVehicleStatusBadgeClass,
  getVehicleStatusLabelKo,
  VEHICLE_STATUS_SELECT_OPTIONS,
} from '@/lib/vehicleStatus'
import { rentalImpliedDailyUsd } from '@/lib/rentalVehicleUtils'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'

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
  status: string
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
  /** 차종 관리에 등록된 차종 사진 (표시 시 우선 사용) */
  typePhotos?: { photo_url: string; is_primary?: boolean; display_order?: number }[]
  // 렌터카 관련 필드 (간소화)
  vehicle_category?: string
  rental_company?: string
  daily_rate?: number
  rental_booking_price?: number | null
  rental_start_date?: string
  rental_end_date?: string
  rental_pickup_location?: string
  rental_return_location?: string
  rental_total_cost?: number
  rental_notes?: string
  /** Rental Agreement # */
  rental_agreement_number?: string | null
  /** 달력/일정 뷰 표시용 닉네임 (미입력 시 vehicle_number 사용) */
  nick?: string | null
}

const VEHICLES_UI_DEFAULT = {
  searchTerm: '',
  activeTab: 'company' as 'company' | 'rental_active' | 'rental_returned' | 'vehicle_types',
}

/** 오늘 기준 로컬 달력으로 N일 뒤 YYYY-MM-DD */
function addLocalDaysYmd(daysFromToday: number): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Enterprise 렌터카 추가 버튼용 — 모달 prefill */
function getEnterpriseRentalPrefill(): Partial<Vehicle> {
  return {
    vehicle_category: 'rental',
    vehicle_number: 'RENT',
    vehicle_type: 'Ford Transit 15 passenger',
    capacity: 15,
    rental_company: 'Enterprise',
    status: 'reserved',
    rental_start_date: addLocalDaysYmd(1),
    rental_end_date: addLocalDaysYmd(2),
    rental_pickup_location: 'Airport Rent a Car Center',
    rental_return_location: 'Airport Rent a Car Center',
  }
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [vehListUi, setVehListUi] = useRoutePersistedState('vehicles-list', VEHICLES_UI_DEFAULT)
  const { searchTerm, activeTab } = vehListUi
  const setSearchTerm = (v: React.SetStateAction<string>) =>
    setVehListUi((u) => ({
      ...u,
      searchTerm: typeof v === 'function' ? (v as (s: string) => string)(u.searchTerm) : v,
    }))
  const setActiveTab = (tab: 'company' | 'rental_active' | 'rental_returned' | 'vehicle_types') =>
    setVehListUi((u) => ({ ...u, activeTab: tab }))
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [isVehicleTypeModalOpen, setIsVehicleTypeModalOpen] = useState(false)
  const [vehicleModalPrefill, setVehicleModalPrefill] = useState<Partial<Vehicle> | null>(null)
  // 렌터카 관리 모달 상태 제거

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true)

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
          status,
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
          rental_booking_price,
          rental_start_date,
          rental_end_date,
          rental_pickup_location,
          rental_return_location,
          rental_total_cost,
          rental_notes,
          rental_agreement_number,
          nick,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false })

      if (vehiclesError) {
        console.error('차량 목록 조회 오류:', vehiclesError)
        throw vehiclesError
      }

      if (!vehiclesData || vehiclesData.length === 0) {
        setVehicles([])
        return
      }

      const vehiclesWithLegacyPhotos: Vehicle[] = vehiclesData.map((vehicle) => {
        if (vehicle.vehicle_image_url) {
          return {
            ...vehicle,
            photos: [
              {
                id: 'legacy',
                vehicle_id: vehicle.id,
                photo_url: vehicle.vehicle_image_url,
                is_primary: true,
                display_order: 0,
                created_at: vehicle.created_at,
                updated_at: vehicle.updated_at,
              },
            ],
            typePhotos: [],
          }
        }
        return { ...vehicle, photos: [], typePhotos: [] }
      })

      // 첫 페인트: 목록·탭·카드 UI를 먼저 보여 주고, 차종/갤러리 사진은 뒤이어 합성
      setVehicles(vehiclesWithLegacyPhotos)
      setLoading(false)

      type TypePhotoRow = {
        photo_url: string
        is_primary?: boolean
        display_order?: number
      }

      const loadTypePhotosByName = async (): Promise<Map<string, TypePhotoRow[]>> => {
        const typeNameToPhotos = new Map<string, TypePhotoRow[]>()
        const uniqueTypeNames = [
          ...new Set(vehiclesWithLegacyPhotos.map((v) => v.vehicle_type).filter(Boolean)),
        ] as string[]
        if (uniqueTypeNames.length === 0) return typeNameToPhotos

        try {
          const { data: typesData } = await supabase
            .from('vehicle_types')
            .select('id, name')
            .in('name', uniqueTypeNames)
          const typeIds = (typesData || []).map((t) => t.id)
          if (typeIds.length === 0) return typeNameToPhotos

          const idToName = new Map((typesData || []).map((t) => [t.id, t.name]))
          const TYPE_BATCH = 40
          const chunks: string[][] = []
          for (let i = 0; i < typeIds.length; i += TYPE_BATCH) {
            chunks.push(typeIds.slice(i, i + TYPE_BATCH))
          }

          await Promise.all(
            chunks.map(async (batchIds) => {
              const { data: typePhotosData } = await supabase
                .from('vehicle_type_photos')
                .select('vehicle_type_id, photo_url, is_primary, display_order')
                .in('vehicle_type_id', batchIds)
              if (!typePhotosData?.length) return
              typePhotosData.forEach((p) => {
                const name = idToName.get(p.vehicle_type_id)
                if (!name) return
                if (!typeNameToPhotos.has(name)) typeNameToPhotos.set(name, [])
                typeNameToPhotos.get(name)!.push({
                  photo_url: p.photo_url,
                  is_primary: p.is_primary,
                  display_order: p.display_order ?? 0,
                })
              })
            })
          )

          typeNameToPhotos.forEach((arr) => {
            arr.sort((a, b) => {
              if (a.is_primary && !b.is_primary) return -1
              if (!a.is_primary && b.is_primary) return 1
              return (a.display_order ?? 0) - (b.display_order ?? 0)
            })
          })
        } catch (_e) {
          /* 차종 사진 없이 진행 */
        }
        return typeNameToPhotos
      }

      const loadVehiclePhotos = async (): Promise<Map<string, VehiclePhoto[]>> => {
        const photosByVehicleId = new Map<string, VehiclePhoto[]>()
        const vehicleIds = vehiclesWithLegacyPhotos.filter((v) => !v.vehicle_image_url).map((v) => v.id)
        if (vehicleIds.length === 0) return photosByVehicleId

        const VEHICLE_BATCH = 32
        const chunks: string[][] = []
        for (let i = 0; i < vehicleIds.length; i += VEHICLE_BATCH) {
          chunks.push(vehicleIds.slice(i, i + VEHICLE_BATCH))
        }

        try {
          await Promise.all(
            chunks.map(async (batchIds) => {
              try {
                const { data: batchPhotos, error: photosError } = await supabase
                  .from('vehicle_photos')
                  .select('id, vehicle_id, photo_url, photo_name, is_primary, display_order, created_at, updated_at')
                  .in('vehicle_id', batchIds)
                  .limit(500)
                if (photosError) {
                  console.warn('vehicle_photos 배치 조회 오류:', photosError.message, photosError)
                  return
                }
                if (!batchPhotos?.length) return
                batchPhotos
                  .sort((a, b) => {
                    if (a.vehicle_id !== b.vehicle_id) return a.vehicle_id.localeCompare(b.vehicle_id)
                    if (a.is_primary && !b.is_primary) return -1
                    if (!a.is_primary && b.is_primary) return 1
                    return (a.display_order || 0) - (b.display_order || 0)
                  })
                  .forEach((photo) => {
                    if (!photosByVehicleId.has(photo.vehicle_id)) {
                      photosByVehicleId.set(photo.vehicle_id, [])
                    }
                    photosByVehicleId.get(photo.vehicle_id)!.push(photo as VehiclePhoto)
                  })
              } catch (batchError) {
                console.warn('차량 사진 배치 조회 실패:', batchError)
              }
            })
          )
        } catch (photoError) {
          console.warn('차량 사진 조회 중 오류 (무시):', photoError)
        }

        photosByVehicleId.forEach((list) => {
          list.sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1
            if (!a.is_primary && b.is_primary) return 1
            return (a.display_order || 0) - (b.display_order || 0)
          })
        })
        return photosByVehicleId
      }

      try {
        const [typeNameToPhotos, photosByVehicleId] = await Promise.all([
          loadTypePhotosByName(),
          loadVehiclePhotos(),
        ])

        const enriched: Vehicle[] = vehiclesWithLegacyPhotos.map((v) => {
          const typePhotos = typeNameToPhotos.get(v.vehicle_type) || []
          if (v.vehicle_image_url) {
            return { ...v, typePhotos }
          }
          const gallery = photosByVehicleId.get(v.id)
          const photos =
            gallery && gallery.length > 0
              ? gallery
              : v.photos
          return { ...v, typePhotos, photos }
        })
        setVehicles(enriched)
      } catch (e) {
        console.warn('차량 카드 사진 보강 실패:', e)
      }
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
    setVehicleModalPrefill(null)
    setSelectedVehicle(null)
    setIsEditModalOpen(true)
  }, [])

  const handleAddEnterpriseRental = useCallback(() => {
    setVehicleModalPrefill(getEnterpriseRentalPrefill())
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
      rental_booking_price: 0,
      rental_start_date: '',
      rental_end_date: '',
      rental_pickup_location: vehicle.rental_pickup_location || '',
      rental_return_location: vehicle.rental_return_location || '',
      rental_total_cost: 0,
      rental_notes: vehicle.rental_notes || '',
      rental_agreement_number: vehicle.rental_agreement_number || '',
      // 회사 차량 관련 필드들은 초기화
      year: new Date().getFullYear(),
      mileage_at_purchase: 0,
      purchase_amount: 0,
      purchase_date: '',
      engine_oil_change_cycle: 10000,
      current_mileage: 0,
      recent_engine_oil_change_mileage: 0,
      status: 'available',
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
      // 검색어 필터링 (id, 차량번호, 차종, VIN/RN, Rental Agreement #, 렌터카 회사, 닉네임)
      const term = searchTerm.toLowerCase().trim()
      const matchesSearch = !term ||
        (vehicle.id && vehicle.id.toLowerCase().includes(term)) ||
        vehicle.vehicle_number.toLowerCase().includes(term) ||
        vehicle.vehicle_type.toLowerCase().includes(term) ||
        (vehicle.vin && vehicle.vin.toLowerCase().includes(term)) ||
        (vehicle.rental_agreement_number && vehicle.rental_agreement_number.toLowerCase().includes(term)) ||
        (vehicle.rental_company && vehicle.rental_company.toLowerCase().includes(term)) ||
        (vehicle.nick && vehicle.nick.toLowerCase().includes(term))
      
      // 탭별 필터링: vehicle_category(company=회사차, rental=렌터카), rental은 status로 종료 여부 구분
      let matchesTab = true
      if (activeTab === 'company') {
        matchesTab = vehicle.vehicle_category === 'company' || !vehicle.vehicle_category
      } else if (activeTab === 'rental_active') {
        const s = (vehicle.status || '').trim()
        matchesTab = vehicle.vehicle_category === 'rental' && s !== 'returned' && s !== 'cancelled'
      } else if (activeTab === 'rental_returned') {
        const s = (vehicle.status || '').trim()
        matchesTab = vehicle.vehicle_category === 'rental' && (s === 'returned' || s === 'cancelled')
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
        .update({ status: newStatus })
        .eq('id', vehicleId)

      if (error) throw error
      
      // 로컬 상태 업데이트
      setVehicles(vehicles.map(v => 
        v.id === vehicleId ? { ...v, status: newStatus } : v
      ))
      
      console.log('차량 상태가 업데이트되었습니다:', newStatus)
    } catch (error) {
      console.error('차량 상태 변경 중 오류가 발생했습니다:', error)
      alert('차량 상태 변경 중 오류가 발생했습니다.')
    } finally {
      setUpdatingStatus(null)
    }
  }, [vehicles])

  // 렌터카 상태 변경 (동일한 status 컬럼 사용)
  const handleRentalStatusChange = useCallback((vehicleId: string, newStatus: string) => {
    handleStatusChange(vehicleId, newStatus)
  }, [handleStatusChange])

  const handleSaveVehicle = useCallback(async (vehicleData: Partial<Vehicle>) => {
    try {
      // 데이터베이스에 존재하는 필드만 필터링
      const allowedFields = [
        'vehicle_number', 'vin', 'vehicle_type', 'capacity', 'year',
        'mileage_at_purchase', 'purchase_amount', 'purchase_date', 'memo',
        'engine_oil_change_cycle', 'current_mileage', 'recent_engine_oil_change_mileage',
        'status', 'front_tire_size', 'rear_tire_size', 'windshield_wiper_size',
        'headlight_model', 'headlight_model_name', 'is_installment', 'installment_amount',
        'interest_rate', 'monthly_payment', 'additional_payment', 'payment_due_date',
        'installment_start_date', 'installment_end_date', 'vehicle_image_url',
        'vehicle_category', 'rental_company', 'daily_rate', 'rental_booking_price', 'rental_start_date',
        'rental_end_date',         'rental_pickup_location', 'rental_return_location',
        'rental_total_cost', 'rental_notes', 'rental_agreement_number', 'nick'
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
      setVehicleModalPrefill(null)
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleAddVehicle}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={16} />
            차량 추가
          </button>
          <button
            type="button"
            onClick={handleAddEnterpriseRental}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
            title="Enterprise 렌터카 기본값으로 새 차량 폼 열기"
          >
            <Building2 size={16} className="shrink-0" />
            Enterprise 렌터카 추가
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
              렌터카 ({vehicles.filter(v => {
                if (v.vehicle_category !== 'rental') return false
                const s = (v.status || '').trim()
                return s !== 'returned' && s !== 'cancelled'
              }).length})
            </button>
            <button
              onClick={() => setActiveTab('rental_returned')}
              className={`flex-shrink-0 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap ${
                activeTab === 'rental_returned'
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              렌터카(종료) ({vehicles.filter(v => {
                if (v.vehicle_category !== 'rental') return false
                const s = (v.status || '').trim()
                return s === 'returned' || s === 'cancelled'
              }).length})
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
              placeholder="ID, 차량 번호, 차종, VIN/RN, Rental Agreement #, 렌터카 회사, 닉네임..."
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
          // 대표사진 찾기 — 차종 사진 우선, 그 다음 차량 사진, vehicle_image_url
          const typePrimary = vehicle.typePhotos?.find(p => p.is_primary)
          const typeFirst = vehicle.typePhotos?.[0]
          const primaryPhoto = vehicle.photos?.find(photo => photo.is_primary)
          const firstPhoto = vehicle.photos?.[0]
          
          let photoUrl: string | null = null
          if (typePrimary?.photo_url) {
            photoUrl = typePrimary.photo_url
          } else if (typeFirst?.photo_url) {
            photoUrl = typeFirst.photo_url
          } else if (primaryPhoto?.photo_url) {
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
                        {vehicle.nick ? `${vehicle.nick} (${vehicle.vehicle_number})` : vehicle.vehicle_number}
                      </h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getVehicleStatusBadgeClass(vehicle.status || 'available')}`}>
                      {getVehicleStatusLabelKo(vehicle.status || 'available')}
                    </span>
                    {activeTab === 'company' ? (
                      <select
                        value={vehicle.status || 'available'}
                        onChange={(e) => handleStatusChange(vehicle.id, e.target.value)}
                        disabled={updatingStatus === vehicle.id}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        {VEHICLE_STATUS_SELECT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : activeTab === 'rental_active' ? (
                      <select
                        value={vehicle.status || 'available'}
                        onChange={(e) => handleRentalStatusChange(vehicle.id, e.target.value)}
                        disabled={updatingStatus === vehicle.id}
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                      >
                        {VEHICLE_STATUS_SELECT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
                        {getVehicleStatusLabelKo(vehicle.status || 'returned')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p><span className="font-medium">ID:</span> <span className="text-gray-500 font-mono">{vehicle.id}</span></p>
                  <p><span className="font-medium">차종:</span> {vehicle.vehicle_type}</p>
                  <p><span className="font-medium">연식:</span> {vehicle.year}년식</p>
                  <p><span className="font-medium">탑승인원:</span> {vehicle.capacity}인승</p>
                  <p><span className="font-medium">현재 마일리지:</span> {vehicle.current_mileage?.toLocaleString() || 'N/A'} miles</p>
                  
                  {/* 렌터카 정보 */}
                  {(activeTab === 'rental_active' || activeTab === 'rental_returned') && (
                    <>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <p>
                          <span className="font-medium">렌터카 회사:</span>{' '}
                          {vehicle.rental_company || '—'}
                        </p>
                        <p>
                          <span className="font-medium">렌터카 상태:</span>{' '}
                          <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${getVehicleStatusBadgeClass(vehicle.status || 'available')}`}>
                            {getVehicleStatusLabelKo(vehicle.status || 'available')}
                          </span>
                        </p>
                      </div>
                      <p>
                        <span className="font-medium">RN:</span>{' '}
                        <span className="font-mono text-gray-700 break-all">
                          {(vehicle.vin && vehicle.vin.trim()) || 'N/A'}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium">Rental Agreement #:</span>{' '}
                        <span className="font-mono text-gray-700 break-all">
                          {(vehicle.rental_agreement_number && vehicle.rental_agreement_number.trim()) || '—'}
                        </span>
                      </p>
                      <p><span className="font-medium">렌탈 기간:</span> {vehicle.rental_start_date || 'N/A'} ~ {vehicle.rental_end_date || 'N/A'}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <p>
                          <span className="font-medium">예약 가격:</span>{' '}
                          {vehicle.rental_booking_price != null
                            ? `$${Number(vehicle.rental_booking_price).toLocaleString()}`
                            : '—'}
                        </p>
                        <p>
                          <span className="font-medium">총 비용:</span>{' '}
                          {vehicle.rental_total_cost != null
                            ? `$${Number(vehicle.rental_total_cost).toLocaleString()}`
                            : '—'}
                        </p>
                      </div>
                      {(() => {
                        const implied = rentalImpliedDailyUsd(
                          Number(vehicle.rental_booking_price) || 0,
                          vehicle.rental_start_date,
                          vehicle.rental_end_date
                        )
                        return implied ? (
                          <p className="text-gray-500">
                            <span className="font-medium text-gray-600">일일 환산(예약):</span>{' '}
                            ${implied.perDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · {implied.days}일 기준 (1일 제외)
                          </p>
                        ) : null
                      })()}
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
          prefill={selectedVehicle ? null : vehicleModalPrefill}
          onSave={handleSaveVehicle}
          onClose={() => {
            setIsEditModalOpen(false)
            setSelectedVehicle(null)
            setVehicleModalPrefill(null)
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
