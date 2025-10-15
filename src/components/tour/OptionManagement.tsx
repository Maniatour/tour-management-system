import React, { useState, useEffect } from 'react'
import { Settings, Package, DollarSign, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ReservationOption {
  id: string
  reservation_id: string
  option_id: string
  ea: number
  price: number
  total_price: number
  status: string
  created_at: string
  quantity: number // ea를 quantity로 매핑
  customer_name?: string // 고객 이름 추가
  option?: {
    id: string
    name: string
    category: string
    adult_price: number
    child_price: number
    infant_price: number
    price_type: string
  }
}

interface OptionManagementProps {
  reservationIds: string[]
}

export const OptionManagement: React.FC<OptionManagementProps> = ({ reservationIds }) => {
  const [reservationOptions, setReservationOptions] = useState<ReservationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (reservationIds.length > 0) {
      fetchReservationOptions()
    } else {
      setReservationOptions([])
    }
  }, [reservationIds])

  const fetchReservationOptions = async () => {
    if (reservationIds.length === 0) return

    setLoading(true)
    setError(null)
    
    try {
      // 1. reservation_options 테이블에서 데이터 조회
      const { data: reservationOptionsData, error: reservationOptionsError } = await supabase
        .from('reservation_options')
        .select(`
          id,
          reservation_id,
          option_id,
          ea,
          price,
          total_price,
          status,
          created_at
        `)
        .in('reservation_id', reservationIds)
        .order('created_at', { ascending: false })

      if (reservationOptionsError) {
        console.error('예약 옵션 조회 오류:', reservationOptionsError)
        setError('옵션을 불러오는 중 오류가 발생했습니다.')
        return
      }

      if (!reservationOptionsData || reservationOptionsData.length === 0) {
        setReservationOptions([])
        return
      }

      // 2. 고유한 option_id 목록 추출
      const uniqueOptionIds = [...new Set(reservationOptionsData.map(item => item.option_id))]
      
      // 3. 고유한 reservation_id 목록 추출
      const uniqueReservationIds = [...new Set(reservationOptionsData.map(item => item.reservation_id))]
      
      // 4. options 테이블에서 옵션 정보 조회
      const { data: optionsData, error: optionsError } = await supabase
        .from('options')
        .select(`
          id,
          name,
          category,
          adult_price,
          child_price,
          infant_price,
          price_type
        `)
        .in('id', uniqueOptionIds)

      if (optionsError) {
        console.error('옵션 정보 조회 오류:', optionsError)
        setError('옵션 정보를 불러오는 중 오류가 발생했습니다.')
        return
      }

      // 5. reservations 테이블에서 customer_id 조회
      let reservationsData = []
      if (uniqueReservationIds.length > 0) {
        try {
          const { data: reservationsResult, error: reservationsError } = await supabase
            .from('reservations')
            .select('id, customer_id')
            .in('id', uniqueReservationIds)

          if (reservationsError) {
            console.error('예약 정보 조회 오류:', reservationsError)
            console.log('예약 오류 상세:', {
              message: reservationsError.message,
              details: reservationsError.details,
              hint: reservationsError.hint,
              code: reservationsError.code
            })
            console.log('예약 정보 없이 계속 진행합니다.')
          } else {
            reservationsData = reservationsResult || []
            console.log('예약 정보 조회 성공:', reservationsData.length, '건')
          }
        } catch (reservationFetchError) {
          console.error('예약 정보 조회 중 예외 발생:', reservationFetchError)
          console.log('예약 정보 없이 계속 진행합니다.')
        }
      }

      // 6. 고유한 customer_id 목록 추출
      const uniqueCustomerIds = [...new Set(reservationsData.map(reservation => reservation.customer_id).filter(Boolean))]
      
      // 7. customers 테이블에서 고객 이름 조회
      let customersData = []
      if (uniqueCustomerIds.length > 0) {
        try {
          const { data: customersResult, error: customersError } = await supabase
            .from('customers')
            .select('id, name')
            .in('id', uniqueCustomerIds)

          if (customersError) {
            console.error('고객 정보 조회 오류:', customersError)
            console.log('고객 오류 상세:', {
              message: customersError.message,
              details: customersError.details,
              hint: customersError.hint,
              code: customersError.code
            })
            console.log('고객 정보 없이 계속 진행합니다.')
          } else {
            customersData = customersResult || []
            console.log('고객 정보 조회 성공:', customersData.length, '명')
          }
        } catch (customerFetchError) {
          console.error('고객 정보 조회 중 예외 발생:', customerFetchError)
          console.log('고객 정보 없이 계속 진행합니다.')
        }
      }

      // 8. 데이터 결합 (실제 고객 이름 표시)
      const combinedData = reservationOptionsData.map(reservationOption => {
        const optionInfo = optionsData?.find(option => option.id === reservationOption.option_id)
        const reservationInfo = reservationsData?.find(reservation => reservation.id === reservationOption.reservation_id)
        const customerInfo = customersData?.find(customer => customer.id === reservationInfo?.customer_id)
        
        // 실제 고객 이름이 있으면 사용, 없으면 예약 ID 사용
        const displayName = customerInfo?.name || `예약 ${reservationOption.reservation_id.slice(-6)}`
        
        return {
          ...reservationOption,
          quantity: reservationOption.ea,
          customer_name: displayName,
          option: optionInfo
        }
      })

      setReservationOptions(combinedData)
    } catch (error) {
      console.error('옵션 조회 오류:', error)
      setError('옵션을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getTotalPrice = () => {
    return reservationOptions.reduce((sum, option) => sum + (option.total_price || 0), 0)
  }

  const getTotalQuantity = () => {
    return reservationOptions.reduce((sum, option) => sum + (option.quantity || 0), 0)
  }

  const getOptionSummary = () => {
    const optionMap = new Map()
    const categoryMap = new Map()
    
    reservationOptions.forEach(option => {
      const optionId = option.option_id
      const optionName = option.option?.name || '알 수 없는 옵션'
      const category = option.option?.category || '카테고리 없음'
      
      // 개별 옵션별 집계
      if (optionMap.has(optionId)) {
        const existing = optionMap.get(optionId)
        existing.totalQuantity += option.quantity || 0
        existing.totalPrice += option.total_price || 0
      } else {
        optionMap.set(optionId, {
          optionId,
          optionName,
          category,
          totalQuantity: option.quantity || 0,
          totalPrice: option.total_price || 0
        })
      }
      
      // 카테고리별 집계
      if (categoryMap.has(category)) {
        const existing = categoryMap.get(category)
        existing.totalQuantity += option.quantity || 0
        existing.totalPrice += option.total_price || 0
      } else {
        categoryMap.set(category, {
          category,
          totalQuantity: option.quantity || 0,
          totalPrice: option.total_price || 0
        })
      }
    })
    
    const options = Array.from(optionMap.values()).sort((a, b) => a.optionName.localeCompare(b.optionName))
    const categories = Array.from(categoryMap.values()).sort((a, b) => a.category.localeCompare(b.category))
    
    return { options, categories }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4">
        <h2 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          옵션 관리
          {reservationOptions.length > 0 && (
            <span className="ml-2 text-sm text-gray-500">
              ({reservationOptions.length}개 옵션)
            </span>
          )}
        </h2>

        {loading && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">옵션을 불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-6 text-red-600">
            <p className="text-sm">{error}</p>
            <button
              onClick={fetchReservationOptions}
              className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && reservationOptions.length === 0 && (
        <div className="text-center py-6 text-gray-500">
            <Package className="h-8 w-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">등록된 옵션이 없습니다.</p>
          <p className="text-xs">배정된 고객이 옵션을 추가하면 여기에 표시됩니다.</p>
        </div>
        )}

         {!loading && !error && reservationOptions.length > 0 && (
           <div className="space-y-4">
             {/* 옵션별 그룹화 소계 - 카테고리별 그룹화 */}
             <div className="bg-blue-50 rounded-lg p-3">
               <div className="space-y-2">
                 {getOptionSummary().categories.map((categorySummary) => {
                   const categoryOptions = getOptionSummary().options.filter(option => option.category === categorySummary.category)
                   return (
                     <div key={categorySummary.category}>
                       {/* 개별 옵션들 */}
                       <div className="space-y-1">
                         {categoryOptions.map((option) => (
                           <div key={option.optionId} className="flex items-center justify-between text-sm">
                             <div className="flex items-center space-x-2">
                               <span className="font-medium text-gray-900">{option.optionName}</span>
                               <span className="text-xs text-gray-500">({option.category})</span>
                             </div>
                             <span className="text-gray-600">총 {option.totalQuantity}개</span>
                           </div>
                         ))}
                       </div>
                       {/* 카테고리 구분선 */}
                       <div className="border-t border-gray-300 my-2"></div>
                       {/* 카테고리 소계 */}
                       <div className="flex items-center justify-between text-sm font-medium">
                         <span className="text-gray-900">{categorySummary.category}</span>
                         <span className="text-gray-600">총 {categorySummary.totalQuantity}개</span>
                       </div>
                     </div>
                   )
                 })}
               </div>
             </div>

             {/* 전체 요약 정보 */}
             <div className="bg-gray-50 rounded-lg p-3">
               <div className="flex items-center justify-between text-sm">
                 <div className="flex items-center text-gray-600">
                   <Package className="h-4 w-4 mr-1" />
                   <span>총 옵션 수: {reservationOptions.length}개</span>
                 </div>
                 <div className="flex items-center space-x-4">
                   <div className="flex items-center text-gray-600">
                     <Users className="h-4 w-4 mr-1" />
                     <span>총 수량: {getTotalQuantity()}개</span>
                   </div>
                   <div className="flex items-center text-green-600 font-medium">
                     <DollarSign className="h-4 w-4 mr-1" />
                     <span>총 금액: {formatPrice(getTotalPrice())}</span>
                   </div>
                 </div>
               </div>
             </div>

            {/* 옵션 목록 */}
            <div className="space-y-2">
              {reservationOptions.map((reservationOption) => (
                <div key={reservationOption.id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">
                          {reservationOption.option?.name || '알 수 없는 옵션'}
                        </h3>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          {reservationOption.option?.category || '카테고리 없음'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        name: {reservationOption.customer_name || '알 수 없는 고객'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        수량: {reservationOption.quantity}개
                      </div>
                      <div className="text-sm text-green-600 font-medium">
                        {formatPrice(reservationOption.total_price || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
