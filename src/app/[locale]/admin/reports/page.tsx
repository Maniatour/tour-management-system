'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, BarChart3, TrendingUp, Users, Package, Receipt, DollarSign, CreditCard, FileText, Mail, Download, Clock } from 'lucide-react'
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

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
type ReportTab = 'comprehensive' | 'reservations' | 'tours' | 'expenses' | 'deposits' | 'settlement' | 'cash'

export default function AdminReports({ }: AdminReportsProps) {
  const t = useTranslations('reports')
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
  const [activeTab, setActiveTab] = useState<ReportTab>('comprehensive')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily')
  
  // 날짜 범위 계산
  const dateRange = useMemo(() => {
    const today = new Date()
    let startDate: Date
    let endDate = new Date(today)
    endDate.setHours(23, 59, 59, 999)

    switch (reportPeriod) {
      case 'daily':
        startDate = new Date(today)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'weekly':
        startDate = new Date(today)
        const dayOfWeek = startDate.getDay()
        startDate.setDate(today.getDate() - dayOfWeek)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'monthly':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'yearly':
        startDate = new Date(today.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        break
    }

    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }, [reportPeriod])

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
          <h1 className="text-3xl font-bold text-gray-900">종합 통계 리포트</h1>
          <p className="text-sm text-gray-600 mt-1">
            {reportPeriod === 'daily' ? '일별' : 
             reportPeriod === 'weekly' ? '주별' : 
             reportPeriod === 'monthly' ? '월별' : '연간'} 리포트
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
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">리포트 기간:</label>
          <div className="flex space-x-2">
            {(['daily', 'weekly', 'monthly', 'yearly'] as ReportPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setReportPeriod(period)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  reportPeriod === period
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period === 'daily' ? '일별' : 
                 period === 'weekly' ? '주별' : 
                 period === 'monthly' ? '월별' : '연간'}
              </button>
            ))}
          </div>
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
