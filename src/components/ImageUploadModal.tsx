'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image as ImageIcon, Eye } from 'lucide-react'

interface ImageUploadModalProps {
  onImageSelect: (imageUrl: string) => void
  onClose: () => void
  currentImage?: string
}

export default function ImageUploadModal({ 
  onImageSelect, 
  onClose, 
  currentImage 
}: ImageUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage || null)
  const [uploading, setUploading] = useState(false)
  const [viewMode, setViewMode] = useState(!!currentImage)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setViewMode(false) // 새 이미지 선택 시 업로드 모드로 전환
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      // 실제 업로드 로직은 여기에 구현
      // 예시: Supabase Storage에 업로드
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      // 임시로 로컬 URL 사용 (실제 구현에서는 서버에 업로드 후 URL 반환)
      const imageUrl = previewUrl || URL.createObjectURL(selectedFile)
      
      onImageSelect(imageUrl)
      onClose()
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onImageSelect('') // 빈 문자열로 이미지 제거
    onClose()
  }

  const switchToUploadMode = () => {
    setViewMode(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {viewMode ? '이미지 보기' : '이미지 업로드'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {viewMode ? (
            // 이미지 보기 모드
            <div className="space-y-4">
              <div className="text-center">
                <img
                  src={currentImage}
                  alt="업로드된 이미지"
                  className="mx-auto max-h-64 max-w-full object-contain rounded-lg"
                />
              </div>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={switchToUploadMode}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  이미지 변경
                </button>
                <button
                  onClick={handleRemoveImage}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  이미지 삭제
                </button>
              </div>
            </div>
          ) : (
            // 이미지 업로드 모드
            <>
              {/* 파일 선택 영역 */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {previewUrl ? (
                  <div className="space-y-2">
                    <img
                      src={previewUrl}
                      alt="미리보기"
                      className="mx-auto h-32 w-32 object-cover rounded-lg"
                    />
                    <p className="text-sm text-gray-600">클릭하여 이미지 변경</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="text-sm text-gray-600">클릭하여 이미지 선택</p>
                    <p className="text-xs text-gray-500">JPG, PNG, GIF 파일만 지원</p>
                  </div>
                )}
              </div>

              {/* 버튼 영역 */}
              <div className="flex justify-end space-x-2">
                {previewUrl && (
                  <button
                    onClick={handleRemoveImage}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    제거
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  취소
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!previewUrl || uploading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      업로드
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
