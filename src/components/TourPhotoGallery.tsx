'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronLeft, ChevronRight, Download, Calendar, ImageIcon, Grid3X3, List, Check, CheckCircle, Plus, Upload, EyeOff, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SupabaseFile {
  id?: string
  name: string
  updated_at?: string
  created_at?: string
}

interface TourPhoto {
  id: string
  file_url: string
  thumbnail_url?: string // 썸네일 URL (선택적)
  file_name: string
  uploaded_at: string
  uploaded_by: string
  uploaded_by_name?: string
  is_hidden?: boolean // 표시 중단 여부
}

interface Customer {
  id: string
  name: string
}

interface TourPhotoGalleryProps {
  isOpen: boolean
  onClose: () => void
  tourId: string
  language?: 'ko' | 'en'
  allowUpload?: boolean // 고객용 업로드 허용 여부
  uploadedBy?: string // 업로드한 사용자 정보
}

export default function TourPhotoGallery({ isOpen, onClose, tourId, language = 'ko', allowUpload = false, uploadedBy }: TourPhotoGalleryProps) {
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<TourPhoto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [bulkDownloadMode, setBulkDownloadMode] = useState(false)
  const [hideRequestMode, setHideRequestMode] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const [showDownloadCustomerSelector, setShowDownloadCustomerSelector] = useState(false)
  const [showDownloadWarning, setShowDownloadWarning] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [hidingPhotos, setHidingPhotos] = useState(false)
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      next: '다음',
      upload: '사진 업로드',
      uploadingPhotos: '업로드 중...',
      uploadSuccess: '업로드 완료',
      uploadError: '업로드 실패',
      selectFiles: '파일 선택',
      loading: '사진을 불러오는 중...',
      select: '선택',
      done: '완료',
      none: '해제',
      all: '전체',
      selected: '개 선택됨',
      hideRequest: '표시 중단 요청',
      hideRequestMode: '표시 중단 모드',
      selectCustomer: '고객 선택',
      requestHide: '표시 중단 신청',
      hideSuccess: '표시 중단 요청이 완료되었습니다.',
      hideError: '표시 중단 요청 중 오류가 발생했습니다.',
      requesting: '요청 중...',
      downloadWarning: '다운로드 안내',
      downloadWarningContent: '개인정보 보호를 위해 본인의 사진만 다운로드해 주시기 바랍니다. 타인의 사진을 저장하는 것은 금지되어 있습니다.\n\n또한, 모든 다운로드 기록은 저장되며, 추후 초상권 등의 문제가 발생할 경우 출처가 남겨집니다.',
      downloadWarningConfirm: '동의하고 다운로드',
      downloadWarningCancel: '취소',
      downloadSuccess: '다운로드가 완료되었습니다.',
      downloadError: '다운로드 중 오류가 발생했습니다.'
    },
    en: {
      title: 'Photos',
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
      next: 'Next',
      upload: 'Upload',
      uploadingPhotos: 'Uploading...',
      uploadSuccess: 'Upload Complete',
      uploadError: 'Upload Failed',
      selectFiles: 'Select Files',
      loading: 'Loading photos...',
      select: 'Select',
      done: 'Done',
      none: 'None',
      all: 'All',
      selected: 'selected',
      hideRequest: 'Hide',
      hideRequestMode: 'Hide Mode',
      selectCustomer: 'Select Customer',
      requestHide: 'Hide',
      hideSuccess: 'Hide request completed successfully.',
      hideError: 'An error occurred while requesting hide.',
      requesting: 'Requesting...',
      downloadWarning: 'Download Notice',
      downloadWarningContent: 'For privacy protection, please download only your own photos. Saving photos of others is prohibited.\n\nAll download records are stored, and in case of portrait rights issues, the source will be tracked.',
      downloadWarningConfirm: 'Agree and Download',
      downloadWarningCancel: 'Cancel',
      downloadSuccess: 'Download completed successfully.',
      downloadError: 'An error occurred during download.'
    }
  }
  
  const t = texts[language]

  // 사진 목록 로드
  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true)
      
      console.log('=== 투어 사진 갤러리 디버깅 ===')
      console.log('투어 ID:', tourId)
      
      // 투어 사진 폴더 경로 (tour-photos 버켓 안의 투어 ID 폴더)
      const folderPath = tourId
      console.log('폴더 경로:', folderPath)
      
      // Storage에서 파일 목록 가져오기 (페이지네이션으로 모든 파일 가져오기)
      let allFiles: SupabaseFile[] = []
      let hasMore = true
      let offset = 0
      const limit = 1000 // 한 번에 가져올 최대 파일 수
      
      while (hasMore) {
        const { data: files, error } = await supabase.storage
          .from('tour-photos')
          .list(folderPath, {
            limit: limit,
            offset: offset,
            sort: { column: 'created_at', order: 'desc' }
          })
        
        console.log(`Storage 응답 (offset: ${offset}):`, { files, error })

        if (error) {
          console.error('Storage listing error:', error)
          break
        }

        if (!files || files.length === 0) {
          hasMore = false
          break
        }

        // 실제 사진 파일만 필터링
        const photoFiles = files.filter((file: SupabaseFile) => 
          !file.name.includes('.folder_info.json') && 
          !file.name.includes('folder.info') &&
          !file.name.includes('.info') &&
          !file.name.includes('.README') &&
          !file.name.startsWith('.') &&
          file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        )

        allFiles = [...allFiles, ...photoFiles]

        // 더 가져올 파일이 있는지 확인
        if (files.length < limit) {
          hasMore = false
        } else {
          offset += limit
        }
      }

      console.log(`총 ${allFiles.length}개의 사진 파일 발견`)

      if (allFiles.length === 0) {
        setPhotos([])
        return
      }

      // 표시 중단된 사진 정보 가져오기
      const { data: hideRequests } = await supabase
        .from('tour_photo_hide_requests')
        .select('file_name, is_hidden')
        .eq('tour_id', tourId)
        .eq('is_hidden', true)

      const hiddenFileNames = new Set(
        (hideRequests || []).map((req: { file_name: string }) => req.file_name)
      )

      // Public URL 사용 (bucket이 public이므로 signed URL 불필요 - 훨씬 빠름)
      // Public URL 형식: https://{project-ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
      // 파일 정보를 Photo 객체로 변환 (Public URL 직접 생성 - API 호출 없음)
      // 썸네일: 작은 크기로 표시 (브라우저가 자동으로 리사이즈)
      // 원본: 모달과 다운로드 시에만 사용
      const photosWithUrls: TourPhoto[] = allFiles
        .filter((file: SupabaseFile) => !hiddenFileNames.has(file.name)) // 표시 중단된 사진 필터링
        .map((file: SupabaseFile) => {
          const filePath = `${tourId}/${file.name}`
          const { data: { publicUrl } } = supabase.storage
            .from('tour-photos')
            .getPublicUrl(filePath)
          
          // 썸네일 URL 생성 (원본과 동일하지만, 표시 시 작은 크기로 제한)
          // 실제로는 같은 URL을 사용하되, Image 컴포넌트의 width/height로 크기 제한
          return {
            id: file.id || file.name,
            file_url: publicUrl, // 원본 URL (모달, 다운로드용)
            thumbnail_url: publicUrl, // 썸네일 URL (같은 URL이지만 작은 크기로 표시)
            file_name: file.name,
            uploaded_at: file.updated_at || file.created_at || new Date().toISOString(),
            uploaded_by: 'Unknown',
            is_hidden: false
          }
        })

      setPhotos(photosWithUrls)
    } catch (error) {
      console.error('Error loading photos:', error)
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [tourId])

  // 투어 고객 목록 로드
  const loadCustomers = useCallback(async () => {
    if (!tourId) return
    
    try {
      setLoadingCustomers(true)
      
      // 투어 정보 가져오기
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('reservation_ids')
        .eq('id', tourId)
        .single<{ reservation_ids: string[] | null }>()

      if (tourError || !tour || !tour.reservation_ids || tour.reservation_ids.length === 0) {
        console.error('Error loading tour or no reservations:', tourError)
        setCustomers([])
        return
      }

      // 예약 정보 가져오기
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('customer_id')
        .in('id', tour.reservation_ids)

      if (reservationsError || !reservations) {
        console.error('Error loading reservations:', reservationsError)
        setCustomers([])
        return
      }

      // 고객 ID 목록 추출
      const customerIds = [...new Set(
        reservations
          .map((r: { customer_id: string | null }) => r.customer_id)
          .filter(Boolean)
      )]

      if (customerIds.length === 0) {
        setCustomers([])
        return
      }

      // 고객 정보 가져오기
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds)

      if (customersError) {
        console.error('Error loading customers:', customersError)
        setCustomers([])
      } else {
        setCustomers((customersData || []) as Customer[])
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }, [tourId])

  // 컴포넌트 마운트 시 사진 로드
  useEffect(() => {
    if (isOpen && tourId) {
      loadPhotos()
      if (allowUpload) {
        loadCustomers() // 고객용일 때만 고객 목록 로드
      }
    }
  }, [isOpen, tourId, loadPhotos, allowUpload, loadCustomers])

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

  // 표시 중단 요청 처리
  const handleHideRequest = async (customerId: string, customerName: string) => {
    if (selectedPhotos.size === 0) {
      alert(language === 'ko' ? '선택된 사진이 없습니다.' : 'No photos selected.')
      return
    }

    setHidingPhotos(true)
    try {
      const selectedPhotoObjects = photos.filter(p => selectedPhotos.has(p.id))
      const requests = selectedPhotoObjects.map(photo => ({
        tour_id: tourId,
        file_name: photo.file_name,
        file_path: `${tourId}/${photo.file_name}`,
        customer_id: customerId,
        customer_name: customerName,
        is_hidden: true
      }))

      // 일괄 삽입 (중복은 무시)
      const { error } = await supabase
        .from('tour_photo_hide_requests')
        .upsert(requests, { onConflict: 'tour_id,file_name,customer_id' })

      if (error) {
        console.error('Error requesting hide:', error)
        alert(t.hideError)
      } else {
        // 성공 시 사진 목록 새로고침
        await loadPhotos()
        setSelectedPhotos(new Set())
        setHideRequestMode(false)
        setShowCustomerSelector(false)
        alert(t.hideSuccess)
      }
    } catch (error) {
      console.error('Error in handleHideRequest:', error)
      alert(t.hideError)
    } finally {
      setHidingPhotos(false)
    }
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)))
    }
  }

  // 일괄 다운로드 (고객용일 때는 경고 표시 후 고객 선택)
  const handleBulkDownload = async () => {
    if (selectedPhotos.size === 0) return
    
    // 고객용일 때는 경고 표시 후 고객 선택
    if (allowUpload) {
      setShowDownloadWarning(true)
      return
    }
    
    // 관리자/가이드용은 바로 다운로드
    await executeDownload(null, '')
  }

  // 실제 다운로드 실행
  const executeDownload = async (customerId: string | null, customerName: string) => {
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
          
          // 다운로드 기록 저장 (고객용일 때만)
          if (allowUpload && customerId) {
            try {
              await supabase
                .from('tour_photo_download_logs')
                .insert({
                  tour_id: tourId,
                  file_name: photo.file_name,
                  file_path: `${tourId}/${photo.file_name}`,
                  customer_id: customerId,
                  customer_name: customerName
                })
            } catch (error) {
              console.error('Error saving download log:', error)
              // 다운로드 기록 저장 실패해도 다운로드는 계속 진행
            }
          }
          
          // 다운로드 간격을 두어 브라우저 부하 방지
          if (i < selectedPhotoObjects.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`Failed to download ${photo.file_name}:`, error)
        }
      }
      
      if (allowUpload) {
        alert(t.downloadSuccess)
      }
    } catch (error) {
      console.error('Bulk download failed:', error)
      if (allowUpload) {
        alert(t.downloadError)
      }
    } finally {
      setDownloading(false)
      setBulkDownloadMode(false)
      setSelectedPhotos(new Set())
      setShowDownloadWarning(false)
      setShowDownloadCustomerSelector(false)
    }
  }

  // 다운로드 경고 확인 후 고객 선택
  const handleDownloadWarningConfirm = () => {
    setShowDownloadWarning(false)
    setShowDownloadCustomerSelector(true)
  }

  // 고객 선택 후 다운로드 실행
  const handleDownloadWithCustomer = async (customerId: string, customerName: string) => {
    setShowDownloadCustomerSelector(false)
    await executeDownload(customerId, customerName)
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

  // 파일 업로드 핸들러
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      alert(language === 'ko' ? '파일이 선택되지 않았습니다.' : 'No files selected.')
      return
    }

    const fileArray = Array.from(files)
    
    // 파일 개수 제한
    if (fileArray.length > 500) {
      alert(language === 'ko' ? '한번에 최대 500개의 파일만 업로드할 수 있습니다.' : 'Maximum 500 files can be uploaded at once.')
      return
    }

    setUploading(true)
    setUploadProgress({ current: 0, total: fileArray.length })

    try {
      let successCount = 0
      let failCount = 0

      // 배치 업로드 (한번에 500개씩)
      const batchSize = 500
      for (let i = 0; i < fileArray.length; i += batchSize) {
        const batch = fileArray.slice(i, i + batchSize)
        
        await Promise.all(
          batch.map(async (file) => {
            try {
              // 파일 크기 체크 (50MB)
              if (file.size > 50 * 1024 * 1024) {
                throw new Error(`File too large: ${file.name} (max 50MB)`)
              }

              // 이미지 파일만 허용
              if (!file.type.startsWith('image/')) {
                throw new Error(`Not an image: ${file.name}`)
              }

              // 고유한 파일명 생성
              const fileExt = file.name.split('.').pop()
              const timestamp = Date.now() + Math.random().toString(36).substring(2)
              const fileName = `${timestamp}.${fileExt}`
              const filePath = `${tourId}/${fileName}`

              // Supabase Storage에 업로드
              const { error: uploadError } = await supabase.storage
                .from('tour-photos')
                .upload(filePath, file, {
                  cacheControl: '3600',
                  upsert: false
                })

              if (uploadError) {
                throw uploadError
              }

              successCount++
            } catch (error) {
              console.error(`Failed to upload ${file.name}:`, error)
              failCount++
            } finally {
              setUploadProgress((prev) => ({ ...prev, current: prev.current + 1 }))
            }
          })
        )
      }

      // 업로드 완료 후 사진 목록 새로고침
      if (successCount > 0) {
        await loadPhotos()
        alert(
          language === 'ko' 
            ? `${successCount}개 파일 업로드 완료${failCount > 0 ? `, ${failCount}개 실패` : ''}`
            : `${successCount} files uploaded${failCount > 0 ? `, ${failCount} failed` : ''}`
        )
      } else {
        alert(language === 'ko' ? '업로드에 실패했습니다.' : 'Upload failed.')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(language === 'ko' ? '업로드 중 오류가 발생했습니다.' : 'An error occurred during upload.')
    } finally {
      setUploading(false)
      setUploadProgress({ current: 0, total: 0 })
      // 파일 input 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 파일 선택 버튼 클릭
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  if (!isOpen) return null

  return (
    <>
      {/* 메인 갤러리 */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* 헤더 - 2줄 레이아웃 */}
          <div className="p-3 border-b">
            {/* 첫 번째 줄: 제목과 뷰 모드 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  {t.title} ({photos.length})
                </h2>
                
                {/* 업로드 버튼 (고객용) - 제목줄에 배치 */}
                {allowUpload && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                    <button
                      onClick={handleUploadClick}
                      disabled={uploading}
                      className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                        uploading
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                      title={t.upload}
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          <span>{t.uploadingPhotos} ({uploadProgress.current}/{uploadProgress.total})</span>
                        </>
                      ) : (
                        <>
                          <Plus size={14} />
                          <span>{t.upload}</span>
                        </>
                      )}
                    </button>
                  </>
                )}
                
                {/* 뷰 모드 토글 */}
                <div className="flex border rounded">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    title={t.gridView}
                  >
                    <Grid3X3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    title={t.listView}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 두 번째줄: 기능 버튼들 */}
            <div className="flex items-center space-x-2">
              
              {/* 일괄 다운로드 모드 토글 */}
              <button
                onClick={() => {
                  setBulkDownloadMode(!bulkDownloadMode)
                  setHideRequestMode(false)
                  if (bulkDownloadMode) {
                    setSelectedPhotos(new Set())
                  }
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  bulkDownloadMode 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                >
                  {bulkDownloadMode ? t.done : t.select}
                </button>

              {/* 표시 중단 요청 모드 토글 (고객용만) */}
              {allowUpload && (
                <button
                  onClick={() => {
                    setHideRequestMode(!hideRequestMode)
                    setBulkDownloadMode(false)
                    if (hideRequestMode) {
                      setSelectedPhotos(new Set())
                    }
                  }}
                  className={`px-2 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                    hideRequestMode 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  >
                    <EyeOff className="w-3 h-3" />
                    {hideRequestMode ? t.done : t.hideRequest}
                  </button>
              )}

              {/* 선택 관리 (일괄 다운로드 모드 또는 표시 중단 모드에서 표시) */}
              {(bulkDownloadMode || hideRequestMode) && (
                <>
                  {/* 전체 선택/해제 버튼 */}
                  <button
                    onClick={handleSelectAll}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
                    >
                      {selectedPhotos.size === photos.length ? t.none : t.all}
                    </button>

                  {/* 선택된 사진 수 */}
                  <span className="text-xs text-gray-600 px-2">
                    {selectedPhotos.size} {t.selected}
                  </span>

                  {/* 다운로드 실행 버튼 (일괄 다운로드 모드) */}
                  {bulkDownloadMode && selectedPhotos.size > 0 && (
                    <button
                      onClick={handleBulkDownload}
                      disabled={downloading}
                      className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors disabled:opacity-50"
                      >
                        {downloading ? t.downloading : `${t.download}(${selectedPhotos.size})`}
                      </button>
                  )}

                  {/* 표시 중단 요청 버튼 (표시 중단 모드) */}
                  {hideRequestMode && selectedPhotos.size > 0 && (
                    <button
                      onClick={() => setShowCustomerSelector(true)}
                      disabled={hidingPhotos || loadingCustomers}
                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <EyeOff className="w-3 h-3" />
                        {t.requestHide} ({selectedPhotos.size})
                      </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 컨텐츠 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">{t.loading}</span>
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
                      if (bulkDownloadMode || hideRequestMode) {
                        handlePhotoSelect(photo.id)
                      } else {
                        openPhotoModal(photo, index)
                      }
                    }}
                  >
                    {/* 선택 체크박스 (일괄 다운로드 모드 또는 표시 중단 모드에서 표시) */}
                    {(bulkDownloadMode || hideRequestMode) && (
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
                        {/* 썸네일: 작은 크기로 표시 */}
                        <Image
                          src={photo.thumbnail_url || photo.file_url}
                          alt={photo.file_name}
                          width={200}
                          height={128}
                          className="w-full h-24 sm:h-28 md:h-32 object-cover rounded-lg hover:opacity-90 transition-opacity"
                          style={{ width: 'auto', height: 'auto' }}
                          loading="lazy"
                          quality={75}
                          unoptimized
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
                        {/* 리스트 뷰 썸네일: 작은 크기로 표시 */}
                        <Image
                          src={photo.thumbnail_url || photo.file_url}
                          alt={photo.file_name}
                          width={64}
                          height={64}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          style={{ width: 'auto', height: 'auto' }}
                          loading="lazy"
                          quality={75}
                          unoptimized
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

            {/* 메인 이미지 - 원본 사용 */}
            <Image
              src={selectedPhoto.file_url}
              alt={selectedPhoto.file_name}
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
              style={{ width: 'auto', height: 'auto' }}
              quality={100}
              priority
              unoptimized
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

      {/* 고객 선택 모달 (표시 중단 요청용) */}
      {showCustomerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {t.selectCustomer}
              </h3>
              <button
                onClick={() => setShowCustomerSelector(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {language === 'ko' ? '고객 정보를 불러올 수 없습니다.' : 'Unable to load customer information.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleHideRequest(customer.id, customer.name)}
                      disabled={hidingPhotos}
                      className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {hidingPhotos && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => setShowCustomerSelector(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다운로드 경고 모달 */}
      {showDownloadWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-yellow-600" />
                {t.downloadWarning}
              </h3>
              <button
                onClick={() => {
                  setShowDownloadWarning(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 whitespace-pre-line">
                  {t.downloadWarningContent}
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDownloadWarning(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t.downloadWarningCancel}
              </button>
              <button
                onClick={handleDownloadWarningConfirm}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                {t.downloadWarningConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 고객 선택 모달 (다운로드용) */}
      {showDownloadCustomerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {t.selectCustomer}
              </h3>
              <button
                onClick={() => {
                  setShowDownloadCustomerSelector(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {language === 'ko' ? '고객 정보를 불러올 수 없습니다.' : 'Unable to load customer information.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleDownloadWithCustomer(customer.id, customer.name)}
                      disabled={downloading}
                      className="w-full p-3 text-left border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {downloading && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowDownloadCustomerSelector(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 다운로드 경고 모달 */}
      {showDownloadWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Download className="w-5 h-5 text-yellow-600" />
                {t.downloadWarning}
              </h3>
              <button
                onClick={() => {
                  setShowDownloadWarning(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 whitespace-pre-line">
                  {t.downloadWarningContent}
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDownloadWarning(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t.downloadWarningCancel}
              </button>
              <button
                onClick={handleDownloadWarningConfirm}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                {t.downloadWarningConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 고객 선택 모달 (다운로드용) */}
      {showDownloadCustomerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {t.selectCustomer}
              </h3>
              <button
                onClick={() => {
                  setShowDownloadCustomerSelector(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {language === 'ko' ? '고객 정보를 불러올 수 없습니다.' : 'Unable to load customer information.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => handleDownloadWithCustomer(customer.id, customer.name)}
                      disabled={downloading}
                      className="w-full p-3 text-left border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {downloading && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowDownloadCustomerSelector(false)
                  setBulkDownloadMode(false)
                  setSelectedPhotos(new Set())
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
