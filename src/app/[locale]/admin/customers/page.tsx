'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

// 예약 정보 타입 정의
type ReservationInfo = {
  bookingCount: number
  totalParticipants: number
}

// 예약 데이터 타입 정의
type ReservationData = {
  customer_id: string
  total_people: number
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [channels, setChannels] = useState<Array<{id: string, name: string, type: string | null}>>([])
  const [reservationInfo, setReservationInfo] = useState<Record<string, ReservationInfo>>({})
  const [loading, setLoading] = useState(true)
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

  // 폼 열기 함수
  const openForm = () => {
    setShowForm(true)
  }

  // 폼 닫기 함수
  const closeForm = () => {
    setShowForm(false)
    setEditingCustomer(null)
  }

  // 고객 목록 불러오기 (모든 고객을 가져오기 위해 페이지네이션 사용)
  const fetchCustomers = async () => {
    try {
      setLoading(true)
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

      setCustomers(allCustomers)
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  // channels 테이블에서 채널 목록 불러오기
  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, type')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching channels:', error)
        return
      }

      setChannels(data || [])
    } catch (error) {
      console.error('Error fetching channels:', error)
    }
  }

  // 고객별 예약 정보 가져오기
  const fetchReservationInfo = async () => {
    try {
      console.log('Fetching reservation info...')
      
      // 모든 예약 데이터를 가져오기 (페이지네이션 사용)
      let allReservations: any[] = []
      let hasMore = true
      let page = 0
      const pageSize = 1000

      while (hasMore) {
        const { data, error } = await supabase
          .from('reservations')
          .select('id, customer_id, total_people, status, created_at')
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
      
      allReservations.forEach((reservation: any, index: number) => {
        const customerId = reservation.customer_id
        if (!customerId) {
          return // customer_id가 없는 경우 스킵
        }
        
        if (!infoMap[customerId]) {
          infoMap[customerId] = {
            bookingCount: 0,
            totalParticipants: 0
          }
        }
        
        infoMap[customerId].bookingCount += 1
        infoMap[customerId].totalParticipants += reservation.total_people || 0
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
      fetchCustomers()
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
      fetchCustomers()
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
      fetchCustomers()
      
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

  // 컴포넌트 마운트 시 고객 목록과 채널 목록, 예약 정보 불러오기
  useEffect(() => {
    fetchCustomers()
    fetchChannels()
    fetchReservationInfo()
  }, [])

  // 검색된 고객 목록
  const filteredCustomers = customers.filter(customer => {
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
      const date = customer.created_at ? new Date(customer.created_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }) : '날짜 없음'
      
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
            placeholder="고객 검색..."
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
              전체: {customers.length}명
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
                        {/* 고객 이름과 언어, 예약 정보 */}
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
                                    for (const l of lang) {
                                      if (l && typeof l === 'string') {
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
                                  
                                  // 문자열인 경우
                                  if (typeof lang === 'string') {
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
                            </div>
                            
                            {/* 예약 정보 - 오른쪽 정렬 */}
                            <div className="flex items-center space-x-2 text-xs text-gray-600 flex-shrink-0 ml-2">
                              {(() => {
                                const info = reservationInfo[customer.id]
                                
                                if (!info || (info.bookingCount === 0 && info.totalParticipants === 0)) {
                                  return (
                                    <span className="text-gray-400">예약 없음</span>
                                  )
                                }
                                return (
                                  <>
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="h-3 w-3" />
                                      <span>{info.bookingCount}건</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <User className="h-3 w-3" />
                                      <span>{info.totalParticipants}명</span>
                                    </div>
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* 연락처, 특별 요청사항, 채널 */}
                        <div className="mb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
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
                    <div className="flex items-center">
                              <Globe className="h-3 w-3 text-gray-400 mr-1" />
                              <span className="text-xs text-gray-900 truncate">
                                {(customer as Customer & { channels?: { name: string } }).channels?.name || '채널 없음'}
                              </span>
                            </div>
                          </div>
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
          channels={channels}
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
    </div>
  )
}

// 고객 폼 컴포넌트
function CustomerForm({ 
  customer, 
  channels,
  onSubmit, 
  onCancel,
  onDelete
}: { 
  customer: Customer | null
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
        if (customer.language === 'EN' || customer.language === 'en' || customer.language === '영어') {
          languageValue = 'EN'
          console.log('영어로 인식됨')
        } else if (customer.language === 'KR' || customer.language === 'ko' || customer.language === '한국어') {
          languageValue = 'KR'
          console.log('한국어로 인식됨')
        } else {
          console.log('알 수 없는 언어: 빈 문자열로 기본값 설정')
          languageValue = '' // 알 수 없는 언어는 빈 문자열로
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

  // defaultFormData가 변경될 때 formData 업데이트
  useEffect(() => {
    console.log('=== useEffect로 formData 업데이트 ===')
    console.log('새로운 defaultFormData:', defaultFormData)
    setFormData(defaultFormData)
  }, [defaultFormData])



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
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="고객 이름"
                  required
                />
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
                      if (firstLang === 'KR' || firstLang === 'ko' || firstLang === '한국어') {
                        return 'KR'
                      }
                      if (firstLang === 'EN' || firstLang === 'en' || firstLang === '영어') {
                        return 'EN'
                      }
                      return ''
                    }
                    if (typeof formData.language === 'string') {
                      if (formData.language === 'KR' || formData.language === 'ko' || formData.language === '한국어') {
                        return 'KR'
                      }
                      if (formData.language === 'EN' || formData.language === 'en' || formData.language === '영어') {
                        return 'EN'
                      }
                      return ''
                    }
                    return ''
                  })()}
                  onChange={(e) => setFormData({...formData, language: e.target.value})}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">🌐 언어 선택</option>
                  <option value="KR">🇰🇷 한국어</option>
                  <option value="EN">🇺🇸 English</option>
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
              placeholder="특별한 요청사항이 있다면 입력해주세요"
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
