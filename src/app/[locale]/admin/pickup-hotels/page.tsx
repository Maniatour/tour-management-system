'use client'

import { useState, useEffect, use } from 'react'
import { Plus, Search, MapPin, Image, Video, X, ChevronLeft, ChevronRight, Trash2, Copy, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import PickupHotelForm from '@/components/PickupHotelForm'

interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  description_ko: string | null
  description_en: string | null
  address: string
  pin: string | null
  link: string | null
  media: string[] | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface AdminPickupHotelsProps {
  params: Promise<{ locale: string }>
}

export default function AdminPickupHotels({ params }: AdminPickupHotelsProps) {
  use(params) // locale 사용하지 않지만 params는 필요
  
  // 번역 문자열 정의
  const translations = {
    title: '새 호텔 추가',
    editTitle: '호텔 수정',
    hotel: '호텔명',
    pickUpLocation: '픽업 위치',
    descriptionKo: '한국어 설명',
    descriptionEn: '영어 설명',
    address: '주소',
    pin: '좌표 (위도,경도)',
    link: '구글 맵 링크',
    media: '미디어 파일 (사진, 동영상)',
    cancel: '취소',
    add: '추가',
    edit: '수정'
  }
  
  const [hotels, setHotels] = useState<PickupHotel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingHotel, setEditingHotel] = useState<PickupHotel | null>(null)
  const [imageViewer, setImageViewer] = useState<{
    isOpen: boolean
    images: string[]
    currentIndex: number
    hotelName: string
  }>({
    isOpen: false,
    images: [],
    currentIndex: 0,
    hotelName: ''
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    hotel: PickupHotel | null
  }>({
    isOpen: false,
    hotel: null
  })

  // Supabase에서 픽업 호텔 데이터 가져오기
  const fetchHotels = async () => {
    try {
      const { data, error } = await supabase
        .from('pickup_hotels')
        .select('*')
        .order('hotel', { ascending: true })

      if (error) {
        console.error('Error fetching pickup hotels:', error)
        return
      }

      setHotels(data || [])
    } catch (error) {
      console.error('Error fetching pickup hotels:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchHotels()
      setLoading(false)
    }
    
    loadData()
  }, [])

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageViewer.isOpen) return

      switch (e.key) {
        case 'Escape':
          closeImageViewer()
          break
        case 'ArrowLeft':
          prevImage()
          break
        case 'ArrowRight':
          nextImage()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [imageViewer.isOpen])

  const filteredHotels = hotels.filter(hotel => {
    const searchLower = searchTerm.toLowerCase()
    return (
      hotel.hotel?.toLowerCase().includes(searchLower) ||
      hotel.pick_up_location?.toLowerCase().includes(searchLower) ||
      hotel.address?.toLowerCase().includes(searchLower)
    )
  })

  const handleAddHotel = async (hotelData: Omit<PickupHotel, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('pickup_hotels')
        .insert([hotelData] as never[])

      if (error) {
        console.error('Error adding hotel:', error)
        alert('호텔 추가 중 오류가 발생했습니다: ' + error.message)
        return
      }

      await fetchHotels()
      setShowAddForm(false)
      alert('호텔이 성공적으로 추가되었습니다!')
    } catch (error) {
      console.error('Error adding hotel:', error)
      alert('호텔 추가 중 오류가 발생했습니다.')
    }
  }

  const handleEditHotel = async (hotelData: Omit<PickupHotel, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingHotel) {
      try {
        const { error } = await supabase
          .from('pickup_hotels')
          .update(hotelData as never)
          .eq('id', editingHotel.id)

        if (error) {
          console.error('Error updating hotel:', error)
          alert('호텔 수정 중 오류가 발생했습니다: ' + error.message)
          return
        }

        await fetchHotels()
        setEditingHotel(null)
      } catch (error) {
        console.error('Error updating hotel:', error)
        alert('호텔 수정 중 오류가 발생했습니다.')
      }
    }
  }

  const handleDeleteHotel = async (hotel: PickupHotel) => {
    try {
      const { error } = await supabase
        .from('pickup_hotels')
        .delete()
        .eq('id', hotel.id)

      if (error) {
        console.error('Error deleting hotel:', error)
        alert('호텔 삭제 중 오류가 발생했습니다: ' + error.message)
        return
      }

      await fetchHotels()
      setDeleteConfirm({ isOpen: false, hotel: null })
      alert('호텔이 성공적으로 삭제되었습니다!')
    } catch (error) {
      console.error('Error deleting hotel:', error)
      alert('호텔 삭제 중 오류가 발생했습니다.')
    }
  }

  const handleToggleActive = async (id: string, currentStatus: boolean | null) => {
    try {
      const newStatus = !currentStatus
      const { error } = await supabase
        .from('pickup_hotels')
        .update({ is_active: newStatus } as never)
        .eq('id', id)

      if (error) {
        console.error('Error toggling hotel status:', error)
        alert('호텔 상태 변경 중 오류가 발생했습니다: ' + error.message)
        return
      }

      await fetchHotels()
      alert(`호텔이 ${newStatus ? '활성화' : '비활성화'}되었습니다!`)
    } catch (error) {
      console.error('Error toggling hotel status:', error)
      alert('호텔 상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 호텔 복사 함수
  const handleCopyHotel = async (hotel: PickupHotel) => {
    try {
      const newHotel = {
        hotel: `${hotel.hotel} (복사본)`,
        pick_up_location: hotel.pick_up_location,
        description_ko: hotel.description_ko,
        description_en: hotel.description_en,
        address: hotel.address,
        pin: hotel.pin,
        link: hotel.link,
        media: hotel.media,
        is_active: false // 복사본은 비활성 상태로 생성
      }

      const { error } = await supabase
        .from('pickup_hotels')
        .insert([newHotel] as never[])

      if (error) {
        console.error('Error copying hotel:', error)
        alert('호텔 복사 중 오류가 발생했습니다: ' + error.message)
        return
      }

      await fetchHotels()
      alert('호텔이 복사되었습니다!')
    } catch (error) {
      console.error('Error copying hotel:', error)
      alert('호텔 복사 중 오류가 발생했습니다.')
    }
  }


  // 이미지 뷰어 열기
  const openImageViewer = (images: string[], startIndex: number, hotelName: string) => {
    setImageViewer({
      isOpen: true,
      images,
      currentIndex: startIndex,
      hotelName
    })
  }

  // 이미지 뷰어 닫기
  const closeImageViewer = () => {
    setImageViewer({
      isOpen: false,
      images: [],
      currentIndex: 0,
      hotelName: ''
    })
  }

  // 이전 이미지
  const prevImage = () => {
    setImageViewer(prev => ({
      ...prev,
      currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1
    }))
  }

  // 다음 이미지
  const nextImage = () => {
    setImageViewer(prev => ({
      ...prev,
      currentIndex: prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">픽업 호텔 관리</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>호텔 추가</span>
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="호텔명, 위치, 주소로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 호텔 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHotels.map((hotel) => (
          <div 
            key={hotel.id} 
            className="bg-white rounded-lg shadow-md p-6 border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setEditingHotel(hotel)}
          >
            {/* 호텔명 */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-semibold text-gray-900">{hotel.hotel}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  {hotel.link && (
                    <a
                      href={hotel.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin size={16} />
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyHotel(hotel)
                    }}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                    title="호텔 복사"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteConfirm({ isOpen: true, hotel })
                    }}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="호텔 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleActive(hotel.id, hotel.is_active)
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      hotel.is_active ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                    title={hotel.is_active ? '비활성화' : '활성화'}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        hotel.is_active ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* 픽업 위치 */}
            <div className="flex items-center mb-3">
              <MapPin size={16} className="text-gray-400 mr-2" />
              <span className="text-sm text-gray-700">{hotel.pick_up_location}</span>
            </div>

            {/* Description */}
            {(hotel.description_ko || hotel.description_en) && (
              <div className="mb-4">
                {hotel.description_ko && (
                  <div className="text-sm text-gray-900 mb-1">
                    <span className="font-medium">한국어 설명:</span> {hotel.description_ko}
                  </div>
                )}
                {hotel.description_en && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">영어 설명:</span> {hotel.description_en}
                  </div>
                )}
              </div>
            )}

            {/* 주소 */}
            <div className="text-sm text-gray-700 mb-3">
              <span className="font-medium">주소:</span> {hotel.address}
            </div>

            {/* 좌표 */}
            {hotel.pin && (
              <div className="text-sm text-gray-600 mb-3">
                <span className="font-medium">좌표:</span> {hotel.pin}
              </div>
            )}

            {/* 구글맵 링크 */}
            {hotel.link && (
              <div className="text-sm text-gray-600 mb-3">
                <div className="flex items-center">
                  <span className="font-medium mr-2">구글맵:</span>
                  <a
                    href={hotel.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline break-all flex-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hotel.link}
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (hotel.link) {
                        navigator.clipboard.writeText(hotel.link)
                        alert('링크가 클립보드에 복사되었습니다!')
                      }
                    }}
                    className="ml-2 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="링크 복사"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* 미디어 */}
            {hotel.media && hotel.media.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">미디어:</div>
                <div className="grid grid-cols-4 gap-2">
                  {hotel.media.slice(0, 4).map((url, index) => {
                    const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('drive.google.com')
                    return (
                      <div 
                        key={index} 
                        className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors relative group"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isImage) {
                            openImageViewer(hotel.media || [], index, hotel.hotel)
                          }
                        }}
                      >
                        {isImage ? (
                          <img
                            src={url}
                            alt={`${hotel.hotel} 이미지 ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              const parent = target.parentElement
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-full flex items-center justify-center">
                                    <div class="text-center">
                                      <div class="text-red-500 text-xs">이미지 로드 실패</div>
                                      <div class="text-gray-400 text-xs mt-1">URL 확인 필요</div>
                                    </div>
                                  </div>
                                `
                              }
                            }}
                          />
                        ) : (
                          <Video size={16} className="text-blue-600" />
                        )}
                        
                        {/* 호버 오버레이 */}
                        {isImage && (
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-lg flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Image size={20} className="text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {hotel.media.length > 4 && (
                    <div 
                      className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 cursor-pointer hover:bg-gray-200 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        openImageViewer(hotel.media || [], 4, hotel.hotel)
                      }}
                    >
                      +{hotel.media.length - 4}개 더
                    </div>
                  )}
                </div>
              </div>
            )}

            
          </div>
        ))}
      </div>

      {/* 호텔 추가/편집 모달 */}
      {showAddForm && (
        <PickupHotelForm
          onSubmit={handleAddHotel}
          onCancel={() => setShowAddForm(false)}
          translations={translations}
        />
      )}

             {editingHotel && (
         <PickupHotelForm
           hotel={editingHotel}
           onSubmit={handleEditHotel}
           onCancel={() => {
             setEditingHotel(null)
           }}
           onDelete={(id: string) => {
             const hotel = hotels.find(h => h.id === id)
             if (hotel) handleDeleteHotel(hotel)
           }}
           translations={translations}
         />
       )}

      {/* 이미지 뷰어 모달 */}
      {imageViewer.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* 닫기 버튼 */}
            <button
              onClick={closeImageViewer}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <X size={32} />
            </button>

            {/* 호텔명 */}
            <div className="absolute top-4 left-4 text-white text-lg font-semibold z-10">
              {imageViewer.hotelName}
            </div>

            {/* 이미지 카운터 */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-sm z-10">
              {imageViewer.currentIndex + 1} / {imageViewer.images.length}
            </div>

            {/* 이전 버튼 */}
            {imageViewer.images.length > 1 && (
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"
              >
                <ChevronLeft size={48} />
              </button>
            )}

            {/* 다음 버튼 */}
            {imageViewer.images.length > 1 && (
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"
              >
                <ChevronRight size={48} />
              </button>
            )}

            {/* 메인 이미지 */}
            <div className="max-w-4xl max-h-4xl mx-auto">
              <img
                src={imageViewer.images[imageViewer.currentIndex]}
                alt={`${imageViewer.hotelName} 이미지 ${imageViewer.currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-full h-64 flex items-center justify-center bg-gray-800 rounded-lg">
                        <div class="text-center text-white">
                          <div class="text-red-400 text-lg mb-2">이미지 로드 실패</div>
                          <div class="text-gray-400">URL을 확인해주세요</div>
                        </div>
                      </div>
                    `
                  }
                }}
              />
            </div>

            {/* 썸네일 네비게이션 */}
            {imageViewer.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
                {imageViewer.images.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setImageViewer(prev => ({ ...prev, currentIndex: index }))}
                    className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      index === imageViewer.currentIndex 
                        ? 'border-white' 
                        : 'border-transparent hover:border-gray-400'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`썸네일 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm.isOpen && deleteConfirm.hotel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">호텔 삭제 확인</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                다음 호텔을 삭제하시겠습니까?
              </p>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">{deleteConfirm.hotel.hotel}</p>
                <p className="text-sm text-gray-600">{deleteConfirm.hotel.pick_up_location}</p>
              </div>
              <p className="text-sm text-red-600 mt-2">
                ⚠️ 이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, hotel: null })}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteConfirm.hotel && handleDeleteHotel(deleteConfirm.hotel)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
