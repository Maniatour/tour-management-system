'use client'

import React, { useState, useEffect } from 'react'
import { 
  Package, 
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
  UserCheck,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState<AttendanceRecord | null>(null)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [employeeNotFound, setEmployeeNotFound] = useState(false)

  // 디버깅을 위한 사용자 정보 로깅
  console.log('AdminSidebarAndHeader - User info:', {
    authUser,
    userRole,
    hasName: !!authUser?.name,
    hasEmail: !!authUser?.email
  })

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

  // 출근 체크인
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

      alert(`${nextSessionNumber}번째 출근 체크인이 완료되었습니다!`)
      fetchTodayRecords()
    } catch (error) {
      console.error('출근 체크인 중 오류:', error)
      alert('출근 체크인 중 오류가 발생했습니다.')
    } finally {
      setIsCheckingIn(false)
    }
  }

  // 퇴근 체크아웃
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
    } catch (error) {
      console.error('퇴근 체크아웃 중 오류:', error)
      alert('퇴근 체크아웃 중 오류가 발생했습니다.')
    }
  }

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

  const navigation = [
    { name: '대시보드', href: `/${locale}/admin`, icon: BarChart3 },
    { name: '상품 관리', href: `/${locale}/admin/products`, icon: Package },
    { name: '고객 관리', href: `/${locale}/admin/customers`, icon: Users },
    { name: '예약 관리', href: `/${locale}/admin/reservations`, icon: Calendar },
    { name: '예약 통계', href: `/${locale}/admin/reservations/statistics`, icon: BarChart3 },
    { name: '부킹 관리', href: `/${locale}/admin/booking`, icon: BookOpen },
    { name: '출퇴근 관리', href: `/${locale}/admin/attendance`, icon: Clock },
    { name: '공급업체 관리', href: `/${locale}/admin/suppliers`, icon: Truck },
    { name: '공급업체 정산', href: `/${locale}/admin/suppliers/settlement`, icon: DollarSign },
    { name: 'Off 스케줄 관리', href: `/${locale}/admin/off-schedule`, icon: UserCheck },
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
        <div className="w-full px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-500 hover:text-gray-700"
              >
                <Menu size={24} />
              </button>
              
              {/* 시스템 제목 */}
              <h1 className="text-lg md:text-xl font-bold text-gray-800">
                투어 관리 시스템
              </h1>
              
              {/* 어드민 네비게이션 메뉴 */}
              <Link 
                href={`/${locale}/admin/products`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Package className="w-4 h-4 mr-2" />
                상품 관리
              </Link>
              <Link 
                href={`/${locale}/admin/off-schedule`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Off 스케줄 관리
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 출퇴근 버튼 (팀원만 표시) */}
              {authUser?.email && !employeeNotFound && (
                <div className="flex items-center space-x-2">
                  {!currentSession ? (
                    <button
                      onClick={handleCheckIn}
                      disabled={isCheckingIn}
                      className="flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {isCheckingIn ? '체크인 중...' : '출근'}
                    </button>
                  ) : (
                    <button
                      onClick={handleCheckOut}
                      className="flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      퇴근
                    </button>
                  )}
                </div>
              )}
              
              <div className="text-sm text-gray-700">
                <div className="font-medium">
                  {authUser?.name || authUser?.email?.split('@')[0] || '사용자'}님, 안녕하세요!
                </div>
                <div className="text-xs text-gray-500">
                  {authUser?.email || '이메일 정보 없음'} | 
                  {userRole === 'admin' ? ' 관리자' : 
                   userRole === 'manager' ? ' 매니저' : 
                   userRole === 'team_member' ? ' 팀원' : 
                   authUser?.email ? ' 구글 사용자' : ' 고객'}
                </div>
              </div>
              <LanguageSwitcher />
              <button 
                onClick={handleLogout}
                className="flex items-center text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut size={20} className="mr-2" />
                로그아웃
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
          <h1 className="text-xl font-bold text-gray-900">투어 관리 시스템</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <nav className="mt-8 px-4">
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
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} className="mr-3" />
                {item.name}
              </Link>
            )
          })}
          
          {/* 모바일 로그아웃 버튼 */}
          <button
            onClick={() => {
              handleLogout()
              setSidebarOpen(false)
            }}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-red-600 rounded-lg mb-2 transition-colors"
          >
            <LogOut size={20} className="mr-3" />
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

      {/* 메인 콘텐츠 - 헤더 높이만큼 상단 여백 추가 */}
      <div className="pt-16 lg:pl-64">
        {/* 페이지 콘텐츠 */}
        <main className="py-6">
          <div className="max-w-full mx-auto px-1 sm:px-2 lg:px-3">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
