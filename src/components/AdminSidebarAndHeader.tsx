'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react'
import { 
  Users, 
  Settings, 
  BarChart3,
  FileText,
  LogOut,
  Menu,
  X,
  History,
  Ticket,
  Building,
  FileCheck,
  Car,
  BookOpen,
  Truck,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Home,
  ChevronDown,
  MessageCircle,
  FileSpreadsheet,
  Globe,
  User,
  Camera,
  Calculator,
  UserCheck
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import ReactCountryFlag from 'react-country-flag'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useAttendanceSync } from '@/hooks/useAttendanceSync'
import { useTranslations } from 'next-intl'
import SimulationModal from './SimulationModal'
import CustomerSimulationModal from './CustomerSimulationModal'
import AdminWeatherWidget from './AdminWeatherWidget'

interface AdminSidebarAndHeaderProps {
  locale: string
  children: React.ReactNode
}


export default function AdminSidebarAndHeader({ locale, children }: AdminSidebarAndHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, authUser, userRole, isSimulating, stopSimulation } = useAuth()
  const currentLocale = locale
  const t = useTranslations('common')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [attendanceAction, setAttendanceAction] = useState<'checkin' | 'checkout' | null>(null)
  const [teamBoardCount, setTeamBoardCount] = useState(0)
  const [showSimulationModal, setShowSimulationModal] = useState(false)
  const [showCustomerSimulationModal, setShowCustomerSimulationModal] = useState(false)
  const [expiringDocumentsCount, setExpiringDocumentsCount] = useState(0)
  // AuthContext에서 팀 채팅 안읽은 메시지 수 가져오기
  const { teamChatUnreadCount } = useAuth()
  
  // 출퇴근 동기화 훅 사용
  const {
    currentSession,
    isCheckingIn,
    employeeNotFound,
    elapsedTime,
    handleCheckIn,
    handleCheckOut
  } = useAttendanceSync()



  // 출근 체크인 모달 열기
  const handleCheckInClick = () => {
    setAttendanceAction('checkin')
    setShowAttendanceModal(true)
  }

  // 퇴근 체크아웃 모달 열기
  const handleCheckOutClick = () => {
    setAttendanceAction('checkout')
    setShowAttendanceModal(true)
  }

  // 출근/퇴근 실행 (커스텀 훅 사용)
  const handleCheckInExecute = async () => {
    await handleCheckIn()
    setShowAttendanceModal(false)
  }

  const handleCheckOutExecute = async () => {
    await handleCheckOut()
    setShowAttendanceModal(false)
  }

  // 모달에서 확인 버튼 클릭
  const handleConfirmAttendance = () => {
    if (attendanceAction === 'checkin') {
      handleCheckInExecute()
    } else if (attendanceAction === 'checkout') {
      handleCheckOutExecute()
    }
  }

  // 경과 시간과 타이머는 커스텀 훅에서 처리됨

  // 만료 예정 문서 수 가져오기
  const fetchExpiringDocumentsCount = useCallback(async () => {
    try {
      if (!authUser?.email) {
        setExpiringDocumentsCount(0)
        return
      }

      const now = new Date()
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      
      let query = supabase
        .from('documents')
        .select('id, expiry_date')
        .not('expiry_date', 'is', null)
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0])
        .gte('expiry_date', now.toISOString().split('T')[0])

      // 관리자가 아닌 경우 자신이 생성한 문서만 조회
      if (userRole !== 'admin') {
        query = query.eq('created_by', authUser.id)
      }

      const { data, error } = await query

      if (error) throw error
      setExpiringDocumentsCount(data?.length || 0)
    } catch (error) {
      console.error('만료 예정 문서 수 조회 오류:', error)
      setExpiringDocumentsCount(0)
    }
  }, [authUser, userRole])

  // 팀 보드 배지 카운트: 내가 받아야 할 공지(미확인) + 내게 할당된 진행중 업무 수
  const fetchTeamBoardCount = useCallback(async () => {
    try {
      if (!authUser?.email) {
        setTeamBoardCount(0)
        return
      }

      const myEmail = authUser.email.toLowerCase()
      // 내 포지션 조회 (공지 target_positions 매칭용)
      const { data: me } = await (supabase as any)
        .from('team' as any)
        .select('position, is_active')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .maybeSingle()

      const myPosition = (me?.position as string) || null

      // 내가 확인한 공지 목록
      const { data: myAcks } = await (supabase as any)
        .from('team_announcement_acknowledgments' as any)
        .select('announcement_id')
        .eq('ack_by', myEmail)

      const ackedIds = (myAcks as any[] | null)?.map((r: any) => r.announcement_id) || []

      // recipients 에 내 이메일이 포함된 공지
      const { data: annsByEmail } = await (supabase as any)
        .from('team_announcements' as any)
        .select('id, recipients, target_positions, is_archived')
        .contains('recipients', [myEmail])

      // target_positions 에 내 포지션이 포함된 공지
      let annsByPos: any[] = []
      if (myPosition) {
        const { data } = await (supabase as any)
          .from('team_announcements' as any)
          .select('id, recipients, target_positions, is_archived')
          .contains('target_positions', [myPosition])
        annsByPos = (data as any[]) || []
      }

      const targetedAnns = ([...(annsByEmail as any[] || []), ...annsByPos])
        .filter((a: any) => a && a.is_archived !== true)
      const targetedAnnIds = Array.from(new Set(targetedAnns.map((a: any) => a.id)))
      const unackedAnnIds = targetedAnnIds.filter((id) => !ackedIds.includes(id))

      // 내게 할당된 진행중 업무 수
      const { data: myOpenTasks } = await (supabase as any)
        .from('tasks' as any)
        .select('id')
        .eq('assigned_to', myEmail)
        .in('status', ['pending', 'in_progress'] as any)

      const taskCount = (myOpenTasks as any[] | null)?.length || 0
      setTeamBoardCount(unackedAnnIds.length + taskCount)
    } catch (err) {
      console.warn('Failed to fetch team board count:', err)
      setTeamBoardCount(0)
    }
  }, [authUser?.email])

  useEffect(() => {
    fetchTeamBoardCount()
    fetchExpiringDocumentsCount()
    const interval = setInterval(() => {
      fetchTeamBoardCount()
      fetchExpiringDocumentsCount()
    }, 60_000)
    return () => clearInterval(interval)
  }, [fetchTeamBoardCount, fetchExpiringDocumentsCount])

  // AuthContext에서 자동으로 관리되므로 별도 useEffect 불필요

  const handleLogout = async () => {
    try {
      await signOut()
      router.push(`/${locale}/auth`)
    } catch (error) {
      console.error('로그아웃 중 오류가 발생했습니다:', error)
    }
  }

  const handleUserMenuClick = () => {
    setIsUserMenuOpen(false)
  }

  // 언어 전환 함수
  const handleLanguageToggle = () => {
    const newLocale = currentLocale === 'ko' ? 'en' : 'ko'
    // 현재 경로에서 locale 부분을 정확히 교체
    const newPath = pathname.replace(/^\/[a-z]{2}/, `/${newLocale}`)
    console.log('Current path:', pathname)
    console.log('New path:', newPath)
    console.log('Current locale:', currentLocale)
    console.log('New locale:', newLocale)
    
    // 언어 관련 상태 정리
    localStorage.removeItem('locale')
    localStorage.removeItem('preferred-locale')
    
    // 새로운 언어 설정 (쿠키 설정)
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
    
    // Next.js router를 사용하여 클라이언트 사이드 네비게이션
    router.push(newPath)
  }

  // 언어 플래그 함수
  const getLanguageFlag = () => {
    return currentLocale === 'ko' ? 'KR' : 'US'
  }

  const navigation = [
    // removed from sidebar: 대시보드, 고객 관리, 예약 관리, 부킹 관리, 투어 관리, 채팅 관리
    { name: t('products'), href: `/${locale}/admin/products`, icon: BookOpen },
    { name: '가이드비 관리', href: `/${locale}/admin/guide-costs`, icon: Calculator },
    { name: t('options'), href: `/${locale}/admin/options`, icon: Settings },
    { name: t('channels'), href: `/${locale}/admin/channels`, icon: Settings },
    { name: t('courses'), href: `/${locale}/admin/tour-courses`, icon: Globe },
    { name: t('pickupHotels'), href: `/${locale}/admin/pickup-hotels`, icon: Building },
    { name: t('vehicles'), href: `/${locale}/admin/vehicles`, icon: Car },
    { name: t('coupons'), href: `/${locale}/admin/coupons`, icon: Ticket },
    { name: t('reservationStats'), href: `/${locale}/admin/reservations/statistics`, icon: BarChart3 },
    { name: t('documentTemplates'), href: `/${locale}/admin/reservations/templates`, icon: FileText },
    { name: t('team'), href: `/${locale}/admin/team`, icon: Users },
    { name: t('teamChat'), href: `/${locale}/admin/team-chat`, icon: MessageCircle },
    { name: t('attendance'), href: `/${locale}/admin/attendance`, icon: Clock },
    { name: t('documents'), href: `/${locale}/admin/documents`, icon: FileText },
    { name: t('suppliers'), href: `/${locale}/admin/suppliers`, icon: Truck },
    { name: t('supplierSettlement'), href: `/${locale}/admin/suppliers/settlement`, icon: DollarSign },
    { name: t('teamBoard'), href: `/${locale}/admin/team-board`, icon: BookOpen },
    { name: t('tourMaterials'), href: `/${locale}/admin/tour-materials`, icon: FileText },
    { name: t('tourPhotoBuckets'), href: `/${locale}/admin/tour-photo-buckets`, icon: Camera },
    { name: t('dataSync'), href: `/${locale}/admin/data-sync`, icon: FileSpreadsheet },
    { name: t('dataReview'), href: `/${locale}/admin/data-review`, icon: FileCheck },
    { name: t('auditLogs'), href: `/${locale}/admin/audit-logs`, icon: History },
    // 개발자 도구 (관리자만 보이도록, 시뮬레이션 중일 때도 표시)
    ...((userRole === 'admin' || (userRole === 'team_member' && isSimulating)) ? [{ name: '개발자 도구', href: `/${locale}/admin/dev-tools`, icon: Settings }] : []),
  ]

  return (
    <>
      {/* 어드민 헤더 - 페이지 가장 상단에 여백 없이 */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="w-full px-2 sm:px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
              >
                <Menu size={20} />
              </button>
              
              {/* 시스템 제목 */}
              <button
                onClick={() => router.push(`/${locale}/admin`)}
                className="text-sm sm:text-lg md:text-xl font-bold text-gray-800 truncate hover:text-blue-600"
                title="대시보드로 이동"
              >
                {t('systemTitle')}
              </button>
              
              {/* 데스크톱 전용 빠른 이동 */}
              <div className="hidden lg:flex items-center space-x-2">
                <Link
                  href={`/${locale}/admin/customers`}
                  className="px-3 py-1.5 text-sm border rounded-md text-teal-600 border-teal-600 hover:bg-teal-600 hover:text-white transition-colors"
                >
                  {t('customers')}
                </Link>
                <Link
                  href={`/${locale}/admin/reservations`}
                  className="px-3 py-1.5 text-sm border rounded-md text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                >
                  {t('reservations')}
                </Link>
                <Link
                  href={`/${locale}/admin/booking`}
                  className="px-3 py-1.5 text-sm border rounded-md text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                >
                  {t('booking')}
                </Link>
                <Link
                  href={`/${locale}/admin/tours`}
                  className="px-3 py-1.5 text-sm border rounded-md text-green-600 border-green-600 hover:bg-green-600 hover:text-white transition-colors"
                >
                  {t('tours')}
                </Link>
                <Link
                  href={`/${locale}/admin/chat-management`}
                  className="px-3 py-1.5 text-sm border rounded-md text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white transition-colors"
                >
                  {t('chatManagement')}
                </Link>
                {/* 개발자 도구 (관리자만 표시) */}
                {(userRole === 'admin' || (userRole === 'team_member' && isSimulating)) && (
                  <Link
                    href={`/${locale}/admin/dev-tools`}
                    className="px-3 py-1.5 text-sm border rounded-md text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white transition-colors"
                  >
                    개발자 도구
                  </Link>
                )}
              </div>
              
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-4">
              {/* 날씨 위젯 (데스크톱에서만 표시) */}
              <div className="hidden lg:block">
                <AdminWeatherWidget />
              </div>
              
              {/* 출퇴근 버튼 (팀원만 표시) - 모바일에서는 작게 */}
              {authUser?.email && !employeeNotFound && (
                <div className="flex items-center space-x-2">
                  {/* 경과 시간 표시 (출근 중일 때만) */}
                  {currentSession && currentSession.check_in_time && !currentSession.check_out_time && (
                    <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs sm:text-sm font-mono font-medium">
                        {elapsedTime}
                      </span>
                    </div>
                  )}
                  
                  {!currentSession ? (
                    <button
                      onClick={handleCheckInClick}
                      disabled={isCheckingIn}
                      className="flex items-center px-2 py-1 sm:px-3 sm:py-2 bg-green-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">{isCheckingIn ? t('checkingIn') : t('checkIn')}</span>
                      <span className="sm:hidden">{t('checkIn')}</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleCheckOutClick}
                      className="flex items-center px-2 py-1 sm:px-3 sm:py-2 bg-red-600 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      <span className="hidden sm:inline">퇴근</span>
                      <span className="sm:hidden">퇴근</span>
                    </button>
                  )}

                  {/* 팀 보드 바로가기 */}
                  <div className="relative hidden sm:inline-block">
                    <Link
                      href={`/${locale}/admin/team-board`}
                      className="inline-flex items-center justify-center w-9 h-9 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="팀 보드로 이동"
                    >
                      <BookOpen className="w-5 h-5" />
                    </Link>
                    {teamBoardCount > 0 && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full min-w-[18px] h-[18px] px-1">
                        {teamBoardCount > 99 ? '99+' : teamBoardCount}
                      </span>
                    )}
                  </div>

                  {/* 팀 채팅 바로가기 */}
                  <div className="relative hidden sm:inline-block">
                    <Link
                      href={`/${locale}/admin/team-chat`}
                      className="inline-flex items-center justify-center w-9 h-9 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="팀 채팅으로 이동"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </Link>
                    {teamChatUnreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full min-w-[18px] h-[18px] px-1">
                        {teamChatUnreadCount > 99 ? '99+' : teamChatUnreadCount}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* 사용자 정보 드롭다운 */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {(authUser?.name || authUser?.email?.split('@')[0] || t('user')).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {authUser?.name || authUser?.email?.split('@')[0] || t('user')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {isSimulating ? (
                        <span className="text-orange-600 font-medium">시뮬레이션 중</span>
                      ) : (
                        userRole === 'admin' ? t('admin') : 
                        userRole === 'manager' ? t('manager') : 
                        userRole === 'team_member' ? t('teamMember') : 
                        authUser?.email ? t('googleUser') : t('customer')
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {isUserMenuOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    
                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                      <div className="py-1">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">
                            {authUser?.name || authUser?.email?.split('@')[0] || t('user')}
                          </p>
                          <p className="text-xs text-gray-500">{authUser?.email || t('noEmailInfo')}</p>
                          {userRole && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              {isSimulating ? (
                                <span className="text-orange-600">시뮬레이션 중 ({userRole === 'admin' ? t('admin') : 
                                 userRole === 'manager' ? t('manager') : 
                                 userRole === 'team_member' ? t('teamMember') : t('customer')})</span>
                              ) : (
                                userRole === 'admin' ? t('admin') : 
                                userRole === 'manager' ? t('manager') : 
                                userRole === 'team_member' ? t('teamMember') : t('customer')
                              )}
                            </p>
                          )}
                        </div>
                        
                        {/* 페이지 이동 메뉴 */}
                        <div className="px-4 py-2 border-t border-gray-100">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            페이지 이동
                          </p>
                          
                          {/* 홈페이지 */}
                          <Link
                            href={`/${locale}`}
                            onClick={handleUserMenuClick}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Home className="w-4 h-4 mr-2" />
                            홈페이지
                          </Link>
                          
                          {/* 고객 페이지 */}
                          <Link
                            href={`/${locale}/dashboard`}
                            onClick={handleUserMenuClick}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <User className="w-4 h-4 mr-2" />
                            고객 페이지
                          </Link>
                          
                          {/* 가이드 페이지 (팀원만) */}
                          {userRole === 'team_member' && (
                            <Link
                              href={`/${locale}/guide`}
                              onClick={handleUserMenuClick}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              가이드 페이지
                            </Link>
                          )}
                        </div>
                        
                        {/* 개발자 도구 (관리자만 표시) */}
                        {(userRole === 'admin' || (userRole === 'team_member' && isSimulating)) && (
                          <div className="px-4 py-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                              관리자 도구
                            </p>
                            <Link
                              href={`/${locale}/admin/dev-tools`}
                              onClick={handleUserMenuClick}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              개발자 도구
                            </Link>
                          </div>
                        )}
                        
                        {/* 시뮬레이션 메뉴 (관리자만) */}
                        {userRole === 'admin' && (
                          <div className="px-4 py-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                              시뮬레이션
                            </p>
                            
                            {/* 가이드 시뮬레이션 */}
                            <button
                              onClick={() => {
                                setShowSimulationModal(true)
                                handleUserMenuClick()
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              가이드 시뮬레이션
                            </button>
                            
                            {/* 고객 시뮬레이션 */}
                            <button
                              onClick={() => {
                                setShowCustomerSimulationModal(true)
                                handleUserMenuClick()
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center"
                            >
                              <User className="w-4 h-4 mr-2" />
                              고객 시뮬레이션
                            </button>
                          </div>
                        )}
                        
                        {/* 현재 시뮬레이션 상태 표시 */}
                        {isSimulating && (
                          <div className="px-4 py-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                              현재 시뮬레이션
                            </p>
                            {/* 가이드 시뮬레이션인 경우 */}
                            {userRole === 'team_member' && (
                              <Link
                                href={`/${locale}/guide`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center"
                              >
                                <UserCheck className="w-4 h-4 mr-2" />
                                가이드 페이지
                              </Link>
                            )}
                            {/* 고객 시뮬레이션인 경우 */}
                            {userRole === 'customer' && (
                              <Link
                                href={`/${locale}/dashboard`}
                                onClick={handleUserMenuClick}
                                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center"
                              >
                                <User className="w-4 h-4 mr-2" />
                                고객 페이지
                              </Link>
                            )}
                            <button
                              onClick={() => {
                                stopSimulation()
                                handleUserMenuClick()
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              시뮬레이션 중지
                            </button>
                          </div>
                        )}
                        
                        <div className="border-t border-gray-100 my-1"></div>
                        
                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          로그아웃
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* 언어 스위처 */}
              <button
                onClick={handleLanguageToggle}
                className="flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
                title={currentLocale === 'ko' ? t('switchToEnglish') : t('switchToKorean')}
              >
                <ReactCountryFlag
                  countryCode={getLanguageFlag()}
                  svg
                  style={{
                    width: '24px',
                    height: '18px',
                    borderRadius: '2px'
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        </div>
      )}

      {/* 모바일 사이드바 */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <button
            onClick={() => { router.push(`/${locale}/admin`); setSidebarOpen(false) }}
            className="text-left text-xl font-bold text-gray-900 hover:text-blue-600"
            title="대시보드로 이동"
          >
            {t('systemTitle')}
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <nav className="mt-4 px-4">
          {/* 모바일 네비게이션 메뉴 */}
          <div className="mb-4">
          </div>

          {/* 메인 네비게이션 */}
          <div className="mb-4">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const isTeamChat = item.name === '팀 채팅'
              const isDocuments = item.name === t('documents')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-1 text-sm font-medium rounded-lg mb-0.5 transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={16} className="mr-3" />
                  {item.name}
                  {isTeamChat && teamChatUnreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {teamChatUnreadCount > 99 ? '99+' : teamChatUnreadCount}
                    </span>
                  )}
                  {isDocuments && expiringDocumentsCount > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {expiringDocumentsCount > 99 ? '99+' : expiringDocumentsCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          
          {/* 모바일 로그아웃 버튼 */}
          <button
            onClick={() => {
              handleLogout()
              setSidebarOpen(false)
            }}
            className="flex items-center w-full px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={16} className="mr-3" />
            로그아웃
          </button>
        </nav>
      </div>

      {/* 데스크톱 사이드바 - 헤더 아래에 위치 */}
      <div className="hidden lg:fixed lg:top-16 lg:left-0 lg:bottom-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white shadow-lg">
          <nav className="flex-1 px-4 mt-4">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const isTeamChat = item.name === '팀 채팅'
              const isDocuments = item.name === t('documents')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg mb-1 transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                  {isTeamChat && teamChatUnreadCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {teamChatUnreadCount > 99 ? '99+' : teamChatUnreadCount}
                    </span>
                  )}
                  {isDocuments && expiringDocumentsCount > 0 && (
                    <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {expiringDocumentsCount > 99 ? '99+' : expiringDocumentsCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          
          {/* 데스크톱 로그아웃 버튼 */}
          <div className="px-4 pb-2">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut size={20} className="mr-3" />
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 - 헤더 높이만큼 상단 여백 추가, 모바일 푸터를 위한 하단 여백 추가 */}
      <div className="pt-16 lg:pl-64">
        {/* 페이지 콘텐츠 */}
        <main className="py-2 sm:py-4 lg:py-6 pb-20 lg:pb-6">
          <div className="max-w-none mx-auto px-1 sm:px-2 lg:px-3">
            {children}
          </div>
        </main>
      </div>

      {/* 출퇴근 확인 모달 */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                {attendanceAction === 'checkin' ? (
                  <CheckCircle className="h-6 w-6 text-blue-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {attendanceAction === 'checkin' ? '출근 확인' : '퇴근 확인'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {attendanceAction === 'checkin' 
                  ? '출근을 시작하시겠습니까?' 
                  : '퇴근을 완료하시겠습니까?'
                }
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleConfirmAttendance}
                  disabled={isCheckingIn}
                  className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                    attendanceAction === 'checkin'
                      ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isCheckingIn ? '처리 중...' : (attendanceAction === 'checkin' ? '출근 시작' : '퇴근 완료')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 시뮬레이션 모달 */}
      <SimulationModal
        isOpen={showSimulationModal}
        onClose={() => setShowSimulationModal(false)}
      />
      
      {/* 고객 시뮬레이션 모달 */}
      <CustomerSimulationModal
        isOpen={showCustomerSimulationModal}
        onClose={() => setShowCustomerSimulationModal(false)}
      />
    </>
  )
}
