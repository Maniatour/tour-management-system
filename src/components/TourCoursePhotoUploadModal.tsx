'use client'

import React, { useState, useRef } from 'react'
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Trash2, 
  Star,
  RotateCcw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourCoursePhoto {
  id: string
  course_id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  mime_type: string
  thumbnail_url?: string
  is_primary: boolean
  sort_order: number
  uploaded_by?: string
  created_at: string
  updated_at: string
}

interface PhotoUploadModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  existingPhotos?: TourCoursePhoto[]
  onPhotosUpdate: (photos: TourCoursePhoto[]) => void
}

export default function PhotoUploadModal({ 
  isOpen, 
  onClose, 
  courseId,
  existingPhotos = [],
  onPhotosUpdate 
}: PhotoUploadModalProps) {
  const [photos, setPhotos] = useState<TourCoursePhoto[]>(existingPhotos)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 파일 업로드 처리
  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setUploading(true)
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        // 파일 크기 체크 (10MB 제한)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`파일 ${file.name}이 너무 큽니다. (최대 10MB)`)
        }

        // 파일 타입 체크
        if (!file.type.startsWith('image/')) {
          throw new Error(`파일 ${file.name}은 이미지 파일이 아닙니다.`)
        }

        // 고유한 파일명 생성
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `tour-courses/${courseId}/${fileName}`

        // Supabase Storage에 업로드
        const { error: uploadError } = await supabase.storage
          .from('tour-course-photos')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // 데이터베이스에 메타데이터 저장
        const { data, error: insertError } = await supabase
          .from('tour_course_photos')
          .insert({
            course_id: courseId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: fileExt || '',
            mime_type: file.type,
            sort_order: photos.length,
            uploaded_by: (await supabase.auth.getUser()).data.user?.email || 'unknown'
          })
          .select()
          .single()

        if (insertError) throw insertError

        return data
      } catch (error) {
        console.error('파일 업로드 오류:', error)
        alert(`파일 업로드 중 오류가 발생했습니다: ${error}`)
        return null
      }
    })

    try {
      const uploadedPhotos = await Promise.all(uploadPromises)
      const validPhotos = uploadedPhotos.filter(photo => photo !== null) as TourCoursePhoto[]
      
      const newPhotos = [...photos, ...validPhotos]
      setPhotos(newPhotos)
      onPhotosUpdate(newPhotos)
    } finally {
      setUploading(false)
    }
  }

  // 파일 삭제
  const deletePhoto = async (photoId: string) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return

    try {
      const photo = photos.find(p => p.id === photoId)
      if (!photo) return

      // Storage에서 파일 삭제
      await supabase.storage
        .from('tour-course-photos')
        .remove([photo.file_path])

      // 데이터베이스에서 레코드 삭제
      const { error } = await supabase
        .from('tour_course_photos')
        .delete()
        .eq('id', photoId)

      if (error) throw error

      const newPhotos = photos.filter(p => p.id !== photoId)
      setPhotos(newPhotos)
      onPhotosUpdate(newPhotos)
    } catch (error) {
      console.error('사진 삭제 오류:', error)
      alert('사진 삭제 중 오류가 발생했습니다.')
    }
  }

  // 대표 사진 설정
  const setPrimaryPhoto = async (photoId: string) => {
    try {
      // 기존 대표 사진 해제
      await supabase
        .from('tour_course_photos')
        .update({ is_primary: false })
        .eq('course_id', courseId)

      // 새 대표 사진 설정
      const { error } = await supabase
        .from('tour_course_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (error) throw error

      const newPhotos = photos.map(p => ({
        ...p,
        is_primary: p.id === photoId
      }))
      setPhotos(newPhotos)
      onPhotosUpdate(newPhotos)
    } catch (error) {
      console.error('대표 사진 설정 오류:', error)
      alert('대표 사진 설정 중 오류가 발생했습니다.')
    }
  }

  // 드래그 앤 드롭 처리
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">투어 코스 사진 관리</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 업로드 영역 */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 ${
            dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600 mb-2">
            사진을 드래그하여 업로드하거나 클릭하여 선택하세요
          </p>
          <p className="text-sm text-gray-500 mb-4">
            JPG, PNG, GIF 파일만 지원됩니다. (최대 10MB)
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mx-auto"
          >
            <Upload className="w-4 h-4" />
            {uploading ? '업로드 중...' : '파일 선택'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* 사진 목록 */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.file_path}`}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* 오버레이 */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                    <button
                      onClick={() => setPrimaryPhoto(photo.id)}
                      className={`p-2 rounded-full ${
                        photo.is_primary 
                          ? 'bg-yellow-500 text-white' 
                          : 'bg-white text-gray-600 hover:bg-yellow-500 hover:text-white'
                      }`}
                      title={photo.is_primary ? '대표 사진' : '대표 사진으로 설정'}
                    >
                      <Star className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="p-2 bg-white text-gray-600 rounded-full hover:bg-red-500 hover:text-white"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 대표 사진 표시 */}
                {photo.is_primary && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    대표
                  </div>
                )}

                {/* 순서 표시 */}
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 사진이 없을 때 */}
        {photos.length === 0 && (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">아직 업로드된 사진이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
}
