'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Share2, QrCode, MessageCircle, Users, Calendar, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ChatRoomShareModalProps {
  isOpen: boolean
  onClose: () => void
  roomCode: string
  roomName: string
  tourDate?: string
  isPublicView?: boolean
  language?: 'en' | 'ko'
  roomId?: string
  customerEmail?: string
}

export default function ChatRoomShareModal({ 
  isOpen, 
  onClose, 
  roomCode, 
  roomName,
  tourDate,
  isPublicView = false,
  language = 'ko',
  roomId,
  customerEmail
}: ChatRoomShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [roomIdFromCode, setRoomIdFromCode] = useState<string | undefined>(roomId)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallButton, setShowInstallButton] = useState(false)

  // roomCode로 roomId 찾기
  useEffect(() => {
    if (!roomId && roomCode && isPublicView) {
      const findRoomId = async () => {
        const { data } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('room_code', roomCode)
          .single()
        
        if (data) {
          setRoomIdFromCode(data.id)
        }
      }
      findRoomId()
    }
  }, [roomCode, roomId, isPublicView])

  // PWA 설치 프롬프트 감지
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // 기본 설치 프롬프트 방지
      e.preventDefault()
      // 설치 프롬프트 저장
      setDeferredPrompt(e)
      setShowInstallButton(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // 이미 설치되었는지 확인
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  // 홈 화면에 추가 버튼 클릭 핸들러
  const handleAddToHomeScreen = async () => {
    if (!deferredPrompt) {
      // iOS Safari의 경우 수동 안내
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      const isChrome = /Chrome/.test(navigator.userAgent)
      
      if (isIOS && isSafari) {
        alert(language === 'ko' 
          ? 'Safari에서 공유 버튼(⬆️)을 누르고 "홈 화면에 추가"를 선택하세요.'
          : 'Tap the Share button (⬆️) in Safari and select "Add to Home Screen".')
      } else if (isAndroid && isChrome) {
        alert(language === 'ko' 
          ? 'Chrome 메뉴(⋮)를 열고 "홈 화면에 추가" 또는 "앱 설치"를 선택하세요.'
          : 'Open Chrome menu (⋮) and select "Add to Home Screen" or "Install App".')
      } else {
        const instructions = language === 'ko' 
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
        if (typeof window !== 'undefined' && roomCode) {
          localStorage.setItem('pwa_install_url', `/chat/${roomCode}`)
        }
        alert(language === 'ko' 
          ? '홈 화면에 추가되었습니다!'
          : 'Added to home screen!')
      } else {
        console.log('User dismissed the install prompt')
      }
      
      // 프롬프트는 한 번만 사용 가능
      setDeferredPrompt(null)
    } catch (error) {
      console.error('Error showing install prompt:', error)
      alert(language === 'ko' 
        ? '설치 프롬프트를 표시할 수 없습니다. 브라우저 메뉴에서 직접 설치해주세요.'
        : 'Cannot show install prompt. Please install from your browser menu.')
    }
  }

  if (!isOpen) return null

  const chatUrl = `https://www.kovegas.com/chat/${roomCode}`
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(chatUrl)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(chatUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const shareLink = async () => {
    if (navigator.share) {
      try {
        const isEn = language === 'en'
        await navigator.share({
          title: isEn ? 'Tour Chat' : '투어 채팅방',
          text: isPublicView && isEn ? `Join the tour chat: ${roomName}` : `${roomName}`,
          url: chatUrl
        })
      } catch (error) {
        console.error('Failed to share:', error)
      }
    } else {
      copyLink()
    }
  }

  const shareText = (() => {
    const isEn = language === 'en'
    if (isEn) {
      return `Join the tour chat\n\nChat room: ${roomName}\n${tourDate ? `Tour date: ${new Date(tourDate).toLocaleDateString('en-US')}\n` : ''}${chatUrl}`
    }
    return `🗺️ 투어 채팅방에 참여하세요!\n\n📅 투어 날짜: ${tourDate ? new Date(tourDate).toLocaleDateString('ko-KR') : '확인 필요'}\n💬 채팅방: ${roomName}\n\n아래 링크를 클릭하여 가이드와 실시간으로 소통하세요:\n${chatUrl}`
  })()
  
  const texts = {
    ko: {
      title: '채팅',
      chatRoomLink: '채팅방 링크',
      copy: '복사',
      copied: '복사됨!',
      shareMethods: '공유 방법',
      share: '공유하기',
      copyShareText: '공유 텍스트 복사',
      qrScan: 'QR 코드를 스캔하여 채팅방에 접속하세요',
      customerGuide: '고객 안내사항',
      guideItems: [
        '링크를 클릭하면 채팅방에 접속할 수 있습니다',
        '픽업 시간, 장소 등에 대해 실시간으로 문의하세요',
        '투어 중 특별한 요청사항이 있으면 언제든지 말씀해주세요',
        '가이드가 답변을 드릴 때까지 잠시 기다려주세요'
      ],
      pushNotification: '푸시 알림 받기',
      pushNotificationDesc: '새 메시지가 도착하면 알림을 받을 수 있습니다',
      pushNotificationEnabled: '푸시 알림 활성화됨',
      pushNotificationDisabled: '푸시 알림 비활성화',
      close: '닫기'
    },
    en: {
      title: 'Chat',
      chatRoomLink: 'Chat Room Link',
      copy: 'Copy',
      copied: 'Copied!',
      shareMethods: 'Share Methods',
      share: 'Share',
      copyShareText: 'Copy Share Text',
      qrScan: 'Scan the QR code to access the chat room',
      customerGuide: 'Customer Guide',
      guideItems: [
        'Click the link to access the chat room',
        'Ask questions about pickup times, locations, etc. in real-time',
        'Feel free to share any special requests during the tour',
        'Please wait a moment for your guide to respond'
      ],
      pushNotification: 'Enable Push Notifications',
      pushNotificationDesc: 'Receive notifications when new messages arrive',
      pushNotificationEnabled: 'Push notifications enabled',
      pushNotificationDisabled: 'Push notifications disabled',
      close: 'Close'
    }
  }
  
  const t = texts[language]

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <MessageCircle size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">{t.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-6">
          {/* 채팅방 정보 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <MessageCircle size={16} className="text-blue-600" />
              <span className="font-medium text-blue-900">{roomName}</span>
            </div>
            {tourDate && (
              <div className="flex items-center space-x-2 text-sm text-blue-700">
                <Calendar size={14} />
                <span>{new Date(tourDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* 링크 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.chatRoomLink}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button
                onClick={copyLink}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {copied ? t.copied : t.copy}
              </button>
            </div>
          </div>

          {/* 공유 방법 */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">{t.shareMethods}</h3>
            
            {/* 직접 공유 */}
            <div className="flex space-x-2">
              <button
                onClick={shareLink}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Share2 size={16} />
                <span>{t.share}</span>
              </button>
              <button
                onClick={() => setShowQR(!showQR)}
                className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <QrCode size={16} />
              </button>
            </div>

            {/* 홈 화면에 추가 버튼 */}
            {showInstallButton && (
              <button
                onClick={handleAddToHomeScreen}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download size={16} />
                <span>{language === 'ko' ? '홈 화면에 추가' : 'Add to Home Screen'}</span>
              </button>
            )}

            {/* QR 코드 */}
            {showQR && (
              <div className="text-center">
                <div className="bg-white p-4 rounded-lg border inline-block">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {t.qrScan}
                </p>
              </div>
            )}

            {/* 텍스트 공유 */}
            <div>
              <button
                onClick={copyShareText}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Copy size={16} />
                <span>{t.copyShareText}</span>
              </button>
            </div>
          </div>

          {/* 사용 안내 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">{t.customerGuide}</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {t.guideItems.map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}
