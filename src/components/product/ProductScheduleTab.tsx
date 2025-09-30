'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Clock, MapPin, Utensils, Car, Coffee, Plus, Edit, Trash2, Save, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
}

interface ProductScheduleTabProps {
  productId: string
  isNewProduct: boolean
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function ProductScheduleTab({
  productId,
  isNewProduct,
  formData,
  setFormData
}: ProductScheduleTabProps) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)

  // 기존 일정 데이터 로드
  useEffect(() => {
    if (!isNewProduct && productId) {
      fetchSchedules()
    } else {
      setLoading(false)
    }
  }, [productId, isNewProduct])

  const fetchSchedules = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('product_schedules')
        .select('*')
        .eq('product_id', productId)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('Supabase 오류:', error)
        throw new Error(`데이터베이스 오류: ${error.message}`)
      }

      setSchedules(data || [])
    } catch (error) {
      console.error('일정 로드 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setSaveMessage(`일정을 불러오는데 실패했습니다: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSchedule = () => {
    const newSchedule: ScheduleItem = {
      product_id: productId,
      day_number: schedules.length > 0 ? Math.max(...schedules.map(s => s.day_number)) + 1 : 1,
      start_time: '09:00',
      end_time: '10:00',
      title: '',
      description: '',
      location: '',
      duration_minutes: 60,
      is_break: false,
      is_meal: false,
      is_transport: false,
      transport_type: '',
      transport_details: '',
      notes: ''
    }
    setEditingSchedule(newSchedule)
    setShowAddModal(true)
  }

  const handleEditSchedule = (schedule: ScheduleItem) => {
    setEditingSchedule(schedule)
    setShowAddModal(true)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return

    try {
      const { error } = await (supabase as any)
        .from('product_schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error

      setSchedules(prev => prev.filter(s => s.id !== scheduleId))
      setSaveMessage('일정이 삭제되었습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      setSaveMessage('일정 삭제에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleSaveSchedule = async (scheduleData: ScheduleItem) => {
    setSaving(true)
    setSaveMessage('')

    try {
      if (scheduleData.id) {
        // 업데이트
        const { error } = await (supabase as any)
          .from('product_schedules')
          .update({
            ...scheduleData,
            updated_at: new Date().toISOString()
          })
          .eq('id', scheduleData.id)

        if (error) throw error

        setSchedules(prev => prev.map(s => s.id === scheduleData.id ? scheduleData : s))
      } else {
        // 새로 생성
        const { data, error } = await (supabase as any)
          .from('product_schedules')
          .insert([scheduleData])
          .select()
          .single()

        if (error) throw error

        setSchedules(prev => [...prev, data])
      }

      setSaveMessage('일정이 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
      setShowAddModal(false)
      setEditingSchedule(null)
    } catch (error) {
      console.error('일정 저장 오류:', error)
      setSaveMessage('일정 저장에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const getScheduleIcon = (schedule: ScheduleItem) => {
    if (schedule.is_meal) return <Utensils className="h-4 w-4" />
    if (schedule.is_transport) return <Car className="h-4 w-4" />
    if (schedule.is_break) return <Coffee className="h-4 w-4" />
    return <Calendar className="h-4 w-4" />
  }

  const getScheduleColor = (schedule: ScheduleItem) => {
    if (schedule.is_meal) return 'bg-orange-100 text-orange-800 border-orange-200'
    if (schedule.is_transport) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (schedule.is_break) return 'bg-green-100 text-green-800 border-green-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    return `${hours}:${minutes}`
  }

  const groupSchedulesByDay = () => {
    const grouped: { [key: number]: ScheduleItem[] } = {}
    schedules.forEach(schedule => {
      if (!grouped[schedule.day_number]) {
        grouped[schedule.day_number] = []
      }
      grouped[schedule.day_number].push(schedule)
    })
    return grouped
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          투어 일정
        </h3>
        <div className="flex items-center space-x-4">
          {saveMessage && (
            <div className={`flex items-center text-sm ${
              saveMessage.includes('성공') || saveMessage.includes('저장') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddSchedule}
            disabled={isNewProduct}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4 mr-2" />
            일정 추가
          </button>
        </div>
      </div>

      {isNewProduct && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-yellow-800">
              새 상품의 경우 상품을 먼저 저장한 후 일정을 추가할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 일정 목록 */}
      {schedules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>아직 등록된 일정이 없습니다.</p>
          <p className="text-sm">일정 추가 버튼을 클릭하여 첫 번째 일정을 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupSchedulesByDay()).map(([dayNumber, daySchedules]) => (
            <div key={dayNumber} className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                {dayNumber}일차
              </h4>
              <div className="space-y-3">
                {daySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`p-4 rounded-lg border ${getScheduleColor(schedule)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getScheduleIcon(schedule)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h5 className="font-medium text-sm">{schedule.title}</h5>
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </div>
                            {schedule.location && (
                              <div className="flex items-center text-xs text-gray-500">
                                <MapPin className="h-3 w-3 mr-1" />
                                {schedule.location}
                              </div>
                            )}
                          </div>
                          {schedule.description && (
                            <p className="text-sm text-gray-600 mb-2">{schedule.description}</p>
                          )}
                          {schedule.transport_details && (
                            <p className="text-xs text-gray-500">
                              <Car className="h-3 w-3 inline mr-1" />
                              {schedule.transport_details}
                            </p>
                          )}
                          {schedule.notes && (
                            <p className="text-xs text-gray-500 mt-1">{schedule.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          type="button"
                          onClick={() => handleEditSchedule(schedule)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(schedule.id!)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 일정 추가/편집 모달 */}
      {showAddModal && editingSchedule && (
        <ScheduleModal
          schedule={editingSchedule}
          onSave={handleSaveSchedule}
          onClose={() => {
            setShowAddModal(false)
            setEditingSchedule(null)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

// 일정 추가/편집 모달 컴포넌트
interface ScheduleModalProps {
  schedule: ScheduleItem
  onSave: (schedule: ScheduleItem) => void
  onClose: () => void
  saving: boolean
}

function ScheduleModal({ schedule, onSave, onClose, saving }: ScheduleModalProps) {
  const [formData, setFormData] = useState<ScheduleItem>(schedule)

  const handleSave = () => {
    onSave(formData)
  }

  const handleInputChange = (field: keyof ScheduleItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {schedule.id ? '일정 편집' : '일정 추가'}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                일차
              </label>
              <input
                type="number"
                value={formData.day_number}
                onChange={(e) => handleInputChange('day_number', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소요시간 (분)
              </label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => handleInputChange('duration_minutes', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작 시간
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => handleInputChange('start_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료 시간
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => handleInputChange('end_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 호텔 픽업"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              세부내용
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="일정에 대한 자세한 설명을 입력해주세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              장소
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: 그랜드 하얏트 호텔"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_break"
                checked={formData.is_break}
                onChange={(e) => handleInputChange('is_break', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_break" className="ml-2 text-sm text-gray-700">
                휴식시간
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_meal"
                checked={formData.is_meal}
                onChange={(e) => handleInputChange('is_meal', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_meal" className="ml-2 text-sm text-gray-700">
                식사시간
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_transport"
                checked={formData.is_transport}
                onChange={(e) => handleInputChange('is_transport', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_transport" className="ml-2 text-sm text-gray-700">
                이동시간
              </label>
            </div>
          </div>

          {formData.is_transport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  교통수단
                </label>
                <input
                  type="text"
                  value={formData.transport_type}
                  onChange={(e) => handleInputChange('transport_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 버스, 도보, 택시"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  교통 세부사항
                </label>
                <input
                  type="text"
                  value={formData.transport_details}
                  onChange={(e) => handleInputChange('transport_details', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 30분 버스 이동"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              추가 메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="특별한 주의사항이나 추가 정보를 입력해주세요"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
