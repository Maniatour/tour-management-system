'use client'

import React, { useState, useEffect } from 'react'
import { Image, Play, Download, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MediaItem {
  id: string
  product_id: string
  file_name: string
  file_url: string
  file_type: 'image' | 'video' | 'document'
  file_size: number
  mime_type: string
  alt_text: string
  caption: string
  order_index: number
  is_primary: boolean
  is_active: boolean
}

interface ProductMediaDisplayProps {
  productId: string
}

export default function ProductMediaDisplay({ productId }: ProductMediaDisplayProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)

  useEffect(() => {
    fetchMedia()
  }, [productId])

  const fetchMedia = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('product_media')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (error) {
        console.error('Supabase 오류:', error)
        throw new Error(`데이터베이스 오류: ${error.message}`)
      }

      setMediaItems(data || [])
    } catch (error) {
      console.error('미디어 로드 오류:', error)
      setMediaItems([])
    } finally {
      setLoading(false)
    }
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return <Image className="h-4 w-4" />
      case 'video':
        return <Play className="h-4 w-4" />
      case 'document':
        return <Download className="h-4 w-4" />
      default:
        return <Image className="h-4 w-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const openLightbox = (index: number) => {
    setSelectedImage(index)
    setShowLightbox(true)
  }

  const closeLightbox = () => {
    setShowLightbox(false)
  }

  const nextImage = () => {
    const images = mediaItems.filter(item => item.file_type === 'image')
    setSelectedImage((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    const images = mediaItems.filter(item => item.file_type === 'image')
    setSelectedImage((prev) => (prev - 1 + images.length) % images.length)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">미디어를 불러오는 중...</span>
      </div>
    )
  }

  if (mediaItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Image className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>등록된 미디어가 없습니다.</p>
      </div>
    )
  }

  const images = mediaItems.filter(item => item.file_type === 'image')
  const videos = mediaItems.filter(item => item.file_type === 'video')
  const documents = mediaItems.filter(item => item.file_type === 'document')

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">미디어 갤러리</h3>
      
      {/* 이미지 갤러리 */}
      {images.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">사진</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((media, index) => (
              <div
                key={media.id}
                className="relative group cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                <img
                  src={media.file_url}
                  alt={media.alt_text || media.file_name}
                  className="w-full h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {media.caption && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{media.caption}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 비디오 갤러리 */}
      {videos.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">비디오</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((media) => (
              <div key={media.id} className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <Play className="h-8 w-8 text-gray-500" />
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{media.file_name}</h5>
                    <p className="text-sm text-gray-500">{formatFileSize(media.file_size)}</p>
                    {media.caption && (
                      <p className="text-sm text-gray-600 mt-1">{media.caption}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 문서 갤러리 */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">문서</h4>
          <div className="space-y-2">
            {documents.map((media) => (
              <div key={media.id} className="bg-gray-50 rounded-lg p-4 flex items-center space-x-3">
                <Download className="h-6 w-6 text-gray-500" />
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900">{media.file_name}</h5>
                  <p className="text-sm text-gray-500">{formatFileSize(media.file_size)}</p>
                  {media.caption && (
                    <p className="text-sm text-gray-600 mt-1">{media.caption}</p>
                  )}
                </div>
                <a
                  href={media.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  다운로드
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 라이트박스 */}
      {showLightbox && images.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <img
              src={images[selectedImage]?.file_url}
              alt={images[selectedImage]?.alt_text || images[selectedImage]?.file_name}
              className="max-w-full max-h-full object-contain"
            />
            
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
                >
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
                >
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
              {selectedImage + 1} / {images.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
