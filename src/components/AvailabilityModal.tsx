'use client'

import React, { useState, useEffect } from 'react'
import { X, Calendar, CheckCircle, XCircle, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
  selectedChannel: string
  channelName: string
}

interface DateAvailability {
  date: string
  isAvailable: boolean
}

export default function AvailabilityModal({
  isOpen,
  onClose,
  productId,
  selectedChannel,
  channelName
}: AvailabilityModalProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [availabilityData, setAvailabilityData] = useState<DateAvailability[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // 월 변경
  const changeMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1)
      } else {
        newMonth.setMonth(prev.getMonth() + 1)
      }
      return newMonth
    })
  }

  // 날짜별 판매 가능 여부 토글
  const toggleAvailability = (date: string) => {
    setAvailabilityData(prev => {
      const existing = prev.find(item => item.date === date)
      if (existing) {
        return prev.map(item => 
          item.date === date 
            ? { ...item, isAvailable: !item.isAvailable }
            : item
        )
      } else {
        return [...prev, { date, isAvailable: true }]
      }
    })
  }

  // 특정 날짜의 판매 가능 여부 확인
  const isDateAvailable = (date: string) => {
    const item = availabilityData.find(item => item.date === date)
    return item ? item.isAvailable : true // 기본값은 판매 가능
  }

  // 월의 모든 날짜 생성
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // 이전 달의 빈 날짜들
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // 현재 달의 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({
        day,
        date: dateStr,
        isCurrentMonth: true
      })
    }
    
    return days
  }

  // 저장된 판매 가능 여부 데이터 로드
  const loadAvailabilityData = async () => {
    if (!selectedChannel) return

    try {
      const { data, error } = await supabase
        .from('dynamic_pricing')
        .select('start_date, end_date, is_sale_available')
        .eq('product_id', productId)
        .eq('channel_id', selectedChannel)
        .order('start_date', { ascending: true })

      if (error) throw error

      const availability: DateAvailability[] = []
      
      if (data && data.length > 0) {
        data.forEach(rule => {
          const startDate = new Date(rule.start_date)
          const endDate = new Date(rule.end_date)
          
          for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const dateStr = date.toISOString().split('T')[0]
            availability.push({
              date: dateStr,
              isAvailable: rule.is_sale_available
            })
          }
        })
      }

      setAvailabilityData(availability)
    } catch (error) {
      console.error('판매 가능 여부 데이터 로드 오류:', error)
    }
  }

  // 판매 가능 여부 저장
  const saveAvailability = async () => {
    if (!selectedChannel) return

    setSaving(true)
    setSaveMessage('')

    try {
      // 기존 데이터 삭제
      await supabase
        .from('dynamic_pricing')
        .delete()
        .eq('product_id', productId)
        .eq('channel_id', selectedChannel)

      // 새로운 데이터 저장
      const availabilityRules = availabilityData.map(item => ({
        product_id: productId,
        channel_id: selectedChannel,
        rule_name: `${channelName} 판매 가능 여부 - ${item.date}`,
        start_date: item.date,
        end_date: item.date,
        selected_weekdays: [new Date(item.date).getDay()],
        adult_price: 0,
        child_price: 0,
        infant_price: 0,
        commission_percent: 0,
        markup_amount: 0,
        coupon_percentage_discount: 0,
        is_sale_available: item.isAvailable,
        not_included_price: 0,
        options_pricing: null,
        choices_pricing: null,
        created_at: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('dynamic_pricing')
        .insert(availabilityRules)

      if (error) throw error

      setSaveMessage('판매 가능 여부가 성공적으로 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('판매 가능 여부 저장 오류:', error)
      setSaveMessage('저장 중 오류가 발생했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen && selectedChannel) {
      loadAvailabilityData()
    }
  }, [isOpen, selectedChannel, productId])

  if (!isOpen) return null

  const days = getDaysInMonth(currentMonth)
  const monthNames = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ]
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* 모달 */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">날짜별 판매 가능 여부</h2>
                <p className="text-sm text-gray-600">{channelName} 채널</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* 캘린더 */}
          <div className="p-6">
            {/* 월 네비게이션 */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => changeMonth('prev')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              
              <h3 className="text-lg font-semibold text-gray-900">
                {currentMonth.getFullYear()}년 {monthNames[currentMonth.getMonth()]}
              </h3>
              
              <button
                onClick={() => changeMonth('next')}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (!day) {
                  return <div key={index} className="h-12" />
                }

                const isAvailable = isDateAvailable(day.date)
                const isToday = day.date === new Date().toISOString().split('T')[0]
                const isPast = new Date(day.date) < new Date(new Date().setHours(0, 0, 0, 0))

                return (
                  <button
                    key={day.date}
                    onClick={() => !isPast && toggleAvailability(day.date)}
                    disabled={isPast}
                    className={`h-12 rounded-lg border-2 transition-all ${
                      isPast
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isAvailable
                          ? 'bg-green-50 border-green-200 text-green-800 hover:bg-green-100'
                          : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                    } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className="text-sm font-medium">{day.day}</span>
                      <div className="text-xs">
                        {isAvailable ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 범례 */}
            <div className="flex items-center justify-center space-x-6 mt-6 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-gray-700">판매 가능</span>
              </div>
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-gray-700">판매 마감</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-100 rounded"></div>
                <span className="text-gray-700">지난 날짜</span>
              </div>
            </div>
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              날짜를 클릭하여 판매 가능 여부를 변경할 수 있습니다
            </div>
            <div className="flex items-center space-x-3">
              {saveMessage && (
                <span className={`text-sm ${
                  saveMessage.includes('성공') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {saveMessage}
                </span>
              )}
              <button
                onClick={saveAvailability}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? '저장 중...' : '저장'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
