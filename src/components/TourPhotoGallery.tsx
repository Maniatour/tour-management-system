'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Calendar, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourPhoto {
  id: string
  file_url: string
  file_name: string
  uploaded_at: string
  uploaded_by: string
  uploaded_by_name?: string
}

interface TourPhotoGalleryProps {
  isOpen: boolean
  onClose: () => void
  tourId: string
  language?: 'ko' | 'en'
}

export default function TourPhotoGallery({ isOpen, onClose, tourId, language = 'ko' }: TourPhotoGalleryProps) {
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<TourPhoto | null>(null)
  const [showModal, setShowModal] = useState(false)

  // 다국어 텍스트
  const texts = {
    ko: {
      title: '투어 사진',
      noPhotos: '업로드된 사진이 없습니다.',
      close: '닫기',
      download: '다운로드',
      uploadedBy: '업로드:',
      uploadedAt: '업로드 시간:'
    },
    en: {
      title: 'Tour Photos',
      noPhotos: 'No photos uploaded yet.',
      close: 'Close',
      download: 'Download',
      uploadedBy: 'Uploaded by:',
      uploadedAt: 'Uploaded at:'
    }
  }
  
  const t = texts[language]

  // 사진 목록 로드
  const loadPhotos = async () => {
    try {
      setLoading(true)
      
      console.log('=== 투어 사진 갤러리 디버깅 ===')
      console.log('투어 ID:', tourId)
      
      // 투어 사진 폴더 경로
      const folderPath = `tours/${tourId}/photos`
      console.log('폴더 경로:', folderPath)
      
      // Storage에서 파일 목록 가져오기
      const { data: files, error } = await supabase.storage
        .from('tour-photos')
        .list(folderPath)
        
      console.log('Storage 응답:', { files, error })

      if (error) {
        console.error('Storage listing error:', error)
        setPhotos([])
        return
      }

      if (!files || files.length === 0) {
        setPhotos([])
        return
      }

      // 파일 정보를 Photo 객체로 변환
      const photoData: TourPhoto[] = files.map(file => ({
        id: file.id || file.name,
        file_url: '', // URL은 개별적으로 생성
        file_name: file.name,
        uploaded_at: file.updated_at || file.created_at || new Date().toISOString(),
        uploaded_by: 'Unknown'
      }))

      // 각 사진의 URL 생성
      const photosWithUrls: TourPhoto[] = await Promise.all(
        photoData.map(async (photo) => {
          const { data: urlData } = await supabase.storage
            .from('tour-photos')
            .createSignedUrl(`${folderPath}/${photo.file_name}`, 3600) // 1시간 유효

          return {
            ...photo,
            file_url: urlData?.signedUrl || ''
          }
        })
      )

      setPhotos(photosWithUrls.filter(photo => photo.file_url))
    } catch (error) {
      console.error('Error loading photos:', error)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 사진 로드
  useEffect(() => {
    if (isOpen && tourId) {
      loadPhotos()
    }
  }, [isOpen, tourId])

  // 사진 모달 열기
  const openPhotoModal = (photo: TourPhoto) => {
    setSelectedPhoto(photo)
    setShowModal(true)
  }

  // 사진 모달 닫기
  const closePhotoModal = () => {
    setSelectedPhoto(null)
    setShowModal(false)
  }

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showModal || !selectedPhoto) return
    
    switch (e.key) {
      case 'Escape':
        closePhotoModal()
        break
      case 'ArrowLeft':
        const prevIndex = photos.findIndex(p => p.id === selectedPhoto.id) - 1
        if (prevIndex >= 0) {
          setSelectedPhoto(photos[prevIndex])
        }
        break
      case 'ArrowRight':
        const nextIndex = photos.findIndex(p => p.id === selectedPhoto.id) + 1
        if (nextIndex < photos.length) {
          setSelectedPhoto(photos[nextIndex])
        }
        break
    }
  }, [showModal, selectedPhoto, photos])

  useEffect(() => {
    if (showModal) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showModal, handleKeyDown])

  // 포맷된 날짜 문자열
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* 메인 갤러리 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <ImageIcon className="w-5 h-5 mr-2" />
              {t.title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 컨텐츠 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">사진을 불러오는 중...</span>
                </div>
              </div>
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group cursor-pointer"
                    onClick={() => openPhotoModal(photo)}
                  >
                    <img
                      src={photo.file_url}
                      alt={photo.file_name}
                      className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-20 rounded-full p-2">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 rounded-b-lg">
                      <p className="text-xs text-white truncate">{photo.file_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">{t.noPhotos}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 사진 모달 갤러리 */}
      {showModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* 모달 배경 클릭으로 닫기 */}
          <div 
            className="absolute inset-0"
            onClick={closePhotoModal}
          ></div>
          
          {/* 모달 콘텐츠 */}
          <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
            {/* 닫기 버튼 */}
            <button
              onClick={closePhotoModal}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* 이전 버튼 */}
            {photos.findIndex(p => p.id === selectedPhoto.id) > 0 && (
              <button
                onClick={() => {
                  const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id)
                  setSelectedPhoto(photos[currentIndex - 1])
                }}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* 다음 버튼 */}
            {photos.findIndex(p => p.id === selectedPhoto.id) < photos.length - 1 && (
              <button
                onClick={() => {
                  const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id)
                  setSelectedPhoto(photos[currentIndex + 1])
                }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* 메인 이미지 */}
            <img
              src={selectedPhoto.file_url}
              alt={selectedPhoto.file_name}
              className="max-w-full max-h-full object-contain"
            />

            {/* 사진 정보 */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 text-white p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedPhoto.file_name}</p>
                  <div className="flex items-center space-x-4 text-sm text-gray-300">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {formatDate(selectedPhoto.uploaded_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = selectedPhoto.file_url
                    link.download = selectedPhoto.file_name
                    link.click()
                  }}
                  className="flex items-center px-3 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
                >
                  <Download className="w-4 h-4 mr-1" />
                  {t.download}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
