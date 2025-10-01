'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Calendar, Plus, Save, Trash2, Image, X, Upload, Loader2, Search, FolderOpen, Copy, ChevronUp, ChevronDown } from 'lucide-react'
import LocationPickerModal from './LocationPickerModal'
import { uploadThumbnail, deleteThumbnail, isSupabaseStorageUrl, uploadProductMedia } from '@/lib/productMediaUpload'
import { supabase } from '@/lib/supabase'

interface ScheduleItem {
  id?: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  title: string
  description: string
  location: string
  duration_minutes: number | null
  is_break: boolean
  is_meal: boolean
  is_transport: boolean
  is_tour: boolean
  transport_type: string
  transport_details: string
  notes: string
  latitude?: number
  longitude?: number
  show_to_customers: boolean
  guide_assignment_type: 'none' | 'single_guide' | 'two_guides' | 'guide_driver'
  assigned_guide_1?: string
  assigned_guide_2?: string
  assigned_guide_driver_guide?: string
  assigned_guide_driver_driver?: string
  title_ko?: string
  title_en?: string
  description_ko?: string
  description_en?: string
  location_ko?: string
  location_en?: string
  transport_details_ko?: string
  transport_details_en?: string
  notes_ko?: string
  notes_en?: string
  guide_notes_ko?: string
  guide_notes_en?: string
  thumbnail_url?: string
  order_index?: number
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      title: '',
      description: '',
      location: '',
      duration_minutes: lastEndTime ? 60 : null, // 시간이 없으면 null
      is_break: false,
      is_meal: false,
      is_transport: false,
      is_tour: false,
      transport_type: '',
      transport_details: '',
      notes: '',
      latitude: undefined,
      longitude: undefined,
      show_to_customers: true,
      guide_assignment_type: 'none',
      assigned_guide_1: '',
      assigned_guide_2: '',
      assigned_guide_driver_guide: '',
      assigned_guide_driver_driver: '',
      title_ko: '',
      title_en: '',
      description_ko: '',
      description_en: '',
      location_ko: '',
      location_en: '',
      transport_details_ko: '',
      transport_details_en: '',
      notes_ko: '',
      notes_en: '',
      guide_notes_ko: '',
      guide_notes_en: '',
      thumbnail_url: '',
      order_index: maxOrderIndex + 1 // 다음 순서로 설정
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
        if (schedule.assigned_guide_1 === 'guide') {
          twoGuidesGuideTime += duration
        }
        // 2가이드에서 어시스턴트가 선택된 경우
        else if (schedule.assigned_guide_2 === 'assistant') {
          twoGuidesAssistantTime += duration
        }
        
        // 가이드+드라이버에서 가이드가 선택된 경우
        if (schedule.assigned_guide_driver_guide === 'guide') {
          guideDriverGuideTime += duration
        }
        // 가이드+드라이버에서 드라이버가 선택된 경우
        else if (schedule.assigned_guide_driver_driver === 'driver') {
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
          <div className="w-64">설명</div>
          <div className="w-32">가이드 메모</div>
          <div className="w-40">2가이드</div>
          <div className="w-40">가이드+드라이버</div>
          <div className="w-40">옵션</div>
          <div className="w-32">위치</div>
        </div>
      </div>

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
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={showEnglishFields ? "English title" : "한국어 제목"}
                />
              </div>

              {/* 설명 필드 */}
              <div className="w-64">
                <textarea
                  value={showEnglishFields ? (schedule.description_en || '') : (schedule.description_ko || '')}
                  onChange={(e) => {
                    if (showEnglishFields) {
                      updateSchedule(index, 'description_en', e.target.value)
                    } else {
                      updateSchedule(index, 'description_ko', e.target.value)
                    }
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[32px] align-top"
                  placeholder={showEnglishFields ? "English description" : "한국어 설명"}
                  rows={1}
                />
              </div>

              {/* 가이드 메모 */}
              <div className="w-32">
                <textarea
                  value={showEnglishFields ? (schedule.guide_notes_en || '') : (schedule.guide_notes_ko || '')}
                  onChange={(e) => {
                    if (showEnglishFields) {
                      updateSchedule(index, 'guide_notes_en', e.target.value)
                    } else {
                      updateSchedule(index, 'guide_notes_ko', e.target.value)
                    }
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[32px] align-top"
                  placeholder={showEnglishFields ? "Guide notes (English)" : "가이드 메모 (한국어)"}
                  rows={1}
                />
              </div>

              {/* 2가이드 담당자 선택 */}
              <div className="w-40">
                <select
                  value={(() => {
                    const result = schedule.assigned_guide_1 === 'guide' ? 'guide' : 
                                   schedule.assigned_guide_2 === 'assistant' ? 'assistant' : ''
                    console.log('2가이드 드롭다운 value 계산:', {
                      assigned_guide_1: schedule.assigned_guide_1,
                      assigned_guide_2: schedule.assigned_guide_2,
                      result
                    })
                    return result
                  })()}
                  onChange={(e) => {
                    console.log('2가이드 드롭다운 변경:', e.target.value)
                    // 2가이드 드롭다운만 독립적으로 업데이트 (assigned_driver는 건드리지 않음)
                    const updatedSchedules = [...schedules]
                    if (e.target.value === 'guide') {
                      updatedSchedules[index] = {
                        ...updatedSchedules[index],
                        assigned_guide_1: 'guide',
                        assigned_guide_2: ''
                      }
                    } else if (e.target.value === 'assistant') {
                      updatedSchedules[index] = {
                        ...updatedSchedules[index],
                        assigned_guide_1: '',
                        assigned_guide_2: 'assistant'
                      }
                    } else {
                      // 선택 해제 시
                      updatedSchedules[index] = {
                        ...updatedSchedules[index],
                        assigned_guide_1: '',
                        assigned_guide_2: ''
                      }
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
                  value={(() => {
                    const result = schedule.assigned_guide_driver_guide === 'guide' ? 'guide' : 
                                   schedule.assigned_guide_driver_driver === 'driver' ? 'driver' : ''
                    console.log('가이드+드라이버 드롭다운 value 계산:', {
                      assigned_guide_driver_guide: schedule.assigned_guide_driver_guide,
                      assigned_guide_driver_driver: schedule.assigned_guide_driver_driver,
                      result
                    })
                    return result
                  })()}
                  onChange={(e) => {
                    console.log('가이드+드라이버 드롭다운 변경:', e.target.value)
                    // 가이드+드라이버 드롭다운만 독립적으로 업데이트
                    const updatedSchedules = [...schedules]
                    if (e.target.value === 'guide') {
                      // 가이드 선택 시: assigned_guide_driver_guide에 'guide' 저장
                      updatedSchedules[index] = {
                        ...updatedSchedules[index],
                        assigned_guide_driver_guide: 'guide',
                        assigned_guide_driver_driver: ''
                      }
                    } else if (e.target.value === 'driver') {
                      // 드라이버 선택 시: assigned_guide_driver_driver에 'driver' 저장
                      updatedSchedules[index] = {
                        ...updatedSchedules[index],
                        assigned_guide_driver_guide: '',
                        assigned_guide_driver_driver: 'driver'
                      }
                    } else {
                      // 선택 해제 시
                      updatedSchedules[index] = {
                        ...updatedSchedules[index],
                        assigned_guide_driver_guide: '',
                        assigned_guide_driver_driver: ''
                      }
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">선택</option>
                  <option value="guide">가이드</option>
                  <option value="driver">드라이버</option>
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
                      setLocationPickerIndex(index)
                      setShowLocationPicker(true)
                    }}
                    className="h-8 px-1 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                  >
                    지도
                  </button>
                </div>
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

    </div>
  )
}
