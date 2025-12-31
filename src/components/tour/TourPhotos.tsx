'use client'

import React, { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Share2, Copy, Check, ExternalLink } from 'lucide-react'
import TourPhotoUpload from '@/components/TourPhotoUpload'
import { supabase } from '@/lib/supabase'

interface TourPhotosProps {
  tour: any
  onPhotosUpdated: () => void
}

export const TourPhotos: React.FC<TourPhotosProps> = ({
  tour,
  onPhotosUpdated
}) => {
  const t = useTranslations('tours.tourPhoto')
  const [photoCount, setPhotoCount] = useState(0)
  const [copied, setCopied] = useState(false)
  
  // 사진 개수 확인
  useEffect(() => {
    const checkPhotoCount = async () => {
      try {
        const { data: files, error } = await supabase.storage
          .from('tour-photos')
          .list(tour.id, {
            sort: { column: 'created_at', order: 'desc' }
          })

        if (!error && files) {
          const photoFiles = files.filter((file: { name: string }) => 
            !file.name.includes('.folder_info.json') && 
            !file.name.includes('folder.info') &&
            !file.name.includes('.info') &&
            !file.name.includes('.README') &&
            !file.name.startsWith('.') &&
            file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          )
          setPhotoCount(photoFiles.length)
        }
      } catch (error) {
        console.error('Error checking photo count:', error)
      }
    }
    
    checkPhotoCount()
    // 주기적으로 사진 개수 확인 (5초마다)
    const interval = setInterval(checkPhotoCount, 5000)
    return () => clearInterval(interval)
  }, [tour.id])

  // 환경 변수가 있으면 사용하고, 없으면 현재 origin 사용 (배포 환경에서는 자동으로 올바른 도메인 사용)
  // locale을 포함한 경로 사용 (기본값: ko)
  const getLocale = () => {
    if (typeof window === 'undefined') return 'ko'
    const pathSegments = window.location.pathname.split('/').filter(Boolean)
    return pathSegments[0] === 'ko' || pathSegments[0] === 'en' ? pathSegments[0] : 'ko'
  }
  const shareUrl = typeof window !== 'undefined' 
    ? `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/${getLocale()}/photos/${tour.id}`
    : ''

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenLink = () => {
    if (shareUrl) {
      window.open(shareUrl, '_blank')
    }
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4" id="tour-photos">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        </div>
        
        {/* 공유 링크 섹션 */}
        {photoCount > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Share2 size={16} className="text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">투어 사진 공유 링크</span>
                  <span className="text-xs text-blue-600">({photoCount}장)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-1.5 text-sm bg-white border border-blue-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    title="링크 복사"
                  >
                    {copied ? (
                      <>
                        <Check size={16} className="mr-1" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy size={16} className="mr-1" />
                        복사
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleOpenLink}
                    className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    title="새 창에서 열기"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <TourPhotoUpload
          tourId={tour.id}
          uploadedBy="guide@tour.com" // 실제로는 현재 로그인한 가이드의 이메일
          onPhotosUpdated={() => {
            onPhotosUpdated()
            // 사진 개수 다시 확인
            setTimeout(() => {
              const checkPhotoCount = async () => {
                try {
                  const { data: files, error } = await supabase.storage
                    .from('tour-photos')
                    .list(tour.id, {
                      sort: { column: 'created_at', order: 'desc' }
                    })

                  if (!error && files) {
                    const photoFiles = files.filter((file: { name: string }) => 
                      !file.name.includes('.folder_info.json') && 
                      !file.name.includes('folder.info') &&
                      !file.name.includes('.info') &&
                      !file.name.includes('.README') &&
                      !file.name.startsWith('.') &&
                      file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                    )
                    setPhotoCount(photoFiles.length)
                  }
                } catch (error) {
                  console.error('Error checking photo count:', error)
                }
              }
              checkPhotoCount()
            }, 1000)
          }}
        />
      </div>
    </div>
  )
}
