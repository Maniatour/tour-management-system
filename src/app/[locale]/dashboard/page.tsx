'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Calendar, User, Phone, Mail, Search, MapPin, Clock, Users, CreditCard, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

interface Reservation {
  id: string
  customer_id: string
  product_id: string
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number
  child: number
  infant: number
  total_people: number
  status: string
  created_at: string
  products?: {
    name: string
    description: string | null
  }
}

export default function CustomerDashboard() {
  const { user, userRole, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchForm, setSearchForm] = useState({
    phone: '',
    email: '',
    tourDate: '',
    productName: ''
  })
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // 인증 확인
  useEffect(() => {
    if (!user) {
      router.push(`/${locale}/auth`)
      return
    }

    // 시뮬레이션 중이 아닌 경우에만 고객 데이터 로드
    if (!isSimulating) {
      loadCustomerData()
    } else if (isSimulating && simulatedUser && simulatedUser.id) {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보로 설정
      setCustomer({
        id: simulatedUser.id,
        name: simulatedUser.name_ko,
        email: simulatedUser.email,
        phone: simulatedUser.phone,
        language: simulatedUser.language,
        created_at: simulatedUser.created_at
      })
      
      // 시뮬레이션된 사용자의 예약 정보도 로드
      loadSimulatedReservations(simulatedUser.id)
    } else if (isSimulating && !simulatedUser) {
      // 시뮬레이션 중이지만 simulatedUser가 없는 경우
      console.warn('시뮬레이션 중이지만 simulatedUser가 없습니다.')
      setLoading(false)
    }
  }, [user, userRole, router, locale, isSimulating, simulatedUser])

  // 고객 정보 로드
  const loadCustomerData = async () => {
    if (!authUser?.email) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // 이메일로 고객 정보 조회
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', authUser.email)
        .single()

      if (customerError) {
        console.error('고객 정보 조회 오류:', customerError)
        // 406 오류나 다른 권한 오류의 경우 빈 상태로 설정
        if (customerError.code === 'PGRST116' || customerError.code === 'PGRST301' || customerError.status === 406) {
          setCustomer(null)
          setReservations([])
          setLoading(false)
          return
        }
        setLoading(false)
        return
      }

      if (customerData) {
        setCustomer(customerData)
        
        // 고객의 예약 정보 조회
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select(`
            *,
            products (
              name,
              description
            )
          `)
          .eq('customer_id', customerData.id)
          .order('tour_date', { ascending: false })

        if (reservationsError) {
          console.error('예약 정보 조회 오류:', reservationsError)
          setReservations([])
        } else {
          setReservations(reservationsData || [])
        }
      } else {
        setCustomer(null)
        setReservations([])
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error)
      setCustomer(null)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  // 시뮬레이션된 사용자의 예약 정보 로드
  const loadSimulatedReservations = async (customerId: string) => {
    if (!customerId) {
      console.error('고객 ID가 없습니다.')
      setReservations([])
      setLoading(false)
      return
    }

    try {
      // 먼저 예약 정보만 조회
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('*')
        .eq('customer_id', customerId)
        .order('tour_date', { ascending: false })

      if (reservationsError) {
        console.error('시뮬레이션 예약 정보 조회 오류:', reservationsError)
        setReservations([])
        setLoading(false)
        return
      }

      if (reservationsData && reservationsData.length > 0) {
        // 각 예약에 대해 상품 정보를 별도로 조회
        const reservationsWithProducts = await Promise.all(
          reservationsData.map(async (reservation) => {
            try {
              const { data: productData } = await supabase
                .from('products')
                .select('name, description')
                .eq('id', reservation.product_id)
                .single()

              return {
                ...reservation,
                products: productData || { name: '상품명 없음', description: null }
              }
            } catch (error) {
              console.error('상품 정보 조회 오류:', error)
              return {
                ...reservation,
                products: { name: '상품명 없음', description: null }
              }
            }
          })
        )
        setReservations(reservationsWithProducts)
      } else {
        setReservations([])
      }
    } catch (error) {
      console.error('시뮬레이션 예약 정보 로드 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    try {
      stopSimulation()
      // 약간의 지연을 두고 페이지 이동
      setTimeout(() => {
        router.push(`/${locale}/admin`)
      }, 100)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      // 오류가 발생해도 관리자 페이지로 이동
      router.push(`/${locale}/admin`)
    }
  }

  // 고객 ID 검색 및 자동 매칭
  const handleSearch = async () => {
    if (!searchForm.phone && !searchForm.email && !searchForm.tourDate && !searchForm.productName) {
      alert('검색 조건을 하나 이상 입력해주세요.')
      return
    }

    try {
      setIsSearching(true)
      let query = supabase.from('customers').select('*')

      if (searchForm.phone) {
        query = query.ilike('phone', `%${searchForm.phone}%`)
      }
      if (searchForm.email) {
        query = query.ilike('email', `%${searchForm.email}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('검색 오류:', error)
        alert('검색 중 오류가 발생했습니다.')
        return
      }

      // 투어 날짜나 상품명으로 추가 필터링
      let filteredResults = data || []
      
      if (searchForm.tourDate || searchForm.productName) {
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select(`
            customer_id,
            tour_date,
            products (
              name
            )
          `)

        if (reservationsData) {
          const matchingCustomerIds = reservationsData
            .filter(reservation => {
              const matchesDate = !searchForm.tourDate || 
                reservation.tour_date === searchForm.tourDate
              const matchesProduct = !searchForm.productName || 
                reservation.products?.name?.toLowerCase().includes(searchForm.productName.toLowerCase())
              
              return matchesDate && matchesProduct
            })
            .map(reservation => reservation.customer_id)

          filteredResults = filteredResults.filter(customer => 
            matchingCustomerIds.includes(customer.id)
          )
        }
      }

      setSearchResults(filteredResults)

      // 자동 매칭 시도
      if (filteredResults.length === 1 && authUser?.email) {
        const exactMatch = filteredResults[0]
        
        // 전화번호나 이메일이 정확히 일치하는 경우 자동 매칭
        const phoneMatch = searchForm.phone && exactMatch.phone && 
          exactMatch.phone.replace(/[-\s]/g, '') === searchForm.phone.replace(/[-\s]/g, '')
        const emailMatch = searchForm.email && exactMatch.email && 
          exactMatch.email.toLowerCase() === searchForm.email.toLowerCase()

        if (phoneMatch || emailMatch) {
          const shouldAutoMatch = confirm(
            `고객 "${exactMatch.name}" (${exactMatch.email})을 자동으로 매칭하시겠습니까?`
          )
          
          if (shouldAutoMatch) {
            await handleMatchCustomer(exactMatch.id)
            return
          }
        }
      }
    } catch (error) {
      console.error('검색 오류:', error)
      alert('검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  // 고객 ID 매칭
  const handleMatchCustomer = async (customerId: string) => {
    if (!authUser?.email) return

    try {
      const { error } = await supabase
        .from('customers')
        .update({ email: authUser.email })
        .eq('id', customerId)

      if (error) {
        console.error('고객 ID 매칭 오류:', error)
        alert('고객 ID 매칭 중 오류가 발생했습니다.')
        return
      }

      alert('고객 ID가 성공적으로 매칭되었습니다.')
      loadCustomerData()
      setSearchResults([])
      setSearchForm({ phone: '', email: '', tourDate: '', productName: '' })
    } catch (error) {
      console.error('고객 ID 매칭 오류:', error)
      alert('고객 ID 매칭 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
        return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
            </div>
          </div>
        )
  }

        return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">고객 대시보드</h1>
              <p className="text-gray-600">투어 예약 정보를 확인하고 관리하세요.</p>
            </div>
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  시뮬레이션 중: {simulatedUser.name_ko}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                  >
                    내 정보
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/reservations`)}
                    className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                  >
                    내 예약
                  </button>
                  <button
                    onClick={handleStopSimulation}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    관리자로 돌아가기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 고객 정보가 없는 경우 - 검색 섹션 */}
        {!customer && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Search className="w-5 h-5 mr-2" />
              고객 ID 검색 및 매칭
            </h2>
            <p className="text-gray-600 mb-6">
              전화번호, 이메일, 투어 날짜, 상품명을 입력하여 고객 ID를 찾고 매칭하세요.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  전화번호
                </label>
                <input
                  type="text"
                  value={searchForm.phone}
                  onChange={(e) => setSearchForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  value={searchForm.email}
                  onChange={(e) => setSearchForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  투어 날짜
                </label>
                <input
                  type="date"
                  value={searchForm.tourDate}
                  onChange={(e) => setSearchForm(prev => ({ ...prev, tourDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품명
                </label>
                <input
                  type="text"
                  value={searchForm.productName}
                  onChange={(e) => setSearchForm(prev => ({ ...prev, productName: e.target.value }))}
                  placeholder="투어 상품명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  검색
                </>
              )}
            </button>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">검색 결과</h3>
                <div className="space-y-3">
                  {searchResults.map((result) => (
                    <div key={result.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{result.name}</h4>
                          <p className="text-sm text-gray-600">{result.email}</p>
                          {result.phone && (
                            <p className="text-sm text-gray-600">{result.phone}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleMatchCustomer(result.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                        >
                          매칭
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 고객 정보가 있는 경우 */}
        {customer && (
          <>
            {/* 고객 정보 카드 */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                내 정보
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">이름:</span>
                  <span className="ml-2 font-medium">{customer.name}</span>
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">이메일:</span>
                  <span className="ml-2 font-medium">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">전화번호:</span>
                    <span className="ml-2 font-medium">{customer.phone}</span>
                  </div>
                )}
                {customer.language && (
                  <div className="flex items-center">
                    <span className="text-gray-600">언어:</span>
                    <span className="ml-2 font-medium">{customer.language}</span>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <a
                  href="/dashboard/profile"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  정보 수정하기 →
                </a>
              </div>
            </div>

            {/* 예약 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                내 예약
              </h2>
              
              {reservations.length > 0 ? (
                <div className="space-y-4">
                  {reservations.map((reservation) => (
                    <div key={reservation.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {reservation.products?.name || '상품명 없음'}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2" />
                              <span>투어 날짜: {new Date(reservation.tour_date).toLocaleDateString()}</span>
                            </div>
                            {reservation.tour_time && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                <span>투어 시간: {reservation.tour_time}</span>
                              </div>
                            )}
                            {reservation.pickup_hotel && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2" />
                                <span>픽업 호텔: {reservation.pickup_hotel}</span>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-2" />
                              <span>인원: 성인 {reservation.adults}명, 어린이 {reservation.child}명, 유아 {reservation.infant}명</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            reservation.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {reservation.status === 'confirmed' ? '확정' :
                             reservation.status === 'pending' ? '대기중' :
                             reservation.status === 'completed' ? '완료' : '취소'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">예약 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}