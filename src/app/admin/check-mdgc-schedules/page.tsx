'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MDGCScheduleChecker() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkCurrentSchedules = async () => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      console.log('MDGCSUNRISE 상품 일정 현황 확인 중...')
      
      // 1. MDGCSUNRISE 상품 존재 확인
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', 'MDGCSUNRISE')
        .single()
      
      if (productError && productError.code !== 'PGRST116') {
        throw new Error(`상품 확인 오류: ${productError.message}`)
      }
      
      if (!product) {
        setResult('❌ MDGCSUNRISE 상품이 존재하지 않습니다.')
        return
      }
      
      // 2. 현재 일정 데이터 확인
      const { data: schedules, error: scheduleError } = await supabase
        .from('product_schedules')
        .select('*')
        .eq('product_id', 'MDGCSUNRISE')
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true })
      
      if (scheduleError) {
        throw new Error(`일정 확인 오류: ${scheduleError.message}`)
      }
      
      console.log('현재 MDGCSUNRISE 일정 현황:', schedules)
      
      if (!schedules || schedules.length === 0) {
        setResult('❌ MDGCSUNRISE 상품에 일정이 없습니다.')
      } else {
        setResult(`✅ MDGCSUNRISE 상품에 ${schedules.length}개의 일정이 있습니다.`)
        
        // 일정 목록 표시
        const scheduleList = schedules.map(schedule => 
          `${schedule.order_index}. ${schedule.title_ko || schedule.title_en || '제목 없음'} (${schedule.start_time} - ${schedule.end_time})`
        ).join('\n')
        
        console.log('일정 목록:')
        console.log(scheduleList)
      }
      
    } catch (error) {
      console.error('일정 확인 오류:', error)
      setError(`❌ 확인 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        MDGCSUNRISE 상품 일정 현황 확인
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            현재 상황 확인
          </h2>
          <p className="text-gray-600">
            MDGCSUNRISE 상품의 현재 일정 데이터를 확인합니다.
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={checkCurrentSchedules}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-medium ${
              loading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? '확인 중...' : '일정 현황 확인'}
          </button>
          
          {result && (
            <div className="text-green-600 font-medium">
              {result}
            </div>
          )}
          
          {error && (
            <div className="text-red-600 font-medium">
              {error}
            </div>
          )}
        </div>
        
        {loading && (
          <div className="mt-4">
            <div className="animate-pulse bg-gray-200 h-2 rounded"></div>
            <p className="text-sm text-gray-500 mt-2">일정 현황 확인 중...</p>
          </div>
        )}
      </div>
    </div>
  )
}
