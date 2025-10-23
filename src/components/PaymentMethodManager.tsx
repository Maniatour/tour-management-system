'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  DollarSign, 
  Calendar, 
  User, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  Download,
  Upload
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { supabase } from '@/lib/supabase'

interface PaymentMethod {
  id: string
  method: string
  method_type: string
  user_email: string
  limit_amount: number | null
  status: string
  card_number_last4: string | null
  card_type: string | null
  card_holder_name: string | null
  expiry_date: string | null
  monthly_limit: number | null
  daily_limit: number | null
  current_month_usage: number
  current_day_usage: number
  assigned_date: string
  last_used_date: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  team?: {
    email: string
    name_ko: string
    name_en: string
  } | null
}

interface PaymentMethodManagerProps {
  userEmail?: string
  userRole?: 'admin' | 'team_member'
  onMethodUpdated?: () => void
}

export default function PaymentMethodManager({ 
  userEmail, 
  userRole = 'team_member',
  onMethodUpdated 
}: PaymentMethodManagerProps) {
  
  const t = useTranslations('paymentMethod')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [filters, setFilters] = useState({
    status: '',
    method_type: '',
    search: ''
  })

  // 폼 데이터
  const [formData, setFormData] = useState({
    id: '',
    method: '',
    method_type: 'card',
    user_email: userEmail || '',
    limit_amount: '',
    status: 'active',
    card_number_last4: '',
    card_type: '',
    card_holder_name: '',
    expiry_date: '',
    monthly_limit: '',
    daily_limit: '',
    notes: ''
  })

  // 데이터 로드
  useEffect(() => {
    loadMethods()
    loadTeamMembers()
  }, [userEmail])

  const loadMethods = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (userEmail) params.append('user_email', userEmail)
      if (filters.status) params.append('status', filters.status)
      if (filters.method_type) params.append('method_type', filters.method_type)

      const response = await fetch(`/api/payment-methods?${params}`)
      const result = await response.json()
      
      if (result.success) {
        let filteredData = result.data
        
        // 검색 필터 적용
        if (filters.search) {
          filteredData = filteredData.filter((method: PaymentMethod) =>
            method.method.toLowerCase().includes(filters.search.toLowerCase()) ||
            method.id.toLowerCase().includes(filters.search.toLowerCase()) ||
            (method.team?.name_ko && method.team.name_ko.toLowerCase().includes(filters.search.toLowerCase()))
          )
        }
        
        setMethods(filteredData)
      }
    } catch (error) {
      console.error('Error loading payment methods:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const membersMap: Record<string, string> = {}
      data?.forEach(member => {
        membersMap[member.email] = member.name_ko
      })
      setTeamMembers(membersMap)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  // 결제 방법 추가
  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 수정 모드일 때는 수정 함수 호출
    if (editingMethod) {
      await handleUpdateMethod(e)
      return
    }
    
    try {
      // 고유 ID 생성 (구글 시트 ID 형식)
      const id = formData.id || `PAYM${Date.now().toString().slice(-6)}`
      
      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          id,
          limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
          monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
          daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
          created_by: userEmail
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setMethods(prev => [result.data, ...prev])
      setShowAddForm(false)
      resetForm()
      onMethodUpdated?.()
      alert('결제 방법이 등록되었습니다.')
    } catch (error) {
      console.error('Error adding payment method:', error)
      alert(`결제 방법 등록에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 방법 수정
  const handleUpdateMethod = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingMethod) return
    
    try {
      const response = await fetch(`/api/payment-methods/${editingMethod.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
          monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
          daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
          updated_by: userEmail
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setMethods(prev => prev.map(method => 
        method.id === editingMethod.id ? result.data : method
      ))
      
      setEditingMethod(null)
      setShowAddForm(false)
      resetForm()
      onMethodUpdated?.()
      alert('결제 방법이 수정되었습니다.')
    } catch (error) {
      console.error('Error updating payment method:', error)
      alert(`결제 방법 수정에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 방법 삭제
  const handleDeleteMethod = async (id: string) => {
    if (!confirm('정말로 이 결제 방법을 삭제하시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setMethods(prev => prev.filter(method => method.id !== id))
      onMethodUpdated?.()
      alert('결제 방법이 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting payment method:', error)
      alert(`결제 방법 삭제에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  // 결제 방법 수정 모드로 전환
  const handleEditMethod = (method: PaymentMethod) => {
    setEditingMethod(method)
    setFormData({
      id: method.id,
      method: method.method,
      method_type: method.method_type,
      user_email: method.user_email,
      limit_amount: method.limit_amount?.toString() || '',
      status: method.status,
      card_number_last4: method.card_number_last4 || '',
      card_type: method.card_type || '',
      card_holder_name: method.card_holder_name || '',
      expiry_date: method.expiry_date || '',
      monthly_limit: method.monthly_limit?.toString() || '',
      daily_limit: method.daily_limit?.toString() || '',
      notes: method.notes || ''
    })
    setShowAddForm(true)
  }

  // 폼 리셋
  const resetForm = () => {
    setFormData({
      id: '',
      method: '',
      method_type: 'card',
      user_email: userEmail || '',
      limit_amount: '',
      status: 'active',
      card_number_last4: '',
      card_type: '',
      card_holder_name: '',
      expiry_date: '',
      monthly_limit: '',
      daily_limit: '',
      notes: ''
    })
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'suspended': return 'bg-yellow-100 text-yellow-800'
      case 'expired': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 상태별 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} />
      case 'inactive': return <XCircle size={16} />
      case 'suspended': return <AlertTriangle size={16} />
      case 'expired': return <Clock size={16} />
      default: return <Clock size={16} />
    }
  }

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '활성'
      case 'inactive': return '비활성'
      case 'suspended': return '정지'
      case 'expired': return '만료'
      default: return status
    }
  }

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  // 사용량 비율 계산
  const getUsagePercentage = (current: number, limit: number | null) => {
    if (!limit || limit === 0) return 0
    return Math.min((current / limit) * 100, 100)
  }

  // 사용량 색상
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  // 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    loadMethods()
  }, [filters.status, filters.method_type, filters.search])

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <CreditCard className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">결제 방법 관리</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setShowAddForm(true)
              setEditingMethod(null)
              resetForm()
            }}
            className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span>결제 방법 추가</span>
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="suspended">정지</option>
              <option value="expired">만료</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
            <select
              value={filters.method_type}
              onChange={(e) => setFilters(prev => ({ ...prev, method_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">전체</option>
              <option value="card">카드</option>
              <option value="cash">현금</option>
              <option value="transfer">계좌이체</option>
              <option value="mobile">모바일</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="방법명, ID, 사용자명 검색"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: '', method_type: '', search: '' })}
              className="w-full px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 결제 방법 추가/수정 폼 */}
      {showAddForm && (
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-900">
              {editingMethod ? '결제 방법 수정' : '결제 방법 추가'}
            </h4>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingMethod(null)
                resetForm()
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle size={20} />
            </button>
          </div>

          <form onSubmit={handleAddMethod} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="PAYM012"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 방법명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  방법명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.method}
                  onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
                  placeholder="CC 4052"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  유형 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.method_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, method_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="card">카드</option>
                  <option value="cash">현금</option>
                  <option value="transfer">계좌이체</option>
                  <option value="mobile">모바일</option>
                  <option value="other">기타</option>
                </select>
              </div>

              {/* 사용자 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용자 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.user_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, user_email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">선택해주세요</option>
                  {Object.entries(teamMembers).map(([email, name]) => (
                    <option key={email} value={email}>{name} ({email})</option>
                  ))}
                </select>
              </div>

              {/* 한도 금액 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">한도 금액</label>
                <input
                  type="number"
                  value={formData.limit_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, limit_amount: e.target.value }))}
                  placeholder="5000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 상태 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                  <option value="suspended">정지</option>
                  <option value="expired">만료</option>
                </select>
              </div>

              {/* 카드 번호 마지막 4자리 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카드 번호 마지막 4자리</label>
                <input
                  type="text"
                  value={formData.card_number_last4}
                  onChange={(e) => setFormData(prev => ({ ...prev, card_number_last4: e.target.value }))}
                  placeholder="4052"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 카드 타입 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카드 타입</label>
                <select
                  value={formData.card_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, card_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">선택해주세요</option>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                  <option value="discover">Discover</option>
                  <option value="jcb">JCB</option>
                  <option value="other">기타</option>
                </select>
              </div>

              {/* 카드 소유자명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카드 소유자명</label>
                <input
                  type="text"
                  value={formData.card_holder_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, card_holder_name: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 만료일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">만료일</label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 월 한도 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">월 한도</label>
                <input
                  type="number"
                  value={formData.monthly_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, monthly_limit: e.target.value }))}
                  placeholder="100000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* 일 한도 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">일 한도</label>
                <input
                  type="number"
                  value={formData.daily_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, daily_limit: e.target.value }))}
                  placeholder="10000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="메모를 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingMethod(null)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingMethod ? '수정' : '등록'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 결제 방법 목록 */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">로딩중...</p>
        </div>
      ) : methods.length > 0 ? (
        <div className="space-y-2">
          {methods.map((method) => (
            <div key={method.id} className="bg-white border rounded-lg p-4 hover:bg-gray-50">
              {/* 상단: 방법명, 상태, 수정/삭제 버튼 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-900">{method.method}</span>
                    <span className="text-sm text-gray-500">({method.id})</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusColor(method.status)}`}>
                    {getStatusIcon(method.status)}
                    <span>{getStatusText(method.status)}</span>
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {/* 수정 버튼 */}
                  <button
                    onClick={() => handleEditMethod(method)}
                    className="p-1 text-gray-600 hover:text-blue-600"
                    title="수정"
                  >
                    <Edit size={14} />
                  </button>
                  
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDeleteMethod(method.id)}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              {/* 중간: 사용자, 유형, 한도 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User size={14} />
                  <span>{teamMembers[method.user_email] || method.user_email}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">유형:</span> {method.method_type}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">한도:</span> {method.limit_amount ? formatCurrency(method.limit_amount) : '제한없음'}
                </div>
              </div>

              {/* 하단: 사용량 및 카드 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 사용량 */}
                <div className="space-y-2">
                  {method.monthly_limit && (
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>월 사용량</span>
                        <span>{formatCurrency(method.current_month_usage)} / {formatCurrency(method.monthly_limit)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(method.current_month_usage, method.monthly_limit))}`}
                          style={{ width: `${getUsagePercentage(method.current_month_usage, method.monthly_limit)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {method.daily_limit && (
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>일 사용량</span>
                        <span>{formatCurrency(method.current_day_usage)} / {formatCurrency(method.daily_limit)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${getUsageColor(getUsagePercentage(method.current_day_usage, method.daily_limit))}`}
                          style={{ width: `${getUsagePercentage(method.current_day_usage, method.daily_limit)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 카드 정보 */}
                <div className="text-sm text-gray-600 space-y-1">
                  {method.card_number_last4 && (
                    <div><span className="font-medium">카드번호:</span> ****{method.card_number_last4}</div>
                  )}
                  {method.card_type && (
                    <div><span className="font-medium">카드타입:</span> {method.card_type}</div>
                  )}
                  {method.card_holder_name && (
                    <div><span className="font-medium">소유자:</span> {method.card_holder_name}</div>
                  )}
                  {method.expiry_date && (
                    <div><span className="font-medium">만료일:</span> {method.expiry_date}</div>
                  )}
                  {method.last_used_date && (
                    <div><span className="font-medium">마지막 사용:</span> {new Date(method.last_used_date).toLocaleDateString('ko-KR')}</div>
                  )}
                </div>
              </div>

              {/* 메모 */}
              {method.notes && (
                <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <span className="font-medium">메모:</span> {method.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p>등록된 결제 방법이 없습니다.</p>
        </div>
      )}
    </div>
  )
}
