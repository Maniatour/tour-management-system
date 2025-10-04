'use client'

import React, { useState, useEffect } from 'react'
import { X, Download, ImageIcon } from 'lucide-react'

interface PickupHotelPhotoGalleryProps {
  isOpen: boolean
  onClose: () => void
  hotelName: string
  mediaUrls: string[]
  language?: 'ko' | 'en'
}

export default function PickupHotelPhotoGallery({ 
  isOpen, 
  onClose, 
  hotelName, 
  mediaUrls, 
  language = 'ko' 
}: PickupHotelPhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  // 다국어 텍스트
  const texts = {
    ko: {
      title: '픽업 호텔 사진',
      noPhotos: '업로드된 사진이 없습니다.',
      close: '닫기',
      download: '다운로드'
    },
    en: {
      title: 'Pickup Hotel Photos',
      noPhotos: 'No photos uploaded yet.',
      close: 'Close',
      download: 'Download'
    }
  }
  
  const t = texts[language]

  // 사진 클릭 핸들러
  const handlePhotoClick = (photoUrl: string) => {
    setSelectedPhoto(photoUrl)
    setShowModal(true)
  }

  // 사진 모달 닫기
  const closePhotoModal = () => {
    setSelectedPhoto(null)
    setShowModal(false)
  }

  // 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closePhotoModal()
    }
  }

  // 다운로드 핸들러
  const handleDownload = async (photoUrl: string) => {
    try {
      const response = await fetch(photoUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `hotel-photo-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* 메인 갤러리 모달 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <ImageIcon className="w-5 h-5 mr-2" />
              {hotelName} - {t.title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 사진 그리드 */}
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
            {mediaUrls && mediaUrls.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mediaUrls.map((photoUrl, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer"
                    onClick={() => handlePhotoClick(photoUrl)}
                  >
                    <img
                      src={photoUrl}
                      alt={`${hotelName} 사진 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg shadow-md hover:shadow-lg transition-shadow"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ImageIcon className="w-8 h-8 text-white" />
                      </div>
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

      {/* 사진 확대 모달 */}
      {showModal && selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]"
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* 모달 배경 클릭으로 닫기 */}
          <div 
            className="absolute inset-0"
            onClick={closePhotoModal}
          />
          
          {/* 모달 콘텐츠 */}
          <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
            {/* 닫기 버튼 */}
            <button
              onClick={closePhotoModal}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* 사진 */}
            <div className="relative max-w-full max-h-full">
              <img
                src={selectedPhoto}
                alt={`${hotelName} 사진`}
                className="max-w-full max-h-full object-contain"
              />
              
              {/* 다운로드 버튼 */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <button
                  onClick={() => handleDownload(selectedPhoto)}
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
