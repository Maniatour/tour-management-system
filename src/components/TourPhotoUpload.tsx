'use client'

import { useState, useRef, useEffect } from 'react'
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
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, batch: 0, totalBatches: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 사진 목록 로드
  const loadPhotos = async () => {
    try {
      console.log('Loading photos for tour:', tourId)
      const { data, error } = await supabase
        .from('tour_photos')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading photos:', error)
        // 테이블이 존재하지 않는 경우 빈 배열로 설정
        if (error.code === 'PGRST205') {
          console.warn('tour_photos table does not exist, returning empty array')
          setPhotos([])
          return
        }
        throw error
      }
      
      console.log('Loaded photos:', data)
      setPhotos(data || [])
    } catch (error) {
      console.error('Error loading photos:', error)
      // 에러 발생 시 빈 배열로 설정하여 앱이 크래시되지 않도록 함
      setPhotos([])
    }
  }

  // Storage 버킷 확인
  const ensureStorageBucket = async () => {
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets()
      if (error) {
        console.error('Error listing buckets:', error)
        return false
      }
      
      console.log('Available buckets:', buckets)
      
      const tourPhotosBucket = buckets?.find(bucket => bucket.name === 'tour-photos')
      if (!tourPhotosBucket) {
        console.error('tour-photos bucket not found in:', buckets?.map(b => b.name))
        // 버킷이 없어도 일단 true를 반환하여 업로드를 시도해보자
        console.log('Proceeding without bucket check...')
        return true
      } else {
        console.log('tour-photos bucket exists:', tourPhotosBucket)
      }
      
      return true
    } catch (error) {
      console.error('Error checking storage bucket:', error)
      // 에러가 발생해도 일단 true를 반환하여 업로드를 시도해보자
      return true
    }
  }

  // 컴포넌트 마운트 시 사진 목록 로드 및 Storage 확인
  useEffect(() => {
    const initialize = async () => {
      console.log('TourPhotoUpload: Initializing...')
      await ensureStorageBucket()
      await loadPhotos()
    }
    initialize()
  }, [tourId])

  // 사진 업로드
  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    console.log('Starting file upload for files:', Array.from(files).map(f => f.name))
    
    // Storage 버킷 확인 (디버깅용)
    await ensureStorageBucket()
    
    setUploading(true)
    
    // 파일 개수 제한 체크 (최대 500개)
    if (files.length > 500) {
      alert('한번에 최대 500개의 파일만 업로드할 수 있습니다.')
      return
    }

    console.log(`총 ${files.length}개 파일 업로드 시작`)

    // 대량 파일 처리를 위한 배치 업로드 (한번에 20개씩)
    const batchSize = 20
    const fileArray = Array.from(files)
    const batches = []
    
    for (let i = 0; i < fileArray.length; i += batchSize) {
      batches.push(fileArray.slice(i, i + batchSize))
    }

    console.log(`${batches.length}개 배치로 나누어 업로드 (배치당 ${batchSize}개)`)
    
    // 업로드 진행 상황 초기화
    setUploadProgress({ current: 0, total: files.length, batch: 0, totalBatches: batches.length })


    try {
      let totalSuccessful = 0
      let totalFailed = 0
      
      // 배치별로 순차 업로드
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`배치 ${batchIndex + 1}/${batches.length} 업로드 중... (${batch.length}개 파일)`)
        
        // 진행 상황 업데이트
        setUploadProgress(prev => ({ 
          ...prev, 
          batch: batchIndex + 1,
          current: batchIndex * batchSize
        }))
        
        const batchPromises = batch.map(async (file) => {
          try {
            console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`)
            
            // 파일 크기 체크 (50MB로 증가)
            if (file.size > 50 * 1024 * 1024) {
              throw new Error(`파일 크기가 너무 큽니다: ${file.name} (최대 50MB)`)
            }

            // MIME 타입 체크
            if (!file.type.startsWith('image/')) {
              throw new Error(`${t('imageOnlyError')}: ${file.name}`)
            }

            // 고유한 파일명 생성
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${tourId}/${fileName}`

            console.log(`Uploading to storage: ${filePath}`)

            // Supabase Storage에 업로드
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('tour-photos')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              })

            if (uploadError) {
              console.error('Storage upload error:', uploadError)
              throw uploadError
            }

            console.log('Storage upload successful:', uploadData)

            // 공유 토큰 생성
            const shareToken = crypto.randomUUID()

            console.log('Inserting photo metadata to database')

            // 데이터베이스에 메타데이터 저장
            const { data: photoData, error: dbError } = await supabase
              .from('tour_photos')
              .insert({
                tour_id: tourId,
                file_path: uploadData.path,
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
                uploaded_by: user?.id,
                share_token: shareToken
              })
              .select()
              .single()

            if (dbError) {
              console.error('Database insert error:', dbError)
              // Storage에서 파일 삭제
              await supabase.storage.from('tour-photos').remove([uploadData.path])
              throw dbError
            }

            console.log(`Successfully uploaded ${file.name}`)
            return photoData
          } catch (error) {
            console.error(`Error uploading ${file.name}:`, error)
            return null
          }
        })

        const batchResults = await Promise.allSettled(batchPromises)
        const batchSuccessful = batchResults.filter(r => r.status === 'fulfilled' && r.value !== null).length
        const batchFailed = batchResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null)).length
        
        totalSuccessful += batchSuccessful
        totalFailed += batchFailed
        
        console.log(`배치 ${batchIndex + 1} 완료: ${batchSuccessful}개 성공, ${batchFailed}개 실패`)
        
        // 배치 간 잠시 대기 (서버 부하 방지)
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      if (totalSuccessful > 0) {
        console.log(`전체 업로드 완료: ${totalSuccessful}개 성공, ${totalFailed}개 실패`)
        // 사진 목록 새로고침
        await loadPhotos()
        onPhotosUpdated?.()
        
        if (totalFailed > 0) {
          alert(`📊 업로드 완료: ${totalSuccessful}개 성공, ${totalFailed}개 실패`)
        } else {
          alert(`✅ 성공적으로 ${totalSuccessful}개 파일을 업로드했습니다.`)
        }
      } else {
        alert(`❌ 모든 파일 업로드에 실패했습니다. (${totalFailed}개 파일)`)
      }
    } catch (error) {
      console.error('Error uploading photos:', error)
      alert(`❌ 업로드 중 오류가 발생했습니다: ${error.message}`)
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

      // 사진 목록 새로고침
      await loadPhotos()
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
        <div className="flex space-x-2">
          {/* 갤러리에서 선택 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <ImageIcon size={16} />
            <span>{uploading ? t('uploading') : t('selectFromGallery')}</span>
          </button>
          
          {/* 카메라로 직접 촬영 */}
          <button
            onClick={() => {
              const cameraInput = document.createElement('input')
              cameraInput.type = 'file'
              cameraInput.accept = 'image/*'
              cameraInput.capture = 'environment'
              cameraInput.multiple = false
              cameraInput.onchange = (e) => {
                const target = e.target as HTMLInputElement
                if (target.files && target.files.length > 0) {
                  handleFileUpload(target.files)
                }
              }
              cameraInput.click()
            }}
            disabled={uploading}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Camera size={16} />
            <span>{t('takePhoto')}</span>
          </button>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={32} className="mx-auto text-gray-400 mb-2 sm:mb-4" />
        <p className="text-gray-600 mb-1 sm:mb-2 text-sm sm:text-base">
          {t('dragOrClick')}
        </p>
        <p className="text-xs sm:text-sm text-gray-500">
          {t('fileFormats')}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
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

      {photos.length === 0 && !uploading && (
        <div className="text-center py-8 text-gray-500">
          <ImageIcon size={48} className="mx-auto mb-4 text-gray-300" />
          <p>{t('noPhotos')}</p>
        </div>
      )}

      {uploading && (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('uploading')}</p>
          
          {/* 업로드 진행 상황 */}
          {uploadProgress.total > 0 && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>배치 {uploadProgress.batch}/{uploadProgress.totalBatches}</span>
                <span>{uploadProgress.current}/{uploadProgress.total} 파일</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}% 완료
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
