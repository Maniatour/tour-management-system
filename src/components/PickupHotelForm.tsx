'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { X, Upload, MapPin, Globe, Video, Trash2, Languages, Loader2, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { translatePickupHotelFields, type PickupHotelTranslationFields } from '@/lib/translationService'
import { suggestHotelDescription } from '@/lib/chatgptService'

// Google Maps 타입 정의
interface GoogleMapsMap {
  addListener: (event: string, callback: (event: GoogleMapsMapMouseEvent) => void) => void
}

interface GoogleMapsMarker {
  setMap: (map: GoogleMapsMap | null) => void
}

interface GoogleMapsAdvancedMarker {
  position: { lat: () => number; lng: () => number }
  setPosition: (position: { lat: number; lng: number }) => void
  addListener: (event: string, callback: () => void) => void
  setMap: (map: GoogleMapsMap | null) => void
}

interface GoogleMapsMapMouseEvent {
  latLng?: {
    lat: () => number
    lng: () => number
  }
}

interface GoogleMapsMapTypeId {
  ROADMAP: string
}

interface GoogleMapsGeocoder {
  geocode: (request: { location?: { lat: number; lng: number }; address?: string }, callback: (results: GoogleMapsGeocoderResult[] | null, status: string) => void) => void
}

interface GoogleMapsGeocoderResult {
  formatted_address: string
  geometry: {
    location: {
      lat: () => number
      lng: () => number
    }
  }
}

declare global {
  interface Window {
    google: {
      maps: {
        Map: new (element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number; mapTypeId: string }) => GoogleMapsMap
        Marker: new (options: { position: { lat: number; lng: number }; map: GoogleMapsMap; title: string }) => GoogleMapsMarker
        MapTypeId: GoogleMapsMapTypeId
        Geocoder: new () => GoogleMapsGeocoder
        MapMouseEvent: GoogleMapsMapMouseEvent
        marker: {
          AdvancedMarkerElement: new (options: { position: { lat: number; lng: number }; map: GoogleMapsMap; title: string; draggable?: boolean }) => GoogleMapsAdvancedMarker
        }
      }
    }
  }
}

interface PickupHotel {
  id: string
  hotel: string
  pick_up_location: string
  description_ko: string | null
  description_en: string | null
  address: string
  pin: string | null
  link: string | null
  youtube_link: string | null
  media: string[] | null
  is_active: boolean | null
  group_number: number | null
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

// YouTube URL 유효성 검사 함수
const isValidYouTubeUrl = (url: string): boolean => {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/
  return youtubeRegex.test(url)
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
    youtube_link: hotel?.youtube_link || '',
    media: hotel?.media || [],
    is_active: hotel?.is_active ?? true,
    group_number: hotel?.group_number || null
  })

  const [uploading, setUploading] = useState(false)
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [googleDriveUrls, setGoogleDriveUrls] = useState<string[]>([''])
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('')
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedGoogleMapLink, setSelectedGoogleMapLink] = useState<string>('')
  const [mapLoaded, setMapLoaded] = useState(false)

  // 기존 호텔 데이터 로드 시 구글 드라이브 URL 초기화
  useEffect(() => {
    if (hotel?.media && hotel.media.length > 0) {
      const driveUrls = hotel.media.filter(url => url.includes('drive.google.com'))
      if (driveUrls.length > 0) {
        setGoogleDriveUrls(driveUrls)
      }
    }
  }, [hotel])

  // 구글맵에서 좌표 선택
  const handleMapCoordinateSelect = (lat: number, lng: number, address?: string) => {
    const coordinates = `${lat}, ${lng}`
    const googleMapLink = `https://www.google.com/maps?q=${lat},${lng}`
    
    setFormData(prev => ({
      ...prev,
      pin: coordinates,
      address: address || prev.address,
      link: googleMapLink
    }))
    setShowMapModal(false)
  }

  // Google Maps 초기화
  const initializeMap = () => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      const mapElement = document.getElementById('map')
      if (!mapElement) return

      // Map ID 설정
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
      console.log('PickupHotelForm Map ID:', mapId ? '설정됨' : '설정되지 않음', mapId)
      
      const mapOptions: {
        center: { lat: number; lng: number }
        zoom: number
        mapTypeId: string
        mapId?: string
      } = {
        center: { lat: 36.1699, lng: -115.1398 }, // 라스베가스 중심
        zoom: 12,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP
      }
      
      // Map ID가 있으면 Advanced Markers를 위한 맵 ID 설정
      if (mapId) {
        mapOptions.mapId = mapId
        console.log('PickupHotelForm - Advanced Markers Map ID 설정:', mapId)
      } else {
        console.warn('PickupHotelForm - Map ID 없음, 기본 마커 사용')
      }

      const map = new window.google.maps.Map(mapElement, mapOptions)

      let marker: GoogleMapsAdvancedMarker | null = null

      // 지도 클릭 이벤트
      map.addListener('click', (event: GoogleMapsMapMouseEvent) => {
        const lat = event.latLng?.lat()
        const lng = event.latLng?.lng()
        
        if (lat && lng) {
          // 기존 마커 제거
          if (marker) {
            marker.setMap(null)
          }

          // 새로운 Advanced Marker 추가
          if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
            marker = new window.google.maps.marker.AdvancedMarkerElement({
              position: { lat, lng },
              map: map,
              title: '선택된 위치'
            })
            console.log('PickupHotelForm 클릭 - Advanced Marker 생성 성공')
          } else {
            marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: map,
              title: '선택된 위치'
            }) as GoogleMapsAdvancedMarker
            console.log('PickupHotelForm 클릭 - 기본 Marker 사용')
          }

          // 좌표 입력 필드 업데이트
          const latInput = document.getElementById('latitude') as HTMLInputElement
          const lngInput = document.getElementById('longitude') as HTMLInputElement
          if (latInput) latInput.value = lat.toString()
          if (lngInput) lngInput.value = lng.toString()

          // 역지오코딩으로 주소 가져오기
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results: GoogleMapsGeocoderResult[] | null, status: string) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address
              setSelectedAddress(address)
              setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
            }
          })
        }
      })

      setMapLoaded(true)
    }
  }

  // 지도 검색 함수
  const handleMapSearch = async () => {
    const searchTerm = (document.getElementById('mapSearch') as HTMLInputElement)?.value
    if (!searchTerm) return

    try {
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ address: searchTerm + ' Las Vegas' }, (results: GoogleMapsGeocoderResult[] | null, status: string) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location
          const lat = location.lat()
          const lng = location.lng()
          const address = results[0].formatted_address

          // 지도 중심 이동
          const mapElement = document.getElementById('map')
          if (mapElement && window.google && window.google.maps) {
            // Map ID 설정
            const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
            console.log('PickupHotelForm Search Map ID:', mapId ? '설정됨' : '설정되지 않음', mapId)
            
            const mapOptions: {
              center: { lat: number; lng: number }
              zoom: number
              mapTypeId: string
              mapId?: string
            } = {
              center: { lat, lng },
              zoom: 15,
              mapTypeId: window.google.maps.MapTypeId.ROADMAP
            }
            
            // Map ID가 있으면 Advanced Markers를 위한 맵 ID 설정
            if (mapId) {
              mapOptions.mapId = mapId
              console.log('PickupHotelForm Search - Advanced Markers Map ID 설정:', mapId)
            } else {
              console.warn('PickupHotelForm Search - Map ID 없음, 기본 마커 사용')
            }

            const map = new window.google.maps.Map(mapElement, mapOptions)

            // 새로운 Advanced Marker 추가
            if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
              new window.google.maps.marker.AdvancedMarkerElement({
                position: { lat, lng },
                map: map,
                title: searchTerm
              })
              console.log('PickupHotelForm 검색 - Advanced Marker 생성 성공')
            } else {
              new window.google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: searchTerm
              })
              console.log('PickupHotelForm 검색 - 기본 Marker 사용')
            }

            // 좌표 입력 필드 업데이트
            const latInput = document.getElementById('latitude') as HTMLInputElement
            const lngInput = document.getElementById('longitude') as HTMLInputElement
            if (latInput) latInput.value = lat.toString()
            if (lngInput) lngInput.value = lng.toString()

            // 주소 정보 업데이트
            setSelectedAddress(address)
            setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
          }
        } else {
          alert('검색 결과를 찾을 수 없습니다.')
        }
      })
    } catch (error) {
      console.error('검색 오류:', error)
      alert('검색 중 오류가 발생했습니다.')
    }
  }

  // 모달이 열릴 때 지도 초기화
  useEffect(() => {
    if (showMapModal && !mapLoaded) {
      // Google Maps API 스크립트 로드
      if (!window.google) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
          alert('Google Maps API 키가 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요.')
          return
        }
        
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
        script.async = true
        script.defer = true
        script.onload = () => {
          setTimeout(initializeMap, 100)
        }
        script.onerror = () => {
          alert('Google Maps API 로드 중 오류가 발생했습니다. API 키를 확인해주세요.')
        }
        document.head.appendChild(script)
      } else {
        setTimeout(initializeMap, 100)
      }
    }
  }, [showMapModal, mapLoaded])

  // 구글 드라이브 URL 추가
  const addGoogleDriveUrl = () => {
    setGoogleDriveUrls(prev => [...prev, ''])
  }

  // 구글 드라이브 URL 업데이트
  const updateGoogleDriveUrl = (index: number, value: string) => {
    setGoogleDriveUrls(prev => {
      const newUrls = [...prev]
      newUrls[index] = value
      return newUrls
    })
  }

  // 구글 드라이브 URL 제거
  const removeGoogleDriveUrl = (index: number) => {
    setGoogleDriveUrls(prev => prev.filter((_, i) => i !== index))
  }

  // 이미지 확대 보기
  const handleImageClick = (url: string) => {
    setSelectedImageUrl(url)
    setShowImageModal(true)
  }

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

    // YouTube 링크 유효성 검사
    if (formData.youtube_link && !isValidYouTubeUrl(formData.youtube_link)) {
      alert('올바른 YouTube 링크를 입력해주세요. (예: https://www.youtube.com/watch?v=...)')
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

      // 구글 드라이브 URL을 다운로드 URL로 변환
      const convertedGoogleDriveUrls = googleDriveUrls
        .filter(url => url.trim())
        .map(url => {
          // 구글 드라이브 공유 링크인 경우 다운로드 URL로 변환
          if (url.includes('drive.google.com/file/d/')) {
            const fileId = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
            if (fileId) {
              return `https://drive.google.com/uc?export=view&id=${fileId}`
            }
          }
          return url
        })

      const hotelData = {
        ...formData,
        media: [...uploadedMediaUrls, ...convertedGoogleDriveUrls]
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

  // ChatGPT 추천 함수
  const suggestHotelDescriptionContent = async () => {
    setSuggesting(true)
    setSuggestionError(null)

    try {
      const suggestedDescription = await suggestHotelDescription(formData.hotel, formData.address)
      
      setFormData(prev => ({
        ...prev,
        description_ko: suggestedDescription
      }))
    } catch (error) {
      console.error('ChatGPT 추천 오류:', error)
      setSuggestionError(error instanceof Error ? error.message : 'ChatGPT 추천 중 오류가 발생했습니다.')
    } finally {
      setSuggesting(false)
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
          <div className="flex items-center space-x-6">
            {/* 픽업 호텔로 사용 온오프 스위치 */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">픽업 호텔로 사용</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  formData.is_active ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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
              type="button"
              onClick={suggestHotelDescriptionContent}
              disabled={suggesting}
              className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
              title="ChatGPT로 호텔 설명 추천받기"
            >
              {suggesting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {suggesting ? '추천 중...' : 'AI 추천'}
            </button>
              <button
                onClick={onCancel}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
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

        {/* ChatGPT 추천 오류 메시지 */}
        {suggestionError && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <X className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{suggestionError}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  type="button"
                  onClick={() => setSuggestionError(null)}
                  className="inline-flex text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 호텔명, 픽업 위치, 그룹 번호 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                그룹 번호
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.group_number || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  group_number: e.target.value ? parseFloat(e.target.value) : null 
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 1.0, 1.1, 2.0"
              />
              <p className="text-xs text-gray-500 mt-1">
                소숫점 지원 (예: 1.0, 1.1, 2.0)
              </p>
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
                <button
                  type="button"
                  onClick={() => setShowMapModal(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  지도에서 선택
                </button>
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

          {/* YouTube 링크 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube 링크
            </label>
            <div className="flex items-center space-x-2">
              <Video size={20} className="text-gray-400" />
              <input
                type="url"
                value={formData.youtube_link}
                onChange={(e) => setFormData({ ...formData, youtube_link: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              호텔 소개 영상이나 픽업 장소 안내 영상의 YouTube 링크를 입력하세요.
            </p>
          </div>


          {/* 미디어 파일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {translations.media}
            </label>
            
            {/* 구글 드라이브 URL과 파일 업로드를 좌우로 배치 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 구글 드라이브 URL 입력 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">구글 드라이브 이미지 URL</h4>
                <div className="space-y-3">
                  {googleDriveUrls.map((url, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500 w-8">#{index + 1}</span>
                      <input
                        type="url"
                        placeholder={`구글 드라이브 이미지 URL ${index + 1}`}
                        value={url}
                        onChange={(e) => updateGoogleDriveUrl(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {url && (
                        <button
                          type="button"
                          onClick={() => removeGoogleDriveUrl(index)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="URL 제거"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  {googleDriveUrls.length < 5 && googleDriveUrls[googleDriveUrls.length - 1] && (
                    <button
                      type="button"
                      onClick={addGoogleDriveUrl}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      + URL 추가
                    </button>
                  )}
                </div>
              </div>

              {/* 파일 업로드 */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">파일 업로드</h4>

                {/* 새 파일 업로드 */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
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
                    <Upload size={24} />
                    <span className="text-sm">파일 선택</span>
                    <span className="text-xs text-gray-500">JPG, PNG, GIF, MP4, MOV</span>
                  </button>
                </div>

                {/* 선택된 파일 표시 */}
                {mediaFiles.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">선택된 파일:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {mediaFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          {file.type.startsWith('image/') ? (
                            <Image
                              src={URL.createObjectURL(file)}
                              alt={`파일 ${index + 1}`}
                              width={200}
                              height={96}
                              className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => handleImageClick(URL.createObjectURL(file))}
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
            </div>
          </div>

          {/* 이미지 미리보기 - 전체 넓이 사용 */}
          {formData.media && formData.media.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">미디어 미리보기</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {formData.media.map((url, index) => (
                  <div key={index} className="relative group">
                    {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('drive.google.com') ? (
                      <Image
                        src={url}
                        alt={`미디어 ${index + 1}`}
                        width={200}
                        height={128}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => handleImageClick(url)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
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
                      <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Video size={24} className="text-gray-400" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingMedia(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      #{index + 1}
                    </div>
                    {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('drive.google.com') && (
                      <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        클릭하여 확대
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

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

      {/* 구글맵 좌표 선택 모달 */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">위치 선택</h3>
              <button
                onClick={() => setShowMapModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                라스베가스 지역에서 호텔 위치를 검색하거나 지도에서 클릭하여 좌표를 선택하세요.
              </p>
              
              {/* 검색 기능 */}
              <div className="mb-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    id="mapSearch"
                    placeholder="호텔명 또는 주소를 검색하세요 (예: Bellagio Hotel)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleMapSearch()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleMapSearch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    검색
                  </button>
                </div>
              </div>

              {/* 검색 결과 미리보기 */}
              {selectedAddress && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-sm font-medium text-green-800 mb-2">검색 결과:</h4>
                  <p className="text-sm text-green-700 mb-1">
                    <strong>주소:</strong> {selectedAddress}
                  </p>
                  <p className="text-sm text-green-700 mb-1">
                    <strong>구글 맵 링크:</strong> 
                    <a 
                      href={selectedGoogleMapLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-1 text-blue-600 hover:text-blue-800 underline"
                    >
                      링크 열기
                    </a>
                  </p>
                </div>
              )}

              {/* 지도 컨테이너 */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <div 
                  id="map" 
                  style={{ width: '100%', height: '400px' }}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  위도 (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  id="latitude"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 36.1699"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  경도 (Longitude)
                </label>
                <input
                  type="number"
                  step="any"
                  id="longitude"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: -115.1398"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowMapModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const lat = (document.getElementById('latitude') as HTMLInputElement)?.value
                  const lng = (document.getElementById('longitude') as HTMLInputElement)?.value
                  if (lat && lng) {
                    handleMapCoordinateSelect(
                      parseFloat(lat), 
                      parseFloat(lng), 
                      selectedAddress || undefined
                    )
                  } else {
                    alert('위도와 경도를 입력해주세요.')
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                좌표 적용
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 확대 모달 */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">이미지 확대 보기</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex justify-center">
              <Image
                src={selectedImageUrl}
                alt="확대된 이미지"
                width={800}
                height={600}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  const parent = target.parentElement
                  if (parent) {
                    parent.innerHTML = `
                      <div class="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                        <div class="text-center">
                          <div class="text-red-500 text-lg">이미지 로드 실패</div>
                          <div class="text-gray-400 text-sm mt-2">URL을 확인해주세요</div>
                        </div>
                      </div>
                    `
                  }
                }}
              />
            </div>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowImageModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
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
