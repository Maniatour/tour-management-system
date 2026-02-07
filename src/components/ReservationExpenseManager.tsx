'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Plus, Upload, X, Eye, DollarSign, Edit, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface ReservationExpense {
  id: string
  submit_on: string
  submitted_by: string
  paid_to: string
  paid_for: string
  amount: number
  payment_method: string | null
  note: string | null
  image_url: string | null
  file_path: string | null
  status: 'pending' | 'approved' | 'rejected'
  reservation_id: string | null
  event_id: string | null
  audited_by: string | null
  checked_by: string | null
  checked_on: string | null
  created_at: string
  updated_at: string
  reservations?: {
    id: string
    customer_name: string
    customer_email: string
    product_id: string
  } | null
}

interface ExpenseCategory {
  id: string
  name: string
}

interface ExpenseVendor {
  id: string
  name: string
}

interface Reservation {
  id: string
  customer_id: string
  product_id: string
  customers: {
    name: string
    email: string
  }
}

interface ReservationExpenseManagerProps {
  reservationId?: string
  submittedBy?: string
  userRole?: 'admin' | 'team_member'
  onExpenseUpdated?: () => void
}

export default function ReservationExpenseManager({ 
  reservationId, 
  submittedBy, 
  onExpenseUpdated 
}: ReservationExpenseManagerProps) {
  
  const t = useTranslations('reservationExpense')
  const [expenses, setExpenses] = useState<ReservationExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [paidToOptions, setPaidToOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ReservationExpense | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  const [showCustomPaidFor, setShowCustomPaidFor] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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
    custom_paid_for: '',
    reservation_id: reservationId || '',
    event_id: '',
    uploaded_files: [] as File[]
  })

  // 데이터 로드
  useEffect(() => {
    loadExpenses()
    loadCategories()
    loadVendors()
    loadTeamMembers()
    loadReservations()
  }, [reservationId])

  const loadExpenses = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (reservationId) params.append('reservation_id', reservationId)
      if (submittedBy) params.append('submitted_by', submittedBy)

      const response = await fetch(`/api/reservation-expenses?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setExpenses(result.data)
      }
    } catch (error) {
      console.error('Error loading expenses:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_vendors')
        .select('*')
        .order('name')

      if (error) throw error
      setPaidToOptions(data?.map((v: ExpenseVendor) => v.name) || [])
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team')
        .select('email, name_ko')

      if (error) throw error
      
      const membersMap: Record<string, string> = {}
      data?.forEach((member: { email: string; name_ko: string }) => {
        membersMap[member.email] = member.name_ko
      })
      setTeamMembers(membersMap)
    } catch (error) {
      console.error('Error loading team members:', error)
    }
  }

  const loadReservations = async () => {
    try {
      // 예약 정보 가져오기
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, customer_id, product_id')
        .order('created_at', { ascending: false })
        .limit(100)

      if (reservationsError) throw reservationsError

      if (!reservationsData || reservationsData.length === 0) {
        setReservations([])
        return
      }

      // 고객 ID 목록 추출
      const customerIds = [...new Set(reservationsData.map((r: any) => r.customer_id).filter(Boolean))]
      
      // 고객 정보 가져오기
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email')
        .in('id', customerIds)

      if (customersError) throw customersError

      // 고객 정보를 Map으로 변환
      const customerMap = new Map((customersData || []).map((c: any) => [c.id, c]))

      // 예약과 고객 정보 결합
      const reservationsWithCustomers = reservationsData.map((reservation: any) => ({
        id: reservation.id,
        customer_id: reservation.customer_id,
        product_id: reservation.product_id,
        customers: customerMap.get(reservation.customer_id) || { name: 'Unknown', email: '' }
      }))

      setReservations(reservationsWithCustomers)
    } catch (error) {
      console.error('Error loading reservations:', error)
    }
  }

  // 이미지 업로드
  const handleImageUpload = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'reservation-expenses')

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Upload failed')
      }

      return {
        filePath: result.path,
        imageUrl: result.imageUrl
      }
    } catch (error) {
      console.error('Image upload error:', error)
      throw error
    }
  }

  // 지출 추가
  const handleAddExpense = async () => {
    
    // 수정 모드일 때는 수정 함수 호출
    if (editingExpense) {
      await handleUpdateExpense()
      return
    }
    
    try {
      setUploading(true)
      
      // 고유 ID 생성 (구글 시트 ID 형식)
      const id = `RE_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      
      // 결제처 처리
      let finalPaidTo = formData.paid_to
      if (formData.custom_paid_to) {
        finalPaidTo = formData.custom_paid_to
        // 새로운 벤더 추가
        try {
          const { data: newVendor } = await supabase
            .from('expense_vendors')
            .insert({ name: formData.custom_paid_to } as any)
            .select()
            .single()
          
          if (newVendor) {
            setPaidToOptions(prev => [...prev, (newVendor as ExpenseVendor).name])
          }
        } catch (error) {
          console.error('Error adding new vendor:', error)
        }
      }
      
      const { data, error } = await supabase
        .from('reservation_expenses')
        .insert({
          id,
          submitted_by: submittedBy || 'unknown',
          paid_to: finalPaidTo,
          paid_for: formData.custom_paid_for || formData.paid_for,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          reservation_id: formData.reservation_id || null,
          event_id: formData.event_id || null,
          status: 'pending'
        } as any)
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
        custom_paid_for: '',
        reservation_id: reservationId || '',
        event_id: '',
        uploaded_files: []
      })
      setShowCustomPaidFor(false)
      setShowCustomPaidTo(false)
      onExpenseUpdated?.()
      alert('예약 지출이 등록되었습니다.')
    } catch (error) {
      console.error('Error adding expense:', error)
      alert('예약 지출 등록에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 지출 수정
  const handleUpdateExpense = async () => {
    
    if (!editingExpense) return
    
    try {
      setUploading(true)
      
      const response = await fetch(`/api/reservation-expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paid_to: formData.custom_paid_to || formData.paid_to,
          paid_for: formData.custom_paid_for || formData.paid_for,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          reservation_id: formData.reservation_id || null,
          event_id: formData.event_id || null
        })
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setExpenses(prev => prev.map(expense => 
        expense.id === editingExpense.id ? result.data : expense
      ))
      
      setEditingExpense(null)
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
        custom_paid_for: '',
        reservation_id: reservationId || '',
        event_id: '',
        uploaded_files: []
      })
      setShowCustomPaidFor(false)
      setShowCustomPaidTo(false)
      onExpenseUpdated?.()
      alert('예약 지출이 수정되었습니다.')
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('예약 지출 수정에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 지출 삭제
  const handleDeleteExpense = async (id: string) => {
    if (!confirm('정말로 이 예약 지출을 삭제하시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/reservation-expenses/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.message)
      }

      setExpenses(prev => prev.filter(expense => expense.id !== id))
      onExpenseUpdated?.()
      alert('예약 지출이 삭제되었습니다.')
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('예약 지출 삭제에 실패했습니다.')
    }
  }

  // 지출 수정 모드로 전환
  const handleEditExpense = (expense: ReservationExpense) => {
    setEditingExpense(expense)
    setFormData({
      paid_to: expense.paid_to,
      paid_for: expense.paid_for,
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      note: expense.note || '',
      image_url: expense.image_url || '',
      file_path: expense.file_path || '',
      custom_paid_to: '',
      custom_paid_for: '',
      reservation_id: expense.reservation_id || '',
      event_id: expense.event_id || '',
      uploaded_files: []
    })
    setShowAddForm(true)
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
    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(file => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      return allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024
    })
    
    if (validFiles.length !== files.length) {
      alert('일부 파일이 지원되지 않는 형식이거나 크기가 너무 큽니다.')
    }
    
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...validFiles]
      }))
    }
  }

  // 클립보드 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files: File[] = []
    
    items.forEach(item => {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
          if (allowedTypes.includes(file.type) && file.size <= 10 * 1024 * 1024) {
            files.push(file)
          }
        }
      }
    })
    
    if (files.length > 0) {
      setFormData(prev => ({
        ...prev,
        uploaded_files: [...prev.uploaded_files, ...files]
      }))
    }
  }

  // 파일 제거 핸들러
  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      uploaded_files: prev.uploaded_files.filter((_, i) => i !== index)
    }))
  }

  // 상태별 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 상태별 텍스트
  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return t('status.approved')
      case 'rejected': return t('status.rejected')
      case 'pending': return t('status.pending')
      default: return status
    }
  }

  // 통화 포맷
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  // 총 금액 계산
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* 헤더 - 컴팩트 */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
          <h3 className="text-[11px] font-semibold text-gray-900 truncate">{t('expenseManagement')}</h3>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
          <div className="text-[10px] sm:text-xs text-gray-600">
            {t('totalAmountLabel')}: <span className="font-semibold text-green-600">{formatCurrency(totalAmount)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(true)
              setEditingExpense(null)
              setFormData({
                paid_to: '',
                paid_for: '',
                amount: '',
                payment_method: '',
                note: '',
                image_url: '',
                file_path: '',
                custom_paid_to: '',
                custom_paid_for: '',
                reservation_id: reservationId || '',
                event_id: '',
                uploaded_files: []
              })
            }}
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium transition-colors flex-shrink-0"
          >
            <Plus size={12} />
            <span>{t('addExpense')}</span>
          </button>
        </div>
      </div>

      {/* 지출 추가/수정 폼 - 모바일 컴팩트 */}
      {showAddForm && (
        <div className="bg-white border rounded-lg p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h4 className="text-base sm:text-lg font-medium text-gray-900">
              {editingExpense ? t('editExpense') : t('addExpense')}
            </h4>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingExpense(null)
                setFormData({
                  paid_to: '',
                  paid_for: '',
                  amount: '',
                  payment_method: '',
                  note: '',
                  image_url: '',
                  file_path: '',
                  custom_paid_to: '',
                  custom_paid_for: '',
                  reservation_id: reservationId || '',
                  event_id: '',
                  uploaded_files: []
                })
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {/* 결제처 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('paidTo')} <span className="text-red-500">*</span>
                </label>
                {!showCustomPaidTo ? (
                  <div className="space-y-2">
                    <select
                      value={formData.paid_to}
                      onChange={(e) => setFormData(prev => ({ ...prev, paid_to: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">{t('selectOptions.pleaseSelect')}</option>
                      {paidToOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomPaidTo(true)}
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                    >
                      {t('directInput')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.custom_paid_to}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_to: e.target.value }))}
                      placeholder={t('newPaidToPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomPaidTo(false)
                        setFormData(prev => ({ ...prev, custom_paid_to: '' }))
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      {t('backToList')}
                    </button>
                  </div>
                )}
              </div>

              {/* 결제내용 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('paidFor')} <span className="text-red-500">*</span>
                </label>
                {!showCustomPaidFor ? (
                  <div className="space-y-2">
                    <select
                      value={formData.paid_for}
                      onChange={(e) => setFormData(prev => ({ ...prev, paid_for: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">{t('selectOptions.pleaseSelect')}</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.name}>{category.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomPaidFor(true)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {t('directInput')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.custom_paid_for}
                      onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_for: e.target.value }))}
                      placeholder={t('newPaidForPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomPaidFor(false)
                        setFormData(prev => ({ ...prev, custom_paid_for: '' }))
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      {t('backToList')}
                    </button>
                  </div>
                )}
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('amount')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* 결제방법 */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('form.paymentMethod')}
                </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                    <option value="cash">{t('paymentMethods.cash')}</option>
                    <option value="creditCard">{t('paymentMethods.creditCard')}</option>
                    <option value="debitCard">{t('paymentMethods.debitCard')}</option>
                    <option value="mobilePayment">{t('paymentMethods.mobilePayment')}</option>
                    <option value="other">{t('paymentMethods.other')}</option>
                  </select>
              </div>

              {/* 예약 ID */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('form.reservationId')}
                </label>
                <select
                  value={formData.reservation_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, reservation_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t('selectOptions.pleaseSelect')}</option>
                  {reservations.map((reservation: Reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.customers.name} ({reservation.product_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* 이벤트 ID */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                  {t('form.eventId')}
                </label>
                <input
                  type="text"
                  value={formData.event_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, event_id: e.target.value }))}
                  placeholder={t('enterEventId')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                {t('memo')}
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder={t('memoPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* 영수증 이미지 업로드 */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-0.5 sm:mb-1">
                {t('form.image')}
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
                  uploading 
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                    : dragOver 
                      ? 'border-blue-500 bg-blue-100 scale-105 cursor-pointer' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                }`}
                onDragOver={!uploading ? handleDragOver : undefined}
                onDragLeave={!uploading ? handleDragLeave : undefined}
                onDrop={!uploading ? handleDrop : undefined}
                onPaste={!uploading ? handlePaste : undefined}
                tabIndex={!uploading ? 0 : -1}
                onClick={!uploading ? () => fileInputRef.current?.click() : undefined}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files)
                      setFormData(prev => ({
                        ...prev,
                        uploaded_files: [...prev.uploaded_files, ...files]
                      }))
                    }
                  }}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center space-y-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    uploading 
                      ? 'bg-blue-100' 
                      : dragOver 
                        ? 'bg-blue-200' 
                        : 'bg-gray-100'
                  }`}>
                    {uploading ? (
                      <div className="animate-spin">
                        <Upload className="w-6 h-6 text-blue-600" />
                      </div>
                    ) : dragOver ? (
                      <Upload className="w-6 h-6 text-blue-600" />
                    ) : (
                      <Upload className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium transition-colors ${
                      dragOver ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {uploading 
                        ? t('uploadingFiles')
                        : dragOver 
                          ? t('dropFilesHere')
                          : t('dragOrClickFiles')
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('pasteFromClipboard')}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {t('supportedFormats')}
                  </div>
                </div>
                
                {/* 업로드된 파일 목록 */}
                {formData.uploaded_files && formData.uploaded_files.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium mb-3 text-gray-900">{t('uploadedFiles')} ({formData.uploaded_files?.length || 0}{t('files')})</h4>
                    <div className="space-y-2">
                      {formData.uploaded_files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                              {file.type.startsWith('image/') ? (
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(index)
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingExpense(null)
                  setFormData({
                    paid_to: '',
                    paid_for: '',
                    amount: '',
                    payment_method: '',
                    note: '',
                    image_url: '',
                    file_path: '',
                    custom_paid_to: '',
                    custom_paid_for: '',
                    reservation_id: reservationId || '',
                    event_id: '',
                    uploaded_files: []
                  })
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t('buttons.cancel')}
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? t('processing') : (editingExpense ? t('buttons.edit') : t('buttons.register'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지출 목록 */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">{t('loading')}</p>
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-3 sm:space-y-2">
          {expenses.map((expense) => (
            <div key={expense.id} className="border border-gray-200 rounded-xl p-4 sm:p-3 bg-white hover:bg-gray-50/80 shadow-sm active:bg-gray-100 transition-colors">
              {/* 1행: 결제내용 + 금액 + 상태 */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{expense.paid_for}</p>
                  <p className="text-lg sm:text-xl font-bold text-green-600 mt-0.5">
                    {formatCurrency(expense.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                    {getStatusText(expense.status)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditExpense(expense); }}
                      className="p-2 min-w-[44px] min-h-[44px] sm:p-1 sm:min-w-0 sm:min-h-0 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center"
                      title={t('buttons.edit')}
                    >
                      <Edit size={18} className="sm:w-[14px] sm:h-[14px]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense.id); }}
                      className="p-2 min-w-[44px] min-h-[44px] sm:p-1 sm:min-w-0 sm:min-h-0 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
                      title={t('buttons.delete')}
                    >
                      <Trash2 size={18} className="sm:w-[14px] sm:h-[14px]" />
                    </button>
                  </div>
                </div>
              </div>
              {/* 2행: 라벨/값 그리드 (모바일 가독성) */}
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs sm:text-sm text-gray-600 border-t border-gray-100 pt-3">
                <span className="text-gray-400">결제처</span>
                <span className="truncate">{expense.paid_to}</span>
                <span className="text-gray-400">제출일</span>
                <span>{new Date(expense.submit_on).toLocaleDateString('ko-KR')}</span>
                <span className="text-gray-400">제출자</span>
                <span className="truncate">{teamMembers[expense.submitted_by] || expense.submitted_by}</span>
                {expense.payment_method && (
                  <>
                    <span className="text-gray-400">결제방법</span>
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs w-fit">{expense.payment_method}</span>
                  </>
                )}
              </div>
              {expense.image_url && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(expense.image_url!, '_blank'); }}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium py-1.5"
                  >
                    <Eye size={14} />
                    {t('viewReceipt')}
                  </button>
                </div>
              )}
              {expense.reservations && (
                <p className="mt-2 text-xs text-gray-500">
                  {t('reservation')}: {expense.reservations.customer_name} ({expense.reservations.product_id})
                </p>
              )}
              {expense.note && (
                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                  {expense.note}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-3 text-gray-500">
          <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-1" />
          <p className="text-xs">{t('noExpensesMessage')}</p>
        </div>
      )}
    </div>
  )
}
