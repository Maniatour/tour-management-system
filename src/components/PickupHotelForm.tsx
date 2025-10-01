'use client'

import { useState, useRef } from 'react'
import { X, Upload, MapPin, Globe, Video, Trash2, Languages, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { translatePickupHotelFields, type PickupHotelTranslationFields } from '@/lib/translationService'

interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  description_ko: string | null
  description_en: string | null
  address: string
  pin: string | null
  link: string | null
  media: string[] | null
  is_active: boolean | null
  created_at: string | null
  updated_at: string | null
}

interface PickupHotelFormProps {
  hotel?: PickupHotel | null
  onSubmit: (hotelData: Omit<PickupHotel, 'id' | 'created_at' | 'updated_at'>) => void
  onCancel: () => void
  onDelete?: (id: string) => void // 삭제 함수를 추가
  translations: {
    title: string
    editTitle: string
    hotel: string
    pickUpLocation: string
    descriptionKo: string
    descriptionEn: string
    address: string
    pin: string
    link: string
    media: string
    cancel: string
    add: string
    edit: string
  }
}

export default function PickupHotelForm({ hotel, onSubmit, onCancel, onDelete, translations }: PickupHotelFormProps) {
  const [formData, setFormData] = useState({
    hotel: hotel?.hotel || '',
    pick_up_location: hotel?.pick_up_location || '',
    description_ko: hotel?.description_ko || '',
    description_en: hotel?.description_en || '',
    address: hotel?.address || '',
    pin: hotel?.pin || '',
    link: hotel?.link || '',
    media: hotel?.media || [],
    is_active: hotel?.is_active ?? true
  })

  const [uploading, setUploading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.hotel.trim()) {
      alert('호텔명을 입력해주세요.')
      return
    }

    if (!formData.pick_up_location.trim()) {
      alert('픽업 위치를 입력해주세요.')
      return
    }

    if (!formData.address.trim()) {
      alert('주소를 입력해주세요.')
      return
    }

    try {
      // 새로 업로드된 파일이 있는 경우 Supabase Storage에 업로드
      let uploadedMediaUrls = [...(formData.media || [])]
      
      if (mediaFiles.length > 0) {
        setUploading(true)
        const uploadPromises = mediaFiles.map(async (file) => {
          const fileName = `${Date.now()}_${file.name}`
          const { error } = await supabase.storage
            .from('pickup-hotel-media')
            .upload(fileName, file)

          if (error) {
            throw error
          }

          const { data: urlData } = supabase.storage
            .from('pickup-hotel-media')
            .getPublicUrl(fileName)

          return urlData.publicUrl
        })

        const newUrls = await Promise.all(uploadPromises)
        uploadedMediaUrls = [...uploadedMediaUrls, ...newUrls]
      }

      const hotelData = {
        ...formData,
        media: uploadedMediaUrls
      }

      onSubmit(hotelData)
    } catch (error) {
      console.error('Error uploading media:', error)
      alert('미디어 파일 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setMediaFiles(prev => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingMedia = (index: number) => {
    setFormData(prev => ({
      ...prev,
      media: prev.media?.filter((_, i) => i !== index) || []
    }))
  }

  // 구글 드라이브 URL을 다운로드 URL로 변환
  const convertGoogleDriveUrl = (url: string) => {
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (fileIdMatch) {
      const fileId = fileIdMatch[1]
      return `https://drive.google.com/uc?export=download&id=${fileId}`
    }
    return url
  }

  // URL 자동 변환 함수
  const handleUrlChange = (index: number, url: string) => {
    let processedUrl = url.trim()
    
    // 구글 드라이브 공유 링크인 경우 다운로드 URL로 변환
    if (processedUrl.includes('drive.google.com/file/d/')) {
      processedUrl = convertGoogleDriveUrl(processedUrl)
    }
    
    const newMedia = [...(formData.media || [])]
    if (processedUrl) {
      newMedia[index] = processedUrl
    } else {
      newMedia.splice(index, 1)
    }
    setFormData({ ...formData, media: newMedia })
  }

  // 번역 함수
  const translateHotelData = async () => {
    setTranslating(true)
    setTranslationError(null)

    try {
      // 번역할 필드들 수집
      const fieldsToTranslate: PickupHotelTranslationFields = {
        hotel: formData.hotel,
        pick_up_location: formData.pick_up_location,
        description_ko: formData.description_ko,
        address: formData.address
      }

      // 번역 실행
      const result = await translatePickupHotelFields(fieldsToTranslate)

      if (result.success && result.translatedFields) {
        // 번역된 내용을 영어 필드에 적용
        setFormData(prev => ({
          ...prev,
          description_en: result.translatedFields?.description_ko || prev.description_en
        }))

        // 번역된 호텔명과 픽업 위치를 별도로 표시하거나 처리할 수 있습니다
        console.log('번역된 호텔명:', result.translatedFields?.hotel)
        console.log('번역된 픽업 위치:', result.translatedFields?.pick_up_location)
        console.log('번역된 주소:', result.translatedFields?.address)
      } else {
        setTranslationError(result.error || '번역에 실패했습니다.')
      }
    } catch (error) {
      console.error('번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold">
              {hotel ? translations.editTitle : translations.title}
            </h2>
            {hotel && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-mono rounded-lg">
                ID: {hotel.id}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={translateHotelData}
              disabled={translating}
              className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
              title="한국어 내용을 영어로 번역"
            >
              {translating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Languages className="h-4 w-4 mr-1" />
              )}
              {translating ? '번역 중...' : '번역'}
            </button>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 번역 오류 메시지 */}
        {translationError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{translationError}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  type="button"
                  onClick={() => setTranslationError(null)}
                  className="inline-flex text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 호텔명과 픽업 위치 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {translations.hotel} *
              </label>
              <input
                type="text"
                value={formData.hotel}
                onChange={(e) => setFormData({ ...formData, hotel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={translations.hotel}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {translations.pickUpLocation} *
              </label>
              <input
                type="text"
                value={formData.pick_up_location}
                onChange={(e) => setFormData({ ...formData, pick_up_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={translations.pickUpLocation}
                required
              />
            </div>
          </div>

          {/* 한국어 설명과 영어 설명 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {translations.descriptionKo}
              </label>
              <textarea
                value={formData.description_ko}
                onChange={(e) => setFormData({ ...formData, description_ko: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={translations.descriptionKo}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {translations.descriptionEn}
              </label>
              <textarea
                value={formData.description_en}
                onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={translations.descriptionEn}
              />
            </div>
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translations.address} *
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={translations.address}
              required
            />
          </div>

          {/* 좌표와 구글 맵 링크 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {translations.pin}
              </label>
              <div className="flex items-center space-x-2">
                <MapPin size={20} className="text-gray-400" />
                <input
                  type="text"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 37.5665,126.9780"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {translations.link}
              </label>
              <div className="flex items-center space-x-2">
                <Globe size={20} className="text-gray-400" />
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>
          </div>

          {/* 활성화 상태 */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                픽업 호텔로 사용 (체크 해제 시 예약 폼에서 선택할 수 없음)
              </span>
            </label>
          </div>

          {/* 미디어 파일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translations.media}
            </label>
            
            {/* 구글 드라이브 URL 입력 */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">구글 드라이브 이미지 URL (최대 5개)</h4>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <span className="text-sm text-gray-500 w-8">#{index}</span>
                    <input
                      type="url"
                      placeholder={`구글 드라이브 이미지 URL ${index}`}
                      value={formData.media?.[index - 1] || ''}
                      onChange={(e) => handleUrlChange(index - 1, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {formData.media?.[index - 1] && (
                      <button
                        type="button"
                        onClick={() => {
                          const newMedia = [...(formData.media || [])]
                          newMedia.splice(index - 1, 1)
                          setFormData({ ...formData, media: newMedia })
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="URL 제거"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800 mb-2">
                  <strong>💡 사용 방법:</strong>
                </p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>구글 드라이브 이미지를 &quot;링크가 있는 모든 사용자&quot;로 공개 설정</li>
                  <li>공유 링크를 복사하여 위 입력 필드에 붙여넣기</li>
                  <li>자동으로 다운로드 URL로 변환됩니다</li>
                  <li>최대 5개의 이미지 URL을 입력할 수 있습니다</li>
                </ul>
              </div>
            </div>

            {/* 기존 미디어 표시 */}
            {formData.media && formData.media.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">미디어 미리보기:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {formData.media.map((url, index) => (
                    <div key={index} className="relative group">
                      {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('drive.google.com') ? (
                        <img
                          src={url}
                          alt={`미디어 ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                                  <div class="text-center">
                                    <div class="text-red-500 text-xs">이미지 로드 실패</div>
                                    <div class="text-gray-400 text-xs mt-1">URL 확인 필요</div>
                                  </div>
                                </div>
                              `
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Video size={24} className="text-gray-400" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExistingMedia(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 새 파일 업로드 (기존 기능 유지) */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center space-y-2 text-gray-600 hover:text-gray-800"
              >
                <Upload size={32} />
                <span>또는 파일을 선택하거나 여기로 드래그하세요</span>
                <span className="text-sm text-gray-500">지원 형식: JPG, PNG, GIF, MP4, MOV</span>
              </button>
            </div>

            {/* 선택된 파일 표시 */}
            {mediaFiles.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 파일:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {mediaFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`파일 ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Video size={24} className="text-gray-400" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {file.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            {hotel && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('정말로 이 호텔을 삭제하시겠습니까?')) {
                    // 삭제 함수를 props로 받아서 호출
                    if (onDelete) {
                      onDelete(hotel.id)
                    }
                  }
                }}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {translations.cancel}
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? '업로드 중...' : (hotel ? translations.edit : translations.add)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
