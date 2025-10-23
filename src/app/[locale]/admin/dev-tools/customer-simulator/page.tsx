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
          <p className="text-gray-600">{t('loading')}</p>
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
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                뒤로
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">고객 시뮬레이션</h1>
                <p className="text-gray-600">고객의 관점에서 시스템을 테스트하세요.</p>
              </div>
            </div>
            
            {/* 시뮬레이션 상태 표시 */}
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  <Play className="w-4 h-4 inline mr-1" />
                  시뮬레이션 중: {simulatedUser.name_ko}
                </div>
                <button
                  onClick={handleStopSimulation}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center"
                >
                  <StopCircle className="w-4 h-4 mr-2" />
                  시뮬레이션 중지
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 검색 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="고객 이름, 이메일, 전화번호로 검색..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 고객 목록 */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              고객 목록 ({filteredCustomers.length}명)
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {customer.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{customer.name}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            {customer.email}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-1" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.language && (
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {customer.language}
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          가입일: {new Date(customer.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* 현재 시뮬레이션 중인 고객 표시 */}
                      {isSimulating && simulatedUser?.email === customer.email && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                          시뮬레이션 중
                        </span>
                      )}
                      
                      <button
                        onClick={() => handleStartSimulation(customer)}
                        disabled={isSimulating && simulatedUser?.email === customer.email}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        시뮬레이션 시작
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">고객이 없습니다</h3>
                <p className="text-gray-500">
                  {searchTerm ? '검색 조건에 맞는 고객이 없습니다.' : '등록된 고객이 없습니다.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 시뮬레이션 안내 */}
        {isSimulating && simulatedUser && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Play className="w-5 h-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  고객 시뮬레이션 활성화
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    현재 <strong>{simulatedUser.name_ko}</strong> 고객의 관점에서 시스템을 사용하고 있습니다.
                  </p>
                  <p className="mt-1">
                    고객 대시보드, 내 정보, 내 예약 페이지에 접근할 수 있습니다.
                  </p>
                </div>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard`)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    고객 대시보드로 이동
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    내 정보 페이지
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/reservations`)}
                    className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                  >
                    내 예약 페이지
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
