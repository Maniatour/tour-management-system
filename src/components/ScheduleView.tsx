'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { ChevronLeft, ChevronRight, Users, MapPin, X, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'
import { useLocale } from 'next-intl'

type Tour = Database['public']['Tables']['tours']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Team = Database['public']['Tables']['team']['Row']
type Reservation = Database['public']['Tables']['reservations']['Row']

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
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [productColors, setProductColors] = useState<{ [productId: string]: string }>({})
  const [currentUserId] = useState('admin') // 실제로는 인증된 사용자 ID를 사용해야 함
  const [draggedTour, setDraggedTour] = useState<Tour | null>(null)
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const [unassignedTours, setUnassignedTours] = useState<Tour[]>([])
  const [ticketBookings, setTicketBookings] = useState<Array<{ id: string; tour_id: string | null; status: string | null; ea: number | null }>>([])
  const [highlightedDate, setHighlightedDate] = useState<string | null>(null)
  const [offSchedules, setOffSchedules] = useState<Array<{ team_email: string; off_date: string; reason: string }>>([])

  // 사용자 설정 저장
  const saveUserSetting = async (key: string, value: string[] | number | boolean) => {
    try {
      // 먼저 기존 설정이 있는지 확인
      const { data: existingData } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('setting_key', key)
        .single()

      if (existingData) {
        // 기존 설정이 있으면 업데이트
        const { error } = await supabase
          .from('user_settings')
          .update({
            setting_value: value,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', currentUserId)
          .eq('setting_key', key)
        
        if (error) {
          console.error('Error updating user setting:', error)
          // fallback to localStorage
          localStorage.setItem(key, JSON.stringify(value))
        }
      } else {
        // 기존 설정이 없으면 새로 삽입
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: currentUserId,
            setting_key: key,
            setting_value: value,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        
        if (error) {
          console.error('Error inserting user setting:', error)
          // fallback to localStorage
          localStorage.setItem(key, JSON.stringify(value))
        }
      }
    } catch (error) {
      console.error('Error saving user setting:', error)
      // fallback to localStorage
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  // 사용자 설정 불러오기
  const loadUserSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_key, setting_value')
        .eq('user_id', currentUserId)
        .in('setting_key', ['schedule_selected_products', 'schedule_selected_team_members'])

      if (error) {
        console.error('Error loading user settings:', error)
        // fallback to localStorage
        const savedProducts = localStorage.getItem('schedule_selected_products')
        const savedTeamMembers = localStorage.getItem('schedule_selected_team_members')
        
        if (savedProducts) {
          setSelectedProducts(JSON.parse(savedProducts))
        }
        if (savedTeamMembers) {
          setSelectedTeamMembers(JSON.parse(savedTeamMembers))
        }
        return
      }

      // 데이터베이스에서 설정 불러오기
      const settings = data || []
      const productsSetting = settings.find(s => s.setting_key === 'schedule_selected_products')
      const teamMembersSetting = settings.find(s => s.setting_key === 'schedule_selected_team_members')

      if (productsSetting?.setting_value) {
        setSelectedProducts(productsSetting.setting_value)
      } else {
        // fallback to localStorage
        const savedProducts = localStorage.getItem('schedule_selected_products')
        if (savedProducts) {
          setSelectedProducts(JSON.parse(savedProducts))
        }
      }

      if (teamMembersSetting?.setting_value) {
        setSelectedTeamMembers(teamMembersSetting.setting_value)
      } else {
        // fallback to localStorage
        const savedTeamMembers = localStorage.getItem('schedule_selected_team_members')
        if (savedTeamMembers) {
          setSelectedTeamMembers(JSON.parse(savedTeamMembers))
        }
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
      // fallback to localStorage
      const savedProducts = localStorage.getItem('schedule_selected_products')
      const savedTeamMembers = localStorage.getItem('schedule_selected_team_members')
      
      if (savedProducts) {
        setSelectedProducts(JSON.parse(savedProducts))
      }
      if (savedTeamMembers) {
        setSelectedTeamMembers(JSON.parse(savedTeamMembers))
      }
    }
  }, [currentUserId])

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

  // Off 날짜 확인 함수
  const isOffDate = (teamMemberId: string, dateString: string) => {
    // teamMemberId를 team_email로 변환
    const teamMember = teamMembers.find(member => member.email === teamMemberId)
    if (!teamMember) return false
    
    return offSchedules.some(off => 
      off.team_email === teamMember.email && off.off_date === dateString
    )
  }

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

  // 미 배정된 투어 가져오기
  const fetchUnassignedTours = useCallback(async () => {
    try {
      const startDate = firstDayOfMonth.subtract(3, 'day').format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.format('YYYY-MM-DD')
      
      // 가이드나 어시스턴트가 배정되지 않은 투어들 (특정 상태 제외)
      const { data: unassignedToursData, error } = await supabase
        .from('tours')
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
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .order('name')

      // 팀 멤버 데이터 가져오기
      const { data: teamData } = await supabase
        .from('team')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      // 투어 데이터 가져오기 (현재 월)
      const startDate = firstDayOfMonth.subtract(3, 'day').format('YYYY-MM-DD')
      const endDate = lastDayOfMonth.format('YYYY-MM-DD')
      
      const { data: toursData } = await supabase
        .from('tours')
        .select('*, products(name)')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 예약 데이터 가져오기 (현재 월)
      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('*')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 부킹(입장권) 데이터 가져오기: hover summary용 confirmed EA 합계 계산
      const { data: ticketBookingsData } = await supabase
        .from('ticket_bookings')
        .select('id, tour_id, status, ea')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)

      // Off 스케줄 데이터 가져오기 (현재 월) - 승인된 것만
      const { data: offSchedulesData } = await supabase
        .from('off_schedules')
        .select('team_email, off_date, reason')
        .eq('status', 'approved')
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
      setTicketBookings(ticketBookingsData as any || [])
      setOffSchedules(offSchedulesData || [])

      // 저장된 사용자 설정 불러오기
      await loadUserSettings()

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

  // 상품별 스케줄 데이터 계산
  const productScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    const data: { [productId: string]: { product_name: string; dailyData: { [date: string]: { totalPeople: number; tours: number } }; totalPeople: number; totalTours: number } } = {}

    // 선택된 상품별로 데이터 생성
    selectedProducts.forEach(productId => {
      const product = products.find(p => p.id === productId)
      if (!product) return

      const productTours = tours.filter(tour => tour.product_id === productId)
      const dailyData: { [date: string]: { totalPeople: number; tours: number } } = {}
      let totalPeople = 0
      let totalTours = 0

      // 각 날짜별로 데이터 계산
      monthDays.forEach(({ dateString }) => {
        const dayTours = productTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.product_id === productId && 
          res.tour_date === dateString && 
          (res.status === 'Confirmed' || res.status === 'Recruiting')
        )

        const dayTotalPeople = dayReservations.reduce((sum, res) => sum + (res.total_people || 0), 0)

        // 멀티데이 투어 처리
        const multiDayDays = getMultiDayTourDays(productId)

        // 멀티데이 투어인 경우, 시작일부터 멀티데이 동안 표시
        if (multiDayDays > 1) {
          const start = dayjs(dateString)
          for (let i = 0; i < multiDayDays; i++) {
            const d = start.add(i, 'day')
            const ds = d.format('YYYY-MM-DD')
            // 현재 월 범위 내에 있는지 확인 (포함 비교)
            if (!d.isBefore(firstDayOfMonth, 'day') && !d.isAfter(lastDayOfMonth, 'day')) {
              if (!dailyData[ds]) {
                dailyData[ds] = { totalPeople: 0, tours: 0 }
              }
              dailyData[ds].totalPeople += dayTotalPeople
              dailyData[ds].tours += dayTours.length
            }
          }
        } else {
          dailyData[dateString] = {
            totalPeople: dayTotalPeople,
            tours: dayTours.length
          }
        }

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
  }, [tours, reservations, products, selectedProducts, monthDays, firstDayOfMonth, lastDayOfMonth])

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
      const totalPeople = 0
      const totalAssignedPeople = 0
      const totalTours = 0

      // 각 날짜별로 데이터 계산
      monthDays.forEach(({ dateString }) => {
        const dayTours = memberTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.tour_date === dateString
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
          }
        }
      })

      data[teamMemberId] = {
        team_member_name: teamMember.name_ko,
        position: teamMember.position,
        dailyData,
        totalPeople,
        totalAssignedPeople,
        totalTours
      }
    })

    return data
  }, [tours, reservations, teamMembers, selectedProducts, selectedTeamMembers, monthDays, productColors, currentDate])

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
    
    // 데이터베이스에 저장
    await saveUserSetting('schedule_selected_products', newSelection)
    
    // 로컬 스토리지에도 저장 (fallback)
    localStorage.setItem('schedule_selected_products', JSON.stringify(newSelection))
  }

  // 팀 멤버 선택 토글
  const toggleTeamMember = async (teamMemberId: string) => {
    const newSelection = selectedTeamMembers.includes(teamMemberId) 
      ? selectedTeamMembers.filter(id => id !== teamMemberId)
      : [...selectedTeamMembers, teamMemberId]
    
    setSelectedTeamMembers(newSelection)
    
    // 데이터베이스에 저장
    await saveUserSetting('schedule_selected_team_members', newSelection)
    
    // 로컬 스토리지에도 저장 (fallback)
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
      // 투어 업데이트
      const updateData: Partial<Tour> = {}
      if (role === 'guide') {
        updateData.tour_guide_id = teamMemberId
        // 기존 어시스턴트는 유지
      } else if (role === 'assistant') {
        updateData.assistant_id = teamMemberId
        // 기존 가이드는 유지
      }

      const { error } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', draggedTour.id)

      if (error) {
        console.error('Error updating tour:', error)
        alert('투어 배정에 실패했습니다.')
        return
      }

      // 성공 시 데이터 새로고침
      await fetchData()
      await fetchUnassignedTours()
      alert('투어가 성공적으로 재배정되었습니다.')
      
    } catch (error) {
      console.error('Error assigning tour:', error)
      alert('투어 배정 중 오류가 발생했습니다.')
    } finally {
      setDraggedTour(null)
      setHighlightedDate(null)
    }
  }

  // 미배정 영역으로 드롭 처리 (배정 해제)
  const handleUnassignDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverCell(null)
    
    if (!draggedTour) return

    try {
      // 투어 배정 해제 (가이드와 어시스턴트 모두 null로 설정)
      const { error } = await supabase
        .from('tours')
        .update({
          tour_guide_id: null,
          assistant_id: null
        })
        .eq('id', draggedTour.id)

      if (error) {
        console.error('Error unassigning tour:', error)
        alert('투어 배정 해제에 실패했습니다.')
        return
      }

      // 성공 시 데이터 새로고침
      await fetchData()
      await fetchUnassignedTours()
      alert('투어 배정이 해제되었습니다.')
      
    } catch (error) {
      console.error('Error unassigning tour:', error)
      alert('투어 배정 해제 중 오류가 발생했습니다.')
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

  // 투어 요약 정보 생성
  const getTourSummary = (tour: Tour) => {
    const productName = tour.products?.name || 'N/A'
    const tourDate = tour.tour_date
    
    // 인원 계산
    const dayReservations = reservations.filter(r => r.tour_date === tour.tour_date && r.product_id === tour.product_id)
    const totalPeopleAll = dayReservations.reduce((s, r) => s + (r.total_people || 0), 0)
    let assignedPeople = 0
    if ((tour as any).reservation_ids && Array.isArray((tour as any).reservation_ids)) {
      const assigned = dayReservations.filter(r => ((tour as any).reservation_ids as string[]).includes(r.id))
      assignedPeople = assigned.reduce((s, r) => s + (r.total_people || 0), 0)
    }

    // 가이드/어시스턴트 이름
    const guide = teamMembers.find(t => t.email === (tour as any).tour_guide_id)
    const assistant = teamMembers.find(t => t.email === (tour as any).assistant_id)
    const guideName = guide?.name_ko || '-'
    const assistantName = assistant?.name_ko || '-'

    // 차량 번호(가능한 필드 우선 사용)
    const vehicleNumber = (tour as any).vehicle_number || (tour as any).vehicle_id || '-'

    // 부킹 Confirm EA 합계
    const confirmedEa = ticketBookings
      .filter(tb => tb.tour_id === tour.id && (tb.status === 'confirmed' || tb.status === 'paid'))
      .reduce((s, tb) => s + (tb.ea || 0), 0)

    return [
      `투어: ${productName}`,
      `날짜: ${tourDate}`,
      `인원: ${assignedPeople} / ${totalPeopleAll}`,
      `가이드: ${guideName}`,
      `어시스턴트: ${assistantName}`,
      `차량: ${vehicleNumber}`,
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
          dailyTotals[dateString].totalPeople += dayData.totalPeople
          dailyTotals[dateString].assignedPeople += dayData.assignedPeople
          dailyTotals[dateString].tours += dayData.tours
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
      <div className="mb-4">
        {/* 메인 헤더 - 모든 요소를 한 줄에 배치 */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* 왼쪽: 제목과 선택 버튼들 */}
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-2xl font-bold text-gray-900 whitespace-nowrap">스케줄 뷰</h2>
            
            {/* 선택 버튼들 */}
            <div className="flex gap-4">
              {/* 상품 선택 버튼 */}
              <button
                onClick={() => setShowProductModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>상품 선택 ({selectedProducts.length}개)</span>
              </button>

              {/* 팀원 선택 버튼 */}
              <button
                onClick={() => setShowTeamModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Users className="w-4 h-4" />
                <span>팀원 선택 ({selectedTeamMembers.length}개)</span>
              </button>
            </div>
          </div>

          {/* 오른쪽: 월 이동 버튼들 */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold text-gray-900 whitespace-nowrap">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h3>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors whitespace-nowrap"
            >
              오늘
            </button>
          </div>
        </div>
      </div>

      {/* 상품별 스케줄 테이블 */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-blue-500" />
          상품별 투어 인원
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full" style={{tableLayout: 'fixed', width: '100%'}}>
            <thead className="bg-blue-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                  상품명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString }) => (
                  <th 
                    key={date} 
                    className={`px-1 py-2 text-center text-xs font-medium text-gray-700 ${
                      isToday(dateString) 
                        ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                        : ''
                    }`}
                    style={{ minWidth: '44px' }}
                  >
                    <div className={isToday(dateString) ? 'font-bold text-red-700' : ''}>{date}일</div>
                    <div className={`text-xs ${isToday(dateString) ? 'text-red-600' : 'text-gray-500'}`}>{dayOfWeek}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
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
                    <td className={`px-2 py-2 text-xs font-medium ${colorClass}`} style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                      {product.product_name}
                    </td>
                    {monthDays.map(({ dateString }) => {
                      const dayData = product.dailyData[dateString]
                      return (
                        <td 
                          key={dateString} 
                          className={`px-1 py-2 text-center text-xs bg-white ${
                            isToday(dateString) 
                              ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                              : ''
                          }`}
                          style={{ minWidth: '44px' }}
                        >
                          {dayData ? (
                            <div className={`font-medium ${
                              dayData.totalPeople === 0 
                                ? 'text-gray-300' 
                                : dayData.totalPeople < 4 
                                  ? 'text-blue-600' 
                                  : 'text-red-600'
                            } ${isToday(dateString) ? 'text-red-700' : ''}`}>
                              {dayData.totalPeople}
                            </div>
                          ) : (
                            <div className="text-gray-300">-</div>
                          )}
                        </td>
                      )
                    })}
                <td className="px-2 py-2 text-center text-xs font-medium bg-white" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
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
                <td className="px-2 py-2 text-xs text-gray-900" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = productTotals[dateString]
                  return (
                    <td 
                      key={dateString} 
                      className={`px-1 py-2 text-center text-xs ${
                        isToday(dateString) 
                          ? 'border-2 border-red-500 bg-red-50' 
                          : ''
                      }`}
                      style={{ minWidth: '44px' }}
                    >
                      <div className={`font-medium ${
                        dayTotal.totalPeople === 0 
                          ? 'text-gray-300' 
                          : dayTotal.totalPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      } ${isToday(dateString) ? 'text-red-700' : ''}`}>{dayTotal.totalPeople}</div>
                    </td>
                  )
                })}
                <td className="px-2 py-2 text-center text-xs font-medium" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                  <div>{Object.values(productScheduleData).reduce((sum, product) => sum + product.totalPeople, 0)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 가이드별 스케줄 테이블 */}
      <div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{tableLayout: 'fixed', width: '100%'}}>
            <thead className="bg-green-50 hidden">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                  가이드명
                </th>
                {monthDays.map(({ date, dateString }) => (
                  <th 
                    key={date} 
                    className={`px-1 py-2 text-center text-xs font-medium text-gray-700 ${
                      isToday(dateString) 
                        ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                        : ''
                    }`}
                    style={{ minWidth: '44px' }}
                  >
                    <div className={isToday(dateString) ? 'font-bold text-red-700' : ''}>{date}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 가이드별 총계 행 */}
              <tr className="bg-green-100 font-semibold">
                <td className="px-2 py-2 text-xs text-gray-900" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
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
                      style={{ minWidth: '44px' }}
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
                <td className="px-2 py-2 text-center text-xs font-medium" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                  <div>{Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalAssignedPeople, 0)}</div>
                  <div className="text-xs text-gray-500">({Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalPeople, 0)})</div>
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
                      // 역할/인원/색상 계산
                      const dayReservations = reservations.filter(res => res.tour_date === start.format('YYYY-MM-DD'))
                      const assignedPeople = (() => {
                        if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return 0
                        const assigned = dayReservations.filter(res => tour.reservation_ids.includes(res.id))
                        return assigned.reduce((s, r) => s + (r.total_people || 0), 0)
                      })()
                      const role = tour.tour_guide_id === teamMemberId ? 'guide' : tour.assistant_id === teamMemberId ? 'assistant' : null
                      let guideInitials = null as string | null
                      if (role === 'assistant' && tour.tour_guide_id) {
                        const guideInfo = teamMap.get(tour.tour_guide_id)
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
                      }
                    }
                  }
                })
                
                return (
                  <tr key={teamMemberId} className="hover:bg-gray-50">
                    <td className="px-2 py-1 text-xs" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                      <div className="font-medium text-gray-900">{guide.team_member_name}</div>
                    </td>
                    <td className="p-0" colSpan={monthDays.length}>
                      <div className="relative">
                        <div className="grid" style={{gridTemplateColumns: `repeat(${monthDays.length}, minmax(44px, 1fr))`}}>
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
                                style={{ minWidth: '44px' }}
                              >
                                <div
                                  className={`relative h-[32px] ${
                                    dragOverCell === `${teamMemberId}-${dateString}-guide` 
                                      ? 'bg-blue-200 border-2 border-blue-400' 
                                      : ''
                                  }`}
                                  onDragOver={(e) => { if (draggedTour && draggedTour.tour_date === dateString) handleDragOver(e, `${teamMemberId}-${dateString}-guide`) }}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => handleDrop(e, teamMemberId, dateString, 'guide')}
                                >
                                  {/* Off 날짜 표시 */}
                                  {isOffDate(teamMemberId, dateString) ? (
                                    <div className="bg-black text-white rounded px-1 py-0.5 text-xs font-bold flex items-center justify-center h-full">
                                      OFF
                                    </div>
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
                              } ${highlightedDate === dateString ? 'ring-2 ring-blue-300' : ''}`}
                              style={{ minWidth: '44px' }}
                            >
                              <div
                                className={`relative h-[32px] ${
                                  dragOverCell === `${teamMemberId}-${dateString}-guide` 
                                    ? 'bg-blue-200 border-2 border-blue-400' 
                                    : ''
                                }`}
                                onDragOver={(e) => { if (draggedTour && draggedTour.tour_date === dateString) handleDragOver(e, `${teamMemberId}-${dateString}-guide`) }}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, teamMemberId, dateString, 'guide')}
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
                                    {dayData.role === 'guide' && !dayData.isMultiDay && (
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
                                          const guideTours = tours.filter(tour => 
                                            tour.tour_date === dateString && 
                                            tour.tour_guide_id === teamMemberId
                                          )
                                          if (guideTours.length > 0) {
                                            handleDragStart(e, guideTours[0])
                                          }
                                        }}
                                        onDoubleClick={() => {
                                          const guideTours = tours.filter(tour => 
                                            tour.tour_date === dateString && 
                                            tour.tour_guide_id === teamMemberId
                                          )
                                          if (guideTours.length > 0) {
                                            handleTourDoubleClick(guideTours[0].id)
                                          }
                                        }}
                                        title={(() => {
                                          const guideTours = tours.filter(tour => 
                                            tour.tour_date === dateString && 
                                            tour.tour_guide_id === teamMemberId
                                          )
                                          return guideTours.length > 0 ? getTourSummary(guideTours[0]) : ''
                                        })()}
                                      >
                                        <span>{dayData.assignedPeople}</span>
                                        {dayData.extendsToNextMonth && (
                                          <span className="text-xs opacity-75">→</span>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* 어시스턴트로 배정된 경우 - 가이드 이름 초성 표시 */}
                                    {dayData.role === 'assistant' && !dayData.isMultiDay && (
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
                                          const assistantTours = tours.filter(tour => 
                                            tour.tour_date === dateString && 
                                            tour.assistant_id === teamMemberId
                                          )
                                          if (assistantTours.length > 0) {
                                            handleDragStart(e, assistantTours[0])
                                          }
                                        }}
                                        onDoubleClick={() => {
                                          const assistantTours = tours.filter(tour => 
                                            tour.tour_date === dateString && 
                                            tour.assistant_id === teamMemberId
                                          )
                                          if (assistantTours.length > 0) {
                                            handleTourDoubleClick(assistantTours[0].id)
                                          }
                                        }}
                                        title={(() => {
                                          const assistantTours = tours.filter(tour => 
                                            tour.tour_date === dateString && 
                                            tour.assistant_id === teamMemberId
                                          )
                                          return assistantTours.length > 0 ? getTourSummary(assistantTours[0]) : ''
                                        })()}
                                      >
                                        <span>{dayData.guideInitials || 'A'}</span>
                                        {dayData.extendsToNextMonth && (
                                          <span className="text-xs opacity-75">→</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-gray-300 text-center py-1 text-xs">
                                    {/* Off 날짜 표시 */}
                                    {isOffDate(teamMemberId, dateString) ? (
                                      <div className="bg-black text-white rounded px-1 py-0.5 text-xs font-bold">
                                        OFF
                                      </div>
                                    ) : (
                                      /* 드롭 영역 - 텍스트 숨김 */
                                      <div></div>
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
                                className={`w-full h-full rounded font-bold text-white px-2 py-0 text-xs flex items-center justify-center gap-1 cursor-pointer hover:opacity-90 transition-opacity ${tour.dayData.assignedPeople === 0 ? 'bg-gray-400' : ''}`}
                                style={{ background: tour.dayData.assignedPeople > 0 && hasColors ? gradient : undefined }}
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
                                <span>
                                  {tour.dayData.role === 'assistant' 
                                    ? (tour.dayData.guideInitials || 'A')
                                    : (tour.dayData.assignedPeople || '')}
                                </span>
                                {tour.extendsToNextMonth && (
                                  <span className="text-xs opacity-75">→</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center text-xs font-medium" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                      <div className={`font-medium ${
                        guide.totalAssignedPeople === 0 
                          ? 'text-gray-300' 
                          : guide.totalAssignedPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>{guide.totalAssignedPeople}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 미 배정된 투어 카드뷰 */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-red-500" />
          미 배정된 투어 스케줄
        </h3>
        {unassignedTours.length > 0 ? (
          <div 
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
            }}
            onDrop={handleUnassignDrop}
          >
            {unassignedTours.map((tour) => (
              <div
                key={tour.id}
                className="bg-white border border-red-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                draggable
                onDragStart={(e) => handleDragStart(e, tour)}
                onDoubleClick={() => handleTourDoubleClick(tour.id)}
                title={getTourSummary(tour)}
              >
                <div className="flex items-center space-x-2">
                  <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-600 font-medium truncate">
                        {tour.tour_date}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-900 font-medium truncate flex-1">
                        {tour.products?.name || 'N/A'}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        tour.tour_status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        tour.tour_status === 'inProgress' ? 'bg-yellow-100 text-yellow-800' :
                        tour.tour_status === 'completed' ? 'bg-green-100 text-green-800' :
                        tour.tour_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tour.tour_status === 'scheduled' ? '예정' :
                         tour.tour_status === 'inProgress' ? '진행중' :
                         tour.tour_status === 'completed' ? '완료' :
                         tour.tour_status === 'cancelled' ? '취소' :
                         tour.tour_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
    </div>
  )
}
