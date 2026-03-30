'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, BarChart3, TrendingUp, Users, Package, Receipt, DollarSign, CreditCard, FileText, Mail, Download, Clock, Search, Landmark, PieChart } from 'lucide-react'
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
import StatementReconciliationTab from '@/components/reports/StatementReconciliationTab'
import PnlUnifiedReportTab from '@/components/reports/PnlUnifiedReportTab'
import EmailScheduleModal from '@/components/reports/EmailScheduleModal'
import { useRoutePersistedState } from '@/hooks/useRoutePersistedState'
import { AccountingTerm } from '@/components/ui/AccountingTerm'

interface AdminReportsProps {
  params: Promise<{ locale: string }>
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'lastYear'
type ReportTab =
  | 'comprehensive'
  | 'reservations'
  | 'tours'
  | 'expenses'
  | 'deposits'
  | 'settlement'
  | 'cash'
  | 'reconciliation'
  | 'pnl'

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

  // 상태 관리 (탭·기간 — 새로고침 유지)
  const [reportNav, setReportNav] = useRoutePersistedState(
    'report-nav',
    { activeTab: 'comprehensive' as ReportTab, reportPeriod: 'daily' as ReportPeriod }
  )
  const { activeTab, reportPeriod } = reportNav
  const setActiveTab = (tab: ReportTab) => setReportNav((n) => ({ ...n, activeTab: tab }))
  const setReportPeriod = (period: ReportPeriod) => setReportNav((n) => ({ ...n, reportPeriod: period }))
  
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
    <div className="space-y-4 sm:space-y-6 max-w-[1920px] mx-auto px-3 sm:px-4 min-w-0 overflow-x-hidden pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">종합 통계 리포트</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
            {reportPeriod === 'daily' ? '일별' : 
             reportPeriod === 'yesterday' ? '어제' :
             reportPeriod === 'weekly' ? '주별' : 
             reportPeriod === 'lastWeek' ? '지난주' :
             reportPeriod === 'monthly' ? '월별' : 
             reportPeriod === 'lastMonth' ? '지난달' :
             reportPeriod === 'yearly' ? '연간' : 
             reportPeriod === 'lastYear' ? '작년' : '기간 선택'} 리포트
            <span className="block sm:inline sm:before:content-['_'] sm:before:whitespace-pre">
              ({dateRange.start} ~ {dateRange.end})
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:items-center w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsEmailScheduleModalOpen(true)}
            className="bg-purple-600 text-white px-3 py-2.5 sm:px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 text-sm min-h-[44px] sm:min-h-0"
          >
            <Mail size={18} className="shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">이메일 설정</span>
          </button>
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="bg-blue-600 text-white px-3 py-2.5 sm:px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm min-h-[44px] sm:min-h-0"
          >
            {isGeneratingReport ? (
              <>
                <Clock className="animate-spin shrink-0" size={18} />
                <span>생성 중...</span>
              </>
            ) : (
              <>
                <Download size={18} className="shrink-0 sm:w-5 sm:h-5" />
                <span className="truncate">다운로드</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={refreshReservations}
            className="bg-gray-600 text-white px-3 py-2.5 sm:px-4 rounded-lg hover:bg-gray-700 flex items-center justify-center gap-2 text-sm min-h-[44px] sm:min-h-0"
          >
            <BarChart3 size={18} className="shrink-0 sm:w-5 sm:h-5" />
            <span className="truncate">새로고침</span>
          </button>
        </div>
      </div>

      {/* 리포트 기간 선택 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <label className="text-xs sm:text-sm font-medium text-gray-700 shrink-0">리포트 기간</label>
          <div className="flex flex-wrap gap-2">
            {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as ReportPeriod[]).map((period) => (
              <button
                type="button"
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-2.5 sm:py-2 text-xs sm:text-sm rounded-md transition-colors min-h-[40px] sm:min-h-0 ${
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
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4 lg:ml-0">
            {[
              { period: 'yesterday' as ReportPeriod, label: '어제' },
              { period: 'daily' as ReportPeriod, label: '오늘' },
              { period: 'lastWeek' as ReportPeriod, label: '지난주' },
              { period: 'lastMonth' as ReportPeriod, label: '지난달' },
              { period: 'monthly' as ReportPeriod, label: '이번달' },
              { period: 'lastYear' as ReportPeriod, label: '작년' },
              { period: 'yearly' as ReportPeriod, label: '올해' }
            ].map(({ period, label }) => (
              <button
                type="button"
                key={label}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-2.5 sm:py-2 text-xs sm:text-sm rounded-md transition-colors min-h-[40px] sm:min-h-0 ${
                  reportPeriod === period
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          {reportPeriod === 'custom' && (
            <div className="flex flex-col gap-3 w-full sm:flex-row sm:flex-wrap sm:items-end pt-2 border-t border-gray-100 lg:border-t-0 lg:ml-2 lg:pt-0 lg:flex-1 lg:min-w-[min(100%,20rem)]">
              <div className="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-[140px]">
                <label className="text-xs text-gray-600">시작일</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  max={customEndDate}
                  className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
                />
              </div>
              <span className="hidden sm:inline text-gray-400 pb-2">~</span>
              <div className="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-[140px]">
                <label className="text-xs text-gray-600">종료일</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  min={customStartDate}
                  className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm min-h-[44px]"
                />
              </div>
              <button
                type="button"
                onClick={handleCustomSearch}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Search size={16} />
                <span>검색</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/80 sm:bg-transparent">
          <nav
            className="-mb-px flex gap-1 sm:gap-0 sm:space-x-6 px-2 sm:px-4 overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x py-1 [scrollbar-width:thin]"
            aria-label="리포트 탭"
          >
            {[
              { key: 'comprehensive', label: '종합 리포트', icon: FileText },
              { key: 'reservations', label: '예약 통계/정산', icon: Users },
              { key: 'tours', label: '투어 통계/정산', icon: Calendar },
              { key: 'expenses', label: '지출 통계', icon: TrendingUp },
              { key: 'deposits', label: '입금 통계', icon: CreditCard },
              { key: 'settlement', label: '정산 통계', icon: Receipt },
              { key: 'cash', label: '현금 관리', icon: DollarSign },
              { key: 'reconciliation', label: '명세 대조', icon: Landmark },
              { key: 'pnl', label: '통합 PNL', icon: PieChart }
            ].map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                onClick={() => setActiveTab(key as ReportTab)}
                className={`flex shrink-0 items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap min-h-[44px] sm:min-h-[48px] ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" aria-hidden />
                <span>
                  {key === 'pnl' ? (
                    <>
                      통합 <AccountingTerm termKey="PNL">PNL</AccountingTerm>
                    </>
                  ) : key === 'reconciliation' ? (
                    <AccountingTerm termKey="명세대조">{label}</AccountingTerm>
                  ) : key === 'cash' ? (
                    <AccountingTerm termKey="현금관리">{label}</AccountingTerm>
                  ) : (
                    label
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 탭 내용 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5 lg:p-6 min-w-0">
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
        {activeTab === 'reconciliation' && <StatementReconciliationTab />}
        {activeTab === 'pnl' && <PnlUnifiedReportTab dateRange={dateRange} />}
      </div>

      {/* 이메일 스케줄 모달 */}
      <EmailScheduleModal 
        isOpen={isEmailScheduleModalOpen}
        onClose={() => setIsEmailScheduleModalOpen(false)}
      />
    </div>
  )
}
