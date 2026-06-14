'use client'

import React, { useState, useRef } from 'react'
import {
  Upload,
  X,
  Image as ImageIcon,
  Trash2,
  Star,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TourCoursePhoto {
  id: string
  course_id: string
  photo_url: string
  photo_alt_ko?: string | null
  photo_alt_en?: string | null
  is_primary: boolean | null
  sort_order: number | null
  thumbnail_url?: string | null
  uploaded_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** storage 삭제용 (업로드 직후 로컬에만 보관) */
  storage_path?: string
}

interface PhotoUploadModalProps {
  isOpen: boolean
  onClose: () => void
  courseId: string
  existingPhotos?: TourCoursePhoto[]
  onPhotosUpdate: (photos: TourCoursePhoto[]) => void
}

function photoImageSrc(photo: TourCoursePhoto): string {
  if (photo.photo_url.startsWith('http')) return photo.photo_url
  if (photo.storage_path) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tour-course-photos/${photo.storage_path}`
  }
  return photo.photo_url
}

export default function PhotoUploadModal({
  isOpen,
  onClose,
  courseId,
  existingPhotos = [],
  onPhotosUpdate,
}: PhotoUploadModalProps) {
  const [photos, setPhotos] = useState<TourCoursePhoto[]>(existingPhotos)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return

    setUploading(true)
    const uploadPromises = Array.from(files).map(async (file) => {
      try {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`파일 ${file.name}이 너무 큽니다. (최대 10MB)`)
        }

        if (!file.type.startsWith('image/')) {
          throw new Error(`파일 ${file.name}은 이미지 파일이 아닙니다.`)
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `tour-courses/${courseId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('tour-course-photos')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('tour-course-photos')
          .getPublicUrl(filePath)

        const { data, error: insertError } = await supabase
          .from('tour_course_photos')
          .insert({
            course_id: courseId,
            photo_url: urlData.publicUrl,
            sort_order: photos.length,
            is_primary: photos.length === 0,
            uploaded_by: (await supabase.auth.getSession()).data.session?.user?.email || 'unknown',
          } as never)
          .select()
          .single()

        if (insertError) throw insertError

        return {
          ...(data as TourCoursePhoto),
          storage_path: filePath,
        }
      } catch (error) {
        console.error('파일 업로드 오류:', error)
        alert(`파일 업로드 중 오류가 발생했습니다: ${error}`)
        return null
      }
    })

    try {
      const uploadedPhotos = await Promise.all(uploadPromises)
      const validPhotos = uploadedPhotos.filter((photo): photo is NonNullable<typeof photo> => photo !== null) as TourCoursePhoto[]

      const newPhotos = [...photos, ...validPhotos]
      setPhotos(newPhotos)
      onPhotosUpdate(newPhotos)
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async (photoId: string) => {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return

    try {
      const photo = photos.find((p) => p.id === photoId)
      if (!photo) return

      if (photo.storage_path) {
        await supabase.storage.from('tour-course-photos').remove([photo.storage_path])
      }

      const { error } = await supabase.from('tour_course_photos').delete().eq('id', photoId)

      if (error) throw error

      const newPhotos = photos.filter((p) => p.id !== photoId)
      setPhotos(newPhotos)
      onPhotosUpdate(newPhotos)
    } catch (error) {
      console.error('사진 삭제 오류:', error)
      alert('사진 삭제 중 오류가 발생했습니다.')
    }
  }

  const setPrimaryPhoto = async (photoId: string) => {
    try {
      await supabase.from('tour_course_photos').update({ is_primary: false }).eq('course_id', courseId)

      const { error } = await supabase
        .from('tour_course_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (error) throw error

      const newPhotos = photos.map((p) => ({
        ...p,
        is_primary: p.id === photoId,
      }))
      setPhotos(newPhotos)
      onPhotosUpdate(newPhotos)
    } catch (error) {
      console.error('대표 사진 설정 오류:', error)
      alert('대표 사진 설정 중 오류가 발생했습니다.')
    }
  }

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

    if (e.dataTransfer.files?.[0]) {
      void handleFileUpload(e.dataTransfer.files)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      void handleFileUpload(e.target.files)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">투어 코스 사진 관리</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

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

        {photos.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={photoImageSrc(photo)}
                    alt={photo.photo_alt_ko || photo.photo_alt_en || 'tour course photo'}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                    <button
                      onClick={() => void setPrimaryPhoto(photo.id)}
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
                      onClick={() => void deletePhoto(photo.id)}
                      className="p-2 bg-white text-gray-600 rounded-full hover:bg-red-500 hover:text-white"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {photo.is_primary && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                    대표
                  </div>
                )}

                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded-full text-xs">
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        )}

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
