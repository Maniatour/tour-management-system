'use client'

import React, { useState, useEffect, use } from 'react'
import { ArrowLeft, Home as HomeIcon, ChevronDown, SquarePen } from 'lucide-react'
import Link from 'next/link'
import TourChatRoom from '@/components/TourChatRoom'
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '@/lib/translation'
import { supabase } from '@/lib/supabase'

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

export default function PublicChatPage({ params }: { params: Promise<{ code: string }> }) {
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

  const { code } = use(params)

  useEffect(() => {
    console.log('PublicChatPage useEffect triggered with code:', code)
    loadRoomInfo()
    loadSavedUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

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
        
        if (savedName) {
          setCustomerName(savedName)
          // 저장된 이름이 있으면 임시 이름도 설정
          setTempName(savedName)
        }
        if (savedLanguage && ['ko', 'en'].includes(savedLanguage)) {
          setSelectedLanguage(savedLanguage)
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
              name: productData.name ?? null,
              name_ko: productData.name_ko ?? null,
              name_en: productData.name_en ?? null,
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
      alert('Please enter your name.')
      return
    }
    
    if (trimmedName.length < 2) {
      alert('Please enter a name with at least 2 characters.')
      return
    }
    
    // 이름 업데이트
    setCustomerName(trimmedName)
    
    // localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem('tour_chat_customer_name', trimmedName)
    }
    
    setShowNameEdit(false)
    console.log('Customer name updated:', trimmedName)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat room...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Unable to load chat room information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900"
                aria-label="Home"
                title="Home"
              >
                <HomeIcon size={20} />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {selectedLanguage === 'en'
                    ? (productNames?.name_en || productNames?.name || room.room_name)
                    : (productNames?.name_ko || productNames?.name || room.room_name)}
                </h1>
                <div className="flex items-center text-sm text-gray-600 mt-1">
                  <div className="flex items-center">
                    {(() => {
                      // YYYY-MM-DD 형식을 안전하게 파싱
                      const [year, month, day] = tourInfo.tour_date.split('-').map(Number)
                      const date = new Date(year, month - 1, day)
                      return date.toLocaleDateString()
                    })()}
                  </div>
                  {customerName && (
                    <div className="ml-auto flex items-center space-x-2">
                      <span className="text-gray-700">Hi! {customerName}</span>
                      <button
                        onClick={() => setShowNameEdit(true)}
                        className="p-1 rounded hover:bg-gray-100"
                        aria-label="Change Name"
                        title="Change Name"
                      >
                        <SquarePen size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 채팅방 안내 제거 */}

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
          <div className="bg-white rounded-lg shadow-sm border flex flex-col overflow-hidden" style={{ height: '70vh' }}>
            <div className="flex-1 overflow-hidden">
              <TourChatRoom
                tourId={room.tour_id}
                guideEmail={room.created_by}
                isPublicView={true}
                roomCode={room.room_code}
                tourDate={tourInfo.tour_date}
                customerName={customerName}
                customerLanguage={selectedLanguage}
              />
            </div>
          </div>
        )}

        {/* 사용 안내 */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Usage Guide</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Feel free to ask about pickup times, locations, or any other questions.</li>
            <li>• You can communicate in real-time with your guide about special requests or questions during the tour.</li>
            <li>• Please wait a moment for your guide to respond.</li>
            <li>• The chat room will remain available for a certain period after the tour ends.</li>
          </ul>
        </div>

        {/* 이름 변경 모달 */}
        {showNameEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Name</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter your new name
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
                    placeholder="e.g., John Smith"
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
                    Update Name
                  </button>
                  <button
                    onClick={() => {
                      setShowNameEdit(false)
                      setTempName(customerName) // 원래 이름으로 되돌리기
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
