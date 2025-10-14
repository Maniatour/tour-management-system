'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, Clock, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface AttendanceRecord {
  id: string
  employee_email: string
  employee_name: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  work_hours: number
  status: string
  notes: string | null
  session_number: number
}

interface AttendanceEditModalProps {
  isOpen: boolean
  onClose: () => void
  record: AttendanceRecord | null
  onUpdate: () => void
}

export default function AttendanceEditModal({ 
  isOpen, 
  onClose, 
  record, 
  onUpdate 
}: AttendanceEditModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    check_in_date: '',
    check_in_time: '',
    check_out_date: '',
    check_out_time: '',
    notes: ''
  })

  // 라스베가스 현지 날짜/시간을 UTC로 변환하는 함수 (최종 해결책)
  const convertToUTC = (localDate: string, localTime: string) => {
    if (!localDate || !localTime) return null
    
    console.log('변환할 로컬 날짜/시간:', localDate, localTime)
    
    // 라스베가스 시간대를 명시적으로 처리
    // 1. 라스베가스 시간을 UTC로 직접 변환 (브라우저 시간대 무시)
    const [year, month, day] = localDate.split('-').map(Number)
    const [hours, minutes] = localTime.split(':').map(Number)
    
    // 2. 라스베가스 시간을 UTC로 변환 (PDT: UTC-7)
    // 라스베가스 시간에 7시간을 더하면 UTC가 됨
    const utcHours = hours + 7
    const utcMinutes = minutes
    
    // 3. UTC 시간으로 Date 객체 생성
    const utcDate = new Date(Date.UTC(year, month - 1, day, utcHours, utcMinutes))
    
    console.log('원본 라스베가스 시간:', `${localDate} ${localTime}`)
    console.log('변환된 UTC 시간:', utcDate.toISOString())
    
    return utcDate.toISOString()
  }

  // 모달이 열릴 때마다 현재 레코드 데이터로 폼 초기화
  useEffect(() => {
    if (record) {
      // UTC 시간을 라스베가스 현지시간으로 변환하여 날짜와 시간 분리
      const convertToLocalDateTime = (utcTimeString: string) => {
        console.log('UTC 시간 변환 시작:', utcTimeString)
        const utcDate = new Date(utcTimeString)
        console.log('UTC Date 객체:', utcDate)
        
        // 라스베가스 시간대로 변환
        const lasVegasTimeString = utcDate.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})
        console.log('라스베가스 시간 문자열:', lasVegasTimeString)
        
        const lasVegasTime = new Date(lasVegasTimeString)
        console.log('라스베가스 Date 객체:', lasVegasTime)
        
        // 날짜와 시간 분리
        const year = lasVegasTime.getFullYear()
        const month = String(lasVegasTime.getMonth() + 1).padStart(2, '0')
        const day = String(lasVegasTime.getDate()).padStart(2, '0')
        const hours = String(lasVegasTime.getHours()).padStart(2, '0')
        const minutes = String(lasVegasTime.getMinutes()).padStart(2, '0')
        
        return {
          date: `${year}-${month}-${day}`,
          time: `${hours}:${minutes}`
        }
      }
      
      const checkInData = record.check_in_time ? convertToLocalDateTime(record.check_in_time) : { date: '', time: '' }
      const checkOutData = record.check_out_time ? convertToLocalDateTime(record.check_out_time) : { date: '', time: '' }
      
      setFormData({
        check_in_date: checkInData.date,
        check_in_time: checkInData.time,
        check_out_date: checkOutData.date,
        check_out_time: checkOutData.time,
        notes: record.notes || ''
      })
    }
  }, [record])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!record) return

    setIsLoading(true)
    try {
      // work_hours 계산 (UTC 시간 기준)
      let workHours = 0
      if (formData.check_in_date && formData.check_in_time && formData.check_out_date && formData.check_out_time) {
        const checkInUTC = convertToUTC(formData.check_in_date, formData.check_in_time)
        const checkOutUTC = convertToUTC(formData.check_out_date, formData.check_out_time)
        
        if (checkInUTC && checkOutUTC) {
          const checkIn = new Date(checkInUTC)
          const checkOut = new Date(checkOutUTC)
          const diffMs = checkOut.getTime() - checkIn.getTime()
          workHours = diffMs / (1000 * 60 * 60) // 시간 단위로 변환
        }
      }

       // 데이터베이스 업데이트 (UTC 시간으로 저장)
       const checkInUTC = convertToUTC(formData.check_in_date, formData.check_in_time)
       const checkOutUTC = convertToUTC(formData.check_out_date, formData.check_out_time)
       
       console.log('데이터베이스 업데이트 시작:', {
         id: record.id,
         check_in_time: checkInUTC,
         check_out_time: checkOutUTC,
         work_hours: workHours,
         notes: formData.notes || null
       })

       const { data, error } = await supabase
         .from('attendance_records')
         .update({
           check_in_time: checkInUTC,
           check_out_time: checkOutUTC,
           work_hours: workHours,
           notes: formData.notes || null,
           updated_at: new Date().toISOString()
         })
         .eq('id', record.id)
         .select()

      console.log('데이터베이스 업데이트 결과:', { data, error })

      if (error) {
        console.error('출퇴근 기록 업데이트 오류:', error)
        alert('출퇴근 기록 업데이트에 실패했습니다.')
        return
      }

      if (!data || data.length === 0) {
        console.error('업데이트된 데이터가 없습니다:', data)
        alert('업데이트된 데이터를 찾을 수 없습니다.')
        return
      }

      console.log('성공적으로 업데이트된 데이터:', data[0])
      alert('출퇴근 기록이 성공적으로 업데이트되었습니다.')
      onUpdate() // 부모 컴포넌트의 데이터 새로고침
      onClose()
    } catch (error) {
      console.error('출퇴근 기록 업데이트 중 오류:', error)
      alert('출퇴근 기록 업데이트 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (!isOpen || !record) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-600" />
            출퇴근 시간 수정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 직원 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">직원 정보</div>
            <div className="text-lg font-medium text-gray-900">{record.employee_name}</div>
            <div className="text-sm text-gray-600">{record.employee_email}</div>
            <div className="text-sm text-gray-600 flex items-center mt-1">
              <Calendar className="w-4 h-4 mr-1" />
              {record.date} ({record.session_number}번째 세션)
            </div>
          </div>

          {/* 출근 날짜와 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                출근 날짜 (라스베가스)
              </label>
              <input
                type="date"
                value={formData.check_in_date}
                onChange={(e) => handleInputChange('check_in_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                출근 시간 (라스베가스)
              </label>
              <input
                type="time"
                value={formData.check_in_time}
                onChange={(e) => handleInputChange('check_in_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* 퇴근 날짜와 시간 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                퇴근 날짜 (라스베가스)
              </label>
              <input
                type="date"
                value={formData.check_out_date}
                onChange={(e) => handleInputChange('check_out_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                퇴근 시간 (라스베가스)
              </label>
              <input
                type="time"
                value={formData.check_out_time}
                onChange={(e) => handleInputChange('check_out_time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

           {/* 근무 시간 미리보기 */}
           {formData.check_in_date && formData.check_in_time && formData.check_out_date && formData.check_out_time && (
             <div className="bg-blue-50 p-3 rounded-lg">
               <div className="text-sm text-blue-800">
                 예상 근무 시간: {(() => {
                   const checkInUTC = convertToUTC(formData.check_in_date, formData.check_in_time)
                   const checkOutUTC = convertToUTC(formData.check_out_date, formData.check_out_time)
                   
                   if (checkInUTC && checkOutUTC) {
                     const checkIn = new Date(checkInUTC)
                     const checkOut = new Date(checkOutUTC)
                     const diffMs = checkOut.getTime() - checkIn.getTime()
                     const hours = Math.floor(diffMs / (1000 * 60 * 60))
                     const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                     return `${hours}시간 ${minutes}분`
                   }
                   return '계산 중...'
                 })()}
               </div>
               <div className="text-xs text-blue-600 mt-1">
                 출근: {formData.check_in_date} {formData.check_in_time} (라스베가스) → 퇴근: {formData.check_out_date} {formData.check_out_time} (라스베가스)
               </div>
               <div className="text-xs text-gray-500 mt-1">
                 💡 입력한 시간은 UTC로 변환되어 데이터베이스에 저장됩니다.
               </div>
             </div>
           )}

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="수정 사유나 특이사항을 입력하세요..."
            />
          </div>

          {/* 버튼 */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
