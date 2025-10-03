'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, Camera, Image as ImageIcon, Download, Share2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { createTourPhotosBucket, checkTourPhotosBucket } from '@/lib/tourPhotoBucket'

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
  const [selectedPhoto, setSelectedPhoto] = useState<TourPhoto | null>(null)
  const [showModal, setShowModal] = useState(false)
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

  // Storage 버킷 확인 및 생성
  const ensureStorageBucket = async () => {
    try {
      const bucketExists = await checkTourPhotosBucket()
      if (bucketExists) {
        console.log('tour-photos bucket exists')
        return true
      }
      
      console.log('tour-photos bucket not found, attempting to create...')
      const created = await createTourPhotosBucket()
      
      if (created) {
        console.log('tour-photos bucket created successfully')
        return true
      } else {
        console.error('Failed to create tour-photos bucket')
        return false
      }
    } catch (error) {
      console.error('Error ensuring storage bucket:', error)
      return false
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

    // 대량 파일 처리를 위한 배치 업로드 (한번에 10개씩으로 조정)
    const batchSize = 10
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
      const failedFiles: string[] = []
      
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

            // 고유한 파일명 생성 (타임스탬프 추가로 중복 방지)
            const fileExt = file.name.split('.').pop()
            const timestamp = Date.now() + Math.random().toString(36).substring(2)
            const fileName = `${timestamp}.${fileExt}`
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
            failedFiles.push(`${file.name}: ${error.message || error}`)
            return null
          }
        })

        const batchResults = await Promise.allSettled(batchPromises)
        const batchSuccessful = batchResults.filter(r => r.status === 'fulfilled' && r.value !== null).length
        const batchFailed = batchResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null)).length
        
        totalSuccessful += batchSuccessful
        totalFailed += batchFailed
        
        console.log(`배치 ${batchIndex + 1} 완료: ${batchSuccessful}개 성공, ${batchFailed}개 실패`)
        
        // 진행 상황 업데이트
        setUploadProgress(prev => ({ 
          ...prev, 
          current: Math.min((batchIndex + 1) * batchSize, files.length)
        }))
        
        // 배치 간 잠시 대기 (서버 부하 방지)
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 1초에서 0.5초로 단축
        }
        
        // 배치 실패율이 높으면 대기 시간 증가
        if (batchFailed > batchSuccessful) {
          console.log('배치 실패율이 높음, 추가 대기 시간 적용')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      if (totalSuccessful > 0) {
        console.log(`전체 업로드 완료: ${totalSuccessful}개 성공, ${totalFailed}개 실패`)
        // 사진 목록 새로고침
        await loadPhotos()
        onPhotosUpdated?.()
        
        if (totalFailed > 0) {
          alert(`📊 업로드 완료: ${totalSuccessful}개 성공, ${totalFailed}개 실패\n\n실패한 파일들:\n${failedFiles.slice(0, 5).join('\n')}${failedFiles.length > 5 ? `\n... 외 ${failedFiles.length - 5}개` : ''}`)
        } else {
          alert(`✅ 성공적으로 ${totalSuccessful}개 파일을 업로드했습니다.`)
        }
      } else {
        alert(`❌ 모든 파일 업로드에 실패했습니다. (${totalFailed}개 파일)\n\n실패 원인:\n${failedFiles.slice(0, 10).join('\n')}${failedFiles.length > 10 ? `\n... 외 ${failedFiles.length - 10}개` : ''}`)
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

  // 사진 모달 열기
  const openPhotoModal = (photo: TourPhoto) => {
    setSelectedPhoto(photo)
    setShowModal(true)
  }

  // 사진 모달 닫기
  const closePhotoModal = () => {
    setShowModal(false)
    setSelectedPhoto(null)
  }

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showModal || !selectedPhoto) return

    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id)
    
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      setSelectedPhoto(photos[currentIndex - 1])
    } else if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
      setSelectedPhoto(photos[currentIndex + 1])
    } else if (e.key === 'Escape') {
      closePhotoModal()
    }
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
            className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            title={uploading ? t('uploading') : t('selectFromGallery')}
          >
            <ImageIcon size={20} />
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
            className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            title={t('takePhoto')}
          >
            <Camera size={20} />
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
            <div key={photo.id} className="relative group cursor-pointer">
              <div 
                className="aspect-square bg-gray-100 rounded-lg overflow-hidden"
                onClick={() => openPhotoModal(photo)}
              >
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${photo.file_path}`}
                  alt={photo.file_name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
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

      {/* 사진 모달 갤러리 */}
      {showModal && selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
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
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
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
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* 메인 이미지 */}
            <div className="flex items-center justify-center w-full h-full">
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${selectedPhoto.file_path}`}
                alt={selectedPhoto.file_name}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* 이미지 정보 */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{selectedPhoto.file_name}</h3>
                  <p className="text-sm text-gray-300">
                    {formatFileSize(selectedPhoto.file_size)} • {selectedPhoto.file_type}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyShareLink(selectedPhoto.share_token!)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    공유 링크 복사
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(selectedPhoto.id, selectedPhoto.file_path)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>

            {/* 썸네일 네비게이션 */}
            {photos.length > 1 && (
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
                <div className="flex space-x-2 bg-black bg-opacity-50 p-2 rounded-lg">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className={`w-12 h-12 rounded overflow-hidden ${
                        photo.id === selectedPhoto.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${photo.file_path}`}
                        alt={photo.file_name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
