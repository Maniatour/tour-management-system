'use client'

import React, { useState, useEffect } from 'react'
import { X, Upload, MapPin, Tag, Globe, Clock } from 'lucide-react'
import { createClientSupabase } from '@/lib/supabase'
import { Database } from '@/lib/database.types'
import { toast } from 'sonner'

type TourAttraction = Database['public']['Tables']['tour_attractions']['Row']
type TourMaterialCategory = Database['public']['Tables']['tour_material_categories']['Row']
type TourMaterial = Database['public']['Tables']['tour_materials']['Row']

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  material: TourMaterial | null
  onSuccess?: () => void
}

export default function TourMaterialEditModal({ isOpen, onClose, material, onSuccess }: EditModalProps) {
  const supabase = createClientSupabase()
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

  // 모달이 열릴 때 데이터 로드
  useEffect(() => {
    if (isOpen && material) {
      setFormData({
        title: material.title || '',
        description: material.description || '',
        attraction_id: material.attraction_id || '',
        category_id: material.category_id || '',
        language: material.language || 'ko',
        tags: material.tags || [],
        file: null
      })
      loadData()
    }
  }, [isOpen, material])

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

  // 파일 선택
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData(prev => ({ ...prev, file }))
    }
  }

  // 드래그 앤 드롭
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, file }))
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // 오디오 파일의 duration 추출
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const url = URL.createObjectURL(file)
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url)
        resolve(Math.floor(audio.duration))
      })
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url)
        reject(new Error('오디오 파일을 로드할 수 없습니다.'))
      })
      
      audio.src = url
    })
  }

  // 파일 타입 결정
  const getFileType = (file: File) => {
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    if (file.type.startsWith('image/')) return 'image'
    return 'script'
  }

  // 수정 실행
  const handleUpdate = async () => {
    if (!material) return

    if (!formData.title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }

    try {
      setLoading(true)

      let updateData: any = {
        title: formData.title,
        description: formData.description || null,
        attraction_id: formData.attraction_id || null,
        category_id: formData.category_id || null,
        language: formData.language,
        tags: formData.tags.length > 0 ? formData.tags : null,
        updated_at: new Date().toISOString()
      }

      // 새 파일이 업로드된 경우
      if (formData.file) {
        // 오디오 파일인 경우 duration 추출
        let duration = material.duration
        if (formData.file.type.startsWith('audio/')) {
          duration = await getAudioDuration(formData.file)
        }

        // 새 파일 업로드
        const fileExt = formData.file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `tour-materials/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('tour-materials')
          .upload(filePath, formData.file)

        if (uploadError) throw uploadError

        // 기존 파일 삭제
        if (material.file_path) {
          await supabase.storage
            .from('tour-materials')
            .remove([material.file_path])
        }

        updateData = {
          ...updateData,
          file_name: formData.file.name,
          file_path: filePath,
          file_size: formData.file.size,
          file_type: getFileType(formData.file),
          mime_type: formData.file.type,
          duration: duration
        }
      }

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from('tour_materials')
        .update(updateData)
        .eq('id', material.id)

      if (updateError) throw updateError

      toast.success('투어 자료가 성공적으로 수정되었습니다.')
      onSuccess?.()
      handleClose()

    } catch (error) {
      console.error('수정 오류:', error)
      toast.error('파일 수정 중 오류가 발생했습니다.')
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

  if (!isOpen || !material) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">투어 자료 수정</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="투어 자료 제목을 입력하세요"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="투어 자료 설명을 입력하세요"
            />
          </div>

          {/* 관광지 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              관광지
            </label>
            <select
              value={formData.attraction_id}
              onChange={(e) => setFormData(prev => ({ ...prev, attraction_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">관광지를 선택하세요</option>
              {attractions.map(attraction => (
                <option key={attraction.id} value={attraction.id}>
                  {attraction.name_ko}
                </option>
              ))}
            </select>
          </div>

          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">카테고리를 선택하세요</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name_ko}
                </option>
              ))}
            </select>
          </div>

          {/* 언어 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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

          {/* 태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              태그
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="태그를 입력하고 Enter를 누르세요"
              />
              <button
                onClick={addTag}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center space-x-1"
                >
                  <span>{tag}</span>
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:text-blue-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* 파일 업로드 (선택사항) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              새 파일 업로드 (선택사항)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 mb-2">파일을 드래그하거나 클릭하여 선택하세요</p>
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".pdf,.txt,.doc,.docx,.mp3,.wav,.mp4,.avi,.jpg,.jpeg,.png,.gif"
              />
              <label
                htmlFor="file-upload"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                파일 선택
              </label>
              {formData.file && (
                <p className="mt-2 text-sm text-gray-600">
                  선택된 파일: {formData.file.name}
                </p>
              )}
            </div>
          </div>

          {/* 현재 파일 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">현재 파일 정보</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>파일명:</strong> {material.file_name}</p>
              <p><strong>파일 크기:</strong> {Math.round(material.file_size / 1024)}KB</p>
              <p><strong>파일 타입:</strong> {material.file_type}</p>
              {material.duration && (
                <p><strong>재생 시간:</strong> {Math.floor(material.duration / 60)}:{String(material.duration % 60).padStart(2, '0')}</p>
              )}
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleUpdate}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '수정 중...' : '수정'}
          </button>
        </div>
      </div>
    </div>
  )
}
