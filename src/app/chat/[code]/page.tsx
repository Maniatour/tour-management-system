'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, ChevronDown, Menu, User, Bell, BellOff, Download, BookOpen } from 'lucide-react'
import ReactCountryFlag from 'react-country-flag'
import Link from 'next/link'
import TourChatRoom from '@/components/TourChatRoom'
import AvatarSelector from '@/components/AvatarSelector'
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/lib/translation'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { usePushNotification } from '@/hooks/usePushNotification'
import { formatPublicChatRoomTitle } from '@/lib/formatPublicChatRoomTitle'
import PublicChatTutorialOverlay from '@/components/chat/PublicChatTutorialOverlay'

interface ChatRoom {
  id: string
  tour_id: string
  room_name: string
  room_code: string
  description?: string
  is_active: boolean
  created_by: string
  created_at: string
}

interface TourInfo {
  id: string
  product_id: string
  tour_date: string
  tour_status: string
}

interface ProductNames {
  name?: string | null
  name_ko?: string | null
  name_en?: string | null
}

export default function PublicChatPage() {
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [tempName, setTempName] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en')
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showNameEdit, setShowNameEdit] = useState(false)
  const [productNames, setProductNames] = useState<ProductNames | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true)
  const [selectedAvatar, setSelectedAvatar] = useState<string>('')
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [showPublicTutorial, setShowPublicTutorial] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [, setShowInstallButton] = useState(false)

  const paramsObj = useParams()
  const code = paramsObj.code as string

  // 푸시 알림 훅
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush
  } = usePushNotification(room?.id, undefined, selectedLanguage === 'ko' ? 'ko' : 'en')

  useEffect(() => {
    console.log('PublicChatPage useEffect triggered with code:', code)
    loadRoomInfo()
    loadSavedUserData()
    loadFavicon()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  // Service Worker 등록 및 PWA 설치 프롬프트 감지
  useEffect(() => {
    // Service Worker 등록 (PWA 설치를 위해 필요)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registered:', registration)
          // 업데이트 확인
          registration.update()
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error)
        })
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // 기본 설치 프롬프트 방지
      e.preventDefault()
      // 설치 프롬프트 저장
      setDeferredPrompt(e)
      setShowInstallButton(true)
      console.log('beforeinstallprompt event captured')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 이미 설치되었는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false)
      // standalone 모드에서 현재 URL이 채팅방이면 저장
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat/')) {
        localStorage.setItem('pwa_install_url', window.location.pathname)
      }
    }

    // manifest.json이 로드되었는지 확인
    const checkManifest = () => {
      const link = document.querySelector('link[rel="manifest"]')
      if (!link) {
        // manifest 링크가 없으면 추가
        const manifestLink = document.createElement('link')
        manifestLink.rel = 'manifest'
        manifestLink.href = '/manifest.json'
        document.head.appendChild(manifestLink)
        console.log('Manifest link added')
      }
    }
    checkManifest()

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // 홈 화면에 추가 버튼 클릭 핸들러
  const handleAddToHomeScreen = async () => {
    // Service Worker가 등록되어 있는지 확인하고, 없으면 등록 시도
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration) {
          await navigator.serviceWorker.register('/sw.js', { scope: '/' })
          console.log('Service Worker registered on button click')
          // Service Worker 등록 후 잠시 대기 (beforeinstallprompt 이벤트가 발생할 시간을 줌)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error('Failed to register service worker:', error)
      }
    }

    // manifest 링크 확인 및 추가
    let manifestLink = document.querySelector('link[rel="manifest"]')
    if (!manifestLink) {
      manifestLink = document.createElement('link')
      manifestLink.setAttribute('rel', 'manifest')
      manifestLink.setAttribute('href', '/manifest.json')
      document.head.appendChild(manifestLink)
      console.log('Manifest link added on button click')
      // manifest가 로드될 시간을 주기 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // deferredPrompt가 아직 없으면 다시 확인
    if (!deferredPrompt) {
      // iOS Safari의 경우 수동 안내
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      const isChrome = /Chrome/.test(navigator.userAgent)
      
      if (isIOS && isSafari) {
        alert(selectedLanguage === 'ko' 
          ? 'Safari에서 공유 버튼(⬆️)을 누르고 "홈 화면에 추가"를 선택하세요.'
          : 'Tap the Share button (⬆️) in Safari and select "Add to Home Screen".')
      } else if (isAndroid && isChrome) {
        alert(selectedLanguage === 'ko' 
          ? 'Chrome 메뉴(⋮)를 열고 "홈 화면에 추가" 또는 "앱 설치"를 선택하세요.'
          : 'Open Chrome menu (⋮) and select "Add to Home Screen" or "Install App".')
      } else {
        const instructions = selectedLanguage === 'ko' 
          ? '브라우저 메뉴(⋮ 또는 ⚙️)를 열고 다음 옵션을 찾아주세요:\n\n• "홈 화면에 추가"\n• "앱 설치"\n• "Add to Home Screen"\n• "Install App"\n\n또는 주소창 오른쪽의 설치 아이콘을 클릭하세요.'
          : 'Open your browser menu (⋮ or ⚙️) and look for:\n\n• "Add to Home Screen"\n• "Install App"\n\nOr click the install icon on the right side of the address bar.'
        alert(instructions)
      }
      return
    }

    try {
      // 설치 프롬프트 표시
      deferredPrompt.prompt()
      
      // 사용자 선택 대기
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt')
        setShowInstallButton(false)
        // 설치 시점의 현재 URL 저장 (채팅방 URL)
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat/')) {
          localStorage.setItem('pwa_install_url', window.location.pathname)
        }
        alert(selectedLanguage === 'ko' 
          ? '홈 화면에 추가되었습니다!'
          : 'Added to home screen!')
      } else {
        console.log('User dismissed the install prompt')
      }
      
      // 프롬프트는 한 번만 사용 가능
      setDeferredPrompt(null)
    } catch (error) {
      console.error('Error showing install prompt:', error)
      alert(selectedLanguage === 'ko' 
        ? '설치 프롬프트를 표시할 수 없습니다. 브라우저 메뉴에서 직접 설치해주세요.'
        : 'Cannot show install prompt. Please install from your browser menu.')
    }
  }

  // 홈페이지와 동일: 홈페이지 채널(M00001 등) 파비콘 우선, self(카카오 등)는 그 다음 ([locale]/layout generateMetadata 와 동일 순서)
  const loadFavicon = async () => {
    const fallback = '/favicon.png'
    try {
      if (!supabase) {
        setFaviconUrl(fallback)
        return
      }
      let url: string | undefined

      const { data: homepageChannel } = await supabase
        .from('channels')
        .select('favicon_url')
        .or('id.eq.M00001,name.ilike.%homepage%,name.ilike.%홈페이지%')
        .not('favicon_url', 'is', null)
        .limit(1)
        .maybeSingle()

      url = (homepageChannel as { favicon_url?: string } | null)?.favicon_url

      if (!url) {
        const { data: selfChannel } = await supabase
          .from('channels')
          .select('favicon_url')
          .eq('type', 'self')
          .not('favicon_url', 'is', null)
          .limit(1)
          .maybeSingle()
        url = (selfChannel as { favicon_url?: string } | null)?.favicon_url
      }

      if (!url) {
        const { data: anyChannel } = await supabase
          .from('channels')
          .select('favicon_url')
          .not('favicon_url', 'is', null)
          .limit(1)
          .maybeSingle()
        url = (anyChannel as { favicon_url?: string } | null)?.favicon_url
      }

      setFaviconUrl(url || fallback)
    } catch (error) {
      console.error('Error loading favicon:', error)
      setFaviconUrl(fallback)
    }
  }

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLanguageDropdown) {
        const target = event.target as HTMLElement
        if (!target.closest('.language-dropdown')) {
          setShowLanguageDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLanguageDropdown])

  // 저장된 사용자 데이터 불러오기
  const loadSavedUserData = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedName = localStorage.getItem('tour_chat_customer_name')
        const savedLanguage = localStorage.getItem('tour_chat_language') as 'ko' | 'en' | null
        const savedAvatar = localStorage.getItem(`chat_avatar_${code || 'default'}`)
        
        if (savedName) {
          setCustomerName(savedName)
          // 저장된 이름이 있으면 임시 이름도 설정
          setTempName(savedName)
        }
        if (savedLanguage && ['ko', 'en'].includes(savedLanguage)) {
          setSelectedLanguage(savedLanguage)
        }
        if (savedAvatar) {
          setSelectedAvatar(savedAvatar)
        } else {
          // 기본 아바타 설정
          const defaultAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=happy'
          setSelectedAvatar(defaultAvatar)
          localStorage.setItem(`chat_avatar_${code || 'default'}`, defaultAvatar)
        }
      }
    } catch (error) {
      console.error('Error loading saved user data:', error)
    }
  }

  const loadRoomInfo = async () => {
    try {
      console.log('loadRoomInfo called with code:', code)
      setLoading(true)
      setError(null)
      
      // Supabase 인스턴스 확인
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }
      console.log('Supabase instance:', supabase)

      // 채팅방 정보 조회
      const { data: roomData, error: roomError } = await supabase
        .from('chat_rooms')
        .select(`
          *,
          tours!inner(
            id,
            product_id,
            tour_date,
            tour_status
          )
        `)
        .eq('room_code', code)
        .eq('is_active', true)
        .single()

      if (roomError) throw roomError

      if (!roomData) {
        setError('Chat room not found. The link may have expired or is invalid.')
        return
      }

      // 안전한 타입 변환
      const roomResult = roomData as ChatRoom & { tours: TourInfo }
      setRoom(roomResult)
      
      if (roomResult?.tours) {
        setTourInfo(roomResult.tours as TourInfo)
      } else {
        console.error('No tours data found in room:', roomData)
        setError('Tour information not found.')
        return
      }

      // 상품 명칭 로드 (영/한)
      if (roomResult?.tours?.product_id) {
        try {
          const { data: productData } = await supabase
            .from('products')
            .select('name, name_ko, name_en')
            .eq('id', roomResult.tours.product_id)
            .single()
          
          if (productData) {
            setProductNames({
              name: (productData as { name?: string | null }).name ?? null,
              name_ko: (productData as { name_ko?: string | null }).name_ko ?? null,
              name_en: (productData as { name_en?: string | null }).name_en ?? null,
            })
          }
        } catch (productError) {
          console.error('Error loading product data:', productError)
          // 상품 정보 로딩 실패는 치명적이지 않으므로 계속 진행
        }
      }
    } catch (error) {
      console.error('Error loading room info:', error)
      console.error('Error details:', {
        code,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      setError(`An error occurred while loading the chat room: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinChat = () => {
    const trimmedName = tempName.trim()
    
    if (!trimmedName) {
      alert('Please enter your name.')
      return
    }
    
    if (trimmedName.length < 2) {
      alert('Please enter a name with at least 2 characters.')
      return
    }
    
    // 임시 이름을 실제 이름으로 설정
    setCustomerName(trimmedName)
    
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('tour_chat_customer_name', trimmedName)
      localStorage.setItem('tour_chat_language', selectedLanguage)
      if (selectedAvatar) {
        localStorage.setItem(`chat_avatar_${code || 'default'}`, selectedAvatar)
      }
    }
    
    console.log('Customer joined chat:', trimmedName)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleJoinChat()
    }
  }

  // 이름 변경 함수
  const handleNameChange = () => {
    const trimmedName = tempName.trim()
    
    if (!trimmedName) {
      alert(selectedLanguage === 'ko' ? '이름을 입력해주세요.' : 'Please enter your name.')
      return
    }
    
    if (trimmedName.length < 2) {
      alert(selectedLanguage === 'ko' ? '이름은 최소 2자 이상이어야 합니다.' : 'Please enter a name with at least 2 characters.')
      return
    }
    
    // 이름 업데이트
    setCustomerName(trimmedName)
    
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('tour_chat_customer_name', trimmedName)
      // 아바타도 함께 저장
      if (selectedAvatar) {
        localStorage.setItem(`chat_avatar_${code || 'default'}`, selectedAvatar)
      }
    }
    
    setShowNameEdit(false)
    console.log('Customer name updated:', trimmedName)
  }

  const publicChatRoomTitle = useMemo(() => {
    if (!room) return ''
    return formatPublicChatRoomTitle(
      selectedLanguage === 'ko' ? 'ko' : 'en',
      productNames,
      room.room_name
    )
  }, [room, selectedLanguage, productNames])

  useEffect(() => {
    if (!customerName || !code) return
    try {
      if (typeof window === 'undefined') return
      const key = `tms_public_chat_tutorial_v1_${code}`
      if (!localStorage.getItem(key)) {
        setShowPublicTutorial(true)
      }
    } catch {
      /* storage unavailable */
    }
  }, [customerName, code])

  const markPublicTutorialSeen = () => {
    try {
      if (code && typeof window !== 'undefined') {
        localStorage.setItem(`tms_public_chat_tutorial_v1_${code}`, '1')
      }
    } catch {
      /* ignore */
    }
    setShowPublicTutorial(false)
  }

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            {/* icon removed */}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Chat Room Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  if (!room || !tourInfo) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Unable to load chat room information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          {/* 첫 번째 줄: 제목과 컨트롤 버튼 */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Favicon */}
              <img
                src={faviconUrl || '/favicon.png'}
                alt=""
                className="w-6 h-6 sm:w-7 sm:h-7 rounded flex-shrink-0 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (target.dataset.fallbackTried !== '1') {
                    target.dataset.fallbackTried = '1'
                    target.src = '/favicon.png'
                  } else {
                    target.style.visibility = 'hidden'
                  }
                }}
              />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex-1 min-w-0 tracking-tight">
                MANIATOUR
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {/* 홈 화면에 추가 버튼 (항상 표시, 클릭 시 안내 또는 설치 프롬프트) */}
              <button
                onClick={handleAddToHomeScreen}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                title={selectedLanguage === 'ko' ? '홈 화면에 추가' : 'Add to Home Screen'}
              >
                <Download size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowPublicTutorial(true)}
                className="flex items-center gap-1 p-1.5 sm:pl-2 sm:pr-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                title={selectedLanguage === 'ko' ? '메뉴얼 보기' : 'View guide'}
                aria-label={selectedLanguage === 'ko' ? '메뉴얼 보기' : 'View guide'}
              >
                <BookOpen size={16} className="flex-shrink-0" />
                <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">
                  {selectedLanguage === 'ko' ? '메뉴얼' : 'Guide'}
                </span>
              </button>
              {/* 푸시 알림 토글 버튼 (국기 아이콘 왼쪽) */}
              {isPushSupported && room && (
                <button
                  onClick={async () => {
                    if (isPushSubscribed) {
                      await unsubscribeFromPush()
                    } else {
                      const success = await subscribeToPush()
                      if (success) {
                        alert(selectedLanguage === 'ko' 
                          ? '푸시 알림이 활성화되었습니다.' 
                          : 'Push notifications enabled.')
                      }
                    }
                  }}
                  disabled={isPushLoading}
                  className={`p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors ${
                    isPushSubscribed ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50' : ''
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={selectedLanguage === 'ko' 
                    ? (isPushSubscribed ? '푸시 알림 비활성화' : '푸시 알림 활성화')
                    : (isPushSubscribed ? 'Disable Push Notifications' : 'Enable Push Notifications')}
                >
                  {isPushSubscribed ? (
                    <Bell size={16} />
                  ) : (
                    <BellOff size={16} />
                  )}
                </button>
              )}
              {/* 언어 전환 버튼 */}
              <button
                onClick={() => {
                  const newLanguage = selectedLanguage === 'ko' ? 'en' : 'ko'
                  setSelectedLanguage(newLanguage)
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('tour_chat_language', newLanguage)
                  }
                }}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                title={selectedLanguage === 'ko' ? 'Switch to English' : '한국어로 전환'}
              >
                {(() => {
                  const flagCountry = selectedLanguage === 'ko' ? 'KR' : 'US'
                  return (
                    <ReactCountryFlag
                      countryCode={flagCountry}
                      svg
                      style={{
                        width: '16px',
                        height: '12px',
                        borderRadius: '2px'
                      }}
                    />
                  )
                })()}
              </button>
              {/* 모바일 메뉴 토글 버튼 */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors lg:hidden"
                title={selectedLanguage === 'ko' ? '메뉴' : 'Menu'}
              >
                <Menu size={16} />
              </button>
            </div>
          </div>
          
          {/* 두 번째 줄: 날짜와 손님 이름 */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center">
              {tourInfo && (() => {
                // YYYY-MM-DD 형식을 안전하게 파싱
                try {
                  const [year, month, day] = tourInfo.tour_date.split('-').map(Number)
                  const date = new Date(year, month - 1, day)
                  return date.toLocaleDateString(selectedLanguage === 'ko' ? 'ko-KR' : 'en-US')
                } catch {
                  return tourInfo.tour_date
                }
              })()}
            </div>
            {customerName && (
              <div className="flex items-center space-x-2 ml-2">
                <span className="text-gray-700">Hi! {customerName}</span>
                <button
                  onClick={() => {
                    setTempName(customerName)
                    setShowNameEdit(true)
                  }}
                  className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden border-2 border-gray-300 hover:border-blue-500 transition-colors"
                  aria-label={selectedLanguage === 'ko' ? '이름 및 아바타 변경' : 'Change Name and Avatar'}
                  title={selectedLanguage === 'ko' ? '이름 및 아바타 변경' : 'Change Name and Avatar'}
                >
                  {selectedAvatar ? (
                    <img
                      src={selectedAvatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <User size={12} className="text-gray-400" />
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="flex-1 overflow-hidden">
        {/* 고객 이름 입력 (첫 방문 시) */}
        {!customerName && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Join Chat Room</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please enter your name
                </label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., John Smith"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Language
                </label>
                <div className="relative language-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                  >
                    <span className="flex items-center">
                      <span className="mr-2">
                        {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.flag}
                      </span>
                      {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name}
                    </span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </button>
                  
                  {showLanguageDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {SUPPORTED_LANGUAGES.map((language) => (
                        <button
                          key={language.code}
                          type="button"
                          onClick={() => {
                            setSelectedLanguage(language.code)
                            setShowLanguageDropdown(false)
                            // 언어 변경 시 즉시 저장
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('tour_chat_language', language.code)
                            }
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2 ${
                            selectedLanguage === language.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-base">{language.flag}</span>
                          <span className="text-sm truncate">{language.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avatar
                </label>
                <button
                  type="button"
                  onClick={() => setShowAvatarSelector(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="flex items-center">
                    {selectedAvatar ? (
                      <>
                        <img
                          src={selectedAvatar}
                          alt="Selected Avatar"
                          className="w-8 h-8 rounded-full mr-2 border-2 border-gray-200"
                        />
                        <span className="text-sm text-gray-700">
                          {selectedLanguage === 'ko' ? '아바타 선택됨' : 'Avatar Selected'}
                        </span>
                      </>
                    ) : (
                      <>
                        <User size={20} className="mr-2 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {selectedLanguage === 'ko' ? '아바타 선택' : 'Select Avatar'}
                        </span>
                      </>
                    )}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
              </div>
              {/* 푸시 알림 구독 (고객용) */}
              {isPushSupported && room && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedLanguage === 'ko' ? '푸시 알림 받기' : 'Push Notifications'}
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isPushSubscribed) {
                        await unsubscribeFromPush()
                      } else {
                        const success = await subscribeToPush()
                        if (success) {
                          alert(selectedLanguage === 'ko' 
                            ? '푸시 알림이 활성화되었습니다. 새 메시지가 도착하면 알림을 받을 수 있습니다.' 
                            : 'Push notifications enabled. You will receive notifications when new messages arrive.')
                        }
                      }
                    }}
                    disabled={isPushLoading}
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 ${
                      isPushSubscribed
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isPushLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>{selectedLanguage === 'ko' ? '처리 중...' : 'Loading...'}</span>
                      </>
                    ) : isPushSubscribed ? (
                      <>
                        <BellOff size={16} />
                        <span>{selectedLanguage === 'ko' ? '푸시 알림 비활성화' : 'Disable Push Notifications'}</span>
                      </>
                    ) : (
                      <>
                        <Bell size={16} />
                        <span>{selectedLanguage === 'ko' ? '푸시 알림 활성화' : 'Enable Push Notifications'}</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedLanguage === 'ko' 
                      ? '새 메시지가 도착하면 알림을 받을 수 있습니다' 
                      : 'Receive notifications when new messages arrive'}
                  </p>
                </div>
              )}
              <button
                onClick={handleJoinChat}
                disabled={!tempName.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Join Chat Room
              </button>
            </div>
          </div>
        )}

        {/* 채팅방 */}
        {customerName && room && tourInfo && room.tour_id && room.created_by && room.room_code && tourInfo.tour_date && (
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <TourChatRoom
                tourId={room.tour_id}
                guideEmail={room.created_by}
                isPublicView={true}
                roomCode={room.room_code}
                tourDate={tourInfo.tour_date}
                customerName={customerName}
                customerLanguage={selectedLanguage}
                publicDisplayRoomName={publicChatRoomTitle}
                externalMobileMenuOpen={isMobileMenuOpen}
                onExternalMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              />
            </div>
          </div>
        )}

        {/* 사용 안내 - 채팅방이 없을 때만 표시 */}
        {!customerName && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Usage Guide</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Feel free to ask about pickup times, locations, or any other questions.</li>
              <li>• You can communicate in real-time with your guide about special requests or questions during the tour.</li>
              <li>• Please wait a moment for your guide to respond.</li>
              <li>• The chat room will remain available for a certain period after the tour ends.</li>
            </ul>
          </div>
        )}

        {/* 이름 및 아바타 변경 모달 */}
        {showNameEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedLanguage === 'ko' ? '이름 및 아바타 변경' : 'Change Name and Avatar'}
              </h3>
              <div className="space-y-4">
                {/* 아바타 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedLanguage === 'ko' ? '아바타' : 'Avatar'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAvatarSelector(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="flex items-center">
                      {selectedAvatar ? (
                        <>
                          <img
                            src={selectedAvatar}
                            alt="Selected Avatar"
                            className="w-8 h-8 rounded-full mr-2 border-2 border-gray-200"
                          />
                          <span className="text-sm text-gray-700">
                            {selectedLanguage === 'ko' ? '아바타 선택됨' : 'Avatar Selected'}
                          </span>
                        </>
                      ) : (
                        <>
                          <User size={20} className="mr-2 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {selectedLanguage === 'ko' ? '아바타 선택' : 'Select Avatar'}
                          </span>
                        </>
                      )}
                    </span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </button>
                </div>
                {/* 이름 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedLanguage === 'ko' ? '이름' : 'Name'}
                  </label>
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleNameChange()
                      }
                    }}
                    placeholder={selectedLanguage === 'ko' ? '예: 홍길동' : 'e.g., John Smith'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleNameChange}
                    disabled={!tempName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedLanguage === 'ko' ? '업데이트' : 'Update'}
                  </button>
                  <button
                    onClick={() => {
                      setShowNameEdit(false)
                      setTempName(customerName) // 원래 이름으로 되돌리기
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    {selectedLanguage === 'ko' ? '취소' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 아바타 선택 모달 (이름 변경 모달에서 열림) */}
        <AvatarSelector
          isOpen={showAvatarSelector}
          onClose={() => setShowAvatarSelector(false)}
          onSelect={(avatarUrl) => {
            setSelectedAvatar(avatarUrl)
            if (typeof window !== 'undefined') {
              localStorage.setItem(`chat_avatar_${code || 'default'}`, avatarUrl)
            }
            setShowAvatarSelector(false)
          }}
          currentAvatar={selectedAvatar}
          usedAvatars={new Set()} // 초기 입장 시에는 사용 중인 아바타 정보가 없으므로 빈 Set
          language={selectedLanguage as 'ko' | 'en'}
        />

        <PublicChatTutorialOverlay
          open={showPublicTutorial}
          language={selectedLanguage}
          onClose={() => setShowPublicTutorial(false)}
          onComplete={markPublicTutorialSeen}
        />
      </div>
    </div>
  )
}