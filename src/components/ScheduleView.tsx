'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Users, MapPin, Clock, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type Tour = Database['public']['Tables']['tours']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Team = Database['public']['Tables']['team']['Row']
type Reservation = Database['public']['Tables']['reservations']['Row']

interface ScheduleData {
  product_id: string
  product_name: string
  team_member_id: string
  team_member_name: string
  position: string
  dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } }
  totalPeople: number
  totalAssignedPeople: number
  totalTours: number
}

export default function ScheduleView() {
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

  // 색상 팔레트 정의 (원색)
  const colorPalette = [
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
  ]

  // 상품별 색상 초기화
  const initializeProductColors = () => {
    const colors: { [productId: string]: string } = {}
    products.forEach((product, index) => {
      if (!productColors[product.id]) {
        colors[product.id] = colorPalette[index % colorPalette.length].class
      } else {
        colors[product.id] = productColors[product.id]
      }
    })
    setProductColors(colors)
  }

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

  // 현재 월의 첫 번째 날과 마지막 날 계산
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  
  // 오늘 날짜 확인 함수
  const isToday = (dateString: string) => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayString = `${year}-${month}-${day}`
    return dateString === todayString
  }
  
  // 월의 모든 날짜 생성
  const monthDays = useMemo(() => {
    const days = []
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i)
      days.push({
        date: i,
        dateString: date.toISOString().split('T')[0],
        dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
      })
    }
    return days
  }, [currentDate, lastDayOfMonth])

  // 데이터 가져오기
  useEffect(() => {
    fetchData()
  }, [currentDate])

  // 상품별 색상 초기화
  useEffect(() => {
    if (products.length > 0) {
      initializeProductColors()
    }
  }, [products])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // 상품 데이터 가져오기
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .in('sub_category', ['Mania Tour', 'Mania Service'])
        .order('name')

      // 팀 멤버 데이터 가져오기
      const { data: teamData } = await supabase
        .from('team')
        .select('*')
        .eq('is_active', true)
        .order('name_ko')

      // 투어 데이터 가져오기 (현재 월)
      const startDate = firstDayOfMonth.toISOString().split('T')[0]
      const endDate = lastDayOfMonth.toISOString().split('T')[0]
      
      const { data: toursData } = await supabase
        .from('tours')
        .select('*')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      // 예약 데이터 가져오기 (현재 월)
      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('*')
        .gte('tour_date', startDate)
        .lte('tour_date', endDate)

      setProducts(productsData || [])
      setTeamMembers(teamData || [])
      setTours(toursData || [])
      setReservations(reservationsData || [])

      // 기본 선택 설정
      if (productsData && productsData.length > 0) {
        setSelectedProducts(productsData.slice(0, 5).map(p => p.id))
      }
      if (teamData && teamData.length > 0) {
        setSelectedTeamMembers(teamData.slice(0, 5).map(t => t.email))
      }

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 상품별 스케줄 데이터 계산
  const productScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    const data: { [productId: string]: { product_name: string; dailyData: { [date: string]: { totalPeople: number; tours: number } }; totalPeople: number; totalTours: number } } = {}
    const productMap = new Map(products.map(p => [p.id, p]))

    // 선택된 상품별로 데이터 생성
    selectedProducts.forEach(productId => {
      const product = productMap.get(productId)
      if (!product) return

      const productTours = tours.filter(tour => tour.product_id === productId)
      const dailyData: { [date: string]: { totalPeople: number; tours: number } } = {}
      let totalPeople = 0
      let totalTours = 0

      // 각 날짜별로 데이터 계산
      monthDays.forEach(({ dateString }) => {
        const dayTours = productTours.filter(tour => tour.tour_date === dateString)
        const dayReservations = reservations.filter(res => 
          res.product_id === productId && res.tour_date === dateString
        )

        const dayTotalPeople = dayReservations.reduce((sum, res) => sum + (res.total_people || 0), 0)

        dailyData[dateString] = {
          totalPeople: dayTotalPeople,
          tours: dayTours.length
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
  }, [tours, reservations, products, selectedProducts, monthDays])

  // 가이드별 스케줄 데이터 계산
  const guideScheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    const data: { [teamMemberId: string]: { team_member_name: string; position: string; dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number; productColors: { [productId: string]: string }; role: string | null; guideInitials: string | null } }; totalPeople: number; totalAssignedPeople: number; totalTours: number } } = {}
    const teamMap = new Map(teamMembers.map(t => [t.email, t]))
    const productMap = new Map(products.map(p => [p.id, p]))

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

      const dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number; productColors: { [productId: string]: string }; role: string | null; guideInitials: string | null } } = {}
      let totalPeople = 0
      let totalAssignedPeople = 0
      let totalTours = 0

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

        // 상품별 색상 매핑
        const productColorsForDay: { [productId: string]: string } = {}
        dayTours.forEach((tour, index) => {
          const productId = tour.product_id
          if (!productColorsForDay[productId]) {
            // 사용자가 설정한 색상이 있으면 사용, 없으면 기본 색상 사용
            const productIndex = selectedProducts.indexOf(productId)
            productColorsForDay[productId] = productColors[productId] || defaultProductColors[productIndex % defaultProductColors.length]
          }
        })

        dailyData[dateString] = {
          totalPeople: dayTotalPeople,
          assignedPeople: dayAssignedPeople,
          tours: dayTours.length,
          productColors: productColorsForDay,
          role: role,
          guideInitials: guideInitials
        }

        totalPeople += dayTotalPeople
        totalAssignedPeople += dayAssignedPeople
        totalTours += dayTours.length
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
  }, [tours, reservations, products, teamMembers, selectedProducts, selectedTeamMembers, monthDays, productColors])

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
  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  // 팀 멤버 선택 토글
  const toggleTeamMember = (teamMemberId: string) => {
    setSelectedTeamMembers(prev => 
      prev.includes(teamMemberId) 
        ? prev.filter(id => id !== teamMemberId)
        : [...prev, teamMemberId]
    )
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
          <table className="w-full" style={{tableLayout: 'fixed'}}>
            <thead className="bg-blue-50">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                  상품명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString }) => (
                  <th 
                    key={date} 
                    className={`px-1 py-2 text-center text-xs font-medium text-gray-700 min-w-12 ${
                      isToday(dateString) 
                        ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                        : ''
                    }`}
                  >
                    <div className={isToday(dateString) ? 'font-bold text-red-700' : ''}>{date}일</div>
                    <div className={`text-xs ${isToday(dateString) ? 'text-red-600' : 'text-gray-500'}`}>{dayOfWeek}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 w-16">
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
                    <td className="px-2 py-2 text-center text-xs font-medium bg-white">
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
                <td className="px-2 py-2 text-center text-xs font-medium">
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
          <table className="w-full" style={{tableLayout: 'fixed'}}>
            <thead className="bg-green-50 hidden">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                  가이드명
                </th>
                {monthDays.map(({ date, dayOfWeek, dateString }) => (
                  <th 
                    key={date} 
                    className={`px-1 py-2 text-center text-xs font-medium text-gray-700 min-w-12 ${
                      isToday(dateString) 
                        ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                        : ''
                    }`}
                  >
                    <div className={isToday(dateString) ? 'font-bold text-red-700' : ''}>{date}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 w-16">
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
                <td className="px-2 py-2 text-center text-xs font-medium">
                  <div>{Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalAssignedPeople, 0)}</div>
                  <div className="text-xs text-gray-500">({Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalPeople, 0)})</div>
                </td>
              </tr>

              {/* 각 가이드별 데이터 */}
              {Object.entries(guideScheduleData).map(([teamMemberId, guide]) => (
                <tr key={teamMemberId} className="hover:bg-gray-50">
                  <td className="px-2 py-2 text-xs" style={{width: '150px', minWidth: '150px', maxWidth: '150px'}}>
                    <div className="font-medium text-gray-900">{guide.team_member_name}</div>
                  </td>
                  {monthDays.map(({ dateString }) => {
                    const dayData = guide.dailyData[dateString]
                    return (
                      <td 
                        key={dateString} 
                        className={`px-1 py-2 text-center text-xs bg-white relative ${
                          isToday(dateString) 
                            ? 'border-l-2 border-r-2 border-red-500 bg-red-50' 
                            : ''
                        }`}
                      >
                        {dayData ? (
                          <div className="relative">
                            {/* 상품별 배경색 표시 (텍스트 아래) */}
                            {Object.keys(dayData.productColors).length > 0 && (
                              <div className="absolute inset-0 pointer-events-none rounded" 
                                   style={{
                                     background: Object.values(dayData.productColors).length === 1 
                                       ? `linear-gradient(135deg, ${getColorFromClass(Object.values(dayData.productColors)[0])} 0%, ${getColorFromClass(Object.values(dayData.productColors)[0])} 100%)`
                                       : `linear-gradient(135deg, ${Object.values(dayData.productColors).map(color => getColorFromClass(color)).join(', ')})`
                                   }}>
                              </div>
                            )}
                            
                            {/* 가이드로 배정된 경우 - 인원 표시 */}
                            {dayData.role === 'guide' && (
                              <div className={`font-bold text-white px-2 py-1 rounded relative z-10 ${
                                dayData.assignedPeople === 0 
                                  ? 'bg-gray-400' 
                                  : 'bg-transparent'
                              } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                                   style={{
                                     backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                       ? getColorFromClass(Object.values(dayData.productColors)[0])
                                       : undefined
                                   }}>
                                {dayData.assignedPeople}
                              </div>
                            )}
                            
                            {/* 어시스턴트로 배정된 경우 - 가이드 이름 초성 표시 */}
                            {dayData.role === 'assistant' && (
                              <div className={`font-bold text-white px-2 py-1 rounded relative z-10 ${
                                dayData.assignedPeople === 0 
                                  ? 'bg-gray-400' 
                                  : 'bg-transparent'
                              } ${isToday(dateString) ? 'ring-2 ring-red-300' : ''}`}
                                   style={{
                                     backgroundColor: dayData.assignedPeople > 0 && Object.keys(dayData.productColors).length > 0
                                       ? getColorFromClass(Object.values(dayData.productColors)[0])
                                       : undefined
                                   }}>
                                {dayData.guideInitials || 'A'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-300">-</div>
                        )}
                      </td>
                    )
                  })}
                    <td className="px-2 py-2 text-center text-xs font-medium">
                      <div className={`font-medium ${
                        guide.totalAssignedPeople === 0 
                          ? 'text-gray-300' 
                          : guide.totalAssignedPeople < 4 
                            ? 'text-blue-600' 
                            : 'text-red-600'
                      }`}>{guide.totalAssignedPeople}</div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상품 선택 모달 */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
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
              <div className="space-y-3">
                {products.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleProduct(product.id)}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedProducts.includes(product.id)
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {product.name}
                      </button>
                      {selectedProducts.includes(product.id) && (
                        <div className={`px-2 py-1 rounded text-xs ${productColors[product.id] || colorPalette[0].class}`}>
                          미리보기
                        </div>
                      )}
                    </div>
                    
                    {selectedProducts.includes(product.id) && (
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
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedProducts([])}
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
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(member => (
                  <button
                    key={member.email}
                    onClick={() => toggleTeamMember(member.email)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedTeamMembers.includes(member.email)
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {member.name_ko} ({member.position})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSelectedTeamMembers([])}
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
