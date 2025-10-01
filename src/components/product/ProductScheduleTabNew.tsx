'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import TableScheduleAdd from '../TableScheduleAdd'

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
  // 새로운 필드들
  latitude?: number
  longitude?: number
  show_to_customers: boolean
  guide_assignment_type: 'none' | 'single_guide' | 'two_guides' | 'guide_driver'
  // 2가이드 전용 필드
  assigned_guide_1?: string
  assigned_guide_2?: string
  // 가이드+드라이버 전용 필드
  assigned_guide_driver_guide?: string
  assigned_guide_driver_driver?: string
  // 다국어 지원 필드들
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
  // 투어 시간 필드
  is_tour: boolean
  // Index signature for Supabase compatibility
  [key: string]: unknown
}

interface ProductScheduleTabProps {
  productId: string
  isNewProduct: boolean
  formData: Record<string, unknown>
  setFormData: (data: Record<string, unknown>) => void
}

export default function ProductScheduleTab({
  productId,
  isNewProduct
}: ProductScheduleTabProps) {
  
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [addMode, setAddMode] = useState<'modal' | 'table'>('modal')
  const [showTableAdd, setShowTableAdd] = useState(false)
  const [tableSchedules, setTableSchedules] = useState<ScheduleItem[]>([])
  const [saving, setSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{email: string, name_ko: string, position: string}>>([])

  const fetchSchedules = React.useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('product_schedules')
        .select('*')
        .eq('product_id', productId)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) {
        console.error('일정 로드 오류:', error)
        return
      }

      setSchedules(data || [])
    } catch (error) {
      console.error('일정 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [productId])

  const fetchTeamMembers = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko, position')
        .eq('is_active', true)
        .order('name_ko')

      if (error) {
        console.error('팀 멤버 로드 오류:', error)
        return
      }

      setTeamMembers(data || [])
    } catch (error) {
      console.error('팀 멤버 로드 오류:', error)
    }
  }, [])

  useEffect(() => {
    if (!isNewProduct) {
      fetchSchedules()
      fetchTeamMembers()
    }
  }, [productId, isNewProduct, fetchSchedules, fetchTeamMembers])

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
      notes: '',
      // 새로운 필드들
      latitude: undefined,
      longitude: undefined,
      show_to_customers: true,
      guide_assignment_type: 'none',
      assigned_guide_1: '',
      assigned_guide_2: '',
      assigned_guide_driver_guide: '',
      assigned_guide_driver_driver: '',
      // 다국어 지원 필드들
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
      is_tour: false
    }
    setTableSchedules(prev => [...prev, newSchedule])
    setShowTableAdd(true)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('product_schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) {
        console.error('일정 삭제 오류:', error)
        return
      }

      setSchedules(prev => prev.filter(s => s.id !== scheduleId))
    } catch (error) {
      console.error('일정 삭제 오류:', error)
    }
  }

  const handleSaveSchedule = async (scheduleData: ScheduleItem) => {
    try {
      setSaving(true)
      
      if (scheduleData.id) {
        // 수정
        const { error } = await (supabase as unknown as { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (column: string, value: unknown) => Promise<{ error: unknown }> } } })
          .from('product_schedules')
          .update(scheduleData)
          .eq('id', scheduleData.id)

        if (error) {
          console.error('일정 수정 오류:', error)
          return
        }

        setSchedules(prev => prev.map(s => s.id === scheduleData.id ? scheduleData : s))
      } else {
        // 추가
        const { data, error } = await (supabase as unknown as { from: (table: string) => { insert: (data: Record<string, unknown>[]) => { select: () => Promise<{ data: ScheduleItem[] | null, error: unknown }> } } })
          .from('product_schedules')
          .insert([scheduleData])
          .select()

        if (error) {
          console.error('일정 추가 오류:', error)
          return
        }

        setSchedules(prev => [...prev, data![0]])
      }
    } catch (error) {
      console.error('일정 저장 오류:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTableSchedules = async () => {
    try {
      setSaving(true)
      
      for (const schedule of tableSchedules) {
        await handleSaveSchedule(schedule)
      }
      
      setTableSchedules([])
      setShowTableAdd(false)
      await fetchSchedules()
    } catch (error) {
      console.error('테이블 일정 저장 오류:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Calendar className="h-5 w-5 mr-2" />
          투어 일정 관리
        </h3>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setAddMode('modal')
              handleAddSchedule()
            }}
            disabled={isNewProduct}
            className={`flex items-center px-3 py-2 rounded-lg text-sm ${
              addMode === 'modal' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Plus className="h-4 w-4 mr-1" />
            모달로 추가
          </button>
          <button
            type="button"
            onClick={() => {
              setAddMode('table')
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
                is_tour: false
              }
              setTableSchedules(prev => [...prev, newSchedule])
              setShowTableAdd(true)
            }}
            disabled={isNewProduct}
            className={`flex items-center px-3 py-2 rounded-lg text-sm ${
              addMode === 'table' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Plus className="h-4 w-4 mr-1" />
            테이블로 추가
          </button>
        </div>
      </div>

      {/* 일정 목록 */}
      <div className="space-y-4">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    {schedule.day_number}일차
                  </span>
                  <span className="text-sm text-gray-500">
                    {schedule.start_time} - {schedule.end_time}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({schedule.duration_minutes}분)
                  </span>
                  {schedule.is_transport && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      이동시간
                    </span>
                  )}
                  {schedule.is_break && (
                    <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                      휴식
                    </span>
                  )}
                  {schedule.is_meal && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      식사
                    </span>
                  )}
                </div>
                
                <h4 className="font-medium text-gray-900 mb-1">
                  {schedule.title_ko || schedule.title}
                </h4>
                
                {(schedule.description_ko || schedule.description) && (
                  <p className="text-sm text-gray-600 mb-2">
                    {schedule.description_ko || schedule.description}
                  </p>
                )}
                
                {(schedule.location_ko || schedule.location) && (
                  <p className="text-sm text-gray-500 mb-1">
                    📍 {schedule.location_ko || schedule.location}
                  </p>
                )}
                
                {(schedule.transport_details_ko || schedule.transport_details) && (
                  <p className="text-sm text-gray-500 mb-1">
                    🚗 {schedule.transport_details_ko || schedule.transport_details}
                  </p>
                )}
                
                {(schedule.notes_ko || schedule.notes) && (
                  <p className="text-sm text-gray-500 mb-1">
                    📝 {schedule.notes_ko || schedule.notes}
                  </p>
                )}
                
                {(schedule.guide_notes_ko || schedule.guide_notes_en) && (
                  <p className="text-xs text-gray-500 mt-1 italic">
                    가이드 메모: {schedule.guide_notes_ko || schedule.guide_notes_en}
                    {schedule.guide_notes_en && schedule.guide_notes_ko && (
                      <span className="ml-1">({schedule.guide_notes_en})</span>
                    )}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDeleteSchedule(schedule.id!)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {schedules.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            아직 등록된 일정이 없습니다.
          </div>
        )}
      </div>

      {/* 테이블 형식 일정 추가 모달 */}
      {showTableAdd && (
        <TableScheduleAdd
          schedules={tableSchedules as unknown as ScheduleItem[]}
          onSchedulesChange={(schedules: unknown) => setTableSchedules(schedules as ScheduleItem[])}
          onSave={handleSaveTableSchedules}
          onClose={() => setShowTableAdd(false)}
          saving={saving}
          teamMembers={teamMembers}
          productId={productId}
        />
      )}
    </div>
  )
}
