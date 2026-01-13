'use client'

import React, { useState, useEffect } from 'react'
import { X, Car, DollarSign, Wrench, Calendar, Upload, Trash2, Image, Images, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import VehicleTypeManagementModal from './VehicleTypeManagementModal'

interface Vehicle {
  id?: string
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

interface VehicleEditModalProps {
  vehicle: Vehicle | null
  onSave: (vehicleData: Partial<Vehicle>) => void
  onClose: () => void
}

export default function VehicleEditModal({ vehicle, onSave, onClose }: VehicleEditModalProps) {
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    vehicle_number: '',
    vin: '',
    vehicle_type: '',
    capacity: 0,
    year: new Date().getFullYear(),
    mileage_at_purchase: 0,
    purchase_amount: 0,
    purchase_date: '',
    memo: '',
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
    // 렌터카를 기본값으로 설정
    vehicle_category: 'rental',
    rental_company: '',
    daily_rate: 0,
    rental_start_date: '',
    rental_end_date: '',
    rental_pickup_location: '',
    rental_return_location: '',
    rental_total_cost: 0,
    rental_status: 'available',
    rental_notes: ''
  })

  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [vehiclePhotos, setVehiclePhotos] = useState<any[]>([])
  const [showPhotoGallery, setShowPhotoGallery] = useState(false)
  const [vehiclePhotoTemplates, setVehiclePhotoTemplates] = useState<any[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [primaryPhotoId, setPrimaryPhotoId] = useState<string | null>(null)
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([])
  const [showVehicleTypeManagement, setShowVehicleTypeManagement] = useState(false)

  // 차량 사진 가져오기
  const fetchVehiclePhotos = async (vehicleId: string) => {
    // vehicle_photos 조회는 선택적이므로 에러가 발생해도 무시
    // 현재 Supabase 서버에서 500 에러가 발생하고 있어 조용히 처리
    // 차량 편집은 정상적으로 진행되며, 사진이 없어도 문제없음
    // TODO: Supabase 서버 문제 해결 후 아래 코드 활성화
    /*
    try {
      const { data, error } = await supabase
        .from('vehicle_photos')
        .select('id, vehicle_id, photo_url, photo_name, is_primary, display_order')
        .eq('vehicle_id', vehicleId)
        .limit(100)

      if (!error && data && data.length > 0) {
        const sortedPhotos = data.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.display_order || 0) - (b.display_order || 0)
        })
        
        setVehiclePhotos(sortedPhotos)
        
        const primaryPhoto = sortedPhotos.find(photo => photo.is_primary)
        if (primaryPhoto) {
          setPrimaryPhotoId(primaryPhoto.id)
        }
      } else {
        setVehiclePhotos([])
      }
    } catch (error) {
      setVehiclePhotos([])
    }
    */
    // 임시로 빈 배열로 설정하여 에러 방지
    setVehiclePhotos([])
  }

  // 차종 목록 가져오기 (최적화: 필요한 컬럼만 선택, 인덱스 활용)
  const fetchVehicleTypes = async () => {
    try {
      // 먼저 vehicle_types만 가져오기 (is_active 인덱스 활용)
      const { data: typesData, error: typesError } = await supabase
        .from('vehicle_types')
        .select(`
          id,
          name,
          brand,
          model,
          passenger_capacity,
          vehicle_category,
          description,
          is_active,
          display_order
        `)
        .eq('is_active', true)
        // display_order 인덱스 활용
        .order('display_order', { ascending: true })
        .order('name', { ascending: true })

      if (typesError) {
        console.error('차종 목록 조회 오류:', typesError)
        throw typesError
      }

      if (!typesData || typesData.length === 0) {
        setVehicleTypes([])
        return
      }

      // 차종 사진을 배치로 한 번에 조회 (최적화: N+1 문제 해결)
      const typeIds = typesData.map(t => t.id)
      let photosByTypeId = new Map<string, any[]>()
      
      // vehicle_type_photos 조회는 현재 500 에러가 발생하여 임시로 비활성화
      // 데이터베이스 문제 해결 후 아래 코드를 활성화할 수 있음
      /*
      try {
        // 모든 차종의 사진을 한 번에 조회 (배치 조회)
        const { data: allTypePhotos, error: photosError } = await supabase
          .from('vehicle_type_photos')
          .select(`
            id,
            vehicle_type_id,
            photo_url,
            photo_name,
            description,
            is_primary,
            display_order
          `)
          .in('vehicle_type_id', typeIds)
          .order('vehicle_type_id', { ascending: true })
          .order('display_order', { ascending: true })
          .limit(1000)

        if (!photosError && allTypePhotos && allTypePhotos.length > 0) {
          // vehicle_type_id별로 그룹화
          allTypePhotos.forEach(photo => {
            if (!photosByTypeId.has(photo.vehicle_type_id)) {
              photosByTypeId.set(photo.vehicle_type_id, [])
            }
            photosByTypeId.get(photo.vehicle_type_id)!.push(photo)
          })
        }
      } catch (photoError) {
        // 에러는 조용히 무시
      }
      */

      // 각 차종에 사진 할당
      const typesWithPhotos = typesData.map(vehicleType => {
        const photos = photosByTypeId.get(vehicleType.id) || []
        const sortedPhotos = photos.sort((a, b) => {
          if (a.is_primary && !b.is_primary) return -1
          if (!a.is_primary && b.is_primary) return 1
          return (a.display_order || 0) - (b.display_order || 0)
        })

        return {
          ...vehicleType,
          photos: sortedPhotos
        }
      })

      setVehicleTypes(typesWithPhotos)
    } catch (error) {
      console.error('차종 목록 조회 오류:', error)
      // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
      setVehicleTypes([])
    }
  }

  // 차량 타입별 사진 템플릿 가져오기
  const fetchVehiclePhotoTemplates = async (vehicleType: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_photo_templates')
        .select('*')
        .eq('vehicle_type', vehicleType)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setVehiclePhotoTemplates(data || [])
    } catch (error) {
      console.error('차량 사진 템플릿 조회 오류:', error)
    }
  }

  // 차종 목록 가져오기
  useEffect(() => {
    fetchVehicleTypes()
  }, [])

  // 차량 타입이 변경될 때마다 사진 템플릿 가져오기
  useEffect(() => {
    if (formData.vehicle_type) {
      fetchVehiclePhotoTemplates(formData.vehicle_type)
    }
  }, [formData.vehicle_type])

  useEffect(() => {
    if (vehicle) {
      // 차량 사진 가져오기
      fetchVehiclePhotos(vehicle.id!)
      
      // null 값들을 기본값으로 변환
      setFormData({
        ...vehicle,
        year: vehicle.year || new Date().getFullYear(),
        capacity: vehicle.capacity || 0,
        mileage_at_purchase: vehicle.mileage_at_purchase || 0,
        purchase_amount: vehicle.purchase_amount || 0,
        engine_oil_change_cycle: vehicle.engine_oil_change_cycle || 10000,
        current_mileage: vehicle.current_mileage || 0,
        recent_engine_oil_change_mileage: vehicle.recent_engine_oil_change_mileage || 0,
        installment_amount: vehicle.installment_amount || 0,
        interest_rate: vehicle.interest_rate || 0,
        monthly_payment: vehicle.monthly_payment || 0,
        additional_payment: vehicle.additional_payment || 0,
        daily_rate: vehicle.daily_rate || 0,
        rental_total_cost: vehicle.rental_total_cost || 0,
        // 문자열 필드들
        vehicle_number: vehicle.vehicle_number || '',
        vin: vehicle.vin || '',
        vehicle_type: vehicle.vehicle_type || '',
        purchase_date: vehicle.purchase_date || '',
        memo: vehicle.memo || '',
        front_tire_size: vehicle.front_tire_size || '',
        rear_tire_size: vehicle.rear_tire_size || '',
        windshield_wiper_size: vehicle.windshield_wiper_size || '',
        headlight_model: vehicle.headlight_model || '',
        headlight_model_name: vehicle.headlight_model_name || '',
        payment_due_date: vehicle.payment_due_date || '',
        installment_start_date: vehicle.installment_start_date || '',
        installment_end_date: vehicle.installment_end_date || '',
        vehicle_image_url: vehicle.vehicle_image_url || '',
        rental_company: vehicle.rental_company || '',
        rental_start_date: vehicle.rental_start_date || '',
        rental_end_date: vehicle.rental_end_date || '',
        rental_pickup_location: vehicle.rental_pickup_location || '',
        rental_return_location: vehicle.rental_return_location || '',
        rental_notes: vehicle.rental_notes || '',
        // 불린 필드들
        is_installment: vehicle.is_installment || false,
        // 기타 필드들
        vehicle_status: vehicle.vehicle_status || '운행 가능',
        vehicle_category: vehicle.vehicle_category || 'company',
        rental_status: vehicle.rental_status || 'available'
      })
      if (vehicle.vehicle_image_url) {
        setImagePreview(vehicle.vehicle_image_url)
      }
    } else {
      // 새 차량인 경우 기본값 설정 (렌터카를 기본값으로)
      setFormData({
        vehicle_number: '',
        vin: '',
        vehicle_type: '',
        capacity: 0,
        year: new Date().getFullYear(),
        mileage_at_purchase: 0,
        purchase_amount: 0,
        purchase_date: '',
        memo: '',
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
        // 렌터카를 기본값으로 설정
        vehicle_category: 'rental',
        rental_company: '',
        daily_rate: 0,
        rental_start_date: '',
        rental_end_date: '',
        rental_pickup_location: '',
        rental_return_location: '',
        rental_total_cost: 0,
        rental_status: 'available',
        rental_notes: ''
      })
    }
  }, [vehicle])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }))
    } else if (name === 'vehicle_type') {
      // 차종 선택 시 자동으로 탑승 인원 설정 및 이미지 가져오기
      const selectedType = vehicleTypes.find(type => type.name === value)
      setFormData(prev => ({
        ...prev,
        [name]: value,
        capacity: selectedType ? selectedType.passenger_capacity : prev.capacity,
        vehicle_category: selectedType ? selectedType.vehicle_category : prev.vehicle_category
      }))
      
      // 차종의 모든 이미지 가져오기
      if (selectedType && selectedType.photos && selectedType.photos.length > 0) {
        const primaryPhoto = selectedType.photos.find((photo: any) => photo.is_primary)
        const firstPhoto = selectedType.photos[0]
        const imageUrl = primaryPhoto?.photo_url || firstPhoto.photo_url
        
        if (imageUrl) {
          setFormData(prev => ({
            ...prev,
            vehicle_image_url: imageUrl
          }))
        }
        
        // 모든 사진을 미리보기에 추가
        const allPhotoUrls = selectedType.photos.map((photo: any) => photo.photo_url)
        setImagePreviews(allPhotoUrls)
        
        // vehiclePhotos 상태에도 저장
        setVehiclePhotos(selectedType.photos)
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  // 차종 선택 핸들러 (차종 관리 모달에서)
  const handleVehicleTypeSelect = (vehicleType: any) => {
    setFormData(prev => ({
      ...prev,
      vehicle_type: vehicleType.name,
      vehicle_category: vehicleType.vehicle_category,
      capacity: vehicleType.passenger_capacity
    }))
    
    // 차종의 모든 이미지 가져오기
    if (vehicleType.photos && vehicleType.photos.length > 0) {
      const primaryPhoto = vehicleType.photos.find((photo: any) => photo.is_primary)
      const firstPhoto = vehicleType.photos[0]
      const imageUrl = primaryPhoto?.photo_url || firstPhoto.photo_url
      
      if (imageUrl) {
        setFormData(prev => ({
          ...prev,
          vehicle_image_url: imageUrl
        }))
      }
      
      // 모든 사진을 미리보기에 추가
      const allPhotoUrls = vehicleType.photos.map((photo: any) => photo.photo_url)
      setImagePreviews(allPhotoUrls)
      
      // vehiclePhotos 상태에도 저장
      setVehiclePhotos(vehicleType.photos)
    }
    
    setShowVehicleTypeManagement(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      const newFiles = [...imageFiles, ...files]
      setImageFiles(newFiles)
      
      // 미리보기 생성
      const newPreviews: string[] = []
      files.forEach(file => {
        const reader = new FileReader()
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string)
          if (newPreviews.length === files.length) {
            setImagePreviews(prev => [...prev, ...newPreviews])
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const removeVehiclePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('vehicle_photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error
      
      // 로컬 상태 업데이트
      setVehiclePhotos(prev => prev.filter(photo => photo.id !== photoId))
      
      // 기본 사진이 삭제된 경우 다른 사진을 기본으로 설정
      if (primaryPhotoId === photoId) {
        const remainingPhotos = vehiclePhotos.filter(photo => photo.id !== photoId)
        if (remainingPhotos.length > 0) {
          await setPrimaryPhoto(remainingPhotos[0].id)
        } else {
          setPrimaryPhotoId(null)
        }
      }
    } catch (error) {
      console.error('사진 삭제 오류:', error)
      alert('사진 삭제에 실패했습니다.')
    }
  }

  const setPrimaryPhoto = async (photoId: string) => {
    try {
      // 모든 사진의 기본 상태 해제
      await supabase
        .from('vehicle_photos')
        .update({ is_primary: false })
        .eq('vehicle_id', vehicle?.id)

      // 선택된 사진을 기본으로 설정
      const { error } = await supabase
        .from('vehicle_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (error) throw error
      
      setPrimaryPhotoId(photoId)
      
      // 로컬 상태 업데이트
      setVehiclePhotos(prev => 
        prev.map(photo => ({
          ...photo,
          is_primary: photo.id === photoId
        }))
      )
    } catch (error) {
      console.error('기본 사진 설정 오류:', error)
      alert('기본 사진 설정에 실패했습니다.')
    }
  }

  // 사진 템플릿 선택
  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template)
    // 템플릿 사진을 새 사진으로 추가
    setImagePreviews(prev => [...prev, template.photo_url])
    setShowPhotoGallery(false)
  }

  // 사진 템플릿 저장
  const handleSaveTemplate = async () => {
    if (imagePreviews.length === 0 || !formData.vehicle_type) return

    try {
      const templates = imagePreviews.map((preview, index) => ({
        vehicle_type: formData.vehicle_type,
        vehicle_model: formData.vehicle_number,
        photo_url: preview,
        photo_name: `${formData.vehicle_type} - ${formData.vehicle_number} (${index + 1})`,
        description: `차량 번호: ${formData.vehicle_number}`,
        is_default: false
      }))

      const { error } = await supabase
        .from('vehicle_photo_templates')
        .insert(templates)

      if (error) throw error
      
      // 템플릿 목록 새로고침
      fetchVehiclePhotoTemplates(formData.vehicle_type)
      alert(`${templates.length}장의 사진이 템플릿으로 저장되었습니다.`)
    } catch (error) {
      console.error('사진 템플릿 저장 오류:', error)
      alert('사진 템플릿 저장에 실패했습니다.')
    }
  }

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        if (file) {
          setImageFile(file)
          const reader = new FileReader()
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string)
          }
          reader.readAsDataURL(file)
        }
        break
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // 날짜 필드 정리 및 유효성 검사
      const cleanedData = { ...formData }
      
      // 빈 문자열인 날짜 필드들을 null로 변환
      const dateFields = [
        'purchase_date', 
        'insurance_start_date', 
        'insurance_end_date', 
        'rental_start_date', 
        'rental_end_date'
      ]
      
      dateFields.forEach(field => {
        if (cleanedData[field as keyof typeof cleanedData] === '' || 
            cleanedData[field as keyof typeof cleanedData] === null) {
          cleanedData[field as keyof typeof cleanedData] = null
        }
      })

      // 숫자 필드 정리
      const numberFields = [
        'year', 'capacity', 'mileage_at_purchase', 'purchase_amount',
        'monthly_payment', 'rental_total_cost'
      ]
      
      numberFields.forEach(field => {
        const value = cleanedData[field as keyof typeof cleanedData]
        if (value === '' || value === null || value === undefined) {
          cleanedData[field as keyof typeof cleanedData] = 0
        } else if (typeof value === 'string') {
          const numValue = parseFloat(value)
          cleanedData[field as keyof typeof cleanedData] = isNaN(numValue) ? 0 : numValue
        }
      })

      // 차량 데이터 저장 (이미지는 별도로 처리)
      const vehicleData = {
        ...cleanedData,
        vehicle_image_url: null // 단일 이미지 URL 제거
      }

      console.log('정리된 차량 데이터:', vehicleData)

      onSave(vehicleData)
      
      // 새로 추가된 사진들을 vehicle_photos 테이블에 저장
      if (imagePreviews.length > 0 && vehicle?.id) {
        // 기존에 저장된 사진의 URL 목록
        const existingPhotoUrls = new Set(vehiclePhotos.map(photo => photo.photo_url))
        
        // 새로 추가된 사진만 필터링 (기존 사진 제외)
        const newPhotoUrls = imagePreviews.filter(url => !existingPhotoUrls.has(url))
        
        if (newPhotoUrls.length > 0) {
          // 기존에 is_primary = true인 사진이 있는지 확인
          const hasPrimaryPhoto = vehiclePhotos.some(photo => photo.is_primary)
          
          // display_order는 기존 사진 개수부터 시작
          const startDisplayOrder = vehiclePhotos.length
          
          const photosData = newPhotoUrls.map((preview, index) => ({
            vehicle_id: vehicle.id,
            photo_url: preview,
            photo_name: `${formData.vehicle_number} - 사진 ${startDisplayOrder + index + 1}`,
            display_order: startDisplayOrder + index,
            // 기존에 is_primary 사진이 없고, 첫 번째 새 사진이면 대표 사진으로 설정
            // 그 외의 경우는 모두 false로 설정하여 unique constraint 위반 방지
            is_primary: !hasPrimaryPhoto && vehiclePhotos.length === 0 && index === 0
          }))

          const { error } = await supabase
            .from('vehicle_photos')
            .insert(photosData)

          if (error) {
            console.error('사진 저장 오류:', error)
            console.error('저장하려는 사진 데이터:', photosData)
            throw error
          }
          
          // 사진 목록 새로고침
          fetchVehiclePhotos(vehicle.id)
        }
      }
    } catch (error) {
      console.error('차량 저장 오류:', error)
      alert('차량 저장 중 오류가 발생했습니다.')
    }
  }


  const calculateTotalPayment = () => {
    if (!formData.is_installment) return 0
    const monthly = formData.monthly_payment || 0
    const additional = formData.additional_payment || 0
    return monthly + additional
  }

  const calculateRemainingAmount = () => {
    if (!formData.is_installment) return 0
    const total = formData.installment_amount || 0
    const paid = calculateTotalPayment()
    return Math.max(0, total - paid)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Car className="w-5 h-5 mr-2" />
                  {vehicle ? (vehicle.id ? '차량 정보 수정' : '새 차량 추가 (복사)') : '새 차량 추가'}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* 렌터카일 때는 1열 레이아웃, 회사 차량일 때는 2열 레이아웃 */}
              <div className={`grid gap-6 ${formData.vehicle_category === 'rental' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {/* 기본 정보 */}
                <div className="space-y-4">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Car className="w-4 h-4 mr-2" />
                    기본 정보
                  </h4>
                  
                  {/* 차량 카테고리 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">차량 카테고리 *</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="vehicle_category"
                          value="company"
                          checked={formData.vehicle_category === 'company'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        회사 차량
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="vehicle_category"
                          value="rental"
                          checked={formData.vehicle_category === 'rental'}
                          onChange={handleInputChange}
                          className="mr-2"
                        />
                        렌터카
                      </label>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">차량 번호 *</label>
                      <input
                        type="text"
                        name="vehicle_number"
                        value={formData.vehicle_number}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">VIN</label>
                      <input
                        type="text"
                        name="vin"
                        value={formData.vin}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">차종 *</label>
                      <button
                        type="button"
                        onClick={() => setShowVehicleTypeManagement(true)}
                        className="inline-flex items-center px-2 py-1 border border-gray-300 rounded-md shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        차종 관리
                      </button>
                    </div>
                    <select
                      name="vehicle_type"
                      value={formData.vehicle_type}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">차종을 선택하세요</option>
                      {vehicleTypes.map((type) => (
                        <option key={type.id} value={type.name}>
                          {type.name} ({type.passenger_capacity}인승)
                        </option>
                      ))}
                    </select>
                    {vehicleTypes.length === 0 && (
                      <p className="mt-1 text-sm text-gray-500">
                        차종이 없습니다. 위의 &quot;차종 관리&quot; 버튼을 클릭하여 차종을 추가해주세요.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">탑승 인원 *</label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      required
                      min="1"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* 회사 차량일 때만 표시되는 필드들 */}
                  {formData.vehicle_category === 'company' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">연식 *</label>
                        <input
                          type="number"
                          name="year"
                          value={formData.year}
                          onChange={handleInputChange}
                          required
                          min="1900"
                          max={new Date().getFullYear() + 1}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">구매시 마일리지 (miles)</label>
                          <input
                            type="number"
                            name="mileage_at_purchase"
                            value={formData.mileage_at_purchase}
                            onChange={handleInputChange}
                            min="0"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">구매 금액 ($)</label>
                          <input
                            type="number"
                            name="purchase_amount"
                            value={formData.purchase_amount}
                            onChange={handleInputChange}
                            min="0"
                            step="0.01"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">구매일</label>
                        <input
                          type="date"
                          name="purchase_date"
                          value={formData.purchase_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">메모</label>
                    <textarea
                      name="memo"
                      value={formData.memo}
                      onChange={handleInputChange}
                      rows={3}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 렌터카 정보 (렌터카 선택시에만 표시) */}
                {formData.vehicle_category === 'rental' && (
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      렌터카 정보
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">렌터카 회사 *</label>
                        <input
                          type="text"
                          name="rental_company"
                          value={formData.rental_company}
                          onChange={handleInputChange}
                          required
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="예: Hertz, Enterprise, Budget"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">일일 요금 ($)</label>
                        <input
                          type="number"
                          name="daily_rate"
                          value={formData.daily_rate}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">렌탈 시작일</label>
                        <input
                          type="date"
                          name="rental_start_date"
                          value={formData.rental_start_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">렌탈 종료일</label>
                        <input
                          type="date"
                          name="rental_end_date"
                          value={formData.rental_end_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">픽업 장소</label>
                        <input
                          type="text"
                          name="rental_pickup_location"
                          value={formData.rental_pickup_location}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">반납 장소</label>
                        <input
                          type="text"
                          name="rental_return_location"
                          value={formData.rental_return_location}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">총 비용 ($)</label>
                        <input
                          type="number"
                          name="rental_total_cost"
                          value={formData.rental_total_cost}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">렌터카 상태</label>
                        <select
                          name="rental_status"
                          value={formData.rental_status}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="available">사용가능</option>
                          <option value="reserved">예약됨</option>
                          <option value="picked_up">픽업완료</option>
                          <option value="in_use">사용중</option>
                          <option value="returned">반납완료</option>
                          <option value="cancelled">취소됨</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">메모</label>
                      <textarea
                        name="rental_notes"
                        value={formData.rental_notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* 관리 정보 (회사 차량일 때만 표시) */}
                {formData.vehicle_category === 'company' && (
                  <div className="space-y-4">
                    <h4 className="text-md font-medium text-gray-900 flex items-center">
                      <Wrench className="w-4 h-4 mr-2" />
                      관리 정보
                    </h4>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">엔진오일 교체 주기 (miles)</label>
                      <input
                        type="number"
                        name="engine_oil_change_cycle"
                        value={formData.engine_oil_change_cycle}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">현재 마일리지 (miles)</label>
                      <input
                        type="number"
                        name="current_mileage"
                        value={formData.current_mileage}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">최근 엔진오일 교체 마일리지</label>
                      <input
                        type="number"
                        name="recent_engine_oil_change_mileage"
                        value={formData.recent_engine_oil_change_mileage}
                        onChange={handleInputChange}
                        min="0"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">엔진오일 교체 비용 등록 시 자동 업데이트됩니다</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">차량 상태</label>
                      <select
                        name="vehicle_status"
                        value={formData.vehicle_status}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="운행 가능">운행 가능</option>
                        <option value="수리 중">수리 중</option>
                        <option value="대기 중">대기 중</option>
                        <option value="폐차">폐차</option>
                        <option value="사용 종료">사용 종료</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">앞타이어 사이즈</label>
                        <input
                          type="text"
                          name="front_tire_size"
                          value={formData.front_tire_size}
                          onChange={handleInputChange}
                          placeholder="예: 205/55R16"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">뒷타이어 사이즈</label>
                        <input
                          type="text"
                          name="rear_tire_size"
                          value={formData.rear_tire_size}
                          onChange={handleInputChange}
                          placeholder="예: 205/55R16"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">윈드실드 와이퍼 사이즈</label>
                      <input
                        type="text"
                        name="windshield_wiper_size"
                        value={formData.windshield_wiper_size}
                        onChange={handleInputChange}
                        placeholder="예: 26인치"
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">헤드라이트 모델</label>
                        <input
                          type="text"
                          name="headlight_model"
                          value={formData.headlight_model}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">헤드라이트 모델명</label>
                        <input
                          type="text"
                          name="headlight_model_name"
                          value={formData.headlight_model_name}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 할부 정보 (회사 차량일 때만 표시) */}
              {formData.vehicle_category === 'company' && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    할부 정보
                  </h4>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="is_installment"
                      checked={formData.is_installment}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">할부 여부</label>
                  </div>

                  {formData.is_installment && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">할부 금액 (USD)</label>
                        <input
                          type="number"
                          name="installment_amount"
                          value={formData.installment_amount}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">이자율 (%)</label>
                        <input
                          type="number"
                          name="interest_rate"
                          value={formData.interest_rate}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">월 납부금 (USD)</label>
                        <input
                          type="number"
                          name="monthly_payment"
                          value={formData.monthly_payment}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">추가 납부금 (USD)</label>
                        <input
                          type="number"
                          name="additional_payment"
                          value={formData.additional_payment}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">납부 마감일</label>
                        <input
                          type="date"
                          name="payment_due_date"
                          value={formData.payment_due_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">할부 시작일</label>
                        <input
                          type="date"
                          name="installment_start_date"
                          value={formData.installment_start_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">할부 종료일</label>
                        <input
                          type="date"
                          name="installment_end_date"
                          value={formData.installment_end_date}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {formData.is_installment && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-md">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">총 납부 금액</label>
                        <p className="mt-1 text-sm text-gray-900">${calculateTotalPayment().toLocaleString()} (자동 계산)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">남은 할부금</label>
                        <p className="mt-1 text-sm text-gray-900">${calculateRemainingAmount().toLocaleString()} (자동 계산)</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 차량 이미지 - 모든 차량 타입에 대해 표시 */}
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900 flex items-center">
                    <Upload className="w-4 h-4 mr-2" />
                    차량 이미지 ({vehiclePhotos.length + imagePreviews.length}장)
                  </h4>
                  {formData.vehicle_type && (
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setShowPhotoGallery(true)}
                        className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
                      >
                        <Images className="w-4 h-4 mr-2" />
                        사진 갤러리
                      </button>
                      {imagePreviews.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSaveTemplate}
                          className="inline-flex items-center px-3 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50"
                        >
                          <Image className="w-4 h-4 mr-2" />
                          템플릿 저장
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 기존 사진들 */}
                {vehiclePhotos.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-gray-700">기존 사진</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {vehiclePhotos.map((photo) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.photo_url}
                            alt={photo.photo_name || '차량 사진'}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                              <button
                                type="button"
                                onClick={() => setPrimaryPhoto(photo.id)}
                                className={`p-1 rounded-full ${
                                  photo.is_primary 
                                    ? 'bg-yellow-500 text-white' 
                                    : 'bg-white text-gray-700 hover:bg-yellow-100'
                                }`}
                                title={photo.is_primary ? '기본 사진' : '기본 사진으로 설정'}
                              >
                                ⭐
                              </button>
                              <button
                                type="button"
                                onClick={() => removeVehiclePhoto(photo.id)}
                                className="p-1 rounded-full bg-white text-red-600 hover:bg-red-100"
                                title="삭제"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          {photo.is_primary && (
                            <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs px-1 py-0.5 rounded">
                              기본
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 새로 추가할 사진들 */}
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
                  onPaste={handlePasteImage}
                >
                  {imagePreviews.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {imagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`새 사진 ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-center space-x-2">
                        <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          사진 추가
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreviews([])
                            setImageFiles([])
                          }}
                          className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          모두 삭제
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div>
                        <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          사진 추가 (여러 장 선택 가능)
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-sm text-gray-500">차량 사진을 업로드하세요</p>
                      <p className="text-xs text-gray-400">팁: Ctrl+V로 클립보드의 이미지를 직접 붙여넣을 수 있습니다!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                저장
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 사진 갤러리 모달 */}
      {showPhotoGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {formData.vehicle_type} 사진 갤러리
              </h3>
              <button
                type="button"
                onClick={() => setShowPhotoGallery(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {vehiclePhotoTemplates.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {vehiclePhotoTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <img
                      src={template.photo_url}
                      alt={template.photo_name || '차량 사진'}
                      className="w-full h-24 object-cover"
                    />
                    <div className="p-2">
                      <p className="text-xs text-gray-600 truncate">
                        {template.photo_name || template.vehicle_model}
                      </p>
                      {template.is_default && (
                        <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mt-1">
                          기본
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Image className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">
                  {formData.vehicle_type} 타입의 사진이 없습니다.
                </p>
                <p className="text-xs text-gray-400">
                  먼저 차량 사진을 업로드하고 &apos;템플릿 저장&apos;을 클릭하세요.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPhotoGallery(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 차종 관리 모달 */}
      <VehicleTypeManagementModal
        isOpen={showVehicleTypeManagement}
        onClose={() => setShowVehicleTypeManagement(false)}
        onVehicleTypeSelect={handleVehicleTypeSelect}
      />
    </div>
  )
}