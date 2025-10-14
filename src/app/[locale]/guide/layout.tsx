'use client'

declare global {
  interface Window {
    openGuideDocumentUpload?: (type: 'medical' | 'cpr') => void
  }
}

import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext'
import GlobalAudioPlayer from '@/components/GlobalAudioPlayer'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Calendar, CalendarOff, MessageSquare, Camera, FileText, MessageCircle, BookOpen, Receipt, Home, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'
import TourPhotoUploadModal from '@/components/TourPhotoUploadModal'
import TourReportModal from '@/components/TourReportModal'
import TourReceiptModal from '@/components/TourReceiptModal'
import MedicalReportWarningModal from '@/components/MedicalReportWarningModal'
import GuideDocumentUploadModal from '@/components/GuideDocumentUploadModal'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { supabase } from '@/lib/supabase'
import { createClientSupabase } from '@/lib/supabase'

interface GuideLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default function GuideLayout({ children, params }: GuideLayoutProps) {
  const { user, userRole, isLoading, simulatedUser, isSimulating } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('guide')
  const paramsObj = useParams()
  const locale = paramsObj.locale as string
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [showMedicalReportWarning, setShowMedicalReportWarning] = useState(false)
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false)
  const [documentUploadType, setDocumentUploadType] = useState<'medical' | 'cpr'>('medical')
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  const [uncompletedReportCount, setUncompletedReportCount] = useState(0)

  // 문서 업로드 모달 열기 함수
  const openDocumentUploadModal = (type: 'medical' | 'cpr') => {
    setDocumentUploadType(type)
    setShowDocumentUploadModal(true)
  }

  // 전역 함수로 등록 (다른 컴포넌트에서 사용할 수 있도록)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.openGuideDocumentUpload = openDocumentUploadModal
    }
  }, [])

  useEffect(() => {
    console.log('GuideLayout: Auth state changed', { 
      user: !!user, 
      userRole, 
      isLoading,
      isSimulating,
      simulatedUser: !!simulatedUser
    })
    
    // 시뮬레이션 상태가 복원되는 동안 충분히 기다림
    if (isLoading) {
      console.log('GuideLayout: Still loading, waiting...')
      return
    }
    
    // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
    const currentUser = isSimulating && simulatedUser ? simulatedUser : user
    const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole
    
    console.log('GuideLayout: Current user info', { 
      currentUser: !!currentUser, 
      currentUserRole,
      isSimulating,
      simulatedUser: !!simulatedUser,
      isLoading
    })
    
    // 시뮬레이션 상태가 복원 중이면 잠시 더 기다림
    if (isSimulating && !simulatedUser) {
      console.log('GuideLayout: Simulation in progress but no simulatedUser yet, waiting...')
      return
    }
    
    // 관리자, 매니저, 투어 가이드가 아닌 경우 접근 차단
    if (!currentUser || !['admin', 'manager', 'team_member'].includes(currentUserRole || '')) {
      console.log('GuideLayout: Access denied, redirecting to auth', {
        currentUser: !!currentUser,
        currentUserRole,
        isSimulating,
        isLoading,
        simulatedUser: !!simulatedUser
      })
      // 현재 경로에서 locale 추출
      const currentLocale = pathname.split('/')[1] || 'ko'
      router.push(`/${currentLocale}/auth`)
      return
    }
    
    console.log('GuideLayout: Access granted - staying on guide page')
    
    // 안읽은 메시지 카운트 로드
    loadUnreadMessageCount()
    
    // 미작성 리포트 카운트 로드
    loadUncompletedReportCount()
    
     // 메디컬 리포트 상태 확인 (비활성화)
     // checkMedicalReportStatus()
  }, [user, userRole, isLoading, router, isSimulating, simulatedUser])

  // 안읽은 메시지 카운트 로드
  const loadUnreadMessageCount = async () => {
    try {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
      const currentUser = isSimulating && simulatedUser ? simulatedUser : user
      const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

      if (!currentUserEmail) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // 팀 채팅방 목록 가져오기
      const response = await fetch('/api/team-chat/rooms', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      const result = await response.json()
      if (result.error) {
        console.error('팀 채팅방 조회 오류:', result.error)
        return
      }

      const rooms = result.rooms || []
      
      // 각 채팅방의 안읽은 메시지 카운트 계산
      let totalUnreadCount = 0
      
      for (const room of rooms) {
        try {
          const messagesResponse = await fetch(`/api/team-chat/messages?room_id=${room.id}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          })
          
          const messagesResult = await messagesResponse.json()
          if (messagesResult.messages) {
            // 현재 사용자가 보낸 메시지가 아닌 메시지 중에서
            // 실제로 읽지 않은 메시지만 카운트 (간단히 최근 메시지 1개만 확인)
            const otherMessages = messagesResult.messages.filter((msg: any) => 
              msg.sender_email !== currentUserEmail
            )
            
            // 마지막 메시지가 다른 사용자가 보낸 것이고, 현재 사용자가 마지막으로 읽은 시간보다 늦은 경우
            if (otherMessages.length > 0) {
              const lastOtherMessage = otherMessages[otherMessages.length - 1]
              // 간단히 마지막 메시지가 5분 이내인 경우만 안읽은 것으로 처리
              const messageTime = new Date(lastOtherMessage.created_at)
              const now = new Date()
              const timeDiff = now.getTime() - messageTime.getTime()
              const fiveMinutes = 5 * 60 * 1000
              
              if (timeDiff < fiveMinutes) {
                totalUnreadCount += 1
              }
            }
          }
        } catch (error) {
          console.error(`채팅방 ${room.id} 메시지 조회 오류:`, error)
        }
      }
      
      setUnreadMessageCount(totalUnreadCount)
    } catch (error) {
      console.error('안읽은 메시지 카운트 로드 오류:', error)
    }
  }

  // 미작성 리포트 카운트 로드
  const loadUncompletedReportCount = async () => {
    try {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
      const currentUser = isSimulating && simulatedUser ? simulatedUser : user
      const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

      console.log('미작성 리포트 카운트 로드 시작:', user?.email)
      console.log('시뮬레이션 상태:', isSimulating)
      console.log('시뮬레이션된 사용자:', simulatedUser?.email)
      console.log('실제 사용할 이메일:', currentUserEmail)
      
      if (!currentUserEmail) {
        console.log('사용자 이메일이 없음')
        return
      }

      const supabaseClient = createClientSupabase()
      
      // 최근 30일간의 투어 데이터 가져오기
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]
      const todayStr = today.toISOString().split('T')[0]

      console.log('현재 날짜:', today.toISOString())
      console.log('30일 전 날짜:', thirtyDaysAgo.toISOString())
      console.log('투어 조회 기간:', thirtyDaysAgoStr, '~', todayStr)

      const { data: toursData, error } = await supabaseClient
        .from('tours')
        .select('id, tour_date, tour_guide_id, assistant_id')
        .or(`tour_guide_id.eq.${currentUserEmail},assistant_id.eq.${currentUserEmail}`)
        .gte('tour_date', thirtyDaysAgoStr)
        .order('tour_date', { ascending: false })
        .limit(50)

      if (error) {
        console.error('투어 데이터 로드 오류:', error)
        return
      }

      console.log('조회된 투어 수:', toursData?.length || 0)
      console.log('투어 목록:', toursData)

      // 투어 리포트 모달과 동일한 필터링 적용
      const filteredTours = (toursData || []).filter(tour => {
        const today = new Date().toISOString().split('T')[0]
        return tour.tour_date <= today
      })

      console.log('필터링된 투어 수:', filteredTours.length)
      console.log('필터링된 투어 목록:', filteredTours)

      const tourIds = filteredTours.map(tour => tour.id)
      
      if (tourIds.length === 0) {
        console.log('투어가 없음, 카운트 0으로 설정')
        setUncompletedReportCount(0)
        return
      }

      // 작성된 리포트 확인
      const { data: reportsData, error: reportsError } = await supabaseClient
        .from('tour_reports')
        .select('tour_id')
        .in('tour_id', tourIds)
        .eq('user_email', user.email)

      if (reportsError) {
        console.error('리포트 데이터 로드 오류:', reportsError)
        return
      }

      console.log('작성된 리포트 수:', reportsData?.length || 0)
      console.log('작성된 리포트 목록:', reportsData)

      const completedTourIds = new Set((reportsData || []).map(report => report.tour_id))
      const uncompletedCount = tourIds.filter(tourId => !completedTourIds.has(tourId)).length
      
      console.log('미작성 리포트 수:', uncompletedCount)
      setUncompletedReportCount(uncompletedCount)
    } catch (error) {
      console.error('미작성 리포트 카운트 로드 오류:', error)
    }
  }

  // 메디컬 리포트 상태 확인
  const checkMedicalReportStatus = async () => {
    try {
      // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
      const currentUserEmail = isSimulating && simulatedUser ? simulatedUser.email : user?.email

      if (!currentUserEmail) {
        console.log('사용자 이메일이 없음')
        return
      }

      const supabaseClient = createClientSupabase()
      
      // 먼저 메디컬 리포트 카테고리 ID를 가져옴
      const { data: categoryData, error: categoryError } = await supabaseClient
        .from('document_categories')
        .select('id')
        .eq('name_ko', '메디컬 리포트')
        .single()

      if (categoryError || !categoryData) {
        console.error('메디컬 리포트 카테고리를 찾을 수 없습니다:', categoryError)
        return
      }

      // 최신 메디컬 리포트 확인
      const { data: medicalReports, error } = await supabaseClient
        .from('documents')
        .select('*')
        .eq('guide_email', currentUserEmail)
        .eq('category_id', categoryData.id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('메디컬 리포트 상태 확인 오류:', error)
        return
      }

      const latestReport = medicalReports?.[0]
      
      // 메디컬 리포트가 없거나 만료된 경우 경고 표시
      if (!latestReport) {
        console.log('메디컬 리포트가 없음 - 경고 표시')
        setShowMedicalReportWarning(true)
        return
      }

      // 만료일 확인
      if (latestReport.expiry_date) {
        const now = new Date()
        const expiryDate = new Date(latestReport.expiry_date)
        const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        
        const isExpired = expiryDate < now
        const expiresInOneMonth = expiryDate <= oneMonthFromNow && expiryDate > now
        
        if (isExpired || expiresInOneMonth) {
          console.log('메디컬 리포트 만료 또는 만료 예정 - 경고 표시', { isExpired, expiresInOneMonth })
          setShowMedicalReportWarning(true)
        }
      }
    } catch (error) {
      console.error('메디컬 리포트 상태 확인 오류:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // 시뮬레이션 중일 때는 시뮬레이션된 사용자 정보 사용
  const currentUser = isSimulating && simulatedUser ? simulatedUser : user
  const currentUserRole = isSimulating && simulatedUser ? simulatedUser.role : userRole

  if (!currentUser || !['admin', 'manager', 'team_member'].includes(currentUserRole || '')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-4">
            관리자, 매니저, 또는 투어 가이드만 이 페이지에 접근할 수 있습니다.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-4 text-left">
            <p className="text-sm text-gray-700">
              <strong>현재 상태:</strong><br/>
              사용자: {currentUser ? currentUser.email : '로그인되지 않음'}<br/>
              역할: {currentUserRole || '역할 없음'}<br/>
              로딩: {isLoading ? 'Loading' : 'Complete'}<br/>
              시뮬레이션: {isSimulating ? 'Yes' : 'No'}
            </p>
          </div>
          <button 
            onClick={() => {
              const currentLocale = pathname.split('/')[1] || 'ko'
              router.push(`/${currentLocale}/auth`)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    )
  }

   return (
     <AudioPlayerProvider>
       <div className="min-h-screen bg-gray-50">
         {/* 헤더 (비활성화) */}
         {/* <header className="bg-white border-b border-gray-200 px-4 py-3">
           <div className="max-w-7xl mx-auto flex items-center justify-between">
             <div className="flex items-center space-x-4">
               <h1 className="text-xl font-semibold text-gray-900">
                 {t('title')}
               </h1>
             </div>
             <div className="flex items-center space-x-4">
               <LanguageSwitcher />
               <div className="text-sm text-gray-600">
                 {currentUser ? (isSimulating && simulatedUser ? simulatedUser.name_ko : currentUser.email) : '사용자 없음'}
               </div>
             </div>
           </div>
         </header> */}

         {/* 메인 컨텐츠 */}
         <main className="max-w-7xl mx-auto px-0 sm:px-1 lg:px-2 py-2 sm:py-4 pb-20 sm:pb-4">
           {children}
         </main>

        {/* 전역 오디오 플레이어 */}
        <GlobalAudioPlayer />

        {/* 모바일 푸터 네비게이션 */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 sm:hidden z-50">
        <div className="grid grid-cols-5 py-2">
          <button
            onClick={() => {
              const currentLocale = pathname.split('/')[1] || 'ko'
              router.push(`/${currentLocale}/guide`)
            }}
            className={`flex flex-col items-center py-1 px-1 transition-colors ${
              pathname === `/${locale}/guide` || pathname === `/${locale}/guide/`
                ? 'text-purple-600'
                : 'text-gray-600 hover:text-purple-600'
            }`}
          >
            <Home className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('footer.home')}</span>
          </button>
          
          <button
            onClick={() => {
              const currentLocale = pathname.split('/')[1] || 'ko'
              router.push(`/${currentLocale}/guide/tours?view=calendar`)
            }}
            className={`flex flex-col items-center py-1 px-1 transition-colors ${
              pathname.includes('/guide/tours') && pathname.includes('calendar')
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <Calendar className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('footer.tours')}</span>
          </button>
          
          <button
            onClick={() => {
              const currentLocale = pathname.split('/')[1] || 'ko'
              router.push(`/${currentLocale}/guide/chat`)
            }}
            className={`flex flex-col items-center py-1 px-1 transition-colors relative ${
              pathname.includes('/guide/chat')
                ? 'text-green-600'
                : 'text-gray-600 hover:text-green-600'
            }`}
          >
            <MessageSquare className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('footer.chat')}</span>
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
              </span>
            )}
          </button>
          
          <button
            onClick={() => {
              const currentLocale = pathname.split('/')[1] || 'ko'
              router.push(`/${currentLocale}/guide/team-board`)
            }}
            className={`flex flex-col items-center py-1 px-1 transition-colors ${
              pathname.includes('/guide/team-board')
                ? 'text-indigo-600'
                : 'text-gray-600 hover:text-indigo-600'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('footer.manual')}</span>
          </button>

          <button
            onClick={() => {
              const currentLocale = pathname.split('/')[1] || 'ko'
              router.push(`/${currentLocale}/guide/tour-materials`)
            }}
            className={`flex flex-col items-center py-1 px-1 transition-colors ${
              pathname.includes('/guide/tour-materials')
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <FileText className="w-5 h-5 mb-1" />
            <span className="text-xs">{t('footer.tourMaterials')}</span>
          </button>


        </div>
      </footer>

      {/* 사진 업로드 모달 */}
      <TourPhotoUploadModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        locale={locale}
      />

      {/* 리포트 작성 모달 */}
      <TourReportModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false)
          // 리포트 작성 후 카운트 다시 로드
          loadUncompletedReportCount()
        }}
        locale={locale}
      />

      {/* 영수증 첨부 모달 */}
      <TourReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        locale={locale}
      />

      {/* 메디컬 리포트 경고 모달 */}
      <MedicalReportWarningModal
        isOpen={showMedicalReportWarning}
        onClose={() => setShowMedicalReportWarning(false)}
        onUploadClick={() => {
          setShowMedicalReportWarning(false)
          setDocumentUploadType('medical')
          setShowDocumentUploadModal(true)
        }}
      />

      {/* 가이드 문서 업로드 모달 */}
      <GuideDocumentUploadModal
        isOpen={showDocumentUploadModal}
        onClose={() => setShowDocumentUploadModal(false)}
        documentType={documentUploadType}
      />
      </div>
    </AudioPlayerProvider>
  )
}
