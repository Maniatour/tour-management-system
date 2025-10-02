'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Calendar, Plus, Save, Trash2, Image, X, Upload, Loader2, Search, FolderOpen, Copy, ChevronUp, ChevronDown, Languages, MapPin, Sparkles } from 'lucide-react'
import LocationPickerModal from './LocationPickerModal'
import { uploadThumbnail, deleteThumbnail, isSupabaseStorageUrl, uploadProductMedia } from '@/lib/productMediaUpload'
import { supabase } from '@/lib/supabase'
import { translateScheduleFields, type ScheduleTranslationFields } from '@/lib/translationService'
import { suggestScheduleTitle, suggestScheduleDescription } from '@/lib/chatgptService'

// Google Maps 타입 정의
declare global {
  interface Window {
    google: {
      maps: {
        Map: any
        Marker: any
        MapTypeId: any
        Geocoder: any
        MapMouseEvent: any
      }
    }
  }
}

interface ScheduleItem {
  id?: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  latitude?: number | null
  longitude?: number | null
  show_to_customers: boolean | null
  title_ko?: string | null
  title_en?: string | null
  description_ko?: string | null
  description_en?: string | null
  location_ko?: string | null
  location_en?: string | null
  guide_notes_ko?: string | null
  guide_notes_en?: string | null
  thumbnail_url?: string | null
  order_index?: number | null
  two_guide_schedule?: string | null
  guide_driver_schedule?: string | null
}

interface TableScheduleAddProps {
  schedules: ScheduleItem[]
  onSchedulesChange: (schedules: ScheduleItem[]) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  teamMembers: Array<{email: string, name_ko: string, position: string}>
  productId: string
}

export default function TableScheduleAdd({ 
  schedules, 
  onSchedulesChange, 
  onSave, 
  onClose, 
  saving, 
  teamMembers,
  productId
}: TableScheduleAddProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerIndex, setLocationPickerIndex] = useState<number | null>(null)
  const [showEnglishFields, setShowEnglishFields] = useState(false)
  const [showOptionsModal, setShowOptionsModal] = useState(false)
  const [currentScheduleIndex, setCurrentScheduleIndex] = useState<number | null>(null)
  const [showThumbnailModal, setShowThumbnailModal] = useState(false)
  const [thumbnailIndex, setThumbnailIndex] = useState<number | null>(null)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [showBucketImages, setShowBucketImages] = useState(false)
  const [bucketImages, setBucketImages] = useState<Array<{name: string, url: string}>>([])
  const [loadingBucketImages, setLoadingBucketImages] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [showTextModal, setShowTextModal] = useState(false)
  const [textModalType, setTextModalType] = useState<'description' | 'guide_notes'>('description')
  const [textModalIndex, setTextModalIndex] = useState<number | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapModalIndex, setMapModalIndex] = useState<number | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedGoogleMapLink, setSelectedGoogleMapLink] = useState<string>('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 지도 관련 함수들
  const handleMapCoordinateSelect = (lat: number, lng: number, address?: string) => {
    if (mapModalIndex !== null) {
      const coordinates = `${lat}, ${lng}`
      const googleMapLink = `https://www.google.com/maps?q=${lat},${lng}`
      
      updateSchedule(mapModalIndex, 'latitude', lat)
      updateSchedule(mapModalIndex, 'longitude', lng)
      updateSchedule(mapModalIndex, 'location_ko', address || schedules[mapModalIndex].location_ko)
      
      setShowMapModal(false)
      setMapModalIndex(null)
    }
  }

  const initializeMap = () => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      const mapElement = document.getElementById('map')
      if (!mapElement) return

      const map = new window.google.maps.Map(mapElement, {
        center: { lat: 36.1699, lng: -115.1398 }, // 라스베가스 중심
        zoom: 12,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP
      })

      let marker: any = null

      // 지도 클릭 이벤트
      map.addListener('click', (event: any) => {
        const lat = event.latLng?.lat()
        const lng = event.latLng?.lng()
        
        if (lat && lng) {
          // 기존 마커 제거
          if (marker) {
            marker.setMap(null)
          }

          // 새 마커 추가
          marker = new window.google.maps.Marker({
            position: { lat, lng },
            map: map,
            title: '선택된 위치'
          })

          // 좌표 입력 필드 업데이트
          const latInput = document.getElementById('latitude') as HTMLInputElement
          const lngInput = document.getElementById('longitude') as HTMLInputElement
          if (latInput) latInput.value = lat.toString()
          if (lngInput) lngInput.value = lng.toString()

          // 역지오코딩으로 주소 가져오기
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address
              setSelectedAddress(address)
              setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
            }
          })
        }
      })

      setMapLoaded(true)
    }
  }

  const handleMapSearch = async () => {
    const searchTerm = (document.getElementById('mapSearch') as HTMLInputElement)?.value
    if (!searchTerm) return

    try {
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ address: searchTerm + ' Las Vegas' }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location
          const lat = location.lat()
          const lng = location.lng()
          const address = results[0].formatted_address

          // 지도 중심 이동
          const mapElement = document.getElementById('map')
          if (mapElement && window.google && window.google.maps) {
            const map = new window.google.maps.Map(mapElement, {
              center: { lat, lng },
              zoom: 15,
              mapTypeId: window.google.maps.MapTypeId.ROADMAP
            })

            // 마커 추가
            new window.google.maps.Marker({
              position: { lat, lng },
              map: map,
              title: searchTerm
            })

            // 좌표 입력 필드 업데이트
            const latInput = document.getElementById('latitude') as HTMLInputElement
            const lngInput = document.getElementById('longitude') as HTMLInputElement
            if (latInput) latInput.value = lat.toString()
            if (lngInput) lngInput.value = lng.toString()

            // 주소 정보 업데이트
            setSelectedAddress(address)
            setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
          }
        } else {
          alert('검색 결과를 찾을 수 없습니다.')
        }
      })
    } catch (error) {
      console.error('검색 오류:', error)
      alert('검색 중 오류가 발생했습니다.')
    }
  }

  // 모달이 열릴 때 지도 초기화
  useEffect(() => {
    if (showMapModal && !mapLoaded) {
      // Google Maps API 스크립트 로드
      if (!window.google) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
          alert('Google Maps API 키가 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요.')
          return
        }
        
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
        script.async = true
        script.defer = true
        script.onload = () => {
          setTimeout(initializeMap, 100)
        }
        script.onerror = () => {
          alert('Google Maps API 로드 중 오류가 발생했습니다. API 키를 확인해주세요.')
        }
        document.head.appendChild(script)
      } else {
        setTimeout(initializeMap, 100)
      }
    }
  }, [showMapModal, mapLoaded])

  // 시간 계산 유틸리티 함수들
  const timeToMinutes = (timeStr: string | null): number => {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const calculateDuration = (startTime: string | null, endTime: string | null): number => {
    if (!startTime || !endTime) return 0
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)
    return endMinutes - startMinutes
  }

  const calculateEndTime = (startTime: string | null, durationMinutes: number): string | null => {
    if (!startTime) return null
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = startMinutes + durationMinutes
    return minutesToTime(endMinutes)
  }

  const addNewSchedule = () => {
    // 마지막 행의 정보를 가져오기
    const lastSchedule = schedules.length > 0 ? schedules[schedules.length - 1] : null
    const lastDayNumber = lastSchedule ? lastSchedule.day_number : 1
    const lastEndTime = lastSchedule ? lastSchedule.end_time : null
    
    // 같은 일차의 마지막 order_index 찾기
    const sameDaySchedules = schedules.filter(s => s.day_number === lastDayNumber)
    const maxOrderIndex = sameDaySchedules.length > 0 
      ? Math.max(...sameDaySchedules.map(s => s.order_index || 0))
      : 0
    
    const newSchedule: ScheduleItem = {
      product_id: productId, // 올바른 product_id 설정
      day_number: lastDayNumber, // 윗 행과 같은 일차
      start_time: lastEndTime, // 윗 행의 종료 시간을 시작 시간으로 (null 가능)
      end_time: lastEndTime ? calculateEndTime(lastEndTime, 60) : null, // 시작 시간이 있으면 + 60분
      duration_minutes: lastEndTime ? 60 : null, // 시간이 없으면 null
      is_break: false,
      is_meal: false,
      is_transport: false,
      is_tour: false,
      latitude: null,
      longitude: null,
      show_to_customers: true,
      title_ko: '',
      title_en: '',
      description_ko: '',
      description_en: '',
      location_ko: '',
      location_en: '',
      guide_notes_ko: '',
      guide_notes_en: '',
      thumbnail_url: '',
      order_index: maxOrderIndex + 1, // 다음 순서로 설정
      two_guide_schedule: null,
      guide_driver_schedule: null
    }
    onSchedulesChange([...schedules, newSchedule])
  }

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: any) => {
    const updatedSchedules = [...schedules]
    updatedSchedules[index] = { ...updatedSchedules[index], [field]: value }
    onSchedulesChange(updatedSchedules)
  }

  // Row 이동 함수들 (order_index 업데이트 포함)
  const moveScheduleUp = (index: number) => {
    if (index > 0) {
      const updatedSchedules = [...schedules]
      const currentSchedule = updatedSchedules[index]
      const previousSchedule = updatedSchedules[index - 1]
      
      // 같은 일차인 경우에만 이동
      if (currentSchedule.day_number === previousSchedule.day_number) {
        // order_index 교환
        const tempOrderIndex = currentSchedule.order_index
        currentSchedule.order_index = previousSchedule.order_index
        previousSchedule.order_index = tempOrderIndex
        
        // 배열에서 위치 교환
        updatedSchedules[index] = previousSchedule
        updatedSchedules[index - 1] = currentSchedule
        
        onSchedulesChange(updatedSchedules)
      }
    }
  }

  const moveScheduleDown = (index: number) => {
    if (index < schedules.length - 1) {
      const updatedSchedules = [...schedules]
      const currentSchedule = updatedSchedules[index]
      const nextSchedule = updatedSchedules[index + 1]
      
      // 같은 일차인 경우에만 이동
      if (currentSchedule.day_number === nextSchedule.day_number) {
        // order_index 교환
        const tempOrderIndex = currentSchedule.order_index
        currentSchedule.order_index = nextSchedule.order_index
        nextSchedule.order_index = tempOrderIndex
        
        // 배열에서 위치 교환
        updatedSchedules[index] = nextSchedule
        updatedSchedules[index + 1] = currentSchedule
        
        onSchedulesChange(updatedSchedules)
      }
    }
  }

  // 버킷에서 이미지 목록 가져오기
  const fetchBucketImages = useCallback(async () => {
    setLoadingBucketImages(true)
    try {
      const { data, error } = await supabase.storage
        .from('product-media')
        .list('images', {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        console.error('이미지 목록 가져오기 오류:', error)
        return
      }

      const images = await Promise.all(
        data.map(async (file) => {
          const { data: urlData } = supabase.storage
            .from('product-media')
            .getPublicUrl(`images/${file.name}`)
          return {
            name: file.name,
            url: urlData.publicUrl
          }
        })
      )

      setBucketImages(images)
    } catch (error) {
      console.error('이미지 목록 가져오기 예외:', error)
    } finally {
      setLoadingBucketImages(false)
    }
  }, [])

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0 && thumbnailIndex !== null) {
      const file = imageFiles[0]
      setUploadingThumbnail(true)
      try {
        const result = await uploadThumbnail(file, productId)
        if (result.success && result.url) {
          updateSchedule(thumbnailIndex, 'thumbnail_url', result.url)
        } else {
          alert(result.error || '업로드에 실패했습니다.')
        }
      } catch (error) {
        console.error('드래그 업로드 오류:', error)
        alert('업로드 중 오류가 발생했습니다.')
      } finally {
        setUploadingThumbnail(false)
      }
    }
  }, [thumbnailIndex, productId, updateSchedule])

  // 클립보드 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    
    if (imageItem && thumbnailIndex !== null) {
      const file = imageItem.getAsFile()
      if (file) {
        setUploadingThumbnail(true)
        try {
          const result = await uploadThumbnail(file, productId)
          if (result.success && result.url) {
            updateSchedule(thumbnailIndex, 'thumbnail_url', result.url)
          } else {
            alert(result.error || '업로드에 실패했습니다.')
          }
        } catch (error) {
          console.error('붙여넣기 업로드 오류:', error)
          alert('업로드 중 오류가 발생했습니다.')
        } finally {
          setUploadingThumbnail(false)
        }
      }
    }
  }, [thumbnailIndex, productId, updateSchedule])

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, i) => i !== index))
  }

  // 번역 함수
  const translateSchedule = async (index: number) => {
    const schedule = schedules[index]
    if (!schedule) return

    setTranslating(true)
    setTranslationError(null)

    try {
      // 번역할 필드들 수집
      const fieldsToTranslate: ScheduleTranslationFields = {
        title_ko: schedule.title_ko,
        description_ko: schedule.description_ko,
        location_ko: schedule.location_ko,
        guide_notes_ko: schedule.guide_notes_ko
      }

      // 번역 실행
      const result = await translateScheduleFields(fieldsToTranslate)

      if (result.success && result.translatedFields) {
        // 번역된 내용을 스케줄에 적용
        const updatedSchedules = [...schedules]
        updatedSchedules[index] = {
          ...updatedSchedules[index],
          ...result.translatedFields
        }
        onSchedulesChange(updatedSchedules)
      } else {
        setTranslationError(result.error || '번역에 실패했습니다.')
      }
    } catch (error) {
      console.error('번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(false)
    }
  }

  // 모든 스케줄 번역 함수
  const translateAllSchedules = async () => {
    setTranslating(true)
    setTranslationError(null)

    try {
      const updatedSchedules = [...schedules]
      
      for (let i = 0; i < schedules.length; i++) {
        const schedule = schedules[i]
        
        // 번역할 필드들 수집
        const fieldsToTranslate: ScheduleTranslationFields = {
          title_ko: schedule.title_ko,
          description_ko: schedule.description_ko,
          location_ko: schedule.location_ko,
          guide_notes_ko: schedule.guide_notes_ko
        }

        // 번역 실행
        const result = await translateScheduleFields(fieldsToTranslate)

        if (result.success && result.translatedFields) {
          // 번역된 내용을 스케줄에 적용
          updatedSchedules[i] = {
            ...updatedSchedules[i],
            ...result.translatedFields
          }
        } else {
          console.warn(`스케줄 ${i + 1}번 번역 실패:`, result.error)
        }

        // API 제한을 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      onSchedulesChange(updatedSchedules)
    } catch (error) {
      console.error('전체 번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(false)
    }
  }

  // ChatGPT 추천 함수들
  const suggestScheduleTitleForIndex = async (index: number) => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const schedule = schedules[index]
      const dayNumber = index + 1
      const suggestedTitle = await suggestScheduleTitle(dayNumber, schedule.location_ko || '')
      
      updateSchedule(index, 'title_ko', suggestedTitle)
    } catch (error) {
      console.error('ChatGPT 제목 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.')
    } finally {
      setSuggesting(false)
    }
  }

  const suggestScheduleDescriptionForIndex = async (index: number) => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const schedule = schedules[index]
      const suggestedDescription = await suggestScheduleDescription(
        schedule.title_ko || '', 
        schedule.location_ko || ''
      )
      
      updateSchedule(index, 'description_ko', suggestedDescription)
    } catch (error) {
      console.error('ChatGPT 설명 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.')
    } finally {
      setSuggesting(false)
    }
  }

  // 이동시간 합산 계산 함수 (각 가이드 유형별로 분리, 시간이 있는 일정만 계산)
  const calculateTotalTransportTime = () => {
    let twoGuidesGuideTime = 0
    let twoGuidesAssistantTime = 0
    let guideDriverGuideTime = 0
    let guideDriverDriverTime = 0

    schedules.forEach(schedule => {
      // 시간이 있는 이동 일정만 통계에 포함
      if (schedule.is_transport && schedule.duration_minutes && schedule.duration_minutes > 0) {
        const duration = schedule.duration_minutes
        
        // 2가이드에서 가이드가 선택된 경우
        if (schedule.two_guide_schedule === 'guide') {
          twoGuidesGuideTime += duration
        }
        // 2가이드에서 어시스턴트가 선택된 경우
        else if (schedule.two_guide_schedule === 'assistant') {
          twoGuidesAssistantTime += duration
        }
        
        // 가이드+드라이버에서 가이드가 선택된 경우
        if (schedule.guide_driver_schedule === 'guide') {
          guideDriverGuideTime += duration
        }
        // 가이드+드라이버에서 드라이버가 선택된 경우
        else if (schedule.guide_driver_schedule === 'assistant') {
          guideDriverDriverTime += duration
        }
      }
    })

    const formatTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      
      if (hours > 0 && mins > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}`
      } else if (hours > 0) {
        return `${hours}:00`
      } else {
        return `${mins}분`
      }
    }

    return {
      twoGuidesGuide: formatTime(twoGuidesGuideTime),
      twoGuidesAssistant: formatTime(twoGuidesAssistantTime),
      guideDriverGuide: formatTime(guideDriverGuideTime),
      guideDriverDriver: formatTime(guideDriverDriverTime)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h4 className="text-lg font-medium text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            테이블 형식 일정 추가
          </h4>
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              {(() => {
                const timeData = calculateTotalTransportTime()
                return (
                  <>
                    <span>2가이드 (가이드: {timeData.twoGuidesGuide}, 어시스턴트: {timeData.twoGuidesAssistant})</span>
                    <span>가이드+드라이버 (가이드: {timeData.guideDriverGuide}, 드라이버: {timeData.guideDriverDriver})</span>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowEnglishFields(!showEnglishFields)}
            className={`px-3 py-1 text-sm rounded-lg border ${
              showEnglishFields 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {showEnglishFields ? 'EN' : 'KO'}
          </button>
          <button
            type="button"
            onClick={translateAllSchedules}
            disabled={translating || schedules.length === 0}
            className="flex items-center px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
            title="모든 스케줄을 한국어에서 영어로 번역"
          >
            {translating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Languages className="h-4 w-4 mr-1" />
            )}
            {translating ? '번역 중...' : '전체 번역'}
          </button>
          <button
            type="button"
            onClick={() => {
              // 모든 스케줄의 제목과 설명을 ChatGPT로 추천받기
              schedules.forEach((_, index) => {
                suggestScheduleTitleForIndex(index)
                suggestScheduleDescriptionForIndex(index)
              })
            }}
            disabled={suggesting || schedules.length === 0}
            className="flex items-center px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            title="모든 스케줄의 제목과 설명을 ChatGPT로 추천받기"
          >
            {suggesting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {suggesting ? '추천 중...' : 'AI 추천'}
          </button>
          <button
            type="button"
            onClick={addNewSchedule}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            행 추가
          </button>
          <button
            type="button"
            onClick={() => {
              // 저장 전에 순서 자동 설정
              const updatedSchedules = schedules.map((schedule, index) => ({
                ...schedule,
                order_index: index + 1
              }))
              onSchedulesChange(updatedSchedules)
              onSave()
            }}
            disabled={saving || schedules.length === 0}
            className="flex items-center px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? '저장 중...' : '모두 저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex gap-2 text-xs font-medium text-gray-600">
          <div className="w-8">삭제</div>
          <div className="w-12">이동</div>
          <div className="w-12">썸네일</div>
          <div className="w-12">일차</div>
          <div className="w-12">순서</div>
          <div className="w-32">시작 (선택)</div>
          <div className="w-32">종료 (선택)</div>
          <div className="w-16">소요(분)</div>
          <div className="w-48">제목</div>
          <div className="w-48">설명</div>
          <div className="w-32">가이드 메모</div>
          <div className="w-40">2가이드</div>
          <div className="w-40">가이드+드라이버</div>
          <div className="w-40">옵션</div>
          <div className="w-32">위치</div>
          <div className="w-20">번역</div>
        </div>
      </div>

      {/* 번역 오류 메시지 */}
      {translationError && (
        <div className="px-4 py-2 bg-red-50 border-l-4 border-red-400">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{translationError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setTranslationError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ChatGPT 추천 오류 메시지 */}
      {suggestionError && (
        <div className="px-4 py-2 bg-red-50 border-l-4 border-red-400">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{suggestionError}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                type="button"
                onClick={() => setSuggestionError(null)}
                className="inline-flex text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 내용 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-2">
          {schedules.map((schedule, index) => (
            <div key={index} className="flex gap-2 items-end">
              {/* 삭제 버튼 */}
              <div className="w-8 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeSchedule(index)}
                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* 이동 버튼들 */}
              <div className="w-12 flex flex-col items-center justify-center space-y-1">
                <button
                  type="button"
                  onClick={() => moveScheduleUp(index)}
                  disabled={index === 0}
                  className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="위로 이동"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => moveScheduleDown(index)}
                  disabled={index === schedules.length - 1}
                  className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="아래로 이동"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* 썸네일 필드 */}
              <div className="w-12 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailIndex(index)
                    setShowThumbnailModal(true)
                  }}
                  className="h-8 w-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  title="썸네일 업로드"
                >
                  {schedule.thumbnail_url ? (
                    <img 
                      src={schedule.thumbnail_url} 
                      alt="썸네일" 
                      className="w-6 h-6 object-cover rounded"
                    />
                  ) : (
                    <Image className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* 일차 */}
              <div className="w-12">
                <input
                  type="number"
                  value={schedule.day_number}
                  onChange={(e) => updateSchedule(index, 'day_number', parseInt(e.target.value))}
                  className="w-full h-8 px-1 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="1"
                />
              </div>


              {/* 시작시간 (선택사항) */}
              <div className="w-32">
                <input
                  type="time"
                  value={schedule.start_time || ''}
                  onChange={(e) => {
                    const newStartTime = e.target.value || null
                    const newEndTime = newStartTime && schedule.duration_minutes 
                      ? calculateEndTime(newStartTime, schedule.duration_minutes) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      start_time: newStartTime,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="선택사항"
                />
              </div>

              {/* 종료시간 (선택사항) */}
              <div className="w-32">
                <input
                  type="time"
                  value={schedule.end_time || ''}
                  onChange={(e) => {
                    const newEndTime = e.target.value || null
                    const newDuration = schedule.start_time && newEndTime 
                      ? calculateDuration(schedule.start_time, newEndTime) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      end_time: newEndTime,
                      duration_minutes: newDuration
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="선택사항"
                />
              </div>

              {/* 소요시간 (선택사항) */}
              <div className="w-16">
                <input
                  type="number"
                  value={schedule.duration_minutes || ''}
                  onChange={(e) => {
                    const newDuration = parseInt(e.target.value) || null
                    const newEndTime = schedule.start_time && newDuration 
                      ? calculateEndTime(schedule.start_time, newDuration) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      duration_minutes: newDuration,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  onWheel={(e) => {
                    e.preventDefault()
                    const delta = e.deltaY > 0 ? -5 : 5
                    const currentDuration = schedule.duration_minutes || 0
                    const newDuration = Math.max(5, currentDuration + delta)
                    const newEndTime = schedule.start_time 
                      ? calculateEndTime(schedule.start_time, newDuration) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      duration_minutes: newDuration,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-1 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="5"
                  step="5"
                  placeholder="분"
                />
              </div>

              {/* 제목 필드 */}
              <div className="w-48">
                <div className="flex space-x-1">
                  <input
                    type="text"
                    value={showEnglishFields ? (schedule.title_en || '') : (schedule.title_ko || '')}
                    onChange={(e) => {
                      if (showEnglishFields) {
                        updateSchedule(index, 'title_en', e.target.value)
                      } else {
                        updateSchedule(index, 'title_ko', e.target.value)
                      }
                    }}
                    className="flex-1 h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={showEnglishFields ? "English title" : "한국어 제목"}
                  />
                  {!showEnglishFields && (
                    <button
                      type="button"
                      onClick={() => suggestScheduleTitleForIndex(index)}
                      disabled={suggesting}
                      className="px-2 py-1 text-xs bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 disabled:opacity-50"
                      title="ChatGPT로 제목 추천받기"
                    >
                      <Sparkles className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 설명 필드 */}
              <div className="w-48">
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTextModalType('description')
                      setTextModalIndex(index)
                      setShowTextModal(true)
                    }}
                    className="flex-1 h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-left hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  >
                    <span className="truncate">
                      {showEnglishFields ? (schedule.description_en || '') : (schedule.description_ko || '') || (showEnglishFields ? "English description" : "한국어 설명")}
                    </span>
                    <span className="text-gray-400 text-xs">✏️</span>
                  </button>
                  {!showEnglishFields && (
                    <button
                      type="button"
                      onClick={() => suggestScheduleDescriptionForIndex(index)}
                      disabled={suggesting}
                      className="px-2 py-1 text-xs bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 disabled:opacity-50"
                      title="ChatGPT로 설명 추천받기"
                    >
                      <Sparkles className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* 가이드 메모 */}
              <div className="w-32">
                <button
                  type="button"
                  onClick={() => {
                    setTextModalType('guide_notes')
                    setTextModalIndex(index)
                    setShowTextModal(true)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-left hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                >
                  <span className="truncate">
                    {showEnglishFields ? (schedule.guide_notes_en || '') : (schedule.guide_notes_ko || '') || (showEnglishFields ? "Guide notes (English)" : "가이드 메모 (한국어)")}
                  </span>
                  <span className="text-gray-400 text-xs">✏️</span>
                </button>
              </div>

              {/* 2가이드 담당자 선택 */}
              <div className="w-40">
                <select
                  value={schedule.two_guide_schedule || ''}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      two_guide_schedule: e.target.value as 'guide' | 'assistant' | undefined
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">선택</option>
                  <option value="guide">가이드</option>
                  <option value="assistant">어시스턴트</option>
                </select>
              </div>

              {/* 가이드+드라이버 담당자 선택 */}
              <div className="w-40">
                <select
                  value={schedule.guide_driver_schedule || ''}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      guide_driver_schedule: e.target.value as 'guide' | 'assistant' | undefined
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">선택</option>
                  <option value="guide">가이드</option>
                  <option value="assistant">드라이버</option>
                </select>
              </div>

              {/* 옵션 선택 버튼 */}
              <div className="w-40">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentScheduleIndex(index)
                    setShowOptionsModal(true)
                  }}
                  className="w-full h-8 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {[
                    schedule.is_break && '휴식',
                    schedule.is_meal && '식사',
                    schedule.is_transport && '이동',
                    schedule.is_tour && '관광',
                    schedule.show_to_customers && '고객표시'
                  ].filter(Boolean).join(',') || '옵션 설정'}
                </button>
              </div>

              {/* 위치 필드 */}
              <div className="w-32">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={schedule.location_ko || ''}
                    onChange={(e) => {
                      updateSchedule(index, 'location_ko', e.target.value)
                    }}
                    className="flex-1 h-8 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="좌표"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setMapModalIndex(index)
                      setShowMapModal(true)
                    }}
                    className="h-8 px-1 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 flex items-center"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    지도
                  </button>
                </div>
              </div>

              {/* 번역 버튼 */}
              <div className="w-20 flex justify-center">
                <button
                  type="button"
                  onClick={() => translateSchedule(index)}
                  disabled={translating}
                  className="px-2 py-1 text-xs bg-purple-100 text-purple-600 rounded hover:bg-purple-200 disabled:opacity-50"
                  title="이 행 번역"
                >
                  {translating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Languages className="h-3 w-3" />
                  )}
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* 지도 위치 선택 모달 */}
      {showLocationPicker && locationPickerIndex !== null && (
        <LocationPickerModal
          currentLat={schedules[locationPickerIndex]?.latitude}
          currentLng={schedules[locationPickerIndex]?.longitude}
          onLocationSelect={(lat, lng, address) => {
            const updatedSchedules = [...schedules]
            updatedSchedules[locationPickerIndex] = {
              ...updatedSchedules[locationPickerIndex],
              latitude: lat,
              longitude: lng,
              location_ko: address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            }
            onSchedulesChange(updatedSchedules)
            setShowLocationPicker(false)
            setLocationPickerIndex(null)
          }}
          onClose={() => {
            setShowLocationPicker(false)
            setLocationPickerIndex(null)
          }}
        />
      )}

      {/* 옵션 설정 모달 */}
      {showOptionsModal && currentScheduleIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">옵션 설정</h3>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={schedules[currentScheduleIndex]?.is_break || false}
                  onChange={(e) => updateSchedule(currentScheduleIndex, 'is_break', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">휴식시간</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={schedules[currentScheduleIndex]?.is_meal || false}
                  onChange={(e) => updateSchedule(currentScheduleIndex, 'is_meal', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">식사시간</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={schedules[currentScheduleIndex]?.is_transport || false}
                  onChange={(e) => updateSchedule(currentScheduleIndex, 'is_transport', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">이동시간</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={schedules[currentScheduleIndex]?.is_tour || false}
                  onChange={(e) => updateSchedule(currentScheduleIndex, 'is_tour', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">관광시간</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={schedules[currentScheduleIndex]?.show_to_customers || false}
                  onChange={(e) => updateSchedule(currentScheduleIndex, 'show_to_customers', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">고객에게 표시</span>
              </label>
            </div>
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowOptionsModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 썸네일 업로드 모달 */}
      {showThumbnailModal && thumbnailIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">썸네일 업로드</h3>
              <button
                onClick={() => {
                  setShowThumbnailModal(false)
                  setThumbnailIndex(null)
                  setShowBucketImages(false)
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 왼쪽: 업로드 영역 */}
              <div className="space-y-4">
                {/* 현재 썸네일 표시 */}
                {schedules[thumbnailIndex]?.thumbnail_url && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">현재 썸네일:</p>
                    <img 
                      src={schedules[thumbnailIndex].thumbnail_url} 
                      alt="현재 썸네일" 
                      className="mx-auto max-w-full max-h-48 object-contain rounded-lg border"
                    />
                  </div>
                )}
                
                {/* 드래그 앤 드롭 영역 */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragOver 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  tabIndex={0}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    또는 Ctrl+V로 클립보드 이미지 붙여넣기
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingThumbnail}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadingThumbnail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        업로드 중...
                      </>
                    ) : (
                      '파일 선택'
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file && thumbnailIndex !== null) {
                        setUploadingThumbnail(true)
                        try {
                          const result = await uploadThumbnail(file, productId)
                          if (result.success && result.url) {
                            updateSchedule(thumbnailIndex, 'thumbnail_url', result.url)
                          } else {
                            alert(result.error || '업로드에 실패했습니다.')
                          }
                        } catch (error) {
                          console.error('업로드 오류:', error)
                          alert('업로드 중 오류가 발생했습니다.')
                        } finally {
                          setUploadingThumbnail(false)
                        }
                      }
                    }}
                    className="hidden"
                  />
                </div>
                
                {/* URL 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이미지 URL 입력
                  </label>
                  <input
                    type="url"
                    value={schedules[thumbnailIndex]?.thumbnail_url || ''}
                    onChange={(e) => updateSchedule(thumbnailIndex, 'thumbnail_url', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* 썸네일 삭제 */}
                {schedules[thumbnailIndex]?.thumbnail_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (thumbnailIndex !== null) {
                        const currentUrl = schedules[thumbnailIndex].thumbnail_url
                        if (currentUrl) {
                          // Supabase Storage URL인 경우 실제 파일도 삭제
                          if (isSupabaseStorageUrl(currentUrl)) {
                            try {
                              await deleteThumbnail(currentUrl)
                            } catch (error) {
                              console.error('파일 삭제 오류:', error)
                              // 파일 삭제 실패해도 DB에서 URL은 제거
                            }
                          }
                          updateSchedule(thumbnailIndex, 'thumbnail_url', '')
                        }
                      }
                    }}
                    className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    썸네일 삭제
                  </button>
                )}
              </div>
              
              {/* 오른쪽: 버킷 이미지 선택 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900">기존 이미지 선택</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBucketImages(!showBucketImages)
                      if (!showBucketImages && bucketImages.length === 0) {
                        fetchBucketImages()
                      }
                    }}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    {showBucketImages ? '숨기기' : '보기'}
                  </button>
                </div>
                
                {showBucketImages && (
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    {loadingBucketImages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-600">이미지 로딩 중...</span>
                      </div>
                    ) : bucketImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {bucketImages.map((image, index) => (
                          <div
                            key={index}
                            className="relative group cursor-pointer"
                            onClick={() => {
                              if (thumbnailIndex !== null) {
                                updateSchedule(thumbnailIndex, 'thumbnail_url', image.url)
                              }
                            }}
                          >
                            <img
                              src={image.url}
                              alt={image.name}
                              className="w-full h-20 object-cover rounded border hover:border-blue-500 transition-colors"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                              <Copy className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>업로드된 이미지가 없습니다.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowThumbnailModal(false)
                  setThumbnailIndex(null)
                  setShowBucketImages(false)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 텍스트 입력 모달 */}
      {showTextModal && textModalIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {textModalType === 'description' 
                ? (showEnglishFields ? 'English Description' : '한국어 설명')
                : (showEnglishFields ? 'Guide Notes (English)' : '가이드 메모 (한국어)')
              }
            </h3>
            
            <textarea
              value={(() => {
                const schedule = schedules[textModalIndex]
                if (textModalType === 'description') {
                  return showEnglishFields ? (schedule.description_en || '') : (schedule.description_ko || '')
                } else {
                  return showEnglishFields ? (schedule.guide_notes_en || '') : (schedule.guide_notes_ko || '')
                }
              })()}
              onChange={(e) => {
                const schedule = schedules[textModalIndex]
                if (textModalType === 'description') {
                  if (showEnglishFields) {
                    updateSchedule(textModalIndex, 'description_en', e.target.value)
                  } else {
                    updateSchedule(textModalIndex, 'description_ko', e.target.value)
                  }
                } else {
                  if (showEnglishFields) {
                    updateSchedule(textModalIndex, 'guide_notes_en', e.target.value)
                  } else {
                    updateSchedule(textModalIndex, 'guide_notes_ko', e.target.value)
                  }
                }
              }}
              className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={textModalType === 'description' 
                ? (showEnglishFields ? 'Enter English description...' : '한국어 설명을 입력하세요...')
                : (showEnglishFields ? 'Enter guide notes in English...' : '가이드 메모를 입력하세요...')
              }
            />
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowTextModal(false)
                  setTextModalIndex(null)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새로운 지도 모달 */}
      {showMapModal && mapModalIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">위치 선택</h3>
              <button
                onClick={() => {
                  setShowMapModal(false)
                  setMapModalIndex(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                라스베가스 지역에서 투어 위치를 검색하거나 지도에서 클릭하여 좌표를 선택하세요.
              </p>
              
              {/* 검색 기능 */}
              <div className="mb-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="mapSearch"
                    placeholder="투어 위치를 검색하세요 (예: Bellagio Hotel)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleMapSearch()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleMapSearch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    검색
                  </button>
                </div>
              </div>

              {/* 검색 결과 미리보기 */}
              {selectedAddress && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">검색 결과:</h4>
                  <p className="text-sm text-green-700 mb-1">
                    <strong>주소:</strong> {selectedAddress}
                  </p>
                  <p className="text-sm text-green-700 mb-1">
                    <strong>구글 맵 링크:</strong> 
                    <a 
                      href={selectedGoogleMapLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 hover:text-blue-800 underline"
                    >
                      링크 열기
                    </a>
                  </p>
                </div>
              )}

              {/* 지도 컨테이너 */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <div 
                  id="map" 
                  style={{ width: '100%', height: '400px' }}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  위도 (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  id="latitude"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 36.1699"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  경도 (Longitude)
                </label>
                <input
                  type="number"
                  step="any"
                  id="longitude"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: -115.1398"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMapModal(false)
                  setMapModalIndex(null)
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const lat = (document.getElementById('latitude') as HTMLInputElement)?.value
                  const lng = (document.getElementById('longitude') as HTMLInputElement)?.value
                  if (lat && lng) {
                    handleMapCoordinateSelect(
                      parseFloat(lat), 
                      parseFloat(lng), 
                      selectedAddress || undefined
                    )
                  } else {
                    alert('위도와 경도를 입력해주세요.')
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                좌표 적용
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
