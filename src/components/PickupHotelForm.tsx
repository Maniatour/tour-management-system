'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Upload, MapPin, Globe, Image, Video, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
    media: hotel?.media || []
  })

  const [uploading, setUploading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          const { data, error } = await supabase.storage
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {hotel ? translations.editTitle : translations.title}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

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

          {/* 미디어 파일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translations.media}
            </label>
            
            {/* 기존 미디어 표시 */}
            {formData.media && formData.media.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">기존 미디어:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {formData.media.map((url, index) => (
                    <div key={index} className="relative group">
                      {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <img
                          src={url}
                          alt={`미디어 ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg"
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
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 새 파일 업로드 */}
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
                <span>파일을 선택하거나 여기로 드래그하세요</span>
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
