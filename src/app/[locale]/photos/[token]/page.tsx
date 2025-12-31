'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Share2, Calendar, User, Image as ImageIcon, Upload, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// 동적 라우트 설정 (Next.js 15/16)
// 클라이언트 컴포넌트에서는 revalidate를 export할 수 없음
// dynamic 설정만 사용하여 모든 경로를 동적으로 처리
export const dynamic = 'force-dynamic'
export const dynamicParams = true

interface TourPhoto {
  id: string
  file_name: string
  file_path: string
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
  products?: Product | null
}

export default function PhotoDownloadPage({ params }: { params: Promise<{ token: string; locale: string }> }) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [tourId, setTourId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [resolvedParams, setResolvedParams] = useState<{ token: string; locale: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    params.then(setResolvedParams)
  }, [params])

  useEffect(() => {
    if (resolvedParams) {
      loadPhotos()
    }
  }, [resolvedParams])

  const loadPhotos = async () => {
    if (!resolvedParams) return
    
    try {
      setLoading(true)
      setError(null)

      const { token } = resolvedParams

      // 먼저 share_token으로 조회 시도
      let photosData = null
      let photosError = null

      // share_token으로 조회
      const { data: tokenData, error: tokenError } = await supabase
        .from('tour_photos')
        .select(`
          *,
          tours!inner(
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
        .eq('share_token', token)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (tokenError) throw tokenError

      // share_token으로 사진을 찾았으면 사용
      if (tokenData && tokenData.length > 0) {
        photosData = tokenData
      } else {
        // share_token으로 찾지 못했으면 tour_id로 조회 시도
        const { data: tourData, error: tourError } = await supabase
          .from('tour_photos')
          .select(`
            *,
            tours!inner(
              id,
              product_id,
              tour_date,
              tour_status,
              products(
                id,
                name,
                name_en,
                name_ko
              )
            )
          `)
          .eq('tour_id', token)
          .eq('is_public', true)
          .order('created_at', { ascending: false })

        if (tourError) throw tourError
        photosData = tourData
      }

      if (!photosData || photosData.length === 0) {
        setError('Photos not found. The link may have expired or is invalid.')
        return
      }

      setPhotos(photosData)
      setTourInfo(photosData[0].tours)
      // tour_id 저장 (업로드에 사용)
      setTourId(photosData[0].tour_id)
    } catch (error) {
      console.error('Error loading photos:', error)
      setError('An error occurred while loading photos.')
    } finally {
      setLoading(false)
    }
  }

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
    if (selectedPhotos.size === 0) {
      alert('Please select photos to download.')
      return
    }

    setDownloading(true)
    try {
      const selectedPhotosList = photos.filter(photo => selectedPhotos.has(photo.id))
      
      for (const photo of selectedPhotosList) {
        await downloadPhoto(photo)
        // 다운로드 간격을 두어 브라우저가 처리할 수 있도록 함
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error('Error downloading photos:', error)
      alert('An error occurred while downloading photos.')
    } finally {
      setDownloading(false)
    }
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
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tour Photos</h1>
              {tourInfo && (
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <div className="flex items-center">
                    <Calendar size={16} className="mr-1" />
                    {tourInfo.tour_date}
                  </div>
                  {tourInfo.products && (
                    <div className="flex items-center">
                      <User size={16} className="mr-1" />
                      {tourInfo.products.customer_name_en || 
                       tourInfo.products.customer_name_ko || 
                       tourInfo.products.name_en || 
                       tourInfo.products.name_ko || 
                       tourInfo.products.name}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={shareLink}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900"
              >
                <Share2 size={16} className="mr-2" />
                Share Link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 업로드 영역 */}
        <div 
          className={`bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-dashed transition-colors ${
            dragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              사진 업로드
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
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
              className={`inline-flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                uploading || !tourId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              }`}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  업로드 중... ({uploadProgress.current}/{uploadProgress.total})
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  파일 선택
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
                  {uploadProgress.current} / {uploadProgress.total} 파일 업로드 중...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedPhotos.size === photos.length && photos.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Select All</span>
              </label>
              <span className="text-sm text-gray-500">
                {selectedPhotos.size} / {photos.length} selected
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={downloadSelectedPhotos}
                disabled={selectedPhotos.size === 0 || downloading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} className="mr-2" />
                {downloading ? 'Downloading...' : 'Download Selected'}
              </button>
              <button
                onClick={downloadAllPhotos}
                disabled={downloading}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} className="mr-2" />
                {downloading ? 'Downloading...' : 'Download All'}
              </button>
            </div>
          </div>
        </div>

        {/* 사진 그리드 */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-photos/${photo.file_path}`}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* 선택 체크박스 */}
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selectedPhotos.has(photo.id)}
                    onChange={() => handleSelectPhoto(photo.id)}
                    className="w-5 h-5 text-blue-600 bg-white rounded border-gray-300 focus:ring-blue-500"
                  />
                </div>

                {/* 다운로드 버튼 */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <button
                    onClick={() => downloadPhoto(photo)}
                    className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-full hover:bg-gray-100"
                    title="Download"
                  >
                    <Download size={16} />
                  </button>
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
        ) : (
          <div className="text-center py-12">
            <ImageIcon size={64} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No photos uploaded.</p>
          </div>
        )}
      </div>
    </div>
  )
}

