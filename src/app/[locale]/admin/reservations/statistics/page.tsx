'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, BarChart3, TrendingUp, Users, Package, Link, CheckCircle, Clock, XCircle, Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReservationData } from '@/hooks/useReservationData'
import { 
  getProductName, 
  getChannelName, 
  getStatusLabel 
} from '@/utils/reservationUtils'
import TourStatisticsTab from '@/components/statistics/TourStatisticsTab'
import ReservationSettlementTab from '@/components/statistics/ReservationSettlementTab'
import ChannelSettlementTab from '@/components/statistics/ChannelSettlementTab'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface AdminReservationStatisticsProps {
  params: Promise<{ locale: string }>
}

type TimeRange = 'daily' | 'monthly' | 'yearly'
type ChartType = 'channel' | 'product' | 'trend'
type TabType = 'reservations' | 'tours' | 'settlement' | 'channelSettlement'

interface StatisticsData {
  totalReservations: number
  totalPeople: number
  totalRevenue: number
  channelStats: Array<{
    channel: string
    count: number
    people: number
    revenue: number
    percentage: number
  }>
  productStats: Array<{
    product: string
    count: number
    people: number
    revenue: number
    percentage: number
  }>
  statusStats: Array<{
    status: string
    count: number
    people: number
    percentage: number
  }>
  trendData: Array<{
    period: string
    reservations: number
    people: number
    revenue: number
  }>
}

export default function AdminReservationStatistics({ }: AdminReservationStatisticsProps) {
  const t = useTranslations('reservations')
  const { authUser } = useAuth()
  const [isSuper, setIsSuper] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(true)
  
  // 권한 체크
  useEffect(() => {
    const checkPermission = async () => {
      if (!authUser?.email) {
        setIsCheckingPermission(false)
        return
      }
      
      try {
        const { data: teamData, error } = await supabase
          .from('team')
          .select('position')
          .eq('email', authUser.email)
          .eq('is_active', true)
          .single()
        
        if (error || !teamData) {
          setIsSuper(false)
          setIsCheckingPermission(false)
          return
        }
        
        const position = (teamData as any).position?.toLowerCase()
        setIsSuper(position === 'super')
      } catch (error) {
        console.error('권한 체크 오류:', error)
        setIsSuper(false)
      } finally {
        setIsCheckingPermission(false)
      }
    }
    
    checkPermission()
  }, [authUser?.email])
  
  // 데이터 관리
  const {
    reservations,
    customers,
    products,
    channels,
    loading,
    refreshReservations
  } = useReservationData()

  // 상태 관리
  const [activeTab, setActiveTab] = useState<TabType>('reservations')
  const [timeRange, setTimeRange] = useState<TimeRange>('daily')
  const [selectedChart, setSelectedChart] = useState<ChartType>('channel')
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // 통계 데이터 계산
  const statisticsData = useMemo((): StatisticsData => {
    if (!reservations.length) {
      return {
        totalReservations: 0,
        totalPeople: 0,
        totalRevenue: 0,
        channelStats: [],
        productStats: [],
        statusStats: [],
        trendData: []
      }
    }

    // 날짜 필터링
    const filteredReservations = reservations.filter(reservation => {
      const reservationDate = new Date(reservation.addedTime)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      return reservationDate >= startDate && reservationDate <= endDate
    })

    // 기본 통계
    const totalReservations = filteredReservations.length
    const totalPeople = filteredReservations.reduce((sum, r) => sum + r.totalPeople, 0)
    const totalRevenue = filteredReservations.reduce((sum, r) => {
      // 간단한 가격 계산 (실제로는 더 복잡한 로직 필요)
      const product = products.find(p => p.id === r.productId)
      return sum + (product?.base_price || 0) * r.totalPeople
    }, 0)

    // 채널별 통계
    const channelGroups = filteredReservations.reduce((groups, reservation) => {
      const channelName = getChannelName(reservation.channelId, channels)
      if (!groups[channelName]) {
        groups[channelName] = { count: 0, people: 0, revenue: 0 }
      }
      groups[channelName].count++
      groups[channelName].people += reservation.totalPeople
      const product = products.find(p => p.id === reservation.productId)
      groups[channelName].revenue += (product?.base_price || 0) * reservation.totalPeople
      return groups
    }, {} as Record<string, {count: number, people: number, revenue: number}>)

    const channelStats = Object.entries(channelGroups)
      .map(([channel, data]) => ({
        channel,
        count: data.count,
        people: data.people,
        revenue: data.revenue,
        percentage: totalReservations > 0 ? (data.count / totalReservations) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)

    // 상품별 통계
    const productGroups = filteredReservations.reduce((groups, reservation) => {
      const productName = getProductName(reservation.productId, products)
      if (!groups[productName]) {
        groups[productName] = { count: 0, people: 0, revenue: 0 }
      }
      groups[productName].count++
      groups[productName].people += reservation.totalPeople
      const product = products.find(p => p.id === reservation.productId)
      groups[productName].revenue += (product?.base_price || 0) * reservation.totalPeople
      return groups
    }, {} as Record<string, {count: number, people: number, revenue: number}>)

    const productStats = Object.entries(productGroups)
      .map(([product, data]) => ({
        product,
        count: data.count,
        people: data.people,
        revenue: data.revenue,
        percentage: totalReservations > 0 ? (data.count / totalReservations) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)

    // 상태별 통계
    const statusGroups = filteredReservations.reduce((groups, reservation) => {
      const status = reservation.status
      if (!groups[status]) {
        groups[status] = { count: 0, people: 0 }
      }
      groups[status].count++
      groups[status].people += reservation.totalPeople
      return groups
    }, {} as Record<string, {count: number, people: number}>)

    const statusStats = Object.entries(statusGroups)
      .map(([status, data]) => ({
        status,
        count: data.count,
        people: data.people,
        percentage: totalReservations > 0 ? (data.count / totalReservations) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)

    // 추이 데이터
    const trendData = (() => {
      const groups: Record<string, {reservations: number, people: number, revenue: number}> = {}
      
      filteredReservations.forEach(reservation => {
        const date = new Date(reservation.addedTime)
        let period: string
        
        if (timeRange === 'daily') {
          period = date.toISOString().split('T')[0]
        } else if (timeRange === 'monthly') {
          period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        } else {
          period = String(date.getFullYear())
        }
        
        if (!groups[period]) {
          groups[period] = { reservations: 0, people: 0, revenue: 0 }
        }
        groups[period].reservations++
        groups[period].people += reservation.totalPeople
        const product = products.find(p => p.id === reservation.productId)
        groups[period].revenue += (product?.base_price || 0) * reservation.totalPeople
      })
      
      return Object.entries(groups)
        .map(([period, data]) => ({ period, ...data }))
        .sort((a, b) => a.period.localeCompare(b.period))
    })()

    return {
      totalReservations,
      totalPeople,
      totalRevenue,
      channelStats,
      productStats,
      statusStats,
      trendData
    }
  }, [reservations, products, channels, dateRange, timeRange])

  // 차트 데이터 준비
  const chartData = useMemo(() => {
    if (selectedChart === 'channel') {
      return statisticsData.channelStats.map(item => ({
        name: item.channel,
        value: item.count,
        people: item.people,
        revenue: item.revenue,
        percentage: item.percentage
      }))
    } else if (selectedChart === 'product') {
      return statisticsData.productStats.map(item => ({
        name: item.product,
        value: item.count,
        people: item.people,
        revenue: item.revenue,
        percentage: item.percentage
      }))
    } else {
      return statisticsData.trendData.map(item => ({
        name: item.period,
        value: item.reservations,
        people: item.people,
        revenue: item.revenue
      }))
    }
  }, [selectedChart, statisticsData])

  // 시간 범위 변경 핸들러
  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange)
    const today = new Date()
    let startDate: Date
    
    if (newTimeRange === 'daily') {
      startDate = new Date(today)
    } else if (newTimeRange === 'monthly') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    } else {
      startDate = new Date(today.getFullYear(), 0, 1)
    }
    
    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    })
  }

  if (isCheckingPermission || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // 권한이 없는 경우 접근 거부
  if (!isSuper) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h2>
          <p className="text-gray-600">예약 통계 페이지는 Super 권한이 있는 사용자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">통계 리포트</h1>
        <button
          onClick={refreshReservations}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <BarChart3 size={20} />
          <span>데이터 새로고침</span>
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { key: 'reservations', label: '예약 통계', icon: BarChart3 },
              { key: 'tours', label: '투어 통계', icon: TrendingUp },
              { key: 'settlement', label: '예약 정산', icon: Receipt },
              { key: 'channelSettlement', label: '채널별 정산', icon: Receipt }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as TabType)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 필터 컨트롤 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          {/* 시간 범위 선택 */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">시간 범위:</label>
            <div className="flex space-x-1">
              {(['daily', 'monthly', 'yearly'] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleTimeRangeChange(range)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    timeRange === range
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {range === 'daily' ? '일별' : range === 'monthly' ? '월별' : '연간별'}
                </button>
              ))}
            </div>
          </div>

          {/* 날짜 선택 */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">기간:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">~</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* 탭 내용 */}
      {activeTab === 'reservations' && (
        <>

      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 예약</p>
              <p className="text-2xl font-bold text-gray-900">{statisticsData.totalReservations.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 인원</p>
              <p className="text-2xl font-bold text-gray-900">{statisticsData.totalPeople.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">예상 수익</p>
              <p className="text-2xl font-bold text-gray-900">${statisticsData.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">확정 예약</p>
              <p className="text-2xl font-bold text-gray-900">
                {statisticsData.statusStats.find(s => s.status === 'confirmed')?.count || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 선택 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex space-x-4 mb-6">
          {[
            { key: 'channel', label: '채널별 통계', icon: Link },
            { key: 'product', label: '상품별 통계', icon: Package },
            { key: 'trend', label: '예약 추이', icon: TrendingUp }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedChart(key as ChartType)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                selectedChart === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 차트 영역 */}
        <div className="h-96 bg-gray-50 rounded-lg p-6">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>선택한 기간에 데이터가 없습니다.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedChart === 'channel' ? '채널별 예약 통계' : 
                 selectedChart === 'product' ? '상품별 예약 통계' : '예약 추이'}
              </h3>
              
              {/* 간단한 막대 차트 */}
              <div className="space-y-2">
                {chartData.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="w-32 text-sm text-gray-600 truncate">{item.name}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                      <div 
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${Math.min((item.value / Math.max(...chartData.map(d => d.value))) * 100, 100)}%` }}
                      >
                        <span className="text-white text-xs font-medium">{item.value}</span>
                      </div>
                    </div>
                    <div className="w-16 text-sm text-gray-600 text-right">
                      {selectedChart === 'trend' ? `${item.people}명` : `${('percentage' in item ? (item as { percentage: number }).percentage : 0).toFixed(1)}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 통계 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">상세 통계</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {selectedChart === 'channel' ? '채널' : selectedChart === 'product' ? '상품' : '기간'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  예약 수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  인원
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  비율
                </th>
                {selectedChart !== 'trend' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    예상 수익
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chartData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.value.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.people.toLocaleString()}명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {selectedChart === 'trend' ? '-' : `${('percentage' in item ? (item as { percentage: number }).percentage : 0).toFixed(1)}%`}
                  </td>
                  {selectedChart !== 'trend' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${item.revenue.toLocaleString()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* 투어 통계 탭 */}
      {activeTab === 'tours' && (
        <TourStatisticsTab dateRange={dateRange} />
      )}

      {/* 예약 정산 탭 */}
      {activeTab === 'settlement' && (
        <ReservationSettlementTab dateRange={dateRange} />
      )}

      {/* 채널별 정산 탭 */}
      {activeTab === 'channelSettlement' && (
        <ChannelSettlementTab dateRange={dateRange} />
      )}
    </div>
  )
}
