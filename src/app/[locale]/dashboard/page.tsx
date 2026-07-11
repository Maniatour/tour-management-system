'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Calendar, User, Phone, Mail, MapPin, Clock, Users, CheckCircle, AlertCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import CustomerDashboardHeader from '@/components/customer/CustomerDashboardHeader'
import CustomerDashboardCustomerMatchSection from '@/components/customer/CustomerDashboardCustomerMatchSection'

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  language: string | null
  resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  created_at: string
}

interface Reservation {
  id: string
  customer_id: string | null
  product_id: string
  tour_date: string
  tour_time: string | null
  pickup_hotel: string | null
  pickup_time: string | null
  adults: number
  child: number
  infant: number
  total_people: number
  status: string
  created_at: string
  products?: {
    name: string
    description: string | null
  }
}

export default function CustomerDashboard() {
  const { user, authUser, simulatedUser, isSimulating, stopSimulation } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string || 'ko'
  const t = useTranslations('common')
  const tDash = useTranslations('customerDashboard')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchForm, setSearchForm] = useState({
    phone: '',
    email: '',
    tourDate: '',
    productName: ''
  })
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [matchConfirm, setMatchConfirm] = useState<{
    customerId: string
    name: string
    contact: string
  } | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const noContactLabel = locale === 'en' ? 'No info' : '정보 없음'

  const handleSearchFormChange = (field: keyof typeof searchForm, value: string) => {
    setSearchForm((prev) => ({ ...prev, [field]: value }))
  }

  // 고객 정보 로드
  const loadCustomerData = useCallback(async () => {
    // 시뮬레이션 중이면 실행하지 않음
    if (isSimulating) {
      console.warn('Dashboard: loadCustomerData - 시뮬레이션 중이므로 실행하지 않습니다.')
      return
    }

    if (!authUser?.id || !authUser?.email) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // 1. user_customer_links를 통해 고객 정보 조회
      const { data: linkData, error: linkError } = await supabase
        .from('user_customer_links')
        .select('customer_id, matched_at, matched_by')
        .eq('user_id', authUser.id)
        .order('matched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let customerData: Customer | null = null

      if (linkData && !linkError) {
        // user_customer_links를 통해 고객 정보 조회
        const linkDataTyped = linkData as unknown as { customer_id: string; matched_at: string; matched_by: string }
        const { data: linkedCustomer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', linkDataTyped.customer_id)
          .maybeSingle()

        if (customerError) {
          console.error('연결된 고객 정보 조회 오류:', customerError)
        } else if (linkedCustomer) {
          customerData = linkedCustomer as Customer
        }
      }

      // 2. user_customer_links에 연결이 없는 경우, 이메일로 직접 조회 시도 (기존 방식)
      if (!customerData) {
        const { data: emailCustomer, error: emailError } = await supabase
          .from('customers')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle()

        if (emailError) {
          console.error('이메일로 고객 정보 조회 오류:', {
            message: emailError?.message || 'Unknown error',
            code: emailError?.code || 'No code',
            details: emailError?.details || 'No details',
            hint: emailError?.hint || 'No hint',
            status: (emailError as { status?: number })?.status || 'No status',
            email: authUser.email
          })
          // 406 오류나 다른 권한 오류의 경우 빈 상태로 설정
          if (emailError.code === 'PGRST116' || emailError.code === 'PGRST301' || (emailError as { status?: number }).status === 406) {
            setCustomer(null)
            setReservations([])
            setLoading(false)
            return
          }
        } else if (emailCustomer) {
          customerData = emailCustomer as Customer
          
          // 이메일로 찾은 경우 자동으로 user_customer_links에 연결 생성
          const { error: autoLinkError } = await supabase
            .from('user_customer_links')
            .insert({
              user_id: authUser.id,
              customer_id: customerData.id,
              auth_email: authUser.email,
              matched_by: 'auto'
            } as never)

          if (autoLinkError) {
            console.warn('자동 연결 생성 오류 (무시 가능):', autoLinkError)
          } else {
          }
        } else {
          // 3. 이메일로도 찾지 못한 경우, 이름 기반 자동 매칭 시도
          // 구글 프로필 이름과 일치하는 고객이 있는지 확인
          if (authUser.name) {
            const { data: nameCustomers, error: nameError } = await supabase
              .from('customers')
              .select('*')
              .ilike('name', `%${authUser.name}%`)
              .limit(5)

            if (!nameError && nameCustomers && nameCustomers.length === 1) {
              // 이름이 정확히 하나만 일치하는 경우 자동 매칭 제안
              const matchedCustomer = nameCustomers[0] as Customer
              
              // 사용자에게 자동 매칭 제안 (비동기로 처리하여 UI 블로킹 방지)
              setTimeout(() => {
                setMatchConfirm({
                  customerId: matchedCustomer.id,
                  name: matchedCustomer.name,
                  contact: matchedCustomer.email || matchedCustomer.phone || noContactLabel,
                })
              }, 1000)
            } else if (!nameError && nameCustomers && nameCustomers.length > 1) {
              // 여러 고객이 일치하는 경우 검색 결과에 표시
              setSearchResults(nameCustomers as Customer[])
            }
          }
        }
      }

      if (customerData) {
        setCustomer(customerData)
        
        // 고객의 예약 정보 조회
        const { data: reservationsData, error: reservationsError } = await supabase
          .from('reservations')
          .select('*')
          .eq('customer_id', customerData.id)
          .order('tour_date', { ascending: false })

        if (reservationsError) {
          console.error('예약 정보 조회 오류:', {
            message: reservationsError?.message || 'Unknown error',
            code: reservationsError?.code || 'No code',
            details: reservationsError?.details || 'No details'
          })
          setReservations([])
        } else if (reservationsData && reservationsData.length > 0) {
          // 각 예약에 대해 상품 정보를 별도로 조회
          const reservationsWithProducts = await Promise.all(
            reservationsData.map(async (reservation) => {
              try {
                const { data: productData } = await supabase
                  .from('products')
                  .select('name, description')
                  .eq('id', (reservation as { product_id: string }).product_id)
                  .maybeSingle()

                return {
                  ...reservation,
                  products: productData || { name: '상품명 없음', description: null }
                }
              } catch (error) {
                console.error('상품 정보 조회 오류:', error)
                return {
                  ...reservation,
                  products: { name: '상품명 없음', description: null }
                }
              }
            })
          )
          setReservations(reservationsWithProducts as Reservation[])
        } else {
          setReservations([])
        }
      } else {
        setCustomer(null)
        setReservations([])
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error)
      setCustomer(null)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [authUser?.id, authUser?.email, isSimulating, noContactLabel])

  // 시뮬레이션된 고객 데이터 로드
  const loadSimulatedCustomerData = useCallback(async () => {
    if (!simulatedUser) {
      console.warn('Dashboard: loadSimulatedCustomerData - simulatedUser가 없습니다.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // 실제 데이터베이스에서 고객 정보 가져오기
      let customerData: Customer | null = null

      // 방법 1: customer_id로 조회
      if (simulatedUser.id) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', simulatedUser.id)
          .maybeSingle()

        if (error) {
          console.warn('Dashboard: customer_id로 조회 실패:', error)
        } else if (data) {
          const typedData = data as unknown as Customer
          customerData = typedData
        }
      }

      // 방법 2: 이메일로 조회 (customer_id로 찾지 못한 경우)
      if (!customerData && simulatedUser.email) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('email', simulatedUser.email)
          .maybeSingle()

        if (error) {
          console.warn('Dashboard: 이메일로 조회 실패:', error)
        } else if (data) {
          const typedData = data as unknown as Customer
          customerData = typedData
        }
      }

      // 실제 고객 정보가 있으면 사용, 없으면 시뮬레이션 데이터 사용
      if (customerData) {
        setCustomer(customerData)
      } else {
        // 실제 데이터베이스에 고객 정보가 없는 경우 시뮬레이션 데이터 사용
        setCustomer({
          id: simulatedUser.id,
          name: simulatedUser.name_ko || simulatedUser.name_en || '',
          email: simulatedUser.email,
          phone: simulatedUser.phone || null,
          language: simulatedUser.language || 'ko',
          created_at: simulatedUser.created_at || new Date().toISOString()
        } as Customer)
      }

      // 예약 정보 조회: customer_id와 customer_email 둘 다 시도
      let reservationsData: any[] = []

      // 방법 1: customer_id로 조회
      if (simulatedUser.id) {
        const { data: idReservations, error: idError } = await supabase
          .from('reservations')
          .select('*')
          .eq('customer_id', simulatedUser.id)
          .order('tour_date', { ascending: false })

        if (!idError && idReservations) {
          reservationsData = idReservations
        }
      }

      // 방법 2: customer_email로 조회 (아직 예약이 없거나 customer_id로 찾지 못한 경우)
      if (reservationsData.length === 0 && simulatedUser.email) {
        const { data: emailReservations, error: emailError } = await fromUntypedTable(supabase, 'reservations')
          .select('*')
          .eq('customer_email', simulatedUser.email)
          .order('tour_date', { ascending: false })

        if (!emailError && emailReservations) {
          // 중복 제거 (customer_id와 customer_email 둘 다 매칭되는 경우)
          const existingIds = new Set(reservationsData.map((r) => r.id))
          const newReservations = emailReservations.filter((r) => !existingIds.has(r.id))
          reservationsData = [...reservationsData, ...newReservations]
        }
      }

      // 상품 정보 추가
      if (reservationsData.length > 0) {
        const reservationsWithProducts = await Promise.all(
          reservationsData.map(async (reservation) => {
            try {
              const { data: productData } = await supabase
                .from('products')
                .select('name, description')
                .eq('id', reservation.product_id)
                .maybeSingle()

              return {
                ...reservation,
                products: productData || { name: '상품명 없음', description: null }
              }
            } catch (error) {
              console.error('상품 정보 조회 오류:', error)
              return {
                ...reservation,
                products: { name: '상품명 없음', description: null }
              }
            }
          })
        )
        setReservations(reservationsWithProducts as Reservation[])
      } else {
        setReservations([])
      }
    } catch (error) {
      console.error('시뮬레이션 고객 데이터 로드 오류:', error)
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [simulatedUser])

  // 시뮬레이션 복원 이벤트 리스너
  useEffect(() => {
    const handleSimulationRestored = (event: CustomEvent) => {
      // 시뮬레이션 상태가 복원되면 고객 정보 로드
      if (event.detail && event.detail.email) {
        setCustomer(null)
        setReservations([])
        // 약간의 지연 후 로드 (상태가 완전히 설정될 때까지 대기)
        setTimeout(() => {
          loadSimulatedCustomerData()
        }, 100)
      }
    }

    window.addEventListener('simulationRestored', handleSimulationRestored as EventListener)
    
    return () => {
      window.removeEventListener('simulationRestored', handleSimulationRestored as EventListener)
    }
  }, [loadSimulatedCustomerData])

  // 데이터 로딩
  useEffect(() => {
    // 시뮬레이션 상태 복원 대기 (localStorage 확인)
    const checkSimulationState = () => {
      try {
        const savedSimulation = localStorage.getItem('positionSimulation')
        if (savedSimulation && !isSimulating) {
          // 시뮬레이션 상태가 복원될 때까지 잠시 대기
          setTimeout(() => {
            // 다시 확인
            if (isSimulating && simulatedUser) {
              setCustomer(null)
              setReservations([])
              loadSimulatedCustomerData()
            }
          }, 300)
          return
        }
      } catch (error) {
        console.error('Dashboard: 시뮬레이션 상태 확인 오류:', error)
      }
    }

    // 시뮬레이션 모드 우선 확인
    if (isSimulating && simulatedUser) {
      // 기존 고객 정보 초기화
      setCustomer(null)
      setReservations([])
      // 시뮬레이션된 고객 정보 로드
      loadSimulatedCustomerData()
      return
    }
    
    // 시뮬레이션 상태가 아직 복원되지 않았을 수 있음
    if (!isSimulating) {
      checkSimulationState()
    }
    
    // 일반 모드: 시뮬레이션이 아닐 때만 실행
    if (!isSimulating) {
      if (user && authUser?.email) {
        // 기존 고객 정보 초기화
        setCustomer(null)
        setReservations([])
        loadCustomerData()
      } else {
        // 로그인하지 않은 경우
        setCustomer(null)
        setReservations([])
        setLoading(false)
      }
    }
  }, [isSimulating, simulatedUser, user, authUser?.email, loadSimulatedCustomerData, loadCustomerData])

  // 시뮬레이션 중지
  const handleStopSimulation = () => {
    try {
      stopSimulation()
      // 약간의 지연을 두고 페이지 이동
      setTimeout(() => {
        router.push(`/${locale}/admin`)
      }, 100)
    } catch (error) {
      console.error('시뮬레이션 중지 중 오류:', error)
      // 오류가 발생해도 관리자 페이지로 이동
      router.push(`/${locale}/admin`)
    }
  }

  // 고객 ID 검색 및 자동 매칭
  const handleSearch = async () => {
    if (!searchForm.phone && !searchForm.email && !searchForm.tourDate && !searchForm.productName) {
      setFeedback({ type: 'error', message: t('customerSearchValidation') })
      return
    }

    try {
      setIsSearching(true)
      let query = supabase.from('customers').select('*')

      if (searchForm.phone) {
        query = query.ilike('phone', `%${searchForm.phone}%`)
      }
      if (searchForm.email) {
        query = query.ilike('email', `%${searchForm.email}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('검색 오류:', {
          message: error?.message || 'Unknown error',
          code: error?.code || 'No code',
          details: error?.details || 'No details'
        })
        console.error('전체 검색 오류 객체:', error)
        setFeedback({ type: 'error', message: t('customerSearchError') })
        return
      }

      // 투어 날짜나 상품명으로 추가 필터링
      let filteredResults = data || []
      
      if (searchForm.tourDate || searchForm.productName) {
        const { data: reservationsData } = await supabase
          .from('reservations')
          .select(`
            customer_id,
            tour_date,
            products (
              name
            )
          `)

        if (reservationsData) {
          const matchingCustomerIds = reservationsData
            .filter((reservation) => {
              const products = reservation.products as { name?: string } | null | undefined
              const matchesDate = !searchForm.tourDate || 
                reservation.tour_date === searchForm.tourDate
              const matchesProduct = !searchForm.productName || 
                products?.name?.toLowerCase().includes(searchForm.productName.toLowerCase())
              
              return matchesDate && matchesProduct
            })
            .map((reservation) => reservation.customer_id)
            .filter((id): id is string => id != null)

          filteredResults = filteredResults.filter((customer: { id: string }) => 
            matchingCustomerIds.includes(customer.id)
          )
        }
      }

      setSearchResults(filteredResults as Customer[])

      // 자동 매칭 시도 (단일 결과이고 정확히 일치하는 경우)
      if (filteredResults.length === 1 && authUser?.id && authUser?.email) {
        const exactMatch = filteredResults[0] as { name: string; email: string; phone?: string; id: string }
        
        // 전화번호나 이메일이 정확히 일치하는 경우 자동 매칭 제안
        const phoneMatch = searchForm.phone && exactMatch.phone && 
          exactMatch.phone.replace(/[-\s]/g, '') === searchForm.phone.replace(/[-\s]/g, '')
        const emailMatch = searchForm.email && exactMatch.email && 
          exactMatch.email.toLowerCase() === searchForm.email.toLowerCase()

        if (phoneMatch || emailMatch) {
          setMatchConfirm({
            customerId: exactMatch.id,
            name: exactMatch.name,
            contact: exactMatch.email || exactMatch.phone || noContactLabel,
          })
          return
        }
      }
    } catch (error) {
      console.error('검색 오류:', error)
      setFeedback({ type: 'error', message: t('customerSearchError') })
    } finally {
      setIsSearching(false)
    }
  }

  // 고객 ID 매칭
  const handleMatchCustomer = async (customerId: string) => {
    if (!authUser?.id || !authUser?.email) {
      setFeedback({ type: 'error', message: t('loginRequired') })
      return
    }

    try {
      // 기존 연결 확인
      const { data: existingLink } = await supabase
        .from('user_customer_links')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('customer_id', customerId)
        .maybeSingle()

      if (existingLink) {
        setFeedback({ type: 'success', message: t('customerMatchAlready') })
        loadCustomerData()
        setSearchResults([])
        setSearchForm({ phone: '', email: '', tourDate: '', productName: '' })
        return
      }

      // 기존 연결이 있으면 삭제 (한 사용자는 한 고객과만 연결)
      const { error: deleteError } = await supabase
        .from('user_customer_links')
        .delete()
        .eq('user_id', authUser.id)

      if (deleteError) {
        console.warn('기존 연결 삭제 오류 (무시 가능):', deleteError)
      }

      // 새로운 연결 생성
      const { error: insertError } = await supabase
        .from('user_customer_links')
        .insert({
          user_id: authUser.id,
          customer_id: customerId,
          auth_email: authUser.email,
          matched_by: 'user'
        } as never)

      if (insertError) {
        console.error('고객 ID 매칭 오류:', {
          message: insertError?.message || 'Unknown error',
          code: insertError?.code || 'No code',
          details: insertError?.details || 'No details'
        })
        setFeedback({
          type: 'error',
          message: `${t('customerMatchError')}: ${insertError.message}`,
        })
        return
      }

      setFeedback({ type: 'success', message: t('customerMatchSuccess') })
      loadCustomerData()
      setSearchResults([])
      setSearchForm({ phone: '', email: '', tourDate: '', productName: '' })
    } catch (error) {
      console.error('고객 ID 매칭 오류:', error)
      setFeedback({ type: 'error', message: t('customerMatchError') })
    }
  }

  if (loading) {
        return (
      <div className="min-h-screen app-page-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">{t('loading')}</p>
            </div>
          </div>
        )
  }

        return (
    <div className="min-h-screen app-page-bg">
      <div className="container mx-auto px-4 py-6">
        <CustomerDashboardHeader
          isSimulating={isSimulating}
          simulatedUserName={simulatedUser?.name_ko}
          onProfile={() => router.push(`/${locale}/dashboard/profile`)}
          onReservations={() => router.push(`/${locale}/dashboard/reservations`)}
          onStopSimulation={handleStopSimulation}
        />

        {feedback && (
          <div
            className={`mb-6 rounded-lg border p-4 flex items-start justify-between gap-3 ${
              feedback.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-start gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              )}
              <p className="text-sm">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-60 hover:opacity-100"
              aria-label={t('cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!customer && (
          <CustomerDashboardCustomerMatchSection
            searchForm={searchForm}
            onSearchFormChange={handleSearchFormChange}
            onSearch={handleSearch}
            isSearching={isSearching}
            searchResults={searchResults}
            onMatch={handleMatchCustomer}
          />
        )}

        {/* 고객 정보가 있는 경우 */}
        {customer && (
          <>
            {/* 고객 정보 카드 */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2" />
                {t('myInfo')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">{t('name')}:</span>
                  <span className="ml-2 font-medium">{customer.name}</span>
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">{t('email')}:</span>
                  <span className="ml-2 font-medium">{customer.email}</span>
                </div>
                {customer.phone && (
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-2 text-gray-500" />
                    <span className="text-gray-600">{t('phone')}:</span>
                    <span className="ml-2 font-medium">{customer.phone}</span>
                  </div>
                )}
                {customer.language && (
                  <div className="flex items-center">
                    <span className="text-gray-600">{t('language')}:</span>
                    <span className="ml-2 font-medium">{customer.language}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                <Link
                  href={`/${locale}/dashboard/profile`}
                  className="text-primary hover:text-primary/80 text-sm font-medium"
                >
                  {t('editInfo')} →
                </Link>
                <Link
                  href={`/${locale}/dashboard/resident-check`}
                  className="text-teal-700 hover:text-teal-800 text-sm font-medium"
                >
                  {tDash('residentCheckLink')}
                </Link>
              </div>
            </div>

            {/* 예약 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                {tDash('myReservationsTitle')}
              </h2>
              
              {reservations.length > 0 ? (
                <div className="space-y-4">
                  {reservations.map((reservation: Reservation) => (
                    <div 
                      key={reservation.id} 
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (customer) {
                          router.push(`/${locale}/dashboard/reservations/${customer.id}/${reservation.id}`)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">
                            {reservation.products?.name || tDash('noProductName')}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2" />
                              <span>{tDash('tourDate')}: {reservation.tour_date}</span>
                            </div>
                            {reservation.tour_time && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                <span>{tDash('tourTime')}: {reservation.tour_time}</span>
                              </div>
                            )}
                            {reservation.pickup_hotel && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2" />
                                <span>{tDash('pickupHotel')}: {reservation.pickup_hotel}</span>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-2" />
                              <span>
                                {tDash('participants')}: {tDash('adults')} {reservation.adults}{tDash('people')}, {tDash('children')} {reservation.child}{tDash('people')}, {tDash('infants')} {reservation.infant}{tDash('people')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            reservation.status === 'completed' ? 'bg-primary/10 text-primary' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {reservation.status === 'confirmed' ? t('confirmed') :
                             reservation.status === 'pending' ? t('pending') :
                             reservation.status === 'completed' ? t('completed') : t('cancelled')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">{tDash('noReservations')}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AlertDialog
        open={matchConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setMatchConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('customerMatchTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {matchConfirm
                ? t('customerMatchPrompt', {
                    name: matchConfirm.name,
                    contact: matchConfirm.contact,
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (matchConfirm) {
                  handleMatchCustomer(matchConfirm.customerId)
                  setMatchConfirm(null)
                }
              }}
            >
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}