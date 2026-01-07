'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Upload, X, Camera, Image as ImageIcon, Share2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { createTourPhotosBucket, checkTourPhotosBucket, checkTourFolderExists, createTourFolderMarker } from '@/lib/tourPhotoBucket'
import { useTourPhotoFolder } from '@/hooks/useTourPhotoFolder'
import { useAuth } from '@/contexts/AuthContext'
import { createThumbnail, getThumbnailFileName } from '@/lib/imageUtils'

interface TourPhoto {
  id: string
  file_name: string
  file_path: string
  thumbnail_path?: string | null
  file_size: number
  mime_type: string
  file_type?: string
  description?: string
  is_public: boolean
  share_token?: string
  created_at: string
  uploaded_by: string
  is_hidden?: boolean
  hide_requested_by?: string | null
  hide_requested_by_name?: string | null
}

interface TourPhotoUploadProps {
  tourId: string
  reservationId?: string
  uploadedBy: string
  onPhotosUpdated?: () => void
}

export default function TourPhotoUpload({ 
  tourId, 
  uploadedBy, 
  onPhotosUpdated 
}: TourPhotoUploadProps) {
  const { user, userRole, hasPermission } = useAuth()
  const t = useTranslations('tours.tourPhoto')
  const isAdmin = userRole === 'admin' || userRole === 'manager' || hasPermission('canViewAdmin')
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, batch: 0, totalBatches: 0 })
  const [selectedPhoto, setSelectedPhoto] = useState<TourPhoto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false)
  const [thumbnailProgress, setThumbnailProgress] = useState({ current: 0, total: 0 })
  
  // Hook으로 폴더 자동 관리
  const { folderStatus, isReady, retry } = useTourPhotoFolder(tourId)
  
  // Bucket 상태 관리
  const [bucketStatus, setBucketStatus] = useState<'checking' | 'exists' | 'missing' | 'error'>('checking')
  const [showBucketModal, setShowBucketModal] = useState(false)

  // 사진 목록 로드 (Storage 기반)
  const loadPhotos = useCallback(async () => {
    try {
      console.log('Loading photos for tour:', tourId)
      
      // 먼저 데이터베이스에서 썸네일 경로가 있는 사진 조회
      const { data: dbPhotos, error: dbError } = await supabase
        .from('tour_photos')
        .select('id, file_name, file_path, thumbnail_path, file_size, mime_type, created_at, uploaded_by')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: false })

      // 숨김 요청 정보 조회
      const { data: hideRequests, error: hideRequestsError } = await supabase
        .from('tour_photo_hide_requests')
        .select('file_name, customer_name, customer_id, is_hidden, requested_at')
        .eq('tour_id', tourId)
        .eq('is_hidden', true)

      // 숨김 요청 매핑 생성
      const hideRequestMap = new Map<string, { customer_name: string; customer_id: string; requested_at: string }>()
      if (hideRequests && !hideRequestsError) {
        hideRequests.forEach((req: any) => {
          if (req.file_name) {
            hideRequestMap.set(req.file_name, {
              customer_name: req.customer_name || 'Unknown',
              customer_id: req.customer_id || '',
              requested_at: req.requested_at || ''
            })
          }
        })
      }

      // Storage에서 투어별 폴더의 파일 목록 조회
      const { data: files, error } = await supabase.storage
        .from('tour-photos')
        .list(tourId, {
          sort: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        console.error('Error loading photos from storage:', error)
        // 폴더가 없는 경우 생성 후 빈 배열로 설정
        if (error.message.includes('not found') || error.message.includes('not exist')) {
          console.warn(`Storage folder for tour ${tourId} not found, creating folder...`)
          try {
            await checkTourFolderExists(tourId)
          } catch (folderError) {
            console.error('Error creating folder:', folderError)
          }
          setPhotos([])
          return
        }
        setPhotos([])
        return
      }
      
      // 실제 사진 파일만 필터링 (마커 파일 제외, 썸네일 제외)
      // 관리자가 아닌 경우 숨김된 사진 제외
      const photoFiles = files?.filter((file: { name: string }) => {
        const isPhotoFile = !file.name.includes('.folder_info.json') && 
          !file.name.includes('folder.info') &&
          !file.name.includes('.info') &&
          !file.name.includes('.README') &&
          !file.name.startsWith('.') &&
          !file.name.includes('_thumb') &&
          file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        
        if (!isPhotoFile) return false
        
        // 관리자가 아니면 숨김된 사진 제외
        if (!isAdmin) {
          const hideRequest = hideRequestMap.get(file.name)
          if (hideRequest) return false
        }
        
        return true
      }) || []

      // 썸네일 파일 찾기
      const thumbnailFiles = files?.filter((file: { name: string }) => 
        file.name.includes('_thumb') &&
        file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || []

      // 썸네일 매핑 생성 (Storage 기반)
      const thumbnailMap = new Map<string, string>()
      thumbnailFiles.forEach((thumbFile: { name: string }) => {
        const originalName = thumbFile.name.replace('_thumb', '')
        thumbnailMap.set(originalName, `${tourId}/${thumbFile.name}`)
      })

      // 데이터베이스 썸네일 매핑 생성
      const dbThumbnailMap = new Map<string, string>()
      if (dbPhotos && !dbError) {
        dbPhotos.forEach((photo: any) => {
          if (photo.thumbnail_path && photo.file_name) {
            dbThumbnailMap.set(photo.file_name, photo.thumbnail_path)
          }
        })
      }
      
      // Storage 파일을 TourPhoto 형식으로 변환
      const photos: TourPhoto[] = photoFiles.map((file: { id?: string; name: string; metadata?: { size?: number; mimetype?: string }; created_at?: string }) => {
        // 데이터베이스에서 썸네일 경로를 찾거나, Storage에서 찾기
        let thumbnailPath = dbThumbnailMap.get(file.name) || thumbnailMap.get(file.name) || null
        
        // 썸네일 경로가 상대 경로인 경우 전체 경로로 변환
        if (thumbnailPath && !thumbnailPath.includes('/')) {
          thumbnailPath = `${tourId}/${thumbnailPath}`
        }
        
        // 디버깅: 첫 번째 사진만 로그
        if (photoFiles.indexOf(file) === 0) {
          console.log('[TourPhotoUpload] Photo thumbnail mapping:', {
            fileName: file.name,
            dbThumbnail: dbThumbnailMap.get(file.name),
            storageThumbnail: thumbnailMap.get(file.name),
            finalThumbnail: thumbnailPath,
            thumbnailFilesCount: thumbnailFiles.length,
            dbPhotosCount: dbPhotos?.length || 0
          })
        }
        
        // 숨김 요청 정보 가져오기
        const hideRequest = hideRequestMap.get(file.name)
        
        return {
          id: file.id || file.name,
          file_name: file.name,
          file_path: `${tourId}/${file.name}`,
          thumbnail_path: thumbnailPath,
          file_size: file.metadata?.size || 0,
          mime_type: file.metadata?.mimetype || 'image/jpeg',
          file_type: file.metadata?.mimetype || 'image/jpeg',
          description: undefined,
          is_public: true,
          share_token: undefined,
          created_at: file.created_at || new Date().toISOString(),
          uploaded_by: uploadedBy,
          is_hidden: !!hideRequest,
          hide_requested_by: hideRequest?.customer_id || null,
          hide_requested_by_name: hideRequest?.customer_name || null
        }
      })
      
      console.log('[TourPhotoUpload] Loaded photos:', {
        total: photos.length,
        withThumbnails: photos.filter(p => p.thumbnail_path).length,
        withoutThumbnails: photos.filter(p => !p.thumbnail_path).length,
        hidden: photos.filter(p => p.is_hidden).length
      })
      setPhotos(photos)
    } catch (error) {
      console.error('Error loading photos:', error)
      setPhotos([])
    }
  }, [tourId, uploadedBy, isAdmin])

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

  /* 투어별 폴더 생성 함수 (개선된 자동 생성) - 현재 사용하지 않음
  const createTourFolder = async () => {
    try {
      console.log(`🔨 Creating tour folder for: ${tourId}`)
      
      // 1단계: 폴더 존재 확인
      const folderExists = await checkTourFolderExists(tourId)
      if (folderExists) {
        console.log(`✅ Tour folder ${tourId} already exists`)
        return true
      }
      
      // 2단계: 마커 파일 생성으로 폴더 생성
      const folderInfo = JSON.stringify({
        tourId: tourId,
        createdAt: new Date().toISOString(),
        folderType: 'tour-photos',
        notes: `Auto-created folder for tour ${tourId}`,
        version: '1.0'
      }, null, 2)
      
      const markerFileName = `${tourId}/.folder_info.json`
      
      const { error, data } = await supabase.storage
        .from('tour-photos')
        .upload(markerFileName, new Blob([folderInfo], { type: 'application/json' }), {
          upsert: true,
          cacheControl: '3600'
        })
      
      if (error) {
        console.error('❌ Error creating tour folder:', error)
        return false
      }
      
      console.log(`📁 Tour folder ${tourId} created successfully:`, data?.path)
      
      // 3단계: 폴더 생성 확인
      const verifyFolder = await checkTourFolderExists(tourId)
      if (verifyFolder) {
        console.log(`✅ Folder verification successful for tour: ${tourId}`)
        return true
      } else {
        console.warn(`⚠️ Folder creation verification failed for tour: ${tourId}`)
        return false
      }
      
    } catch (error) {
      console.error('💥 Unexpected error creating tour folder:', error)
      return false
    }
  } */

  // 폴더 존재 여부 확인 및 생성 (개선된 버전)
  const ensureTourFolderExists = async () => {
    try {
      // 새로운 함수로 폴더 존재 여부 확인
      const folderExists = await checkTourFolderExists(tourId)
      
      if (!folderExists) {
        console.log(`📁 Creating folder for tour: ${tourId}`)
        await createTourFolderMarker(tourId)
      } else {
        console.log(`✅ Folder exists for tour: ${tourId}`)
      }
    } catch (error) {
      console.error('Error ensuring tour folder exists:', error)
      // 오류가 발생해도 폴더 생성 시도
      await createTourFolderMarker(tourId)
    }
  }

  // Bucket 상태 체크 함수 (개선된 버전)
  const checkBucketStatus = async () => {
    try {
      setBucketStatus('checking')
      
      // 1단계: 전체 tour-photos bucket 확인
      const bucketExists = await checkTourPhotosBucket()
      if (!bucketExists) {
        console.warn('⚠️ tour-photos bucket not found')
        console.warn('🔧 Please run quick_bucket_setup.sql in Supabase SQL Editor')
        setBucketStatus('missing')
        return
      }
      
      // 2단계: 투어별 폴더 확인 및 생성
      const folderExists = await checkTourFolderExists(tourId)
      if (!folderExists) {
        console.log(`📁 Creating folder for tour: ${tourId}`)
        await ensureTourFolderExists()
      }
      
      // 3단계: bucket과 폴더 모두 존재하면 성공
      console.log(`✅ Bucket and folder ready for tour: ${tourId}`)
      setBucketStatus('exists')
      await loadPhotos()
      
    } catch (error) {
      console.error('Error checking bucket status:', error)
      setBucketStatus('error')
    }
  }

  // Hook과 bucket 상태 연동
  useEffect(() => {
    const checkStatusAndLoadPhotos = async () => {
      if (isReady) {
        setBucketStatus('exists')
        await loadPhotos()
      } else if (folderStatus === 'error') {
        setBucketStatus('error')
      } else if (folderStatus === 'creating') {
        setBucketStatus('checking')
      }
    }
    
    checkStatusAndLoadPhotos()
  }, [isReady, folderStatus, tourId, loadPhotos])

  // 사진 업로드
  const handleFileUpload = async (files: FileList | null) => {
    console.log('handleFileUpload called with:', files)
    console.log('Files type:', typeof files)
    console.log('Files is null?', files === null)
    console.log('Files length:', files?.length)
    
    // 파일이 없거나 길이가 0이면 종료
    if (!files || !files.length || files.length === 0) {
      console.warn('No files selected or files array is empty')
      console.warn('Files object:', files)
      alert('파일이 선택되지 않았습니다. 다시 시도해주세요.')
      return
    }

    // FileList를 즉시 배열로 변환 (FileList는 라이브 객체이므로 조기에 변환 필요)
    // input의 value가 초기화되면 FileList도 비어질 수 있음
    const fileArray = Array.from(files)
    console.log('FileList를 배열로 변환:', fileArray.length, '개 파일')
    console.log('Starting file upload for files:', fileArray.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    })))
    console.log('Files count:', fileArray.length)
    
    // 파일이 실제로 없는 경우 체크
    if (fileArray.length === 0) {
      console.warn('FileArray is empty after conversion')
      alert('파일이 선택되지 않았습니다. 다시 시도해주세요.')
      return
    }
    
    // Storage 버킷 확인 (디버깅용)
    await ensureStorageBucket()
    
    setUploading(true)
    
    // 파일 개수 제한 체크 (최대 500개)
    if (fileArray.length > 500) {
      alert('한번에 최대 500개의 파일만 업로드할 수 있습니다.')
      setUploading(false)
      return
    }

    console.log(`총 ${fileArray.length}개 파일 업로드 시작`)

    // 대량 파일 처리를 위한 배치 업로드 (한번에 500개씩으로 조정)
    const batchSize = 500
    const batches = []
    
    for (let i = 0; i < fileArray.length; i += batchSize) {
      batches.push(fileArray.slice(i, i + batchSize))
    }

    console.log(`${batches.length}개 배치로 나누어 업로드 (배치당 ${batchSize}개)`)
    
    // 업로드 진행 상황 초기화
    setUploadProgress({ current: 0, total: fileArray.length, batch: 0, totalBatches: batches.length })


    try {
      let totalSuccessful = 0
      let totalFailed = 0
      const failedFiles: string[] = []
      
      // 배치별로 순차 업로드
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`배치 ${batchIndex + 1}/${batches.length} 업로드 중... (${batch.length}개 파일)`)
        
        // 진행 상황 업데이트
        setUploadProgress((prev: { current: number; total: number; batch: number; totalBatches: number }) => ({ 
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
            const filePath = `${tourId}/${fileName}` // 투어별 폴더 구조

            console.log(`Uploading to storage: ${filePath}`)

            // Supabase Storage에 원본 업로드
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

            // 썸네일 생성 및 업로드
            let thumbnailPath: string | null = null
            try {
              console.log('Creating thumbnail for:', file.name)
              const thumbnailBlob = await createThumbnail(file, 400, 400, 0.8)
              const thumbnailFileName = getThumbnailFileName(fileName)
              thumbnailPath = `${tourId}/${thumbnailFileName}`
              
              const thumbnailFile = new File([thumbnailBlob], thumbnailFileName, { type: 'image/jpeg' })
              
              const { error: thumbnailUploadError } = await supabase.storage
                .from('tour-photos')
                .upload(thumbnailPath, thumbnailFile, {
                  cacheControl: '3600',
                  upsert: false
                })

              if (thumbnailUploadError) {
                console.warn('Thumbnail upload error (continuing anyway):', thumbnailUploadError)
                // 썸네일 업로드 실패해도 계속 진행
              } else {
                console.log('Thumbnail uploaded successfully:', thumbnailPath)
              }
            } catch (thumbnailError) {
              console.warn('Thumbnail creation error (continuing anyway):', thumbnailError)
              // 썸네일 생성 실패해도 계속 진행
            }

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
                mime_type: file.type,
                uploaded_by: user?.id,
                share_token: shareToken,
                thumbnail_path: thumbnailPath // 썸네일 경로 저장
              })
              .select()
              .single()

            if (dbError) {
              console.error('Database insert error:', dbError)
              // Storage에서 파일 삭제
              await supabase.storage.from('tour-photos').remove([uploadData.path])
              if (thumbnailPath) {
                await supabase.storage.from('tour-photos').remove([thumbnailPath])
              }
              throw dbError
            }

            console.log(`Successfully uploaded ${file.name}`)
            return photoData
          } catch (error) {
            console.error(`Error uploading ${file.name}:`, error)
            failedFiles.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
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
        setUploadProgress((prev: { current: number; total: number; batch: number; totalBatches: number }) => ({ 
          ...prev, 
          current: Math.min((batchIndex + 1) * batchSize, fileArray.length)
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
      alert(`❌ 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setUploading(false)
    }
  }

  // 기존 사진들에 대한 썸네일 생성
  const generateThumbnailsForExistingPhotos = async () => {
    try {
      setGeneratingThumbnails(true)
      setThumbnailProgress({ current: 0, total: 0 })

      // Storage에서 모든 파일 목록 가져오기
      const { data: files, error } = await supabase.storage
        .from('tour-photos')
        .list(tourId, {
          sort: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        throw error
      }

      // 원본 사진 파일만 필터링 (썸네일 제외)
      const originalPhotos = files?.filter((file: { name: string }) => 
        !file.name.includes('.folder_info.json') && 
        !file.name.includes('folder.info') &&
        !file.name.includes('.info') &&
        !file.name.includes('.README') &&
        !file.name.startsWith('.') &&
        !file.name.includes('_thumb') && // 썸네일 제외
        file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ) || []

      // 썸네일이 있는지 확인
      const thumbnailFiles = files?.filter((file: { name: string }) => 
        file.name.includes('_thumb')
      ) || []

      const thumbnailMap = new Set(thumbnailFiles.map((f: { name: string }) => 
        f.name.replace('_thumb', '')
      ))

      // 썸네일이 없는 사진들만 필터링
      const photosWithoutThumbnails = originalPhotos.filter((file: { name: string }) => 
        !thumbnailMap.has(file.name)
      )

      if (photosWithoutThumbnails.length === 0) {
        alert('모든 사진에 썸네일이 이미 생성되어 있습니다.')
        return
      }

      setThumbnailProgress({ current: 0, total: photosWithoutThumbnails.length })

      let successCount = 0
      let failCount = 0

      // 각 사진에 대해 썸네일 생성
      for (let i = 0; i < photosWithoutThumbnails.length; i++) {
        const file = photosWithoutThumbnails[i]
        const filePath = `${tourId}/${file.name}`

        try {
          setThumbnailProgress({ current: i + 1, total: photosWithoutThumbnails.length })

          // 원본 이미지 다운로드
          const { data: imageData, error: downloadError } = await supabase.storage
            .from('tour-photos')
            .download(filePath)

          if (downloadError) {
            throw downloadError
          }

          // File 객체로 변환
          const fileBlob = new File([imageData], file.name, { 
            type: file.metadata?.mimetype || 'image/jpeg' 
          })

          // 썸네일 생성
          const thumbnailBlob = await createThumbnail(fileBlob, 400, 400, 0.8)
          const thumbnailFileName = getThumbnailFileName(file.name)
          const thumbnailPath = `${tourId}/${thumbnailFileName}`
          
          const thumbnailFile = new File([thumbnailBlob], thumbnailFileName, { type: 'image/jpeg' })
          
          // 썸네일 업로드
          const { error: thumbnailUploadError } = await supabase.storage
            .from('tour-photos')
            .upload(thumbnailPath, thumbnailFile, {
              cacheControl: '3600',
              upsert: false
            })

          if (thumbnailUploadError) {
            throw thumbnailUploadError
          }

          // 데이터베이스에서 해당 사진 찾기 및 업데이트
          const { data: photoRecords, error: queryError } = await supabase
            .from('tour_photos')
            .select('id')
            .eq('file_path', filePath)

          if (!queryError && photoRecords && photoRecords.length > 0) {
            // 데이터베이스 업데이트
            for (const record of photoRecords) {
              await supabase
                .from('tour_photos')
                .update({ thumbnail_path: thumbnailPath })
                .eq('id', record.id)
            }
          }

          successCount++
        } catch (error) {
          console.error(`Error generating thumbnail for ${file.name}:`, error)
          failCount++
        }
      }

      // 사진 목록 새로고침
      await loadPhotos()
      onPhotosUpdated?.()

      if (successCount > 0) {
        alert(`✅ 썸네일 생성 완료: ${successCount}개 성공${failCount > 0 ? `, ${failCount}개 실패` : ''}`)
      } else {
        alert(`❌ 썸네일 생성에 실패했습니다. (${failCount}개 파일)`)
      }
    } catch (error) {
      console.error('Error generating thumbnails:', error)
      alert(`❌ 썸네일 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setGeneratingThumbnails(false)
      setThumbnailProgress({ current: 0, total: 0 })
    }
  }

  // 숨김 철회 (관리자만)
  const handleUnhidePhoto = async (photo: TourPhoto) => {
    if (!isAdmin) return
    
    if (!confirm(`이 사진의 숨김을 철회하시겠습니까?\n\n파일: ${photo.file_name}\n요청자: ${photo.hide_requested_by_name || 'Unknown'}`)) {
      return
    }

    try {
      // tour_photo_hide_requests 테이블에서 is_hidden을 false로 업데이트
      const { error: updateError } = await supabase
        .from('tour_photo_hide_requests')
        .update({ is_hidden: false })
        .eq('tour_id', tourId)
        .eq('file_name', photo.file_name)
        .eq('is_hidden', true)

      if (updateError) {
        throw updateError
      }

      // 사진 목록 새로고침
      await loadPhotos()
      onPhotosUpdated?.()
      
      alert('숨김이 철회되었습니다.')
    } catch (error) {
      console.error('Error unhiding photo:', error)
      alert('숨김 철회 중 오류가 발생했습니다.')
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
  const copyShareLink = (shareToken?: string) => {
    // share_token이 없으면 tour_id 사용
    const token = shareToken || tourId
    // 환경 변수가 있으면 사용하고, 없으면 현재 origin 사용 (배포 환경에서는 자동으로 올바른 도메인 사용)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    // 로케일 없는 경로 사용
    const shareUrl = `${baseUrl}/photos/${token}`
    navigator.clipboard.writeText(shareUrl)
    alert(t('shareLinkCopied'))
  }

  // 새창에서 미리보기 열기
  const openPhotoInNewWindow = (photo: TourPhoto) => {
    // share_token이 없으면 tour_id 사용
    const token = photo.share_token || tourId
    // 환경 변수가 있으면 사용하고, 없으면 현재 origin 사용
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    // 로케일 없는 경로 사용
    const shareUrl = `${baseUrl}/photos/${token}`
    window.open(shareUrl, '_blank')
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

    const currentIndex = photos.findIndex((p: TourPhoto) => p.id === selectedPhoto.id)
    
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
    if (files && files.length > 0) {
      console.log('Files dropped:', files.length)
      handleFileUpload(files)
    } else {
      console.log('No files in drop event')
    }
  }

  return (
    <div className={bucketStatus === 'missing' ? 'bg-red-50 rounded-lg p-6 space-y-4' : 'space-y-4'}>
      {/* Bucket 상태 표시 */}
      {bucketStatus === 'missing' && (
        <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">Storage Bucket Missing</h3>
              <p className="text-sm text-yellow-700 mt-1">tour-photos storage bucket이 생성되지 않았습니다.</p>
            </div>
            <button
              onClick={() => setShowBucketModal(true)}
              className="bg-yellow-600 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-700 transition-colors"
            >
              설정 안내
            </button>
          </div>
        </div>
      )}
      
      {bucketStatus === 'checking' && (
        <div className="flex items-center space-x-3 p-4 bg-gray-100 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-700">Storage bucket 상태 확인 중...</span>
        </div>
      )}
      
      {bucketStatus === 'error' && (
        <div className="bg-red-100 border border-red-400 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Storage 접근 오류</h3>
              <p className="text-sm text-red-700">Storage bucket 상태를 확인할 수 없습니다.</p>
            </div>
            <button
              onClick={retry}
              className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
        <div className="flex space-x-2">
          {photos.length > 0 && (
            <button
              onClick={generateThumbnailsForExistingPhotos}
              disabled={generatingThumbnails}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="기존 사진들에 대한 썸네일 생성"
            >
              {generatingThumbnails ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  썸네일 생성 중...
                </>
              ) : (
                '기존 사진 썸네일 생성'
              )}
            </button>
          )}
          {/* 투어 전체 사진 공유 링크 */}
          {photos.length > 0 && (
            <button
              onClick={() => {
                // 환경 변수가 있으면 사용하고, 없으면 현재 origin 사용 (배포 환경에서는 자동으로 올바른 도메인 사용)
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
                // 로케일 없는 경로 사용
                const shareUrl = `${baseUrl}/photos/${tourId}`
                navigator.clipboard.writeText(shareUrl)
                alert('투어 전체 사진 공유 링크가 클립보드에 복사되었습니다.')
              }}
              className="flex items-center justify-center px-3 h-10 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              title="투어 전체 사진 공유 링크 복사"
            >
              <Share2 size={16} className="mr-1" />
              전체 공유
            </button>
          )}
          
          {/* 갤러리에서 선택 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || bucketStatus !== 'exists'}
            className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            title={
              bucketStatus !== 'exists' 
                ? 'Storage bucket이 생성되지 않았습니다' 
                : uploading ? t('uploading') : t('selectFromGallery')
            }
          >
            <ImageIcon size={20} />
          </button>
          
          {/* 카메라로 직접 촬영 */}
          <button
            onClick={() => {
              console.log('Camera button clicked')
              console.log('Camera input ref:', cameraInputRef.current)
              if (cameraInputRef.current) {
                console.log('Triggering camera input click')
                cameraInputRef.current.click()
              } else {
                console.error('Camera input ref is null')
              }
            }}
            disabled={uploading || bucketStatus !== 'exists'}
            className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            title={
              bucketStatus !== 'exists' 
                ? 'Storage bucket이 생성되지 않았습니다' 
                : t('takePhoto')
            }
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors ${
          bucketStatus !== 'exists'
            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
            : dragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={bucketStatus === 'exists' ? handleDragOver : undefined}
        onDragLeave={bucketStatus === 'exists' ? handleDragLeave : undefined}
        onDrop={bucketStatus === 'exists' ? handleDrop : undefined}
        onClick={bucketStatus === 'exists' ? () => fileInputRef.current?.click() : undefined}
      >
        <Upload size={32} className="mx-auto text-gray-400 mb-2 sm:mb-4" />
        <p className="text-gray-600 mb-1 sm:mb-2 text-sm sm:text-base">
          {bucketStatus !== 'exists' 
            ? 'Storage bucket이 생성되지 않았습니다' 
            : t('dragOrClick')
          }
        </p>
        <p className="text-xs sm:text-sm text-gray-500">
          {bucketStatus !== 'exists' 
            ? '위의 \"설정 안내\" 버튼을 눌러 bucket을 생성해주세요' 
            : t('fileFormats')
          }
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,image/jpeg,image/jpg,image/png,image/webp"
          onChange={(e) => {
            const target = e.target as HTMLInputElement
            if (target.files && target.files.length > 0) {
              console.log('File input files selected:', target.files.length)
              handleFileUpload(target.files)
            } else {
              console.log('No files selected from file input')
            }
            // input 값 초기화 (같은 파일 다시 선택 가능하도록)
            target.value = ''
          }}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture={typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'environment' : undefined}
          onChange={(e) => {
            const target = e.target as HTMLInputElement
            console.log('Camera input onChange triggered')
            console.log('Files:', target.files)
            console.log('Files length:', target.files?.length)
            
            if (target.files && target.files.length > 0) {
              console.log('Camera input files selected:', target.files.length)
              console.log('File details:', {
                name: target.files[0].name,
                size: target.files[0].size,
                type: target.files[0].type
              })
              
              // FileList를 그대로 전달
              const fileList = target.files
              handleFileUpload(fileList)
            } else {
              console.log('No files selected from camera input - user may have cancelled')
            }
            
            // input 값 초기화는 약간의 지연 후에 (업로드가 시작된 후)
            setTimeout(() => {
              if (target) {
                target.value = ''
              }
            }, 100)
          }}
          onClick={(e) => {
            console.log('Camera input clicked')
            // 클릭 이벤트도 로깅
          }}
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
                <Image
                  src={(() => {
                    // 썸네일 경로가 있으면 썸네일 사용, 없으면 원본 사용
                    const imagePath = photo.thumbnail_path || photo.file_path
                    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${imagePath}`
                    // 디버깅: 첫 번째 사진만 로그
                    if (photos.indexOf(photo) === 0) {
                      console.log('[TourPhotoUpload] Photo thumbnail check:', {
                        fileName: photo.file_name,
                        thumbnailPath: photo.thumbnail_path,
                        filePath: photo.file_path,
                        usingThumbnail: !!photo.thumbnail_path,
                        imagePath,
                        imageUrl
                      })
                    }
                    return imageUrl
                  })()}
                  alt={photo.file_name}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                  style={{ width: 'auto', height: 'auto' }}
                />
              </div>
              
              {/* 오버레이 */}
              <div 
                className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center pointer-events-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="opacity-0 group-hover:opacity-100 flex space-x-2 pointer-events-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      copyShareLink(photo.share_token)
                    }}
                    className="p-2 bg-white rounded-full hover:bg-gray-100"
                    title={t('copyShareLink')}
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openPhotoInNewWindow(photo)
                    }}
                    className="p-2 bg-white rounded-full hover:bg-gray-100"
                    title={t('viewInNewWindow')}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePhoto(photo.id, photo.file_path)
                    }}
                    className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                    title={t('delete')}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* 숨김 상태 표시 (관리자만, 클릭 가능) */}
              {isAdmin && photo.is_hidden && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUnhidePhoto(photo)
                  }}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium z-10 cursor-pointer transition-colors"
                  title="클릭하여 숨김 철회"
                >
                  숨김
                </button>
              )}

              {/* 파일 정보 */}
              <div className="mt-2 text-xs text-gray-600">
                <p className="truncate">{photo.file_name}</p>
                <p>{formatFileSize(photo.file_size)}</p>
                <p>{new Date(photo.created_at).toLocaleString()}</p>
                {/* 숨김 요청자 정보 (관리자만) */}
                {isAdmin && photo.is_hidden && photo.hide_requested_by_name && (
                  <p className="text-red-600 font-medium mt-1">
                    숨김 요청: {photo.hide_requested_by_name}
                  </p>
                )}
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

      {generatingThumbnails && (
        <div className="text-center py-8 text-gray-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p>썸네일 생성 중...</p>
          
          {/* 썸네일 생성 진행 상황 */}
          {thumbnailProgress.total > 0 && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{thumbnailProgress.current}/{thumbnailProgress.total} 사진</span>
                <span>{Math.round((thumbnailProgress.current / thumbnailProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(thumbnailProgress.current / thumbnailProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Math.round((thumbnailProgress.current / thumbnailProgress.total) * 100)}% 완료
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
            {photos.findIndex((p: TourPhoto) => p.id === selectedPhoto.id) > 0 && (
              <button
                onClick={() => {
                  const currentIndex = photos.findIndex((p: TourPhoto) => p.id === selectedPhoto.id)
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
            {photos.findIndex((p: TourPhoto) => p.id === selectedPhoto.id) < photos.length - 1 && (
              <button
                onClick={() => {
                  const currentIndex = photos.findIndex((p: TourPhoto) => p.id === selectedPhoto.id)
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
              <Image
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${selectedPhoto.file_path}`}
                alt={selectedPhoto.file_name}
                width={1200}
                height={800}
                className="max-w-full max-h-full object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>

            {/* 이미지 정보 */}
            <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{selectedPhoto.file_name}</h3>
                  <p className="text-sm text-gray-300">
                    {formatFileSize(selectedPhoto.file_size)} • {selectedPhoto.file_type || selectedPhoto.mime_type}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyShareLink(selectedPhoto.share_token)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    공유 링크 복사
                  </button>
                  <button
                    onClick={() => openPhotoInNewWindow(selectedPhoto)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    새창에서 보기
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
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => setSelectedPhoto(photo)}
                      className={`w-12 h-12 rounded overflow-hidden ${
                        photo.id === selectedPhoto.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <Image
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${photo.file_path}`}
                        alt={photo.file_name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        style={{ width: 'auto', height: 'auto' }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Bucket 설정 안내 모달 */}
      {showBucketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Storage Bucket 설정 안내</h2>
                <button
                  onClick={() => setShowBucketModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2">⚠️ Storage Bucket이 생성되지 않았습니다</h3>
                  <p className="text-yellow-700">
                    투어 사진을 저장하기 위한 Storage bucket이 필요합니다. 
                    아래 단계를 따라 Supabase SQL Editor에서 수동으로 생성해주세요.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">설정 단계:</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>1. <strong>Supabase 대시보드</strong> → <strong>SQL Editor</strong> 탭으로 이동</p>
                    <p>2. 아래 SQL 코드를 복사해서 붙여넣기</p>
                    <p>3. <strong>Run</strong> 버튼 클릭하여 실행</p>
                    <p>4. 이 페이지를 새로고침</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">실행할 SQL 코드:</h4>
                  <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs overflow-x-auto">
{`-- Step 1: Clean existing conflicting policies
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;

-- Step 2: Create bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Step 3: Create essential policies only
CREATE POLICY "Allow authenticated users to upload tour photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tour-photos');

CREATE POLICY "Allow public access to tour photos" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

-- Step 4: Verify setup
SELECT 'tour-photos bucket created successfully!' as status;`}
                  </pre>
                </div>
                
                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={checkBucketStatus}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    설정 완료 후 확인
                  </button>
                  <button
                    onClick={() => setShowBucketModal(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
