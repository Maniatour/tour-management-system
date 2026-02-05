'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, BarChart3, TrendingUp, Users, Package, Receipt, DollarSign, CreditCard, FileText, Mail, Download, Clock, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useReservationData } from '@/hooks/useReservationData'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import ComprehensiveReportTab from '@/components/reports/ComprehensiveReportTab'
import ReservationReportTab from '@/components/reports/ReservationReportTab'
import TourReportTab from '@/components/reports/TourReportTab'
import ExpenseReportTab from '@/components/reports/ExpenseReportTab'
import DepositReportTab from '@/components/reports/DepositReportTab'
import SettlementReportTab from '@/components/reports/SettlementReportTab'
import CashReportTab from '@/components/reports/CashReportTab'
import EmailScheduleModal from '@/components/reports/EmailScheduleModal'

interface AdminReportsProps {
  params: Promise<{ locale: string }>
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
type ReportTab = 'comprehensive' | 'reservations' | 'tours' | 'expenses' | 'deposits' | 'settlement' | 'cash'

export default function AdminReports({ }: AdminReportsProps) {
  const t = useTranslations('reports')
  const { authUser } = useAuth()
  const [isSuper, setIsSuper] = useState(false)
  const [isCheckingPermission, setIsCheckingPermission] = useState(true)
  
  // 커스텀 날짜 범위
  const formatTodayDate = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  const [customStartDate, setCustomStartDate] = useState(formatTodayDate())
  const [customEndDate, setCustomEndDate] = useState(formatTodayDate())
  
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
          .maybeSingle()
        
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
  const [activeTab, setActiveTab] = useState<ReportTab>('comprehensive')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily')
  
  // 적용된 커스텀 날짜 (검색 버튼 클릭 시에만 업데이트)
  const [appliedCustomStartDate, setAppliedCustomStartDate] = useState(formatTodayDate())
  const [appliedCustomEndDate, setAppliedCustomEndDate] = useState(formatTodayDate())

  // 날짜 범위 계산 헬퍼
  const formatLocalDate = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const calculateDateRange = useCallback((period: ReportPeriod, customStart: string, customEnd: string) => {
    const today = new Date()
    let startDate: Date
    let endDate: Date

    switch (period) {
      case 'daily':
        startDate = new Date(today)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        break
      case 'yesterday':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'weekly':
        startDate = new Date(today)
        const dayOfWeek = startDate.getDay()
        startDate.setDate(today.getDate() - dayOfWeek)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(today)
        break
      case 'lastWeek':
        startDate = new Date(today)
        const lastWeekDayOfWeek = startDate.getDay()
        // 지난주 월요일
        startDate.setDate(today.getDate() - lastWeekDayOfWeek - 7)
        startDate.setHours(0, 0, 0, 0)
        // 지난주 일요일
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 6)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'monthly':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(today)
        break
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        // 지난달 마지막 날
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'yearly':
        startDate = new Date(today.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(today)
        break
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(today.getFullYear() - 1, 11, 31)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'custom':
        return {
          start: customStart,
          end: customEnd
        }
    }

    return {
      start: formatLocalDate(startDate),
      end: formatLocalDate(endDate)
    }
  }, [])
  
  // 실제 검색에 사용되는 날짜 범위 (커스텀 모드는 적용된 날짜 사용)
  const dateRange = useMemo(() => {
    return calculateDateRange(reportPeriod, appliedCustomStartDate, appliedCustomEndDate)
  }, [reportPeriod, appliedCustomStartDate, appliedCustomEndDate, calculateDateRange])

  // 기간 선택 변경 핸들러
  const handlePeriodChange = (period: ReportPeriod) => {
    setReportPeriod(period)
    // 커스텀이 아닌 경우 즉시 검색 (dateRange가 자동 업데이트됨)
    // 커스텀인 경우 검색 버튼을 눌러야 검색됨
  }

  // 커스텀 검색 버튼 핸들러
  const handleCustomSearch = () => {
    setAppliedCustomStartDate(customStartDate)
    setAppliedCustomEndDate(customEndDate)
  }

  // 리포트 생성 및 이메일 전송
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [isEmailScheduleModalOpen, setIsEmailScheduleModalOpen] = useState(false)

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증이 필요합니다.')
      }

      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          period: reportPeriod,
          dateRange,
          tab: activeTab
        })
      })

      if (!response.ok) {
        throw new Error('리포트 생성에 실패했습니다.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report_${reportPeriod}_${dateRange.start}_${dateRange.end}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('리포트 생성 오류:', error)
      alert(error instanceof Error ? error.message : '리포트 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGeneratingReport(false)
    }
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
          <BarChart3 className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">접근 권한이 없습니다</h2>
          <p className="text-gray-600">통계 리포트 페이지는 Super 권한이 있는 사용자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto px-4 overflow-x-hidden">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">종합 통계 리포트</h1>
          <p className="text-sm text-gray-600 mt-1">
            {reportPeriod === 'daily' ? '일별' : 
             reportPeriod === 'yesterday' ? '어제' :
             reportPeriod === 'weekly' ? '주별' : 
             reportPeriod === 'lastWeek' ? '지난주' :
             reportPeriod === 'monthly' ? '월별' : 
             reportPeriod === 'lastMonth' ? '지난달' :
             reportPeriod === 'yearly' ? '연간' : 
             reportPeriod === 'lastYear' ? '작년' : '기간 선택'} 리포트
            ({dateRange.start} ~ {dateRange.end})
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsEmailScheduleModalOpen(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2"
          >
            <Mail size={20} />
            <span>이메일 리포트 설정</span>
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
          >
            {isGeneratingReport ? (
              <>
                <Clock className="animate-spin" size={20} />
                <span>생성 중...</span>
              </>
            ) : (
              <>
                <Download size={20} />
                <span>리포트 다운로드</span>
              </>
            )}
          </button>
          <button
            onClick={refreshReservations}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
          >
            <BarChart3 size={20} />
            <span>데이터 새로고침</span>
          </button>
        </div>
      </div>

      {/* 리포트 기간 선택 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700">리포트 기간:</label>
          <div className="flex flex-wrap gap-2">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as ReportPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  reportPeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period === 'daily' ? '일별' : 
                 period === 'weekly' ? '주별' : 
                 period === 'monthly' ? '월별' : 
                 period === 'yearly' ? '연간' : '기간 선택'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 ml-2 border-l pl-4">
            {(['yesterday', 'lastWeek', 'lastMonth', 'lastYear'] as ReportPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  reportPeriod === period
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                }`}
              >
                {period === 'yesterday' ? '어제' : 
                 period === 'lastWeek' ? '지난주' : 
                 period === 'lastMonth' ? '지난달' : 
                 period === 'lastYear' ? '작년' : period}
              </button>
            ))}
          </div>
          
          {/* 커스텀 날짜 선택 */}
          {reportPeriod === 'custom' && (
            <div className="flex items-center gap-2 ml-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">시작일:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  max={customEndDate}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <span className="text-gray-400">~</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">종료일:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleCustomSearch}
                className="ml-2 px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <Search size={16} />
                <span>검색</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6 overflow-x-auto">
            {[
              { key: 'comprehensive', label: '종합 리포트', icon: FileText },
              { key: 'reservations', label: '예약 통계/정산', icon: Users },
              { key: 'tours', label: '투어 통계/정산', icon: Calendar },
              { key: 'expenses', label: '지출 통계', icon: TrendingUp },
              { key: 'deposits', label: '입금 통계', icon: CreditCard },
              { key: 'settlement', label: '정산 통계', icon: Receipt },
              { key: 'cash', label: '현금 관리', icon: DollarSign }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as ReportTab)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
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

      {/* 탭 내용 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {activeTab === 'comprehensive' && (
          <ComprehensiveReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
            reservations={reservations}
            products={products}
            channels={channels}
            customers={customers}
          />
        )}
        {activeTab === 'reservations' && (
          <ReservationReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
            reservations={reservations}
            products={products}
            channels={channels}
            customers={customers}
          />
        )}
        {activeTab === 'tours' && (
          <TourReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
          />
        )}
        {activeTab === 'expenses' && (
          <ExpenseReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
          />
        )}
        {activeTab === 'deposits' && (
          <DepositReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
          />
        )}
        {activeTab === 'settlement' && (
          <SettlementReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
          />
        )}
        {activeTab === 'cash' && (
          <CashReportTab 
            dateRange={dateRange} 
            period={reportPeriod}
          />
        )}
      </div>

      {/* 이메일 스케줄 모달 */}
      <EmailScheduleModal 
        isOpen={isEmailScheduleModalOpen}
        onClose={() => setIsEmailScheduleModalOpen(false)}
      />
    </div>
  )
}
