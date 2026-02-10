'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Calendar, BarChart3, TrendingUp, Users, Package, Link, CheckCircle, Clock, XCircle, Receipt, Search, DollarSign } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReservationData } from '@/hooks/useReservationData'
import { 
  getProductName, 
  getChannelName, 
  getStatusLabel,
  getCustomerName 
} from '@/utils/reservationUtils'
import TourStatisticsTab from '@/components/statistics/TourStatisticsTab'
import ReservationSettlementTab from '@/components/statistics/ReservationSettlementTab'
import ChannelSettlementTab from '@/components/statistics/ChannelSettlementTab'
import CashReportTab from '@/components/reports/CashReportTab'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface AdminReservationStatisticsProps {
  params: Promise<{ locale: string }>
}

type TimeRange = 'daily' | 'monthly' | 'yearly'
type ChartType = 'channel' | 'product' | 'trend'
type TabType = 'reservations' | 'tours' | 'settlement' | 'channelSettlement' | 'cash'

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

const getDefaultDateRange = () => {
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  return { start: thirtyDaysAgo.toISOString().split('T')[0], end: today.toISOString().split('T')[0] }
}

const VALID_TABS = ['reservations', 'tours', 'settlement', 'channelSettlement', 'cash'] as const

export default function AdminReservationStatistics({ }: AdminReservationStatisticsProps) {
  const t = useTranslations('reservations')
  const { authUser } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [isSuper, setIsSuper] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(true)

  // team 테이블에 없거나 배포 환경 차이로 조회 실패 시에도 Super로 인정할 이메일 (소문자로 비교)
  const SUPER_ADMIN_EMAILS = ['wooyong.shim09@gmail.com']
  
  // 권한 체크
  useEffect(() => {
    const checkPermission = async () => {
      if (!authUser?.email) {
        setIsCheckingPermission(false)
        return
      }
      const emailLower = authUser.email.toLowerCase().trim()
      if (SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === emailLower)) {
        setIsSuper(true)
        setIsCheckingPermission(false)
        return
      }
      
      try {
        const { data: teamData, error } = await supabase
          .from('team')
          .select('position')
          .eq('email', authUser.email)
          .eq('is_active', true)
          .maybeSingle()
        
        if (error || !teamData) {
          setIsSuper(false)
          setIsCheckingPermission(false)
          return
        }
        
        const position = String((teamData as any).position ?? '').toLowerCase().trim()
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

  // 상태 관리 (URL 쿼리에서 복원해 새로고침 시 탭/검색/기간 유지)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const t = searchParams.get('tab')
    return (t && VALID_TABS.includes(t as TabType)) ? t as TabType : 'reservations'
  })
  const [timeRange, setTimeRange] = useState<TimeRange>('daily')
  const [selectedChart, setSelectedChart] = useState<ChartType>('channel')
  const [dateRange, setDateRange] = useState<{start: string, end: string}>(() => {
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    if (start && end) return { start, end }
    return getDefaultDateRange()
  })
  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => searchParams.get('channel') ?? '')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => {
    const s = searchParams.get('statuses')
    if (s && s.trim()) return s.split(',').map((x) => x.trim()).filter(Boolean)
    return ['pending', 'confirmed', 'completed']
  })
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('q') ?? '')
  const endDateInputRef = useRef<HTMLInputElement>(null)

  // 탭/검색/기간/채널/상태 변경 시 URL 동기화 (브라우저 새로고침 시 복원용)
  useEffect(() => {
    const params = new URLSearchParams()
    params.set('tab', activeTab)
    params.set('start', dateRange.start)
    params.set('end', dateRange.end)
    if (searchQuery.trim()) params.set('q', searchQuery.trim())
    if (selectedChannelId) params.set('channel', selectedChannelId)
    if (selectedStatuses.length > 0) params.set('statuses', selectedStatuses.join(','))
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [activeTab, searchQuery, dateRange, selectedChannelId, selectedStatuses, pathname, router])

  // 통계 데이터 계산
  const statisticsData = useMemo((): StatisticsData => {
    console.log('통계 데이터 계산 시작:', {
      totalReservations: reservations.length,
      dateRange,
      selectedStatuses,
      selectedChannelId
    })

    if (!reservations.length) {
      console.log('예약 데이터가 없습니다.')
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
    let filteredReservations = reservations.filter(reservation => {
      const reservationDate = new Date(reservation.addedTime)
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      // 날짜 비교 시 시간 부분을 무시하고 날짜만 비교
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)
      reservationDate.setHours(0, 0, 0, 0)
      return reservationDate >= startDate && reservationDate <= endDate
    })

    console.log('날짜 필터링 후:', filteredReservations.length, '개')

    // 채널 필터링
    if (selectedChannelId) {
      filteredReservations = filteredReservations.filter(reservation =>
        reservation.channelId === selectedChannelId
      )
    }

    // 상태 필터링 (대소문자 구분 없이 비교)
    if (selectedStatuses.length > 0) {
      const beforeStatusFilter = filteredReservations.length
      filteredReservations = filteredReservations.filter(reservation =>
        selectedStatuses.some(selectedStatus => 
          reservation.status?.toLowerCase() === selectedStatus.toLowerCase()
        )
      )
      console.log('상태 필터링 후:', filteredReservations.length, '개 (필터링 전:', beforeStatusFilter, '개)')
    }

    // 검색 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filteredReservations = filteredReservations.filter(reservation => {
        // 고객명 검색
        const customerName = getCustomerName(reservation.customerId, customers || []).toLowerCase()
        if (customerName.includes(query)) return true

        // 채널RN 검색
        if (reservation.channelRN?.toLowerCase().includes(query)) return true

        // 상품명 검색
        const productName = getProductName(reservation.productId, products || []).toLowerCase()
        if (productName.includes(query)) return true

        // 투어 날짜 검색
        const tourDate = new Date(reservation.tourDate).toLocaleDateString('ko-KR')
        if (tourDate.includes(query)) return true

        // 등록일 검색
        const regDate = new Date(reservation.addedTime).toLocaleDateString('ko-KR')
        if (regDate.includes(query)) return true

        return false
      })
    }

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

    console.log('최종 통계 데이터:', {
      totalReservations,
      totalPeople,
      totalRevenue,
      channelStatsCount: channelStats.length,
      productStatsCount: productStats.length,
      statusStatsCount: statusStats.length,
      trendDataCount: trendData.length
    })

    return {
      totalReservations,
      totalPeople,
      totalRevenue,
      channelStats,
      productStats,
      statusStats,
      trendData
    }
  }, [reservations, products, channels, customers, dateRange, timeRange, selectedChannelId, selectedStatuses, searchQuery])

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
  // 프리셋 적용 (일별: 어제/오늘, 월별: 이번달/지난달, 연간: 2025/2024/2023)
  const applyPreset = useCallback((preset: 'daily_yesterday' | 'daily_today' | 'monthly_this' | 'monthly_last' | 'yearly_2025' | 'yearly_2024' | 'yearly_2023') => {
    const today = new Date()
    const toYmd = (d: Date) => d.toISOString().split('T')[0]
    let range: TimeRange
    let start: string
    let end: string

    if (preset === 'daily_yesterday') {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      range = 'daily'
      start = end = toYmd(yesterday)
    } else if (preset === 'daily_today') {
      range = 'daily'
      start = end = toYmd(today)
    } else if (preset === 'monthly_this') {
      range = 'monthly'
      start = toYmd(new Date(today.getFullYear(), today.getMonth(), 1))
      end = toYmd(today)
    } else if (preset === 'monthly_last') {
      range = 'monthly'
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
      start = toYmd(lastMonth)
      end = toYmd(lastDay)
    } else if (preset === 'yearly_2025') {
      range = 'yearly'
      start = '2025-01-01'
      end = '2025-12-31'
    } else if (preset === 'yearly_2024') {
      range = 'yearly'
      start = '2024-01-01'
      end = '2024-12-31'
    } else {
      range = 'yearly'
      start = '2023-01-01'
      end = '2023-12-31'
    }
    setTimeRange(range)
    setDateRange({ start, end })
  }, [])

  // 현재 선택이 해당 프리셋과 일치하는지
  const isPresetActive = useCallback((preset: 'daily_yesterday' | 'daily_today' | 'monthly_this' | 'monthly_last' | 'yearly_2025' | 'yearly_2024' | 'yearly_2023') => {
    if (preset === 'daily_yesterday' || preset === 'daily_today') {
      if (timeRange !== 'daily') return false
      if (dateRange.start !== dateRange.end) return false
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0]
      return preset === 'daily_today' ? dateRange.start === today : dateRange.start === yesterday
    }
    if (preset === 'monthly_this' || preset === 'monthly_last') {
      if (timeRange !== 'monthly') return false
      const today = new Date()
      if (preset === 'monthly_this') {
        const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        return dateRange.start === first && dateRange.end === today.toISOString().split('T')[0]
      }
      const lastFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
      const lastEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
      return dateRange.start === lastFirst && dateRange.end === lastEnd
    }
    if (preset.startsWith('yearly_')) {
      if (timeRange !== 'yearly') return false
      const year = preset.replace('yearly_', '')
      return dateRange.start === `${year}-01-01` && dateRange.end === `${year}-12-31`
    }
    return false
  }, [timeRange, dateRange])

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
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mx-auto mb-3 sm:mb-4" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h2>
          <p className="text-sm sm:text-base text-gray-600">예약 통계 페이지는 Super 권한이 있는 사용자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1920px] mx-auto px-2 sm:px-4 overflow-x-hidden pb-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">통계 리포트</h1>
        <button
          onClick={refreshReservations}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium w-fit"
        >
          <BarChart3 size={16} />
          <span>데이터 새로고침</span>
        </button>
      </div>

      {/* 탭 네비게이션 + 검색 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-6">
            <nav className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin sm:space-x-2 sm:overflow-visible pb-px">
              {[
                { key: 'reservations', label: '예약 통계', icon: BarChart3 },
                { key: 'tours', label: '투어 통계', icon: TrendingUp },
                { key: 'settlement', label: '예약 정산', icon: Receipt },
                { key: 'channelSettlement', label: '채널별 정산', icon: Receipt },
                { key: 'cash', label: '현금 관리', icon: DollarSign }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as TabType)}
                  className={`flex items-center gap-1 sm:gap-2 py-3 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${
                    activeTab === key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} className="sm:w-5 sm:h-5" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2 py-2 flex-shrink-0 min-w-0">
              <div className="relative flex-1 sm:flex-none sm:min-w-[200px]">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="고객명, 채널RN, 상품명, 날짜 검색..."
                  className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900 whitespace-nowrap"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 필터 컨트롤 */}
      <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* 1. 채널 선택 */}
          {activeTab !== 'channelSettlement' && activeTab !== 'cash' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">채널 선택:</label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                className="w-full sm:min-w-[180px] px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">모든 채널</option>
                {channels?.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. 상태 다중 선택 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">상태 선택:</label>
            <div className="flex flex-wrap gap-1">
              {(['pending', 'confirmed', 'completed', 'cancelled', 'recruiting'] as const).map((status) => {
                const isSelected = selectedStatuses.some(s => s.toLowerCase() === status.toLowerCase())
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setSelectedStatuses(selectedStatuses.filter(s => s.toLowerCase() !== status.toLowerCase()))
                      } else {
                        setSelectedStatuses([...selectedStatuses, status])
                      }
                    }}
                    className={`px-2.5 py-1 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status === 'pending' ? '대기' : 
                     status === 'confirmed' ? '확정' : 
                     status === 'completed' ? '완료' : 
                     status === 'cancelled' ? '취소' : 
                     status === 'recruiting' ? '모집중' : status}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3. 시간 범위 프리셋 + 기간 직접 선택 */}
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-xs sm:text-sm font-medium text-gray-700 w-full sm:w-auto">기간:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => applyPreset('daily_yesterday')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('daily_yesterday') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  어제
                </button>
                <button
                  onClick={() => applyPreset('daily_today')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('daily_today') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  오늘
                </button>
                <button
                  onClick={() => applyPreset('monthly_this')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('monthly_this') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  이번 달
                </button>
                <button
                  onClick={() => applyPreset('monthly_last')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('monthly_last') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  지난 달
                </button>
                <button
                  onClick={() => applyPreset('yearly_2025')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('yearly_2025') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  2025
                </button>
                <button
                  onClick={() => applyPreset('yearly_2024')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('yearly_2024') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  2024
                </button>
                <button
                  onClick={() => applyPreset('yearly_2023')}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    isPresetActive('yearly_2023') ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  2023
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:border-l sm:border-gray-200 sm:pl-3">
              <span className="text-xs sm:text-sm font-medium text-gray-500 whitespace-nowrap">직접 선택:</span>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => {
                  const start = e.target.value
                  setDateRange(prev => ({ ...prev, start }))
                  setTimeout(() => {
                    endDateInputRef.current?.focus()
                    if (typeof endDateInputRef.current?.showPicker === 'function') {
                      endDateInputRef.current.showPicker()
                    }
                  }, 100)
                }}
                className="px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 max-w-[140px]"
              />
              <span className="text-gray-400">~</span>
              <input
                ref={endDateInputRef}
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 flex-1 min-w-0 max-w-[140px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 탭 내용 */}
      {activeTab === 'reservations' && (
        <>

      {/* 요약 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 예약</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{statisticsData.totalReservations.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">총 인원</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{statisticsData.totalPeople.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-yellow-100 rounded-lg flex-shrink-0">
              <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">예상 수익</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">${statisticsData.totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 sm:gap-0">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div className="min-w-0 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">확정 예약</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {statisticsData.statusStats.find(s => s.status?.toLowerCase() === 'confirmed')?.count || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 선택 */}
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6">
          {[
            { key: 'channel', label: '채널별', icon: Link },
            { key: 'product', label: '상품별', icon: Package },
            { key: 'trend', label: '예약 추이', icon: TrendingUp }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedChart(key as ChartType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md sm:rounded-lg transition-colors text-sm ${
                selectedChart === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon size={16} className="sm:w-5 sm:h-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 차트 영역 */}
        <div className="h-64 sm:h-96 bg-gray-50 rounded-lg p-3 sm:p-6 overflow-auto">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm sm:text-base">
              <div className="text-center px-2">
                <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-2 sm:mb-4 text-gray-400" />
                <p>선택한 기간에 데이터가 없습니다.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {selectedChart === 'channel' ? '채널별 예약 통계' : 
                 selectedChart === 'product' ? '상품별 예약 통계' : '예약 추이'}
              </h3>
              
              {/* 간단한 막대 차트 */}
              <div className="space-y-1.5 sm:space-y-2">
                {chartData.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <div className="w-20 sm:w-32 text-xs sm:text-sm text-gray-600 truncate flex-shrink-0">{item.name}</div>
                    <div className="flex-1 min-w-0 bg-gray-200 rounded-full h-5 sm:h-6 relative">
                      <div 
                        className="bg-blue-500 h-5 sm:h-6 rounded-full flex items-center justify-end pr-1 sm:pr-2 min-w-[2rem]"
                        style={{ width: `${Math.min((item.value / Math.max(...chartData.map(d => d.value))) * 100, 100)}%` }}
                      >
                        <span className="text-white text-[10px] sm:text-xs font-medium">{item.value}</span>
                      </div>
                    </div>
                    <div className="w-10 sm:w-16 text-xs sm:text-sm text-gray-600 text-right flex-shrink-0">
                      {selectedChart === 'trend' ? `${item.people}명` : `${('percentage' in item ? (item as { percentage: number }).percentage : 0).toFixed(1)}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 통계 - 모바일 카드 / 데스크톱 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">상세 통계</h3>
        </div>
        {/* 모바일: 카드 리스트 */}
        <div className="md:hidden divide-y divide-gray-100">
          {chartData.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">데이터가 없습니다.</div>
          ) : (
            chartData.map((item, index) => (
              <div key={index} className="p-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="w-full sm:w-auto font-medium text-gray-900 text-sm truncate">{item.name}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0 text-xs sm:text-sm text-gray-600">
                  <span>예약 {item.value.toLocaleString()}</span>
                  <span>인원 {item.people.toLocaleString()}명</span>
                  <span>
                    {selectedChart === 'trend' ? '-' : `${('percentage' in item ? (item as { percentage: number }).percentage : 0).toFixed(1)}%`}
                  </span>
                  {selectedChart !== 'trend' && (
                    <span>${item.revenue.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {/* 데스크톱: 테이블 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {selectedChart === 'channel' ? '채널' : selectedChart === 'product' ? '상품' : '기간'}
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  예약 수
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  인원
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  비율
                </th>
                {selectedChart !== 'trend' && (
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    예상 수익
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chartData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.name}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.value.toLocaleString()}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.people.toLocaleString()}명
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                    {selectedChart === 'trend' ? '-' : `${('percentage' in item ? (item as { percentage: number }).percentage : 0).toFixed(1)}%`}
                  </td>
                  {selectedChart !== 'trend' && (
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
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
        <ChannelSettlementTab 
          dateRange={dateRange} 
          selectedChannelId={selectedChannelId} 
          onChannelChange={setSelectedChannelId}
          selectedStatuses={selectedStatuses}
          searchQuery={searchQuery}
          isSuper={isSuper}
        />
      )}

      {/* 현금 관리 탭 (admin/reports와 동일) */}
      {activeTab === 'cash' && (
        <CashReportTab 
          dateRange={dateRange} 
          period={timeRange === 'yearly' ? 'yearly' : timeRange === 'monthly' ? 'monthly' : 'daily'}
        />
      )}
    </div>
  )
}
