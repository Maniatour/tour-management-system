'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function MDGCSunriseRestorePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const restoreSchedules = async () => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      console.log('MDGCSUNRISE 상품 일정 데이터 복구 시작...')
      
      // 1. MDGCSUNRISE 상품이 존재하는지 확인
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', 'MDGCSUNRISE')
        .single()
      
      if (productError && productError.code !== 'PGRST116') {
        throw new Error(`상품 확인 오류: ${productError.message}`)
      }
      
      // 2. 상품이 없으면 생성
      if (!product) {
        console.log('MDGCSUNRISE 상품이 없습니다. 생성 중...')
        const { error: insertError } = await supabase
          .from('products')
          .insert({
            id: 'MDGCSUNRISE',
            name: '도깨비 투어',
            name_ko: '도깨비 투어',
            name_en: 'Goblin Tour',
            category: '투어',
            description: 'Lower Antelope Canyon과 Antelope X Canyon을 포함한 도깨비 투어',
            base_price: 0.00,
            status: 'active'
          })
        
        if (insertError) {
          throw new Error(`상품 생성 오류: ${insertError.message}`)
        }
        console.log('MDGCSUNRISE 상품이 생성되었습니다.')
      } else {
        console.log('MDGCSUNRISE 상품이 이미 존재합니다.')
      }
      
      // 3. 기존 일정 데이터 삭제
      console.log('기존 일정 데이터 삭제 중...')
      const { error: deleteError } = await supabase
        .from('product_schedules')
        .delete()
        .eq('product_id', 'MDGCSUNRISE')
      
      if (deleteError) {
        throw new Error(`기존 일정 삭제 오류: ${deleteError.message}`)
      }
      
      // 4. 새로운 일정 데이터 삽입
      console.log('새로운 일정 데이터 삽입 중...')
      const schedules = [
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '05:00:00',
          end_time: '06:00:00',
          duration_minutes: 60,
          is_break: false,
          is_meal: false,
          is_transport: true,
          is_tour: false,
          show_to_customers: true,
          title_ko: '라스베가스 출발',
          title_en: 'Departure from Las Vegas',
          description_ko: '라스베가스에서 투어 시작',
          description_en: 'Tour starts from Las Vegas',
          location_ko: '라스베가스',
          location_en: 'Las Vegas',
          guide_notes_ko: '새벽 출발로 고객들에게 미리 안내',
          guide_notes_en: 'Early departure - inform customers in advance',
          order_index: 1,
          two_guide_schedule: 'guide',
          guide_driver_schedule: 'guide'
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '06:00:00',
          end_time: '10:00:00',
          duration_minutes: 240,
          is_break: false,
          is_meal: false,
          is_transport: true,
          is_tour: false,
          show_to_customers: true,
          title_ko: '페이지 이동',
          title_en: 'Travel to Page',
          description_ko: '라스베가스에서 페이지까지 이동',
          description_en: 'Travel from Las Vegas to Page',
          location_ko: '페이지',
          location_en: 'Page',
          guide_notes_ko: '운전 중 휴식 시간 고려',
          guide_notes_en: 'Consider rest time during driving',
          order_index: 2,
          two_guide_schedule: 'guide',
          guide_driver_schedule: 'assistant'
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '10:00:00',
          end_time: '10:30:00',
          duration_minutes: 30,
          is_break: true,
          is_meal: false,
          is_transport: false,
          is_tour: false,
          show_to_customers: true,
          title_ko: '휴식 시간',
          title_en: 'Rest Time',
          description_ko: '페이지 도착 후 휴식',
          description_en: 'Rest after arriving in Page',
          location_ko: '페이지',
          location_en: 'Page',
          guide_notes_ko: '화장실 이용 및 준비 시간',
          guide_notes_en: 'Restroom break and preparation time',
          order_index: 3,
          two_guide_schedule: null,
          guide_driver_schedule: null
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '10:30:00',
          end_time: '12:30:00',
          duration_minutes: 120,
          is_break: false,
          is_meal: false,
          is_transport: false,
          is_tour: true,
          show_to_customers: true,
          title_ko: 'Lower Antelope Canyon 투어',
          title_en: 'Lower Antelope Canyon Tour',
          description_ko: '로어 앤텔로프 캐년 투어',
          description_en: 'Lower Antelope Canyon tour',
          location_ko: '로어 앤텔로프 캐년',
          location_en: 'Lower Antelope Canyon',
          guide_notes_ko: '사진 촬영 포인트 안내',
          guide_notes_en: 'Guide photo shooting points',
          order_index: 4,
          two_guide_schedule: 'guide',
          guide_driver_schedule: 'guide'
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '12:30:00',
          end_time: '13:30:00',
          duration_minutes: 60,
          is_break: false,
          is_meal: true,
          is_transport: false,
          is_tour: false,
          show_to_customers: true,
          title_ko: '점심 식사',
          title_en: 'Lunch',
          description_ko: '페이지에서 점심 식사',
          description_en: 'Lunch in Page',
          location_ko: '페이지',
          location_en: 'Page',
          guide_notes_ko: '로컬 레스토랑 추천',
          guide_notes_en: 'Recommend local restaurants',
          order_index: 5,
          two_guide_schedule: null,
          guide_driver_schedule: null
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '13:30:00',
          end_time: '15:30:00',
          duration_minutes: 120,
          is_break: false,
          is_meal: false,
          is_transport: false,
          is_tour: true,
          show_to_customers: true,
          title_ko: 'Antelope X Canyon 투어',
          title_en: 'Antelope X Canyon Tour',
          description_ko: '앤텔로프 X 캐년 투어',
          description_en: 'Antelope X Canyon tour',
          location_ko: '앤텔로프 X 캐년',
          location_en: 'Antelope X Canyon',
          guide_notes_ko: '사진 촬영 포인트 안내',
          guide_notes_en: 'Guide photo shooting points',
          order_index: 6,
          two_guide_schedule: 'guide',
          guide_driver_schedule: 'guide'
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '15:30:00',
          end_time: '19:30:00',
          duration_minutes: 240,
          is_break: false,
          is_meal: false,
          is_transport: true,
          is_tour: false,
          show_to_customers: true,
          title_ko: '라스베가스 복귀',
          title_en: 'Return to Las Vegas',
          description_ko: '페이지에서 라스베가스로 복귀',
          description_en: 'Return from Page to Las Vegas',
          location_ko: '라스베가스',
          location_en: 'Las Vegas',
          guide_notes_ko: '운전 중 휴식 시간 고려',
          guide_notes_en: 'Consider rest time during driving',
          order_index: 7,
          two_guide_schedule: 'guide',
          guide_driver_schedule: 'assistant'
        },
        {
          product_id: 'MDGCSUNRISE',
          day_number: 1,
          start_time: '19:30:00',
          end_time: '20:00:00',
          duration_minutes: 30,
          is_break: true,
          is_meal: false,
          is_transport: false,
          is_tour: false,
          show_to_customers: true,
          title_ko: '투어 종료',
          title_en: 'Tour End',
          description_ko: '라스베가스 도착 후 투어 종료',
          description_en: 'Tour ends after arriving in Las Vegas',
          location_ko: '라스베가스',
          location_en: 'Las Vegas',
          guide_notes_ko: '고객들에게 다음 일정 안내',
          guide_notes_en: 'Inform customers about next schedule',
          order_index: 8,
          two_guide_schedule: null,
          guide_driver_schedule: null
        }
      ]
      
      const { error: insertError } = await supabase
        .from('product_schedules')
        .insert(schedules)
      
      if (insertError) {
        throw new Error(`일정 삽입 오류: ${insertError.message}`)
      }
      
      console.log('MDGCSUNRISE 상품 일정 데이터 복구 완료!')
      console.log(`${schedules.length}개의 일정이 복구되었습니다.`)
      
      // 5. 복구 결과 확인
      const { data: restoredSchedules, error: checkError } = await supabase
        .from('product_schedules')
        .select('*')
        .eq('product_id', 'MDGCSUNRISE')
        .order('day_number', { ascending: true })
        .order('order_index', { ascending: true })
      
      if (checkError) {
        console.error('복구 결과 확인 오류:', checkError)
      } else {
        console.log('복구된 일정 목록:')
        restoredSchedules.forEach(schedule => {
          console.log(`${schedule.order_index}. ${schedule.title_ko} (${schedule.start_time} - ${schedule.end_time})`)
        })
      }
      
      setResult(`✅ 복구 성공: ${schedules.length}개 일정이 복구되었습니다.`)
      
    } catch (error) {
      console.error('MDGCSUNRISE 상품 일정 복구 오류:', error)
      setError(`❌ 복구 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        MDGCSUNRISE 상품 일정 데이터 복구
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            복구할 데이터
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>MDGCSUNRISE 상품 (도깨비 투어)</li>
            <li>1일차 투어 일정 8개</li>
            <li>라스베가스 출발 → 페이지 이동 → 캐년 투어 → 복귀</li>
            <li>가이드 할당 정보 포함</li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            주의사항
          </h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>기존 MDGCSUNRISE 상품의 일정 데이터가 모두 삭제됩니다</li>
            <li>새로운 스키마 구조에 맞게 데이터가 복구됩니다</li>
            <li>복구 후에는 관리자 페이지에서 일정을 확인할 수 있습니다</li>
          </ul>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={restoreSchedules}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-medium ${
              loading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? '복구 중...' : '일정 데이터 복구'}
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
            <p className="text-sm text-gray-500 mt-2">데이터 복구 중...</p>
          </div>
        )}
      </div>
    </div>
  )
}
