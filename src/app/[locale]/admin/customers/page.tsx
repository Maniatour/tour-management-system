'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import ReactCountryFlag from 'react-country-flag'
import { 
  Plus, 
  Search, 
  Trash2, 
  User,
  Mail,
  Phone,
  Globe,
  FileText,
  Calendar,
  Filter,
  AlertTriangle,
  BookOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOptimizedData } from '@/hooks/useOptimizedData'
import ReservationForm from '@/components/reservation/ReservationForm'
import type { 
  Customer as ReservationCustomer, 
  Product, 
  Channel, 
  ProductOption, 
  Option, 
  PickupHotel, 
  Reservation 
} from '@/types/reservation'

// 실제 데이터베이스 스키마에 맞는 Customer 타입 정의
type Customer = {
  id: string
  name: string
  email: string
  phone: string | null
  emergency_contact: string | null
  address: string | null
  language: string | null
  special_requests: string | null
  booking_count: number | null
  channel_id: string | null
  status: string | null
  created_at: string | null
  updated_at: string | null
}

type CustomerInsert = {
  id?: string
  name: string
  email: string
  phone?: string | null
  emergency_contact?: string | null
  address?: string | null
  language?: string | null
  special_requests?: string | null
  booking_count?: number | null
  channel_id?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type CustomerUpdate = {
  id?: string
  name?: string
  email?: string
  phone?: string | null
  emergency_contact?: string | null
  address?: string | null
  language?: string | null
  special_requests?: string | null
  booking_count?: number | null
  channel_id?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// 예약 정보 타입 정의
type ReservationInfo = {
  bookingCount: number
  totalParticipants: number
  reservations: ReservationData[]
}

// 예약 데이터 타입 정의
type ReservationData = {
  id: string
  customer_id: string
  total_people: number
  status: string
  created_at: string
  tour_date: string
  product_id: string
}

export default function AdminCustomers() {
  const params = useParams() as { locale?: string }
  const router = useRouter()
  const locale = params?.locale || 'ko'
  
  // 최적화된 고객 데이터 로딩
  const { data: customers = [], loading: customersLoading, refetch: refetchCustomers } = useOptimizedData({
    fetchFn: async () => {
      let allCustomers: Customer[] = []
      let hasMore = true
      let page = 0
      const pageSize = 1000

      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select(`
            *,
            channels:channel_id (
              name
            )
          `)
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) {
          console.error('Error fetching customers:', error)
          break
        }

        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data]
          page++
        } else {
          hasMore = false
        }
      }

      return allCustomers
    },
    cacheKey: 'customers',
    cacheTime: 5 * 60 * 1000 // 5분 캐시
  })

  // 최적화된 채널 데이터 로딩
  const { data: channels = [], loading: channelsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type, favicon_url')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching channels:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'channels',
    cacheTime: 10 * 60 * 1000 // 10분 캐시 (채널은 자주 변경되지 않음)
  })

  // 최적화된 상품 데이터 로딩
  const { data: products = [], loading: productsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ko, name_en')
        .order('name_ko', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'products',
    cacheTime: 10 * 60 * 1000 // 10분 캐시
  })

  // 예약 폼에 필요한 추가 데이터들
  const { data: productOptions = [], loading: productOptionsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching product options:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'product_options',
    cacheTime: 10 * 60 * 1000
  })

  const { data: options = [], loading: optionsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('options')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching options:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'options',
    cacheTime: 10 * 60 * 1000
  })

  const { data: pickupHotels = [], loading: pickupHotelsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('pickup_hotels')
        .select('*')
        .order('hotel', { ascending: true })

      if (error) {
        console.error('Error fetching pickup hotels:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'pickup_hotels',
    cacheTime: 10 * 60 * 1000
  })

  const { data: coupons = [], loading: couponsLoading } = useOptimizedData({
    fetchFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching coupons:', error)
        return []
      }

      return data || []
    },
    cacheKey: 'coupons',
    cacheTime: 5 * 60 * 1000
  })

  const loading = customersLoading || channelsLoading || productsLoading || productOptionsLoading || optionsLoading || pickupHotelsLoading || couponsLoading

  const [reservationInfo, setReservationInfo] = useState<Record<string, ReservationInfo>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortField, setSortField] = useState<keyof Customer>('created_at')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const daysPerPage = 7
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showReservationForm, setShowReservationForm] = useState(false)
  const [selectedCustomerForReservation, setSelectedCustomerForReservation] = useState<Customer | null>(null)

  // 폼 열기 함수
  const openForm = () => {
    setShowForm(true)
  }

  // 예약 추가 함수
  const handleAddReservation = (customer: Customer) => {
    setSelectedCustomerForReservation(customer)
    setShowReservationForm(true)
  }

  // 예약 저장 함수
  const handleSaveReservation = async (reservationData: Omit<Reservation, 'id'>) => {
    try {
      const { error } = await (supabase as unknown as { from: (table: string) => { insert: (data: unknown[]) => Promise<{ error: unknown }> } })
        .from('reservations')
        .insert([reservationData])

      if (error) {
        console.error('Error saving reservation:', error)
        alert('예약 저장 중 오류가 발생했습니다: ' + (error as Error).message)
        return
      }

      // 성공 시 예약 정보 새로고침
      await fetchReservationInfo()
      setShowReservationForm(false)
      setSelectedCustomerForReservation(null)
      alert('예약이 성공적으로 추가되었습니다!')
    } catch (error) {
      console.error('Error saving reservation:', error)
      alert('예약 저장 중 오류가 발생했습니다.')
    }
  }

  // 예약 삭제 함수
  const handleDeleteReservation = async (reservationId: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)

      if (error) {
        console.error('Error deleting reservation:', error)
        alert('예약 삭제 중 오류가 발생했습니다: ' + error.message)
        return
      }

      // 성공 시 예약 정보 새로고침
      await fetchReservationInfo()
      alert('예약이 성공적으로 삭제되었습니다!')
    } catch (error) {
      console.error('Error deleting reservation:', error)
      alert('예약 삭제 중 오류가 발생했습니다.')
    }
  }

  // 폼 닫기 함수
  const closeForm = () => {
    setShowForm(false)
    setEditingCustomer(null)
  }

  // 고객 목록 불러오기 (모든 고객을 가져오기 위해 페이지네이션 사용)

  // 고객별 예약 정보 가져오기
  const fetchReservationInfo = async () => {
    try {
      console.log('Fetching reservation info...')
      
      // 모든 예약 데이터를 가져오기 (페이지네이션 사용)
      let allReservations: ReservationData[] = []
      let hasMore = true
      let page = 0
      const pageSize = 1000

      while (hasMore) {
        const { data, error } = await supabase
          .from('reservations')
          .select('id, customer_id, total_people, status, created_at, tour_date, product_id')
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) {
          console.error('Error fetching reservations:', error)
          break
        }

        if (data && data.length > 0) {
          allReservations = [...allReservations, ...data]
          page++
        } else {
          hasMore = false
        }
      }

      console.log('Total reservations found:', allReservations.length)

      if (allReservations.length === 0) {
        console.log('No reservations found in database')
        setReservationInfo({})
        return
      }

      // 실제 데이터가 있는 경우에만 처리
      const infoMap: Record<string, ReservationInfo> = {}
      
      console.log('Starting to process', allReservations.length, 'reservations')
      
      allReservations.forEach((reservation: ReservationData) => {
        const customerId = reservation.customer_id
        if (!customerId) {
          return // customer_id가 없는 경우 스킵
        }
        
        if (!infoMap[customerId]) {
          infoMap[customerId] = {
            bookingCount: 0,
            totalParticipants: 0,
            reservations: []
          }
        }
        
        infoMap[customerId].bookingCount += 1
        infoMap[customerId].totalParticipants += reservation.total_people || 0
        infoMap[customerId].reservations.push(reservation)
      })

      console.log('Final processed reservation info:', JSON.stringify(infoMap, null, 2))
      console.log('Info map keys:', Object.keys(infoMap))
      console.log('Info map values:', Object.values(infoMap))
      
      // infoMap이 비어있지 않은지 확인
      if (Object.keys(infoMap).length === 0) {
        console.warn('infoMap is empty after processing!')
      } else {
        console.log('Setting reservation info with', Object.keys(infoMap).length, 'customers')
      }
      
      setReservationInfo(infoMap)
    } catch (error) {
      console.error('Error fetching reservation info:', error)
      setReservationInfo({})
    }
  }

  // 새 고객 추가
  const handleAddCustomer = async (customerData: CustomerInsert) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('customers')
        .insert(customerData)

      if (error) {
        console.error('Error adding customer:', error)
        alert('고객 추가 중 오류가 발생했습니다.')
        return
      }

      alert('고객이 성공적으로 추가되었습니다!')
      closeForm()
      refetchCustomers()
    } catch (error) {
      console.error('Error adding customer:', error)
      alert('고객 추가 중 오류가 발생했습니다.')
    }
  }

  // 고객 정보 수정
  const handleEditCustomer = async (id: string, updateData: CustomerUpdate) => {
      try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
          .from('customers')
        .update(updateData)
        .eq('id', id)

        if (error) {
          console.error('Error updating customer:', error)
        alert('고객 정보 수정 중 오류가 발생했습니다.')
          return
        }

            alert('고객 정보가 성공적으로 수정되었습니다!')
      closeForm()
      refetchCustomers()
      } catch (error) {
        console.error('Error updating customer:', error)
      alert('고객 정보 수정 중 오류가 발생했습니다.')
    }
  }

  // 고객 삭제
  const handleDeleteCustomer = async (id: string) => {
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('Error deleting customer:', error)
        alert('고객 삭제 중 오류가 발생했습니다.')
          return
        }

      alert('고객이 성공적으로 삭제되었습니다!')
      refetchCustomers()
      
      // 모달 닫기
      setShowForm(false)
      setEditingCustomer(null)
      } catch (error) {
        console.error('Error deleting customer:', error)
      alert('고객 삭제 중 오류가 발생했습니다.')
    }
  }


  // 정렬된 고객 목록
  const getSortedCustomers = (customers: Customer[]) => {
    return [...customers].sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]

      // 언어 필드 특별 처리 (배열 형태)
      if (sortField === 'language') {
        const getLangValue = (value: string[] | string | null) => {
          if (!value) return ''
          if (Array.isArray(value)) {
            return value.find(l => l === 'KR' || l === 'ko') || value[0] || ''
          }
          if (typeof value === 'string') {
            return value === 'KR' || value === 'ko' ? 'KR' : value
          }
          return ''
        }
        
        const aLang = getLangValue(aValue as string[] | string | null)
        const bLang = getLangValue(bValue as string[] | string | null)
        const comparison = aLang.localeCompare(bLang, 'ko')
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // null/undefined 값 처리
      if (aValue === null || aValue === undefined) aValue = ''
      if (bValue === null || bValue === undefined) bValue = ''

      // 문자열 비교
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'ko')
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // 숫자 비교
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }

  // 컴포넌트 마운트 시 예약 정보 불러오기
  useEffect(() => {
    fetchReservationInfo()
  }, [])

  // 검색된 고객 목록
  const filteredCustomers = (customers || []).filter(customer => {
    // 상태 필터 적용
    if (statusFilter === 'active' && customer.status !== 'active') return false
    if (statusFilter === 'inactive' && customer.status === 'active') return false
    
    // 검색어 필터 적용
    return (
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm)) ||
      customer.emergency_contact?.includes(searchTerm) ||
      customer.special_requests?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  // 검색어나 필터 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])


  // 고객을 등록일별로 그룹화
  const groupCustomersByDate = (customers: Customer[]) => {
    const groups: { [key: string]: Customer[] } = {}
    
    customers.forEach(customer => {
      let date = '날짜 없음'
      
      if (customer.created_at) {
        // UTC 시간을 한국 시간대로 변환
        const utcDate = new Date(customer.created_at)
        
        // 유효한 날짜인지 확인
        if (!isNaN(utcDate.getTime())) {
          const koreaDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "Asia/Seoul"}))
          
          // 변환된 날짜가 유효한지 확인
          if (!isNaN(koreaDate.getTime())) {
            date = koreaDate.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })
          }
        }
      }
      
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(customer)
    })
    
    return groups
  }

  // 날짜별 예약 정보 계산
  const getDateReservationInfo = (customers: Customer[]) => {
    let totalBookings = 0
    let totalParticipants = 0
    
    customers.forEach(customer => {
      const info = reservationInfo[customer.id]
      if (info) {
        totalBookings += info.bookingCount
        totalParticipants += info.totalParticipants
      }
    })
    
    return { totalBookings, totalParticipants }
  }

  // 전체 고객을 그룹화
  const allGroupedCustomers = groupCustomersByDate(getSortedCustomers(filteredCustomers))
  
  // 날짜별 페이지네이션 계산
  const dateKeys = Object.keys(allGroupedCustomers).sort((a, b) => {
    if (a === '날짜 없음') return 1
    if (b === '날짜 없음') return -1
    return new Date(b).getTime() - new Date(a).getTime() // 최신 날짜가 먼저
  })
  
  const totalPages = Math.ceil(dateKeys.length / daysPerPage)
  const startDateIndex = (currentPage - 1) * daysPerPage
  const endDateIndex = startDateIndex + daysPerPage
  const paginatedDateKeys = dateKeys.slice(startDateIndex, endDateIndex)
  
  // 현재 페이지에 표시할 그룹화된 고객 데이터
  const groupedCustomers = paginatedDateKeys.reduce((acc, date) => {
    acc[date] = allGroupedCustomers[date]
    return acc
  }, {} as { [key: string]: Customer[] })

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">고객 관리</h1>
          <p className="mt-2 text-gray-600">고객 정보를 관리하고 모니터링합니다.</p>
        </div>
        <button
                          onClick={openForm}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>새 고객 추가</span>
        </button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
            placeholder="이름, 이메일, 전화번호, 다른 이름(영문명 등), 특별요청으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        </div>
        
        {/* 상태 필터 버튼들 */}
        <div className="flex space-x-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            활성
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            비활성
          </button>
        </div>
        
        {/* 정렬 버튼 */}
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={`${String(sortField)}-${sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-')
              setSortField(field as keyof Customer)
              setSortDirection(direction as 'asc' | 'desc')
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="created_at-desc">최신순</option>
            <option value="created_at-asc">오래된순</option>
            <option value="name-asc">이름 ↑</option>
            <option value="name-desc">이름 ↓</option>
            <option value="language-asc">언어 ↑</option>
            <option value="language-desc">언어 ↓</option>
          </select>
        </div>
      </div>

      {/* 고객 목록 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">고객 목록을 불러오는 중...</p>
        </div>
      ) : (
        <>
          {/* 필터 정보 표시 */}
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <div>
              {statusFilter === 'active' && '활성 고객'}
              {statusFilter === 'inactive' && '비활성 고객'}
              {statusFilter === 'all' && '전체 고객'}
              : {filteredCustomers.length}명 (날짜 {currentPage}/{totalPages})
            </div>
            <div>
              전체: {customers?.length || 0}명
            </div>
          </div>
          
          {/* 고객 목록 카드뷰 */}
          {Object.keys(groupedCustomers).length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">고객이 없습니다</h3>
              <p className="text-gray-500">새 고객을 추가해보세요.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedCustomers).map(([date, customers]) => (
                <div key={date} className="space-y-4">
                  {/* 날짜 헤더 */}
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-900">{date}</h3>
                    <span className="text-sm text-gray-500">
                      ({(() => {
                        const dateInfo = getDateReservationInfo(customers)
                        if (dateInfo.totalBookings > 0) {
                          return `${customers.length}명, ${dateInfo.totalBookings}건, ${dateInfo.totalParticipants}명`
                        } else {
                          return `${customers.length}명`
                        }
                      })()})
                    </span>
                  </div>
                  
                  {/* 해당 날짜의 고객 카드들 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {customers.map((customer) => (
                                              <div 
                          key={customer.id} 
                          onClick={() => {
                            setEditingCustomer(customer)
                            setShowForm(true)
                            // 고객 정보를 편집 모드로 설정
                          }}
                          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-3 border border-gray-200 cursor-pointer"
                        >
                        {/* 첫 번째 줄: 고객 이름, 언어, 연락처 아이콘, 채널 */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center flex-1 min-w-0">
                              <span className="text-base mr-2 flex-shrink-0">
                                {(() => {
                                  const lang = customer.language
                                  
                                  // 언어가 없거나 빈 문자열인 경우 경고 아이콘 표시
                                  if (!lang || lang === '') {
                                    return (
                                      <div className="relative group">
                                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                                        {/* 호버 툴팁 */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                          언어가 선택되지 않음
                                          {/* 화살표 */}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    )
                                  }
                                  
                                  // 배열인 경우
                                  if (Array.isArray(lang)) {
                                    const languageToCountry: { [key: string]: string } = {
                                      'KR': 'KR', 'ko': 'KR', '한국어': 'KR',
                                      'EN': 'US', 'en': 'US', '영어': 'US',
                                      'JA': 'JP', 'jp': 'JP', '일본어': 'JP',
                                      'ZH': 'CN', 'zh': 'CN', '중국어': 'CN',
                                      'ES': 'ES', 'es': 'ES', '스페인어': 'ES',
                                      'FR': 'FR', 'fr': 'FR', '프랑스어': 'FR',
                                      'DE': 'DE', 'de': 'DE', '독일어': 'DE',
                                      'IT': 'IT', 'it': 'IT', '이탈리아어': 'IT',
                                      'PT': 'PT', 'pt': 'PT', '포르투갈어': 'PT',
                                      'RU': 'RU', 'ru': 'RU', '러시아어': 'RU',
                                      'AR': 'SA', 'ar': 'SA', '아랍어': 'SA',
                                      'TH': 'TH', 'th': 'TH', '태국어': 'TH',
                                      'VI': 'VN', 'vi': 'VN', '베트남어': 'VN',
                                      'ID': 'ID', 'id': 'ID', '인도네시아어': 'ID',
                                      'MS': 'MY', 'ms': 'MY', '말레이어': 'MY',
                                      'TL': 'PH', 'tl': 'PH', '필리핀어': 'PH',
                                      'HI': 'IN', 'hi': 'IN', '힌디어': 'IN',
                                      'BN': 'BD', 'bn': 'BD', '벵골어': 'BD',
                                      'UR': 'PK', 'ur': 'PK', '우르두어': 'PK',
                                      'FA': 'IR', 'fa': 'IR', '페르시아어': 'IR',
                                      'TR': 'TR', 'tr': 'TR', '터키어': 'TR',
                                      'PL': 'PL', 'pl': 'PL', '폴란드어': 'PL',
                                      'NL': 'NL', 'nl': 'NL', '네덜란드어': 'NL',
                                      'SV': 'SE', 'sv': 'SE', '스웨덴어': 'SE',
                                      'NO': 'NO', 'no': 'NO', '노르웨이어': 'NO',
                                      'DA': 'DK', 'da': 'DK', '덴마크어': 'DK',
                                      'FI': 'FI', 'fi': 'FI', '핀란드어': 'FI',
                                      'CS': 'CZ', 'cs': 'CZ', '체코어': 'CZ',
                                      'HU': 'HU', 'hu': 'HU', '헝가리어': 'HU',
                                      'RO': 'RO', 'ro': 'RO', '루마니아어': 'RO',
                                      'BG': 'BG', 'bg': 'BG', '불가리아어': 'BG',
                                      'HR': 'HR', 'hr': 'HR', '크로아티아어': 'HR',
                                      'SK': 'SK', 'sk': 'SK', '슬로바키아어': 'SK',
                                      'SL': 'SI', 'sl': 'SI', '슬로베니아어': 'SI',
                                      'ET': 'EE', 'et': 'EE', '에스토니아어': 'EE',
                                      'LV': 'LV', 'lv': 'LV', '라트비아어': 'LV',
                                      'LT': 'LT', 'lt': 'LT', '리투아니아어': 'LT',
                                      'EL': 'GR', 'el': 'GR', '그리스어': 'GR',
                                      'HE': 'IL', 'he': 'IL', '히브리어': 'IL',
                                      'KO': 'KP', '조선어': 'KP',
                                      'MN': 'MN', 'mn': 'MN', '몽골어': 'MN',
                                      'KA': 'GE', 'ka': 'GE', '조지아어': 'GE',
                                      'AM': 'ET', 'am': 'ET', '암하라어': 'ET',
                                      'SW': 'KE', 'sw': 'KE', '스와힐리어': 'KE',
                                      'ZU': 'ZA', 'zu': 'ZA', '줄루어': 'ZA',
                                      'AF': 'ZA', 'af': 'ZA', '아프리칸스어': 'ZA',
                                      'XH': 'ZA', 'xh': 'ZA', '코사어': 'ZA'
                                    }
                                    
                                    for (const l of lang) {
                                      if (l && typeof l === 'string') {
                                        const countryCode = languageToCountry[l]
                                        if (countryCode) {
                                          return <ReactCountryFlag countryCode={countryCode} svg style={{ width: '20px', height: '15px' }} />
                                        }
                                        // 기존 로직 유지 (하위 호환성)
                                        if (l.includes('KR') || l.includes('ko')) return <ReactCountryFlag countryCode="KR" svg style={{ width: '20px', height: '15px' }} />
                                        if (l.includes('EN') || l.includes('en')) return <ReactCountryFlag countryCode="US" svg style={{ width: '20px', height: '15px' }} />
                                      }
                                    }
                                    // 배열이지만 유효한 언어가 없는 경우 경고 아이콘
                                    return (
                                      <div className="relative group">
                                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                                        {/* 호버 툴팁 */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                          유효하지 않은 언어 설정
                                          {/* 화살표 */}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    )
                                  }
                                  
                                  // 문자열인 경우 - 언어 코드와 국가 코드 매핑
                                  if (typeof lang === 'string') {
                                    const languageToCountry: { [key: string]: string } = {
                                      'KR': 'KR', 'ko': 'KR', '한국어': 'KR',
                                      'EN': 'US', 'en': 'US', '영어': 'US',
                                      'JA': 'JP', 'jp': 'JP', '일본어': 'JP',
                                      'ZH': 'CN', 'zh': 'CN', '중국어': 'CN',
                                      'ES': 'ES', 'es': 'ES', '스페인어': 'ES',
                                      'FR': 'FR', 'fr': 'FR', '프랑스어': 'FR',
                                      'DE': 'DE', 'de': 'DE', '독일어': 'DE',
                                      'IT': 'IT', 'it': 'IT', '이탈리아어': 'IT',
                                      'PT': 'PT', 'pt': 'PT', '포르투갈어': 'PT',
                                      'RU': 'RU', 'ru': 'RU', '러시아어': 'RU',
                                      'AR': 'SA', 'ar': 'SA', '아랍어': 'SA',
                                      'TH': 'TH', 'th': 'TH', '태국어': 'TH',
                                      'VI': 'VN', 'vi': 'VN', '베트남어': 'VN',
                                      'ID': 'ID', 'id': 'ID', '인도네시아어': 'ID',
                                      'MS': 'MY', 'ms': 'MY', '말레이어': 'MY',
                                      'TL': 'PH', 'tl': 'PH', '필리핀어': 'PH',
                                      'HI': 'IN', 'hi': 'IN', '힌디어': 'IN',
                                      'BN': 'BD', 'bn': 'BD', '벵골어': 'BD',
                                      'UR': 'PK', 'ur': 'PK', '우르두어': 'PK',
                                      'FA': 'IR', 'fa': 'IR', '페르시아어': 'IR',
                                      'TR': 'TR', 'tr': 'TR', '터키어': 'TR',
                                      'PL': 'PL', 'pl': 'PL', '폴란드어': 'PL',
                                      'NL': 'NL', 'nl': 'NL', '네덜란드어': 'NL',
                                      'SV': 'SE', 'sv': 'SE', '스웨덴어': 'SE',
                                      'NO': 'NO', 'no': 'NO', '노르웨이어': 'NO',
                                      'DA': 'DK', 'da': 'DK', '덴마크어': 'DK',
                                      'FI': 'FI', 'fi': 'FI', '핀란드어': 'FI',
                                      'CS': 'CZ', 'cs': 'CZ', '체코어': 'CZ',
                                      'HU': 'HU', 'hu': 'HU', '헝가리어': 'HU',
                                      'RO': 'RO', 'ro': 'RO', '루마니아어': 'RO',
                                      'BG': 'BG', 'bg': 'BG', '불가리아어': 'BG',
                                      'HR': 'HR', 'hr': 'HR', '크로아티아어': 'HR',
                                      'SK': 'SK', 'sk': 'SK', '슬로바키아어': 'SK',
                                      'SL': 'SI', 'sl': 'SI', '슬로베니아어': 'SI',
                                      'ET': 'EE', 'et': 'EE', '에스토니아어': 'EE',
                                      'LV': 'LV', 'lv': 'LV', '라트비아어': 'LV',
                                      'LT': 'LT', 'lt': 'LT', '리투아니아어': 'LT',
                                      'EL': 'GR', 'el': 'GR', '그리스어': 'GR',
                                      'HE': 'IL', 'he': 'IL', '히브리어': 'IL',
                                      'KO': 'KP', '조선어': 'KP',
                                      'MN': 'MN', 'mn': 'MN', '몽골어': 'MN',
                                      'KA': 'GE', 'ka': 'GE', '조지아어': 'GE',
                                      'AM': 'ET', 'am': 'ET', '암하라어': 'ET',
                                      'SW': 'KE', 'sw': 'KE', '스와힐리어': 'KE',
                                      'ZU': 'ZA', 'zu': 'ZA', '줄루어': 'ZA',
                                      'AF': 'ZA', 'af': 'ZA', '아프리칸스어': 'ZA',
                                      'XH': 'ZA', 'xh': 'ZA', '코사어': 'ZA'
                                    }
                                    
                                    const countryCode = languageToCountry[lang]
                                    if (countryCode) {
                                      return <ReactCountryFlag countryCode={countryCode} svg style={{ width: '20px', height: '15px' }} />
                                    }
                                    
                                    // 기존 로직 유지 (하위 호환성)
                                    if ((lang as string).includes('KR') || (lang as string).includes('ko')) return <ReactCountryFlag countryCode="KR" svg style={{ width: '20px', height: '15px' }} />
                                    if ((lang as string).includes('EN') || (lang as string).includes('en')) return <ReactCountryFlag countryCode="US" svg style={{ width: '20px', height: '15px' }} />
                                    // 유효하지 않은 언어 문자열인 경우 경고 아이콘
                                    return (
                                      <div className="relative group">
                                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                                        {/* 호버 툴팁 */}
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                          유효하지 않은 언어 설정
                                          {/* 화살표 */}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    )
                                  }
                                  
                                  // 기타 경우 경고 아이콘
                                  return (
                                    <div className="relative group">
                                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                                      {/* 호버 툴팁 */}
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                        언어 설정 오류
                                        {/* 화살표 */}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </span>
                              <h3 className="text-base font-medium text-gray-900 truncate">
                                {customer.name}
                              </h3>
                              
                              {/* 연락처 아이콘들 - 이름 바로 옆에 */}
                              <div className="flex items-center space-x-1 ml-2">
                                {customer.phone && (
                                  <Phone className="h-3 w-3 text-gray-400" />
                                )}
                                {customer.email && (
                                  <Mail className="h-3 w-3 text-gray-400" />
                                )}
                                {customer.special_requests && (
                                  <div className="relative group">
                                    <FileText className="h-3 w-3 text-gray-400 cursor-help" />
                                    {/* 호버 툴팁 */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 max-w-xs">
                                      <div className="whitespace-pre-wrap break-words">
                                        {customer.special_requests}
                                      </div>
                                      {/* 화살표 */}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* 채널 정보 - 오른쪽 정렬 */}
                            <div className="flex items-center text-xs text-gray-600 flex-shrink-0 ml-2">
                              {(() => {
                                const customerWithChannels = customer as Customer & { channels?: { name: string } }
                                let channelName = ''
                                
                                // channels 관계가 있고 name이 있으면 조인된 채널 이름 사용
                                if (customerWithChannels.channels?.name) {
                                  channelName = customerWithChannels.channels.name
                                } else if (customer.channel_id) {
                                  // 그렇지 않으면 channel_id를 직접 사용 (Homepage 등의 직접 값)
                                  channelName = customer.channel_id
                                } else {
                                  channelName = '채널 없음'
                                }
                                
                                // 채널 이름으로 실제 채널 객체 찾기
                                const channel = channels?.find((c: { name: string; id: string }) => c.name === channelName || c.id === customer.channel_id)
                                const channelWithFavicon = channel as { favicon_url?: string; name?: string } | undefined
                                
                                return channelWithFavicon?.favicon_url ? (
                                  <Image 
                                    src={channelWithFavicon.favicon_url} 
                                    alt={`${channelWithFavicon.name || 'Channel'} favicon`} 
                                    width={12}
                                    height={12}
                                    className="rounded mr-1 flex-shrink-0"
                                    onError={(e) => {
                                      // 파비콘 로드 실패 시 기본 아이콘으로 대체
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                      const parent = target.parentElement
                                      if (parent) {
                                        const fallback = document.createElement('div')
                                        fallback.className = 'h-3 w-3 text-gray-400 mr-1 flex-shrink-0'
                                        fallback.innerHTML = '<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"></path></svg>'
                                        parent.appendChild(fallback)
                                      }
                                    }}
                                  />
                                ) : (
                                  <Globe className="h-3 w-3 text-gray-400 mr-1 flex-shrink-0" />
                                )
                              })()}
                              <span className="text-xs text-gray-900 truncate">
                                {(() => {
                                  const customerWithChannels = customer as Customer & { channels?: { name: string } }
                                  // channels 관계가 있고 name이 있으면 조인된 채널 이름 사용
                                  if (customerWithChannels.channels?.name) {
                                    return customerWithChannels.channels.name
                                  }
                                  // 그렇지 않으면 channel_id를 직접 사용 (Homepage 등의 직접 값)
                                  if (customer.channel_id) {
                                    return customer.channel_id
                                  }
                                  return '채널 없음'
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 두 번째 줄: 예약 정보 */}
                        <div className="mb-2">
                          {(() => {
                            const info = reservationInfo[customer.id]
                            
                            if (!info || (info.bookingCount === 0 && info.totalParticipants === 0)) {
                              return (
                                <div className="text-center py-2">
                                  <span className="text-gray-400 text-xs">예약 없음</span>
                                </div>
                              )
                            }
                            
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation() // 카드 클릭 이벤트 방지
                                  // 예약 관리 페이지로 이동 (고객 ID로 필터링)
                                  router.push(`/${locale}/admin/reservations?customer=${customer.id}`)
                                }}
                                className="w-full hover:bg-blue-50 p-2 rounded-lg transition-colors group border border-blue-200 bg-blue-50/30"
                                title="예약 내역 보기"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center space-x-2 text-xs text-blue-700">
                                    <Calendar className="h-3 w-3 group-hover:text-blue-800" />
                                    <span className="group-hover:text-blue-800 font-semibold">{info.bookingCount}건</span>
                                    <User className="h-3 w-3 group-hover:text-blue-800" />
                                    <span className="group-hover:text-blue-800 font-semibold">{info.totalParticipants}명</span>
                                  </div>
                                  <span className="text-blue-600 text-xs group-hover:text-blue-800 font-semibold">→</span>
                                </div>
                                
                                {/* 예약 상세 정보 */}
                                <div className="space-y-1">
                                  {info.reservations.slice(0, 2).map((reservation) => {
                                    const product = (products as Array<{id: string, name_ko?: string, name_en?: string}>)?.find((p) => p.id === reservation.product_id)
                                    const productName = product?.name_ko || product?.name_en || '상품명 없음'
                                    const statusColor = reservation.status === 'confirmed' ? 'text-green-600' : 
                                                      reservation.status === 'pending' ? 'text-yellow-600' : 
                                                      reservation.status === 'cancelled' ? 'text-red-600' : 'text-gray-600'
                                    
                                    return (
                                      <div 
                                        key={reservation.id} 
                                        className="text-xs text-gray-600 flex items-center justify-between cursor-pointer hover:bg-green-50 p-2 rounded-md transition-colors border border-green-200 bg-green-50/20"
                                        onClick={(e) => {
                                          e.stopPropagation() // 카드 클릭 이벤트 방지
                                          // 개별 예약 상세 페이지로 이동
                                          router.push(`/${locale}/admin/reservations/${reservation.id}`)
                                        }}
                                        title="예약 상세 보기"
                                      >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                          <span className="text-green-600 font-mono font-semibold">
                                            {new Date(reservation.tour_date).toLocaleDateString('en-US', { 
                                              month: '2-digit', 
                                              day: '2-digit', 
                                              year: 'numeric' 
                                            })}
                                          </span>
                                          <span className="truncate font-semibold text-green-800">{productName}</span>
                                        </div>
                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                          <span className="text-green-600 font-medium">{reservation.total_people}명</span>
                                          <span className={`font-semibold ${statusColor}`}>
                                            {reservation.status === 'confirmed' ? '확정' :
                                             reservation.status === 'pending' ? '대기' :
                                             reservation.status === 'cancelled' ? '취소' : reservation.status}
                                          </span>
                                          <span className="text-green-600 text-xs font-semibold">→</span>
                                        </div>
                                      </div>
                                    )
                                  })}
                                  {info.reservations.length > 2 && (
                                    <div 
                                      className="text-xs text-purple-600 text-center cursor-pointer hover:bg-purple-50 p-2 rounded-md transition-colors border border-purple-200 bg-purple-50/20 font-semibold"
                                      onClick={(e) => {
                                        e.stopPropagation() // 카드 클릭 이벤트 방지
                                        // 예약 목록 페이지로 이동 (고객 ID로 필터링)
                                        router.push(`/${locale}/admin/reservations?customer=${customer.id}`)
                                      }}
                                      title="모든 예약 보기"
                                    >
                                      +{info.reservations.length - 2}건 더 보기
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })()}
                        </div>

                        {/* 특별요청 정보 */}
                        {customer.special_requests && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start space-x-2">
                              <FileText className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <div className="text-xs text-yellow-800">
                                <div className="font-medium mb-1">특별요청:</div>
                                <div className="whitespace-pre-wrap break-words">
                                  {customer.special_requests.length > 100 
                                    ? `${customer.special_requests.substring(0, 100)}...` 
                                    : customer.special_requests
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 예약 추가 버튼 */}
                        <div className="mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation() // 카드 클릭 이벤트 방지
                              handleAddReservation(customer)
                            }}
                            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors duration-200"
                            title="새 예약 추가"
                          >
                            <BookOpen className="h-3 w-3" />
                            <span>예약 추가</span>
                          </button>
                        </div>

                      </div>
                    ))}
                      </div>
                    </div>
              ))}
                    </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-6">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                처음
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                이전
              </button>
              
              {/* 페이지 번호들 */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm border rounded-lg ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              
                      <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                다음
                      </button>
                      <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                마지막
                      </button>
                    </div>
          )}
        </>
      )}

      {/* 고객 추가/편집 폼 */}
      {showForm && (
        <CustomerForm
          key={editingCustomer?.id || 'new'} // customer ID가 변경될 때마다 컴포넌트 새로 마운트
          customer={editingCustomer}
          customers={customers || []}
          channels={channels || []}
          onSubmit={editingCustomer ? 
            (data) => handleEditCustomer(editingCustomer.id, data) : 
            handleAddCustomer
          }
          onCancel={() => {
            setShowForm(false)
            setEditingCustomer(null)
          }}
          onDelete={editingCustomer ? 
            () => handleDeleteCustomer(editingCustomer.id) : 
            undefined
          }
        />
      )}

      {/* 고객 상세 정보 모달 */}
      {showDetailModal && selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedCustomer(null)
          }}
        />
      )}

      {/* 예약 추가 모달 */}
      {showReservationForm && selectedCustomerForReservation && (
        <ReservationModal
          customer={selectedCustomerForReservation}
          onClose={() => {
            setShowReservationForm(false)
            setSelectedCustomerForReservation(null)
          }}
          onSave={handleSaveReservation}
          onDelete={handleDeleteReservation}
          customers={(customers || []).map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            emergency_contact: c.emergency_contact,
            address: c.address,
            language: c.language,
            special_requests: c.special_requests,
            booking_count: c.booking_count,
            channel_id: c.channel_id,
            status: c.status,
            created_at: c.created_at,
            updated_at: c.updated_at
          }))}
          products={products || []}
          channels={channels || []}
          productOptions={productOptions || []}
          options={options || []}
          pickupHotels={pickupHotels || []}
          coupons={coupons || []}
        />
      )}
    </div>
  )
}

// 고객 폼 컴포넌트
function CustomerForm({ 
  customer, 
  customers,
  channels,
  onSubmit, 
  onCancel,
  onDelete
}: { 
  customer: Customer | null
  customers: Customer[]
  channels: Array<{id: string, name: string, type: string | null}>
  onSubmit: (data: CustomerInsert) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  // 랜덤 ID 생성 함수 (useCallback으로 메모이제이션)
  const generateRandomId = useCallback(() => {
    const timestamp = Date.now().toString(36)
    const randomStr = Math.random().toString(36).substring(2, 8)
    return `CUST_${timestamp}_${randomStr}`.toUpperCase()
  }, [])

  // useMemo로 기본 formData를 customer prop에 따라 계산
  const defaultFormData = useMemo<CustomerInsert>(() => {
    console.log('=== useMemo 실행됨 ===')
    console.log('customer:', customer)
    console.log('customer?.language:', customer?.language)
    
    if (customer) {
      // 언어 필드 디버깅 및 수정 (text 타입으로 변경됨)
      let languageValue = '' // 기본값을 빈 문자열로 변경하여 "언어 선택" 옵션에 매핑
      
      if (typeof customer.language === 'string') {
        console.log('customer.language가 문자열입니다:', customer.language)
        // 기존 언어 코드 매핑 (하위 호환성 유지)
        if (customer.language === 'EN' || customer.language === 'en' || customer.language === '영어') {
          languageValue = 'EN'
          console.log('영어로 인식됨')
        } else if (customer.language === 'KR' || customer.language === 'ko' || customer.language === '한국어') {
          languageValue = 'KR'
          console.log('한국어로 인식됨')
        } else {
          // 새로운 언어 코드들도 그대로 사용
          languageValue = customer.language
          console.log('새로운 언어 코드로 인식됨:', customer.language)
        }
      } else {
        console.log('언어 필드 없음 또는 null: 빈 문자열로 기본값 설정')
        languageValue = '' // null/undefined 등은 빈 문자열로
      }
      
      const newFormData = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        emergency_contact: customer.emergency_contact,
        email: customer.email,
        address: customer.address,
        language: languageValue,
        special_requests: customer.special_requests,
        booking_count: customer.booking_count || 0,
        channel_id: customer.channel_id,
        status: customer.status || 'active'
      }
      console.log('새로운 formData 계산:', newFormData)
      console.log('언어 필드 상세:', {
        original: customer.language,
        processed: newFormData.language,
        isArray: Array.isArray(customer.language)
      })
      return newFormData
    } else {
      // 새 고객 추가 모드일 때 기본값
      const defaultFormData = {
        id: generateRandomId(),
        name: '',
        phone: '',
        emergency_contact: '',
        email: '',
        address: '',
        language: 'KR',
        special_requests: '',
        booking_count: 0,
        channel_id: '',
        status: 'active'
      }
      console.log('기본 formData 계산:', defaultFormData)
      return defaultFormData
    }
  }, [customer, generateRandomId])

  // useState로 formData 상태 관리
  const [formData, setFormData] = useState<CustomerInsert>(defaultFormData)
  const [selectedChannelType, setSelectedChannelType] = useState<'ota' | 'self' | 'partner'>('ota')
  
  // 고객 자동완성을 위한 상태
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [isExistingCustomer, setIsExistingCustomer] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement | null>(null)

  // 채널 타입을 자동으로 결정하는 함수
  const determineChannelType = useCallback((channelId: string | null | undefined): 'ota' | 'self' | 'partner' => {
    if (!channelId) return 'ota' // 기본값
    
    // 직접적인 채널 이름인 경우 (Homepage, Direct 등)
    const directChannelNames = ['Homepage', 'Direct', '직접', '홈페이지']
    if (directChannelNames.some(name => channelId.toLowerCase().includes(name.toLowerCase()))) {
      return 'self'
    }
    
    // channels 테이블에서 해당 채널의 타입 찾기
    const channel = channels.find(c => c.id === channelId)
    if (channel?.type) {
      return channel.type as 'ota' | 'self' | 'partner'
    }
    
    return 'ota' // 기본값
  }, [channels])

  // 고객 검색 필터링 함수
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return []
    
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(customerSearch.toLowerCase())
    ).slice(0, 10) // 최대 10개만 표시
  }, [customers, customerSearch])

  // 고객 선택 시 폼 데이터 업데이트
  const handleCustomerSelect = useCallback((selectedCustomer: Customer) => {
    setFormData({
      ...formData,
      id: selectedCustomer.id,
      name: selectedCustomer.name,
      phone: selectedCustomer.phone || '',
      email: selectedCustomer.email || '',
      emergency_contact: selectedCustomer.emergency_contact || '',
      address: selectedCustomer.address || '',
      language: selectedCustomer.language || 'KR',
      special_requests: selectedCustomer.special_requests || '',
      booking_count: selectedCustomer.booking_count || 0,
      channel_id: selectedCustomer.channel_id || '',
      status: selectedCustomer.status || 'active'
    })
    setCustomerSearch(selectedCustomer.name)
    setShowCustomerDropdown(false)
    setIsExistingCustomer(true)
    
    // 채널 타입도 자동으로 설정
    const channelType = determineChannelType(selectedCustomer.channel_id)
    setSelectedChannelType(channelType)
  }, [formData, determineChannelType])

  // 고객 검색 입력 변경 시
  const handleCustomerSearchChange = useCallback((value: string) => {
    setCustomerSearch(value)
    setShowCustomerDropdown(value.length > 0)
    setIsExistingCustomer(false)
    
    // 검색어가 변경되면 폼 데이터의 이름도 업데이트
    setFormData(prev => ({ ...prev, name: value }))
  }, [])

  // 외부 클릭 시 고객 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // defaultFormData가 변경될 때 formData 업데이트 및 채널 타입 설정
  useEffect(() => {
    console.log('=== useEffect로 formData 업데이트 ===')
    console.log('새로운 defaultFormData:', defaultFormData)
    setFormData(defaultFormData)
    setCustomerSearch(defaultFormData.name)
    
    // 채널 타입 자동 설정
    const channelType = determineChannelType(defaultFormData.channel_id)
    console.log('자동 결정된 채널 타입:', channelType, 'for channel_id:', defaultFormData.channel_id)
    setSelectedChannelType(channelType)
  }, [defaultFormData, channels, determineChannelType])



  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // 필수 필드 검증
    if (!formData.name) {
      alert('이름은 필수 입력 항목입니다.')
      return
    }

    // 이메일 형식 검증 (이메일이 입력된 경우에만)
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        alert('올바른 이메일 형식을 입력해주세요.')
        return
      }
    }

    // 중복 고객 검증 (새 고객 추가 시에만)
    if (!customer && !isExistingCustomer) {
      const duplicateCustomer = customers.find(c => 
        c.name.toLowerCase() === formData.name.toLowerCase() ||
        (formData.email && c.email && c.email.toLowerCase() === formData.email.toLowerCase()) ||
        (formData.phone && c.phone && c.phone === formData.phone)
      )
      
      if (duplicateCustomer) {
        const confirmMessage = `이미 등록된 고객과 유사한 정보가 있습니다.\n\n` +
          `기존 고객: ${duplicateCustomer.name}` +
          (duplicateCustomer.email ? ` (${duplicateCustomer.email})` : '') +
          (duplicateCustomer.phone ? ` (${duplicateCustomer.phone})` : '') +
          `\n\n기존 고객을 선택하시겠습니까?`
        
        if (confirm(confirmMessage)) {
          handleCustomerSelect(duplicateCustomer)
          return
        } else {
          return
        }
      }
    }

    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold">
              {customer ? '고객 정보 수정' : '새 고객 추가'}
        </h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              ID: {formData.id}
            </span>
          </div>
          
          {/* 상태 온오프 스위치 */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">상태</span>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData, 
                status: formData.status === 'active' ? 'inactive' : 'active'
              })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                formData.status === 'active' ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${
              formData.status === 'active' ? 'text-blue-600' : 'text-gray-500'
            }`}>
              {formData.status === 'active' ? '활성' : '비활성'}
            </span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 첫 번째와 두 번째 줄: 3열 그리드로 구성 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 왼쪽 열: 이름, 전화번호 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 *
                </label>
                <div className="relative" ref={customerSearchRef}>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearchChange(e.target.value)}
                    onFocus={() => setShowCustomerDropdown(customerSearch.length > 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="고객 이름, 이메일, 전화번호로 검색..."
                    required
                  />
                  
                  {/* 고객 검색 드롭다운 */}
                  {showCustomerDropdown && customerSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCustomers.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          {customer.email && (
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          )}
                          {customer.phone && (
                            <div className="text-sm text-gray-500">{customer.phone}</div>
                          )}
                        </div>
                      ))}
                      {filteredCustomers.length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-center">
                          검색 결과가 없습니다
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 기존 고객 선택됨 표시 */}
                  {isExistingCustomer && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        기존 고객
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="전화번호 (선택사항)"
                />
              </div>
            </div>
            
            {/* 중간 열: 언어, 비상연락처 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  언어
                </label>
                <select
                  value={(() => {
                    // 언어 필드 처리 (배열 형태 방지)
                    if (Array.isArray(formData.language)) {
                      // 배열인 경우 첫 번째 값만 사용하고 문자열로 변환
                      const firstLang = formData.language[0]
                      // 기존 언어 코드 매핑 (하위 호환성 유지)
                      if (firstLang === 'KR' || firstLang === 'ko' || firstLang === '한국어') {
                        return 'KR'
                      }
                      if (firstLang === 'EN' || firstLang === 'en' || firstLang === '영어') {
                        return 'EN'
                      }
                      // 새로운 언어 코드들은 그대로 사용
                      return firstLang || ''
                    }
                    if (typeof formData.language === 'string') {
                      // 기존 언어 코드 매핑 (하위 호환성 유지)
                      if (formData.language === 'KR' || formData.language === 'ko' || formData.language === '한국어') {
                        return 'KR'
                      }
                      if (formData.language === 'EN' || formData.language === 'en' || formData.language === '영어') {
                        return 'EN'
                      }
                      // 새로운 언어 코드들은 그대로 사용
                      return formData.language
                    }
                    return ''
                  })()}
                  onChange={(e) => setFormData({...formData, language: e.target.value})}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">🌐 언어 선택</option>
                  <option value="KR">🇰🇷 한국어</option>
                  <option value="EN">🇺🇸 English</option>
                  <option value="JA">🇯🇵 日本語</option>
                  <option value="ZH">🇨🇳 中文</option>
                  <option value="ES">🇪🇸 Español</option>
                  <option value="FR">🇫🇷 Français</option>
                  <option value="DE">🇩🇪 Deutsch</option>
                  <option value="IT">🇮🇹 Italiano</option>
                  <option value="PT">🇵🇹 Português</option>
                  <option value="RU">🇷🇺 Русский</option>
                  <option value="AR">🇸🇦 العربية</option>
                  <option value="TH">🇹🇭 ไทย</option>
                  <option value="VI">🇻🇳 Tiếng Việt</option>
                  <option value="ID">🇮🇩 Bahasa Indonesia</option>
                  <option value="MS">🇲🇾 Bahasa Melayu</option>
                  <option value="TL">🇵🇭 Filipino</option>
                  <option value="HI">🇮🇳 हिन्दी</option>
                  <option value="BN">🇧🇩 বাংলা</option>
                  <option value="UR">🇵🇰 اردو</option>
                  <option value="FA">🇮🇷 فارسی</option>
                  <option value="TR">🇹🇷 Türkçe</option>
                  <option value="PL">🇵🇱 Polski</option>
                  <option value="NL">🇳🇱 Nederlands</option>
                  <option value="SV">🇸🇪 Svenska</option>
                  <option value="NO">🇳🇴 Norsk</option>
                  <option value="DA">🇩🇰 Dansk</option>
                  <option value="FI">🇫🇮 Suomi</option>
                  <option value="CS">🇨🇿 Čeština</option>
                  <option value="HU">🇭🇺 Magyar</option>
                  <option value="RO">🇷🇴 Română</option>
                  <option value="BG">🇧🇬 Български</option>
                  <option value="HR">🇭🇷 Hrvatski</option>
                  <option value="SK">🇸🇰 Slovenčina</option>
                  <option value="SL">🇸🇮 Slovenščina</option>
                  <option value="ET">🇪🇪 Eesti</option>
                  <option value="LV">🇱🇻 Latviešu</option>
                  <option value="LT">🇱🇹 Lietuvių</option>
                  <option value="EL">🇬🇷 Ελληνικά</option>
                  <option value="HE">🇮🇱 עברית</option>
                  <option value="KO">🇰🇵 조선어</option>
                  <option value="MN">🇲🇳 Монгол</option>
                  <option value="KA">🇬🇪 ქართული</option>
                  <option value="AM">🇪🇹 አማርኛ</option>
                  <option value="SW">🇰🇪 Kiswahili</option>
                  <option value="ZU">🇿🇦 IsiZulu</option>
                  <option value="AF">🇿🇦 Afrikaans</option>
                  <option value="XH">🇿🇦 IsiXhosa</option>
                  <option value="OTHER">🌍 기타</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비상연락처
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact || ''}
                  onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="비상연락처 (선택사항)"
                />
              </div>
            </div>
            
            {/* 오른쪽 열: 채널 (2줄 차지) */}
            <div className="row-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                채널
              </label>
              {/* 채널 타입별 탭과 선택 드롭다운을 하나의 박스로 통합 */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                {/* 탭 헤더 */}
                <div className="flex bg-gray-50">
                  {['ota', 'self', 'partner'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedChannelType(type as 'ota' | 'self' | 'partner')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                        selectedChannelType === type
                          ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                          : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                      }`}
                    >
                      {type === 'ota' ? 'OTA' : type === 'self' ? '직접' : '파트너'}
                    </button>
                  ))}
                </div>
                
                {/* 탭 내용 - 채널 선택 드롭다운 */}
                <div className="p-3 bg-white">
                  <select
                    value={formData.channel_id || ''}
                    onChange={(e) => setFormData({...formData, channel_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">채널 선택</option>
                    {channels
                      .filter(channel => channel.type === selectedChannelType)
                      .map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 세 번째 줄: 이메일 | 주소 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="이메일 (선택사항)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="주소 (선택사항)"
              />
            </div>
          </div>

          {/* 특별요청 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              특별요청
            </label>
            <textarea
              value={formData.special_requests || ''}
              onChange={(e) => setFormData({...formData, special_requests: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="특별한 요청사항, 다른 이름(영문명, 다국어명 등), 알레르기 정보 등을 입력해주세요"
            />
          </div>



          {/* 버튼 */}
          <div className="flex justify-between pt-4 border-t">
            {/* 삭제 버튼 (수정 모드일 때만) */}
            {customer && onDelete && (
            <button
                type="button"
                onClick={() => {
                  if (confirm('정말로 이 고객을 삭제하시겠습니까?')) {
                    onDelete()
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>삭제</span>
            </button>
            )}
            
            {/* 취소/저장 버튼 */}
            <div className="flex space-x-3 ml-auto">
            <button
              type="button"
              onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {customer ? '수정' : '추가'}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// 고객 상세 정보 모달
function CustomerDetailModal({ 
  customer, 
  onClose 
}: { 
  customer: Customer
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">고객 상세 정보</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="sr-only">닫기</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 기본 정보 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              기본 정보
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">ID</span>
                <p className="text-gray-900">{customer.id}</p>
              </div>
                             <div>
                 <span className="text-sm font-medium text-gray-500">이름</span>
                 <p className="text-gray-900">{customer.name}</p>
               </div>
              <div>
                <span className="text-sm font-medium text-gray-500">이메일</span>
                <p className="text-gray-900">{customer.email}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">전화번호</span>
                <p className="text-gray-900">{customer.phone}</p>
              </div>
              {customer.emergency_contact && (
                <div>
                  <span className="text-sm font-medium text-gray-500">비상연락처</span>
                  <p className="text-gray-900">{customer.emergency_contact}</p>
                </div>
              )}
            </div>
          </div>

          {/* 추가 정보 */}
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              추가 정보
            </h3>
            <div className="space-y-3">
              {customer.address && (
                <div>
                  <span className="text-sm font-medium text-gray-500">주소</span>
                  <p className="text-gray-900">{customer.address}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-500">언어</span>
                <p className="text-gray-900 flex items-center">
                  {(() => {
                    if (!customer.language) return '언어 없음'
                    if (Array.isArray(customer.language)) {
                      const firstLang = customer.language[0]
                      if (firstLang === 'KR' || firstLang === 'ko') return (
                        <>
                          <ReactCountryFlag countryCode="KR" svg style={{ width: '16px', height: '12px', marginRight: '8px' }} />
                          한국어
                        </>
                      )
                      if (firstLang === 'EN' || firstLang === 'en') return (
                        <>
                          <ReactCountryFlag countryCode="US" svg style={{ width: '16px', height: '12px', marginRight: '8px' }} />
                          English
                        </>
                      )
                      return firstLang || '언어 없음'
                    }
                    if (customer.language === 'KR' || customer.language === 'ko') return (
                      <>
                        <ReactCountryFlag countryCode="KR" svg style={{ width: '16px', height: '12px', marginRight: '8px' }} />
                        한국어
                      </>
                    )
                    if (customer.language === 'EN' || customer.language === 'en') return (
                      <>
                        <ReactCountryFlag countryCode="US" svg style={{ width: '16px', height: '12px', marginRight: '8px' }} />
                        English
                      </>
                    )
                    return customer.language
                  })()}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">예약수</span>
                <p className="text-gray-900">{customer.booking_count || 0}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500">상태</span>
                <p className="text-gray-900">{customer.status === 'active' ? '활성' : '비활성'}</p>
              </div>
              {customer.created_at && (
                <div>
                  <span className="text-sm font-medium text-gray-500">등록일</span>
                  <p className="text-gray-900">{new Date(customer.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
              )}
            </div>
          </div>

          {/* 특별요청 */}
          {customer.special_requests && (
            <div className="md:col-span-2">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                특별요청
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-900">{customer.special_requests}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

// 예약 추가 모달
function ReservationModal({ 
  customer, 
  onClose, 
  onSave,
  onDelete,
  customers,
  products,
  channels,
  productOptions,
  options,
  pickupHotels,
  coupons
}: { 
  customer: Customer
  onClose: () => void
  onSave: (reservationData: Omit<Reservation, 'id'>) => void
  onDelete: (reservationId: string) => void
  customers: ReservationCustomer[]
  products: Product[]
  channels: Channel[]
  productOptions: ProductOption[]
  options: Option[]
  pickupHotels: PickupHotel[]
  coupons: Array<{
    id: string
    coupon_code: string
    discount_type: 'percentage' | 'fixed'
    percentage_value?: number | null
    fixed_value?: number | null
    status?: string | null
    channel_id?: string | null
    product_id?: string | null
    start_date?: string | null
    end_date?: string | null
  }>
}) {
  // 고객 정보를 미리 채운 예약 데이터 생성
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD 형식
  const preFilledReservation: Partial<Reservation> = {
    customerId: customer.id,
    channelId: customer.channel_id || '',
    addedBy: customer.name,
    tourDate: today, // 오늘 날짜를 기본값으로 설정
    tourTime: '09:00', // 기본 투어 시간
    adults: 1, // 기본 성인 수
    child: 0,
    infant: 0,
    totalPeople: 1,
    status: 'pending' as const,
    // 상품 선택을 위한 안내 메시지
    productId: '', // 상품을 선택해야 가격 정보가 로드됩니다
    // 가격 관련 초기값들
    adultProductPrice: 0,
    childProductPrice: 0,
    infantProductPrice: 0,
    productPriceTotal: 0,
    requiredOptions: {},
    requiredOptionTotal: 0,
    subtotal: 0,
    couponCode: '',
    couponDiscount: 0,
    additionalDiscount: 0,
    additionalCost: 0,
    cardFee: 0,
    tax: 0,
    prepaymentCost: 0,
    prepaymentTip: 0,
    selectedOptionalOptions: {},
    optionTotal: 0,
    totalPrice: 0,
    depositAmount: 0,
    balanceAmount: 0,
    isPrivateTour: false,
    privateTourAdditionalCost: 0,
    commission_percent: 0,
    onlinePaymentAmount: 0,
    onSiteBalanceAmount: 0
  }

  return (
    <ReservationForm
      reservation={preFilledReservation as Reservation | null}
      customers={customers}
      products={products}
      channels={channels}
      productOptions={productOptions}
      options={options}
      pickupHotels={pickupHotels}
      coupons={coupons}
      onSubmit={onSave}
      onCancel={onClose}
      onRefreshCustomers={async () => {}}
      onDelete={onDelete}
      layout="modal"
    />
  )
}
