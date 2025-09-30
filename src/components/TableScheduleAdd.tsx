'use client'

import React, { useState } from 'react'
import { Calendar, Plus, Save, Trash2 } from 'lucide-react'
import LocationPickerModal from './LocationPickerModal'

interface ScheduleItem {
  id?: string
  product_id: string
  day_number: number
  start_time: string
  end_time: string
  title: string
  description: string
  location: string
  duration_minutes: number
  is_break: boolean
  is_meal: boolean
  is_transport: boolean
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
}

interface TableScheduleAddProps {
  schedules: ScheduleItem[]
  onSchedulesChange: (schedules: ScheduleItem[]) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  teamMembers: Array<{email: string, name_ko: string, position: string}>
}

export default function TableScheduleAdd({ 
  schedules, 
  onSchedulesChange, 
  onSave, 
  onClose, 
  saving, 
  teamMembers 
}: TableScheduleAddProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerIndex, setLocationPickerIndex] = useState<number | null>(null)
  const [showEnglishFields, setShowEnglishFields] = useState(false)
  const [showOptionsModal, setShowOptionsModal] = useState(false)
  const [currentScheduleIndex, setCurrentScheduleIndex] = useState<number | null>(null)

  // 시간 계산 유틸리티 함수들
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const calculateDuration = (startTime: string, endTime: string): number => {
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)
    return endMinutes - startMinutes
  }

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = startMinutes + durationMinutes
    return minutesToTime(endMinutes)
  }

  const addNewSchedule = () => {
    // 마지막 행의 정보를 가져오기
    const lastSchedule = schedules.length > 0 ? schedules[schedules.length - 1] : null
    const lastDayNumber = lastSchedule ? lastSchedule.day_number : 1
    const lastEndTime = lastSchedule ? lastSchedule.end_time : '09:00'
    
    const newSchedule: ScheduleItem = {
      product_id: '',
      day_number: lastDayNumber, // 윗 행과 같은 일차
      start_time: lastEndTime, // 윗 행의 종료 시간을 시작 시간으로
      end_time: calculateEndTime(lastEndTime, 60), // 시작 시간 + 60분
      title: '',
      description: '',
      location: '',
      duration_minutes: 60,
      is_break: false,
      is_meal: false,
      is_transport: false,
      transport_type: '',
      transport_details: '',
      notes: '',
      latitude: undefined,
      longitude: undefined,
      show_to_customers: true,
      guide_assignment_type: '',
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
      guide_notes_en: ''
    }
    onSchedulesChange([...schedules, newSchedule])
  }

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: any) => {
    const updatedSchedules = [...schedules]
    updatedSchedules[index] = { ...updatedSchedules[index], [field]: value }
    onSchedulesChange(updatedSchedules)
  }

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, i) => i !== index))
  }

  // 이동시간 합산 계산 함수 (각 가이드 유형별로 분리)
  const calculateTotalTransportTime = () => {
    let twoGuidesGuideTime = 0
    let twoGuidesAssistantTime = 0
    let guideDriverGuideTime = 0
    let guideDriverDriverTime = 0

    schedules.forEach(schedule => {
      if (schedule.is_transport) {
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
            onClick={onSave}
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
          <div className="w-12">일차</div>
          <div className="w-32">시작</div>
          <div className="w-32">종료</div>
          <div className="w-16">소요(분)</div>
          <div className="w-48">제목</div>
          <div className="w-64">설명</div>
          <div className="w-32">가이드 메모</div>
          <div className="w-40">2가이드</div>
          <div className="w-40">가이드+드라이버</div>
          <div className="w-40">옵션</div>
          <div className="w-28">위치</div>
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

              {/* 시작시간 */}
              <div className="w-32">
                <input
                  type="time"
                  value={schedule.start_time}
                  onChange={(e) => {
                    const newStartTime = e.target.value
                    const newEndTime = calculateEndTime(newStartTime, schedule.duration_minutes)
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      start_time: newStartTime,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* 종료시간 */}
              <div className="w-32">
                <input
                  type="time"
                  value={schedule.end_time}
                  onChange={(e) => {
                    const newEndTime = e.target.value
                    const newDuration = calculateDuration(schedule.start_time, newEndTime)
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      end_time: newEndTime,
                      duration_minutes: newDuration
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* 소요시간 */}
              <div className="w-16">
                <input
                  type="number"
                  value={schedule.duration_minutes}
                  onChange={(e) => {
                    const newDuration = parseInt(e.target.value) || 0
                    const newEndTime = calculateEndTime(schedule.start_time, newDuration)
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
                    const newDuration = Math.max(5, schedule.duration_minutes + delta)
                    const newEndTime = calculateEndTime(schedule.start_time, newDuration)
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
                <input
                  type="text"
                  value={showEnglishFields ? (schedule.description_en || '') : (schedule.description_ko || '')}
                  onChange={(e) => {
                    if (showEnglishFields) {
                      updateSchedule(index, 'description_en', e.target.value)
                    } else {
                      updateSchedule(index, 'description_ko', e.target.value)
                    }
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={showEnglishFields ? "English description" : "한국어 설명"}
                />
              </div>

              {/* 가이드 메모 */}
              <div className="w-32">
                <input
                  type="text"
                  value={showEnglishFields ? (schedule.guide_notes_en || '') : (schedule.guide_notes_ko || '')}
                  onChange={(e) => {
                    if (showEnglishFields) {
                      updateSchedule(index, 'guide_notes_en', e.target.value)
                    } else {
                      updateSchedule(index, 'guide_notes_ko', e.target.value)
                    }
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={showEnglishFields ? "Guide notes (English)" : "가이드 메모 (한국어)"}
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
                    schedule.show_to_customers && '고객표시'
                  ].filter(Boolean).join(',') || '옵션 설정'}
                </button>
              </div>

              {/* 위치 필드 */}
              <div className="w-28">
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

    </div>
  )
}
