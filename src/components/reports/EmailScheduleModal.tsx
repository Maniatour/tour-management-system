'use client'

import React, { useState, useEffect } from 'react'
import { X, Mail, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface EmailScheduleModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function EmailScheduleModal({ isOpen, onClose }: EmailScheduleModalProps) {
  const [emailSchedules, setEmailSchedules] = useState<Array<{ enabled: boolean; time: string; period: ReportPeriod }>>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadEmailSchedules()
    }
  }, [isOpen])

  const loadEmailSchedules = async () => {
    setLoadingSchedules(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        return
      }

      const response = await fetch('/api/reports/email-schedule', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.schedules) {
          setEmailSchedules(data.schedules.map((s: any) => ({
            enabled: s.enabled,
            time: s.send_time?.substring(0, 5) || '09:00',
            period: s.period
          })))
        }
      }
    } catch (error) {
      console.error('이메일 스케줄 로드 오류:', error)
    } finally {
      setLoadingSchedules(false)
    }
  }

  const handleSaveEmailSchedule = async (schedule: { enabled: boolean; time: string; period: ReportPeriod }) => {
    setSaving(schedule.period)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch('/api/reports/email-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(schedule)
      })

      if (!response.ok) {
        throw new Error('이메일 스케줄 저장에 실패했습니다.')
      }

      await loadEmailSchedules()
      alert('이메일 스케줄이 저장되었습니다.')
    } catch (error) {
      console.error('이메일 스케줄 저장 오류:', error)
      alert(error instanceof Error ? error.message : '이메일 스케줄 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 배경 오버레이 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* 모달 컨테이너 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center space-x-2">
              <Mail size={24} className="text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">자동 이메일 리포트 설정</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* 내용 */}
          <div className="p-6">
            {loadingSchedules ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {(['daily', 'weekly', 'monthly', 'yearly'] as ReportPeriod[]).map((period) => {
                  const schedule = emailSchedules.find(s => s.period === period) || {
                    enabled: false,
                    time: '09:00',
                    period
                  }

                  return (
                    <div key={period} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          {period === 'daily' ? '일별' : 
                           period === 'weekly' ? '주별' : 
                           period === 'monthly' ? '월별' : '연간'} 리포트
                        </h4>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={schedule.enabled}
                            onChange={(e) => {
                              const updatedSchedule = { ...schedule, enabled: e.target.checked }
                              setEmailSchedules(prev => 
                                prev.find(s => s.period === period)
                                  ? prev.map(s => s.period === period ? updatedSchedule : s)
                                  : [...prev, updatedSchedule]
                              )
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700">활성화</span>
                        </label>
                      </div>
                      {schedule.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              전송 시간
                            </label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                              <input
                                type="time"
                                value={schedule.time}
                                onChange={(e) => {
                                  const updatedSchedule = { ...schedule, time: e.target.value }
                                  setEmailSchedules(prev => 
                                    prev.find(s => s.period === period)
                                      ? prev.map(s => s.period === period ? updatedSchedule : s)
                                      : [...prev, updatedSchedule]
                                  )
                                }}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => handleSaveEmailSchedule(schedule)}
                        disabled={saving === period}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
                      >
                        {saving === period ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>저장 중...</span>
                          </>
                        ) : (
                          <span>저장</span>
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
