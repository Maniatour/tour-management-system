'use client'

import React, { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { 
  Upload, 
  X, 
  FileText, 
  Volume2, 
  Video, 
  Image, 
  MapPin, 
  Tag, 
  Globe,
  Clock,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

type TourAttraction = Database['public']['Tables']['tour_attractions']['Row']
type TourMaterialCategory = Database['public']['Tables']['tour_material_categories']['Row']

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function TourMaterialUploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const t = useTranslations('admin')
  const supabase = createClientSupabase()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [attractions, setAttractions] = useState<TourAttraction[]>([])
  const [categories, setCategories] = useState<TourMaterialCategory[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    attraction_id: '',
    category_id: '',
    language: 'ko',
    tags: [] as string[],
    file: null as File | null
  })
  const [tagInput, setTagInput] = useState('')

  // 파일 타입별 아이콘
  const getFileTypeIcon = (file: File) => {
    const type = file.type
    if (type.startsWith('audio/')) return <Volume2 className="w-5 h-5 text-green-500" />
    if (type.startsWith('video/')) return <Video className="w-5 h-5 text-purple-500" />
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-orange-500" />
    if (type.includes('pdf') || type.includes('text')) return <FileText className="w-5 h-5 text-blue-500" />
    return <FileText className="w-5 h-5 text-gray-500" />
  }

  // 파일 타입 결정
  const getFileType = (file: File) => {
    const type = file.type
    if (type.startsWith('audio/')) return 'audio'
    if (type.startsWith('video/')) return 'video'
    if (type.startsWith('image/')) return 'image'
    if (type.includes('pdf') || type.includes('text')) return 'script'
    return 'script'
  }

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 태그 추가
  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  // 태그 제거
  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // 파일 선택 핸들러
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 파일 크기 제한 (100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('파일 크기는 100MB를 초과할 수 없습니다.')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        file,
        title: prev.title || file.name.split('.')[0] // 파일명을 기본 제목으로 사용
      }))
    }
  }

  // 파일 드래그 앤 드롭 핸들러
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error('파일 크기는 100MB를 초과할 수 없습니다.')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        file,
        title: prev.title || file.name.split('.')[0]
      }))
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  // 업로드 실행
  const handleUpload = async () => {
    if (!formData.file) {
      toast.error('파일을 선택해주세요.')
      return
    }

    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }

    try {
      setLoading(true)

      // 파일 업로드
      const fileExt = formData.file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `tour-materials/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('tour-materials')
        .upload(filePath, formData.file)

      if (uploadError) throw uploadError

      // 데이터베이스에 메타데이터 저장
      const { error: insertError } = await supabase
        .from('tour_materials')
        .insert({
          title: formData.title,
          description: formData.description || null,
          attraction_id: formData.attraction_id || null,
          category_id: formData.category_id || null,
          file_name: formData.file.name,
          file_path: filePath,
          file_size: formData.file.size,
          file_type: getFileType(formData.file),
          mime_type: formData.file.type,
          language: formData.language,
          tags: formData.tags.length > 0 ? formData.tags : null,
          is_active: true,
          is_public: true
        })

      if (insertError) throw insertError

      toast.success('투어 자료가 성공적으로 업로드되었습니다.')
      onSuccess?.()
      handleClose()

    } catch (error) {
      console.error('업로드 오류:', error)
      toast.error('파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 모달 닫기
  const handleClose = () => {
    setFormData({
      title: '',
      description: '',
      attraction_id: '',
      category_id: '',
      language: 'ko',
      tags: [],
      file: null
    })
    setTagInput('')
    onClose()
  }

  // 관광지와 카테고리 로드
  const loadData = async () => {
    try {
      const [attractionsRes, categoriesRes] = await Promise.all([
        supabase.from('tour_attractions').select('*').eq('is_active', true).order('name_ko'),
        supabase.from('tour_material_categories').select('*').eq('is_active', true).order('sort_order')
      ])

      if (attractionsRes.error) throw attractionsRes.error
      if (categoriesRes.error) throw categoriesRes.error

      setAttractions(attractionsRes.data || [])
      setCategories(categoriesRes.data || [])
    } catch (error) {
      console.error('데이터 로드 오류:', error)
      toast.error('데이터를 불러오는 중 오류가 발생했습니다.')
    }
  }

  // 모달이 열릴 때 데이터 로드
  React.useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">투어 자료 업로드</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-6">
          {/* 파일 업로드 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              파일 선택
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {formData.file ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center">
                    {getFileTypeIcon(formData.file)}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{formData.file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(formData.file.size)}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFormData(prev => ({ ...prev, file: null }))
                    }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    파일 제거
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">
                    파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-xs text-gray-500">
                    지원 형식: PDF, TXT, MP3, MP4, JPG, PNG (최대 100MB)
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.doc,.docx,.mp3,.wav,.mp4,.avi,.jpg,.jpeg,.png"
              className="hidden"
            />
          </div>

          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="자료 제목을 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                언어
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="자료에 대한 설명을 입력하세요"
            />
          </div>

          {/* 관광지 및 카테고리 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                관광지
              </label>
              <select
                value={formData.attraction_id}
                onChange={(e) => setFormData(prev => ({ ...prev, attraction_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">관광지 선택 (선택사항)</option>
                {attractions.map(attraction => (
                  <option key={attraction.id} value={attraction.id}>
                    {attraction.name_ko}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                카테고리
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">카테고리 선택 (선택사항)</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name_ko}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              태그
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="태그를 입력하고 Enter를 누르세요"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={loading || !formData.file}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
            <span>{loading ? '업로드 중...' : '업로드'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
