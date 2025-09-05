'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Users, MapPin, Clock } from 'lucide-react'
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

  // 스케줄 데이터 계산
  const scheduleData = useMemo(() => {
    if (!tours.length || !reservations.length) return []

    const data: ScheduleData[] = []
    const productMap = new Map(products.map(p => [p.id, p]))
    const teamMap = new Map(teamMembers.map(t => [t.email, t]))

    // 선택된 상품별로 데이터 생성
    selectedProducts.forEach(productId => {
      const product = productMap.get(productId)
      if (!product) return

      // 해당 상품의 투어들
      const productTours = tours.filter(tour => tour.product_id === productId)
      
      // 선택된 팀 멤버별로 데이터 생성
      selectedTeamMembers.forEach(teamMemberId => {
        const teamMember = teamMap.get(teamMemberId)
        if (!teamMember) return

        // 해당 팀 멤버가 관련된 투어들 (가이드 또는 어시스턴트)
        const memberTours = productTours.filter(tour => 
          tour.tour_guide_id === teamMemberId || tour.assistant_id === teamMemberId
        )

        const dailyData: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } } = {}
        let totalPeople = 0
        let totalAssignedPeople = 0
        let totalTours = 0

        // 각 날짜별로 데이터 계산
        monthDays.forEach(({ dateString }) => {
          const dayTours = memberTours.filter(tour => tour.tour_date === dateString)
          const dayReservations = reservations.filter(res => 
            res.product_id === productId && res.tour_date === dateString
          )

          // 총 인원 (해당 상품/날짜의 모든 예약)
          const dayTotalPeople = dayReservations.reduce((sum, res) => sum + (res.total_people || 0), 0)
          
          // 배정된 인원 (해당 팀 멤버의 투어에 배정된 예약)
          const dayAssignedPeople = dayTours.reduce((sum, tour) => {
            if (!tour.reservation_ids || !Array.isArray(tour.reservation_ids)) return sum
            const assignedReservations = dayReservations.filter(res => 
              tour.reservation_ids.includes(res.id)
            )
            return sum + assignedReservations.reduce((s, res) => s + (res.total_people || 0), 0)
          }, 0)

          dailyData[dateString] = {
            totalPeople: dayTotalPeople,
            assignedPeople: dayAssignedPeople,
            tours: dayTours.length
          }

          totalPeople += dayTotalPeople
          totalAssignedPeople += dayAssignedPeople
          totalTours += dayTours.length
        })

        data.push({
          product_id: productId,
          product_name: product.name,
          team_member_id: teamMemberId,
          team_member_name: teamMember.name_ko,
          position: teamMember.position,
          dailyData,
          totalPeople,
          totalAssignedPeople,
          totalTours
        })
      })
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

  // 총계 계산
  const totals = useMemo(() => {
    const dailyTotals: { [date: string]: { totalPeople: number; assignedPeople: number; tours: number } } = {}
    
    monthDays.forEach(({ dateString }) => {
      dailyTotals[dateString] = { totalPeople: 0, assignedPeople: 0, tours: 0 }
    })

    scheduleData.forEach(member => {
      monthDays.forEach(({ dateString }) => {
        const dayData = member.dailyData[dateString]
        if (dayData) {
          dailyTotals[dateString].totalPeople += dayData.totalPeople
          dailyTotals[dateString].assignedPeople += dayData.assignedPeople
          dailyTotals[dateString].tours += dayData.tours
        }
      })
    })

    return dailyTotals
  }, [scheduleData, monthDays])

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

      {/* 상품 선택 */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          표시할 상품 선택
        </h3>
        <div className="flex flex-wrap gap-2">
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => toggleProduct(product.id)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
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

      {/* 팀 멤버 선택 */}
      <div className="mb-6 bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          표시할 팀원 선택
        </h3>
        <div className="flex flex-wrap gap-2">
          {teamMembers.map(member => (
            <button
              key={member.email}
              onClick={() => toggleTeamMember(member.email)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
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

      {/* 스케줄 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 w-48">
                상품 / 팀원
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
            {/* 총계 행 */}
            <tr className="bg-blue-50 font-semibold">
              <td className="px-4 py-3 text-sm text-gray-900">
                일별 합계
              </td>
              {monthDays.map(({ dateString }) => {
                const dayTotal = totals[dateString]
                return (
                  <td key={dateString} className="px-2 py-3 text-center text-sm">
                    <div className="font-medium">{dayTotal.assignedPeople}</div>
                    <div className="text-xs text-gray-500">({dayTotal.totalPeople})</div>
                    <div className="text-xs text-gray-400">{dayTotal.tours}투어</div>
                  </td>
                )
              })}
              <td className="px-4 py-3 text-center text-sm font-medium">
                <div>{scheduleData.reduce((sum, member) => sum + member.totalAssignedPeople, 0)}</div>
                <div className="text-xs text-gray-500">({scheduleData.reduce((sum, member) => sum + member.totalPeople, 0)})</div>
              </td>
            </tr>

            {/* 각 팀 멤버별 데이터 */}
            {scheduleData.map((member, index) => (
              <tr key={`${member.product_id}-${member.team_member_id}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium text-gray-900">{member.product_name}</div>
                  <div className="text-xs text-gray-500">{member.team_member_name} ({member.position})</div>
                </td>
                {monthDays.map(({ dateString }) => {
                  const dayData = member.dailyData[dateString]
                  return (
                    <td key={dateString} className="px-2 py-3 text-center text-sm">
                      {dayData ? (
                        <div>
                          <div className="font-medium">{dayData.assignedPeople}</div>
                          <div className="text-xs text-gray-500">({dayData.totalPeople})</div>
                          <div className="text-xs text-gray-400">{dayData.tours}투어</div>
                        </div>
                      ) : (
                        <div className="text-gray-300">-</div>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center text-sm font-medium">
                  <div>{member.totalAssignedPeople}</div>
                  <div className="text-xs text-gray-500">({member.totalPeople})</div>
                  <div className="text-xs text-gray-400">{member.totalTours}투어</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
