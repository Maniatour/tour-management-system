'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Camera, Image as ImageIcon, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslations } from 'next-intl'
import { createTourPhotosBucket, checkTourPhotosBucket, checkTourFolderExists, createTourFolderMarker, listAllTourStorageFiles } from '@/lib/tourPhotoBucket'
import { useTourPhotoFolder } from '@/hooks/useTourPhotoFolder'
import { useAuth } from '@/contexts/AuthContext'
import { runTourPhotoUploadQueue } from '@/lib/runTourPhotoUploadQueue'
import {
  endTourPhotoUploadSession,
  startTourPhotoPrepare,
} from '@/lib/tourPhotoUploadSession'
import {
  isTourStorageMediaFileName,
  TOUR_PHOTO_FILE_ACCEPT,
  tourMediaFileStem,
} from '@/lib/tourPhotoUploadUtils'
import { useTourDetailSectionChrome } from '@/components/tour/TourDetailModalChromeContext'
import { TourPhotoMediaThumb, TourPhotoMediaViewer } from '@/components/tour/TourPhotoMedia'

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
  uploaded_by_name?: string | null
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
  const chrome = useTourDetailSectionChrome()
  const isAdmin = userRole === 'admin' || userRole === 'manager' || hasPermission('canViewAdmin')
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<TourPhoto | null>(null)
  const [showModal, setShowModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
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
        .select('id, file_name, file_path, thumbnail_path, file_size, mime_type, created_at, uploaded_by, share_token')
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

      // Storage에서 투어별 폴더의 파일 목록 조회 (기본 100개 한도 없이 전체)
      let files: Awaited<ReturnType<typeof listAllTourStorageFiles>> = []
      try {
        files = await listAllTourStorageFiles(tourId)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error('Error loading photos from storage:', error)
        if (message.includes('not found') || message.includes('not exist')) {
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
      
      // 실제 사진·영상 파일만 필터링 (마커 파일 제외, 썸네일 제외)
      // 관리자가 아닌 경우 숨김된 사진 제외
      const photoFiles = files.filter((file) => {
        if (!isTourStorageMediaFileName(file.name)) return false
        
        // 관리자가 아니면 숨김된 사진 제외
        if (!isAdmin) {
          const hideRequest = hideRequestMap.get(file.name)
          if (hideRequest) return false
        }
        
        return true
      })

      // 썸네일 파일 찾기
      const thumbnailFiles = files.filter((file) => 
        file.name.includes('_thumb')
      )

      // 썸네일 매핑 생성 (Storage 기반 — 확장자가 달라도 stem으로 연결)
      const thumbnailMap = new Map<string, string>()
      thumbnailFiles.forEach((thumbFile) => {
        thumbnailMap.set(tourMediaFileStem(thumbFile.name), `${tourId}/${thumbFile.name}`)
      })

      // 데이터베이스 행 매핑: file_name -> { id, uploaded_by, share_token, thumbnail_path, created_at }
      const dbPhotoByFileName = new Map<string, { id: string; uploaded_by: string; share_token?: string; thumbnail_path?: string; created_at?: string }>()
      const dbThumbnailMap = new Map<string, string>()
      if (dbPhotos && !dbError) {
        dbPhotos.forEach((photo: any) => {
          const rowData = {
            id: photo.id,
            uploaded_by: photo.uploaded_by || '',
            share_token: photo.share_token,
            thumbnail_path: photo.thumbnail_path,
            created_at: photo.created_at
          }
          // Storage 객체 이름은 file_path 마지막 세그먼트와 같고, DB file_name은 업로드 시 원본 파일명일 수 있음 → 둘 다 키로 등록
          const keys = new Set<string>()
          if (photo.file_name) keys.add(photo.file_name)
          if (typeof photo.file_path === 'string' && photo.file_path.length > 0) {
            const base = photo.file_path.split('/').filter(Boolean).pop()
            if (base) keys.add(base)
          }
          keys.forEach((k) => dbPhotoByFileName.set(k, rowData))
          if (photo.thumbnail_path && photo.file_name) {
            dbThumbnailMap.set(photo.file_name, photo.thumbnail_path)
          }
        })
      }

      // 업로더 이메일 목록 수집 (team 조회 — 표시는 nick_name 우선)
      const rawUploaderEmails = Array.from(dbPhotoByFileName.values())
        .map((p) => p.uploaded_by)
        .filter((v): v is string => typeof v === 'string' && v.includes('@'))
      const uploaderEmails = Array.from(
        new Set(
          rawUploaderEmails.flatMap((e) => {
            const t = e.trim()
            return t ? [t, t.toLowerCase()] : []
          })
        )
      )
      const teamMap = new Map<string, string>()
      if (uploaderEmails.length > 0) {
        const { data: teamRows } = await supabase
          .from('team')
          .select('email, display_name, nick_name, name_ko, name_en')
          .in('email', uploaderEmails)
        ;(teamRows || []).forEach((row: {
          email: string
          display_name?: string | null
          nick_name?: string | null
          name_ko?: string | null
          name_en?: string | null
        }) => {
          const nn = row.nick_name?.trim()
          const dn = row.display_name?.trim()
          const ko = row.name_ko?.trim()
          const en = row.name_en?.trim()
          const name =
            (nn && nn.length > 0 ? nn : null) ||
            (dn && dn.length > 0 ? dn : null) ||
            (ko && ko.length > 0 ? ko : null) ||
            (en && en.length > 0 ? en : null) ||
            row.email
          teamMap.set(row.email, name)
          teamMap.set(row.email.trim().toLowerCase(), name)
        })
      }
      
      // Storage 파일을 TourPhoto 형식으로 변환
      const photos: TourPhoto[] = photoFiles.map((file) => {
        const dbRow = dbPhotoByFileName.get(file.name)
        // 데이터베이스에서 썸네일 경로를 찾거나, Storage에서 찾기
        let thumbnailPath = (dbRow?.thumbnail_path
          ? (dbRow.thumbnail_path.includes('/') ? dbRow.thumbnail_path : `${tourId}/${dbRow.thumbnail_path}`)
          : null) || thumbnailMap.get(tourMediaFileStem(file.name)) || thumbnailMap.get(file.name) || null
        if (thumbnailPath && !thumbnailPath.includes('/')) {
          thumbnailPath = `${tourId}/${thumbnailPath}`
        }
        
        // DB에 tour_photos 행이 없을 때 현재 로그인 이메일(uploadedBy)로 대체하면 관리자 화면에서 잘못 표시됨 — Storage만 있는 레거시 파일은 업로더 미표시
        const photoUploadedBy = (dbRow?.uploaded_by ?? '').trim()
        const emailLookup =
          photoUploadedBy && photoUploadedBy.includes('@')
            ? teamMap.get(photoUploadedBy) || teamMap.get(photoUploadedBy.toLowerCase())
            : undefined
        const uploadedByName =
          photoUploadedBy && photoUploadedBy.includes('@')
            ? emailLookup || photoUploadedBy
            : photoUploadedBy
              ? t('unknownUploader')
              : null
        
        // 디버깅: 첫 번째 사진만 로그
        if (photoFiles.indexOf(file) === 0) {
          console.log('[TourPhotoUpload] Photo thumbnail mapping:', {
            fileName: file.name,
            dbThumbnail: dbRow?.thumbnail_path,
            storageThumbnail: thumbnailMap.get(file.name),
            finalThumbnail: thumbnailPath,
            thumbnailFilesCount: thumbnailFiles.length,
            dbPhotosCount: dbPhotos?.length || 0
          })
        }
        
        // 숨김 요청 정보 가져오기
        const hideRequest = hideRequestMap.get(file.name)
        
        return {
          id: dbRow?.id || file.id || file.name,
          file_name: file.name,
          file_path: `${tourId}/${file.name}`,
          thumbnail_path: thumbnailPath,
          file_size: file.metadata?.size || 0,
          mime_type: file.metadata?.mimetype || 'image/jpeg',
          file_type: file.metadata?.mimetype || 'image/jpeg',
          is_public: true,
          ...(dbRow?.share_token != null ? { share_token: dbRow.share_token } : {}),
          created_at: dbRow?.created_at || file.created_at || new Date().toISOString(),
          uploaded_by: photoUploadedBy,
          ...(uploadedByName ? { uploaded_by_name: uploadedByName } : {}),
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
  }, [tourId, isAdmin])

  const onPhotosUpdatedRef = useRef(onPhotosUpdated)
  onPhotosUpdatedRef.current = onPhotosUpdated

  useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent<{ tourId: string }>).detail
      if (d?.tourId !== tourId) return
      void loadPhotos().then(() => {
        onPhotosUpdatedRef.current?.()
      })
    }
    window.addEventListener('tour-photo-upload-finished', handler)
    return () => window.removeEventListener('tour-photo-upload-finished', handler)
  }, [tourId, loadPhotos])

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
      alert(t('noFilesSelected'))
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
      alert(t('noFilesSelected'))
      return
    }
    
    if (fileArray.length > 500) {
      alert(t('maxFilesExceeded'))
      return
    }

    console.log(`총 ${fileArray.length}개 파일 업로드 시작`)

    startTourPhotoPrepare(tourId, fileArray.length)
    setUploading(true)

    void (async () => {
      try {
        await ensureStorageBucket()

        const result = await runTourPhotoUploadQueue({
          files: fileArray,
          tourId,
          uploadedBy: (uploadedBy && uploadedBy.trim()) || user?.email || '',
          labels: {
            noFiles: t('noFilesSelected'),
            mediaOnlyError: t('mediaOnlyError'),
            fileTooLarge: t('fileTooLarge'),
            duplicateInSelection: t('skippedDuplicateInSelection'),
            alreadyUploaded: t('skippedAlreadyUploaded'),
            nothingToUpload: t('nothingToUpload'),
          },
        })

        if (result.userMessages?.length) {
          alert(result.userMessages.join('\n'))
          return
        }

        const skipNote: string[] = []
        if (result.skippedDuplicateContent > 0) {
          skipNote.push(t('skippedDuplicateInSelection', { count: result.skippedDuplicateContent }))
        }
        if (result.skippedAlreadyUploaded > 0) {
          skipNote.push(t('skippedAlreadyUploaded', { count: result.skippedAlreadyUploaded }))
        }
        const skipSuffix = skipNote.length > 0 ? `\n\n${skipNote.join('\n')}` : ''

        if (result.totalSuccessful > 0) {
          console.log(`전체 업로드 완료: ${result.totalSuccessful}개 성공, ${result.totalFailed}개 실패`)
          if (result.totalFailed > 0) {
            const failedPreview = result.failedFiles.slice(0, 5).join('\n')
            const moreFailed =
              result.failedFiles.length > 5 ? `\n${t('andMore', { count: result.failedFiles.length - 5 })}` : ''
            alert(
              `${t('uploadCompletePartial', { success: result.totalSuccessful, failed: result.totalFailed })}${skipSuffix}\n\n${t('failedFilesHeader')}\n${failedPreview}${moreFailed}`
            )
          } else {
            alert(`${t('uploadCompleteSuccess', { count: result.totalSuccessful })}${skipSuffix}`)
          }
        } else {
          const failedPreview = result.failedFiles.slice(0, 10).join('\n')
          const moreFailed =
            result.failedFiles.length > 10 ? `\n${t('andMore', { count: result.failedFiles.length - 10 })}` : ''
          alert(
            `${t('uploadAllFailed', { count: result.totalFailed })}${skipSuffix}\n\n${t('failedFilesHeader')}\n${failedPreview}${moreFailed}`
          )
        }
      } catch (error) {
        console.error('Error uploading photos:', error)
        alert(t('uploadErrorGeneric', { error: error instanceof Error ? error.message : String(error) }))
      } finally {
        endTourPhotoUploadSession()
        setUploading(false)
      }
    })()
  }

  // 숨김 철회 (관리자만)
  const handleUnhidePhoto = async (photo: TourPhoto) => {
    if (!isAdmin) return
    
    if (!confirm(t('unhideConfirm', { fileName: photo.file_name, requester: photo.hide_requested_by_name || 'Unknown' }))) {
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
      
      alert(t('unhideSuccess'))
    } catch (error) {
      console.error('Error unhiding photo:', error)
      alert(t('unhideError'))
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
              <p className="text-sm text-yellow-700 mt-1">{t('bucketMissing')}</p>
            </div>
            <button
              onClick={() => setShowBucketModal(true)}
              className="bg-yellow-600 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-700 transition-colors"
            >
              {t('setupGuide')}
            </button>
          </div>
        </div>
      )}
      
      {bucketStatus === 'checking' && (
        <div className="flex items-center space-x-3 p-4 bg-gray-100 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          <span className="text-gray-700">{t('checkingBucket')}</span>
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
              <h3 className="text-sm font-medium text-red-800">{t('storageAccessError')}</h3>
              <p className="text-sm text-red-700">{t('storageAccessErrorDesc')}</p>
            </div>
            <button
              onClick={retry}
              className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700 transition-colors"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end">
        <div className="flex space-x-2">
          {/* 투어 전체 사진 공유 링크 */}
          {photos.length > 0 && (
            <button
              onClick={() => {
                // 환경 변수가 있으면 사용하고, 없으면 현재 origin 사용 (배포 환경에서는 자동으로 올바른 도메인 사용)
                const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
                // 로케일 없는 경로 사용
                const shareUrl = `${baseUrl}/photos/${tourId}`
                navigator.clipboard.writeText(shareUrl)
                alert(t('shareLinkCopied'))
              }}
              className={`flex items-center justify-center ${chrome.compact ? 'px-2 h-8 text-xs' : 'px-3 h-10 text-sm'} bg-purple-600 text-white rounded-lg hover:bg-purple-700`}
              title={t('shareAllTitle')}
            >
              <Share2 size={chrome.uploadIconSize} className="mr-1" />
              {t('shareAll')}
            </button>
          )}
          
          {/* 갤러리에서 선택 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || bucketStatus !== 'exists'}
            className={`flex items-center justify-center ${chrome.uploadIconButton} bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50`}
            title={
              bucketStatus !== 'exists' 
                ? t('bucketNotCreated') 
                : uploading ? t('uploading') : t('selectFromGallery')
            }
          >
            <ImageIcon size={chrome.uploadIconSize} />
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
            className={`flex items-center justify-center ${chrome.uploadIconButton} bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50`}
            title={
              bucketStatus !== 'exists' 
                ? t('bucketNotCreated') 
                : t('takePhoto')
            }
          >
            <Camera size={chrome.uploadIconSize} />
          </button>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg ${chrome.uploadZonePadding} text-center transition-colors ${
          bucketStatus !== 'exists'
            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
            : dragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={bucketStatus === 'exists' ? handleDragOver : undefined}
        onDragLeave={bucketStatus === 'exists' ? handleDragLeave : undefined}
        onDrop={bucketStatus === 'exists' ? handleDrop : undefined}
        onClick={bucketStatus === 'exists' ? () => fileInputRef.current?.click() : undefined}
      >
        <Upload size={chrome.uploadDropIconSize} className={`mx-auto text-gray-400 ${chrome.compact ? 'mb-1.5' : 'mb-2 sm:mb-4'}`} />
        <p className={chrome.uploadZoneText}>
          {bucketStatus !== 'exists' 
            ? t('bucketNotCreated') 
            : t('dragOrClick')
          }
        </p>
        <p className={chrome.uploadZoneHint}>
          {bucketStatus !== 'exists' 
            ? t('bucketSetupHint') 
            : t('fileFormats')
          }
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={TOUR_PHOTO_FILE_ACCEPT}
          onChange={(e) => {
            const target = e.target as HTMLInputElement
            const list = target.files
            if (list && list.length > 0) {
              console.log('File input files selected:', list.length)
              handleFileUpload(list)
            } else {
              console.log('No files selected from file input')
            }
            // 모바일: change 직후 value 초기화가 FileList 무효화를 유발할 수 있어 다음 틱으로 미룸
            requestAnimationFrame(() => {
              target.value = ''
            })
          }}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif"
          capture={typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'environment' : undefined}
          onChange={(e) => {
            const target = e.target as HTMLInputElement
            const list = target.files
            console.log('Camera input onChange triggered')
            console.log('Files:', list)
            console.log('Files length:', list?.length)
            
            if (list && list.length > 0) {
              console.log('Camera input files selected:', list.length)
              console.log('File details:', {
                name: list[0].name,
                size: list[0].size,
                type: list[0].type
              })
              handleFileUpload(list)
            } else {
              console.log('No files selected from camera input - user may have cancelled')
            }
            
            requestAnimationFrame(() => {
              target.value = ''
            })
          }}
          onClick={() => {
            console.log('Camera input clicked')
          }}
          className="hidden"
        />
      </div>

      {/* 사진 목록 */}
      {photos.length > 0 && (
        <div className="max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${chrome.compact ? 'gap-2' : 'gap-4'}`}>
          {photos.map((photo) => (
            <div key={photo.id} className="relative group cursor-pointer">
              <div
                className="relative aspect-square rounded-lg bg-gray-100"
                onClick={() => openPhotoModal(photo)}
              >
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <TourPhotoMediaThumb
                    filePath={photo.file_path}
                    fileName={photo.file_name}
                    thumbnailPath={photo.thumbnail_path ?? null}
                    mimeType={photo.mime_type || photo.file_type || null}
                    alt={photo.file_name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </div>

                {photo.uploaded_by_name && (
                  <span
                    className={`absolute bottom-1.5 left-1.5 z-20 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-black/65 px-1.5 py-0.5 font-medium text-white backdrop-blur-sm ${chrome.compact ? 'text-[10px]' : 'text-xs'}`}
                    title={photo.uploaded_by_name}
                  >
                    {photo.uploaded_by_name}
                  </span>
                )}

                {isAdmin && photo.is_hidden && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnhidePhoto(photo)
                    }}
                    className="absolute right-1.5 top-1.5 z-20 cursor-pointer rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
                    title={t('clickToUnhide')}
                  >
                    {t('hidden')}
                  </button>
                )}

                <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-black/0 transition-all duration-200 group-hover:bg-black/55">
                  <div
                    className={`absolute inset-x-0 bottom-0 space-y-0.5 bg-gradient-to-t from-black/85 via-black/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 ${chrome.compact ? 'px-1.5 pb-1.5 pt-4' : 'px-2 pb-2 pt-5'}`}
                  >
                    <p className={`truncate font-medium text-white ${chrome.compact ? 'text-[10px]' : 'text-xs'}`}>
                      {photo.file_name}
                    </p>
                    <p className={`text-white/85 ${chrome.compact ? 'text-[10px]' : 'text-xs'}`}>
                      {formatFileSize(photo.file_size)} · {new Date(photo.created_at).toLocaleString()}
                    </p>
                    {isAdmin && photo.is_hidden && photo.hide_requested_by_name && (
                      <p className={`font-medium text-red-300 ${chrome.compact ? 'text-[10px]' : 'text-xs'}`}>
                        {t('hideRequestedBy', { name: photo.hide_requested_by_name })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <div className={`text-center text-gray-500 ${chrome.emptyStatePadding}`}>
          <ImageIcon size={chrome.emptyStateLucideSize} className={`mx-auto text-gray-300 ${chrome.compact ? 'mb-2' : 'mb-4'}`} />
          <p className={chrome.emptyStateTitle}>{t('noPhotos')}</p>
        </div>
      )}

      {uploading && (
        <div className={`text-center text-gray-500 ${chrome.emptyStatePadding}`}>
          <div className={`animate-spin rounded-full border-b-2 border-primary mx-auto ${chrome.compact ? 'h-8 w-8 mb-2' : 'h-12 w-12 mb-4'}`} />
          <p className={chrome.emptyStateTitle}>{t('uploading')}</p>
          <p className={`${chrome.emptyStateSubtext} mt-2 max-w-md mx-auto px-2`}>{t('uploadProgressBackgroundNote')}</p>
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
              <TourPhotoMediaViewer
                filePath={selectedPhoto.file_path}
                fileName={selectedPhoto.file_name}
                mimeType={selectedPhoto.mime_type || selectedPhoto.file_type || null}
                alt={selectedPhoto.file_name}
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
                  {selectedPhoto.uploaded_by_name && (
                    <span className="mt-1.5 inline-block max-w-full truncate rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                      {selectedPhoto.uploaded_by_name}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => copyShareLink(selectedPhoto.share_token)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    {t('copyShareLink')}
                  </button>
                  <button
                    onClick={() => openPhotoInNewWindow(selectedPhoto)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    {t('viewInNewWindow')}
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(selectedPhoto.id, selectedPhoto.file_path)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    {t('deleteShort')}
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
                      <TourPhotoMediaThumb
                        filePath={photo.file_path}
                        fileName={photo.file_name}
                        thumbnailPath={photo.thumbnail_path ?? null}
                        mimeType={photo.mime_type || photo.file_type || null}
                        alt={photo.file_name}
                        width={48}
                        height={48}
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
      
      {/* Bucket 설정 안내 모달 */}
      {showBucketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">{t('bucketSetupModalTitle')}</h2>
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
                  <h3 className="font-semibold text-yellow-800 mb-2">⚠️ {t('bucketSetupWarningTitle')}</h3>
                  <p className="text-yellow-700">
                    {t('bucketSetupWarningDesc')}
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">{t('bucketSetupStepsTitle')}</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>1. {t('bucketSetupStep1')}</p>
                    <p>2. {t('bucketSetupStep2')}</p>
                    <p>3. {t('bucketSetupStep3')}</p>
                    <p>4. {t('bucketSetupStep4')}</p>
                  </div>
                </div>
                
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{t('bucketSetupSqlTitle')}</h4>
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
  524288000, -- 500MB
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/heic','image/heif','image/bmp','image/tiff','image/avif',
    'video/mp4','video/quicktime','video/x-m4v','video/webm','video/3gpp','video/3gpp2','video/mpeg','video/x-msvideo','video/hevc','video/H264'
  ]
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
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    {t('setupCompleteCheck')}
                  </button>
                  <button
                    onClick={() => setShowBucketModal(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    {t('close')}
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
