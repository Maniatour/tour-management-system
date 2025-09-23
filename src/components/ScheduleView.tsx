'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { ChevronLeft, ChevronRight, Users, MapPin, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useLocale } from 'next-intl'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tour = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Product = any
type Team = Database['public']['Tables']['team']['Row']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reservation = any
type Customer = Database['public']['Tables']['customers']['Row']

interface DailyData {
  totalPeople: number
  assignedPeople: number
  tours: number
  productColors: { [productId: string]: string }
  role: string | null
  guideInitials: string | null
  isMultiDay: boolean
  multiDayDays: number
  extendsToNextMonth?: boolean
}

// interface ScheduleData {
//   product_id: string
//   product_name: string
//   team_member_id: string
//   team_member_name: string
//   position: string
//   dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } }
//   totalPeople: number
//   totalAssignedPeople: number
//   totalTours: number
// }

export default function ScheduleView() {
  const locale = useLocale()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [products, setProducts] = useState<Product[]>([])
  const [teamMembers, setTeamMembers] = useState<Team[]>([])
  const [tours, setTours] = useState<Tour[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [productColors, setProductColors] = useState<{ [productId: string]: string }>({})
  // const [currentUserId] = useState('admin') // 실제로는 인증된 사용자 ID를 사용해야 함
  const [draggedTour, setDraggedTour] = useState<Tour | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [unassignedTours, setUnassignedTours] = useState<Tour[]>([])
  const [ticketBookings, setTicketBookings] = useState<Array<{ id: string; tour_id: string | null; status: string | null; ea: number | null }>>([])
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null)
  const [offSchedules, setOffSchedules] = useState<Array<{ team_email: string; off_date: string; reason: string; status: string }>>([])
  const [draggedUnassignedTour, setDraggedUnassignedTour] = useState<Tour | null>(null)
  const [draggedRole, setDraggedRole] = useState<'guide' | 'assistant' | null>(null)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageModalContent, setMessageModalContent] = useState({ title: '', message: '', type: 'success' as 'success' | 'error' })
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmModalContent, setConfirmModalContent] = useState({ title: '', message: '', onConfirm: () => {}, buttonText: '확인', buttonColor: 'bg-red-500 hover:bg-red-600' })
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [guideModalContent, setGuideModalContent] = useState({ title: '', content: '', tourId: '' })

  // 배치 저장용 변경 대기 상태
  const [pendingChanges, setPendingChanges] = useState<{ [tourId: string]: Partial<Tour> }>({})
  const [pendingOffScheduleChanges, setPendingOffScheduleChanges] = useState<{ [key: string]: { team_email: string; off_date: string; reason: string; status: string; action: 'approve' | 'delete' } }>({})
  const pendingCount = useMemo(() => Object.keys(pendingChanges).length + Object.keys(pendingOffScheduleChanges).length, [pendingChanges, pendingOffScheduleChanges])

  // 통합 스크롤 컨테이너는 하나의 스크롤로 동기화됨

  // 메시지 모달 표시 함수
  const showMessage = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setMessageModalContent({ title, message, type })
    setShowMessageModal(true)
  }

  // 확인 모달 표시 함수
  const showConfirm = (title: string, message: string, onConfirm: () => void, buttonText: string = '확인', buttonColor: string = 'bg-red-500 hover:bg-red-600') => {
    setConfirmModalContent({ title, message, onConfirm, buttonText, buttonColor })
    setShowConfirmModal(true)
  }

  // 가이드 모달 표시 함수
  const showGuideModalContent = (title: string, content: string, tourId: string = '') => {
    setGuideModalContent({ title, content, tourId })
    setShowGuideModal(true)
  }

  // 사용자 설정 저장
  const saveUserSetting = async (key: string, value: string[] | number | boolean) => {
    try {
      // 빈 배열이나 유효하지 않은 값은 저장하지 않음
      if (Array.isArray(value) && value.length === 0) {
        console.log('Skipping save for empty array:', key)
        return
      }
      
      if (value === null || value === undefined) {
        console.log('Skipping save for null/undefined value:', key)
        return
      }

      // localStorage에 저장
      localStorage.setItem(key, JSON.stringify(value))
      console.log('User setting saved to localStorage:', key, value)
    } catch (error) {
      console.error('Error saving user setting:', error)
      // fallback to localStorage
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  // 사용자 설정 불러오기
  const loadUserSettings = useCallback(async () => {
    try {
      // 먼저 localStorage에서 설정 불러오기 (기본값)
      const savedProducts = localStorage.getItem('schedule_selected_products')
      const savedTeamMembers = localStorage.getItem('schedule_selected_team_members')
      
      if (savedProducts) {
        try {
          setSelectedProducts(JSON.parse(savedProducts))
        } catch (parseError) {
          console.warn('Error parsing saved products from localStorage:', parseError)
        }
      }
      if (savedTeamMembers) {
        try {
          setSelectedTeamMembers(JSON.parse(savedTeamMembers))
        } catch (parseError) {
          console.warn('Error parsing saved team members from localStorage:', parseError)
        }
      }

      // localStorage만 사용하므로 데이터베이스 조회 제거
    } catch (error) {
      console.warn('Error in loadUserSettings, using localStorage fallback:', error)
      // localStorage 설정은 이미 위에서 로드했으므로 여기서는 아무것도 하지 않음
    }
  }, [])

  // 색상 팔레트 정의 (원색)
  const colorPalette = useMemo(() => [
    { name: '파란색', class: 'bg-blue-500 border-blue-600 text-white' },
    { name: '초록색', class: 'bg-green-500 border-green-600 text-white' },
    { name: '노란색', class: 'bg-yellow-500 border-yellow-600 text-black' },
    { name: '보라색', class: 'bg-purple-500 border-purple-600 text-white' },
    { name: '분홍색', class: 'bg-pink-500 border-pink-600 text-white' },
    { name: '인디고', class: 'bg-indigo-500 border-indigo-600 text-white' },
    { name: '빨간색', class: 'bg-red-500 border-red-600 text-white' },
    { name: '주황색', class: 'bg-orange-500 border-orange-600 text-white' },
    { name: '청록색', class: 'bg-cyan-500 border-cyan-600 text-white' },
    { name: '라임색', class: 'bg-lime-500 border-lime-600 text-black' },
    { name: '회색', class: 'bg-gray-500 border-gray-600 text-white' },
    { name: '슬레이트', class: 'bg-slate-500 border-slate-600 text-white' }
  ], [])


  // 상품 색상 변경
  const changeProductColor = (productId: string, colorClass: string) => {
    setProductColors(prev => ({
      ...prev,
      [productId]: colorClass
    }))
  }

  // Tailwind CSS 클래스를 실제 색상 값으로 변환
  const getColorFromClass = (colorClass: string) => {
    const colorMap: { [key: string]: string } = {
      'bg-blue-500 border-blue-600 text-white': '#3b82f6',
      'bg-green-500 border-green-600 text-white': '#10b981',
      'bg-yellow-500 border-yellow-600 text-black': '#eab308',
      'bg-purple-500 border-purple-600 text-white': '#8b5cf6',
      'bg-pink-500 border-pink-600 text-white': '#ec4899',
      'bg-indigo-500 border-indigo-600 text-white': '#6366f1',
      'bg-red-500 border-red-600 text-white': '#ef4444',
      'bg-orange-500 border-orange-600 text-white': '#f97316',
      'bg-cyan-500 border-cyan-600 text-white': '#06b6d4',
      'bg-lime-500 border-lime-600 text-black': '#84cc16',
      'bg-gray-500 border-gray-600 text-white': '#6b7280',
      'bg-slate-500 border-slate-600 text-white': '#64748b'
    }
    return colorMap[colorClass] || '#6b7280'
  }

  // 현재 월의 첫 번째 날과 마지막 날 계산 (dayjs)
  const firstDayOfMonth = useMemo(() => dayjs(currentDate).startOf('month'), [currentDate])
  const lastDayOfMonth = useMemo(() => dayjs(currentDate).endOf('month'), [currentDate])
  
  // 오늘 날짜 확인 함수
  const isToday = (dateString: string) => {
    const todayString = dayjs().format('YYYY-MM-DD')
    return dateString === todayString
  }

  // Off 날짜 확인 함수 (pending 변경사항 포함)
  const isOffDate = useCallback((teamMemberId: string, dateString: string) => {
    // teamMemberId를 team_email로 변환
    const teamMember = teamMembers.find(member => member.email === teamMemberId)
    if (!teamMember) return false
    
    // 기존 오프 스케줄 확인
    const existingOffSchedule = offSchedules.some(off => 
      off.team_email === teamMember.email && off.off_date === dateString
    )
    
    // pending 변경사항 확인 (삭제 예정인 경우 제외)
    const key = `${teamMember.email}_${dateString}`
    const pendingChange = pendingOffScheduleChanges[key]
    const isPendingDelete = pendingChange?.action === 'delete'
    const isPendingApprove = pendingChange?.action === 'approve'
    
    // 기존 오프 스케줄이 있고 삭제 예정이 아니거나, 승인 예정인 경우
    return (existingOffSchedule && !isPendingDelete) || isPendingApprove
  }, [teamMembers, offSchedules, pendingOffScheduleChanges])

  // 상품 ID에 따른 멀티데이 투어 일수 계산
  const getMultiDayTourDays = (productId: string): number => {
    const multiDayPatterns = {
      'MNGC1N': 2,  // 1박2일
      'MNM1': 2,    // 1박2일
      'MNGC2N': 3,  // 2박3일
      'MNGC3N': 4,  // 3박4일
    }
    
    // 정확한 매치 확인
    if (multiDayPatterns[productId as keyof typeof multiDayPatterns]) {
      return multiDayPatterns[productId as keyof typeof multiDayPatterns]
    }
    
    // 패턴 매치 확인 (MNGC1N, MNM1 등으로 시작하는 경우)
    if (productId.startsWith('MNGC1N') || productId.startsWith('MNM1')) {
      return 2
    }
    if (productId.startsWith('MNGC2N')) {
      return 3
    }
    if (productId.startsWith('MNGC3N')) {
      return 4
    }
    
    return 1 // 기본값: 1일 투어
  }

  
  // 월의 모든 날짜 생성
  const monthDays = useMemo(() => {
    const days = [] as { date: number; dateString: string; dayOfWeek: string }[]
    const daysInMonth = dayjs(currentDate).daysInMonth()
    const dowMap = ['일', '월', '화', '수', '목', '금', '토']
    for (let i = 1; i <= daysInMonth; i++) {
      const d = dayjs(currentDate).date(i)
      days.push({
        date: i,
        dateString: d.format('YYYY-MM-DD'),
        dayOfWeek: dowMap[d.day()]
      })
    }
    return days
  }, [currentDate])

  // 날짜 컬럼 공통 스타일 계산: 최소 40px, 남는 공간은 균등 분배
  const fixedSideColumnsPx = 160 // 좌측 라벨 80 + 우측 합계 80
  const dayColumnWidthCalc = useMemo(() => `calc((100% - ${fixedSideColumnsPx}px) / ${monthDays.length})`, [monthDays.length])
  const dynamicMinTableWidthPx = useMemo(() => fixedSideColumnsPx + monthDays.length * 40, [monthDays.length])

  // 미 배정된 투어 가져오기
  const fetchUnassignedTours = useCallback(async () => {
    try {
      const startDate = firstDayOfMonth.subtract(3, 'day').format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.format('YYYY-MM-DD')
      
      // 가이드나 어시스턴트가 배정되지 않은 투어들 (특정 상태 제외)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unassignedToursData, error } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('tours' as any)
        .select(`
          *,
          products!inner(name)
        `)
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)
        .or('tour_guide_id.is.null,tour_guide_id.eq.')
        .not('tour_status', 'like', 'canceled%')
        .not('tour_status', 'like', 'Canceled%')
        .not('tour_status', 'eq', 'Deleted')
        .not('tour_status', 'eq', 'Requested for Delete')
        .order('tour_date', { ascending: true })

      if (error) {
        console.error('Error fetching unassigned tours:', error)
        return
      }

      setUnassignedTours(unassignedToursData || [])
    } catch (error) {
      console.error('Error fetching unassigned tours:', error)
    }
  }, [firstDayOfMonth, lastDayOfMonth])

  // 데이터 가져오기
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // 상품 데이터 가져오기 (Mania Tour, Mania Service만)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: productsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('products' as any)
        .select('*')
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .order('name')

      // 팀 멤버 데이터 가져오기
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: teamData } = await (supabase as any)
        .from('team')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      // 투어 데이터 가져오기 (현재 월)
      const startDate = firstDayOfMonth.subtract(3, 'day').format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.format('YYYY-MM-DD')
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: toursData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('tours' as any)
        .select('*, products(name)')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 예약 데이터 가져오기 (현재 월)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: reservationsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('reservations' as any)
        .select('*')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 고객 데이터 가져오기 (해당 예약의 고객만)
      let customersData: Pick<Customer, 'id' | 'language'>[] | null = []
      const customerIds = Array.from(new Set((reservationsData || []).map((r: { customer_id?: string | null }) => r.customer_id).filter(Boolean)))
      if (customerIds.length > 0) {
        const { data: customersFetched } = await supabase
          .from('customers')
          .select('id, language')
          .in('id', customerIds)
        customersData = customersFetched as Pick<Customer, 'id' | 'language'>[] | null
      }

      // 부킹(입장권) 데이터 가져오기: hover summary용 confirmed EA 합계 계산
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ticketBookingsData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('ticket_bookings' as any)
        .select('id, tour_id, status, ea')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)

      // Off 스케줄 데이터 가져오기 (현재 월) - pending과 approved 모두
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: offSchedulesData } = await (supabase as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('off_schedules' as any)
        .select('team_email, off_date, reason, status')
        .in('status', ['pending', 'approved'])
        .gte('off_date', firstDayOfMonth.format('YYYY-MM-DD'))
        .lte('off_date', lastDayOfMonth.format('YYYY-MM-DD'))

      console.log('=== ScheduleView 데이터 로딩 결과 ===')
      console.log('Loaded products:', productsData?.length || 0, productsData)
      console.log('Loaded team members:', teamData?.length || 0, teamData)
      console.log('Loaded tours:', toursData?.length || 0, toursData)
      console.log('Loaded reservations:', reservationsData?.length || 0, reservationsData)
      console.log('=====================================')

      setProducts(productsData || [])
      setTeamMembers(teamData || [])
      setTours(toursData || [])
      setReservations(reservationsData || [])
      setCustomers((customersData || []) as Customer[])
      setTicketBookings(ticketBookingsData || [])
      setOffSchedules(offSchedulesData || [])

      // 저장된 사용자 설정 불러오기 (오류가 발생해도 계속 진행)
      try {
        await loadUserSettings()
      } catch (settingsError) {
        console.warn('Failed to load user settings, continuing with default values:', settingsError)
      }

      // 미 배정된 투어 가져오기
      await fetchUnassignedTours()

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [firstDayOfMonth, lastDayOfMonth, loadUserSettings, fetchUnassignedTours])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 페이지 이탈 시 저장되지 않은 변경사항이 있으면 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingCount > 0) {
        e.preventDefault()
        e.returnValue = '저장되지 않은 변경사항이 있습니다. 페이지를 벗어나시겠습니까?'
        return '저장되지 않은 변경사항이 있습니다. 페이지를 벗어나시겠습니까?'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [pendingCount])

  // 상품별 색상 초기화 (products가 변경될 때만)
  useEffect(() => {
    if (products.length > 0) {
      setProductColors(prev => {
        const newColors = { ...prev }
        let hasChanges = false
        
        products.forEach((product, index) => {
          if (!newColors[product.id]) {
            newColors[product.id] = colorPalette[index % colorPalette.length].class
            hasChanges = true
          }
        })
        
        return hasChanges ? newColors : prev
      })
    }
  }, [products, colorPalette])

  // 고객 언어 맵 (customer_id -> ko 여부)
  const customerIdToIsKo = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const c of customers) {
      const lang = (c?.language || '').toString().toLowerCase()
      const isKo = lang === 'ko' || lang === 'kr' || lang === '한국어' || lang === 'korean'
      map.set(String(c.id), isKo)
    }
    return map
  }, [customers])

  // 상품별 스케줄 데이터 계산
  const productScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    // 고객 언어 맵: customer_id -> isKo
    const idToIsKo = new Map<string, boolean>()
    for (const c of customers) {
      const lang = (c?.language || '').toString().toLowerCase()
      const isKo = lang === 'ko' || lang === 'kr' || lang === '한국어' || lang === 'korean'
      idToIsKo.set(String(c.id), isKo)
    }

    const data: { [productId: string]: { product_name: string; dailyData: { [date: string]: { totalPeople: number; tours: number; koPeople: number; enPeople: number } }; totalPeople: number; totalTours: number } } = {}

    // 선택된 상품별로 데이터 생성
    selectedProducts.forEach(productId => {
      const product = products.find(p => p.id === productId)
      if (!product) return

      const productTours = tours.filter(tour => tour.product_id === productId)
      const dailyData: { [date: string]: { totalPeople: number; tours: number; koPeople: number; enPeople: number } } = {}
      let totalPeople = 0
      let totalTours = 0

      // 각 날짜별로 데이터 계산
      monthDays.forEach(({ dateString }) => {
        const dayTours = productTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.product_id === productId && 
          res.tour_date === dateString &&
          (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
        )

        const dayTotalPeople = dayReservations.reduce((sum, res) => sum + (res.total_people || 0), 0)
        const dayKoPeople = dayReservations.reduce((sum, res) => {
          const cid = String(res.customer_id || '')
          const isKo = idToIsKo.get(cid) === true
          return sum + (isKo ? (res.total_people || 0) : 0)
        }, 0)
        const dayEnPeople = Math.max(dayTotalPeople - dayKoPeople, 0)

        // 멀티데이 투어 처리: 시작일에만 인원 표시
        if (!dailyData[dateString]) {
          dailyData[dateString] = { totalPeople: 0, tours: 0, koPeople: 0, enPeople: 0 }
        }
        // 멀티데이든 1일 투어든, 해당 날짜(시작일)에만 합산
        dailyData[dateString].totalPeople += dayTotalPeople
        dailyData[dateString].koPeople += dayKoPeople
        dailyData[dateString].enPeople += dayEnPeople
        dailyData[dateString].tours += dayTours.length

        totalPeople += dayTotalPeople
        totalTours += dayTours.length
      })

      data[productId] = {
        product_name: product.name,
        dailyData,
        totalPeople,
        totalTours
      }
    })

    return data
  }, [tours, reservations, customers, products, selectedProducts, monthDays])

  // 가이드별 스케줄 데이터 계산
  const guideScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    const data: { [teamMemberId: string]: { team_member_name: string; position: string; dailyData: { [date: string]: DailyData }; totalPeople: number; totalAssignedPeople: number; totalTours: number } } = {}
    const teamMap = new Map(teamMembers.map(t => [t.email, t]))

    // 상품별 색상 정의 (기본값 - 원색)
    const defaultProductColors = [
      'bg-blue-500 border-blue-600 text-white',
      'bg-green-500 border-green-600 text-white',
      'bg-yellow-500 border-yellow-600 text-black',
      'bg-purple-500 border-purple-600 text-white',
      'bg-pink-500 border-pink-600 text-white',
      'bg-indigo-500 border-indigo-600 text-white',
      'bg-red-500 border-red-600 text-white',
      'bg-orange-500 border-orange-600 text-white'
    ]

    // 선택된 팀 멤버별로 데이터 생성
    selectedTeamMembers.forEach(teamMemberId => {
      const teamMember = teamMap.get(teamMemberId)
      if (!teamMember) return

      const memberTours = tours.filter(tour => 
        tour.tour_guide_id === teamMemberId || tour.assistant_id === teamMemberId
      )

      const dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number; productColors: { [productId: string]: string }; role: string | null; guideInitials: string | null; isMultiDay: boolean; multiDayDays: number } } = {}
      let totalPeople = 0
      let totalAssignedPeople = 0
      let totalTours = 0

      // 각 날짜별로 데이터 계산
      monthDays.forEach(({ dateString }) => {
        const dayTours = memberTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.tour_date === dateString &&
          (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
        )

        const dayTotalPeople = dayReservations.reduce((sum, res) => sum + (res.total_people || 0), 0)
        
        const dayAssignedPeople = dayTours.reduce((sum, tour) => {
          if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return sum
          const assignedReservations = dayReservations.filter(res => 
            tour.reservation_ids.includes(res.id)
          )
          return sum + assignedReservations.reduce((s, res) => s + (res.total_people || 0), 0)
        }, 0)

        // 역할과 가이드 초성 정보 추가
        const isGuide = dayTours.some(tour => tour.tour_guide_id === teamMemberId)
        const isAssistant = dayTours.some(tour => tour.assistant_id === teamMemberId)
        const role = isGuide ? 'guide' : isAssistant ? 'assistant' : null

        // 가이드 초성 추출 (어시스턴트인 경우)
        let guideInitials = null
        if (isAssistant) {
          const guideTour = dayTours.find(tour => tour.assistant_id === teamMemberId)
          if (guideTour && guideTour.tour_guide_id) {
            const guide = teamMap.get(guideTour.tour_guide_id)
            if (guide) {
              guideInitials = guide.name_ko.split('').map((char: string) => char.charAt(0)).join('').substring(0, 2)
            }
          }
        }

        // 멀티데이 투어와 1일 투어를 분리하여 처리
        const multiDayTours = dayTours.filter(tour => getMultiDayTourDays(tour.product_id) > 1)
        const singleDayTours = dayTours.filter(tour => getMultiDayTourDays(tour.product_id) === 1)
        
        // 멀티데이 투어 처리 - 시작일만 표시
        if (multiDayTours.length > 0) {
          const tour = multiDayTours[0] // 첫 번째 멀티데이 투어만 사용
          const multiDayDays = getMultiDayTourDays(tour.product_id)
          
          dailyData[dateString] = {
            totalPeople: dayTotalPeople,
            assignedPeople: dayAssignedPeople,
            tours: 1,
            productColors: { [tour.product_id]: productColors[tour.product_id] || 'bg-gray-500' },
            role: role,
            guideInitials: guideInitials,
            isMultiDay: true,
            multiDayDays: multiDayDays
          } as DailyData
          
          // 다음달로 이어지는 투어의 경우 현재 월의 마지막 날까지 표시
          const start = dayjs(dateString)
          const end = start.add(multiDayDays - 1, 'day')
          const monthEnd = dayjs(currentDate).endOf('month')
          if (end.isAfter(monthEnd, 'day')) {
            const daysInCurrentMonth = monthEnd.diff(start, 'day') + 1
            dailyData[dateString].multiDayDays = daysInCurrentMonth
            ;(dailyData[dateString] as DailyData).extendsToNextMonth = true
          } else {
            dailyData[dateString].multiDayDays = multiDayDays
            ;(dailyData[dateString] as DailyData).extendsToNextMonth = false
          }
          
          // 멀티데이 투어의 경우 실제 투어 일수만큼 합계에 추가 (OFF 스케줄 제외)
          if (!isOffDate(teamMemberId, dateString)) {
            // 멀티데이 투어의 경우 실제 투어 일수만큼 계산
            const actualTourDays = Math.min(multiDayDays, monthDays.length - monthDays.findIndex(d => d.dateString === dateString))
            totalPeople += dayTotalPeople * actualTourDays
            totalAssignedPeople += dayAssignedPeople * actualTourDays
            totalTours += actualTourDays
          }
        }
        
        // 1일 투어 처리
        if (singleDayTours.length > 0) {
          if (!dailyData[dateString]) {
            dailyData[dateString] = {
              totalPeople: 0,
              assignedPeople: 0,
              tours: 0,
              productColors: {},
              role: null,
              guideInitials: null,
              isMultiDay: false,
              multiDayDays: 1
            }
          }
          
          // 멀티데이 투어가 없는 경우에만 1일 투어 데이터 추가
          if (!multiDayTours.length) {
            dailyData[dateString].totalPeople += dayTotalPeople
            dailyData[dateString].assignedPeople += dayAssignedPeople
            dailyData[dateString].tours += singleDayTours.length
            dailyData[dateString].role = role
            dailyData[dateString].guideInitials = guideInitials
            dailyData[dateString].isMultiDay = false
            dailyData[dateString].multiDayDays = 1
            
            // 상품별 색상 매핑
            singleDayTours.forEach((tour) => {
              const productId = tour.product_id
              if (!dailyData[dateString].productColors[productId]) {
                const productIndex = selectedProducts.indexOf(productId)
                dailyData[dateString].productColors[productId] = productColors[productId] || defaultProductColors[productIndex % defaultProductColors.length]
              }
            })
            
            // 1일 투어의 경우 OFF 스케줄이 아닌 날에만 합계에 추가
            if (!isOffDate(teamMemberId, dateString)) {
              totalPeople += dayTotalPeople
              totalAssignedPeople += dayAssignedPeople
              totalTours += singleDayTours.length
            }
          }
        }
      })

      data[teamMemberId] = {
        team_member_name: teamMember.name_ko,
        position: teamMember.position || '',
        dailyData,
        totalPeople,
        totalAssignedPeople,
        totalTours
      }
    })

    return data
  }, [tours, reservations, teamMembers, selectedProducts, selectedTeamMembers, monthDays, productColors, currentDate, isOffDate])

  // 월 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // 상품 선택 토글
  const toggleProduct = async (productId: string) => {
    const newSelection = selectedProducts.includes(productId) 
      ? selectedProducts.filter(id => id !== productId)
      : [...selectedProducts, productId]
    
    setSelectedProducts(newSelection)
    
    // 데이터베이스에 저장 (빈 배열이 아닐 때만)
    if (newSelection.length > 0) {
      await saveUserSetting('schedule_selected_products', newSelection)
    }
    
    // 로컬 스토리지에는 항상 저장 (fallback)
    localStorage.setItem('schedule_selected_products', JSON.stringify(newSelection))
  }

  // 팀 멤버 선택 토글
  const toggleTeamMember = async (teamMemberId: string) => {
    const newSelection = selectedTeamMembers.includes(teamMemberId) 
      ? selectedTeamMembers.filter(id => id !== teamMemberId)
      : [...selectedTeamMembers, teamMemberId]
    
    setSelectedTeamMembers(newSelection)
    
    // 데이터베이스에 저장 (빈 배열이 아닐 때만)
    if (newSelection.length > 0) {
      await saveUserSetting('schedule_selected_team_members', newSelection)
    }
    
    // 로컬 스토리지에는 항상 저장 (fallback)
    localStorage.setItem('schedule_selected_team_members', JSON.stringify(newSelection))
  }

  // 상품 순서 변경
  const moveProduct = async (fromIndex: number, toIndex: number) => {
    const newSelection = [...selectedProducts]
    const [movedItem] = newSelection.splice(fromIndex, 1)
    newSelection.splice(toIndex, 0, movedItem)
    
    setSelectedProducts(newSelection)
    
    // 데이터베이스에 저장
    await saveUserSetting('schedule_selected_products', newSelection)
    
    // 로컬 스토리지에도 저장 (fallback)
    localStorage.setItem('schedule_selected_products', JSON.stringify(newSelection))
  }

  // 팀원 순서 변경
  const moveTeamMember = async (fromIndex: number, toIndex: number) => {
    const newSelection = [...selectedTeamMembers]
    const [movedItem] = newSelection.splice(fromIndex, 1)
    newSelection.splice(toIndex, 0, movedItem)
    
    setSelectedTeamMembers(newSelection)
    
    // 데이터베이스에 저장
    await saveUserSetting('schedule_selected_team_members', newSelection)
    
    // 로컬 스토리지에도 저장 (fallback)
    localStorage.setItem('schedule_selected_team_members', JSON.stringify(newSelection))
  }

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, tour: Tour) => {
    setDraggedTour(tour)
    e.dataTransfer.effectAllowed = 'move'
    
    // 드래그 시 표시할 투어 정보 설정
    const tourInfo = `${tour.products?.name || 'N/A'} (${tour.tour_date})`
    e.dataTransfer.setData('text/plain', tourInfo)
    // 같은 날짜 찾기 쉽게 하이라이트
    if (tour.tour_date) {
      setHighlightedDate(tour.tour_date)
    }
  }

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCell(cellKey)
  }

  // 드래그 리브
  const handleDragLeave = () => {
    setDragOverCell(null)
  }


  // 오프 스케줄 삭제 (더블클릭)
  // 오프 스케줄 삭제 (배치 저장용)
  const handleOffScheduleDelete = (offSchedule: { team_email: string; off_date: string; reason: string; status: string }) => {
    const key = `${offSchedule.team_email}_${offSchedule.off_date}`
    setPendingOffScheduleChanges(prev => ({
      ...prev,
      [key]: {
        ...offSchedule,
        action: 'delete'
      }
    }))
    showMessage('삭제 대기', '오프 스케줄 삭제가 대기 목록에 추가되었습니다. 저장 버튼을 눌러 변경사항을 저장하세요.', 'success')
  }

  // 오프 스케줄 승인 (배치 저장용)
  const handleOffScheduleApprove = (offSchedule: { team_email: string; off_date: string; reason: string; status: string }) => {
    const key = `${offSchedule.team_email}_${offSchedule.off_date}`
    setPendingOffScheduleChanges(prev => ({
      ...prev,
      [key]: {
        ...offSchedule,
        action: 'approve'
      }
    }))
    showMessage('승인 대기', '오프 스케줄 승인이 대기 목록에 추가되었습니다. 저장 버튼을 눌러 변경사항을 저장하세요.', 'success')
  }

  // 오프 스케줄 생성
  const handleCreateOffSchedule = async (teamMemberId: string, dateString: string) => {
    try {
      const { error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('off_schedules' as any)
        .insert({
          id: crypto.randomUUID(), // UUID 생성
          team_email: teamMemberId,
          off_date: dateString,
          reason: '더블클릭으로 생성',
          status: 'pending'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)

      if (error) {
        console.error('Error creating off schedule:', error)
        showMessage('생성 실패', '오프 스케줄 생성에 실패했습니다.', 'error')
        return
      }

      // 성공 시 데이터 새로고침
      await fetchData()
      showMessage('생성 완료', '오프 스케줄이 생성되었습니다.', 'success')
      
    } catch (error) {
      console.error('Error creating off schedule:', error)
      showMessage('오류 발생', '오프 스케줄 생성 중 오류가 발생했습니다.', 'error')
    }
  }

  // 드롭 처리
  const handleDrop = async (e: React.DragEvent, teamMemberId: string, dateString: string, role: 'guide' | 'assistant') => {
    e.preventDefault()
    setDragOverCell(null)
    
    if (!draggedTour) return

    // 날짜가 다른 셀에는 드롭 불가
    if (draggedTour.tour_date !== dateString) {
      alert('투어 날짜와 다른 날짜에는 배정할 수 없습니다. 같은 날짜 셀에만 드롭하세요.')
      return
    }

    try {
      // 즉시 저장 대신 변경 누적 + 로컬 미리보기 반영
      // draggedRole이 있으면 우선 사용 (가이드/어시스턴트 재배정 구분)
      const effectiveRole = draggedRole || role
      const updateData: Partial<Tour> = {}
      if (effectiveRole === 'guide') {
        updateData.tour_guide_id = teamMemberId
      } else if (effectiveRole === 'assistant') {
        updateData.assistant_id = teamMemberId
      }

      setPendingChanges(prev => ({
        ...prev,
        [draggedTour.id]: {
          ...(prev[draggedTour.id] || {}),
          ...updateData
        }
      }))

      // tours 상태에 즉시 반영하여 화면에서 미리보기 가능하게 함
      setTours(prev => prev.map(t => t.id === draggedTour.id ? { ...t, ...updateData } : t))
    } finally {
      setDraggedTour(null)
      setHighlightedDate(null)
      setDraggedRole(null)
    }
  }

  // 미배정 영역으로 드롭 처리 (배정 해제)
  const handleUnassignDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverCell(null)
    
    if (!draggedTour) return

    try {
      // 즉시 저장 대신 변경 누적 (해제)
      setPendingChanges(prev => ({
        ...prev,
        [draggedTour.id]: {
          ...(prev[draggedTour.id] || {}),
          tour_guide_id: null,
          assistant_id: null
        }
      }))

      // tours 상태에도 반영
      setTours(prev => prev.map(t => t.id === draggedTour.id ? { ...t, tour_guide_id: null, assistant_id: null } : t))

      // 미배정 목록에 추가 (이미 있지 않은 경우)
      setUnassignedTours(prev => {
        const exists = prev.some(t => t.id === draggedTour.id)
        const updatedTour = { ...draggedTour, tour_guide_id: null, assistant_id: null }
        return exists ? prev.map(t => t.id === draggedTour.id ? updatedTour : t) : [...prev, updatedTour]
      })
    } finally {
      setDraggedTour(null)
      setHighlightedDate(null)
    }
  }

  // 투어 상세 페이지로 이동
  const handleTourDoubleClick = (tourId: string) => {
    const pathLocale = locale || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '')
    const href = `/${pathLocale}/admin/tours/${tourId}`
    window.open(href, '_blank')
  }

  // 미 배정된 투어들을 가이드/어시스턴트 배정 카드로 변환
  const unassignedTourCards = useMemo(() => {
    const cards: Array<{
      id: string
      tour: Tour
      role: 'guide' | 'assistant'
      title: string
      isAssigned: boolean
    }> = []
    
    unassignedTours.forEach(tour => {
      const product = products.find(p => p.id === tour.product_id)
      const productName = product?.name || 'N/A'
      const tourDate = dayjs(tour.tour_date).format('MM월 DD일')
      const baseTitle = `${tourDate} ${productName}`
      
      // 가이드가 배정되지 않은 경우 가이드 카드 추가
      if (!tour.tour_guide_id) {
        cards.push({
          id: `${tour.id}-guide`,
          tour,
          role: 'guide',
          title: `${baseTitle} - 가이드`,
          isAssigned: false
        })
      }
      
      // team_type이 1guide가 아니고 어시스턴트가 배정되지 않은 경우에만 어시스턴트 카드 추가
      if (tour.team_type !== '1guide' && !tour.assistant_id) {
        cards.push({
          id: `${tour.id}-assistant`,
          tour,
          role: 'assistant',
          title: `${baseTitle} - 어시스턴트`,
          isAssigned: false
        })
      }
    })
    
    // 날짜순, 상품명순으로 정렬
    return cards.sort((a, b) => {
      const dateCompare = a.tour.tour_date.localeCompare(b.tour.tour_date)
      if (dateCompare !== 0) return dateCompare
      
      const productA = products.find(p => p.id === a.tour.product_id)
      const productB = products.find(p => p.id === b.tour.product_id)
      return (productA?.name || '').localeCompare(productB?.name || '')
    })
  }, [unassignedTours, products])

  // 미 배정된 투어 카드 드래그 시작
  const handleUnassignedTourCardDragStart = (e: React.DragEvent, card: { tour: Tour; role: 'guide' | 'assistant' }) => {
    setDraggedUnassignedTour(card.tour)
    setHighlightedDate(card.tour.tour_date) // 해당 날짜 하이라이트
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify({
      tourId: card.tour.id,
      role: card.role
    }))
  }

  // 미 배정된 투어 드래그 종료
  const handleUnassignedTourDragEnd = () => {
    setDraggedUnassignedTour(null)
    setDragOverCell(null)
    setHighlightedDate(null) // 하이라이트 제거
  }

  // 가이드/어시스턴트 셀에 드롭
  const handleGuideCellDrop = async (e: React.DragEvent, teamMemberId: string, dateString: string, role: 'guide' | 'assistant') => {
    e.preventDefault()
    
    if (!draggedUnassignedTour) return
    
    try {
      // 즉시 저장 대신 변경 누적
      const updateData: Partial<Tour> = {
        tour_date: dateString
      }
      if (role === 'guide') {
        updateData.tour_guide_id = teamMemberId
      } else if (role === 'assistant') {
        updateData.assistant_id = teamMemberId
      }

      setPendingChanges(prev => ({
        ...prev,
        [draggedUnassignedTour.id]: {
          ...(prev[draggedUnassignedTour.id] || {}),
          ...updateData
        }
      }))

      // tours 상태 업데이트
      setTours(prev => prev.map(t => t.id === draggedUnassignedTour.id ? { ...t, ...updateData } : t))

      // 미배정 목록 업데이트 (투어 전체 제거 대신 역할별 필요 여부에 따라 유지)
      setUnassignedTours(prev => {
        const exists = prev.some(t => t.id === draggedUnassignedTour.id)
        if (!exists) return prev
        return prev
          .map(t => {
            if (t.id !== draggedUnassignedTour.id) return t
            const updated = { ...t, ...updateData }
            const needsGuide = !updated.tour_guide_id
            const needsAssistant = updated.team_type !== '1guide' && !updated.assistant_id
            return needsGuide || needsAssistant ? updated : null
          })
          .filter(Boolean) as Tour[]
      })
    } finally {
      setDraggedUnassignedTour(null)
      setDragOverCell(null)
      setHighlightedDate(null)
    }
  }


  // 투어 요약 정보 생성
  const getTourSummary = (tour: Tour) => {
    const productName = tour.products?.name || 'N/A'
    const tourDate = tour.tour_date
    
    // 인원 계산 (Recruiting/Confirmed 상태만)
    const dayReservations = reservations.filter(r => 
      r.tour_date === tour.tour_date && 
      r.product_id === tour.product_id &&
      (r.status?.toLowerCase() === 'confirmed' || r.status?.toLowerCase() === 'recruiting')
    )
    const totalPeopleAll = dayReservations.reduce((s, r) => s + (r.total_people || 0), 0)
    let assignedPeople = 0
    let assignedKo = 0
    if (tour.reservation_ids && Array.isArray(tour.reservation_ids)) {
      const assigned = dayReservations.filter(r => tour.reservation_ids!.includes(r.id))
      assignedPeople = assigned.reduce((s, r) => s + (r.total_people || 0), 0)
      assignedKo = assigned.reduce((s, r) => {
        const cid = String(r.customer_id || '')
        const isKo = customerIdToIsKo.get(cid) === true
        return s + (isKo ? (r.total_people || 0) : 0)
      }, 0)
    }
    const assignedEn = Math.max(assignedPeople - assignedKo, 0)

    // 가이드/어시스턴트 이름
    const guide = teamMembers.find(t => t.email === tour.tour_guide_id)
    const assistant = teamMembers.find(t => t.email === tour.assistant_id)
    const guideName = guide?.name_ko || '-'
    const assistantName = assistant?.name_ko || '-'

    // 차량 번호(가능한 필드 우선 사용)
    const vehicleNumber = tour.vehicle_number || tour.vehicle_id || '-'
    const vehicleAssigned = tour.tour_car_id && String(tour.tour_car_id).trim().length > 0

    // 부킹 Confirm EA 합계
    const confirmedEa = ticketBookings
      .filter(tb => tb.tour_id === tour.id && (tb.status === 'confirmed' || tb.status === 'paid'))
      .reduce((s, tb) => s + (tb.ea || 0), 0)

    // 단독투어 여부 확인
    const isPrivateTour = tour.is_private_tour === 'TRUE' || tour.is_private_tour === true

    return [
      `투어: ${productName}${isPrivateTour ? ' (단독투어)' : ''}`,
      `날짜: ${tourDate}`,
      `인원: ${assignedPeople} / ${totalPeopleAll}`,
      `배정 언어: ko ${assignedKo} / en ${assignedEn}`,
      `가이드: ${guideName}`,
      `어시스턴트: ${assistantName}`,
      `차량: ${vehicleNumber}`,
      `배차: ${vehicleAssigned ? '배차 완료' : '미배차'}`,
      `Confirm EA: ${confirmedEa}`
    ].join('\n')
  }

  // 상품별 총계 계산
  const productTotals = useMemo(() => {
    const dailyTotals: { [date: string]: { totalPeople: number; tours: number } } = {}
    
    monthDays.forEach(({ dateString }) => {
      dailyTotals[dateString] = { totalPeople: 0, tours: 0 }
    })

    Object.values(productScheduleData).forEach(product => {
      monthDays.forEach(({ dateString }) => {
        const dayData = product.dailyData[dateString]
        if (dayData) {
          dailyTotals[dateString].totalPeople += dayData.totalPeople
          dailyTotals[dateString].tours += dayData.tours
        }
      })
    })

    return dailyTotals
  }, [productScheduleData, monthDays])

  // 가이드별 총계 계산
  const guideTotals = useMemo(() => {
    const dailyTotals: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } } = {}
    
    monthDays.forEach(({ dateString }) => {
      dailyTotals[dateString] = { totalPeople: 0, assignedPeople: 0, tours: 0 }
    })

    Object.values(guideScheduleData).forEach(guide => {
      monthDays.forEach(({ dateString }) => {
        const dayData = guide.dailyData[dateString]
        if (dayData) {
          // 멀티데이 투어의 경우 실제 투어 일수만큼 계산
          if (dayData.isMultiDay) {
            const actualTourDays = Math.min(dayData.multiDayDays, monthDays.length - monthDays.findIndex(d => d.dateString === dateString))
            dailyTotals[dateString].totalPeople += dayData.totalPeople * actualTourDays
            // assistant는 제외하고 guide 역할의 배정 인원만 합산
            const assignedForGuides = dayData.role === 'guide' ? dayData.assignedPeople : 0
            dailyTotals[dateString].assignedPeople += assignedForGuides * actualTourDays
            dailyTotals[dateString].tours += actualTourDays
          } else {
            dailyTotals[dateString].totalPeople += dayData.totalPeople
            // assistant는 제외하고 guide 역할의 배정 인원만 합산
            const assignedForGuides = dayData.role === 'guide' ? dayData.assignedPeople : 0
            dailyTotals[dateString].assignedPeople += assignedForGuides
            dailyTotals[dateString].tours += dayData.tours
          }
        }
      })
    })

    return dailyTotals
  }, [guideScheduleData, monthDays])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md border p-2">
      {/* 헤더 */}
      <div className="mb-2">
        {/* 메인 헤더 - 모든 요소를 한 줄에 배치 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {/* 왼쪽: 선택 버튼들 (제목 제거) */}
          <div className="flex items-center gap-2 flex-1">
            {/* 선택 버튼들 */}
            <div className="flex gap-2">
              {/* 상품 선택 버튼 */}
              <button
                onClick={() => setShowProductModal(true)}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors relative"
                title={`상품 선택 (${selectedProducts.length}개)`}
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                {selectedProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {selectedProducts.length}
                  </span>
                )}
              </button>

              {/* 팀원 선택 버튼 */}
              <button
                onClick={() => setShowTeamModal(true)}
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors relative"
                title={`팀원 선택 (${selectedTeamMembers.length}개)`}
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                {selectedTeamMembers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {selectedTeamMembers.length}
                  </span>
                )}
              </button>

            </div>
          </div>

          {/* 오른쪽: 월 이동/저장 버튼들 */}
          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            {/* 대기 변경 배지 및 버튼 */}
            {pendingCount > 0 && (
              <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full">
                변경 {pendingCount}건 대기중
              </span>
            )}
            <button
              onClick={async () => {
                // 일괄 저장: pendingChanges와 pendingOffScheduleChanges를 순회하며 업데이트
                try {
                  // 투어 변경사항 저장
                  const tourEntries = Object.entries(pendingChanges)
                  for (const [tourId, updateData] of tourEntries) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error } = await (supabase as any)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .from('tours' as any)
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      .update(updateData as any)
                      .eq('id', tourId)
                    if (error) {
                      console.error('Batch save error:', error)
                      showMessage('저장 실패', '일부 변경사항 저장에 실패했습니다.', 'error')
                      return
                    }
                  }

                  // 오프 스케줄 변경사항 저장
                  const offScheduleEntries = Object.entries(pendingOffScheduleChanges)
                  for (const [, change] of offScheduleEntries) {
                    if (change.action === 'approve') {
                      // 오프 스케줄 승인
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .from('off_schedules' as any)
                        .update({ status: 'approved' })
                        .eq('team_email', change.team_email)
                        .eq('off_date', change.off_date)
                      if (error) {
                        console.error('Off schedule approve error:', error)
                        showMessage('저장 실패', '오프 스케줄 승인에 실패했습니다.', 'error')
                        return
                      }
                    } else if (change.action === 'delete') {
                      // 오프 스케줄 삭제
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const { error } = await (supabase as any)
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        .from('off_schedules' as any)
                        .delete()
                        .eq('team_email', change.team_email)
                        .eq('off_date', change.off_date)
                      if (error) {
                        console.error('Off schedule delete error:', error)
                        showMessage('저장 실패', '오프 스케줄 삭제에 실패했습니다.', 'error')
                        return
                      }
                    }
                  }

                  // 모든 변경사항 초기화
                  setPendingChanges({})
                  setPendingOffScheduleChanges({})
                  await fetchData()
                  await fetchUnassignedTours()
                  showMessage('저장 완료', '변경사항이 저장되었습니다.', 'success')
                } catch (err) {
                  console.error('Batch save unexpected error:', err)
                  showMessage('오류', '변경사항 저장 중 오류가 발생했습니다.', 'error')
                }
              }}
              disabled={pendingCount === 0}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap ${pendingCount === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              저장
            </button>
            <button
              onClick={async () => {
                setPendingChanges({})
                setPendingOffScheduleChanges({})
                await fetchData()
                await fetchUnassignedTours()
              }}
              disabled={pendingCount === 0}
              className={`px-2 py-1 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm whitespace-nowrap ${pendingCount === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-600 text-white hover:bg-gray-700'}`}
            >
              취소
            </button>
            <div className="flex items-center space-x-1 sm:space-x-4">
              <button
                onClick={goToPreviousMonth}
                className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <h3 className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
              </h3>
              <button
                onClick={goToNextMonth}
                className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap text-xs sm:text-sm"
            >
              오늘
            </button>
          </div>
        </div>
      </div>

      {/* 통합 스케줄 테이블 컨테이너 */}
      <div className="mb-4">
        {/* 드래그 가능한 스크롤 컨테이너 */}
        <div 
          className="relative overflow-x-auto scrollbar-hide border-2 border-dashed border-gray-300 rounded-lg p-2 bg-gray-50"
          id="unified-schedule-scroll"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* 드래그 안내 텍스트 제거 */}
          
          {/* 상품별 스케줄 테이블 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-blue-500" />
              상품별 투어 인원
            </h3>
            <div className="overflow-visible">
          <table className="w-full" style={{tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px`}}>
            <thead className="bg-blue-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  상품명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString }) => (
                  <th 
                    key={date} 
                    className={"p-0 text-center text-xs font-medium text-gray-700"}
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    <div className={`${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''} px-1 py-2`}>
                      <div className={isToday(dateString) ? 'font-bold text-red-700' : ''}>{date}일</div>
                      <div className={`text-xs ${isToday(dateString) ? 'text-red-600' : 'text-gray-500'}`}>{dayOfWeek}</div>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 각 상품별 데이터 */}
              {Object.entries(productScheduleData).map(([productId, product], index) => {
                const colorClass = productColors[productId] || colorPalette[index % colorPalette.length].class
                
                return (
                  <tr key={productId} className="hover:bg-gray-50">
                    <td className={`px-2 py-2 text-xs font-medium ${colorClass}`} style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                      {product.product_name}
                    </td>
                    {monthDays.map(({ dateString }) => {
                      const dayData = product.dailyData[dateString]
                      return (
                        <td 
                          key={dateString} 
                          className="p-0 text-center text-xs"
                          style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                        >
                          {(() => {
                            const langBgClass = dayData ? (() => {
                              const hasKo = (dayData.koPeople || 0) > 0
                              const hasEn = (dayData.enPeople || 0) > 0
                              if (hasKo && hasEn) return 'bg-orange-100'
                              if (hasKo) return 'bg-yellow-100'
                              if (hasEn) return 'bg-red-100'
                              return 'bg-white'
                            })() : 'bg-white'
                            const todayWrapClass = isToday(dateString)
                              ? `${langBgClass} border-l-2 border-r-2 border-red-500`
                              : langBgClass
                            const titleText = dayData ? `ko ${dayData.koPeople || 0} / en ${dayData.enPeople || 0}` : undefined
                            return (
                              <div className={`${todayWrapClass} px-1 py-2`} title={titleText}>
                                {dayData ? (
                                  <div className={`font-medium ${
                                    dayData.totalPeople === 0 
                                      ? 'text-gray-300' 
                                      : dayData.totalPeople < 4 
                                        ? 'text-blue-600' 
                                        : 'text-red-600'
                                  } ${isToday(dateString) ? 'text-red-700' : ''}`}>{dayData.totalPeople}</div>
                                ) : (
                                  <div className="text-gray-300">-</div>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                      )
                    })}
                <td className="px-2 py-2 text-center text-xs font-medium bg-white" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div className={`font-medium ${
                    product.totalPeople === 0 
                      ? 'text-gray-300' 
                      : product.totalPeople < 4 
                        ? 'text-blue-600' 
                        : 'text-red-600'
                  }`}>{product.totalPeople}</div>
                </td>
                  </tr>
                )
              })}

              {/* 상품별 총계 행 - 가장 아래로 이동 */}
              <tr className="bg-blue-100 font-semibold">
                <td className="px-2 py-2 text-xs text-gray-900" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = productTotals[dateString]
                  return (
                    <td 
                      key={dateString} 
                      className="p-0 text-center text-xs"
                      style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                    >
                      <div className={`${isToday(dateString) ? 'border-2 border-red-500 bg-red-50' : ''} px-1 py-2`}>
                        <div className={`font-medium ${
                          dayTotal.totalPeople === 0 
                            ? 'text-gray-300' 
                            : dayTotal.totalPeople < 4 
                              ? 'text-blue-600' 
                              : 'text-red-600'
                        } ${isToday(dateString) ? 'text-red-700' : ''}`}>{dayTotal.totalPeople}</div>
                      </div>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center text-xs font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div>{Object.values(productScheduleData).reduce((sum, product) => sum + product.totalPeople, 0)}</div>
                </td>
              </tr>
            </tbody>
          </table>
            </div>
          </div>
          {/* 가이드별 스케줄 테이블 */}
          <div>
            <div className="overflow-visible">
          <table className="w-full" style={{tableLayout: 'fixed', minWidth: `${dynamicMinTableWidthPx}px`}}>
            <thead className="bg-green-50 hidden">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  가이드명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString }) => (
                  <th 
                    key={date} 
                    className="p-0 text-center text-xs font-medium text-gray-700"
                    style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                  >
                    <div className={`${isToday(dateString) ? 'border-l-2 border-r-2 border-red-500 bg-red-50' : ''} px-1 py-2`}>
                      <div className={isToday(dateString) ? 'font-bold text-red-700' : ''}>{date}일</div>
                      <div className={`text-xs ${isToday(dateString) ? 'text-red-600' : 'text-gray-500'}`}>{dayOfWeek}</div>
                    </div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 가이드별 총계 행 */}
              <tr className="bg-green-100 font-semibold">
                <td className="px-2 py-2 text-xs text-gray-900" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = guideTotals[dateString]
                  return (
                    <td 
                      key={dateString} 
                      className={`px-1 py-2 text-center text-xs ${
                        isToday(dateString) 
                          ? 'border-2 border-red-500 bg-red-50' 
                          : ''
                      }`}
                      style={{ width: dayColumnWidthCalc, minWidth: '40px' }}
                    >
                      <div className={`font-medium ${
                        dayTotal.assignedPeople === 0 
                          ? 'text-gray-300' 
                          : dayTotal.assignedPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      } ${isToday(dateString) ? 'text-red-700' : ''}`}>{dayTotal.assignedPeople}</div>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center text-xs font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                  <div>{Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalAssignedPeople, 0)} ({Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalTours, 0)}일)</div>
                </td>
              </tr>

              {/* 각 가이드별 데이터 */}
              {Object.entries(guideScheduleData).map(([teamMemberId, guide]) => {
                // 멀티데이 투어 정보를 미리 계산
                const multiDayTours: { [dateString: string]: { startDate: string; endDate: string; days: number; extendsToNextMonth: boolean; dayData: DailyData } } = {}
                
                monthDays.forEach(({ dateString }) => {
                  const dayData = guide.dailyData[dateString]
                  if (dayData?.isMultiDay && dayData.multiDayDays >= 1) {
                    const start = dayjs(dateString)
                    const end = start.add(dayData.multiDayDays - 1, 'day')
                    const lastDayOfCurrentMonth = dayjs(currentDate).endOf('month')
                    const extendsToNextMonth = end.isAfter(lastDayOfCurrentMonth, 'day')
                    
                    multiDayTours[dateString] = {
                      startDate: dateString,
                      endDate: end.format('YYYY-MM-DD'),
                      days: dayData.multiDayDays,
                      extendsToNextMonth,
                      dayData
                    }
                  }
                })

                // 이전 달 말일에 시작하여 이번 달로 이어지는 멀티데이 투어 포함 (최대 3박4일 → 3일 이전까지 조회)
                const windowStart = dayjs(firstDayOfMonth).subtract(3, 'day')
                tours.filter(t => t.tour_guide_id === teamMemberId || t.assistant_id === teamMemberId).forEach(tour => {
                  const mdays = getMultiDayTourDays(tour.product_id)
                  if (mdays <= 1) return
                  const start = dayjs(tour.tour_date)
                  if (start.isBefore(firstDayOfMonth, 'day') && !start.isBefore(windowStart, 'day')) {
                    const end = start.add(mdays - 1, 'day')
                    // 이번 달에 걸쳐 있는 경우만 추가
                    if (!end.isBefore(firstDayOfMonth, 'day')) {
                      // 역할/인원/색상 계산 (Recruiting/Confirmed 상태만)
                      const dayReservations = reservations.filter(res => 
                        res.tour_date === start.format('YYYY-MM-DD') &&
                        (res.status?.toLowerCase() === 'confirmed' || res.status?.toLowerCase() === 'recruiting')
                      )
                      const assignedPeople = (() => {
                        if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return 0
                        const assigned = dayReservations.filter(res => tour.reservation_ids.includes(res.id))
                        return assigned.reduce((s, r) => s + (r.total_people || 0), 0)
                      })()
                      const role = tour.tour_guide_id === teamMemberId ? 'guide' : tour.assistant_id === teamMemberId ? 'assistant' : null
                      let guideInitials = null as string | null
                      if (role === 'assistant' && tour.tour_guide_id) {
                        const guideInfo = teamMembers.find(member => member.email === tour.tour_guide_id)
                        if (guideInfo) {
                          guideInitials = guideInfo.name_ko.split('').map((ch: string) => ch.charAt(0)).join('').substring(0, 2)
                        }
                      }
                      const lastDayOfCurrentMonth = dayjs(currentDate).endOf('month')
                      const extendsToNextMonth = end.isAfter(lastDayOfCurrentMonth, 'day')
                      const startKey = start.format('YYYY-MM-DD')
                      if (!multiDayTours[startKey]) {
                        multiDayTours[startKey] = {
                          startDate: startKey,
                          endDate: end.format('YYYY-MM-DD'),
                          days: mdays,
                          extendsToNextMonth,
                          dayData: {
                            totalPeople: 0,
                            assignedPeople,
                            tours: 1,
                            productColors: { [tour.product_id]: productColors[tour.product_id] || 'bg-gray-500' },
                            role,
                            guideInitials,
                            isMultiDay: true,
                            multiDayDays: mdays
                          }
                        }
                        
                        // 이전 달에서 시작한 멀티데이 투어의 경우 이번 달에 해당하는 일수만큼 합계에 추가
                        const daysInCurrentMonth = Math.min(mdays, lastDayOfCurrentMonth.diff(firstDayOfMonth, 'day') + 1)
                        if (daysInCurrentMonth > 0) {
                        // 이전 달에서 시작한 투어는 totalPeople이 0이므로 assignedPeople만 계산
                        // totalAssignedPeople += assignedPeople * daysInCurrentMonth
                        // totalTours += daysInCurrentMonth
                        }
                      }
                    }
                  }
                })
                
                return (
                  <tr key={teamMemberId} className="hover:bg-gray-50">
                    <td className="px-2 py-1 text-xs" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                      <div className="font-medium text-gray-900">{guide.team_member_name}</div>
                    </td>
                    <td className="p-0" colSpan={monthDays.length}>
                      <div className="relative">
                        <div className="grid" style={{gridTemplateColumns: `repeat(${monthDays.length}, minmax(40px, 1fr))`, width: '100%', minWidth: `calc(${monthDays.length} * 40px)`}}>
                          {monthDays.map(({ dateString }) => {
                          const dayData = guide.dailyData[dateString]
                          
                          // 멀티데이 투어의 연속된 날짜인지 확인하고 해당 투어 정보 가져오기
                          let continuationTour = null
                          for (const tour of Object.values(multiDayTours)) {
                            const tourStart = dayjs(tour.startDate)
                            const tourEnd = dayjs(tour.endDate)
                            const cur = dayjs(dateString)
                            if (cur.isAfter(tourStart, 'day') && (cur.isSame(tourEnd, 'day') || cur.isBefore(tourEnd, 'day'))) {
                              continuationTour = tour
                              break
                            }
                          }
                          
                          // 멀티데이 투어의 연속된 날짜인 경우: 셀 내용은 비워두고(드롭존만 유지), 상단 오버레이에서 하나의 박스로 표시
                          if (continuationTour && !dayData) {
                            return (
                              <div 
                                key={dateString} 
                                className={`px-1 py-0 text-center text-xs bg-white relative ${
                                  isToday(dateString) 
                                    ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                                    : ''
                                }`}
                                style={{ minWidth: '40px', boxSizing: 'border-box' }}
                              >
                                <div
                                  className={`relative h-[32px] ${
                                    dragOverCell === `${teamMemberId}-${dateString}-guide` 
                                      ? 'bg-blue-200 border-2 border-blue-400' 
                                      : ''
                                  }`}
                                  style={{ pointerEvents: 'auto' }}
                                  onDragOver={(e) => { 
                                    if (draggedTour && draggedTour.tour_date === dateString) {
                                      handleDragOver(e, `${teamMemberId}-${dateString}-guide`)
                                    } else if (draggedUnassignedTour) {
                                      handleDragOver(e, `${teamMemberId}-${dateString}-guide`)
                                    }
                                  }}
                                  onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                  try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
                                    
                                    if (draggedUnassignedTour) {
                                      // 미 배정 투어 배정
                                      const role = dragData.role || 'guide'
                                      handleGuideCellDrop(e, teamMemberId, dateString, role)
                                    } else {
                                      // 기존 투어 재배정
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  } catch {
                                    if (draggedUnassignedTour) {
                                      handleGuideCellDrop(e, teamMemberId, dateString, 'guide')
                                    } else {
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  }
                                }}
                                >
                                  {/* Off 날짜 표시 */}
                                  {isOffDate(teamMemberId, dateString) && !(() => {
                                    const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                    const key = `${teamMember?.email}_${dateString}`
                                    const pendingChange = pendingOffScheduleChanges[key]
                                    return pendingChange?.action === 'delete'
                                  })() ? (
                                    (() => {
                                      const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                      const offSchedule = teamMember ? offSchedules.find(off => 
                                        off.team_email === teamMember.email && off.off_date === dateString
                                      ) : null
                                      
                                      // pending 변경사항 확인
                                      const key = `${teamMember?.email}_${dateString}`
                                      const pendingChange = pendingOffScheduleChanges[key]
                                      
                                      const isPending = offSchedule?.status === 'pending' || pendingChange?.action === 'approve'
                                      const isApproved = offSchedule?.status === 'approved' && !pendingChange?.action
                                      
                                      return (
                                        <div 
                                          className={`${
                                            isPending 
                                              ? 'bg-gray-500 text-white hover:bg-gray-600' 
                                              : isApproved 
                                                ? 'bg-black text-white hover:bg-gray-800'
                                                : 'bg-gray-500 text-white hover:bg-gray-600'
                                          } rounded px-1 py-0.5 text-xs font-bold flex items-center justify-center h-full cursor-pointer transition-colors select-none`}
                                          onClick={() => {
                                            if (isPending) {
                                              showConfirm(
                                                '오프 스케줄 승인',
                                                '오프 스케줄을 승인하시겠습니까?',
                                                () => handleOffScheduleApprove(offSchedule!),
                                                '승인',
                                                'bg-green-500 hover:bg-green-600'
                                              )
                                            }
                                          }}
                                          onDoubleClick={() => {
                                            if (offSchedule) {
                                              showConfirm(
                                                '오프 스케줄 삭제',
                                                '오프 스케줄을 삭제하시겠습니까?',
                                                () => handleOffScheduleDelete(offSchedule),
                                                '삭제',
                                                'bg-red-500 hover:bg-red-600'
                                              )
                                            }
                                          }}
                                          title={`오프 스케줄 (${isPending ? '대기중' : isApproved ? '승인됨' : '알 수 없음'}) - ${isPending ? '클릭하여 승인' : ''} 더블클릭하여 삭제`}
                                          >
                                            OFF
                                          </div>
                                      )
                                    })()
                                  ) : (
                                    /* 이어지는 날짜는 오버레이에서 하나의 박스로 렌더링 */
                                    <div></div>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          
                          // 일반 셀 렌더링 (1일 투어 또는 멀티데이 투어 시작일)
                          return (
                            <div 
                              key={dateString} 
                              className={`px-1 py-0 text-center text-xs bg-white relative ${
                                isToday(dateString) 
                                  ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                                  : ''
                              } ${highlightedDate === dateString ? 'bg-yellow-200' : ''}`}
                              style={{ minWidth: '40px', boxSizing: 'border-box' }}
                            >
                              <div
                                className={`relative h-[32px] ${
                                  dragOverCell === `${teamMemberId}-${dateString}-guide` 
                                    ? 'bg-blue-200 border-2 border-blue-400' 
                                    : ''
                                }`}
                                style={{ 
                                  pointerEvents: 'auto',
                                  overflow: 'visible',
                                  position: 'relative'
                                }}
                                onDragOver={(e) => { 
                                  if (draggedTour && draggedTour.tour_date === dateString) {
                                    handleDragOver(e, `${teamMemberId}-${dateString}-guide`)
                                  } else if (draggedUnassignedTour) {
                                    handleDragOver(e, `${teamMemberId}-${dateString}-guide`)
                                  }
                                }}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => {
                                  try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
                                    
                                    if (draggedUnassignedTour) {
                                      // 미 배정 투어 배정
                                      const role = dragData.role || 'guide'
                                      handleGuideCellDrop(e, teamMemberId, dateString, role)
                                    } else {
                                      // 기존 투어 재배정
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  } catch {
                                    if (draggedUnassignedTour) {
                                      handleGuideCellDrop(e, teamMemberId, dateString, 'guide')
                                    } else {
                                      handleDrop(e, teamMemberId, dateString, 'guide')
                                    }
                                  }
                                }}
                              >
                                {dayData ? (
                                  <div className="relative h-full">
                                    {/* 상품별 배경색 표시 (텍스트 아래) - 멀티데이 시작일은 오버레이에서만 표시 */}
                                    {Object.keys(dayData.productColors).length > 0 && !dayData.isMultiDay && (
                                      <div className="absolute inset-0 pointer-events-none rounded" 
                                           style={{
                                             background: Object.values(dayData.productColors).length === 1 
                                               ? `linear-gradient(135deg, ${getColorFromClass(Object.values(dayData.productColors)[0])} 0%, ${getColorFromClass(Object.values(dayData.productColors)[0])} 100%)`
                                               : `linear-gradient(135deg, ${Object.values(dayData.productColors).map(color => getColorFromClass(color)).join(', ')})`
                                           }}>
                                      </div>
                                    )}
                                    
                                    {/* 가이드로 배정된 경우 - 인원 표시 */}
                                    {dayData.role === 'guide' && !dayData.isMultiDay && (() => {
                                      // 해당 날짜의 가이드 투어들 중 단독투어 여부 확인
                                      const guideTours = tours.filter(tour => 
                                        tour.tour_date === dateString && 
                                        tour.tour_guide_id === teamMemberId
                                      )
                                      const hasPrivateTour = guideTours.some(tour => 
                                        tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                                      )
                                      
                                      // 차량 배차 여부
                                      const hasUnassignedVehicle = guideTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                                      return (
                                        <div 
                                          className={`absolute inset-0 flex items-center justify-center gap-1 font-bold text-white px-2 py-0 text-xs rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                            dayData.assignedPeople === 0 
                                              ? 'bg-gray-400' 
                                              : 'bg-transparent'
                                          } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                                          style={{
                                            backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                              ? getColorFromClass(Object.values(dayData.productColors)[0])
                                              : undefined
                                          }}
                                          draggable
                                          onDragStart={(e) => {
                                            if (guideTours.length > 0) {
                                              setDraggedRole('guide')
                                              handleDragStart(e, guideTours[0])
                                            }
                                          }}
                                          onDoubleClick={() => {
                                            if (guideTours.length > 0) {
                                              handleTourDoubleClick(guideTours[0].id)
                                            }
                                          }}
                                          onClick={() => {
                                            if (guideTours.length > 0) {
                                              showGuideModalContent('투어 상세 정보', getTourSummary(guideTours[0]), guideTours[0].id)
                                            }
                                          }}
                                        >
                                          {hasUnassignedVehicle && (
                                            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                          )}
                                          {hasPrivateTour && <span>🔒</span>}
                                          <span>{dayData.assignedPeople}</span>
                                          {dayData.extendsToNextMonth && (
                                            <span className="text-xs opacity-75">→</span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                    
                                    {/* 어시스턴트로 배정된 경우 - 가이드 이름 초성 표시 */}
                                    {dayData.role === 'assistant' && !dayData.isMultiDay && (() => {
                                      // 해당 날짜의 어시스턴트 투어들 중 단독투어 여부 확인
                                      const assistantTours = tours.filter(tour => 
                                        tour.tour_date === dateString && 
                                        tour.assistant_id === teamMemberId
                                      )
                                      const hasPrivateTour = assistantTours.some(tour => 
                                        tour.is_private_tour === 'TRUE' || tour.is_private_tour === true
                                      )
                                      
                                      // 차량 배차 여부
                                      const hasUnassignedVehicle = assistantTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                                      return (
                                        <div 
                                          className={`absolute inset-0 flex items-center justify-center gap-1 font-bold text-white px-2 py-0 text-xs rounded z-10 cursor-pointer hover:opacity-80 transition-opacity ${
                                            dayData.assignedPeople === 0 
                                              ? 'bg-gray-400' 
                                              : 'bg-transparent'
                                          } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                                          style={{
                                            backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                              ? getColorFromClass(Object.values(dayData.productColors)[0])
                                              : undefined
                                          }}
                                          draggable
                                          onDragStart={(e) => {
                                            if (assistantTours.length > 0) {
                                              setDraggedRole('assistant')
                                              handleDragStart(e, assistantTours[0])
                                            }
                                          }}
                                          onDoubleClick={() => {
                                            if (assistantTours.length > 0) {
                                              handleTourDoubleClick(assistantTours[0].id)
                                            }
                                          }}
                                          onClick={() => {
                                            if (assistantTours.length > 0) {
                                              showGuideModalContent('투어 상세 정보', getTourSummary(assistantTours[0]), assistantTours[0].id)
                                            }
                                          }}
                                        >
                                          {hasUnassignedVehicle && (
                                            <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full" />
                                          )}
                                          {hasPrivateTour && <span>🔒</span>}
                                          <span>{dayData.guideInitials || 'A'}</span>
                                          {dayData.extendsToNextMonth && (
                                            <span className="text-xs opacity-75">→</span>
                                          )}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                ) : (
                                  <div className="text-gray-300 text-center py-1 text-xs">
                                    {/* Off 날짜 표시 */}
                                    {isOffDate(teamMemberId, dateString) && !(() => {
                                      const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                      const key = `${teamMember?.email}_${dateString}`
                                      const pendingChange = pendingOffScheduleChanges[key]
                                      return pendingChange?.action === 'delete'
                                    })() ? (
                                      (() => {
                                        const teamMember = teamMembers.find(member => member.email === teamMemberId)
                                        const offSchedule = teamMember ? offSchedules.find(off => 
                                          off.team_email === teamMember.email && off.off_date === dateString
                                        ) : null
                                        
                                        // pending 변경사항 확인
                                        const key = `${teamMember?.email}_${dateString}`
                                        const pendingChange = pendingOffScheduleChanges[key]
                                        
                                        const isPending = offSchedule?.status === 'pending' || pendingChange?.action === 'approve'
                                        const isApproved = offSchedule?.status === 'approved' && !pendingChange?.action
                                        
                                        return (
                                          <div 
                                            className={`${
                                              isPending 
                                                ? 'bg-gray-500 text-white hover:bg-gray-600' 
                                                : isApproved 
                                                  ? 'bg-black text-white hover:bg-gray-800'
                                                  : 'bg-gray-500 text-white hover:bg-gray-600'
                                            } rounded px-1 py-0.5 text-xs font-bold cursor-pointer transition-colors select-none`}
                                            onClick={() => {
                                              if (isPending) {
                                                showConfirm(
                                                  '오프 스케줄 승인',
                                                  '오프 스케줄을 승인하시겠습니까?',
                                                  () => handleOffScheduleApprove(offSchedule!),
                                                  '승인',
                                                  'bg-green-500 hover:bg-green-600'
                                                )
                                              }
                                            }}
                                            onDoubleClick={() => {
                                              if (offSchedule) {
                                                showConfirm(
                                                  '오프 스케줄 삭제',
                                                  '오프 스케줄을 삭제하시겠습니까?',
                                                  () => handleOffScheduleDelete(offSchedule),
                                                  '삭제',
                                                  'bg-red-500 hover:bg-red-600'
                                                )
                                              }
                                            }}
                                            title={`오프 스케줄 (${isPending ? '대기중' : isApproved ? '승인됨' : '알 수 없음'}) - ${isPending ? '클릭하여 승인' : ''} 더블클릭하여 삭제`}
                                          >
                                            OFF
                                          </div>
                                        )
                                      })()
                                    ) : (
                                      /* 드롭 영역 - 더블클릭으로 오프 스케줄 생성 */
                                      <div 
                                        className="h-full flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                                        onDoubleClick={() => handleCreateOffSchedule(teamMemberId, dateString)}
                                        title="더블클릭하여 오프 스케줄 생성"
                                      >
                                        <div className="text-gray-300 text-xs">+</div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                          })}
                        </div>
                        {Object.values(multiDayTours).map((tour, idx) => {
                          const start = dayjs(tour.startDate)
                          const monthStart = dayjs(firstDayOfMonth)
                          // 시작일이 이번 달 이전인 경우 보이는 시작 인덱스를 0으로 클램프
                          const diffFromMonthStart = start.diff(monthStart, 'day')
                          const visibleStartIdx = Math.max(0, diffFromMonthStart)
                          // 이전 달에서 시작했다면 그 만큼을 잘라내고 남은 일수만 표시
                          const cutDays = diffFromMonthStart < 0 ? Math.min(tour.days, Math.abs(diffFromMonthStart)) : 0
                          const remainingDays = tour.days - cutDays
                          const spanDays = Math.min(remainingDays, monthDays.length - visibleStartIdx)
                          if (spanDays <= 0) return null
                          const hasColors = Object.keys(tour.dayData.productColors).length > 0
                          const colorValues = Object.values(tour.dayData.productColors)
                          const gradient = hasColors
                            ? (colorValues.length === 1
                              ? `linear-gradient(135deg, ${getColorFromClass(colorValues[0])} 0%, ${getColorFromClass(colorValues[0])} 100%)`
                              : `linear-gradient(135deg, ${colorValues.map(color => getColorFromClass(color)).join(', ')})`)
                            : undefined
                          return (
                            <div
                              key={`md-overlay-${idx}-${tour.startDate}`}
                              className="absolute z-10 top-0 h-[32px] flex items-center"
                              style={{ left: `calc(${visibleStartIdx} * (100% / ${monthDays.length}))`, width: `calc(${spanDays} * (100% / ${monthDays.length}))` }}
                            >
                              <div
                                className={`w-full h-full rounded font-bold px-2 py-0 text-xs flex items-center justify-center gap-1 cursor-pointer hover:opacity-90 transition-opacity ${tour.dayData.assignedPeople === 0 ? 'bg-gray-400 text-white' : ''}`}
                                style={{ 
                                  background: tour.dayData.assignedPeople > 0 && hasColors ? gradient : undefined,
                                  color: (() => {
                                    const guideTours = tours.filter(tourItem => 
                                      tourItem.tour_date === tour.startDate && 
                                      (tour.dayData.role === 'guide' 
                                        ? tourItem.tour_guide_id === teamMemberId 
                                        : tourItem.assistant_id === teamMemberId)
                                    )
                                    const hasUnassignedVehicle = guideTours.some(t => !t.tour_car_id || String(t.tour_car_id).trim().length === 0)
                                    return hasUnassignedVehicle ? '#dc2626' : undefined
                                  })()
                                }}
                                draggable
                                onDragStart={(e) => {
                                  const guideTours = tours.filter(tourItem => 
                                    tourItem.tour_date === tour.startDate && 
                                    (tour.dayData.role === 'guide' 
                                      ? tourItem.tour_guide_id === teamMemberId 
                                      : tourItem.assistant_id === teamMemberId)
                                  )
                                  if (guideTours.length > 0) {
                                    handleDragStart(e, guideTours[0])
                                  }
                                }}
                                onDoubleClick={() => {
                                  const guideTours = tours.filter(tourItem => 
                                    tourItem.tour_date === tour.startDate && 
                                    (tour.dayData.role === 'guide' 
                                      ? tourItem.tour_guide_id === teamMemberId 
                                      : tourItem.assistant_id === teamMemberId)
                                  )
                                  if (guideTours.length > 0) {
                                    handleTourDoubleClick(guideTours[0].id)
                                  }
                                }}
                                title={(() => {
                                  const guideTours = tours.filter(tourItem => 
                                    tourItem.tour_date === tour.startDate && 
                                    (tour.dayData.role === 'guide' 
                                      ? tourItem.tour_guide_id === teamMemberId 
                                      : tourItem.assistant_id === teamMemberId)
                                  )
                                  return guideTours.length > 0 ? getTourSummary(guideTours[0]) : ''
                                })()}
                              >
                                {(() => {
                                  const guideTours = tours.filter(tourItem => 
                                    tourItem.tour_date === tour.startDate && 
                                    (tour.dayData.role === 'guide' 
                                      ? tourItem.tour_guide_id === teamMemberId 
                                      : tourItem.assistant_id === teamMemberId)
                                  )
                                  const hasPrivateTour = guideTours.some(tourItem => 
                                    tourItem.is_private_tour === 'TRUE' || tourItem.is_private_tour === true
                                  )
                                  
                                  return (
                                    <>
                                      {hasPrivateTour && <span>🔒</span>}
                                      <span>
                                        {tour.dayData.role === 'assistant' 
                                          ? (tour.dayData.guideInitials || 'A')
                                          : (tour.dayData.assignedPeople || '')}
                                      </span>
                                      {tour.extendsToNextMonth && (
                                        <span className="text-xs opacity-75">→</span>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs font-medium" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>
                      <div className={`font-medium ${
                        guide.totalAssignedPeople === 0 
                          ? 'text-gray-300' 
                          : guide.totalAssignedPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>{guide.totalAssignedPeople} ({guide.totalTours}일)</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
            </div>
          </div>
        </div>
      </div>

      {/* 미 배정된 투어 카드뷰 */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-red-500" />
          미 배정된 투어 스케줄
        </h3>
        {unassignedTourCards.length > 0 ? (
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={handleUnassignDrop}
          >
            {unassignedTourCards.map((card) => {
              // 단독투어 여부 확인
              const isPrivateTour = card.tour.is_private_tour === 'TRUE' || card.tour.is_private_tour === true
              
              return (
                <div
                  key={card.id}
                  className={`bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group ${
                    card.role === 'guide' 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-green-200 bg-green-50'
                  } ${isPrivateTour ? 'ring-2 ring-purple-400 ring-opacity-50' : ''}`}
                  draggable
                  onDragStart={(e) => handleUnassignedTourCardDragStart(e, card)}
                  onDragEnd={handleUnassignedTourDragEnd}
                  onDoubleClick={() => handleTourDoubleClick(card.tour.id)}
                  title={getTourSummary(card.tour)}
                >
                  <div className="flex items-center space-x-2">
                    <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium mb-1 ${isPrivateTour ? 'text-purple-700' : 'text-gray-900'}`}>
                        {isPrivateTour ? '🔒 ' : ''}{card.title}
                      </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        card.role === 'guide' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {card.role === 'guide' ? '가이드' : '어시스턴트'}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        card.tour.tour_status === 'scheduled' ? 'bg-gray-100 text-gray-800' :
                        card.tour.tour_status === 'inProgress' ? 'bg-yellow-100 text-yellow-800' :
                        card.tour.tour_status === 'completed' ? 'bg-green-100 text-green-800' :
                        card.tour.tour_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {card.tour.tour_status === 'scheduled' ? '예정' :
                         card.tour.tour_status === 'inProgress' ? '진행중' :
                         card.tour.tour_status === 'completed' ? '완료' :
                         card.tour.tour_status === 'cancelled' ? '취소' :
                         card.tour.tour_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              )
            })}
          </div>
        ) : (
          <div 
            className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={handleUnassignDrop}
          >
            <div className="text-4xl mb-4">✅</div>
            <div className="text-lg font-medium text-gray-900 mb-2">미 배정된 투어가 없습니다</div>
            <div className="text-sm text-gray-500">모든 투어가 가이드에게 배정되었습니다</div>
          </div>
        )}
      </div>

      {/* 상품 선택 모달 */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                상품 선택
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                표시할 상품을 선택하세요. ({selectedProducts.length}개 선택됨)
              </p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {products.length > 0 ? (
                  products.map(product => {
                    const isSelected = selectedProducts.includes(product.id)
                    const selectedIndex = selectedProducts.indexOf(product.id)
                    
                    return (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => toggleProduct(product.id)}
                            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {product.name}
                          </button>
                          {isSelected && (
                            <div className={`px-2 py-1 rounded text-xs ${productColors[product.id] || colorPalette[0].class}`}>
                              미리보기
                            </div>
                          )}
                        </div>
                        
                        {isSelected && (
                          <div className="flex items-center space-x-2">
                            {/* 순서 변경 버튼들 */}
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => selectedIndex > 0 && moveProduct(selectedIndex, selectedIndex - 1)}
                                disabled={selectedIndex === 0}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="위로 이동"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => selectedIndex < selectedProducts.length - 1 && moveProduct(selectedIndex, selectedIndex + 1)}
                                disabled={selectedIndex === selectedProducts.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="아래로 이동"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                            
                            {/* 색상 선택 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">색상:</span>
                              <div className="flex flex-wrap gap-1">
                                {colorPalette.map((color, index) => (
                                  <button
                                    key={index}
                                    onClick={() => changeProductColor(product.id, color.class)}
                                    className={`w-6 h-6 rounded border-2 ${
                                      productColors[product.id] === color.class
                                        ? 'border-gray-800'
                                        : 'border-gray-300'
                                    } ${color.class}`}
                                    title={color.name}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {loading ? '로딩 중...' : '표시할 상품이 없습니다.'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={async () => {
                  setSelectedProducts([])
                  await saveUserSetting('schedule_selected_products', [])
                  localStorage.removeItem('schedule_selected_products')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                전체 해제
              </button>
              <button
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팀원 선택 모달 */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Users className="w-5 h-5 mr-2" />
                팀원 선택
              </h3>
              <button
                onClick={() => setShowTeamModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                표시할 팀원을 선택하세요. ({selectedTeamMembers.length}개 선택됨)
              </p>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {teamMembers.map(member => {
                  const isSelected = selectedTeamMembers.includes(member.email)
                  const selectedIndex = selectedTeamMembers.indexOf(member.email)
                  
                  return (
                    <div key={member.email} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => toggleTeamMember(member.email)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {member.name_ko} ({member.position})
                        </button>
                      </div>
                      
                      {isSelected && (
                        <div className="flex items-center space-x-2">
                          {/* 순서 변경 버튼들 */}
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => selectedIndex > 0 && moveTeamMember(selectedIndex, selectedIndex - 1)}
                              disabled={selectedIndex === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="위로 이동"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => selectedIndex < selectedTeamMembers.length - 1 && moveTeamMember(selectedIndex, selectedIndex + 1)}
                              disabled={selectedIndex === selectedTeamMembers.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="아래로 이동"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={async () => {
                  setSelectedTeamMembers([])
                  await saveUserSetting('schedule_selected_team_members', [])
                  localStorage.removeItem('schedule_selected_team_members')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                전체 해제
              </button>
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 모달 */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  messageModalContent.type === 'success' 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-red-100 text-red-600'
                }`}>
                  {messageModalContent.type === 'success' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <h3 className={`text-lg font-semibold ${
                  messageModalContent.type === 'success' ? 'text-green-900' : 'text-red-900'
                }`}>
                  {messageModalContent.title}
                </h3>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className={`text-sm ${
              messageModalContent.type === 'success' ? 'text-green-700' : 'text-red-700'
            }`}>
              {messageModalContent.message}
            </p>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowMessageModal(false)}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  messageModalContent.type === 'success' 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 확인 모달 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-yellow-100 text-yellow-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-yellow-900">
                  {confirmModalContent.title}
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-yellow-700 mb-6">
              {confirmModalContent.message}
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  confirmModalContent.onConfirm()
                  setShowConfirmModal(false)
                }}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmModalContent.buttonColor}`}
              >
                {confirmModalContent.buttonText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 가이드 모달 */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {guideModalContent.title}
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-line">
              {guideModalContent.content}
            </div>
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => {
                  if (guideModalContent.tourId) {
                    const pathLocale = locale || (typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '')
                    const href = `/${pathLocale}/admin/tours/${guideModalContent.tourId}`
                    window.open(href, '_blank')
                  }
                }}
                disabled={!guideModalContent.tourId}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                투어 상세 수정
              </button>
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
