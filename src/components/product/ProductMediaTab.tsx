'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Image, Upload, Edit, Trash2, Save, AlertCircle, Eye, Download, Star, FolderOpen, Copy, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MediaItem {
  id?: string
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

interface ProductMediaTabProps {
  productId: string
  isNewProduct: boolean
  formData: Record<string, unknown>
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}

export default function ProductMediaTab({
  productId,
  isNewProduct,
  formData: _formData,
  setFormData: _setFormData
}: ProductMediaTabProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [showBucketBrowser, setShowBucketBrowser] = useState(false)
  const [bucketImages, setBucketImages] = useState<Array<{name: string, url: string, path: string}>>([])
  const [loadingBucketImages, setLoadingBucketImages] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // 기존 미디어 데이터 로드
  useEffect(() => {
    if (!isNewProduct && productId) {
      fetchMedia()
    } else {
      setLoading(false)
    }
  }, [productId, isNewProduct])

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
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setSaveMessage(`미디어를 불러오는데 실패했습니다: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // 버킷에서 이미지 목록 가져오기 (모든 하위 폴더 포함)
  const fetchBucketImages = async () => {
    setLoadingBucketImages(true)
    try {
      // 모든 이미지를 수집할 배열
      const allImages: Array<{name: string, url: string, path: string}> = []

      // 루트 폴더의 이미지들 가져오기
      const { data: rootData, error: rootError } = await (supabase as any)
        .storage
        .from('product-media')
        .list('', {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (rootError) {
        console.error('루트 폴더 이미지 로드 오류:', rootError)
        throw rootError
      }

      // 루트 폴더의 이미지 파일들 처리
      const rootImageFiles = rootData?.filter((file: { name: string }) => 
        file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
      ) || []

      rootImageFiles.forEach((file: { name: string; id: string }) => {
        const { data: { publicUrl } } = supabase
          .storage
          .from('product-media')
          .getPublicUrl(file.name)
        
        allImages.push({
          name: file.name,
          url: publicUrl,
          path: file.name
        })
      })

      // 하위 폴더들 찾기
      const folders = rootData?.filter((item: { name: string }) => item.name && !item.name.includes('.')) || []

      // 각 하위 폴더의 이미지들 가져오기
      for (const folder of folders) {
        try {
          const { data: folderData, error: folderError } = await supabase
            .storage
            .from('product-media')
            .list(folder.name, {
              limit: 1000,
              sortBy: { column: 'created_at', order: 'desc' }
            })

          if (folderError) {
            console.warn(`폴더 ${folder.name} 로드 오류:`, folderError)
            continue
          }

          // 폴더 내의 이미지 파일들 처리
          const folderImageFiles = folderData?.filter((file: { name: string }) => 
            file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
          ) || []

          folderImageFiles.forEach((file) => {
            if (!file.id) return
            const filePath = `${folder.name}/${file.name}`
            const { data: { publicUrl } } = supabase
              .storage
              .from('product-media')
              .getPublicUrl(filePath)
            
            allImages.push({
              name: file.name,
              url: publicUrl,
              path: filePath
            })
          })

          // 폴더 내의 하위 폴더들도 확인 (재귀적으로 2단계까지만)
          const subFolders = folderData?.filter((item: { name: string }) => item.name && !item.name.includes('.')) || []
          
          for (const subFolder of subFolders) {
            try {
              const { data: subFolderData, error: subFolderError } = await supabase
                .storage
                .from('product-media')
                .list(`${folder.name}/${subFolder.name}`, {
                  limit: 1000,
                  sortBy: { column: 'created_at', order: 'desc' }
                })

              if (subFolderError) {
                console.warn(`하위 폴더 ${folder.name}/${subFolder.name} 로드 오류:`, subFolderError)
                continue
              }

              const subFolderImageFiles = subFolderData?.filter((file: { name: string }) => 
                file.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
              ) || []

              subFolderImageFiles.forEach((file) => {
                if (!file.id) return
                const filePath = `${folder.name}/${subFolder.name}/${file.name}`
                const { data: { publicUrl } } = supabase
                  .storage
                  .from('product-media')
                  .getPublicUrl(filePath)
                
                allImages.push({
                  name: file.name,
                  url: publicUrl,
                  path: filePath
                })
              })
            } catch (error) {
              console.warn(`하위 폴더 ${folder.name}/${subFolder.name} 처리 오류:`, error)
            }
          }
        } catch (error) {
          console.warn(`폴더 ${folder.name} 처리 오류:`, error)
        }
      }

      // 생성일 기준으로 정렬 (최신순)
      allImages.sort((a, b) => {
        // 파일명에서 타임스탬프 추출하여 정렬
        const getTimestamp = (path: string) => {
          const match = path.match(/(\d{13})/)
          return match ? parseInt(match[1]) : 0
        }
        return getTimestamp(b.path) - getTimestamp(a.path)
      })

      setBucketImages(allImages)
    } catch (error) {
      console.error('버킷 이미지 로드 오류:', error)
      setSaveMessage('버킷 이미지를 불러오는데 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setLoadingBucketImages(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return

    setUploading(true)
    setSaveMessage('')

    try {
      // 파일을 Supabase Storage에 업로드
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `products/${productId}/${fileName}`

      const { error: uploadError } = await (supabase as any)
        .storage
        .from('product-media')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 업로드된 파일의 공개 URL 생성
      const { data: { publicUrl } } = (supabase as any)
        .storage
        .from('product-media')
        .getPublicUrl(filePath)

      // 미디어 아이템 생성
      const newMedia: MediaItem = {
        product_id: productId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('video/') ? 'video' : 'document',
        file_size: file.size,
        mime_type: file.type,
        alt_text: '',
        caption: '',
        order_index: mediaItems.length,
        is_primary: mediaItems.length === 0, // 첫 번째 파일을 기본 이미지로 설정
        is_active: true
      }

      // 바로 데이터베이스에 저장
      const { data: savedMedia, error: saveError } = await (supabase as any)
        .from('product_media')
        .insert([newMedia])
        .select()
        .single()

      if (saveError) throw saveError

      setMediaItems(prev => [...prev, savedMedia])

    } catch (error) {
      console.error('파일 업로드 오류:', error)
      setSaveMessage('파일 업로드에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setUploading(false)
    }
  }

  const handleAddMedia = () => {
    fileInputRef.current?.click()
  }

  // 버킷 이미지를 미디어로 추가
  const handleAddFromBucket = async (imageUrl: string, fileName: string) => {
    try {
      // 미디어 아이템 생성
      const newMedia: MediaItem = {
        product_id: productId,
        file_name: fileName,
        file_url: imageUrl,
        file_type: 'image',
        file_size: 0, // 버킷에서 가져온 이미지는 크기를 알 수 없음
        mime_type: 'image/jpeg', // 기본값
        alt_text: '',
        caption: '',
        order_index: mediaItems.length,
        is_primary: mediaItems.length === 0, // 첫 번째 파일을 기본 이미지로 설정
        is_active: true
      }

      // 데이터베이스에 저장
      const { data: savedMedia, error: saveError } = await (supabase as any)
        .from('product_media')
        .insert([newMedia])
        .select()
        .single()

      if (saveError) throw saveError

      setMediaItems(prev => [...prev, savedMedia])
      setShowBucketBrowser(false)
      setSaveMessage('버킷 이미지가 미디어로 추가되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('버킷 이미지 추가 오류:', error)
      setSaveMessage('버킷 이미지 추가에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleMultipleFiles(files)
    }
  }

  // 복사 붙여넣기 핸들러
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const files: File[] = []

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault()
      handleMultipleFiles(files)
    }
  }

  // 여러 파일 처리
  const handleMultipleFiles = async (files: File[]) => {
    if (files.length === 0) return

    setUploading(true)
    setSaveMessage('')

    try {
      let successCount = 0
      let errorCount = 0

      for (const file of files) {
        try {
          await handleFileUpload(file)
          successCount++
        } catch (error) {
          console.error(`파일 업로드 실패: ${file.name}`, error)
          errorCount++
        }
      }

      if (successCount > 0) {
        setSaveMessage(`${successCount}개 파일이 업로드되었습니다.${errorCount > 0 ? ` (${errorCount}개 실패)` : ''}`)
        setTimeout(() => setSaveMessage(''), 5000)
      } else {
        setSaveMessage('모든 파일 업로드에 실패했습니다.')
        setTimeout(() => setSaveMessage(''), 3000)
      }
    } catch (error) {
      console.error('다중 파일 업로드 오류:', error)
      setSaveMessage('파일 업로드 중 오류가 발생했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setUploading(false)
    }
  }

  const handleEditMedia = (media: MediaItem) => {
    setEditingMedia(media)
    setShowAddModal(true)
    setPreviewUrl(media.file_url)
  }

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('이 미디어를 삭제하시겠습니까?')) return

    try {
      const { error } = await (supabase as any)
        .from('product_media')
        .delete()
        .eq('id', mediaId)

      if (error) throw error

      setMediaItems(prev => prev.filter(m => m.id !== mediaId))
      setSaveMessage('미디어가 삭제되었습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('미디어 삭제 오류:', error)
      setSaveMessage('미디어 삭제에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const handleSaveMedia = async (mediaData: MediaItem) => {
    setSaving(true)
    setSaveMessage('')

    try {
      if (mediaData.id) {
        // 업데이트
        const { error } = await (supabase as any)
          .from('product_media')
          .update({
            ...mediaData,
            updated_at: new Date().toISOString()
          })
          .eq('id', mediaData.id)

        if (error) throw error

        setMediaItems(prev => prev.map(m => m.id === mediaData.id ? mediaData : m))
      } else {
        // 새로 생성
        const { data, error } = await (supabase as any)
          .from('product_media')
          .insert([mediaData])
          .select()
          .single()

        if (error) throw error

        setMediaItems(prev => [...prev, data])
      }

      setSaveMessage('미디어가 저장되었습니다!')
      setTimeout(() => setSaveMessage(''), 3000)
      setShowAddModal(false)
      setEditingMedia(null)
      setPreviewUrl(null)
    } catch (error) {
      console.error('미디어 저장 오류:', error)
      setSaveMessage('미디어 저장에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const setAsPrimary = async (mediaId: string) => {
    try {
      // 모든 미디어의 is_primary를 false로 설정
      await (supabase as any)
        .from('product_media')
        .update({ is_primary: false })
        .eq('product_id', productId)

      // 선택된 미디어를 primary로 설정
      await (supabase as any)
        .from('product_media')
        .update({ is_primary: true })
        .eq('id', mediaId)

      setMediaItems(prev => prev.map(m => ({
        ...m,
        is_primary: m.id === mediaId
      })))

      setSaveMessage('대표 이미지가 설정되었습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('대표 이미지 설정 오류:', error)
      setSaveMessage('대표 이미지 설정에 실패했습니다.')
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return <Image className="h-4 w-4" />
      case 'video':
        return <Eye className="h-4 w-4" />
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Image className="h-5 w-5 mr-2" />
          미디어 관리
        </h3>
        <div className="flex items-center space-x-4">
          {saveMessage && (
            <div className={`flex items-center text-sm ${
              saveMessage.includes('성공') || saveMessage.includes('저장') ? 'text-green-600' : 'text-red-600'
            }`}>
              <AlertCircle className="h-4 w-4 mr-1" />
              {saveMessage}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setShowBucketBrowser(true)
              fetchBucketImages()
            }}
            disabled={isNewProduct}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            버킷에서 선택
          </button>
          <button
            type="button"
            onClick={handleAddMedia}
            disabled={isNewProduct || uploading}
            className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? '업로드 중...' : '미디어 추가'}
          </button>
        </div>
      </div>

      {isNewProduct && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <p className="text-yellow-800">
              새 상품의 경우 상품을 먼저 저장한 후 미디어를 추가할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0) {
            handleMultipleFiles(files)
          }
        }}
        className="hidden"
      />

      {/* 드래그 앤 드롭 영역 */}
      {!isNewProduct && (
        <div
          ref={dropZoneRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="space-y-4">
            <div className="flex justify-center">
              <Upload className={`h-12 w-12 ${isDragOver ? 'text-primary' : 'text-gray-400'}`} />
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                미디어 파일 업로드
              </h4>
              <p className="text-gray-600 mb-4">
                파일을 여기에 드래그하거나 클릭하여 선택하세요
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>• 이미지: JPG, PNG, GIF, WebP</p>
                <p>• 비디오: MP4, MOV, AVI</p>
                <p>• 문서: PDF, DOC, DOCX</p>
                <p>• 복사 붙여넣기: Ctrl+V (이미지)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddMedia}
              disabled={uploading}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? '업로드 중...' : '파일 선택'}
            </button>
          </div>
        </div>
      )}

      {/* 미디어 목록 */}
      {mediaItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Image className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>아직 등록된 미디어가 없습니다.</p>
          <p className="text-sm">미디어 추가 버튼을 클릭하여 첫 번째 미디어를 추가해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mediaItems.map((media) => (
            <div key={media.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="relative">
                {media.file_type === 'image' ? (
                  <img
                    src={media.file_url}
                    alt={media.alt_text || media.file_name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    {getFileIcon(media.file_type)}
                    <span className="ml-2 text-gray-500">{media.file_type}</span>
                  </div>
                )}
                
                {media.is_primary && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded text-xs flex items-center">
                    <Star className="h-3 w-3 mr-1" />
                    대표
                  </div>
                )}
                
                <div className="absolute top-2 right-2 flex space-x-1">
                  <button
                    type="button"
                    onClick={() => handleEditMedia(media)}
                    className="p-1 bg-white/80 rounded hover:bg-white"
                  >
                    <Edit className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMedia(media.id!)}
                    className="p-1 bg-white/80 rounded hover:bg-white"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                <h4 className="font-medium text-gray-900 truncate">{media.file_name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {formatFileSize(media.file_size)} • {media.file_type}
                </p>
                {media.caption && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{media.caption}</p>
                )}
                
                <div className="mt-3 flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setAsPrimary(media.id!)}
                    disabled={media.is_primary}
                    className="flex-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {media.is_primary ? '대표 이미지' : '대표로 설정'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 미디어 추가/편집 모달 */}
      {showAddModal && editingMedia && (
        <MediaModal
          media={editingMedia}
          onSave={handleSaveMedia}
          onClose={() => {
            setShowAddModal(false)
            setEditingMedia(null)
            setPreviewUrl(null)
          }}
          saving={saving}
          previewUrl={previewUrl}
        />
      )}

      {/* 버킷 이미지 브라우저 모달 */}
      {showBucketBrowser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FolderOpen className="h-5 w-5 mr-2" />
                버킷 이미지 선택
              </h3>
              <button
                type="button"
                onClick={() => setShowBucketBrowser(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                버킷에 저장된 이미지 중에서 미디어로 추가할 이미지를 선택하세요.
              </p>
            </div>

            {loadingBucketImages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-gray-600">이미지 로딩 중...</span>
              </div>
            ) : bucketImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {bucketImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer border border-gray-200 rounded-lg overflow-hidden hover:border-primary transition-colors"
                    onClick={() => handleAddFromBucket(image.url, image.name)}
                  >
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                      <Copy className="h-6 w-6 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs text-gray-600 truncate" title={image.name}>
                        {image.name}
                      </p>
                      {image.path !== image.name && (
                        <p className="text-xs text-gray-400 truncate" title={image.path}>
                          📁 {image.path}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>버킷에 이미지가 없습니다.</p>
                <p className="text-sm">먼저 이미지를 업로드해주세요.</p>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowBucketBrowser(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 미디어 추가/편집 모달 컴포넌트
interface MediaModalProps {
  media: MediaItem
  onSave: (media: MediaItem) => void
  onClose: () => void
  saving: boolean
  previewUrl: string | null
}

function MediaModal({ media, onSave, onClose, saving, previewUrl }: MediaModalProps) {
  const [formData, setFormData] = useState<MediaItem>(media)

  const handleSave = () => {
    onSave(formData)
  }

  const handleInputChange = (field: keyof MediaItem, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {media.id ? '미디어 편집' : '미디어 추가'}
        </h3>

        <div className="space-y-4">
          {/* 미리보기 */}
          {previewUrl && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                미리보기
              </label>
              <div className="border border-gray-300 rounded-lg p-4">
                {formData.file_type === 'image' ? (
                  <img
                    src={previewUrl}
                    alt={formData.alt_text || formData.file_name}
                    className="max-w-full max-h-64 object-contain mx-auto"
                  />
                ) : (
                  <div className="text-center text-gray-500">
                    <Download className="h-12 w-12 mx-auto mb-2" />
                    <p>{formData.file_name}</p>
                    <p className="text-sm">{formData.file_type}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              파일명
            </label>
            <input
              type="text"
              value={formData.file_name}
              onChange={(e) => handleInputChange('file_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              대체 텍스트 (Alt Text)
            </label>
            <input
              type="text"
              value={formData.alt_text}
              onChange={(e) => handleInputChange('alt_text', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="접근성을 위한 대체 텍스트를 입력해주세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              캡션
            </label>
            <textarea
              value={formData.caption}
              onChange={(e) => handleInputChange('caption', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="미디어에 대한 설명을 입력해주세요"
            />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_primary"
                checked={formData.is_primary}
                onChange={(e) => handleInputChange('is_primary', e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
              />
              <label htmlFor="is_primary" className="ml-2 text-sm text-gray-700">
                대표 이미지로 설정
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => handleInputChange('is_active', e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-ring border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                활성화
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
