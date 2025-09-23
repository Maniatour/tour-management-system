'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Upload, X, Check, Eye, Camera, DollarSign, MapPin, Calendar, CreditCard, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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

interface TourExpenseManagerProps {
  tourId: string
  tourDate: string
  productId?: string | null
  submittedBy: string
  onExpenseUpdated?: () => void
}

export default function TourExpenseManager({ 
  tourId, 
  tourDate, 
  productId, 
  submittedBy, 
  onExpenseUpdated 
}: TourExpenseManagerProps) {
  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [vendors, setVendors] = useState<ExpenseVendor[]>([])
  const [loading, setLoading] = useState(false)
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

  // 지출 목록 로드
  const loadExpenses = async () => {
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
  }

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
        throw new Error('이미지 파일만 업로드 가능합니다')
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
      alert('필수 항목을 모두 입력해주세요.')
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
      alert('지출이 등록되었습니다.')
    } catch (error) {
      console.error('Error adding expense:', error)
      alert('지출 등록 중 오류가 발생했습니다.')
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
      alert(`이미지 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
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
    if (!confirm('이 지출을 삭제하시겠습니까?')) return

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
      alert('지출 삭제 중 오류가 발생했습니다.')
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
      case 'approved': return '승인됨'
      case 'rejected': return '거부됨'
      default: return '대기중'
    }
  }

  useEffect(() => {
    loadExpenses()
    loadCategories()
    loadVendors()
  }, [tourId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">지출 관리</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          <span>지출 추가</span>
        </button>
      </div>

      {/* 지출 목록 */}
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">로딩 중...</p>
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="font-medium text-gray-900">{expense.paid_to}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(expense.amount)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center space-x-2">
                      <FileText size={14} />
                      <span>{expense.paid_for}</span>
                    </div>
                    {expense.payment_method && (
                      <div className="flex items-center space-x-2">
                        <CreditCard size={14} />
                        <span>{expense.payment_method}</span>
                      </div>
                    )}
                    {expense.note && (
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">메모:</span>
                        <span>{expense.note}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <Calendar size={14} />
                      <span>{new Date(expense.submit_on).toLocaleString('ko-KR')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {expense.image_url && (
                    <button
                      onClick={() => window.open(expense.image_url!, '_blank')}
                      className="p-2 text-gray-600 hover:text-blue-600"
                      title="영수증 보기"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                  
                  {expense.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(expense.id, 'approved')}
                        className="p-2 text-green-600 hover:text-green-800"
                        title="승인"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(expense.id, 'rejected')}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="거부"
                      >
                        <X size={16} />
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="p-2 text-gray-600 hover:text-red-600"
                    title="삭제"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <DollarSign size={48} className="mx-auto mb-4 text-gray-300" />
          <p>등록된 지출이 없습니다.</p>
        </div>
      )}

      {/* 지출 추가 폼 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">지출 추가</h3>
            
            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* 결제처와 결제내용을 같은 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    결제처
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
                      <option value="">선택하세요</option>
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
                      {showCustomPaidTo ? '기존 목록에서 선택' : '직접 입력'}
                    </button>
                    {showCustomPaidTo && (
                      <input
                        type="text"
                        value={formData.custom_paid_to}
                        onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_to: e.target.value }))}
                        placeholder="새로운 결제처 입력"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    결제내용 <span className="text-red-500">*</span>
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
                      <option value="">선택하세요</option>
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
                      {showCustomPaidFor ? '기존 목록에서 선택' : '직접 입력'}
                    </button>
                    {showCustomPaidFor && (
                      <input
                        type="text"
                        value={formData.custom_paid_for}
                        onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_for: e.target.value }))}
                        placeholder="새로운 결제내용 입력"
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
                    금액 (USD) <span className="text-red-500">*</span>
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
                    <option value="">선택하세요</option>
                    <option value="cash">현금</option>
                    <option value="credit_card">신용카드</option>
                    <option value="debit_card">체크카드</option>
                    <option value="mobile_payment">모바일 결제</option>
                    <option value="other">기타</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  메모
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="추가 정보나 메모"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 영수증 이미지 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  영수증 사진
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
                        alt="영수증"
                        className="mx-auto max-h-32 rounded"
                      />
                      <p className="text-sm text-green-600">영수증이 업로드되었습니다</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">
                        영수증을 드래그하여 놓거나 클릭하여 선택하세요
                      </p>
                      <p className="text-xs text-gray-500">📷 모바일에서 카메라 촬영 가능 | JPG, PNG, WebP 형식, 최대 5MB</p>
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
                    📷 촬영 또는 파일 선택
                  </button>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
