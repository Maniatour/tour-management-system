'use client'

import React, { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'

interface ImageUploadProps {
  imageUrl?: string
  thumbnailUrl?: string
  imageAlt?: string
  onImageChange: (imageUrl: string, thumbnailUrl: string, imageAlt: string) => void
  onImageRemove?: () => void
  folder?: string
  className?: string
}

export default function ImageUpload({
  imageUrl,
  thumbnailUrl,
  imageAlt,
  onImageChange,
  onImageRemove,
  folder = 'options',
  className = ''
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file) return

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      alert('지원하지 않는 파일 형식입니다. JPEG, PNG, GIF, WebP 파일만 업로드 가능합니다.')
      return
    }

    // 파일 크기 검증 (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert('파일 크기가 너무 큽니다. 최대 5MB까지 업로드 가능합니다.')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        const altText = imageAlt || file.name.split('.')[0]
        onImageChange(result.imageUrl, result.thumbnailUrl, altText)
      } else {
        alert(result.error || '이미지 업로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('이미지 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleRemoveImage = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!onImageRemove) return
    
    // 삭제 확인
    if (!confirm('이미지를 삭제하시겠습니까?')) {
      return
    }
    
    // 먼저 UI에서 이미지 제거 (즉시 반영)
    onImageRemove()
    
    // 백그라운드에서 스토리지에서 삭제 시도
    if (imageUrl) {
      try {
        // Supabase Storage URL에서 파일 경로 추출
        let filePath = ''
        
        // 다양한 URL 형식 처리
        if (imageUrl.includes('/storage/v1/object/public/')) {
          // Supabase public URL 형식: https://xxx.supabase.co/storage/v1/object/public/images/...
          const urlParts = imageUrl.split('/storage/v1/object/public/')
          if (urlParts.length > 1) {
            filePath = urlParts[1].split('?')[0] // 쿼리 파라미터 제거
          }
        } else {
          // 일반 URL 형식 처리
          try {
            const url = new URL(imageUrl)
            const pathParts = url.pathname.split('/')
            const bucketIndex = pathParts.findIndex(part => part === 'images')
            if (bucketIndex !== -1 && bucketIndex + 1 < pathParts.length) {
              filePath = pathParts.slice(bucketIndex + 1).join('/')
            }
          } catch {
            // URL 파싱 실패 시 경로에서 직접 추출
            const match = imageUrl.match(/images\/(.+)/)
            if (match) {
              filePath = match[1].split('?')[0]
            }
          }
        }
        
        // 파일 경로를 찾았으면 삭제 API 호출 (에러는 로그만 남기고 사용자에게는 알리지 않음)
        if (filePath) {
          fetch(`/api/upload/image?path=${encodeURIComponent(filePath)}`, {
            method: 'DELETE'
          }).catch(error => {
            console.error('Failed to delete image from storage:', error)
            // 스토리지 삭제 실패는 조용히 처리 (UI는 이미 제거됨)
          })
        }
      } catch (error) {
        console.error('Error deleting image:', error)
        // 에러는 로그만 남김
      }
    }
  }

  if (imageUrl) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden group">
          <img
            src={thumbnailUrl || imageUrl}
            alt={imageAlt || 'Uploaded image'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          {onImageRemove && (
            <button
              onClick={handleRemoveImage}
              type="button"
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors z-10 shadow-lg"
              title="이미지 삭제"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {imageAlt && <div>대체 텍스트: {imageAlt}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        {uploading ? (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-600">업로드 중...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <ImageIcon className="w-8 h-8 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">
                <span className="text-blue-500 font-medium">클릭</span>하거나 파일을 드래그하여 업로드
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPEG, PNG, GIF, WebP (최대 5MB)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
