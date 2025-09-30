'use client'

import { useState, useEffect, useRef } from 'react'
import { createClientSupabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { X, Receipt, Calendar, MapPin, Users, User, Car, CheckCircle, AlertCircle, Edit, Clock, Upload, Camera } from 'lucide-react'

type Tour = Database['public']['Tables']['tours']['Row']
type ExtendedTour = Tour & {
  product_name?: string | null;
  product_name_en?: string | null;
  assigned_people?: number;
  guide_name?: string | null;
  assistant_name?: string | null;
  vehicle_number?: string | null;
}

interface TourReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  locale: string
}

export default function TourReceiptModal({ isOpen, onClose, locale }: TourReceiptModalProps) {
  const supabase = createClientSupabase()
  const { user, userRole, simulatedUser, isSimulating } = useAuth()
  
  // 번역 함수
  const getText = (ko: string, en: string) => locale === 'en' ? en : ko
  
  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email
  
  const [tours, setTours] = useState<ExtendedTour[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showReceiptForm, setShowReceiptForm] = useState(false)
  const [currentEditingTour, setCurrentEditingTour] = useState<ExtendedTour | null>(null)
  
  // 영수증 폼 데이터
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
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  const [showCustomPaidFor, setShowCustomPaidFor] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadTours()
      loadCategories()
      loadVendors()
    }
  }, [isOpen, currentUserEmail])

  const loadTours = async () => {
    try {
      setLoading(true)
      
      if (!currentUserEmail) return

      // 최근 30일간의 투어 데이터 가져오기
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]

      // 1단계: 투어 기본 정보 가져오기
      const { data: toursData, error } = await supabase
        .from('tours')
        .select('*')
        .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
        .gte('tour_date', thirtyDaysAgoStr)
        .order('tour_date', { ascending: false })
        .limit(50)

      if (error) {
        console.error('투어 데이터 로드 오류:', error)
        return
      }

      if (!toursData || toursData.length === 0) {
        setTours([])
        return
      }

      // 2단계: 상품 정보 가져오기
      const productIds = [...new Set(toursData.map(tour => tour.product_id).filter(Boolean))]
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, name_en')
        .in('id', productIds)

      const productMap = new Map(
        (productsData || []).map(product => [product.id, product])
      )

      // 3단계: 가이드와 어시스턴트 정보 가져오기
      const guideEmails = [...new Set(toursData.map(tour => tour.tour_guide_id).filter(Boolean))]
      const assistantEmails = [...new Set(toursData.map(tour => tour.assistant_id).filter(Boolean))]
      const allEmails = [...new Set([...guideEmails, ...assistantEmails])]

      const { data: teamMembers } = await supabase
        .from('team')
        .select('email, name_ko')
        .in('email', allEmails)

      const teamMap = new Map(
        (teamMembers || []).map(member => [member.email, member.name_ko])
      )

      // 4단계: 예약 정보 가져오기 (assigned_people 계산용)
      const reservationIds = [...new Set(toursData.flatMap(tour => {
        if (tour.reservation_ids) {
          return Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
        }
        return []
      }))]

      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('id, number_of_people')
        .in('id', reservationIds)

      const reservationMap = new Map(
        (reservationsData || []).map(reservation => [reservation.id, reservation.number_of_people || 0])
      )

      // 5단계: 차량 정보 가져오기
      const vehicleIds = [...new Set(toursData.map(tour => tour.tour_car_id).filter(Boolean))]
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id, vehicle_number')
        .in('id', vehicleIds)

      const vehicleMap = new Map(
        (vehiclesData || []).map(vehicle => [vehicle.id, vehicle.vehicle_number])
      )

      // 데이터 변환
      const transformedTours = toursData.map(tour => {
        const product = productMap.get(tour.product_id)
        
        // assigned_people 계산
        let assignedPeople = 0
        if (tour.reservation_ids) {
          const ids = Array.isArray(tour.reservation_ids) 
            ? tour.reservation_ids 
            : String(tour.reservation_ids).split(',').map(id => id.trim()).filter(id => id)
          
          assignedPeople = ids.reduce((sum, id) => sum + (reservationMap.get(id) || 0), 0)
        }

        return {
          ...tour,
          product_name: product?.name || null,
          product_name_en: product?.name_en || null,
          assigned_people: assignedPeople,
          guide_name: tour.tour_guide_id ? teamMap.get(tour.tour_guide_id) || null : null,
          assistant_name: tour.assistant_id ? teamMap.get(tour.assistant_id) || null : null,
          vehicle_number: tour.tour_car_id ? vehicleMap.get(tour.tour_car_id) || null : null
        }
      })

      setTours(transformedTours)
    } catch (error) {
      console.error('투어 데이터 로드 오류:', error)
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

  const filteredTours = tours.filter(tour => {
    const matchesSearch = !searchTerm || 
      (tour.product_name && tour.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tour.product_name_en && tour.product_name_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (tour.product_id && tour.product_id.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesDate = !dateFilter || tour.tour_date === dateFilter
    
    const today = new Date().toISOString().split('T')[0]
    const isPastOrToday = tour.tour_date <= today
    
    return matchesSearch && matchesDate && isPastOrToday
  })

  const handleCreateReceipt = (tour: ExtendedTour) => {
    setCurrentEditingTour(tour)
    setShowReceiptForm(true)
  }

  const handleReceiptFormSuccess = () => {
    setCurrentEditingTour(null)
    setShowReceiptForm(false)
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
    setShowCustomPaidTo(false)
    setShowCustomPaidFor(false)
    loadTours()
  }

  const handleReceiptFormCancel = () => {
    setCurrentEditingTour(null)
    setShowReceiptForm(false)
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
    setShowCustomPaidTo(false)
    setShowCustomPaidFor(false)
  }

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `receipts/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('tour-files')
        .upload(filePath, file)

      if (uploadError) {
        console.error('파일 업로드 오류:', uploadError)
        alert(getText('파일 업로드 중 오류가 발생했습니다.', 'An error occurred while uploading the file.'))
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('tour-files')
        .getPublicUrl(filePath)

      setFormData(prev => ({
        ...prev,
        image_url: publicUrl,
        file_path: filePath
      }))
    } catch (error) {
      console.error('파일 업로드 오류:', error)
      alert(getText('파일 업로드 중 오류가 발생했습니다.', 'An error occurred while uploading the file.'))
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 실제 사용할 값 결정 (커스텀 입력이 있으면 그것을 사용, 없으면 선택된 값 사용)
    const finalPaidTo = showCustomPaidTo && formData.custom_paid_to 
      ? formData.custom_paid_to 
      : formData.paid_to
    const finalPaidFor = showCustomPaidFor && formData.custom_paid_for 
      ? formData.custom_paid_for 
      : formData.paid_for
    
    if (!currentEditingTour || !finalPaidTo || !finalPaidFor || !formData.amount) {
      alert(getText('필수 항목을 입력해주세요.', 'Please fill in required fields.'))
      return
    }

    try {
      const { error } = await supabase
        .from('tour_expenses')
        .insert({
          tour_id: currentEditingTour.id,
          paid_to: finalPaidTo,
          paid_for: finalPaidFor,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || 'cash',
          note: formData.note,
          image_url: formData.image_url,
          file_path: formData.file_path,
          submitted_by: currentUserEmail
        })

      if (error) {
        console.error('영수증 등록 오류:', error)
        alert(getText('영수증 등록 중 오류가 발생했습니다.', 'An error occurred while registering the receipt.'))
        return
      }

      alert(getText('영수증이 성공적으로 등록되었습니다.', 'Receipt has been successfully registered.'))
      handleReceiptFormSuccess()
    } catch (error) {
      console.error('영수증 등록 오류:', error)
      alert(getText('영수증 등록 중 오류가 발생했습니다.', 'An error occurred while registering the receipt.'))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <Receipt className="w-6 h-6 mr-2 text-green-500" />
            {getText('영수증 첨부', 'Receipt Upload')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {!showReceiptForm ? (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={getText('투어명으로 검색...', 'Search by tour name...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div className="w-40">
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <span className="ml-2 text-gray-600">{getText('투어 목록을 불러오는 중...', 'Loading tours...')}</span>
                </div>
              ) : filteredTours.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{getText('선택 가능한 투어가 없습니다', 'No tours available')}</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredTours.map((tour) => (
                    <div
                      key={tour.id}
                      onClick={() => handleCreateReceipt(tour)}
                      className="border border-green-300 bg-green-50 rounded-lg p-4 hover:opacity-80 cursor-pointer transition-all"
                    >
                      <div className="space-y-2">
                        {/* 상단: 투어 이름 */}
                        <h4 className="font-semibold text-gray-900 text-base">
                          {locale === 'en' ? (tour.product_name_en || tour.product_name || tour.product_id) : (tour.product_name || tour.product_id)}
                        </h4>
                        
                        {/* 중단: 날짜, 인원, 상태 */}
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(tour.tour_date).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR')}
                          </div>
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            {tour.assigned_people}
                          </div>
                          <div className="flex items-center">
                            <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                            <span className="text-green-600 font-medium">{getText('완료', 'Completed')}</span>
                          </div>
                        </div>

                        {/* 하단: 가이드, 어시스턴트, 차량 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 text-sm text-gray-600">
                            <span className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {tour.guide_name || getText('미배정', 'Unassigned')}
                            </span>
                            <span className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {tour.assistant_name || getText('미배정', 'Unassigned')}
                            </span>
                            {tour.vehicle_number && (
                              <span className="flex items-center">
                                <Car className="w-4 h-4 mr-1" />
                                {tour.vehicle_number}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {getText('영수증 첨부', 'Receipt Upload')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {/* 영수증 등록 폼 */}
            <div className="space-y-6">
              {/* 투어 정보 */}
              {currentEditingTour && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">
                    {getText('리포트 작성', 'Report Creation')} : {locale === 'en' ? (currentEditingTour.product_name_en || currentEditingTour.product_name || currentEditingTour.product_id) : (currentEditingTour.product_name || currentEditingTour.product_id)} {currentEditingTour.tour_date} ({new Date(currentEditingTour.tour_date).toLocaleDateString(locale === 'en' ? 'en-US' : 'ko-KR', { weekday: 'short' })}) {currentEditingTour.assigned_people}
                  </h4>
                </div>
              )}

              <form onSubmit={handleSubmitReceipt} className="space-y-4">
                {/* 결제처와 결제내용을 같은 줄에 배치 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('결제처', 'Paid To')} *
                    </label>
                    <div className="space-y-2">
                      <select
                        value={formData.paid_to}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, paid_to: e.target.value }))
                          setShowCustomPaidTo(false)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">{getText('선택하세요', 'Please select')}</option>
                        {vendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.name}>
                            {vendor.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCustomPaidTo(!showCustomPaidTo)}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        {showCustomPaidTo ? getText('기존에서 선택', 'Select from existing') : getText('직접 입력', 'Enter directly')}
                      </button>
                      {showCustomPaidTo && (
                        <input
                          type="text"
                          value={formData.custom_paid_to}
                          onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_to: e.target.value }))}
                          placeholder={getText('새로운 결제처를 입력하세요', 'Enter new payment recipient')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('결제내용', 'Paid For')} *
                    </label>
                    <div className="space-y-2">
                      <select
                        value={formData.paid_for}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, paid_for: e.target.value }))
                          setShowCustomPaidFor(false)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        required
                      >
                        <option value="">{getText('선택하세요', 'Please select')}</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowCustomPaidFor(!showCustomPaidFor)}
                        className="text-sm text-green-600 hover:text-green-800"
                      >
                        {showCustomPaidFor ? getText('기존에서 선택', 'Select from existing') : getText('직접 입력', 'Enter directly')}
                      </button>
                      {showCustomPaidFor && (
                        <input
                          type="text"
                          value={formData.custom_paid_for}
                          onChange={(e) => setFormData(prev => ({ ...prev, custom_paid_for: e.target.value }))}
                          placeholder={getText('새로운 결제내용을 입력하세요', 'Enter new payment purpose')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* 금액과 결제방법을 같은 줄에 배치 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('금액', 'Amount')} *
                    </label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getText('결제방법', 'Payment Method')}
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="cash">{getText('현금', 'Cash')}</option>
                      <option value="credit_card">{getText('신용카드', 'Credit Card')}</option>
                      <option value="debit_card">{getText('체크카드', 'Debit Card')}</option>
                      <option value="mobile_payment">{getText('모바일결제', 'Mobile Payment')}</option>
                      <option value="other">{getText('기타', 'Other')}</option>
                    </select>
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('메모', 'Memo')}
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder={getText('추가 정보나 메모를 입력하세요', 'Enter additional information or memo')}
                  />
                </div>

                {/* 영수증 사진 업로드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getText('영수증 사진', 'Receipt Photo')}
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragOver ? 'border-green-500 bg-green-50' : 'border-gray-300'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                  >
                    {formData.image_url ? (
                      <div className="space-y-2">
                        <img
                          src={formData.image_url}
                          alt="Receipt"
                          className="max-w-full max-h-48 mx-auto rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, image_url: '', file_path: '' }))}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          {getText('사진 제거', 'Remove Photo')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-gray-400" />
                        <p className="text-sm text-gray-600">
                          {getText('영수증을 드래그하거나 클릭하여 선택하세요', 'Drag and drop receipt or click to select')}
                        </p>
                        <p className="text-xs text-gray-500">
                          📷 {getText('모바일에서 카메라 촬영 가능 | JPG, PNG, WebP 형식, 최대 5MB', 'Camera shooting available on mobile | JPG, PNG, WebP format, max 5MB')}
                        </p>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          📷 {getText('카메라 또는 파일 선택', 'Camera or File Selection')}
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {uploading ? getText('등록 중...', 'Registering...') : getText('등록', 'Register')}
                  </button>
                  <button
                    type="button"
                    onClick={handleReceiptFormCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    {getText('취소', 'Cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
