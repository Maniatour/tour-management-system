'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download, Calendar, ImageIcon, Grid3X3, List, Check, CheckCircle } from 'lucide-react'
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [bulkDownloadMode, setBulkDownloadMode] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // 다국어 텍스트
  const texts = {
    ko: {
      title: '투어 사진',
      noPhotos: '업로드된 사진이 없습니다.',
      close: '닫기',
      download: '다운로드',
      uploadedBy: '업로드:',
      uploadedAt: '업로드 시간:',
      selectAll: '전체 선택',
      selectNone: '선택 해제',
      bulkDownload: '일괄 다운로드',
      downloading: '다운로드 중...',
      selectedCount: '개 선택됨',
      gridView: '그리드 보기',
      listView: '리스트 보기',
      previous: '이전',
      next: '다음'
    },
    en: {
      title: 'Tour Photos',
      noPhotos: 'No photos uploaded yet.',
      close: 'Close',
      download: 'Download',
      uploadedBy: 'Uploaded by:',
      uploadedAt: 'Uploaded at:',
      selectAll: 'Select All',
      selectNone: 'Select None',
      bulkDownload: 'Bulk Download',
      downloading: 'Downloading...',
      selectedCount: 'selected',
      gridView: 'Grid View',
      listView: 'List View',
      previous: 'Previous',
      next: 'Next'
    }
  }
  
  const t = texts[language]

  // 사진 목록 로드
  const loadPhotos = async () => {
    try {
      setLoading(true)
      
      console.log('=== 투어 사진 갤러리 디버깅 ===')
      console.log('투어 ID:', tourId)
      
      // 투어 사진 폴더 경로 (tour-photos 버켓 안의 투어 ID 폴더)
      const folderPath = tourId
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
            .createSignedUrl(`${tourId}/${photo.file_name}`, 3600) // 1시간 유효

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
  const openPhotoModal = (photo: TourPhoto, index: number) => {
    setSelectedPhoto(photo)
    setCurrentIndex(index)
    setShowModal(true)
  }

  // 사진 선택/해제 핸들러
  const handlePhotoSelect = (photoId: string) => {
    const newSelected = new Set(selectedPhotos)
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId)
    } else {
      newSelected.add(photoId)
    }
    setSelectedPhotos(newSelected)
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)))
    }
  }

  // 일괄 다운로드
  const handleBulkDownload = async () => {
    if (selectedPhotos.size === 0) return
    
    setDownloading(true)
    try {
      const selectedPhotoObjects = photos.filter(p => selectedPhotos.has(p.id))
      
      for (let i = 0; i < selectedPhotoObjects.length; i++) {
        const photo = selectedPhotoObjects[i]
        try {
          const response = await fetch(photo.file_url)
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = photo.file_name
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)
          
          // 다운로드 간격을 두어 브라우저 부하 방지
          if (i < selectedPhotoObjects.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Failed to download ${photo.file_name}:`, error)
        }
      }
    } catch (error) {
      console.error('Bulk download failed:', error)
    } finally {
      setDownloading(false)
      setBulkDownloadMode(false)
      setSelectedPhotos(new Set())
    }
  }

  // 이전/다음 사진 네비게이션
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setSelectedPhoto(photos[currentIndex - 1])
    }
  }

  const handleNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSelectedPhoto(photos[currentIndex + 1])
    }
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

  // 포맷된 날짜 문자열 (항상 영어로 표시)
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
              {t.title} ({photos.length})
            </h2>
            
            <div className="flex items-center space-x-2">
              {/* 일괄 다운로드 모드 토글 */}
              <button
                onClick={() => {
                  setBulkDownloadMode(!bulkDownloadMode)
                  if (bulkDownloadMode) {
                    setSelectedPhotos(new Set())
                  }
                }}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  bulkDownloadMode 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {bulkDownloadMode ? t.selectNone : t.bulkDownload}
              </button>

              {/* 전체 선택 버튼 (일괄 다운로드 모드에서만 표시) */}
              {bulkDownloadMode && (
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                >
                  {selectedPhotos.size === photos.length ? t.selectNone : t.selectAll}
                </button>
              )}

              {/* 선택된 사진 수 표시 */}
              {bulkDownloadMode && selectedPhotos.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedPhotos.size} {t.selectedCount}
                </span>
              )}

              {/* 일괄 다운로드 실행 버튼 */}
              {bulkDownloadMode && selectedPhotos.size > 0 && (
                <button
                  onClick={handleBulkDownload}
                  disabled={downloading}
                  className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors disabled:opacity-50"
                >
                  {downloading ? t.downloading : `${t.download} (${selectedPhotos.size})`}
                </button>
              )}

              {/* 뷰 모드 토글 */}
              <div className="flex border rounded">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title={t.gridView}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                  title={t.listView}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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
              <div className={viewMode === 'grid' 
                ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4" 
                : "space-y-2"
              }>
                {photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className={`relative group ${
                      viewMode === 'grid' 
                        ? 'cursor-pointer' 
                        : 'flex items-center space-x-3 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (bulkDownloadMode) {
                        handlePhotoSelect(photo.id)
                      } else {
                        openPhotoModal(photo, index)
                      }
                    }}
                  >
                    {/* 선택 체크박스 (일괄 다운로드 모드에서만 표시) */}
                    {bulkDownloadMode && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedPhotos.has(photo.id) 
                            ? 'bg-blue-500 border-blue-500' 
                            : 'bg-white border-gray-300'
                        }`}>
                          {selectedPhotos.has(photo.id) && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    {viewMode === 'grid' ? (
                      <>
                        <img
                          src={photo.file_url}
                          alt={photo.file_name}
                          className="w-full h-24 sm:h-28 md:h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-20 rounded-full p-2">
                            <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-1 sm:p-2 rounded-b-lg">
                          <p className="text-xs text-white truncate">{photo.file_name}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={photo.file_url}
                          alt={photo.file_name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{photo.file_name}</p>
                          <p className="text-xs text-gray-500">{formatDate(photo.uploaded_at)}</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ImageIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      </>
                    )}
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
            {currentIndex > 0 && (
              <button
                onClick={handlePrevious}
                className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 sm:p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* 다음 버튼 */}
            {currentIndex < photos.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 sm:p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* 메인 이미지 */}
            <img
              src={selectedPhoto.file_url}
              alt={selectedPhoto.file_name}
              className="max-w-full max-h-full object-contain"
            />

            {/* 사진 정보 */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 bg-black bg-opacity-70 text-white p-2 sm:p-4 rounded-lg">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base truncate">{selectedPhoto.file_name}</p>
                  <div className="flex items-center space-x-2 sm:space-x-4 text-xs sm:text-sm text-gray-300">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      {formatDate(selectedPhoto.uploaded_at)}
                    </span>
                    <span className="text-gray-400">
                      {currentIndex + 1} / {photos.length}
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
                  className="flex items-center px-2 sm:px-3 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors text-xs sm:text-sm"
                >
                  <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
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
