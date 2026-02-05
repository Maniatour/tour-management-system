'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { User, Mail, Phone, Search, Play, StopCircle, ArrowLeft, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  created_at: string
}

export default function CustomerSimulatorPage() {
  const { user, userRole, simulatedUser, startSimulation, stopSimulation, isSimulating } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // 관리자 권한 확인
  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }
    
    if (userRole !== 'admin' && userRole !== 'manager') {
      router.push('/admin')
      return
    }

    loadCustomers()
  }, [user, userRole, router])

  // 고객 목록 로드
  const loadCustomers = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('고객 목록 조회 오류:', error)
        // 406 오류의 경우 빈 배열로 설정
        if (error.code === 'PGRST116') {
          setCustomers([])
          setLoading(false)
          return
        }
        setCustomers([])
        return
      }

      setCustomers(data || [])
    } catch (error) {
      console.error('데이터 로드 오류:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  // 고객 시뮬레이션 시작
  const handleStartSimulation = (customer: Customer) => {
    const simulatedUserData = {
      id: customer.id,
      email: customer.email,
      name_ko: customer.name,
      phone: customer.phone,
      language: customer.language,
      created_at: customer.created_at,
      position: 'customer',
      role: 'customer' as const
    }
    
    startSimulation(simulatedUserData)
    console.log('고객 시뮬레이션 시작:', simulatedUserData)
  }

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    stopSimulation()
    console.log('시뮬레이션 중지')
  }

  // 검색 필터링
  const filteredCustomers = customers.filter(customer =>
    (customer.name && customer.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone && customer.phone.includes(searchTerm))
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 shrink-0 text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                뒤로
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl font-bold text-gray-900">고객 시뮬레이션</h1>
                <p className="text-xs sm:text-base text-gray-600">고객의 관점에서 시스템을 테스트하세요.</p>
              </div>
            </div>
            
            {/* 시뮬레이션 상태 표시 */}
            {isSimulating && simulatedUser && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium truncate max-w-[180px] sm:max-w-none">
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                  시뮬레이션 중: {simulatedUser.name_ko}
                </div>
                <button
                  onClick={handleStopSimulation}
                  className="bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-red-700 flex items-center text-xs sm:text-sm"
                >
                  <StopCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  시뮬레이션 중지
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 검색 */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6 mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="고객 이름, 이메일, 전화번호로 검색..."
              className="w-full pl-9 sm:pl-10 pr-2.5 sm:pr-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 고객 목록 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-3 sm:p-6 border-b border-gray-200">
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 flex items-center">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
              고객 목록 ({filteredCustomers.length}명)
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-3 sm:p-6 hover:bg-gray-50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-white text-xs sm:text-sm font-medium">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-lg font-medium text-gray-900 truncate">{customer.name}</h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center min-w-0">
                            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 shrink-0" />
                            <span className="truncate">{customer.email}</span>
                          </div>
                          {customer.phone && (
                            <div className="flex items-center">
                              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 shrink-0" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.language && (
                            <div className="flex items-center">
                              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 shrink-0" />
                              {customer.language}
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                          가입일: {new Date(customer.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {isSimulating && simulatedUser?.email === customer.email && (
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium">
                          시뮬레이션 중
                        </span>
                      )}
                      <button
                        onClick={() => handleStartSimulation(customer)}
                        disabled={isSimulating && simulatedUser?.email === customer.email}
                        className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-xs sm:text-sm"
                      >
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                        시뮬레이션 시작
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 sm:p-12 text-center">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-300" />
                <h3 className="text-sm sm:text-lg font-medium text-gray-900 mb-1 sm:mb-2">고객이 없습니다</h3>
                <p className="text-xs sm:text-base text-gray-500">
                  {searchTerm ? '검색 조건에 맞는 고객이 없습니다.' : '등록된 고객이 없습니다.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 시뮬레이션 안내 */}
        {isSimulating && simulatedUser && (
          <div className="mt-4 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex-shrink-0">
                <Play className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-medium text-blue-800">
                  고객 시뮬레이션 활성화
                </h3>
                <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-sm text-blue-700">
                  <p>현재 <strong>{simulatedUser.name_ko}</strong> 고객의 관점에서 시스템을 사용하고 있습니다.</p>
                  <p className="mt-0.5 sm:mt-1">고객 대시보드, 내 정보, 내 예약 페이지에 접근할 수 있습니다.</p>
                </div>
                <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard`)}
                    className="bg-blue-600 text-white px-2.5 py-1 sm:px-3 rounded text-xs sm:text-sm hover:bg-blue-700"
                  >
                    고객 대시보드
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-2.5 py-1 sm:px-3 rounded text-xs sm:text-sm hover:bg-green-700"
                  >
                    내 정보
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/reservations`)}
                    className="bg-purple-600 text-white px-2.5 py-1 sm:px-3 rounded text-xs sm:text-sm hover:bg-purple-700"
                  >
                    내 예약
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
