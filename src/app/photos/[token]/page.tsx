'use client'

import { useState, useEffect } from 'react'
import { Download, Share2, Calendar, User, Image as ImageIcon, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

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
}

interface TourInfo {
  id: string
  product_id: string
  tour_date: string
  tour_status: string
}

export default function PhotoDownloadPage({ params }: { params: { token: string } }) {
  const [photos, setPhotos] = useState<TourPhoto[]>([])
  const [tourInfo, setTourInfo] = useState<TourInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  const { token } = params

  useEffect(() => {
    loadPhotos()
  }, [token])

  const loadPhotos = async () => {
    try {
      setLoading(true)
      setError(null)

      // 공유 토큰으로 사진 조회
      const { data: photosData, error: photosError } = await supabase
        .from('tour_photos')
        .select(`
          *,
          tours!inner(
            id,
            product_id,
            tour_date,
            tour_status
          )
        `)
        .eq('share_token', token)
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (photosError) throw photosError

      if (!photosData || photosData.length === 0) {
        setError('사진을 찾을 수 없습니다. 링크가 만료되었거나 잘못된 링크입니다.')
        return
      }

      setPhotos(photosData)
      setTourInfo(photosData[0].tours)
    } catch (error) {
      console.error('Error loading photos:', error)
      setError('사진을 불러오는 중 오류가 발생했습니다.')
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
      alert('사진 다운로드 중 오류가 발생했습니다.')
    }
  }

  const downloadSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) {
      alert('다운로드할 사진을 선택해주세요.')
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
      alert('사진 다운로드 중 오류가 발생했습니다.')
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
      alert('사진 다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  const shareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('링크가 클립보드에 복사되었습니다.')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">사진을 불러오는 중...</p>
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">사진을 찾을 수 없습니다</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft size={16} className="mr-2" />
            홈으로 돌아가기
          </Link>
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
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} className="mr-2" />
                홈으로
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">투어 사진</h1>
                {tourInfo && (
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    <div className="flex items-center">
                      <Calendar size={16} className="mr-1" />
                      {tourInfo.tour_date}
                    </div>
                    <div className="flex items-center">
                      <User size={16} className="mr-1" />
                      {photos[0]?.uploaded_by}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={shareLink}
                className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900"
              >
                <Share2 size={16} className="mr-2" />
                링크 공유
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                <span className="ml-2 text-sm text-gray-700">전체 선택</span>
              </label>
              <span className="text-sm text-gray-500">
                {selectedPhotos.size} / {photos.length} 선택됨
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={downloadSelectedPhotos}
                disabled={selectedPhotos.size === 0 || downloading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} className="mr-2" />
                {downloading ? '다운로드 중...' : '선택한 사진 다운로드'}
              </button>
              <button
                onClick={downloadAllPhotos}
                disabled={downloading}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={16} className="mr-2" />
                {downloading ? '다운로드 중...' : '전체 다운로드'}
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
                    title="다운로드"
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
            <p className="text-gray-500">업로드된 사진이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
