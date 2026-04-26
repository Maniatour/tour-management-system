'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Plus, Upload, X, Check, Eye, DollarSign, ChevronDown, ChevronRight, Edit, Trash2, Settings, Receipt, Image as ImageIcon, Folder, Ticket, Fuel, MoreHorizontal, UtensilsCrossed, Building2, Wrench, Car, Coins, MapPin, Bed, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import OptionManagementModal from './expense/OptionManagementModal'
import { PaymentMethodAutocomplete } from '@/components/expense/PaymentMethodAutocomplete'
import { usePaymentMethodOptions } from '@/hooks/usePaymentMethodOptions'
import GoogleDriveReceiptImporter from './GoogleDriveReceiptImporter'
import {
  hotelAmountForSettlement,
  isHotelBookingIncludedInSettlement,
  isTicketBookingIncludedInSettlement,
  ticketExpenseForSettlement
} from '@/lib/bookingSettlement'
import { isTourCancelled } from '@/utils/tourStatusUtils'

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

type ReceiptOcrCandidates = {
  paid_to: string
  amount: number | null
  date: string | null
  payment_method_text: string
  card_last4: string
  paid_for: string
}

type ReceiptOcrResult = {
  text: string
  candidates: ReceiptOcrCandidates
}

interface ReservationPricing {
  id: string
  reservation_id: string
  total_price: number
  adult_product_price: number
  child_product_price: number
  infant_product_price: number
  commission_amount?: number
  commission_percent?: number
  coupon_discount?: number
  additional_discount?: number
  additional_cost?: number
  product_price_total?: number
  option_total?: number
  subtotal?: number
  card_fee?: number
  prepayment_tip?: number
  choices_total?: number
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
  userRole?: string // 사용자 역할 (admin, manager, team_member 등)
  allowReceiptOnlyUpload?: boolean
  onExpenseUpdated?: () => void
  /** 팀 구성 & 차량 배정에서 설정한 수수료 (전달 시 총 지출에 반영, 부모 tour 업데이트 시 즉시 반영) */
  tourGuideFee?: number | null
  tourAssistantFee?: number | null
  /** 부모의 최신 투어 상태 (취소 여부 정산 반영·DB 재로드용; 없으면 loadTourData 결과만 사용) */
  tourStatus?: string | null
}

export default function TourExpenseManager({ 
  tourId, 
  tourDate, 
  productId, 
  submittedBy, 
  reservationIds,
  userRole = 'team_member',
  allowReceiptOnlyUpload = false,
  onExpenseUpdated,
  tourGuideFee,
  tourAssistantFee,
  tourStatus
}: TourExpenseManagerProps) {
  const t = useTranslations('tours.tourExpense')
  const { paymentMethodOptions, paymentMethodMap } = usePaymentMethodOptions()
  const [expenses, setExpenses] = useState<TourExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [vendors, setVendors] = useState<ExpenseVendor[]>([])
  const [paidToOptions, setPaidToOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Record<string, string>>({})
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [reservationPricing, setReservationPricing] = useState<ReservationPricing[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState<TourExpense | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showCustomPaidTo, setShowCustomPaidTo] = useState(false)
  const [showCustomPaidFor, setShowCustomPaidFor] = useState(false)
  const [showOptionManagement, setShowOptionManagement] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [paymentMethodTab, setPaymentMethodTab] = useState<'own' | 'other'>('own')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const receiptOnlyInputRef = useRef<HTMLInputElement>(null)
  const [viewingReceipt, setViewingReceipt] = useState<{ imageUrl: string; expenseId: string; paidFor: string } | null>(null)
  const [ocrReview, setOcrReview] = useState<{
    expense: TourExpense
    result: ReceiptOcrResult
    draft: {
      paid_to: string
      paid_for: string
      amount: string
      payment_method: string
      date: string
      note: string
    }
  } | null>(null)
  const [ocrLoadingExpenseId, setOcrLoadingExpenseId] = useState<string | null>(null)
  const [showDriveImporter, setShowDriveImporter] = useState(false)
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  
  // 투어 데이터 및 수수료 관련 상태
  const [tourData, setTourData] = useState<any>(null)
  const [guideFee, setGuideFee] = useState<number>(0)
  const [assistantFee, setAssistantFee] = useState<number>(0)
  const [isLoadingTourData, setIsLoadingTourData] = useState(false)
  
  // 부킹 데이터 관련 상태
  const [ticketBookings, setTicketBookings] = useState<any[]>([])
  const [hotelBookings, setHotelBookings] = useState<any[]>([])
  const [isLoadingBookings, setIsLoadingBookings] = useState(false)
  
  // 예약별 지출 데이터 상태
  const [reservationExpenses, setReservationExpenses] = useState<Record<string, number>>({})
  const [reservationChannels, setReservationChannels] = useState<Record<string, any>>({})
  const receiptOnlyPaidFor = 'Receipt Pending'

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

  const guideEmail = String(tourData?.tour_guide_id || '').trim().toLowerCase()
  const activePaymentMethodOptions = useMemo(
    () => paymentMethodOptions.filter((option) => String(option.status || 'active').toLowerCase() === 'active'),
    [paymentMethodOptions]
  )
  const guideCardPaymentMethodOptions = useMemo(
    () =>
      activePaymentMethodOptions.filter((option) => {
        const optionOwner = String(option.user_email || '').trim().toLowerCase()
        const methodType = String(option.method_type || 'card').toLowerCase()
        return !!guideEmail && optionOwner === guideEmail && methodType === 'card'
      }),
    [activePaymentMethodOptions, guideEmail]
  )
  const guideCardPaymentMethodIds = useMemo(
    () => new Set(guideCardPaymentMethodOptions.map((option) => option.id)),
    [guideCardPaymentMethodOptions]
  )
  const otherPaymentMethodOptions = useMemo(
    () => activePaymentMethodOptions.filter((option) => !guideCardPaymentMethodIds.has(option.id)),
    [activePaymentMethodOptions, guideCardPaymentMethodIds]
  )
  const visiblePaymentMethodOptions =
    paymentMethodTab === 'own' ? guideCardPaymentMethodOptions : otherPaymentMethodOptions

  const getExpensePaidForLabel = (paidFor: string) =>
    paidFor === receiptOnlyPaidFor ? t('receiptOnlyPendingPaidFor') : paidFor

  const canRunReceiptOcr = userRole === 'admin' || userRole === 'manager'

  const findPaymentMethodCandidate = (candidates: ReceiptOcrCandidates) => {
    const last4 = candidates.card_last4.trim()
    const paymentText = candidates.payment_method_text.trim().toLowerCase()

    if (last4) {
      const byLast4 = paymentMethodOptions.find((option) =>
        option.name.includes(last4) || option.method.includes(last4)
      )
      if (byLast4) return byLast4.id
    }

    if (paymentText) {
      const byText = paymentMethodOptions.find((option) =>
        option.name.toLowerCase().includes(paymentText) ||
        option.method.toLowerCase().includes(paymentText)
      )
      if (byText) return byText.id
    }

    return ''
  }

  const handlePaymentMethodTabChange = (tab: 'own' | 'other') => {
    const nextOptions = tab === 'own' ? guideCardPaymentMethodOptions : otherPaymentMethodOptions
    setPaymentMethodTab(tab)
    if (formData.payment_method && !nextOptions.some((option) => option.id === formData.payment_method)) {
      setFormData((prev) => ({ ...prev, payment_method: '' }))
    }
  }

  // 예약 데이터 로드 - reservationIds가 있으면 해당 예약들만, 없으면 빈 배열
  const loadReservations = useCallback(async () => {
    try {
      console.log('🔍 Loading reservations for tourId:', tourId, 'reservationIds:', reservationIds)
      
      let reservationsData: any[] = []
      
      if (reservationIds && reservationIds.length > 0) {
        // reservationIds가 있으면 해당 예약들만 가져오기 (배정된 예약만)
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
        // reservationIds가 없으면 빈 배열 (배정된 예약이 없음)
        console.log('📋 No reservationIds provided, loading empty array')
        reservationsData = []
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
      // reservationIds가 있으면 그것을 사용, 없으면 reservations 상태 사용
      const targetReservationIds = reservationIds && reservationIds.length > 0 
        ? reservationIds 
        : reservations.map(r => r.id)
      
      console.log('🔍 Loading reservation pricing for reservations:', targetReservationIds)
      
      if (targetReservationIds.length === 0) {
        setReservationPricing([])
        return
      }
      
      const { data, error } = await supabase
        .from('reservation_pricing')
        .select('id, reservation_id, total_price, adult_product_price, child_product_price, infant_product_price, commission_amount, commission_percent, coupon_discount, additional_discount, additional_cost, product_price_total, option_total, subtotal, card_fee, prepayment_tip, choices_total')
        .in('reservation_id', targetReservationIds)

      if (error) {
        console.error('❌ Reservation pricing error:', error)
        throw error
      }
      
      console.log('✅ Reservation pricing data:', data)
      setReservationPricing(data || [])
      
      // 예약별 채널 정보 가져오기
      const { data: reservationsData, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, channel_id')
        .in('id', targetReservationIds)
      
      if (!reservationsError && reservationsData) {
        const channelIds = reservationsData
          .map(r => r.channel_id)
          .filter(id => id !== null)
        
        if (channelIds.length > 0) {
          const { data: channelsData, error: channelsError } = await supabase
            .from('channels')
            .select('id, commission_base_price_only')
            .in('id', channelIds)
          
          if (!channelsError && channelsData) {
            const channelMap: Record<string, any> = {}
            reservationsData.forEach(reservation => {
              if (reservation.channel_id) {
                const channel = channelsData.find(c => c.id === reservation.channel_id)
                if (channel) {
                  channelMap[reservation.id] = channel
                }
              }
            })
            setReservationChannels(channelMap)
          }
        }
      }
    } catch (error) {
      console.error('❌ Error loading reservation pricing:', error)
      setReservationPricing([])
    }
  }, [reservations, reservationIds])
  
  // 예약별 지출 정보 로드
  const loadReservationExpenses = useCallback(async () => {
    try {
      const targetReservationIds = reservationIds && reservationIds.length > 0 
        ? reservationIds 
        : reservations.map(r => r.id)
      
      if (targetReservationIds.length === 0) {
        setReservationExpenses({})
        return
      }
      
      const { data, error } = await supabase
        .from('reservation_expenses')
        .select('reservation_id, amount, status')
        .in('reservation_id', targetReservationIds)
        .not('status', 'eq', 'rejected')
      
      if (error) {
        console.error('❌ Reservation expenses error:', error)
        setReservationExpenses({})
        return
      }
      
      // 예약별 지출 총합 계산
      const expensesMap: Record<string, number> = {}
      data?.forEach(expense => {
        if (!expensesMap[expense.reservation_id]) {
          expensesMap[expense.reservation_id] = 0
        }
        expensesMap[expense.reservation_id] += expense.amount || 0
      })
      
      setReservationExpenses(expensesMap)
    } catch (error) {
      console.error('❌ Error loading reservation expenses:', error)
      setReservationExpenses({})
    }
  }, [reservations, reservationIds])

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
      
      console.log('🔍 Raw expense data from database:', data?.length || 0, 'items')
      
      // file_path가 있지만 image_url이 없는 경우 공개 URL 생성
      const processedExpenses = await Promise.all((data || []).map(async (expense: TourExpense) => {
        // 원본 데이터 로그
        console.log(`📄 Expense "${expense.paid_for}" (ID: ${expense.id}):`, {
          original_image_url: expense.image_url,
          original_file_path: expense.file_path,
          has_original_url: !!(expense.image_url && expense.image_url.trim() !== '')
        })
        
        // image_url이 없고 file_path가 있는 경우
        if ((!expense.image_url || expense.image_url.trim() === '') && expense.file_path) {
          try {
            console.log(`  🔗 Generating public URL from file_path: ${expense.file_path}`)
            // Supabase Storage에서 공개 URL 생성
            const { data: urlData, error: urlError } = supabase.storage
              .from('tour-expenses')
              .getPublicUrl(expense.file_path)
            
            if (urlError) {
              console.error('  ❌ Error generating URL:', urlError)
              return expense
            }
            
            console.log(`  ✅ Generated URL: ${urlData.publicUrl}`)
            return {
              ...expense,
              image_url: urlData.publicUrl
            }
          } catch (urlError) {
            console.error('  ❌ Exception generating public URL:', urlError)
            return expense
          }
        }
        
        // 둘 다 없는 경우
        if (!expense.image_url && !expense.file_path) {
          console.log(`  ⚠️ No image_url and no file_path for expense ${expense.id}`)
        }
        
        return expense
      }))
      
      // 최종 결과 로그
      console.log('📋 Processed expenses:', processedExpenses.length)
      processedExpenses.forEach((expense, index) => {
        const hasImage = !!(expense.image_url && expense.image_url.trim() !== '')
        console.log(`  ${index + 1}. "${expense.paid_for}" - Image: ${hasImage ? '✅' : '❌'}`, {
          image_url: expense.image_url || 'NULL',
          file_path: expense.file_path || 'NULL'
        })
      })
      
      setExpenses(processedExpenses)
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

  // 벤더 목록 및 paid_to 옵션 로드
  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('expense_vendors')
        .select('*')
        .order('name')

      if (error) throw error
      setVendors(data || [])

      // Load all unique paid_to values from tour_expenses table
      const { data: paidToData, error: paidToError } = await supabase
        .from('tour_expenses')
        .select('paid_to')
        .not('paid_to', 'is', null)
        .neq('paid_to', '')

      if (paidToError) throw paidToError
      
      // Normalize function: remove spaces and convert to lowercase for comparison
      const normalize = (str: string): string => {
        return str.toLowerCase().replace(/\s+/g, '').trim()
      }
      
      // First pass: count occurrences of each original value
      const originalCounts: { [key: string]: number } = {}
      paidToData?.forEach(item => {
        if (item.paid_to) {
          originalCounts[item.paid_to] = (originalCounts[item.paid_to] || 0) + 1
        }
      })
      
      // Second pass: group by normalized value and track the most common original
      const normalizedGroups: { [normalized: string]: { original: string; totalCount: number; variants: { [original: string]: number } } } = {}
      
      Object.keys(originalCounts).forEach(original => {
        const normalized = normalize(original)
        const count = originalCounts[original]
        
        if (!normalizedGroups[normalized]) {
          normalizedGroups[normalized] = {
            original: original,
            totalCount: count,
            variants: { [original]: count }
          }
        } else {
          // Add this variant
          normalizedGroups[normalized].variants[original] = count
          normalizedGroups[normalized].totalCount += count
          
          // Update the representative original to the most common variant
          const currentRep = normalizedGroups[normalized].original
          if (count > normalizedGroups[normalized].variants[currentRep]) {
            normalizedGroups[normalized].original = original
          }
        }
      })
      
      // Convert to array and sort by total usage frequency (descending), then alphabetically for same frequency
      const uniquePaidToValues = Object.values(normalizedGroups)
        .map(group => group.original)
        .sort((a, b) => {
          const normalizedA = normalize(a)
          const normalizedB = normalize(b)
          const countA = normalizedGroups[normalizedA].totalCount
          const countB = normalizedGroups[normalizedB].totalCount
          
          const countDiff = countB - countA
          if (countDiff !== 0) {
            return countDiff // Sort by frequency first
          }
          // If same frequency, sort alphabetically
          return a.toLowerCase().localeCompare(b.toLowerCase())
        })
      
      setPaidToOptions(uniquePaidToValues)
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
    
    // 수정 모드일 때는 수정 함수 호출
    if (editingExpense) {
      await handleUpdateExpense()
      return
    }
    
    if (!formData.paid_for || !formData.amount) {
      alert(t('fillRequiredFields'))
      return
    }

    if (!formData.payment_method?.trim()) {
      alert(t('paymentMethodRequired'))
      return
    }

    // 지급 대상 유효성 검사
    const finalPaidTo = formData.custom_paid_to || formData.paid_to || null
    if (!finalPaidTo) {
      alert('지급 대상을 선택하거나 입력해주세요.')
      return
    }

    try {
      setUploading(true)
      
      // 지급 대상 값 확인
      console.log('지급 대상 값 확인:', {
        custom_paid_to: formData.custom_paid_to,
        paid_to: formData.paid_to,
        finalPaidTo: finalPaidTo,
        showCustomPaidTo: showCustomPaidTo
      })
      
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
      
      // product_id가 없으면 투어의 product_id 사용
      let finalProductId = productId
      if (!finalProductId && tourData?.product_id) {
        finalProductId = tourData.product_id
        console.log('투어의 product_id 사용:', finalProductId)
      }
      
      const { data, error } = await supabase
        .from('tour_expenses')
        .insert({
          tour_id: tourId,
          paid_to: finalPaidTo,
          paid_for: formData.custom_paid_for || formData.paid_for,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          tour_date: tourDate,
          product_id: finalProductId,
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
      setShowMoreCategories(false)
      setPaymentMethodTab('own')
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
      
      // 파일 유효성 검사
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드할 수 있습니다.')
      }
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일 크기는 5MB 이하여야 합니다.')
      }
      
      const { filePath, imageUrl } = await handleImageUpload(file)
      
      setFormData(prev => ({
        ...prev,
        file_path: filePath,
        image_url: imageUrl
      }))
    } catch (error) {
      console.error('File upload error:', error)
      alert(error instanceof Error ? error.message : t('imageUploadFailed', { error: error instanceof Error ? error.message : t('unknownError') }))
    } finally {
      setUploading(false)
    }
  }

  const handleReceiptOnlyUpload = async (files: FileList | null) => {
    if (!files?.length) return

    try {
      setUploading(true)
      const file = files[0]

      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드할 수 있습니다.')
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일 크기는 5MB 이하여야 합니다.')
      }

      const { filePath, imageUrl } = await handleImageUpload(file)
      const finalProductId = productId || tourData?.product_id || null

      const { data, error } = await supabase
        .from('tour_expenses')
        .insert({
          tour_id: tourId,
          paid_to: null,
          paid_for: receiptOnlyPaidFor,
          amount: 0,
          payment_method: null,
          note: 'Receipt uploaded first; expense details pending.',
          tour_date: tourDate,
          product_id: finalProductId,
          submitted_by: submittedBy,
          image_url: imageUrl,
          file_path: filePath,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      setExpenses(prev => [data, ...prev])
      onExpenseUpdated?.()
      alert(t('receiptOnlyUploadSuccess'))
    } catch (error) {
      console.error('Receipt-only upload error:', error)
      alert(error instanceof Error ? error.message : t('expenseRegistrationError'))
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

  // 이미지 삭제 핸들러
  const handleImageRemove = async () => {
    if (!formData.image_url || !formData.file_path) {
      // 파일이 없으면 그냥 formData만 초기화
      setFormData(prev => ({
        ...prev,
        image_url: '',
        file_path: ''
      }))
      return
    }

    try {
      // Storage에서 파일 삭제 시도 (실패해도 계속 진행)
      if (formData.file_path) {
        try {
          await supabase.storage
            .from('tour-expenses')
            .remove([formData.file_path])
        } catch (error) {
          console.warn('Storage 파일 삭제 실패 (무시):', error)
        }
      }

      // formData에서 이미지 정보 제거
      setFormData(prev => ({
        ...prev,
        image_url: '',
        file_path: ''
      }))
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
      // 오류가 발생해도 formData는 초기화
      setFormData(prev => ({
        ...prev,
        image_url: '',
        file_path: ''
      }))
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

  // 지출 수정 시작
  const handleEditExpense = (expense: TourExpense) => {
    setEditingExpense(expense)
    
    // 기존 paid_to 값이 paidToOptions 목록에 있는지 확인
    const isPaidToInOptions = paidToOptions.includes(expense.paid_to || '')
    const isPaidForInOptions = categories.some((category) => category.name === expense.paid_for)
    const isReceiptOnlyPending = expense.paid_for === receiptOnlyPaidFor
    
    console.log('지출 수정 시작:', {
      expensePaidTo: expense.paid_to,
      isPaidToInOptions: isPaidToInOptions,
      paidToOptionsCount: paidToOptions.length,
      paidToOptionsList: paidToOptions
    })
    
    setFormData({
      paid_to: isPaidToInOptions ? expense.paid_to : '',
      paid_for: isPaidForInOptions ? expense.paid_for : '',
      amount: expense.amount.toString(),
      payment_method: expense.payment_method || '',
      note: expense.note || '',
      image_url: expense.image_url || '',
      file_path: expense.file_path || '',
      custom_paid_to: isPaidToInOptions ? '' : expense.paid_to,
      custom_paid_for: !isPaidForInOptions && !isReceiptOnlyPending ? expense.paid_for : ''
    })
    setPaymentMethodTab(
      expense.payment_method && guideCardPaymentMethodIds.has(expense.payment_method) ? 'own' : 'other'
    )
    
    // 기존 값이 paidToOptions 목록에 없으면 직접 입력 모드로 전환
    setShowCustomPaidTo(!isPaidToInOptions)
    setShowCustomPaidFor(!isPaidForInOptions && !isReceiptOnlyPending)
    setShowAddForm(true)
  }

  const handleRunReceiptOcr = async (expense: TourExpense) => {
    const imageUrl = expense.image_url?.trim()
    if (!imageUrl) {
      alert(t('receiptOcrNoImage'))
      return
    }

    try {
      setOcrLoadingExpenseId(expense.id)
      const response = await fetch('/api/expenses/receipt-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || t('receiptOcrFailed'))
      }

      const ocrResult = result as ReceiptOcrResult
      const candidatePaidFor = categories.some((category) => category.name === ocrResult.candidates.paid_for)
        ? ocrResult.candidates.paid_for
        : ''
      const paymentMethodId = findPaymentMethodCandidate(ocrResult.candidates)
      const noteParts = [
        expense.note || '',
        ocrResult.candidates.date ? `${t('receiptOcrDateLabel')}: ${ocrResult.candidates.date}` : ''
      ].filter(Boolean)

      setOcrReview({
        expense,
        result: ocrResult,
        draft: {
          paid_to: ocrResult.candidates.paid_to || expense.paid_to || '',
          paid_for: candidatePaidFor,
          amount: ocrResult.candidates.amount != null
            ? ocrResult.candidates.amount.toFixed(2)
            : (expense.amount > 0 ? expense.amount.toString() : ''),
          payment_method: paymentMethodId || expense.payment_method || '',
          date: ocrResult.candidates.date || '',
          note: noteParts.join('\n')
        }
      })
    } catch (error) {
      console.error('Receipt OCR error:', error)
      alert(error instanceof Error ? error.message : t('receiptOcrFailed'))
    } finally {
      setOcrLoadingExpenseId(null)
    }
  }

  const handleApplyOcrToForm = () => {
    if (!ocrReview) return

    const { expense, draft } = ocrReview
    const isPaidToInOptions = paidToOptions.includes(draft.paid_to || '')
    const dateNote = draft.date ? `${t('receiptOcrDateLabel')}: ${draft.date}` : ''
    const finalNote = dateNote && !draft.note.includes(dateNote)
      ? [draft.note, dateNote].filter(Boolean).join('\n')
      : draft.note

    setEditingExpense(expense)
    setFormData({
      paid_to: isPaidToInOptions ? draft.paid_to : '',
      paid_for: draft.paid_for,
      amount: draft.amount,
      payment_method: draft.payment_method,
      note: finalNote,
      image_url: expense.image_url || '',
      file_path: expense.file_path || '',
      custom_paid_to: isPaidToInOptions ? '' : draft.paid_to,
      custom_paid_for: ''
    })
    setPaymentMethodTab(
      draft.payment_method && guideCardPaymentMethodIds.has(draft.payment_method) ? 'own' : 'other'
    )
    setShowCustomPaidTo(Boolean(draft.paid_to && !isPaidToInOptions))
    setShowCustomPaidFor(false)
    setShowMoreCategories(false)
    setShowAddForm(true)
    setOcrReview(null)
  }

  // 지출 수정 취소
  const handleCancelEdit = () => {
    setEditingExpense(null)
    setShowAddForm(false)
    setShowMoreCategories(false)
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
    setPaymentMethodTab('own')
  }

  // 지출 수정 저장
  const handleUpdateExpense = async () => {
    if (!editingExpense) return

    if (!formData.paid_for && !formData.custom_paid_for) {
      alert(t('fillRequiredFields'))
      return
    }

    if (!formData.amount) {
      alert(t('fillRequiredFields'))
      return
    }

    if (!formData.payment_method?.trim()) {
      alert(t('paymentMethodRequired'))
      return
    }

    try {
      // 지급 대상 값 확인
      const finalPaidTo = formData.custom_paid_to || formData.paid_to || null
      console.log('지급 대상 값 확인 (수정):', {
        custom_paid_to: formData.custom_paid_to,
        paid_to: formData.paid_to,
        finalPaidTo: finalPaidTo,
        showCustomPaidTo: showCustomPaidTo
      })

      const { error } = await supabase
        .from('tour_expenses')
        .update({
          paid_to: finalPaidTo,
          paid_for: formData.custom_paid_for || formData.paid_for,
          amount: parseFloat(formData.amount),
          payment_method: formData.payment_method || null,
          note: formData.note || null,
          image_url: formData.image_url || null,
          file_path: formData.file_path || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingExpense.id)

      if (error) throw error

      // 로컬 상태 업데이트
      setExpenses(prev => prev.map(expense => 
        expense.id === editingExpense.id 
          ? {
              ...expense,
              paid_to: finalPaidTo,
              paid_for: formData.custom_paid_for || formData.paid_for,
              amount: parseFloat(formData.amount),
              payment_method: formData.payment_method || null,
              note: formData.note || null,
            }
          : expense
      ))

      handleCancelEdit()
      onExpenseUpdated?.()
    } catch (error) {
      console.error('Error updating expense:', error)
      alert('지출 수정 중 오류가 발생했습니다.')
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

  // 부킹 데이터 로드 (ticket_bookings.expense 합, tour_hotel_bookings.total_price 합 — @/lib/bookingSettlement)
  const loadBookings = useCallback(async () => {
    if (!tourId) return
    
    setIsLoadingBookings(true)
    try {
      // 티켓 부킹 로드
      const { data: ticketsRaw, error: ticketError } = await supabase
        .from('ticket_bookings')
        .select('*')
        .eq('tour_id', tourId)

      if (ticketError) {
        console.error('티켓 부킹 로드 오류:', ticketError)
      } else {
        const tickets = (ticketsRaw || []).filter((b) => isTicketBookingIncludedInSettlement(b.status))
        setTicketBookings(tickets)
        console.log('티켓 부킹 로드됨:', tickets.length, '건 (정산 포함, 취소/크레딧 제외)')
      }

      // 호텔 부킹: tour_id로만 조회 후 취소만 제외 (status NULL·레거시 값 포함)
      const { data: hotelsRaw, error: hotelError } = await supabase
        .from('tour_hotel_bookings')
        .select('*')
        .eq('tour_id', tourId)

      if (hotelError) {
        console.error('호텔 부킹 로드 오류:', hotelError)
      } else {
        const hotels = (hotelsRaw || []).filter((b) => isHotelBookingIncludedInSettlement(b.status))
        setHotelBookings(hotels)
        console.log('호텔 부킹 로드됨:', hotels.length, '건 (정산 포함, 취소 제외)')
      }
    } catch (error) {
      console.error('부킹 데이터 로드 오류:', error)
    } finally {
      setIsLoadingBookings(false)
    }
  }, [tourId])

  // 투어 데이터 및 수수료 로드
  const loadTourData = useCallback(async () => {
    if (!tourId) return
    
    setIsLoadingTourData(true)
    try {
      // 투어 기본 정보 로드
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('id, product_id, team_type, guide_fee, assistant_fee, tour_status, tour_guide_id')
        .eq('id', tourId)
        .single()

      if (tourError) {
        console.error('투어 데이터 로드 오류:', tourError)
        return
      }

      setTourData(tour)

      if (isTourCancelled(tour.tour_status)) {
        setGuideFee(0)
        setAssistantFee(0)
        return
      }
      
      // 저장된 수수료가 있으면 사용
      if (tour.guide_fee !== null && tour.guide_fee !== undefined) {
        setGuideFee(tour.guide_fee)
        console.log('투어에서 가이드 수수료 로드됨:', tour.guide_fee)
      }
      if (tour.assistant_fee !== null && tour.assistant_fee !== undefined) {
        setAssistantFee(tour.assistant_fee)
        console.log('투어에서 어시스턴트 수수료 로드됨:', tour.assistant_fee)
      }

      // 저장된 수수료가 없으면 가이드비 관리에서 기본값 로드
      if ((tour.guide_fee === null || tour.guide_fee === undefined) && productId && tour.team_type) {
        try {
          const teamTypeMap: Record<string, string> = {
            '1guide': '1_guide',
            '2guide': '2_guides',
            'guide+driver': 'guide_driver'
          }

          const mappedTeamType = teamTypeMap[tour.team_type]
          if (mappedTeamType) {
            const response = await fetch(`/api/guide-costs?product_id=${productId}&team_type=${mappedTeamType}`)
            const data = await response.json()

            if (data.guideCost) {
              if (tour.guide_fee === null || tour.guide_fee === undefined) {
                setGuideFee(data.guideCost.guide_fee)
                console.log('가이드비 관리에서 가이드 기본 수수료 로드됨:', data.guideCost.guide_fee)
              }
              if (tour.assistant_fee === null || tour.assistant_fee === undefined) {
                setAssistantFee(data.guideCost.assistant_fee)
                console.log('가이드비 관리에서 어시스턴트 기본 수수료 로드됨:', data.guideCost.assistant_fee)
              }
            }
          }
        } catch (error) {
          console.error('가이드비 기본값 로드 오류:', error)
        }
      }
    } catch (error) {
      console.error('투어 데이터 로드 오류:', error)
    } finally {
      setIsLoadingTourData(false)
    }
  }, [tourId, productId, tourStatus])

  // 어코디언 토글
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Net Price 계산 함수
  const calculateNetPrice = (pricing: ReservationPricing, reservationId: string): number => {
    if (!pricing || !pricing.total_price) return 0
    
    const grandTotal = pricing.total_price
    const channel = reservationChannels[reservationId]
    const commissionBasePriceOnly = channel?.commission_base_price_only || false
    
    let commissionAmount = 0
    if (pricing.commission_amount && pricing.commission_amount > 0) {
      commissionAmount = pricing.commission_amount
    } else if (pricing.commission_percent && pricing.commission_percent > 0) {
      if (commissionBasePriceOnly) {
        // 판매가격에만 커미션 적용
        const productPriceTotal = pricing.product_price_total || 0
        const couponDiscount = pricing.coupon_discount || 0
        const additionalDiscount = pricing.additional_discount || 0
        const additionalCost = pricing.additional_cost || 0
        const basePriceForCommission = productPriceTotal - couponDiscount - additionalDiscount + additionalCost
        commissionAmount = basePriceForCommission * (pricing.commission_percent / 100)
      } else {
        // 전체 가격에 커미션 적용
        commissionAmount = grandTotal * (pricing.commission_percent / 100)
      }
    }
    
    return grandTotal - commissionAmount
  }
  
  // 고객 총 결제 금액 계산
  const calculateTotalCustomerPayment = (pricing: ReservationPricing): number => {
    // total_price가 고객 총 결제 금액을 포함하고 있을 수 있지만,
    // 정확한 계산을 위해 명시적으로 계산
    const productPriceTotal = pricing.product_price_total || 0
    const couponDiscount = pricing.coupon_discount || 0
    const additionalDiscount = pricing.additional_discount || 0
    const additionalCost = pricing.additional_cost || 0
    const optionTotal = pricing.option_total || 0
    const cardFee = pricing.card_fee || 0
    const prepaymentTip = pricing.prepayment_tip || 0
    
    // 고객 총 결제 금액 = (상품가격 - 할인) + 옵션 + 추가비용 + 카드수수료 + 팁 (choices_total 제외 — option_total 과 이중 방지)
    return (
      (productPriceTotal - couponDiscount - additionalDiscount) +
      optionTotal +
      additionalCost +
      cardFee +
      prepaymentTip
    )
  }
  
  // 추가 결제금 계산 (고객 총 결제 금액 - 채널 수수료$ - 채널 정산 금액)
  const calculateAdditionalPayment = (pricing: ReservationPricing, reservationId: string): number => {
    const totalCustomerPayment = calculateTotalCustomerPayment(pricing)
    const commissionAmount = pricing.commission_amount || 0
    const netPrice = calculateNetPrice(pricing, reservationId)
    
    // 추가 결제금 = 고객 총 결제 금액 - 채널 수수료$ - 채널 정산 금액 (Net Price)
    const additionalPayment = totalCustomerPayment - commissionAmount - netPrice
    return Math.max(0, additionalPayment) // 음수는 0으로 처리
  }
  
  // Operating Profit 계산 함수 (Net Price - Reservation Expenses + 추가 결제금)
  const calculateOperatingProfit = (pricing: ReservationPricing, reservationId: string): number => {
    const netPrice = calculateNetPrice(pricing, reservationId)
    const reservationExpense = reservationExpenses[reservationId] || 0
    const additionalPayment = calculateAdditionalPayment(pricing, reservationId)
    
    // Operating Profit = Net Price - Reservation Expenses + 추가 결제금
    return netPrice - reservationExpense + additionalPayment
  }

  // 통계 계산
  const calculateFinancialStats = () => {
    console.log('💰 Financial stats calculation:', {
      reservations: reservations.length,
      reservationIds: reservationIds,
      reservationPricing: reservationPricing.length,
      expenses: expenses.length,
      ticketBookings: ticketBookings.length,
      hotelBookings: hotelBookings.length,
      guideFee,
      assistantFee
    })
    
    // 총 입금액 계산 (reservationIds에 있는 예약만)
    const filteredPricing = reservationIds && reservationIds.length > 0
      ? reservationPricing.filter(p => reservationIds.includes(p.reservation_id))
      : reservationPricing
    const totalPayments = filteredPricing.reduce((sum, pricing) => sum + pricing.total_price, 0)
    
    // 총 Operating Profit 계산 (각 예약의 Operating Profit 합산)
    const totalOperatingProfit = filteredPricing.reduce((sum, pricing) => {
      return sum + calculateOperatingProfit(pricing, pricing.reservation_id)
    }, 0)
    
    // 총 지출 계산 (기존 지출 + 가이드/드라이버 수수료 + 부킹 비용)
    // 팀 구성 & 차량 배정에서 전달된 수수료가 있으면 우선 사용 (저장 후 즉시 반영)
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const statusForCancelCheck = tourStatus ?? tourData?.tour_status
    const tourFeesCancelled = isTourCancelled(statusForCancelCheck)
    const effectiveGuideFee = tourFeesCancelled
      ? 0
      : (tourGuideFee !== undefined && tourGuideFee !== null ? tourGuideFee : guideFee)
    const effectiveAssistantFee = tourFeesCancelled
      ? 0
      : (tourAssistantFee !== undefined && tourAssistantFee !== null ? tourAssistantFee : assistantFee)
    const totalFees = effectiveGuideFee + effectiveAssistantFee
    
    // 부킹 비용 계산
    const totalTicketCosts = ticketBookings.reduce(
      (sum, booking) => sum + ticketExpenseForSettlement(booking),
      0
    )
    const totalHotelCosts = hotelBookings.reduce(
      (sum, booking) => sum + hotelAmountForSettlement(booking),
      0
    )
    const totalBookingCosts = totalTicketCosts + totalHotelCosts
    
    const totalExpensesWithFeesAndBookings = totalExpenses + totalFees + totalBookingCosts
    
    // 수익 계산 (Operating Profit 총합 - 투어 지출 - 수수료 - 부킹 비용)
    const profit = totalOperatingProfit - totalExpensesWithFeesAndBookings
    
    console.log('💰 Calculated stats:', {
      totalPayments,
      totalOperatingProfit,
      totalExpenses,
      totalFees,
      totalTicketCosts,
      totalHotelCosts,
      totalBookingCosts,
      totalExpensesWithFeesAndBookings,
      profit,
      effectiveGuideFee,
      effectiveAssistantFee
    })
    
    return {
      totalPayments,
      totalOperatingProfit,
      totalExpenses,
      totalFees,
      totalTicketCosts,
      totalHotelCosts,
      totalBookingCosts,
      totalExpensesWithFeesAndBookings,
      profit,
      effectiveGuideFee,
      effectiveAssistantFee
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
    loadTourData() // 투어 데이터 및 수수료 로드
    loadBookings() // 부킹 데이터 로드
  }, [tourId, tourStatus, loadExpenses, loadReservations, loadTourData, loadBookings])

  useEffect(() => {
    if (reservations.length > 0) {
      loadReservationPricing()
      loadReservationExpenses()
    }
  }, [reservations, loadReservationPricing, loadReservationExpenses])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        <div className="flex items-center space-x-2">
          {allowReceiptOnlyUpload && (
            <>
              <input
                ref={receiptOnlyInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void handleReceiptOnlyUpload(e.target.files)
                  e.target.value = ''
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => receiptOnlyInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center w-10 h-10 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('receiptOnlyUpload')}
              >
                <Receipt size={20} />
              </button>
            </>
          )}
          <button
            onClick={() => setShowOptionManagement(true)}
            className="flex items-center justify-center w-10 h-10 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            title="선택지 관리"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={() => {
              setPaymentMethodTab('own')
              setShowAddForm(true)
            }}
            className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            title={t('addExpense')}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* 정산 통계 섹션 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">{t('settlementStats')}</h4>
        
        {/* Operating Profit 총합 - 어드민만 표시 */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('payments')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium text-gray-900">Operating Profit 총합</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(financialStats.totalOperatingProfit)}
              </span>
            </div>
            {expandedSections.payments ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          
          {expandedSections.payments && (
            <div className="border-t p-4 bg-gray-50">
              <div className="mb-2 text-xs text-gray-500">
                📋 표시된 예약: {reservations.filter(r => reservationIds?.includes(r.id)).length}팀 (배정된 예약만)
              </div>
              <div className="space-y-2">
                {reservations
                  .filter(reservation => reservationIds?.includes(reservation.id))
                  .map((reservation) => {
                    const pricing = reservationPricing.find(p => p.reservation_id === reservation.id)
                    const totalPeople = reservation.adults + reservation.children + reservation.infants
                    const operatingProfit = pricing ? calculateOperatingProfit(pricing, reservation.id) : 0
                    console.log('💰 Operating Profit display:', {
                      reservationId: reservation.id,
                      customerName: reservation.customer_name,
                      totalPeople,
                      operatingProfit
                    })
                    return (
                      <div key={reservation.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{reservation.customer_name}</span>
                          <span className="text-gray-500">({totalPeople}명)</span>
                        </div>
                        <span className="font-medium text-green-600">
                          {formatCurrency(operatingProfit)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
          </div>
        )}

        {/* 지출 총합 */}
        <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('expenses')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="font-medium text-gray-900">{t('totalExpenses')}</span>
              <span className="text-lg font-bold text-red-600">
                {formatCurrency(financialStats.totalExpensesWithFeesAndBookings)}
              </span>
            </div>
            {expandedSections.expenses ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          
          {expandedSections.expenses && (
            <div className="border-t p-4 bg-gray-50">
              <div className="space-y-3">
                {/* 가이드/드라이버 수수료 */}
                {(financialStats.effectiveGuideFee > 0 || financialStats.effectiveAssistantFee > 0) && (
                  <div className="bg-white rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{t('guideDriverFee')}</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(financialStats.totalFees)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {financialStats.effectiveGuideFee > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('guideFee')}</span>
                          <span>{formatCurrency(financialStats.effectiveGuideFee)}</span>
                        </div>
                      )}
                      {financialStats.effectiveAssistantFee > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('assistantDriverFee')}</span>
                          <span>{formatCurrency(financialStats.effectiveAssistantFee)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 부킹 비용 */}
                {(financialStats.totalBookingCosts > 0) && (
                  <div className="bg-white rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{t('bookingCost')}</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(financialStats.totalBookingCosts)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {financialStats.totalTicketCosts > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('ticketBooking')}</span>
                          <span>{formatCurrency(financialStats.totalTicketCosts)}</span>
                        </div>
                      )}
                      {financialStats.totalHotelCosts > 0 && (
                        <div className="flex items-center justify-between">
                          <span>{t('hotelBooking')}</span>
                          <span>{formatCurrency(financialStats.totalHotelCosts)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 기존 지출 카테고리들 */}
                {Object.entries(expenseBreakdown).map(([category, data]) => (
                  <div key={category} className="bg-white rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{getExpensePaidForLabel(category)}</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(data.amount)} ({data.count} {t('items')})
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      {data.expenses.map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between">
                          <span>{expense.paid_to} - {expense.note || t('noMemo')}</span>
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

        {/* 수익 - 어드민만 표시 */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('profit')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${financialStats.profit >= 0 ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
              <span className="font-medium text-gray-900">{t('profit')}</span>
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
                  <span>Operating Profit 총합</span>
                  <span className="text-green-600 font-medium">{formatCurrency(financialStats.totalOperatingProfit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('totalExpensesWithFeesAndBookings')}</span>
                  <span className="text-red-600">{formatCurrency(financialStats.totalExpensesWithFeesAndBookings)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex items-center justify-between font-bold">
                  <span>{t('profit')}</span>
                  <span className={financialStats.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}>
                    {formatCurrency(financialStats.profit)}
                  </span>
                </div>
              </div>
            </div>
          )}
          </div>
        )}

        {/* 추가비용 합산 - 어드민만 표시 */}
        {userRole === 'admin' && (
          <div className="bg-white rounded-lg border">
          <button
            onClick={() => toggleSection('additionalCosts')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="font-medium text-gray-900">추가비용 합산</span>
              <span className="text-lg font-bold text-purple-600">
                {formatCurrency((() => {
                  const filteredPricing = reservationIds && reservationIds.length > 0
                    ? reservationPricing.filter(p => reservationIds.includes(p.reservation_id))
                    : reservationPricing
                  const totalAdditionalCost = filteredPricing.reduce((sum, pricing) => {
                    const additionalCost = pricing.additional_cost || 0
                    // $100 단위로 내림
                    return sum + Math.floor(additionalCost / 100) * 100
                  }, 0)
                  return totalAdditionalCost
                })())}
              </span>
            </div>
            {expandedSections.additionalCosts ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          
          {expandedSections.additionalCosts && (
            <div className="border-t p-4 bg-gray-50">
              <div className="mb-2 text-xs text-gray-500">
                📋 표시된 예약: {reservationIds && reservationIds.length > 0 
                  ? reservations.filter(r => reservationIds.includes(r.id)).length 
                  : 0}팀 (배정된 예약만)
              </div>
              <div className="space-y-2">
                {reservationIds && reservationIds.length > 0 ? (
                  reservations
                    .filter(reservation => reservationIds.includes(reservation.id))
                    .map((reservation) => {
                      const pricing = reservationPricing.find(p => p.reservation_id === reservation.id)
                      const totalPeople = reservation.adults + reservation.children + reservation.infants
                      const additionalCost = pricing?.additional_cost || 0
                      // $100 단위로 내림
                      const roundedAdditionalCost = Math.floor(additionalCost / 100) * 100
                      console.log('💰 Additional Cost display:', {
                        reservationId: reservation.id,
                        customerName: reservation.customer_name,
                        totalPeople,
                        additionalCost,
                        roundedAdditionalCost
                      })
                      return (
                        <div key={reservation.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{reservation.customer_name}</span>
                            <span className="text-gray-500">({totalPeople}명)</span>
                          </div>
                          <span className="font-medium text-purple-600">
                            {formatCurrency(roundedAdditionalCost)}
                          </span>
                        </div>
                      )
                    })
                ) : (
                  <div className="text-sm text-gray-500">배정된 예약이 없습니다.</div>
                )}
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* 구글 드라이브 영수증 가져오기 - 가이드(team_member)는 숨김 */}
      {userRole !== 'team_member' && (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setShowDriveImporter(!showDriveImporter)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Folder className="w-4 h-4" />
              <span>구글 드라이브에서 영수증 가져오기</span>
            </button>
          </div>

          {showDriveImporter && (
            <div className="mb-4">
              <GoogleDriveReceiptImporter
                onImportComplete={() => {
                  setShowDriveImporter(false)
                  loadExpenses() // 지출 목록 새로고침
                }}
              />
            </div>
          )}
        </>
      )}

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
              {/* 상단: 지출명, 금액, 상태 뱃지, 수정/삭제/승인/거부 버튼 (오른쪽 끝 정렬) */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900">{getExpensePaidForLabel(expense.paid_for)}</span>
                  <span className="text-sm font-bold text-green-600">
                    ${expense.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(expense.status)}`}>
                    {getStatusText(expense.status)}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  {/* 승인/거부 버튼 - pending 상태일 때만 표시 */}
                  {expense.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(expense.id, 'approved')}
                        className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                        title="승인"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(expense.id, 'rejected')}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        title="거부"
                      >
                        <X size={14} />
                      </button>
                    </>
                  )}
                  
                  {/* 수정 버튼 */}
                  <button
                    onClick={() => handleEditExpense(expense)}
                    className="p-1 text-gray-600 hover:text-blue-600"
                    title="수정"
                  >
                    <Edit size={14} />
                  </button>
                  
                  {/* 삭제 버튼 */}
                  <button
                    onClick={() => handleDeleteExpense(expense.id)}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              {/* 하단: 결제처, 제출자, 제출일, 결제방법 */}
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center space-x-2">
                  {expense.paid_to && (
                    <>
                      <span>{expense.paid_to}</span>
                      <span>•</span>
                    </>
                  )}
                  <span>{teamMembers[expense.submitted_by] || expense.submitted_by}</span>
                  <span>•</span>
                  <span>{new Date(expense.submit_on).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {expense.payment_method && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {paymentMethodMap[expense.payment_method] || expense.payment_method}
                    </span>
                  )}
                  
                  {/* 액션 버튼들 (영수증 보기) */}
                  <div className="flex items-center space-x-1">
                    {canRunReceiptOcr && expense.image_url && expense.image_url.trim() !== '' && (
                      <button
                        onClick={() => void handleRunReceiptOcr(expense)}
                        disabled={ocrLoadingExpenseId === expense.id}
                        className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('receiptOcrAction')}
                      >
                        <span className="text-[10px] font-bold">
                          {ocrLoadingExpenseId === expense.id ? '...' : 'OCR'}
                        </span>
                      </button>
                    )}
                    {expense.image_url && expense.image_url.trim() !== '' ? (
                      <button
                        onClick={() => {
                          console.log('📸 Opening receipt:', {
                            expenseId: expense.id,
                            imageUrl: expense.image_url,
                            paidFor: getExpensePaidForLabel(expense.paid_for)
                          })
                          setViewingReceipt({ 
                            imageUrl: expense.image_url!, 
                            expenseId: expense.id,
                            paidFor: getExpensePaidForLabel(expense.paid_for)
                          })
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                        title="영수증 보기"
                      >
                        <Receipt size={14} />
                      </button>
                    ) : (
                      <span 
                        className="text-gray-400 cursor-help" 
                        title={`영수증 없음 - 이미지 URL: ${expense.image_url || 'null'}, 파일 경로: ${expense.file_path || 'null'}`}
                      >
                        <Receipt size={14} />
                      </span>
                    )}
                  </div>
                </div>
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

      {/* 영수증 보기 모달 */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  영수증: {viewingReceipt.paidFor}
                </h3>
              </div>
              <button
                onClick={() => setViewingReceipt(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="flex flex-col items-center">
                <img
                  src={viewingReceipt.imageUrl}
                  alt={`${viewingReceipt.paidFor} 영수증`}
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-receipt.png'
                    target.alt = '영수증 이미지를 불러올 수 없습니다'
                  }}
                />
                <div className="mt-4 flex gap-2">
                  <a
                    href={viewingReceipt.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    새 창에서 열기
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OCR 추출 확인 모달 */}
      {ocrReview && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('receiptOcrReviewTitle')}</h3>
                <p className="text-sm text-gray-500">{t('receiptOcrReviewDescription')}</p>
              </div>
              <button
                type="button"
                onClick={() => setOcrReview(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paidTo')}</label>
                  <input
                    type="text"
                    value={ocrReview.draft.paid_to}
                    onChange={(e) =>
                      setOcrReview((prev) =>
                        prev ? { ...prev, draft: { ...prev.draft, paid_to: e.target.value } } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('amount')} (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ocrReview.draft.amount}
                    onChange={(e) =>
                      setOcrReview((prev) =>
                        prev ? { ...prev, draft: { ...prev.draft, amount: e.target.value } } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paidFor')}</label>
                  <select
                    value={ocrReview.draft.paid_for}
                    onChange={(e) =>
                      setOcrReview((prev) =>
                        prev ? { ...prev, draft: { ...prev.draft, paid_for: e.target.value } } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('paymentMethod')}</label>
                  <select
                    value={ocrReview.draft.payment_method}
                    onChange={(e) =>
                      setOcrReview((prev) =>
                        prev ? { ...prev, draft: { ...prev.draft, payment_method: e.target.value } } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('selectOptions.pleaseSelect')}</option>
                    {activePaymentMethodOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('receiptOcrDateLabel')}</label>
                  <input
                    type="date"
                    value={ocrReview.draft.date}
                    onChange={(e) =>
                      setOcrReview((prev) =>
                        prev ? { ...prev, draft: { ...prev.draft, date: e.target.value } } : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('memo')}</label>
                  <textarea
                    value={ocrReview.draft.note}
                    onChange={(e) =>
                      setOcrReview((prev) =>
                        prev ? { ...prev, draft: { ...prev.draft, note: e.target.value } } : prev
                      )
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 text-sm font-medium text-gray-700">{t('receiptOcrRawText')}</div>
                <textarea
                  value={ocrReview.result.text}
                  readOnly
                  rows={8}
                  className="w-full rounded border border-gray-200 bg-white p-2 text-xs text-gray-600"
                />
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t">
              <button
                type="button"
                onClick={() => setOcrReview(null)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleApplyOcrToForm}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('receiptOcrApplyToForm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지출 추가 폼 모달 */}
      {showAddForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={(e) => {
            // 모달 배경 클릭 시에만 닫기 (모달 내부 클릭은 무시)
            if (e.target === e.currentTarget && !uploading) {
              if (editingExpense) {
                handleCancelEdit()
              } else {
                setShowAddForm(false)
                setShowMoreCategories(false)
                setPaymentMethodTab('own')
              }
            }
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-md mt-8 mb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingExpense ? '지출 수정' : t('addExpense')}
            </h3>
            
            <form onSubmit={handleAddExpense} className="space-y-4">
              {/* 결제처와 결제내용을 같은 줄에 배치 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('paidTo')}
                  </label>
                  <div className="space-y-2">
                    {/* Payment recipient selection */}
                    <select
                      value={formData.custom_paid_to || formData.paid_to}
                      onChange={(e) => {
                        const selectedValue = e.target.value
                        if (selectedValue === '__custom__') {
                          // Direct input option selected
                          setFormData(prev => ({ ...prev, paid_to: '', custom_paid_to: '' }))
                          setShowCustomPaidTo(true)
                        } else if (paidToOptions.includes(selectedValue)) {
                          // Selected from existing list
                          setFormData(prev => ({ ...prev, paid_to: selectedValue, custom_paid_to: '' }))
                          setShowCustomPaidTo(false)
                        } else {
                          // Direct input case
                          setFormData(prev => ({ ...prev, paid_to: '', custom_paid_to: selectedValue }))
                          setShowCustomPaidTo(true)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('selectPaidTo')}</option>
                      {paidToOptions.map((paidTo) => (
                        <option key={paidTo} value={paidTo}>
                          {paidTo}
                        </option>
                      ))}
                      {/* Direct input option */}
                      <option value="__custom__">{t('directInput')}</option>
                    </select>
                    
                    {/* Direct input field */}
                    {showCustomPaidTo && (
                      <input
                        type="text"
                        value={formData.custom_paid_to}
                        onChange={(e) => {
                          const inputValue = e.target.value
                          setFormData(prev => ({ ...prev, custom_paid_to: inputValue }))
                        }}
                        placeholder={t('enterNewPaidTo')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('paidFor')} <span className="text-red-500">*</span>
                  </label>
                  
                  {/* 지급 항목 아이콘 그리드 */}
                  <div className="mb-3">
                    <div className="grid grid-cols-4 gap-2">
                      {/* Entrance Fee */}
                      {categories.find(c => c.name === 'Entrance Fee') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.paid_for === 'Entrance Fee') {
                              setFormData(prev => ({ ...prev, paid_for: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, paid_for: 'Entrance Fee' }))
                            }
                            setShowCustomPaidFor(false)
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                            formData.paid_for === 'Entrance Fee'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Ticket className={`w-6 h-6 mb-1 ${formData.paid_for === 'Entrance Fee' ? 'text-blue-600' : 'text-gray-600'}`} />
                          <span className="text-xs text-center text-gray-700">Entrance Fee</span>
                        </button>
                      )}
                      
                      {/* Gas */}
                      {categories.find(c => c.name === 'Gas') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.paid_for === 'Gas') {
                              setFormData(prev => ({ ...prev, paid_for: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, paid_for: 'Gas' }))
                            }
                            setShowCustomPaidFor(false)
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                            formData.paid_for === 'Gas'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Fuel className={`w-6 h-6 mb-1 ${formData.paid_for === 'Gas' ? 'text-blue-600' : 'text-gray-600'}`} />
                          <span className="text-xs text-center text-gray-700">Gas</span>
                        </button>
                      )}
                      
                      {/* Meals */}
                      {categories.find(c => c.name === 'Meals') && (
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.paid_for === 'Meals') {
                              setFormData(prev => ({ ...prev, paid_for: '' }))
                            } else {
                              setFormData(prev => ({ ...prev, paid_for: 'Meals' }))
                            }
                            setShowCustomPaidFor(false)
                          }}
                          className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                            formData.paid_for === 'Meals'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <UtensilsCrossed className={`w-6 h-6 mb-1 ${formData.paid_for === 'Meals' ? 'text-blue-600' : 'text-gray-600'}`} />
                          <span className="text-xs text-center text-gray-700">Meals</span>
                        </button>
                      )}
                      
                      {/* More */}
                      <button
                        type="button"
                        onClick={() => setShowMoreCategories(!showMoreCategories)}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                          showMoreCategories
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <MoreHorizontal className={`w-6 h-6 mb-1 ${showMoreCategories ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className="text-xs text-center text-gray-700">More</span>
                      </button>
                    </div>
                    
                    {/* 나머지 카테고리 아이콘 그리드 */}
                    {showMoreCategories && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {categories
                          .filter(c => !['Entrance Fee', 'Gas', 'Meals'].includes(c.name))
                          .map((category) => {
                            // 카테고리별 아이콘 매핑
                            const getCategoryIcon = (name: string) => {
                              const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                                'Meals': UtensilsCrossed,
                                'Bento': Package,
                                'Guide Bento': Package,
                                'Hotel': Building2,
                                'Maintenance': Wrench,
                                'Rent': Car,
                                'Rent (Personal Vehicle)': Car,
                                'Parking': MapPin,
                                'Antelope': MapPin,
                                'Lotto': Coins,
                              }
                              return iconMap[name] || MoreHorizontal
                            }
                            
                            const IconComponent = getCategoryIcon(category.name)
                            const isSelected = formData.paid_for === category.name
                            
                            return (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setFormData(prev => ({ ...prev, paid_for: '' }))
                                  } else {
                                    setFormData(prev => ({ ...prev, paid_for: category.name }))
                                  }
                                  setShowCustomPaidFor(false)
                                }}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-colors ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <IconComponent className={`w-6 h-6 mb-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                                <span className="text-xs text-center text-gray-700 break-words">{category.name}</span>
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                  
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
                    {t('paymentMethod')} <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                      <button
                        type="button"
                        onClick={() => handlePaymentMethodTabChange('own')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          paymentMethodTab === 'own'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('ownCard')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentMethodTabChange('other')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          paymentMethodTab === 'other'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {t('otherPaymentMethods')}
                      </button>
                    </div>
                    {paymentMethodTab === 'own' && !guideEmail && (
                      <p className="text-xs text-amber-600">{t('noGuideAssignedForPaymentMethods')}</p>
                    )}
                    {paymentMethodTab === 'own' && guideEmail && guideCardPaymentMethodOptions.length === 0 && (
                      <p className="text-xs text-amber-600">{t('noGuideCardPaymentMethods')}</p>
                    )}
                    {paymentMethodTab === 'other' && otherPaymentMethodOptions.length === 0 && (
                      <p className="text-xs text-amber-600">{t('noOtherActivePaymentMethods')}</p>
                    )}
                    <PaymentMethodAutocomplete
                      options={visiblePaymentMethodOptions}
                      valueId={formData.payment_method || ''}
                      onChange={(id) => setFormData((prev) => ({ ...prev, payment_method: id }))}
                      disabled={uploading}
                      pleaseSelectLabel={t('selectOptions.pleaseSelect')}
                    />
                  </div>
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
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDragOver(e)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDragLeave(e)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDrop(e)
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {formData.image_url ? (
                    <div className="space-y-2 relative">
                      <div className="relative inline-block mx-auto">
                        <img
                          src={formData.image_url}
                          alt={t('receipt')}
                          className="mx-auto max-h-32 rounded"
                        />
                        <button
                          type="button"
                          onClick={handleImageRemove}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          title={t('removeImage') || '이미지 삭제'}
                        >
                          <X size={16} />
                        </button>
                      </div>
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
                    onChange={(e) => {
                      e.stopPropagation()
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files)
                        // input 값 초기화
                        setTimeout(() => {
                          if (e.target) {
                            (e.target as HTMLInputElement).value = ''
                          }
                        }, 100)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture={typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'environment' : undefined}
                    onChange={(e) => {
                      e.stopPropagation()
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files)
                        // input 값 초기화
                        setTimeout(() => {
                          if (e.target) {
                            (e.target as HTMLInputElement).value = ''
                          }
                        }, 100)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden"
                  />
                  <div className="mt-2 flex gap-2 justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        cameraInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImageIcon size={16} />
                      {t('camera')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileInputRef.current?.click()
                      }}
                      disabled={uploading}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} />
                      {t('file')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={editingExpense ? handleCancelEdit : () => {
                    setShowAddForm(false)
                    setShowMoreCategories(false)
                    setPaymentMethodTab('own')
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading 
                    ? (editingExpense ? '수정 중...' : t('buttons.registering'))
                    : (editingExpense ? '수정' : t('buttons.register'))
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 선택지 관리 모달 */}
      <OptionManagementModal
        isOpen={showOptionManagement}
        onClose={() => setShowOptionManagement(false)}
        onOptionsUpdated={() => {
          loadVendors() // 옵션 업데이트 후 데이터 새로고침
        }}
      />
    </div>
  )
}
