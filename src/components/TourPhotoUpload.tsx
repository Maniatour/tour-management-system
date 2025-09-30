'use client'

import { useState, useRef } from 'react'
import { Upload, X, Camera, Image as ImageIcon, Download, Share2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'

interface TourPhoto {
  id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  description?: string
  is_public: boolean
  share_token?: string
  created_at: string
  uploaded_by: string
}

interface TourPhotoUploadProps {
  tourId: string
  reservationId?: string
  uploadedBy: string
  onPhotosUpdated?: () => void
}

export default function TourPhotoUpload({ 
  tourId, 
  reservationId, 
  uploadedBy, 
  onPhotosUpdated 
}: TourPhotoUploadProps) {
  const t = useTranslations('tourPhoto')
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 사진 목록 로드
  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('tour_photos')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
    }
  }

  // 사진 업로드
  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setUploading(true)
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        // 파일 크기 체크 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`파일 크기가 너무 큽니다: ${file.name}`)
        }

        // MIME 타입 체크
        if (!file.type.startsWith('image/')) {
          throw new Error(`${t('imageOnlyError')}: ${file.name}`)
        }

        // 고유한 파일명 생성
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `tour-photos/${tourId}/${fileName}`

        // Supabase Storage에 업로드
        const { error: uploadError } = await supabase.storage
          .from('tour-photos')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // 공유 토큰 생성
        const shareToken = crypto.randomUUID()

        // 데이터베이스에 메타데이터 저장
        const { data: photoData, error: dbError } = await supabase
          .from('tour_photos')
          .insert({
            tour_id: tourId,
            reservation_id: reservationId,
            uploaded_by: uploadedBy,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            is_public: true,
            share_token: shareToken
          })
          .select()
          .single()

        if (dbError) throw dbError

        return photoData
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        return null
      }
    })

    try {
      const results = await Promise.all(uploadPromises)
      const successfulUploads = results.filter(Boolean)
      
      if (successfulUploads.length > 0) {
        setPhotos(prev => [...successfulUploads, ...prev])
        onPhotosUpdated?.()
        alert(t('uploadSuccess', { count: successfulUploads.length }))
      }
    } catch (error) {
      console.error('Error uploading photos:', error)
      alert(t('uploadError'))
    } finally {
      setUploading(false)
    }
  }

  // 사진 삭제
  const handleDeletePhoto = async (photoId: string, filePath: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      // Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('tour-photos')
        .remove([filePath])

      if (storageError) throw storageError

      // 데이터베이스에서 레코드 삭제
      const { error: dbError } = await supabase
        .from('tour_photos')
        .delete()
        .eq('id', photoId)

      if (dbError) throw dbError

      setPhotos(prev => prev.filter(photo => photo.id !== photoId))
      onPhotosUpdated?.()
    } catch (error) {
      console.error('Error deleting photo:', error)
      alert(t('deleteError'))
    }
  }

  // 공유 링크 복사
  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/photos/${shareToken}`
    navigator.clipboard.writeText(shareUrl)
    alert(t('shareLinkCopied'))
  }

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length) {
      handleFileUpload(files)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Camera size={16} />
          <span>{uploading ? t('uploading') : t('addPhotos')}</span>
        </button>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600 mb-2">
          {t('dragOrClick')}
        </p>
        <p className="text-sm text-gray-500">
          {t('fileFormats')}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* 사진 목록 */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${photo.file_path}`}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* 오버레이 */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 flex space-x-2">
                  <button
                    onClick={() => copyShareLink(photo.share_token!)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100"
                    title={t('copyShareLink')}
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={() => window.open(`/photos/${photo.share_token}`, '_blank')}
                    className="p-2 bg-white rounded-full hover:bg-gray-100"
                    title={t('viewInNewWindow')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(photo.id, photo.file_path)}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    title={t('delete')}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 파일 정보 */}
              <div className="mt-2 text-xs text-gray-600">
                <p className="truncate">{photo.file_name}</p>
                <p>{formatFileSize(photo.file_size)}</p>
                <p>{new Date(photo.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
          <p>{t('noPhotos')}</p>
        </div>
      )}
    </div>
  )
}
