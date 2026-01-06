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
  const [teamMembersWithStatus, setTeamMembersWithStatus] = useState<Array<{email: string, name_ko: string, is_active: boolean}>>([])
  const [showAllUsers, setShowAllUsers] = useState(false)
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
    user_emails: userEmail ? [userEmail] : [] as string[],
    limit_amount: '',
    status: 'active',
    card_number_last4: '',
    card_type: '',
    card_holder_name: '',
    expiry_month: '',
    expiry_year: '',
    monthly_limit: '',
    daily_limit: '',
    notes: ''
  })
  
  // 만료일을 YYYY-MM-01 형식으로 변환
  const getExpiryDate = () => {
    if (formData.expiry_month && formData.expiry_year) {
      return `${formData.expiry_year}-${formData.expiry_month.padStart(2, '0')}-01`
    }
    return null
  }
  
  // 만료일에서 월과 연도 추출
  const parseExpiryDate = (dateString: string | null) => {
    if (!dateString) return { month: '', year: '' }
    const parts = dateString.split('-')
    if (parts.length >= 2) {
      return { month: parts[1], year: parts[0] }
    }
    return { month: '', year: '' }
  }

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
        .select('email, name_ko, is_active')
        .order('is_active', { ascending: false })
        .order('name_ko', { ascending: true })

      if (error) throw error
      
      const membersMap: Record<string, string> = {}
      const membersWithStatus: Array<{email: string, name_ko: string, is_active: boolean}> = []
      
      data?.forEach(member => {
        membersMap[member.email] = member.name_ko
        membersWithStatus.push({
          email: member.email,
          name_ko: member.name_ko,
          is_active: member.is_active ?? true
        })
      })
      
      setTeamMembers(membersMap)
      setTeamMembersWithStatus(membersWithStatus)
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
      const createdMethods: PaymentMethod[] = []
      
      // 방법명에서 공백과 특수문자 제거하여 ID 생성에 사용
      const methodSlug = formData.method.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
      
      // 사용자가 선택된 경우 각 사용자마다 레코드 생성, 없으면 하나만 생성
      if (formData.user_emails.length > 0) {
        // 선택한 각 사용자마다 결제 방법 레코드 생성
        for (let i = 0; i < formData.user_emails.length; i++) {
          const userEmail = formData.user_emails[i]
          // 이메일에서 사용자명 부분 추출 (예: user@example.com -> user)
          const emailPrefix = userEmail.split('@')[0]
          
          // 방법명과 사용자를 조합하여 ID 생성
          // 형식: PAYM032-Cash-user 또는 사용자가 입력한 ID가 있으면 그것 사용
          let id: string
          if (formData.id && formData.id.trim() !== '') {
            // 사용자가 ID를 입력한 경우, 방법명과 사용자 조합
            id = `${formData.id}-${methodSlug}-${emailPrefix}`
          } else {
            // ID가 없으면 자동 생성
            const baseId = `PAYM${Date.now().toString().slice(-6)}`
            id = `${baseId}-${methodSlug}-${emailPrefix}`
          }
        
        let retryCount = 0
        const maxRetries = 5
        
        while (retryCount < maxRetries) {
          const response = await fetch('/api/payment-methods', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id,
              method: formData.method,
              method_type: formData.method_type,
              user_email: userEmail,
              limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
              status: formData.status,
              card_number_last4: formData.card_number_last4,
              card_type: formData.card_type,
              card_holder_name: formData.card_holder_name,
              expiry_date: getExpiryDate(),
              monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
              daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
              notes: formData.notes,
              created_by: userEmail
            })
          })

          const result = await response.json()
          
          // ID 중복 오류인 경우 새로운 ID로 재시도
          if (!result.success && result.message?.includes('already exists')) {
            retryCount++
            if (retryCount < maxRetries) {
              id = `PAYM${Date.now().toString().slice(-6)}${i}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
              continue
            }
          }
          
          if (!result.success) {
            const errorMessage = result.error || result.message || '알 수 없는 오류'
            console.error('API Error:', result)
            throw new Error(errorMessage)
          }
          
          createdMethods.push(result.data)
          break
        }
        }
      } else {
        // 사용자가 선택되지 않은 경우 하나의 레코드만 생성
        let id: string
        if (formData.id && formData.id.trim() !== '') {
          id = `${formData.id}-${methodSlug}`
        } else {
          const baseId = `PAYM${Date.now().toString().slice(-6)}`
          id = `${baseId}-${methodSlug}`
        }
        
        let retryCount = 0
        const maxRetries = 5
        
        while (retryCount < maxRetries) {
          const response = await fetch('/api/payment-methods', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id,
              method: formData.method,
              method_type: formData.method_type,
              user_email: null, // 사용자 없음
              limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
              status: formData.status,
              card_number_last4: formData.card_number_last4,
              card_type: formData.card_type,
              card_holder_name: formData.card_holder_name,
              expiry_date: getExpiryDate(),
              monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
              daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
              notes: formData.notes,
              created_by: userEmail || null
            })
          })

          const result = await response.json()
          
          // ID 중복 오류인 경우 새로운 ID로 재시도
          if (!result.success && result.message?.includes('already exists')) {
            retryCount++
            if (retryCount < maxRetries) {
              id = `PAYM${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
              continue
            }
          }
          
          if (!result.success) {
            const errorMessage = result.error || result.message || '알 수 없는 오류'
            console.error('API Error:', result)
            throw new Error(errorMessage)
          }
          
          createdMethods.push(result.data)
          break
        }
      }

      setMethods(prev => [...createdMethods, ...prev])
      setShowAddForm(false)
      resetForm()
      onMethodUpdated?.()
      alert(`결제 방법이 ${createdMethods.length}개 등록되었습니다.`)
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
      // 수정 시에는 첫 번째 선택된 사용자만 사용 (기존 레코드 업데이트)
      // 사용자가 선택되지 않은 경우 null로 설정
      const response = await fetch(`/api/payment-methods/${editingMethod.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: formData.method,
          method_type: formData.method_type,
          user_email: formData.user_emails.length > 0 ? formData.user_emails[0] : null,
          limit_amount: formData.limit_amount ? parseFloat(formData.limit_amount) : null,
          monthly_limit: formData.monthly_limit ? parseFloat(formData.monthly_limit) : null,
          daily_limit: formData.daily_limit ? parseFloat(formData.daily_limit) : null,
          status: formData.status,
          card_number_last4: formData.card_number_last4,
          card_type: formData.card_type,
          card_holder_name: formData.card_holder_name,
          expiry_date: getExpiryDate(),
          notes: formData.notes,
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
    const { month, year } = parseExpiryDate(method.expiry_date)
    setFormData({
      id: method.id,
      method: method.method,
      method_type: method.method_type,
      user_emails: [method.user_email],
      limit_amount: method.limit_amount?.toString() || '',
      status: method.status,
      card_number_last4: method.card_number_last4 || '',
      card_type: method.card_type || '',
      card_holder_name: method.card_holder_name || '',
      expiry_month: month,
      expiry_year: year,
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
      user_emails: userEmail ? [userEmail] : [],
      limit_amount: '',
      status: 'active',
      card_number_last4: '',
      card_type: '',
      card_holder_name: '',
      expiry_month: '',
      expiry_year: '',
      monthly_limit: '',
      daily_limit: '',
      notes: ''
    })
    setShowAllUsers(false)
  }
  
  // 사용자 선택 토글
  const toggleUserSelection = (email: string) => {
    setFormData(prev => {
      const isSelected = prev.user_emails.includes(email)
      if (isSelected) {
        return {
          ...prev,
          user_emails: prev.user_emails.filter(e => e !== email)
        }
      } else {
        return {
          ...prev,
          user_emails: [...prev.user_emails, email]
        }
      }
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
                setShowAllUsers(false)
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
                setShowAllUsers(false)
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
                  placeholder="PAYM032"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  실제 ID는 "{formData.id || 'PAYM032'}-{formData.method || '방법명'}-사용자명" 형식으로 자동 생성됩니다.
                </p>
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

              {/* 사용자 (다중 선택) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사용자
                  {formData.user_emails.length > 0 && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({formData.user_emails.length}명 선택됨)
                    </span>
                  )}
                </label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {teamMembersWithStatus.length === 0 ? (
                    <p className="text-sm text-gray-500">팀 멤버를 불러오는 중...</p>
                  ) : (
                    <div className="space-y-2">
                      {/* 활성 사용자 먼저 표시 */}
                      {teamMembersWithStatus
                        .filter(member => member.is_active)
                        .map(({ email, name_ko }) => {
                          const isSelected = formData.user_emails.includes(email)
                          return (
                            <label
                              key={email}
                              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleUserSelection(email)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">
                                {name_ko} ({email})
                              </span>
                            </label>
                          )
                        })}
                      
                      {/* 비활성 사용자 (더보기 버튼으로 표시) */}
                      {teamMembersWithStatus.filter(member => !member.is_active).length > 0 && (
                        <>
                          {!showAllUsers && (
                            <button
                              type="button"
                              onClick={() => setShowAllUsers(true)}
                              className="w-full text-left text-sm text-blue-600 hover:text-blue-800 py-2 px-2 rounded hover:bg-blue-50 transition-colors"
                            >
                              더보기 ({teamMembersWithStatus.filter(member => !member.is_active).length}명)
                            </button>
                          )}
                          
                          {showAllUsers && (
                            <>
                              {teamMembersWithStatus
                                .filter(member => !member.is_active)
                                .map(({ email, name_ko }) => {
                                  const isSelected = formData.user_emails.includes(email)
                                  return (
                                    <label
                                      key={email}
                                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded opacity-75"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleUserSelection(email)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                      <span className="text-sm text-gray-600">
                                        {name_ko} ({email})
                                      </span>
                                    </label>
                                  )
                                })}
                              <button
                                type="button"
                                onClick={() => setShowAllUsers(false)}
                                className="w-full text-left text-sm text-gray-600 hover:text-gray-800 py-2 px-2 rounded hover:bg-gray-50 transition-colors"
                              >
                                접기
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
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

              {/* 만료일 (월/년) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">만료일</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.expiry_month}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiry_month: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">월 선택</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const month = (i + 1).toString().padStart(2, '0')
                      return (
                        <option key={month} value={month}>
                          {month}월
                        </option>
                      )
                    })}
                  </select>
                  <select
                    value={formData.expiry_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiry_year: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">년 선택</option>
                    {Array.from({ length: 20 }, (_, i) => {
                      const year = (new Date().getFullYear() + i).toString()
                      return (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      )
                    })}
                  </select>
                </div>
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
                  setShowAllUsers(false)
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
                  {method.expiry_date && (() => {
                    const { month, year } = parseExpiryDate(method.expiry_date)
                    return month && year ? (
                      <div><span className="font-medium">만료일:</span> {year}년 {month}월</div>
                    ) : null
                  })()}
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
