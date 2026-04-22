'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Calendar, User, Phone, Mail, Search, MapPin, Clock, Users, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Customer {
  id: string
  name: string
  email: string
  phone: string | null
  language: string | null
  resident_status: 'us_resident' | 'non_resident' | 'non_resident_with_pass' | null
  created_at: string
}

interface Reservation {
  id: string
  customer_id: string
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

  // 인증 확인 (시뮬레이션 상태 우선 확인)
  useEffect(() => {
    console.log('Dashboard: Auth check effect triggered', { 
      isSimulating, 
      hasSimulatedUser: !!simulatedUser, 
      hasUser: !!user,
      simulatedUserEmail: simulatedUser?.email 
    })
    
    // 시뮬레이션 중인 경우 인증 체크 완전히 건너뛰기
    if (isSimulating && simulatedUser) {
      console.log('Dashboard: Simulation active, skipping authentication check')
      return
    }
    
    // 시뮬레이션 중이지만 simulatedUser가 없는 경우 잠시 기다림
    if (isSimulating && !simulatedUser) {
      console.log('Dashboard: Simulation in progress but no simulatedUser yet, waiting...')
      return
    }
    
    // 고객 페이지는 로그인하지 않은 사용자도 접근 가능하므로 인증 체크 제거
    console.log('Dashboard: Customer page allows unauthenticated access')
  }, [user, isSimulating, simulatedUser, router, locale])

  // 시뮬레이션 상태 변화 감지 (언어 전환 시 시뮬레이션 상태 복원 확인)
  useEffect(() => {
    if (isSimulating && simulatedUser) {
      console.log('Dashboard: Simulation state confirmed:', {
        simulatedUser: simulatedUser.email,
        role: simulatedUser.role,
        isSimulating
      })
    }
  }, [isSimulating, simulatedUser])

  // 시뮬레이션 복원 이벤트 리스너 (함수 정의 후에 추가됨)

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
      console.log('Dashboard: 일반 모드 - 고객 정보 조회:', { userId: authUser.id, email: authUser.email })
      
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
        console.log('Dashboard: user_customer_links를 통해 고객 정보 조회:', linkDataTyped.customer_id)
        const { data: linkedCustomer, error: customerError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', linkDataTyped.customer_id)
          .maybeSingle()

        if (customerError) {
          console.error('연결된 고객 정보 조회 오류:', customerError)
        } else if (linkedCustomer) {
          customerData = linkedCustomer as Customer
          console.log('Dashboard: user_customer_links를 통해 고객 정보 발견:', customerData.name)
        }
      }

      // 2. user_customer_links에 연결이 없는 경우, 이메일로 직접 조회 시도 (기존 방식)
      if (!customerData) {
        console.log('Dashboard: user_customer_links 연결 없음, 이메일로 직접 조회 시도')
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
          console.log('Dashboard: 이메일로 고객 정보 발견:', customerData.name)
          
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
            console.log('Dashboard: 이메일 매칭으로 자동 연결 생성 완료')
          }
        } else {
          // 3. 이메일로도 찾지 못한 경우, 이름 기반 자동 매칭 시도
          // 구글 프로필 이름과 일치하는 고객이 있는지 확인
          if (authUser.name) {
            console.log('Dashboard: 이름 기반 자동 매칭 시도:', authUser.name)
            const { data: nameCustomers, error: nameError } = await supabase
              .from('customers')
              .select('*')
              .ilike('name', `%${authUser.name}%`)
              .limit(5)

            if (!nameError && nameCustomers && nameCustomers.length === 1) {
              // 이름이 정확히 하나만 일치하는 경우 자동 매칭 제안
              const matchedCustomer = nameCustomers[0] as Customer
              console.log('Dashboard: 이름 기반 단일 고객 발견:', matchedCustomer.name)
              
              // 사용자에게 자동 매칭 제안 (비동기로 처리하여 UI 블로킹 방지)
              setTimeout(() => {
                const shouldAutoMatch = confirm(
                  `고객 "${matchedCustomer.name}" (${matchedCustomer.email || matchedCustomer.phone || '정보 없음'})을(를) 자동으로 매칭하시겠습니까?\n\n이제 이 계정으로 예약 정보를 확인할 수 있습니다.`
                )
                
                if (shouldAutoMatch) {
                  handleMatchCustomer(matchedCustomer.id)
                }
              }, 1000)
            } else if (!nameError && nameCustomers && nameCustomers.length > 1) {
              // 여러 고객이 일치하는 경우 검색 결과에 표시
              console.log('Dashboard: 이름 기반 여러 고객 발견:', nameCustomers.length)
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
            reservationsData.map(async (reservation: Reservation) => {
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
  }, [authUser?.id, authUser?.email, isSimulating])

  // 시뮬레이션된 고객 데이터 로드
  const loadSimulatedCustomerData = useCallback(async () => {
    if (!simulatedUser) {
      console.warn('Dashboard: loadSimulatedCustomerData - simulatedUser가 없습니다.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('Dashboard: 시뮬레이션 고객 데이터 로드 시작:', {
        id: simulatedUser.id,
        email: simulatedUser.email,
        name: simulatedUser.name_ko
      })

      // 실제 데이터베이스에서 고객 정보 가져오기
      let customerData: Customer | null = null

      // 방법 1: customer_id로 조회
      if (simulatedUser.id) {
        console.log('Dashboard: customer_id로 고객 정보 조회:', simulatedUser.id)
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', simulatedUser.id)
          .maybeSingle()

        if (error) {
          console.warn('Dashboard: customer_id로 조회 실패:', error)
        } else if (data) {
          const typedData = data as unknown as Customer
          console.log('Dashboard: customer_id로 고객 정보 발견:', typedData.name, typedData.email)
          customerData = typedData
        }
      }

      // 방법 2: 이메일로 조회 (customer_id로 찾지 못한 경우)
      if (!customerData && simulatedUser.email) {
        console.log('Dashboard: 이메일로 고객 정보 조회:', simulatedUser.email)
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('email', simulatedUser.email)
          .maybeSingle()

        if (error) {
          console.warn('Dashboard: 이메일로 조회 실패:', error)
        } else if (data) {
          const typedData = data as unknown as Customer
          console.log('Dashboard: 이메일로 고객 정보 발견:', typedData.name, typedData.email)
          customerData = typedData
        }
      }

      // 실제 고객 정보가 있으면 사용, 없으면 시뮬레이션 데이터 사용
      if (customerData) {
        console.log('Dashboard: 실제 고객 정보로 설정:', customerData.name, customerData.email)
        setCustomer(customerData)
      } else {
        // 실제 데이터베이스에 고객 정보가 없는 경우 시뮬레이션 데이터 사용
        console.log('Dashboard: 실제 고객 정보 없음, 시뮬레이션 데이터 사용:', simulatedUser.name_ko, simulatedUser.email)
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
        const { data: emailReservations, error: emailError } = await supabase
          .from('reservations')
          .select('*')
          .eq('customer_email', simulatedUser.email)
          .order('tour_date', { ascending: false })

        if (!emailError && emailReservations) {
          // 중복 제거 (customer_id와 customer_email 둘 다 매칭되는 경우)
          const existingIds = new Set(reservationsData.map((r: Reservation) => r.id))
          const newReservations = emailReservations.filter((r: Reservation) => !existingIds.has(r.id))
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
      console.log('Dashboard: 시뮬레이션 복원 이벤트 수신:', event.detail)
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
          console.log('Dashboard: 저장된 시뮬레이션 상태 발견, 복원 대기 중...')
          // 시뮬레이션 상태가 복원될 때까지 잠시 대기
          setTimeout(() => {
            // 다시 확인
            if (isSimulating && simulatedUser) {
              console.log('Dashboard: 시뮬레이션 상태 복원됨, 고객 정보 로드')
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
      console.log('Dashboard: 시뮬레이션 모드 - 고객 정보 로드:', simulatedUser.email, simulatedUser.id)
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
        console.log('Dashboard: 일반 모드 - 고객 정보 로드:', authUser.email)
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
      alert('검색 조건을 하나 이상 입력해주세요.')
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
        alert('검색 중 오류가 발생했습니다.')
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
            .filter((reservation: { tour_date: string; products?: { name?: string } }) => {
              const matchesDate = !searchForm.tourDate || 
                reservation.tour_date === searchForm.tourDate
              const matchesProduct = !searchForm.productName || 
                reservation.products?.name?.toLowerCase().includes(searchForm.productName.toLowerCase())
              
              return matchesDate && matchesProduct
            })
            .map((reservation: { customer_id: string }) => reservation.customer_id)

          filteredResults = filteredResults.filter((customer: { id: string }) => 
            matchingCustomerIds.includes(customer.id)
          )
        }
      }

      setSearchResults(filteredResults)

      // 자동 매칭 시도 (단일 결과이고 정확히 일치하는 경우)
      if (filteredResults.length === 1 && authUser?.id && authUser?.email) {
        const exactMatch = filteredResults[0] as { name: string; email: string; phone?: string; id: string }
        
        // 전화번호나 이메일이 정확히 일치하는 경우 자동 매칭 제안
        const phoneMatch = searchForm.phone && exactMatch.phone && 
          exactMatch.phone.replace(/[-\s]/g, '') === searchForm.phone.replace(/[-\s]/g, '')
        const emailMatch = searchForm.email && exactMatch.email && 
          exactMatch.email.toLowerCase() === searchForm.email.toLowerCase()

        if (phoneMatch || emailMatch) {
          const shouldAutoMatch = confirm(
            `고객 "${exactMatch.name}" (${exactMatch.email || exactMatch.phone})을(를) 자동으로 매칭하시겠습니까?\n\n이제 이 계정으로 예약 정보를 확인할 수 있습니다.`
          )
          
          if (shouldAutoMatch) {
            await handleMatchCustomer(exactMatch.id)
            return
          }
        }
      }
    } catch (error) {
      console.error('검색 오류:', error)
      alert('검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  // 고객 ID 매칭
  const handleMatchCustomer = async (customerId: string) => {
    if (!authUser?.id || !authUser?.email) {
      alert('로그인이 필요합니다.')
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
        alert('이미 매칭된 고객입니다.')
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
        alert('고객 ID 매칭 중 오류가 발생했습니다: ' + insertError.message)
        return
      }

      alert('고객 ID가 성공적으로 매칭되었습니다.')
      loadCustomerData()
      setSearchResults([])
      setSearchForm({ phone: '', email: '', tourDate: '', productName: '' })
    } catch (error) {
      console.error('고객 ID 매칭 오류:', error)
      alert('고객 ID 매칭 중 오류가 발생했습니다.')
    }
  }

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
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">고객 대시보드</h1>
              <p className="text-gray-600">투어 예약 정보를 확인하고 관리하세요.</p>
            </div>
            {isSimulating && simulatedUser && (
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  시뮬레이션 중: {simulatedUser.name_ko}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/profile`)}
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                  >
                    내 정보
                  </button>
                  <button
                    onClick={() => router.push(`/${locale}/dashboard/reservations`)}
                    className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
                  >
                    내 예약
                  </button>
                  <button
                    onClick={handleStopSimulation}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 flex items-center"
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    관리자로 돌아가기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 고객 정보가 없는 경우 - 검색 섹션 */}
        {!customer && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Search className="w-5 h-5 mr-2" />
              고객 ID 검색 및 매칭
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-sm font-medium mb-2">
                💡 OTA 채널을 통해 예약하신 고객님께서는 아래 정보로 고객 ID를 검색하여 매칭해주세요.
              </p>
              <p className="text-blue-700 text-sm">
                전화번호, 이메일(OTA에서 제공된 임시 이메일), 투어 날짜, 상품명 중 하나 이상을 입력하여 고객 ID를 찾고 매칭하세요.
                매칭 후에는 이 계정으로 예약 정보를 확인하고 채팅할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  전화번호
                </label>
                <input
                  type="text"
                  value={searchForm.phone}
                  onChange={(e) => setSearchForm((prev: typeof searchForm) => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  value={searchForm.email}
                  onChange={(e) => setSearchForm((prev: typeof searchForm) => ({ ...prev, email: e.target.value }))}
                  placeholder="customer@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  투어 날짜
                </label>
                <input
                  type="date"
                  value={searchForm.tourDate}
                  onChange={(e) => setSearchForm((prev: typeof searchForm) => ({ ...prev, tourDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  상품명
                </label>
                <input
                  type="text"
                  value={searchForm.productName}
                  onChange={(e) => setSearchForm((prev: typeof searchForm) => ({ ...prev, productName: e.target.value }))}
                  placeholder="투어 상품명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  검색
                </>
              )}
            </button>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">검색 결과</h3>
                <div className="space-y-3">
                  {searchResults.map((result: Customer) => (
                    <div key={result.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{result.name}</h4>
                          <p className="text-sm text-gray-600">{result.email}</p>
                          {result.phone && (
                            <p className="text-sm text-gray-600">{result.phone}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleMatchCustomer(result.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                        >
                          매칭
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  {t('editInfo')} →
                </Link>
                <Link
                  href={`/${locale}/dashboard/resident-check`}
                  className="text-teal-700 hover:text-teal-800 text-sm font-medium"
                >
                  {locale === 'en'
                    ? 'Park entry / residency (email link) →'
                    : '국립공원 입장·거주 확인(이메일 링크) →'}
                </Link>
              </div>
            </div>

            {/* 예약 정보 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                내 예약
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
                            {reservation.products?.name || '상품명 없음'}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2" />
                              <span>투어 날짜: {reservation.tour_date}</span>
                            </div>
                            {reservation.tour_time && (
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-2" />
                                <span>투어 시간: {reservation.tour_time}</span>
                              </div>
                            )}
                            {reservation.pickup_hotel && (
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-2" />
                                <span>픽업 호텔: {reservation.pickup_hotel}</span>
                              </div>
                            )}
                            <div className="flex items-center">
                              <Users className="w-4 h-4 mr-2" />
                              <span>인원: 성인 {reservation.adults}명, 어린이 {reservation.child}명, 유아 {reservation.infant}명</span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            reservation.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            reservation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            reservation.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {reservation.status === 'confirmed' ? '확정' :
                             reservation.status === 'pending' ? '대기중' :
                             reservation.status === 'completed' ? '완료' : '취소'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">예약 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}