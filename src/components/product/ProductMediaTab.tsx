'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Image, Upload, Plus, Edit, Trash2, Save, AlertCircle, Eye, Download, Star } from 'lucide-react'
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
  formData: any
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export default function ProductMediaTab({
  productId,
  isNewProduct,
  formData,
  setFormData
}: ProductMediaTabProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileUpload = async (file: File) => {
    if (!file) return

    setUploading(true)
    setSaveMessage('')

    try {
      // 파일을 Supabase Storage에 업로드
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `products/${productId}/${fileName}`

      const { data: uploadData, error: uploadError } = await (supabase as any)
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

      setEditingMedia(newMedia)
      setShowAddModal(true)
      setPreviewUrl(publicUrl)

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">로딩 중...</span>
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
            onClick={handleAddMedia}
            disabled={isNewProduct || uploading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileUpload(file)
        }}
        className="hidden"
      />

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

  const handleInputChange = (field: keyof MediaItem, value: any) => {
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
