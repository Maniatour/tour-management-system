'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  email: string
  name: string
  phone?: string
  language: string
  created_at: string
}

interface CustomerSimulationModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CustomerSimulationModal({ isOpen, onClose }: CustomerSimulationModalProps) {
  const { startSimulation } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 고객 목록 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
    }
  }, [isOpen])

  // 검색 필터링
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredCustomers(customers)
    } else {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm))
      )
      setFilteredCustomers(filtered)
    }
  }, [searchTerm, customers])

  const fetchCustomers = async () => {
    setLoading(true)
    setError('')
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, email, name, phone, language, created_at')
        .order('created_at', { ascending: false })
        .limit(100) // 최근 100명만 표시

      if (error) {
        console.error('고객 목록 조회 오류:', error)
        setError('고객 목록을 불러오는데 실패했습니다.')
        return
      }

      setCustomers(data || [])
      setFilteredCustomers(data || [])
    } catch (err) {
      console.error('고객 목록 조회 중 오류:', err)
      setError('고객 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerSelect = (customer: Customer) => {
    try {
      // 고객 정보를 시뮬레이션 데이터로 변환
      const simulationData = {
        id: customer.id,
        email: customer.email,
        name_ko: customer.name,
        name_en: customer.name, // 영어 이름이 없으면 한국어 이름 사용
        position: 'customer',
        role: 'customer' as const,
        phone: customer.phone || '',
        language: customer.language || 'ko',
        created_at: customer.created_at
      }

      startSimulation(simulationData)
      onClose()
      
      // 고객 페이지로 이동
      setTimeout(() => {
        window.location.href = '/ko/dashboard'
      }, 100)
    } catch (error) {
      console.error('고객 시뮬레이션 시작 중 오류:', error)
      setError('시뮬레이션을 시작하는데 실패했습니다.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">고객 시뮬레이션</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="고객 이름, 이메일, 전화번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 오류 메시지 */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 고객 목록 */}
        <div className="overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">고객 목록을 불러오는 중...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">
                  {searchTerm ? '검색 결과가 없습니다.' : '고객이 없습니다.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleCustomerSelect(customer)}
                  className="w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">
                            {customer.name}
                          </h3>
                          <p className="text-sm text-gray-500">{customer.email}</p>
                          {customer.phone && (
                            <p className="text-xs text-gray-400">{customer.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        가입일: {formatDate(customer.created_at)}
                      </p>
                      <p className="text-xs text-gray-400">
                        언어: {customer.language === 'ko' ? '한국어' : '영어'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            시뮬레이션할 고객을 선택하면 해당 고객의 관점에서 고객 페이지를 볼 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  )
}
