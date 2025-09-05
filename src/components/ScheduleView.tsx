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

  // 현재 월의 첫 번째 날과 마지막 날 계산
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  
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

    const data: { [teamMemberId: string]: { team_member_name: string; position: string; dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number; productColors: { [productId: string]: string } } }; totalPeople: number; totalAssignedPeople: number; totalTours: number } } = {}
    const teamMap = new Map(teamMembers.map(t => [t.email, t]))
    const productMap = new Map(products.map(p => [p.id, p]))

    // 상품별 색상 정의
    const productColors = [
      'bg-blue-100 border-blue-300 text-blue-800',
      'bg-green-100 border-green-300 text-green-800',
      'bg-yellow-100 border-yellow-300 text-yellow-800',
      'bg-purple-100 border-purple-300 text-purple-800',
      'bg-pink-100 border-pink-300 text-pink-800',
      'bg-indigo-100 border-indigo-300 text-indigo-800',
      'bg-red-100 border-red-300 text-red-800',
      'bg-orange-100 border-orange-300 text-orange-800'
    ]

    // 선택된 팀 멤버별로 데이터 생성
    selectedTeamMembers.forEach(teamMemberId => {
      const teamMember = teamMap.get(teamMemberId)
      if (!teamMember) return

      const memberTours = tours.filter(tour => 
        tour.tour_guide_id === teamMemberId || tour.assistant_id === teamMemberId
      )

      const dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number; productColors: { [productId: string]: string } } } = {}
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

        // 상품별 색상 매핑
        const productColorsForDay: { [productId: string]: string } = {}
        dayTours.forEach((tour, index) => {
          const productId = tour.product_id
          if (!productColorsForDay[productId]) {
            const productIndex = selectedProducts.indexOf(productId)
            productColorsForDay[productId] = productColors[productIndex % productColors.length]
          }
        })

        dailyData[dateString] = {
          totalPeople: dayTotalPeople,
          assignedPeople: dayAssignedPeople,
          tours: dayTours.length,
          productColors: productColorsForDay
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
  }, [tours, reservations, products, teamMembers, selectedProducts, selectedTeamMembers, monthDays])

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
    <div className="bg-white rounded-lg shadow-md border p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">스케줄 뷰</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold text-gray-900">
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
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              오늘
            </button>
          </div>
        </div>
      </div>

      {/* 선택 옵션 */}
      <div className="mb-6 flex gap-4">
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

      {/* 상품별 스케줄 테이블 */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-blue-500" />
          상품별 투어 인원
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-48">
                  상품명
                </th>
                {monthDays.map(({ date, dayOfWeek }) => (
                  <th key={date} className="px-2 py-3 text-center text-sm font-medium text-gray-700 min-w-16">
                    <div>{date}일</div>
                    <div className="text-xs text-gray-500">{dayOfWeek}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 각 상품별 데이터 */}
              {Object.entries(productScheduleData).map(([productId, product], index) => {
                const productColors = [
                  'bg-blue-100 border-blue-300 text-blue-800',
                  'bg-green-100 border-green-300 text-green-800',
                  'bg-yellow-100 border-yellow-300 text-yellow-800',
                  'bg-purple-100 border-purple-300 text-purple-800',
                  'bg-pink-100 border-pink-300 text-pink-800',
                  'bg-indigo-100 border-indigo-300 text-indigo-800',
                  'bg-red-100 border-red-300 text-red-800',
                  'bg-orange-100 border-orange-300 text-orange-800'
                ]
                const colorClass = productColors[index % productColors.length]
                
                return (
                  <tr key={productId} className={`hover:bg-gray-50 ${colorClass}`}>
                    <td className="px-4 py-3 text-sm font-medium">
                      {product.product_name}
                    </td>
                    {monthDays.map(({ dateString }) => {
                      const dayData = product.dailyData[dateString]
                      return (
                        <td key={dateString} className="px-2 py-3 text-center text-sm">
                          {dayData ? (
                            <div>
                              <div className="font-medium">{dayData.totalPeople}</div>
                              <div className="text-xs text-gray-500">{dayData.tours}투어</div>
                            </div>
                          ) : (
                            <div className="text-gray-300">-</div>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center text-sm font-medium">
                      <div>{product.totalPeople}</div>
                      <div className="text-xs text-gray-500">{product.totalTours}투어</div>
                    </td>
                  </tr>
                )
              })}

              {/* 상품별 총계 행 - 가장 아래로 이동 */}
              <tr className="bg-blue-100 font-semibold">
                <td className="px-4 py-3 text-sm text-gray-900">
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = productTotals[dateString]
                  return (
                    <td key={dateString} className="px-2 py-3 text-center text-sm">
                      <div className="font-medium">{dayTotal.totalPeople}</div>
                      <div className="text-xs text-gray-500">{dayTotal.tours}투어</div>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center text-sm font-medium">
                  <div>{Object.values(productScheduleData).reduce((sum, product) => sum + product.totalPeople, 0)}</div>
                  <div className="text-xs text-gray-500">{Object.values(productScheduleData).reduce((sum, product) => sum + product.totalTours, 0)}투어</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 가이드별 스케줄 테이블 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-green-500" />
          가이드별 투어 인원
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-green-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-48">
                  가이드명
                </th>
                {monthDays.map(({ date, dayOfWeek }) => (
                  <th key={date} className="px-2 py-3 text-center text-sm font-medium text-gray-700 min-w-16">
                    <div>{date}일</div>
                    <div className="text-xs text-gray-500">{dayOfWeek}</div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">
                  합계
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* 가이드별 총계 행 */}
              <tr className="bg-green-100 font-semibold">
                <td className="px-4 py-3 text-sm text-gray-900">
                  일별 합계
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayTotal = guideTotals[dateString]
                  return (
                    <td key={dateString} className="px-2 py-3 text-center text-sm">
                      <div className="font-medium">{dayTotal.assignedPeople}</div>
                      <div className="text-xs text-gray-500">({dayTotal.totalPeople})</div>
                      <div className="text-xs text-gray-400">{dayTotal.tours}투어</div>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center text-sm font-medium">
                  <div>{Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalAssignedPeople, 0)}</div>
                  <div className="text-xs text-gray-500">({Object.values(guideScheduleData).reduce((sum, guide) => sum + guide.totalPeople, 0)})</div>
                </td>
              </tr>

              {/* 각 가이드별 데이터 */}
              {Object.entries(guideScheduleData).map(([teamMemberId, guide]) => (
                <tr key={teamMemberId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{guide.team_member_name}</div>
                    <div className="text-xs text-gray-500">{guide.position}</div>
                  </td>
                  {monthDays.map(({ dateString }) => {
                    const dayData = guide.dailyData[dateString]
                    return (
                      <td key={dateString} className="px-2 py-3 text-center text-sm">
                        {dayData ? (
                          <div>
                            <div className="font-medium">{dayData.assignedPeople}</div>
                            <div className="text-xs text-gray-500">({dayData.totalPeople})</div>
                            <div className="text-xs text-gray-400">{dayData.tours}투어</div>
                            {/* 상품별 색상 표시 */}
                            {Object.keys(dayData.productColors).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 justify-center">
                                {Object.entries(dayData.productColors).map(([productId, colorClass]) => {
                                  const product = products.find(p => p.id === productId)
                                  return (
                                    <span
                                      key={productId}
                                      className={`px-1 py-0.5 text-xs rounded ${colorClass}`}
                                      title={product?.name}
                                    >
                                      {product?.name?.substring(0, 3)}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-300">-</div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center text-sm font-medium">
                    <div>{guide.totalAssignedPeople}</div>
                    <div className="text-xs text-gray-500">({guide.totalPeople})</div>
                    <div className="text-xs text-gray-400">{guide.totalTours}투어</div>
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
              <div className="flex flex-wrap gap-2">
                {products.map(product => (
                  <button
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedProducts.includes(product.id)
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {product.name}
                  </button>
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
