'use client'

import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Calendar, 
  Settings, 
  MapPin, 
  BarChart3,
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
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import ReactCountryFlag from 'react-country-flag'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface AdminSidebarAndHeaderProps {
  locale: string
  children: React.ReactNode
}

interface AttendanceRecord {
  id: string
  employee_email: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  work_hours: number
  status: string
  notes: string | null
  session_number: number
  employee_name: string
  employee_email: string
}

export default function AdminSidebarAndHeader({ locale, children }: AdminSidebarAndHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut, authUser, userRole } = useAuth()
  const currentLocale = locale
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState<AttendanceRecord | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [employeeNotFound, setEmployeeNotFound] = useState(false)
  const [showAttendanceModal, setShowAttendanceModal] = useState(false)
  const [attendanceAction, setAttendanceAction] = useState<'checkin' | 'checkout' | null>(null)
  const [elapsedTime, setElapsedTime] = useState('00:00:00')


  // 오늘의 출퇴근 기록 조회
  const fetchTodayRecords = async () => {
    if (!authUser?.email) return

    try {
      // 먼저 이메일로 직원 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single()

      if (employeeError) {
        console.error('직원 정보 조회 오류:', employeeError)
        setEmployeeNotFound(true)
        return
      }

      if (!employeeData) {
        console.log('직원 정보를 찾을 수 없습니다.')
        setEmployeeNotFound(true)
        return
      }

      // 오늘의 모든 출퇴근 기록 조회
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_email', employeeData.email)
        .eq('date', new Date().toISOString().split('T')[0])
        .order('session_number', { ascending: true })

      if (error && error.code !== 'PGRST116') {
        console.log('출퇴근 기록 테이블이 아직 생성되지 않았습니다.')
        setCurrentSession(null)
        return
      }

      if (data && data.length > 0) {
        const records = data.map(record => ({
          ...record,
          employee_name: employeeData.name_ko,
          employee_email: employeeData.email
        }))
        
        // 현재 진행 중인 세션 찾기 (퇴근하지 않은 세션)
        const activeSession = records.find(record => 
          record.check_in_time && !record.check_out_time
        )
        setCurrentSession(activeSession || null)
      } else {
        setCurrentSession(null)
      }
    } catch (error) {
      console.error('오늘 기록 조회 중 오류:', error)
    }
  }

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

  // 출근 체크인 실행
  const handleCheckIn = async () => {
    if (!authUser?.email) return

    setIsCheckingIn(true)
    try {
      // 먼저 이메일로 직원 정보 조회
      const { data: employeeData, error: employeeError } = await supabase
        .from('team')
        .select('name_ko, email')
        .eq('email', authUser.email)
        .eq('is_active', true)
        .single()

      if (employeeError) {
        console.error('직원 정보 조회 오류:', employeeError)
        alert('직원 정보를 찾을 수 없습니다.')
        return
      }

      if (!employeeData) {
        alert('직원 정보를 찾을 수 없습니다.')
        return
      }

      // 오늘의 기존 기록 조회하여 다음 세션 번호 계산
      const { data: existingRecords } = await supabase
        .from('attendance_records')
        .select('session_number')
        .eq('employee_email', employeeData.email)
        .eq('date', new Date().toISOString().split('T')[0])
        .order('session_number', { ascending: false })
        .limit(1)

      const nextSessionNumber = existingRecords && existingRecords.length > 0 
        ? existingRecords[0].session_number + 1 
        : 1

      const { error } = await supabase
        .from('attendance_records')
        .insert({
          employee_email: employeeData.email,
          date: new Date().toISOString().split('T')[0],
          check_in_time: new Date().toISOString(),
          status: 'present',
          session_number: nextSessionNumber
        })

      if (error) {
        console.error('출근 체크인 오류:', error)
        alert('출퇴근 기록 테이블이 아직 생성되지 않았습니다. 관리자에게 문의하세요.')
        return
      }

      fetchTodayRecords()
      setShowAttendanceModal(false)
    } catch (error) {
      console.error('출근 체크인 중 오류:', error)
      alert('출근 체크인 중 오류가 발생했습니다.')
    } finally {
      setIsCheckingIn(false)
    }
  }

  // 퇴근 체크아웃 실행
  const handleCheckOut = async () => {
    if (!currentSession) return

    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out_time: new Date().toISOString()
        })
        .eq('id', currentSession.id)

      if (error) {
        console.error('퇴근 체크아웃 오류:', error)
        alert('퇴근 체크아웃에 실패했습니다.')
        return
      }

      alert(`${currentSession.session_number}번째 퇴근 체크아웃이 완료되었습니다!`)
      fetchTodayRecords()
      setShowAttendanceModal(false)
    } catch (error) {
      console.error('퇴근 체크아웃 중 오류:', error)
      alert('퇴근 체크아웃 중 오류가 발생했습니다.')
    }
  }

  // 모달에서 확인 버튼 클릭
  const handleConfirmAttendance = () => {
    if (attendanceAction === 'checkin') {
      handleCheckIn()
    } else if (attendanceAction === 'checkout') {
      handleCheckOut()
    }
  }

  // 경과 시간 계산 함수
  const calculateElapsedTime = (startTime: string) => {
    const start = new Date(startTime)
    const now = new Date()
    const diff = now.getTime() - start.getTime()
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // 타이머 업데이트
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (currentSession && currentSession.check_in_time && !currentSession.check_out_time) {
      // 1초마다 경과 시간 업데이트
      interval = setInterval(() => {
        setElapsedTime(calculateElapsedTime(currentSession.check_in_time!))
      }, 1000)
    } else {
      setElapsedTime('00:00:00')
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [currentSession])

  // 컴포넌트 마운트 시 오늘의 출퇴근 기록 조회
  useEffect(() => {
    if (authUser?.email) {
      fetchTodayRecords()
    }
  }, [authUser])

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
    window.location.href = newPath
  }

  // 언어 플래그 함수
  const getLanguageFlag = () => {
    return currentLocale === 'ko' ? 'KR' : 'US'
  }

  const navigation = [
    { name: '대시보드', href: `/${locale}/admin`, icon: BarChart3 },
    { name: '고객 관리', href: `/${locale}/admin/customers`, icon: Users },
    { name: '상품 관리', href: `/${locale}/admin/products`, icon: BookOpen },
    { name: '예약 관리', href: `/${locale}/admin/reservations`, icon: Calendar },
    { name: '예약 통계', href: `/${locale}/admin/reservations/statistics`, icon: BarChart3 },
    { name: '부킹 관리', href: `/${locale}/admin/booking`, icon: BookOpen },
    { name: '채팅 관리', href: `/${locale}/admin/chat-management`, icon: MessageCircle },
    { name: '데이터 동기화', href: `/${locale}/admin/data-sync`, icon: FileSpreadsheet },
    { name: '출퇴근 관리', href: `/${locale}/admin/attendance`, icon: Clock },
    { name: '공급업체 관리', href: `/${locale}/admin/suppliers`, icon: Truck },
    { name: '공급업체 정산', href: `/${locale}/admin/suppliers/settlement`, icon: DollarSign },
    { name: '데이터 검수', href: `/${locale}/admin/data-review`, icon: FileCheck },
    { name: '픽업 호텔 관리', href: `/${locale}/admin/pickup-hotels`, icon: Building },
    { name: '차량 관리', href: `/${locale}/admin/vehicles`, icon: Car },
    { name: '팀 관리', href: `/${locale}/admin/team`, icon: Users },
    { name: '옵션 관리', href: `/${locale}/admin/options`, icon: Settings },
    { name: '투어 관리', href: `/${locale}/admin/tours`, icon: MapPin },
    { name: '채널 관리', href: `/${locale}/admin/channels`, icon: Settings },
    { name: '쿠폰 관리', href: `/${locale}/admin/coupons`, icon: Ticket },
    { name: '감사 추적', href: `/${locale}/admin/audit-logs`, icon: History },
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
              <h1 className="text-sm sm:text-lg md:text-xl font-bold text-gray-800 truncate">
                MANIA TOUR
              </h1>
              
              {/* 데스크톱 전용 빠른 이동 */}
              <div className="hidden lg:flex items-center space-x-2">
                <Link
                  href={`/${locale}/admin/reservations`}
                  className="px-3 py-1.5 text-sm border rounded-md text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                >
                  예약 관리
                </Link>
                <Link
                  href={`/${locale}/admin/booking`}
                  className="px-3 py-1.5 text-sm border rounded-md text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white transition-colors"
                >
                  부킹 관리
                </Link>
                <Link
                  href={`/${locale}/admin/tours`}
                  className="px-3 py-1.5 text-sm border rounded-md text-green-600 border-green-600 hover:bg-green-600 hover:text-white transition-colors"
                >
                  투어 관리
                </Link>
              </div>
              
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-4">
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
                      <span className="hidden sm:inline">{isCheckingIn ? '체크인 중...' : '출근'}</span>
                      <span className="sm:hidden">출근</span>
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
                      {(authUser?.name || authUser?.email?.split('@')[0] || '사용자').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {authUser?.name || authUser?.email?.split('@')[0] || '사용자'}님
                    </div>
                    <div className="text-xs text-gray-500">
                      {userRole === 'admin' ? '관리자' : 
                       userRole === 'manager' ? '매니저' : 
                       userRole === 'team_member' ? '팀원' : 
                       authUser?.email ? '구글 사용자' : '고객'}
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
                            {authUser?.name || authUser?.email?.split('@')[0] || '사용자'}
                          </p>
                          <p className="text-xs text-gray-500">{authUser?.email || '이메일 정보 없음'}</p>
                          {userRole && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              {userRole === 'admin' ? '관리자' : 
                               userRole === 'manager' ? '매니저' : 
                               userRole === 'team_member' ? '팀원' : '고객'}
                            </p>
                          )}
                        </div>
                        
                        <Link
                          href={`/${locale}/dashboard`}
                          onClick={handleUserMenuClick}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <Home className="w-4 h-4 mr-2" />
                          고객 페이지
                        </Link>
                        
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
                title={`Switch to ${currentLocale === 'ko' ? 'English' : '한국어'}`}
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
          <h1 className="text-xl font-bold text-gray-900">MANIA TOUR</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <nav className="mt-8 px-4">
          {/* 모바일 네비게이션 메뉴 */}
          <div className="mb-6">
          </div>

          {/* 메인 네비게이션 */}
          <div className="mb-6">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-0.5 text-sm font-medium rounded-lg mb-1 transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={16} className="mr-3" />
                  {item.name}
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
            className="flex items-center w-full px-3 py-0.5 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={16} className="mr-3" />
            로그아웃
          </button>
        </nav>
      </div>

      {/* 데스크톱 사이드바 - 헤더 아래에 위치 */}
      <div className="hidden lg:fixed lg:top-16 lg:left-0 lg:bottom-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white shadow-lg">
          <nav className="flex-1 px-4 mt-8">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg mb-2 transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} className="mr-3" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          {/* 데스크톱 로그아웃 버튼 */}
          <div className="px-4 pb-4">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg transition-colors"
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
          <div className="max-w-full mx-auto px-1 sm:px-4 lg:px-6">
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
    </>
  )
}
