'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Share2, Calendar, User, Image as ImageIcon, Upload, X, Info, EyeOff, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ChatAnnouncement } from '@/types/chat'
import ReactCountryFlag from 'react-country-flag'

// 동적 라우트 설정 (Next.js 15/16)
// 클라이언트 컴포넌트에서는 revalidate를 export할 수 없음
// dynamic 설정만 사용하여 모든 경로를 동적으로 처리
export const dynamic = 'force-dynamic'
export const dynamicParams = true

interface TourPhoto {
  id: string
  file_name: string
  file_path: string
  thumbnail_path?: string | null
  file_size: number
  mime_type: string
  description?: string
  created_at: string
  uploaded_by: string
  tour_id: string
  reservation_id?: string
  share_token?: string | null
}

interface Product {
  id: string
  name: string
  name_en: string | null
  name_ko: string | null
  customer_name_en: string | null
  customer_name_ko: string | null
}

interface TourInfo {
  id: string
  product_id: string
  tour_date: string
  tour_status: string
  photos_extended_access?: boolean | null
  products?: Product | null
}

export default function PhotoDownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [tourId, setTourId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [resolvedParams, setResolvedParams] = useState<{ token: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [announcements, setAnnouncements] = useState<ChatAnnouncement[]>([])
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false)
  const [hasShownAnnouncement, setHasShownAnnouncement] = useState(false)
  const [language, setLanguage] = useState<'ko' | 'en'>('en')
  const [hideRequestMode, setHideRequestMode] = useState(false)
  const [showCustomerSelector, setShowCustomerSelector] = useState(false)
  const [showDownloadCustomerSelector, setShowDownloadCustomerSelector] = useState(false)
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [hidingPhotos, setHidingPhotos] = useState(false)
  const [isUploadSectionOpen, setIsUploadSectionOpen] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)
  const [showPhotoGuideModal, setShowPhotoGuideModal] = useState(false)

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  // 언어 설정 (localStorage에서 가져오거나 기본값 'en')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('tour_photos_language') as 'ko' | 'en' | null
      if (savedLanguage === 'ko' || savedLanguage === 'en') {
        setLanguage(savedLanguage)
      }
    }
  }, [])

  // 언어 전환
  const handleLanguageToggle = () => {
    const newLanguage = language === 'ko' ? 'en' : 'ko'
    setLanguage(newLanguage)
    if (typeof window !== 'undefined') {
      localStorage.setItem('tour_photos_language', newLanguage)
    }
  }

  useEffect(() => {
    if (resolvedParams) {
      loadPhotos()
    }
  }, [resolvedParams])

  // 투어 사진 공유 페이지 안내 모달 표시 여부 확인
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const today = new Date().toDateString()
      const dismissedDate = localStorage.getItem('tour_photos_guide_dismissed')
      
      // 오늘 날짜와 다르면 모달 표시
      if (dismissedDate !== today) {
        setShowPhotoGuideModal(true)
      }
    }
  }, [])

  // "오늘은 다시 보지 않기" 핸들러
  const handleDismissPhotoGuide = () => {
    if (typeof window !== 'undefined') {
      const today = new Date().toDateString()
      localStorage.setItem('tour_photos_guide_dismissed', today)
      setShowPhotoGuideModal(false)
    }
  }

  // Announcement 로드
  useEffect(() => {
    const loadAnnouncements = async () => {
      if (!tourId) return
      
      try {
        // 모든 활성화된 투어 announcement 로드
        const { data: tourAnnouncements } = await supabase
          .from('tour_announcements')
          .select('*')
          .eq('tour_id', tourId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (tourAnnouncements && tourAnnouncements.length > 0) {
          // 사진 다운로드 및 숨김 관련 announcement만 필터링
          const photoRelatedAnnouncements = tourAnnouncements.filter((ann: any) => {
            const title = (ann.title || '').toLowerCase()
            const content = (ann.content || '').toLowerCase()
            return (
              title.includes('사진') || title.includes('photo') ||
              title.includes('다운로드') || title.includes('download') ||
              title.includes('숨김') || title.includes('hide') ||
              content.includes('사진') || content.includes('photo') ||
              content.includes('다운로드') || content.includes('download') ||
              content.includes('숨김') || content.includes('hide')
            )
          })

          if (photoRelatedAnnouncements.length > 0) {
            setAnnouncements(photoRelatedAnnouncements as ChatAnnouncement[])
            // 첫 방문 시에만 모달 표시
            if (!hasShownAnnouncement) {
              setShowAnnouncementModal(true)
              setHasShownAnnouncement(true)
            }
          }
        }
      } catch (error) {
        console.error('Error loading announcements:', error)
      }
    }

    if (tourId) {
      loadAnnouncements()
    }
  }, [tourId, hasShownAnnouncement])

  const loadPhotos = async () => {
    if (!resolvedParams) return
    
    try {
      setLoading(true)
      setError(null)

      const { token } = resolvedParams
      let tourIdToUse = token
      let photosData: TourPhoto[] = []
      let tourInfoData: TourInfo | null = null

      // 1단계: share_token 또는 tour_id로 데이터베이스에서 조회 시도
      // share_token으로 조회 (모든 사진 가져오기, limit 제거)
      const { data: tokenData, error: tokenError } = await supabase
        .from('tour_photos')
        .select(`
          id,
          file_name,
          file_path,
          thumbnail_path,
          file_size,
          mime_type,
          description,
          created_at,
          uploaded_by,
          tour_id,
          reservation_id,
          share_token,
          is_public,
          tours(
            id,
            product_id,
            tour_date,
            tour_status,
            photos_extended_access,
            products(
              id,
              name,
              name_en,
              name_ko,
              customer_name_en,
              customer_name_ko
            )
          )
        `)
        .eq('share_token', token)
        .order('created_at', { ascending: false })
        .limit(10000) // 충분히 큰 값으로 설정

      if (tokenError) {
        console.warn('Error loading photos by share_token:', tokenError)
      }

      // share_token으로 사진을 찾았으면 사용
      if (tokenData && tokenData.length > 0) {
        photosData = tokenData
        if (tokenData[0].tours) {
          tourInfoData = tokenData[0].tours
        }
        tourIdToUse = tokenData[0].tour_id
      } else {
        // share_token으로 찾지 못했으면 tour_id로 조회 시도 (모든 사진 가져오기)
        const { data: tourData, error: tourError } = await supabase
          .from('tour_photos')
          .select(`
            id,
            file_name,
            file_path,
            thumbnail_path,
            file_size,
            mime_type,
            description,
            created_at,
            uploaded_by,
            tour_id,
            reservation_id,
            share_token,
            is_public,
            tours(
              id,
              product_id,
              tour_date,
              tour_status,
              products(
                id,
                name,
                name_en,
                name_ko,
                customer_name_en,
                customer_name_ko
              )
            )
          `)
          .eq('tour_id', token)
          .order('created_at', { ascending: false })
          .limit(10000) // 충분히 큰 값으로 설정

        if (tourError) {
          console.warn('Error loading photos by tour_id:', tourError)
        }

        if (tourData && tourData.length > 0) {
          photosData = tourData
          if (tourData[0].tours) {
            tourInfoData = tourData[0].tours
          }
          tourIdToUse = tourData[0].tour_id
        }
      }

      // 데이터베이스에서 조회한 경우에도 썸네일이 없으면 Storage에서 찾아서 매핑
      if (photosData.length > 0 && tourIdToUse) {
        // Storage에서 모든 썸네일 파일 목록 가져오기 (페이지네이션 처리)
        let allStorageFiles: any[] = []
        let hasMore = true
        let offset = 0
        const limit = 1000

        while (hasMore) {
          const { data: storageFiles, error: storageError } = await supabase.storage
            .from('tour-photos')
            .list(tourIdToUse, {
              limit: limit,
              offset: offset
            })

          if (storageError || !storageFiles) {
            break
          }

          allStorageFiles = [...allStorageFiles, ...storageFiles]

          if (storageFiles.length < limit) {
            hasMore = false
          } else {
            offset += limit
          }
        }

        if (allStorageFiles.length > 0) {
          // 썸네일 파일 매핑 생성
          const thumbnailFiles = allStorageFiles.filter((file: { name: string }) => 
            file.name.includes('_thumb') &&
            file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          )

          const thumbnailMap = new Map<string, string>()
          thumbnailFiles.forEach((thumbFile: { name: string }) => {
            const originalName = thumbFile.name.replace('_thumb', '')
            thumbnailMap.set(originalName, `${tourIdToUse}/${thumbFile.name}`)
          })

          // 썸네일이 없는 사진에 대해 썸네일 경로 추가
          photosData = photosData.map((photo: TourPhoto) => {
            // thumbnail_path가 이미 있으면 그대로 사용
            if (photo.thumbnail_path) {
              // 전체 경로가 아니면 추가
              if (!photo.thumbnail_path.includes('/')) {
                return { ...photo, thumbnail_path: `${tourIdToUse}/${photo.thumbnail_path}` }
              }
              return photo
            }

            // file_path에서 파일명 추출
            const fileName = photo.file_path.split('/').pop() || photo.file_name
            const thumbnailPath = thumbnailMap.get(fileName)
            if (thumbnailPath) {
              return { ...photo, thumbnail_path: thumbnailPath }
            }
            return photo
          })

          // 디버깅: 썸네일 매핑 결과 확인
          console.log('[PhotoDownloadPage] Thumbnail mapping:', {
            totalPhotos: photosData.length,
            withThumbnails: photosData.filter(p => p.thumbnail_path).length,
            thumbnailFilesFound: thumbnailFiles.length
          })
        }
      }

      // 2단계: 데이터베이스에서 찾지 못했거나 사진이 없으면 Storage에서 직접 조회
      if (photosData.length === 0) {
        console.log('No photos found in database, checking Storage...')
        
        // Storage에서 투어별 폴더의 모든 파일 목록 조회 (페이지네이션 처리)
        let allFiles: any[] = []
        let hasMore = true
        let offset = 0
        const limit = 1000

        while (hasMore) {
          const { data: files, error: storageError } = await supabase.storage
            .from('tour-photos')
            .list(tourIdToUse, {
              limit: limit,
              offset: offset,
              sort: { column: 'created_at', order: 'desc' }
            })

          if (storageError) {
            console.error('Error loading photos from storage:', storageError)
            break
          }

          if (!files || files.length === 0) {
            hasMore = false
            break
          }

          allFiles = [...allFiles, ...files]

          if (files.length < limit) {
            hasMore = false
          } else {
            offset += limit
          }
        }

        // 투어 정보 조회
        if (allFiles.length === 0) {
          const { data: tourInfo, error: tourInfoError } = await supabase
            .from('tours')
            .select(`
              id,
              product_id,
              tour_date,
              tour_status,
              photos_extended_access,
              products(
                id,
                name,
                name_en,
                name_ko,
                customer_name_en,
                customer_name_ko
              )
            `)
            .eq('id', tourIdToUse)
            .single()

          if (!tourInfoError && tourInfo) {
            tourInfoData = tourInfo
          }

          setError('Photos not found. The link may have expired or is invalid.')
          return
        }

        if (allFiles.length > 0) {
          const files = allFiles
          // 실제 사진 파일만 필터링 (썸네일 제외)
          const photoFiles = files.filter((file: { name: string }) => 
            !file.name.includes('.folder_info.json') && 
            !file.name.includes('folder.info') &&
            !file.name.includes('.info') &&
            !file.name.includes('.README') &&
            !file.name.startsWith('.') &&
            !file.name.includes('_thumb') && // 썸네일 파일 제외
            file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          )

          // 썸네일 파일 찾기
          const thumbnailFiles = files.filter((file: { name: string }) => 
            file.name.includes('_thumb') &&
            file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          )

          // 썸네일 매핑 생성
          const thumbnailMap = new Map<string, string>()
          thumbnailFiles.forEach((thumbFile: { name: string }) => {
            // 원본 파일명 추출 (예: "123_thumb.jpg" -> "123.jpg")
            const originalName = thumbFile.name.replace('_thumb', '')
            thumbnailMap.set(originalName, `${tourIdToUse}/${thumbFile.name}`)
          })

          // Storage 파일을 TourPhoto 형식으로 변환
          photosData = photoFiles.map((file: any) => ({
            id: file.id || file.name,
            file_name: file.name,
            file_path: `${tourIdToUse}/${file.name}`,
            thumbnail_path: thumbnailMap.get(file.name) || null,
            file_size: file.metadata?.size || 0,
            mime_type: file.metadata?.mimetype || 'image/jpeg',
            created_at: file.created_at || file.updated_at || new Date().toISOString(),
            uploaded_by: 'unknown',
            tour_id: tourIdToUse,
            share_token: null
          }))

          // 투어 정보가 없으면 조회 시도
          if (!tourInfoData) {
            const { data: tourInfo, error: tourInfoError } = await supabase
              .from('tours')
              .select(`
                id,
                product_id,
                tour_date,
                tour_status,
                products(
                  id,
                  name,
                  name_en,
                  name_ko,
                  customer_name_en,
                  customer_name_ko
                )
              `)
              .eq('id', tourIdToUse)
              .single()

            if (!tourInfoError && tourInfo) {
              tourInfoData = tourInfo
            }
          }
        }
      }

      if (photosData.length === 0) {
        setError('Photos not found. The link may have expired or is invalid.')
        return
      }

      setPhotos(photosData)
      if (tourInfoData) {
        setTourInfo(tourInfoData)
        
        // 투어 날짜로부터 7일 후 접속 제한 체크
        // photos_extended_access가 true이면 제한 우회
        if (tourInfoData.tour_date) {
          const tourDate = new Date(tourInfoData.tour_date)
          const today = new Date()
          const daysDiff = Math.floor((today.getTime() - tourDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // 7일이 지났고, photos_extended_access가 false이거나 null인 경우에만 접속 제한
          if (daysDiff > 7 && !tourInfoData.photos_extended_access) {
            setError(language === 'ko' 
              ? '투어 날짜로부터 7일이 지나 이 페이지에 접속할 수 없습니다.' 
              : 'This page is no longer accessible 7 days after the tour date.')
            setLoading(false)
            return
          }
        }
      }
      setTourId(tourIdToUse)
    } catch (error) {
      console.error('Error loading photos:', error)
      setError('An error occurred while loading photos.')
    } finally {
      setLoading(false)
    }
  }

  // 고객 목록 로드 (해당 투어의 reservation_ids에 있는 예약의 고객만)
  const loadCustomers = async () => {
    if (!tourId) return
    
    try {
      setLoadingCustomers(true)
      
      // 투어 정보 가져오기
      const { data: tour, error: tourError } = await supabase
        .from('tours')
        .select('reservation_ids')
        .eq('id', tourId)
        .single()

      if (tourError) {
        console.error('Error loading tour:', tourError)
        setCustomers([])
        return
      }

      if (!tour || !tour.reservation_ids) {
        console.log('Tour has no reservation_ids')
        setCustomers([])
        return
      }

      // reservation_ids가 배열인지 확인하고 배열로 변환
      let reservationIds: string[] = []
      if (Array.isArray(tour.reservation_ids)) {
        reservationIds = tour.reservation_ids.filter((id: any) => id && typeof id === 'string')
      } else if (typeof tour.reservation_ids === 'string') {
        // 문자열로 저장된 경우 JSON 파싱 시도
        try {
          const parsed = JSON.parse(tour.reservation_ids)
          reservationIds = Array.isArray(parsed) ? parsed.filter((id: any) => id && typeof id === 'string') : []
        } catch {
          reservationIds = []
        }
      }

      if (reservationIds.length === 0) {
        console.log('No valid reservation IDs found')
        setCustomers([])
        return
      }

      console.log('Loading customers for reservations:', reservationIds)

      // 예약 정보 가져오기 (정확히 해당 reservation_ids만)
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, customer_id')
        .in('id', reservationIds)

      if (reservationsError) {
        console.error('Error loading reservations:', reservationsError)
        setCustomers([])
        return
      }

      if (!reservations || reservations.length === 0) {
        console.log('No reservations found for the given IDs')
        setCustomers([])
        return
      }

      // 고객 ID 목록 추출 (중복 제거)
      const customerIds = [...new Set(
        reservations
          .map((r: { customer_id: string | null }) => r.customer_id)
          .filter((id): id is string => Boolean(id))
      )]

      if (customerIds.length === 0) {
        console.log('No customer IDs found in reservations')
        setCustomers([])
        return
      }

      console.log('Loading customer details for IDs:', customerIds)

      // 고객 정보 가져오기 (정확히 해당 customer_ids만)
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds)

      if (customersError) {
        console.error('Error loading customers:', customersError)
        setCustomers([])
      } else {
        console.log('Loaded customers:', customersData)
        setCustomers((customersData || []) as Array<{ id: string; name: string }>)
      }
    } catch (error) {
      console.error('Error loading customers:', error)
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }

  // 숨김 요청 처리
  const handleHideRequest = async (customerId: string, customerName: string) => {
    if (selectedPhotos.size === 0) {
      alert(language === 'ko' ? '선택된 사진이 없습니다.' : 'No photos selected.')
      return
    }

    setHidingPhotos(true)
    try {
      const selectedPhotoObjects = photos.filter(p => selectedPhotos.has(p.id))
      const requests = selectedPhotoObjects.map(photo => ({
        tour_id: tourId!,
        file_name: photo.file_name,
        file_path: photo.file_path,
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
        alert(language === 'ko' ? '숨김 요청 중 오류가 발생했습니다.' : 'An error occurred while requesting to hide photos.')
      } else {
        // 성공 시 사진 목록 새로고침
        await loadPhotos()
        setSelectedPhotos(new Set())
        setHideRequestMode(false)
        setShowCustomerSelector(false)
        alert(language === 'ko' ? '숨김 요청이 완료되었습니다.' : 'Hide request completed successfully.')
      }
    } catch (error) {
      console.error('Error in handleHideRequest:', error)
      alert(language === 'ko' ? '숨김 요청 중 오류가 발생했습니다.' : 'An error occurred while requesting to hide photos.')
    } finally {
      setHidingPhotos(false)
    }
  }

  // 다운로드 시 고객 선택
  const handleDownloadWithCustomer = async (customerId: string, customerName: string) => {
    setShowDownloadCustomerSelector(false)
    await executeDownloadWithCustomer(customerId, customerName)
  }

  // 고객 선택 후 다운로드 실행
  const executeDownloadWithCustomer = async (customerId: string, customerName: string) => {
    if (selectedPhotos.size === 0) {
      alert(language === 'ko' ? '선택된 사진이 없습니다.' : 'No photos selected.')
      return
    }

    setDownloading(true)
    try {
      const selectedPhotosList = photos.filter(photo => selectedPhotos.has(photo.id))
      
      for (let i = 0; i < selectedPhotosList.length; i++) {
        const photo = selectedPhotosList[i]
        await downloadPhoto(photo)
        
        // 다운로드 기록 저장
        try {
          await supabase
            .from('tour_photo_download_logs')
            .insert({
              tour_id: tourId!,
              file_name: photo.file_name,
              file_path: photo.file_path,
              customer_id: customerId,
              customer_name: customerName
            })
        } catch (error) {
          console.error('Error saving download log:', error)
          // 다운로드 기록 저장 실패해도 다운로드는 계속 진행
        }
        
        // 다운로드 간격을 두어 브라우저가 처리할 수 있도록 함
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      alert(language === 'ko' ? '다운로드가 완료되었습니다.' : 'Download completed successfully.')
    } catch (error) {
      console.error('Error downloading photos:', error)
      alert(language === 'ko' ? '다운로드 중 오류가 발생했습니다.' : 'An error occurred while downloading photos.')
    } finally {
      setDownloading(false)
      setSelectedPhotos(new Set())
    }
  }

  // 다운로드 버튼 클릭 시 고객 선택 모달 표시
  const handleDownloadClick = () => {
    if (selectedPhotos.size === 0) {
      alert(language === 'ko' ? '선택된 사진이 없습니다.' : 'Please select photos to download.')
      return
    }
    loadCustomers()
    setShowDownloadCustomerSelector(true)
  }

  // 숨김 버튼 클릭 시 고객 선택 모달 표시
  const handleHideClick = () => {
    if (selectedPhotos.size === 0) {
      alert(language === 'ko' ? '선택된 사진이 없습니다.' : 'Please select photos to hide.')
      return
    }
    loadCustomers()
    setShowCustomerSelector(true)
  }

  // 사진 클릭 시 큰 화면으로 보기
  const handlePhotoClick = (photoIndex: number) => {
    setSelectedPhotoIndex(photoIndex)
  }

  // 라이트박스 닫기
  const closeLightbox = () => {
    setSelectedPhotoIndex(null)
  }

  // 이전 사진
  const handlePreviousPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1)
    }
  }

  // 다음 사진
  const handleNextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1)
    }
  }

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return

      if (e.key === 'Escape') {
        closeLightbox()
      } else if (e.key === 'ArrowLeft') {
        handlePreviousPhoto()
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPhotoIndex, photos.length])

  const handleSelectPhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(photoId)) {
        newSet.delete(photoId)
      } else {
        newSet.add(photoId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set())
    } else {
      setSelectedPhotos(new Set(photos.map(photo => photo.id)))
    }
  }

  const downloadPhoto = async (photo: TourPhoto) => {
    try {
      const { data, error } = await supabase.storage
        .from('tour-photos')
        .download(photo.file_path)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = photo.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading photo:', error)
      alert('An error occurred while downloading the photo.')
    }
  }

  const downloadSelectedPhotos = async () => {
    handleDownloadClick()
  }

  const downloadAllPhotos = async () => {
    setDownloading(true)
    try {
      for (const photo of photos) {
        await downloadPhoto(photo)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error('Error downloading photos:', error)
      alert('An error occurred while downloading photos.')
    } finally {
      setDownloading(false)
    }
  }

  const shareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Link copied to clipboard.')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 파일 업로드 처리
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !files.length || !tourId) {
      alert('파일이 선택되지 않았거나 투어 정보를 찾을 수 없습니다.')
      return
    }

    const fileArray = Array.from(files)
    
    // 파일 개수 제한 체크
    if (fileArray.length > 100) {
      alert('한번에 최대 100개의 파일만 업로드할 수 있습니다.')
      return
    }

    setUploading(true)
    setUploadProgress({ current: 0, total: fileArray.length })

    try {
      let totalSuccessful = 0
      let totalFailed = 0
      const failedFiles: string[] = []

      // share_token 가져오기
      // 1. 기존 사진들 중 share_token이 있는 경우 그 share_token 사용
      // 2. 없으면 resolvedParams의 token 사용 (이미 share_token일 수 있음)
      // 3. 그것도 tour_id와 같으면 새로 생성
      let shareToken = photos.length > 0 && photos[0].share_token 
        ? photos[0].share_token 
        : (resolvedParams?.token || null)
      
      // share_token이 없거나 tour_id와 같은 경우, 새로운 share_token 생성
      if (!shareToken || shareToken === tourId) {
        shareToken = crypto.randomUUID()
      }

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]
        
        try {
          // 파일 크기 체크 (50MB)
          if (file.size > 50 * 1024 * 1024) {
            throw new Error(`파일 크기가 너무 큽니다: ${file.name} (최대 50MB)`)
          }

          // 이미지 파일만 허용
          if (!file.type.startsWith('image/')) {
            throw new Error(`이미지 파일만 업로드 가능합니다: ${file.name}`)
          }

          // 고유한 파일명 생성
          const fileExt = file.name.split('.').pop()
          const timestamp = Date.now() + Math.random().toString(36).substring(2)
          const fileName = `${timestamp}.${fileExt}`
          const filePath = `${tourId}/${fileName}`

          // Supabase Storage에 업로드
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tour-photos')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            throw uploadError
          }

          // 데이터베이스에 메타데이터 저장
          const { error: dbError } = await supabase
            .from('tour_photos')
            .insert({
              tour_id: tourId,
              file_path: uploadData.path,
              file_name: file.name,
              file_size: file.size,
              mime_type: file.type,
              uploaded_by: user?.id || 'anonymous',
              share_token: shareToken,
              is_public: true
            })

          if (dbError) {
            // Storage에서 파일 삭제
            await supabase.storage.from('tour-photos').remove([uploadData.path])
            throw dbError
          }

          totalSuccessful++
          setUploadProgress({ current: i + 1, total: fileArray.length })
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error)
          failedFiles.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
          totalFailed++
        }
      }

      // 업로드 완료 후 사진 목록 새로고침
      if (totalSuccessful > 0) {
        await loadPhotos()
        
        if (totalFailed > 0) {
          alert(`업로드 완료: ${totalSuccessful}개 성공, ${totalFailed}개 실패\n\n실패한 파일들:\n${failedFiles.slice(0, 5).join('\n')}${failedFiles.length > 5 ? `\n... 외 ${failedFiles.length - 5}개` : ''}`)
        } else {
          alert(`성공적으로 ${totalSuccessful}개 파일을 업로드했습니다.`)
        }
      } else {
        alert(`모든 파일 업로드에 실패했습니다. (${totalFailed}개 파일)\n\n실패 원인:\n${failedFiles.slice(0, 10).join('\n')}${failedFiles.length > 10 ? `\n... 외 ${failedFiles.length - 10}개` : ''}`)
      }
    } catch (error) {
      console.error('Error uploading photos:', error)
      alert(`업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setUploading(false)
      setUploadProgress({ current: 0, total: 0 })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files)
    }
  }

  if (loading || !resolvedParams) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading photos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <ImageIcon size={64} className="mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Photos Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Announcement 모달 */}
      {showAnnouncementModal && announcements.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Info size={20} className="mr-2 text-blue-600" />
                공지사항 / Announcements
              </h3>
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="border-b pb-4 last:border-b-0">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    {announcement.title}
                  </h4>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {announcement.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowAnnouncementModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 투어 사진 공유 페이지 안내 모달 */}
      {showPhotoGuideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <Info size={20} className="mr-2 text-blue-600" />
                {language === 'ko' ? '투어 사진 공유 페이지 안내' : 'Tour Photo Sharing Guide'}
              </h3>
              <button
                onClick={() => setShowPhotoGuideModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {language === 'ko' ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• 사진 보관 안내</h4>
                      <p className="text-sm text-gray-700">
                        투어 날짜로부터 7일 뒤에는 이 페이지에 접속할 수 없으니, 그전에 다운로드 받아야 합니다. 원하는 사진이 있다면 미리 다운로드하여 보관하시기 바랍니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• 그룹 투어 사진 안내</h4>
                      <p className="text-sm text-gray-700">
                        그룹 투어 특성상 여러 참가자의 사진이 함께 업로드될 수 있습니다. 사진을 다운로드한 후 표시에서 제거를 원하시면 "숨김 요청" 기능을 사용하여 직접 요청할 수 있습니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• 개인정보 보호</h4>
                      <p className="text-sm text-gray-700">
                        개인정보 보호를 위해 본인의 사진만 다운로드하시기 바랍니다. 타인의 사진을 저장하는 것은 금지되어 있습니다.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• 다운로드 기록</h4>
                      <p className="text-sm text-gray-700">
                        모든 다운로드 기록은 저장되며, 초상권 문제 발생 시 출처를 추적할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• Photo Storage Notice</h4>
                      <p className="text-sm text-gray-700">
                        You will not be able to access this page 7 days after the tour date, so please download your photos before then. If you wish to keep any photos, please download them in advance.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• Group Tour Photos</h4>
                      <p className="text-sm text-gray-700">
                        Due to the nature of group tours, photos of multiple participants may be uploaded together. If you download your photos and wish to request that they be removed from display, you can use the "Hide Photos" feature to request directly.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• Privacy Protection</h4>
                      <p className="text-sm text-gray-700">
                        For privacy protection, please download only your own photos. Saving photos of others is prohibited.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">• Download Records</h4>
                      <p className="text-sm text-gray-700">
                        All download records are stored, and in case of portrait rights issues, the source will be tracked.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between items-center">
              <button
                onClick={handleDismissPhotoGuide}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
              >
                {language === 'ko' ? '오늘은 다시 보지 않기' : "Don't show again today"}
              </button>
              <button
                onClick={() => setShowPhotoGuideModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {language === 'ko' ? '확인' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between sm:justify-start gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  {language === 'ko' ? '투어 사진' : 'Tour Photos'}
                </h1>
                {/* 언어 전환 버튼과 공유 버튼 */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {/* 언어 전환 버튼 */}
                  <button
                    onClick={handleLanguageToggle}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    title={language === 'ko' ? 'Switch to English' : '한국어로 전환'}
                  >
                    <ReactCountryFlag
                      countryCode={language === 'ko' ? 'KR' : 'US'}
                      svg
                      style={{
                        width: '20px',
                        height: '15px',
                        borderRadius: '2px'
                      }}
                    />
                  </button>
                  {/* 공유 버튼 */}
                  <button
                    onClick={shareLink}
                    className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
                    title={language === 'ko' ? '링크 공유' : 'Share Link'}
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
              {tourInfo && (
                <div className="flex flex-col gap-2 text-xs sm:text-sm text-gray-600">
                  <div className="flex items-center">
                    <Calendar size={14} className="mr-1 flex-shrink-0" />
                    <span>{tourInfo.tour_date}</span>
                  </div>
                  {tourInfo.products && (
                    <div className="flex items-start min-w-0">
                      <User size={14} className="mr-1 flex-shrink-0 mt-0.5" />
                      <span className="whitespace-normal break-words">
                        {language === 'ko' 
                          ? (tourInfo.products.customer_name_ko || tourInfo.products.name_ko || tourInfo.products.name)
                          : (tourInfo.products.customer_name_en || tourInfo.products.name_en || tourInfo.products.name)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* 업로드 영역 */}
        <div className="bg-white rounded-lg shadow-sm mb-4 sm:mb-6 border border-gray-200">
          {/* 접기/펼치기 헤더 */}
          <button
            onClick={() => setIsUploadSectionOpen(!isUploadSectionOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Upload size={20} className="text-gray-600" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {language === 'ko' ? '사진 업로드' : 'Upload Photos'}
              </h3>
            </div>
            {isUploadSectionOpen ? (
              <ChevronUp size={20} className="text-gray-600" />
            ) : (
              <ChevronDown size={20} className="text-gray-600" />
            )}
          </button>
          
          {/* 업로드 영역 컨텐츠 */}
          {isUploadSectionOpen && (
            <div 
              className={`px-4 sm:px-6 pb-4 sm:pb-6 border-t border-gray-200 ${
                dragOver 
                  ? 'bg-blue-50' 
                  : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="text-center pt-4">
                <div className={`inline-block p-6 border-2 border-dashed rounded-lg transition-colors ${
                  dragOver 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300'
                }`}>
                  <Upload size={40} className="mx-auto text-gray-400 mb-3 sm:mb-4 sm:w-12 sm:h-12" />
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                    {language === 'ko' 
                      ? '파일을 드래그 앤 드롭하거나 클릭하여 선택하세요' 
                      : 'Drag and drop files or click to select'}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploading || !tourId}
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-colors ${
                      uploading || !tourId
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                        <span className="text-xs sm:text-sm">
                          {language === 'ko' ? '업로드 중...' : 'Uploading...'} ({uploadProgress.current}/{uploadProgress.total})
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="mr-1 sm:mr-2 sm:w-4 sm:h-4" />
                        <span>{language === 'ko' ? '파일 선택' : 'Select Files'}</span>
                      </>
                    )}
                  </label>
                  {uploading && uploadProgress.total > 0 && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {uploadProgress.current} / {uploadProgress.total} {language === 'ko' ? '파일 업로드 중...' : 'files uploading...'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 액션 버튼들 */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center justify-between sm:justify-start space-x-2 sm:space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPhotos.size === photos.length && photos.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-700">
                  {language === 'ko' ? '전체 선택' : 'Select All'}
                </span>
              </label>
              <span className="text-xs sm:text-sm text-gray-500">
                {selectedPhotos.size} / {photos.length} {language === 'ko' ? '선택됨' : 'selected'}
              </span>
            </div>
            <div className="flex flex-row items-center gap-2 flex-wrap">
              {hideRequestMode && (
                <button
                  onClick={() => {
                    setHideRequestMode(false)
                    setSelectedPhotos(new Set())
                  }}
                  className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 whitespace-nowrap"
                >
                  {language === 'ko' ? '취소' : 'Cancel'}
                </button>
              )}
              {!hideRequestMode && (
                <>
                  <button
                    onClick={downloadSelectedPhotos}
                    disabled={selectedPhotos.size === 0 || downloading}
                    className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Download size={14} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {downloading 
                        ? (language === 'ko' ? '다운로드 중...' : 'Downloading...') 
                        : (language === 'ko' ? '선택 다운로드' : 'Download Selected')}
                    </span>
                    <span className="sm:hidden">
                      {downloading ? '...' : (language === 'ko' ? '다운로드' : 'Download')}
                    </span>
                  </button>
                  <button
                    onClick={downloadAllPhotos}
                    disabled={downloading}
                    className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Download size={14} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {downloading 
                        ? (language === 'ko' ? '다운로드 중...' : 'Downloading...') 
                        : (language === 'ko' ? '전체 다운로드' : 'Download All')}
                    </span>
                    <span className="sm:hidden">
                      {downloading ? '...' : (language === 'ko' ? '전체' : 'All')}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setHideRequestMode(true)
                      if (selectedPhotos.size === 0) {
                        alert(language === 'ko' ? '숨길 사진을 선택해주세요.' : 'Please select photos to hide.')
                      }
                    }}
                    className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 whitespace-nowrap"
                  >
                    <EyeOff size={14} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{language === 'ko' ? '숨김 요청' : 'Hide Photos'}</span>
                    <span className="sm:hidden">{language === 'ko' ? '숨김' : 'Hide'}</span>
                  </button>
                </>
              )}
              {hideRequestMode && selectedPhotos.size > 0 && (
                <button
                  onClick={handleHideClick}
                  disabled={hidingPhotos}
                  className="flex items-center justify-center px-3 sm:px-4 py-2 text-xs sm:text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <EyeOff size={14} className="mr-1 sm:mr-2" />
                  {hidingPhotos 
                    ? (language === 'ko' ? '처리 중...' : 'Processing...') 
                    : (language === 'ko' ? '숨김 요청' : 'Request Hide')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 사진 그리드 */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {photos.map((photo, index) => (
              <div 
                key={photo.id} 
                className="relative group cursor-pointer"
                onClick={(e) => {
                  // 체크박스나 다운로드 버튼 클릭이 아닐 때만 큰 화면으로 보기
                  const target = e.target as HTMLElement
                  if (!target.closest('input[type="checkbox"]') && !target.closest('button')) {
                    e.preventDefault()
                    e.stopPropagation()
                    handlePhotoClick(index)
                  }
                }}
              >
                <div 
                  className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative"
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (!target.closest('input[type="checkbox"]') && !target.closest('button')) {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePhotoClick(index)
                    }
                  }}
                  onTouchStart={(e) => {
                    const target = e.target as HTMLElement
                    if (!target.closest('input[type="checkbox"]') && !target.closest('button')) {
                      e.preventDefault()
                    }
                  }}
                  onTouchEnd={(e) => {
                    const target = e.target as HTMLElement
                    if (!target.closest('input[type="checkbox"]') && !target.closest('button')) {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePhotoClick(index)
                    }
                  }}
                  style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
                >
                  <div
                    className="w-full h-full absolute inset-0"
                    style={{ 
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none'
                    }}
                  >
                    <img
                      src={(() => {
                        // 썸네일 경로가 있으면 썸네일 사용, 없으면 원본 사용
                        const imagePath = photo.thumbnail_path || photo.file_path
                        const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${imagePath}`
                        // 디버깅: 썸네일 사용 여부 확인
                        if (process.env.NODE_ENV === 'development' && index === 0) {
                          console.log('Photo image URL:', {
                            fileName: photo.file_name,
                            thumbnailPath: photo.thumbnail_path,
                            filePath: photo.file_path,
                            usingThumbnail: !!photo.thumbnail_path,
                            imageUrl
                          })
                        }
                        return imageUrl
                      })()}
                      alt={photo.file_name}
                      className="w-full h-full object-cover"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onMouseDown={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      style={{ 
                        pointerEvents: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        touchAction: 'none'
                      }}
                    />
                  </div>
                </div>
                
                {/* 선택 체크박스 */}
                <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                  <label className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPhotos.has(photo.id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleSelectPhoto(photo.id)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 text-blue-600 bg-white rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* 선택 표시 오버레이 */}
                {selectedPhotos.has(photo.id) && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-30 border-2 border-blue-600 rounded-lg z-0"></div>
                )}

                {/* 파일 정보 */}
                <div className="mt-1 sm:mt-2 text-[10px] sm:text-xs text-gray-600">
                  <p className="truncate">{photo.file_name}</p>
                  <p className="hidden sm:block">{formatFileSize(photo.file_size)}</p>
                  <p className="hidden sm:block">{new Date(photo.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ImageIcon size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">{language === 'ko' ? '업로드된 사진이 없습니다.' : 'No photos uploaded.'}</p>
          </div>
        )}
      </div>

      {/* 고객 선택 모달 (다운로드용) */}
      {showDownloadCustomerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {language === 'ko' ? '고객 선택' : 'Select Customer'}
              </h3>
              <button
                onClick={() => setShowDownloadCustomerSelector(false)}
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
                      className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {downloading && (
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
                onClick={() => setShowDownloadCustomerSelector(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {language === 'ko' ? '취소' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 고객 선택 모달 (숨김용) */}
      {showCustomerSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5" />
                {language === 'ko' ? '고객 선택' : 'Select Customer'}
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
                      className="w-full p-3 text-left border rounded-lg hover:bg-orange-50 hover:border-orange-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {hidingPhotos && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
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
                {language === 'ko' ? '취소' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 라이트박스 모달 */}
      {selectedPhotoIndex !== null && photos[selectedPhotoIndex] && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          {/* 모달 배경 클릭으로 닫기 */}
          <div className="absolute inset-0" onClick={closeLightbox}></div>
          
          {/* 모달 콘텐츠 */}
          <div className="relative max-w-7xl max-h-full w-full h-full flex flex-col items-center justify-center p-4 pb-24 sm:pb-20">
            {/* 닫기 버튼 */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
              title={language === 'ko' ? '닫기' : 'Close'}
            >
              <X className="w-6 h-6" />
            </button>

            {/* 이전 버튼 */}
            {selectedPhotoIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreviousPhoto()
                }}
                className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 z-10 p-2 sm:p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
                title={language === 'ko' ? '이전' : 'Previous'}
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* 다음 버튼 */}
            {selectedPhotoIndex < photos.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleNextPhoto()
                }}
                className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 z-10 p-2 sm:p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
                title={language === 'ko' ? '다음' : 'Next'}
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {/* 메인 이미지 */}
            <div 
              className="flex-1 flex items-center justify-center max-w-full min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${photos[selectedPhotoIndex].file_path}`}
                alt={photos[selectedPhotoIndex].file_name}
                className="max-w-full max-h-[65vh] sm:max-h-[70vh] object-contain"
              />
            </div>
            
            {/* 사진 정보 및 다운로드 버튼 - 사진 아래 */}
            <div 
              className="mt-4 bg-black bg-opacity-70 rounded-lg px-4 py-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 z-10 w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-white text-center sm:text-left flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base break-words">{photos[selectedPhotoIndex].file_name}</p>
                <p className="text-xs opacity-75 mt-1">
                  {selectedPhotoIndex + 1} / {photos.length}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  downloadPhoto(photos[selectedPhotoIndex])
                }}
                className="flex items-center px-3 py-2 bg-white bg-opacity-20 text-white rounded hover:bg-opacity-30 transition-colors whitespace-nowrap flex-shrink-0"
                title={language === 'ko' ? '다운로드' : 'Download'}
              >
                <Download className="w-4 h-4 mr-1" />
                <span className="text-sm">{language === 'ko' ? '다운로드' : 'Download'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

