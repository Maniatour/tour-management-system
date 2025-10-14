'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Upload, X, Check, Eye, DollarSign, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface TourExpense {
  id: string
  tour_id: string
  submit_on: string
  paid_to: string
  paid_for: string
  amount: number
  payment_method: string | null
  note: string | null
  tour_date: string
  product_id: string | null
  submitted_by: string
  image_url: string | null
  file_path: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
}

interface ExpenseCategory {
  id: string
  name: string
}

interface ExpenseVendor {
  id: string
  name: string
}

interface ReservationPricing {
  id: string
  reservation_id: string
  total_price: number
  adult_product_price: number
  child_product_price: number
  infant_product_price: number
}

interface Reservation {
  id: string
  customer_name: string
  adults: number
  children: number
  infants: number
}

interface TourExpenseManagerProps {
  tourId: string
  tourDate: string
  productId?: string | null
  submittedBy: string
  reservationIds?: string[] // 투어에 배정된 예약 ID들
  onExpenseUpdated?: () => void
}

export default function TourExpenseManager({ 
  tourId, 
  tourDate, 
  productId, 
  submittedBy, 
  reservationIds,
  onExpenseUpdated 
}: TourExpenseManagerProps) {
  const t = useTranslations('tourExpense')
  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [vendors, setVendors] = useState<ExpenseVendor[]>([])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationPricing, setReservationPricing] = useState<ReservationPricing[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showCustomPaidFor, setShowCustomPaidFor] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 폼 데이터
  const [formData, setFormData] = useState({
    paid_to: '',
    paid_for: '',
    amount: '',
    payment_method: '',
    note: '',
    image_url: '',
    file_path: '',
    custom_paid_to: '',
    custom_paid_for: ''
  })

  // 예약 데이터 로드
  const loadReservations = useCallback(async () => {
    try {
      console.log('🔍 Loading reservations for tourId:', tourId, 'reservationIds:', reservationIds)
      
      let reservationsData: any[] = []
      
      if (reservationIds && reservationIds.length > 0) {
        // reservationIds가 있으면 해당 예약들만 가져오기
        console.log('📋 Loading assigned reservations:', reservationIds)
        const { data, error } = await supabase
          .from('reservations')
          .select('id, customer_id, adults, child, infant')
          .in('id', reservationIds)

        if (error) {
          console.error('❌ Assigned reservations error:', error)
          throw error
        }
        
        reservationsData = data || []
        console.log('✅ Assigned reservations data:', reservationsData)
      } else {
        // reservationIds가 없으면 tour_id로 필터링 (기존 방식)
        console.log('📋 Loading reservations by tour_id:', tourId)
        const { data, error } = await supabase
          .from('reservations')
          .select('id, customer_id, adults, child, infant')
          .eq('tour_id', tourId)

        if (error) {
          console.error('❌ Reservations by tour_id error:', error)
          throw error
        }
        
        reservationsData = data || []
        console.log('✅ Reservations by tour_id data:', reservationsData)
      }
      
      if (!reservationsData || reservationsData.length === 0) {
        setReservations([])
        return
      }
      
      // 고객 ID들을 수집
      const customerIds = reservationsData
        .map(r => r.customer_id)
        .filter(id => id !== null)
      
      // 고객 정보를 별도로 가져옴
      let customersData: any[] = []
      if (customerIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', customerIds)
        
        if (customersError) {
          console.error('❌ Customers error:', customersError)
        } else {
          customersData = customers || []
        }
      }
      
      // 데이터 변환 및 결합
      const transformedData = reservationsData.map(reservation => {
        const customer = customersData.find(c => c.id === reservation.customer_id)
        return {
          id: reservation.id,
          customer_name: customer?.name || 'Unknown',
          adults: reservation.adults || 0,
          children: reservation.child || 0,
          infants: reservation.infant || 0
        }
      })
      
      console.log('✅ Transformed data:', transformedData)
      setReservations(transformedData)
    } catch (error) {
      console.error('❌ Error loading reservations:', error)
      setReservations([])
    }
  }, [tourId, reservationIds])

  // 예약 가격 정보 로드
  const loadReservationPricing = useCallback(async () => {
    try {
      console.log('🔍 Loading reservation pricing for reservations:', reservations.map(r => r.id))
      
      if (reservations.length === 0) {
        setReservationPricing([])
        return
      }
      
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select('id, reservation_id, total_price, adult_product_price, child_product_price, infant_product_price')
        .in('reservation_id', reservations.map(r => r.id))

      if (error) {
        console.error('❌ Reservation pricing error:', error)
        throw error
      }
      
      console.log('✅ Reservation pricing data:', data)
      setReservationPricing(data || [])
    } catch (error) {
      console.error('❌ Error loading reservation pricing:', error)
      setReservationPricing([])
    }
  }, [reservations])

  // 팀 멤버 정보 로드
  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const memberMap: Record<string, string> = {}
      data?.forEach(member => {
        memberMap[member.email] = member.name_ko || member.email
      })
      setTeamMembers(memberMap)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  // 지출 목록 로드
  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('tour_expenses')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }, [tourId])

  // 카테고리 목록 로드
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name')

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  // 벤더 목록 로드
  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_vendors')
        .select('*')
        .order('name')

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

  // 영수증 이미지 업로드
  const handleImageUpload = async (file: File) => {
    try {
      // 파일 크기 체크 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일 크기가 너무 큽니다 (최대 5MB)')
      }

      // MIME 타입 체크
      if (!file.type.startsWith('image/')) {
        throw new Error(t('imageOnlyError'))
      }

      // 고유한 파일명 생성
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `tour-expenses/${tourId}/${fileName}`

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('tour-expenses')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 공개 URL 생성
      const { data: { publicUrl } } = supabase.storage
        .from('tour-expenses')
        .getPublicUrl(filePath)

      return { filePath, imageUrl: publicUrl }
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  }

  // 지출 추가
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.paid_for || !formData.amount) {
      alert(t('fillRequiredFields'))
      return
    }

    try {
      setUploading(true)
      
      // 사용자 정의 값이 있으면 새 카테고리/벤더 추가
      if (formData.custom_paid_for && !categories.find(c => c.name === formData.custom_paid_for)) {
        const { data: newCategory } = await supabase
          .from('expense_categories')
          .insert({ name: formData.custom_paid_for })
          .select()
          .single()
        if (newCategory) {
          setCategories(prev => [...prev, newCategory])
        }
      }

      if (formData.custom_paid_to && !vendors.find(v => v.name === formData.custom_paid_to)) {
        const { data: newVendor } = await supabase
          .from('expense_vendors')
          .insert({ name: formData.custom_paid_to })
          .select()
          .single()
        if (newVendor) {
          setVendors(prev => [...prev, newVendor])
        }
      }
      
      const { data, error } = await supabase
        .from('tour_expenses')
        .insert({
          tour_id: tourId,
          paid_to: formData.custom_paid_to || formData.paid_to || null,
          paid_for: formData.custom_paid_for || formData.paid_for,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          tour_date: tourDate,
          product_id: productId,
          submitted_by: submittedBy,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      setExpenses(prev => [data, ...prev])
      setShowAddForm(false)
      setFormData({
        paid_to: '',
        paid_for: '',
        amount: '',
        payment_method: '',
        note: '',
        image_url: '',
        file_path: '',
        custom_paid_to: '',
        custom_paid_for: ''
      })
      setShowCustomPaidFor(false)
      setShowCustomPaidTo(false)
      onExpenseUpdated?.()
      alert(t('expenseRegistered'))
    } catch (error) {
      console.error('Error adding expense:', error)
      alert(t('expenseRegistrationError'))
    } finally {
      setUploading(false)
    }
  }

  // 영수증 이미지 업로드 처리
  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    try {
      setUploading(true)
      const file = files[0] // 첫 번째 파일만 사용
      const { filePath, imageUrl } = await handleImageUpload(file)
      
      setFormData(prev => ({
        ...prev,
        file_path: filePath,
        image_url: imageUrl
      }))
    } catch (error) {
      alert(t('imageUploadFailed', { error: error instanceof Error ? error.message : t('unknownError') }))
    } finally {
      setUploading(false)
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length) {
      handleFileUpload(files)
    }
  }

  // 지출 상태 업데이트
  const handleStatusUpdate = async (expenseId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('tour_expenses')
        .update({
          status,
          checked_by: submittedBy,
          checked_on: new Date().toISOString()
        })
        .eq('id', expenseId)

      if (error) throw error

      setExpenses(prev => 
        prev.map(expense => 
          expense.id === expenseId 
            ? { ...expense, status, checked_by: submittedBy, checked_on: new Date().toISOString() }
            : expense
        )
      )
      onExpenseUpdated?.()
    } catch (error) {
      console.error('Error updating status:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 지출 삭제
  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const { error } = await supabase
        .from('tour_expenses')
        .delete()
        .eq('id', expenseId)

      if (error) throw error

      setExpenses(prev => prev.filter(expense => expense.id !== expenseId))
      onExpenseUpdated?.()
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert(t('deleteError'))
    }
  }

  // 금액 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('status.approved')
      case 'rejected': return t('status.rejected')
      default: return t('status.pending')
    }
  }

  // 어코디언 토글
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // 통계 계산
  const calculateFinancialStats = () => {
    console.log('💰 Financial stats calculation:', {
      reservations: reservations.length,
      reservationIds: reservationIds,
      reservationPricing: reservationPricing.length,
      expenses: expenses.length
    })
    
    // 총 입금액 계산
    const totalPayments = reservationPricing.reduce((sum, pricing) => sum + pricing.total_price, 0)
    
    // 총 지출 계산
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    
    // 가이드/드라이버 수수료 계산 (여기서는 간단히 0으로 설정, 실제로는 tour 데이터에서 가져와야 함)
    const guideFee = 0 // TODO: tour 데이터에서 guide_fee 가져오기
    const driverFee = 0 // TODO: tour 데이터에서 driver_fee 가져오기
    const totalFees = guideFee + driverFee
    
    // 수익 계산
    const profit = totalPayments - totalFees - totalExpenses
    
    console.log('💰 Calculated stats:', {
      totalPayments,
      totalExpenses,
      totalFees,
      profit
    })
    
    return {
      totalPayments,
      totalExpenses,
      totalFees,
      profit
    }
  }

  // 지출 카테고리별 그룹화
  const getExpenseBreakdown = () => {
    const breakdown: Record<string, { amount: number, count: number, expenses: TourExpense[] }> = {}
    
    expenses.forEach(expense => {
      const category = expense.paid_for
      if (!breakdown[category]) {
        breakdown[category] = { amount: 0, count: 0, expenses: [] }
      }
      breakdown[category].amount += expense.amount
      breakdown[category].count += 1
      breakdown[category].expenses.push(expense)
    })
    
    return breakdown
  }

  const financialStats = calculateFinancialStats()
  const expenseBreakdown = getExpenseBreakdown()

  useEffect(() => {
    loadExpenses()
    loadCategories()
    loadVendors()
    loadTeamMembers()
    loadReservations()
  }, [tourId, loadExpenses, loadReservations])

  useEffect(() => {
    if (reservations.length > 0) {
      loadReservationPricing()
    }
  }, [reservations, loadReservationPricing])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          title={t('addExpense')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* 정산 통계 섹션 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">정산 통계</h4>
        
        {/* 입금액 총합 */}
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('payments')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium text-gray-900">입금액 총합</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(financialStats.totalPayments)}
              </span>
            </div>
            {expandedSections.payments ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          
          {expandedSections.payments && (
            <div className="border-t p-4 bg-gray-50">
              <div className="mb-2 text-xs text-gray-500">
                📋 표시된 예약: {reservations.length}팀 (배정된 예약만)
              </div>
              <div className="space-y-2">
                {reservations.map((reservation) => {
                  const pricing = reservationPricing.find(p => p.reservation_id === reservation.id)
                  const totalPeople = reservation.adults + reservation.children + reservation.infants
                  console.log('💰 Payment display:', {
                    reservationId: reservation.id,
                    customerName: reservation.customer_name,
                    totalPeople,
                    pricing: pricing?.total_price || 0
                  })
                  return (
                    <div key={reservation.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{reservation.customer_name}</span>
                        <span className="text-gray-500">({totalPeople}명)</span>
                      </div>
                      <span className="font-medium text-green-600">
                        {pricing ? formatCurrency(pricing.total_price) : '$0'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 지출 총합 */}
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('expenses')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="font-medium text-gray-900">지출 총합</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(financialStats.totalExpenses)}
              </span>
            </div>
            {expandedSections.expenses ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          
          {expandedSections.expenses && (
            <div className="border-t p-4 bg-gray-50">
              <div className="space-y-3">
                {Object.entries(expenseBreakdown).map(([category, data]) => (
                  <div key={category} className="bg-white rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{category}</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(data.amount)} ({data.count}건)
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {data.expenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between">
                          <span>{expense.paid_to} - {expense.note || '메모 없음'}</span>
                          <span>{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 수익 */}
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('profit')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${financialStats.profit >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
              <span className="font-medium text-gray-900">수익</span>
              <span className={`text-lg font-bold ${financialStats.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(financialStats.profit)}
              </span>
            </div>
            {expandedSections.profit ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          
          {expandedSections.profit && (
            <div className="border-t p-4 bg-gray-50">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>총 입금액</span>
                  <span className="text-green-600 font-medium">{formatCurrency(financialStats.totalPayments)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>가이드/드라이버 수수료</span>
                  <span className="text-gray-600">{formatCurrency(financialStats.totalFees)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>총 지출</span>
                  <span className="text-red-600">{formatCurrency(financialStats.totalExpenses)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex items-center justify-between font-bold">
                  <span>수익</span>
                  <span className={financialStats.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                    {formatCurrency(financialStats.profit)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 지출 목록 */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading...</p>
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div key={expense.id} className="border rounded-lg p-3 hover:bg-gray-50">
              {/* 1번째 줄: Paid_for, Amount, Payment_method(뱃지), Status(뱃지) */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{expense.paid_for}</span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {expense.payment_method && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {expense.payment_method}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(expense.status)}`}>
                    {getStatusText(expense.status)}
                  </span>
                </div>
              </div>
              
              {/* 2번째 줄: Paid_to, Submitted_by(name_ko), Submit_on */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center space-x-3">
                  <span>{expense.paid_to}</span>
                  <span>•</span>
                  <span>{teamMembers[expense.submitted_by] || expense.submitted_by}</span>
                </div>
                <span>{new Date(expense.submit_on).toLocaleDateString('ko-KR')}</span>
              </div>
              
              {/* 액션 버튼들 */}
              <div className="flex items-center justify-end space-x-1 mt-2">
                {expense.image_url && (
                  <button
                    onClick={() => window.open(expense.image_url!, '_blank')}
                    className="p-1 text-gray-600 hover:text-blue-600"
                    title="영수증 보기"
                  >
                    <Eye size={14} />
                  </button>
                )}
                
                {expense.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(expense.id, 'approved')}
                      className="p-1 text-green-600 hover:text-green-800"
                      title="승인"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(expense.id, 'rejected')}
                      className="p-1 text-red-600 hover:text-red-800"
                      title="거부"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => handleDeleteExpense(expense.id)}
                  className="p-1 text-gray-600 hover:text-red-600"
                  title={t('delete')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
          <p>{t('noExpenses')}</p>
        </div>
      )}

      {/* 지출 추가 폼 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mt-8 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('addExpense')}</h3>
            
            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* 결제처와 결제내용을 같은 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('paidTo')}
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.paid_to}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, paid_to: e.target.value }))
                        setShowCustomPaidTo(false)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('selectOptions.pleaseSelect')}</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.name}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomPaidTo(!showCustomPaidTo)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showCustomPaidTo ? t('selectFromExisting') : t('enterDirectly')}
                    </button>
                    {showCustomPaidTo && (
                      <input
                        type="text"
                        value={formData.custom_paid_to}
                        onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_to: e.target.value }))}
                        placeholder={t('newPaidToPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('paidFor')} <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <select
                      value={formData.paid_for}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, paid_for: e.target.value }))
                        setShowCustomPaidFor(false)
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">{t('selectOptions.pleaseSelect')}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomPaidFor(!showCustomPaidFor)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {showCustomPaidFor ? t('selectFromExisting') : t('enterDirectly')}
                    </button>
                    {showCustomPaidFor && (
                      <input
                        type="text"
                        value={formData.custom_paid_for}
                        onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_for: e.target.value }))}
                        placeholder={t('newPaidForPlaceholder')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 금액과 결제방법을 같은 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('amount')} (USD) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    결제 방법
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                    <option value="cash">{t('paymentMethods.cash')}</option>
                    <option value="credit_card">{t('paymentMethods.creditCard')}</option>
                    <option value="debit_card">{t('paymentMethods.debitCard')}</option>
                    <option value="mobile_payment">{t('paymentMethods.mobilePayment')}</option>
                    <option value="other">{t('paymentMethods.other')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('memo')}
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder={t('memoPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 영수증 이미지 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('receiptPhoto')}
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                    dragOver 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {formData.image_url ? (
                    <div className="space-y-2">
                      <img
                        src={formData.image_url}
                        alt={t('receipt')}
                        className="mx-auto max-h-32 rounded"
                      />
                      <p className="text-sm text-green-600">{t('receiptUploaded')}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        {t('dragOrClickReceipt')}
                      </p>
                      <p className="text-xs text-gray-500">{t('mobileCameraInfo')}</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {t('cameraOrFile')}
                  </button>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? t('buttons.registering') : t('buttons.register')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
