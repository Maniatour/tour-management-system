'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Calendar, Plus, Save, Trash2, Image as ImageIcon, X, Upload, Loader2, Search, FolderOpen, Copy, Languages, MapPin, ExternalLink, GripVertical } from 'lucide-react'
import Image from 'next/image'
import LocationPickerModal from './LocationPickerModal'
import { uploadThumbnail, deleteThumbnail, isSupabaseStorageUrl } from '@/lib/productMediaUpload'
import { supabase } from '@/lib/supabase'
import { translateScheduleFields, type ScheduleTranslationFields } from '@/lib/translationService'



interface ScheduleItem {
  id?: string
  product_id: string
  day_number: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  no_time: boolean | null // 시간 없음 체크박스
  is_break: boolean | null
  is_meal: boolean | null
  is_transport: boolean | null
  is_tour: boolean | null
  latitude?: number | null
  longitude?: number | null
  google_maps_link?: string | null
  show_to_customers: boolean | null
  title_ko?: string | null
  title_en?: string | null
  description_ko?: string | null
  description_en?: string | null
  location_ko?: string | null
  location_en?: string | null
  guide_notes_ko?: string | null
  guide_notes_en?: string | null
  thumbnail_url?: string | null
  order_index?: number | null
  two_guide_schedule?: string | null
  guide_driver_schedule?: string | null
}

interface TableScheduleAddProps {
  schedules: ScheduleItem[]
  onSchedulesChange: (schedules: ScheduleItem[]) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
  productId: string
}

export default function TableScheduleAdd({ 
  schedules, 
  onSchedulesChange, 
  onSave, 
  onClose, 
  saving, 
  productId
}: TableScheduleAddProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [locationPickerIndex, setLocationPickerIndex] = useState<number | null>(null)
  const [showEnglishFields, setShowEnglishFields] = useState(false)
  const [showThumbnailModal, setShowThumbnailModal] = useState(false)
  const [thumbnailIndex, setThumbnailIndex] = useState<number | null>(null)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [showBucketImages, setShowBucketImages] = useState(false)
  const [bucketImages, setBucketImages] = useState<Array<{name: string, url: string}>>([])
  const [loadingBucketImages, setLoadingBucketImages] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [showTextModal, setShowTextModal] = useState(false)
  const [textModalType, setTextModalType] = useState<'description' | 'guide_notes'>('description')
  const [textModalIndex, setTextModalIndex] = useState<number | null>(null)
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapModalIndex, setMapModalIndex] = useState<number | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [selectedGoogleMapLink, setSelectedGoogleMapLink] = useState<string>('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [modalLatitude, setModalLatitude] = useState<string>('')
  const [modalLongitude, setModalLongitude] = useState<string>('')
  const [mapSuggestions, setMapSuggestions] = useState<Array<{
    placeId: string
    name: string
    address: string
    latitude: number
    longitude: number
    googleMapsUrl: string
    rating?: number
    userRatingsTotal?: number
    types?: string[]
  }>>([])
  const [showMapSuggestions, setShowMapSuggestions] = useState(false)
  const [isMapSearchLoading, setIsMapSearchLoading] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<Array<{id: string, name: string}>>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [nearbyPlaces, setNearbyPlaces] = useState<Array<{
    placeId: string
    name: string
    address: string
    latitude: number
    longitude: number
    googleMapsUrl: string
    rating?: number
    userRatingsTotal?: number
    types?: string[]
    marker?: any
  }>>([])
  const [showNearbyPlaces, setShowNearbyPlaces] = useState(false)
  const [isLoadingNearbyPlaces, setIsLoadingNearbyPlaces] = useState(false)
  const [copying, setCopying] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 지도 관련 함수들
  const handleMapCoordinateSelect = (lat: number, lng: number, address?: string, googleMapsLink?: string) => {
    if (mapModalIndex !== null) {
      
      // 구글맵 링크 생성 (전달받지 않으면 기본 링크 생성)
      const mapsLink = googleMapsLink || `https://www.google.com/maps?q=${lat},${lng}`
      
      console.log('📍 좌표 적용 시작:', { lat, lng, address, mapsLink, mapModalIndex })
      console.log('📊 적용 전 스케줄 데이터:', schedules[mapModalIndex!])
      
      // 스케줄 업데이트
      updateSchedule(mapModalIndex!, 'latitude', lat)
      console.log('✅ 위도 업데이트 완료:', lat)
      
      updateSchedule(mapModalIndex!, 'longitude', lng)
      console.log('✅ 경도 업데이트 완료:', lng)
      
      updateSchedule(mapModalIndex!, 'location_ko', address || schedules[mapModalIndex!].location_ko)
      console.log('✅ 위치명 업데이트 완료:', address || schedules[mapModalIndex!].location_ko)
      
      updateSchedule(mapModalIndex!, 'google_maps_link', mapsLink)
      console.log('✅ 구글맵 링크 업데이트 완료:', mapsLink)
      
      // 모달 상태도 업데이트
      setModalLatitude(lat.toString())
      setModalLongitude(lng.toString())
      setSelectedGoogleMapLink(mapsLink)
      
      // 업데이트 후 즉시 확인
      setTimeout(() => {
        console.log('📊 적용 후 스케줄 데이터:', schedules[mapModalIndex!])
      }, 100)
      
      // Supabase에 즉시 저장 (실시간 동기화)
      console.log('좌표 저장 시도 - schedule ID:', schedules[mapModalIndex!].id)
      console.log('저장할 좌표:', { lat, lng, address, googleMapsLink: mapsLink })
      
      if (schedules[mapModalIndex!].id) {
        supabase
          .from('product_schedules')
          .update({
            latitude: lat,
            longitude: lng,
            location_ko: address || schedules[mapModalIndex!].location_ko,
            google_maps_link: mapsLink
          } as any)
          .eq('id', schedules[mapModalIndex!].id!)
          .select()
          .then(({ error, data, count }) => {
            if (error) {
              console.error('좌표 저장 오류:', error)
              console.error('오류 상세:', error.message, error.details, error.hint)
            } else {
              console.log('좌표가 성공적으로 저장되었습니다:', { lat, lng, address })
              console.log('저장된 데이터:', data)
              console.log('업데이트된 행 수:', count)
              
              // 업데이트 후 실제 데이터 확인
              if (data && data.length > 0) {
                console.log('실제 저장된 좌표:', { 
                  latitude: data[0].latitude, 
                  longitude: data[0].longitude 
                })
              } else {
                console.warn('업데이트된 데이터가 없습니다. RLS 정책을 확인해주세요.')
              }
            }
          })
      } else {
        console.error('스케줄 ID가 없어서 좌표를 저장할 수 없습니다')
      }
      
      setShowMapModal(false)
      setMapModalIndex(null)
    }
  }

  const initializeMap = useCallback(() => {
    if (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.Map) {
      const mapElement = document.getElementById('map')
      if (!mapElement) return

      // 저장된 좌표가 있으면 해당 위치를 중심으로, 없으면 라스베가스 중심으로
      const currentSchedule = mapModalIndex !== null ? schedules[mapModalIndex!] : null
      console.log('지도 초기화 - mapModalIndex:', mapModalIndex, 'currentSchedule:', currentSchedule)
      console.log('좌표 확인 - latitude:', currentSchedule?.latitude, 'longitude:', currentSchedule?.longitude)
      console.log('전체 스케줄 데이터:', JSON.stringify(currentSchedule, null, 2))
      
      const centerLat = currentSchedule?.latitude || 36.1699
      const centerLng = currentSchedule?.longitude || -115.1398
      
      console.log('지도 중심 좌표:', centerLat, centerLng)

      // Map ID와 스타일 설정
      let mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
      console.log('Google Maps Map ID:', mapId ? '설정됨' : '설정되지 않음')
      console.log('Map ID 값:', mapId)
      
      const mapOptions: any = {
        center: { lat: centerLat, lng: centerLng },
        zoom: 12,
        mapTypeId: (window.google as any).maps.MapTypeId?.ROADMAP || 'roadmap'
      }
      
      // Map ID가 있으면 Advanced Markers를 위한 맵 ID 설정
      if (mapId) {
        mapOptions.mapId = mapId
        console.log('Advanced Markers를 위한 Map ID 설정:', mapId)
      } else {
        console.warn('Map ID가 설정되지 않음 - Advanced Markers 사용 불가, 기본 마커 사용')
      }

      const map = new (window.google as any).maps.Map(mapElement, mapOptions)
      
      // 지도 인스턴스를 전역에 저장 (주변 장소 마커용)
      ;(window as any).mapInstance = map

      let marker: any = null

      // 저장된 좌표가 있으면 해당 위치에 새로운 Advanced Marker 표시
      if (currentSchedule?.latitude && currentSchedule?.longitude) {
        // AdvancedMarkerElement가 사용 가능하고 Map ID가 설정된 경우에만 사용
        if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            position: { lat: currentSchedule.latitude, lng: currentSchedule.longitude },
            map: map,
            title: '저장된 위치',
            gmpDraggable: true
          })
          console.log('TableScheduleAdd - Advanced Marker 생성 성공')
        } else {
          // Map ID가 없거나 AdvancedMarkerElement가 없으면 기본 마커 사용
          marker = new window.google.maps.Marker({
            position: { lat: currentSchedule.latitude, lng: currentSchedule.longitude },
            map: map,
            title: '저장된 위치',
            draggable: true
          })
          console.log('TableScheduleAdd - 기본 Marker 사용')
        }

        // 좌표 입력 필드에 저장된 값 설정
        setTimeout(() => {
          const latInput = document.getElementById('latitude') as HTMLInputElement
          const lngInput = document.getElementById('longitude') as HTMLInputElement
          if (latInput && currentSchedule.latitude) latInput.value = currentSchedule.latitude.toString()
          if (lngInput && currentSchedule.longitude) lngInput.value = currentSchedule.longitude.toString()
        }, 100)

        // 마커 드래그 이벤트 추가
        marker.addListener('dragend', () => {
          const position = marker?.getPosition()
          if (position) {
            const newLat = position.lat()
            const newLng = position.lng()
            
            // 모달 상태 업데이트
            setModalLatitude(newLat.toString())
            setModalLongitude(newLng.toString())

          // 역지오코딩으로 주소 가져오기
          const geocoder = new (window.google as any).maps.Geocoder()
          geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any, status: any) => {
              if (status === 'OK' && results && results[0]) {
                const address = results[0].formatted_address
                setSelectedAddress(address)
                setSelectedGoogleMapLink(`https://www.google.com/maps?q=${newLat},${newLng}`)
              }
            })
          }
        })
      }

      // 지도 클릭 이벤트
      map.addListener('click', (event: any) => {
        const lat = event.latLng?.lat()
        const lng = event.latLng?.lng()
        
        if (lat && lng) {
          // 기존 마커 제거
          if (marker) {
            marker.setMap(null)
          }

          // 새로운 Advanced Marker 추가 (드래그 가능)
          if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
            marker = new window.google.maps.marker.AdvancedMarkerElement({
              position: { lat, lng },
              map: map,
              title: '선택된 위치',
              gmpDraggable: true
            })
            console.log('TableScheduleAdd 클릭 - Advanced Marker 생성 성공')
            console.log('🎯 마커 드래그 가능 여부:', marker.gmpDraggable || marker.draggable)
          } else {
            marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: map,
              title: '선택된 위치',
              draggable: true
            })
            console.log('TableScheduleAdd 클릭 - 기본 Marker 사용')
            console.log('🎯 마커 드래그 가능 여부:', marker.draggable)
          }

          // 마커 드래그 이벤트 추가
          marker.addListener('dragend', () => {
            const position = marker.getPosition()
            const newLat = position.lat()
            const newLng = position.lng()
              
            // 좌표 입력 필드 업데이트
            const latInput = document.getElementById('latitude') as HTMLInputElement
            const lngInput = document.getElementById('longitude') as HTMLInputElement
            if (latInput) latInput.value = newLat.toString()
            if (lngInput) lngInput.value = newLng.toString()
            
            // 모달 상태도 업데이트
            setModalLatitude(newLat.toString())
            setModalLongitude(newLng.toString())
            
            console.log('🎯 지도 클릭 마커 드래그 완료:', { newLat, newLng })

            // 역지오코딩으로 주소 가져오기
            const geocoder = new (window.google as any).maps.Geocoder()
            geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any, status: any) => {
              if (status === 'OK' && results && results[0]) {
                const address = results[0].formatted_address
                setSelectedAddress(address)
                setSelectedGoogleMapLink(`https://www.google.com/maps?q=${newLat},${newLng}`)
              }
            })
          })

          // 좌표 입력 필드 업데이트
          const latInput = document.getElementById('latitude') as HTMLInputElement
          const lngInput = document.getElementById('longitude') as HTMLInputElement
          if (latInput) latInput.value = lat.toString()
          if (lngInput) lngInput.value = lng.toString()
          
          // 모달 상태도 업데이트
          setModalLatitude(lat.toString())
          setModalLongitude(lng.toString())

          // 역지오코딩으로 주소 가져오기
          const geocoder = new (window.google as any).maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address
              setSelectedAddress(address)
              setSelectedGoogleMapLink(`https://www.google.com/maps?q=${lat},${lng}`)
              
              // 주변 장소 검색 (검색어 없이 현재 위치 기준)
              setTimeout(() => {
                searchNearbyPlaces(lat, lng)
              }, 500) // 좌표 설정 후 잠시 대기
            }
          })
        }
      })

      setMapLoaded(true)
    }
  }, [mapModalIndex, schedules])

  // Plus Code 패턴 감지
  const isPlusCode = (query: string) => {
    // Plus Code 패턴: 알파벳+숫자 조합 (예: MGXF+WC, 8FVC9G8F+5W)
    const plusCodePattern = /^[A-Z0-9]{2,10}\+[A-Z0-9]{2,10}$/i
    return plusCodePattern.test(query.trim())
  }

  // Plus Code를 좌표로 변환
  const decodePlusCode = async (plusCode: string) => {
    try {
      const geocoder = new (window.google as any).maps.Geocoder()
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: plusCode }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
            resolve(results[0])
          } else {
            reject(new Error('Plus Code 디코딩 실패'))
          }
        })
      })
      return result
    } catch (error) {
      console.error('Plus Code 디코딩 오류:', error)
      return null
    }
  }

  // 향상된 지도 검색 기능 - 다중 검색 방법 지원
  const searchMapPlaces = async (query: string) => {
    if (!query.trim() || !mapLoaded) return

    setIsMapSearchLoading(true)
    const allResults: any[] = []

    try {
      // 1. Plus Code 검색 (가장 정확함)
      if (isPlusCode(query)) {
        const geocodeResult = await decodePlusCode(query)
        if (geocodeResult) {
          const location = (geocodeResult as any).geometry.location
          const lat = location.lat()
          const lng = location.lng()
          
          const plusCodeResult = {
            placeId: `plus_code_${Date.now()}`,
            name: `📍 Plus Code: ${query}`,
            address: (geocodeResult as any)?.formatted_address || '',
            latitude: lat,
            longitude: lng,
            googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
            rating: undefined,
            ratingDisplay: undefined,
            userRatingsTotal: undefined,
            types: ['plus_code'],
            searchType: 'plus_code'
          }
          
          setMapSuggestions([plusCodeResult])
          setShowMapSuggestions(true)
          setIsMapSearchLoading(false)
          return
        }
      }

      // 2. 좌표 검색 패턴 감지 (예: "36.1699, -115.1398" 또는 "36.1699 -115.1398")
      const coordinateMatch = query.match(/(-?\d+\.?\d*)\s*[,]\s*(-?\d+\.?\d*)|(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/)
      if (coordinateMatch) {
        const latitude = parseFloat(coordinateMatch[1] || coordinateMatch[3])
        const longitude = parseFloat(coordinateMatch[2] || coordinateMatch[4])
        
        // 좌표 유효성 검사
        if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
          // 역지오코딩으로 주소 가져오기
          const geocoder = new (window.google as any).maps.Geocoder()
          geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
            const coordResult = {
              placeId: `coord_${Date.now()}`,
              name: `🎯 좌표: ${latitude}, ${longitude}`,
              address: results && results[0] ? results[0].formatted_address : `${latitude}, ${longitude}`,
              latitude: latitude,
              longitude: longitude,
              googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
              rating: undefined,
              ratingDisplay: undefined,
              userRatingsTotal: undefined,
              types: ['coordinate'],
              searchType: 'coordinate'
            }
            
            setMapSuggestions([coordResult])
            setShowMapSuggestions(true)
            setIsMapSearchLoading(false)
          })
          return
        }
      }

      // 3. Places API 검색 (장소명, 주소, 업체명 등)
      const placesPromises = []
      
      // 텍스트 검색 - 새로운 FindPlaceFromText API 사용
      placesPromises.push(
        new Promise(async (resolve) => {
          try {
            const [place] = await (window.google as any).maps.places.Place.findPlaceFromText({
              textQuery: query,
              fields: ['id', 'displayName', 'formattedAddress', 'location', 'types', 'rating', 'userRatingCount', 'businessStatus'],
              locationBias: {
                lat: 36.1699, 
                lng: -115.1398,
                radius: 200000
              },
              regionCode: 'US'
            })
            
            if (place) {
              resolve([{ 
                ...place, 
                searchType: 'new_text_search',
                place_id: place.id,
                name: place.displayName,
                formatted_address: place.formattedAddress,
                geometry: {
                  location: {
                    lat: () => place.location?.lat || 0,
                    lng: () => place.location?.lng || 0
                  }
                },
                types: place.types,
                rating: place.rating,
                user_ratings_total: place.userRatingCount
              }])
            } else {
              resolve([])
            }
          } catch (error) {
            console.log('새로운 Places API 텍스트 검색 실패, 기존 방식 사용:', error)
            resolve([])
          }
        })
      )

      // 자동완성 검색 - 새로운 AutocompleteSuggestion API 사용
      placesPromises.push(
        new Promise(async (resolve) => {
          try {
            const suggestions = await (window.google as any).maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: query,
              includedRegionCodes: ['US'],
              locationBias: {
                lat: 36.1699, 
                lng: -115.1398,
                radius: 200000
              }
            })
            
            if (suggestions && suggestions.length > 0) {
              resolve(suggestions.slice(0, 5).map(suggestion => ({
                ...suggestion,
                searchType: 'new_autocomplete',
                place_id: suggestion.placePrediction?.place?.id || `new_autocomplete_${Date.now()}`,
                name: suggestion.text?.text || suggestion.placePrediction?.place?.displayName || '',
                formatted_address: suggestion.text?.text || '',
                geometry: suggestion.placePrediction?.place?.location ? {
                  location: {
                    lat: () => suggestion.placePrediction?.place?.location?.lat || 0,
                    lng: () => suggestion.placePrediction?.place?.location?.lng || 0
                  }
                } : null
              })))
            } else {
              resolve([])
            }
          } catch (error) {
            console.log('새로운 AutocompleteSuggestion API 실패, Geocoder로 대체:', error)
            resolve([])
          }
        })
      )

      // 4. Geocoder 일반 주소 검색 (백업)
      placesPromises.push(
        new Promise((resolve) => {
          const geocoder = new (window.google as any).maps.Geocoder()
          
          const addressTypes = [
            { address: query, region: 'US' },
            { address: `${query}, Las Vegas, NV` },
            { address: `${query}, Nevada, USA` },
            { address: query } // 지역 제한 없음
          ]
          
          let foundResults = false
          let completed = 0
          
          addressTypes.forEach(({ address, region }, index) => {
                    geocoder.geocode({ 
                      address, 
                      region: region as any,
                      bounds: undefined, // deprecated 제거
                      location: undefined // deprecated 제거
                    }, (geocodeResults: any[], geocodeStatus: any) => {
              completed++
              
              if (geocodeStatus === 'OK' && geocodeResults && !foundResults) {
                foundResults = true
                resolve(geocodeResults.map((result, i) => ({
                  ...result,
                  searchType: 'geocoder',
                  priority: index === 0 ? 'exact' : 'related'
                })))
              } else if (completed === addressTypes.length && !foundResults) {
                resolve([])
              }
            })
          })
        })
      )

      // 모든 검색 방법 병렬 실행
      const searchResults = await Promise.all(placesPromises)
      const processedResults = []

                searchResults.forEach((results: any, index) => {
                  if (!results || results.length === 0) return
                  
                  results.slice(0, index === 0 ? 6 : index === 1 ? 4 : 6).forEach((result: any) => {
                    if (result.searchType === 'new_autocomplete') {
                      // 새로운 자동완성 결과
                      processedResults.push({
                        placeId: result.place_id,
                        name: result.name,
                        address: result.formatted_address,
                        latitude: result.geometry?.location?.lat?.() || 0,
                        longitude: result.geometry?.location?.lng?.() || 0,
                        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                        rating: result.rating || undefined,
                        ratingDisplay: result.rating ? `⭐ ${result.rating.toFixed(1)}` : undefined,
                        userRatingsTotal: result.user_ratings_total || undefined,
                        types: result.types || [],
                        searchType: 'new_autocomplete_results'
                      })
                    } else if (result.searchType === 'new_text_search') {
                      // 새로운 텍스트 검색 결과
                      processedResults.push({
                        placeId: result.place_id,
                        name: result.name,
                        address: result.formatted_address,
                        latitude: result.geometry?.location?.lat?.() || 0,
                        longitude: result.geometry?.location?.lng?.() || 0,
                        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.place_id)}`,
                        rating: result.rating || undefined,
                        ratingDisplay: result.rating ? `⭐ ${result.rating.toFixed(1)}` : undefined,
                        userRatingsTotal: result.user_ratings_total || undefined,
                        types: result.types || [],
                        searchType: 'new_text_search'
                      })
                    } else if (result.searchType === 'autocomplete') {
                      // 기존 자동완성 결과는 추가 검색 필요
                      processedResults.push({
                        placeId: `autocomplete_${result.place_id}`,
                        name: result.description,
                        address: result.structured_formatting?.secondary_text || '',
                        latitude: 0, // 나중에 실제 검색에서 채워줘
                        longitude: 0,
                        googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                        rating: undefined,
                        ratingDisplay: undefined,
                        userRatingsTotal: undefined,
                        types: [],
                        searchType: 'autocomplete_results',
                        prediction: result
                      })
                    } else if (result.name || result.formatted_address) {
            processedResults.push({
              placeId: result.place_id || `geo_${Date.now()}_${Math.random()}`,
              name: result.name || `📍 ${result.formatted_address}`,
              address: result.formatted_address || '',
              latitude: result.geometry ? result.geometry.location.lat() : 0,
              longitude: result.geometry ? result.geometry.location.lng() : 0,
              googleMapsUrl: result.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
              rating: result.rating || undefined,
              ratingDisplay: result.rating ? `⭐ ${result.rating.toFixed(1)}` : undefined,
              userRatingsTotal: result.user_ratings_total || undefined,
              types: result.types || [],
              searchType: result.searchType || 'places'
            })
          }
        })
      })

      // 중복 제거 및 결과 정렬 - 더 엄격한 중복 제거
      const uniqueResults = processedResults.filter((result, index, self) => {
        // place_id가 있다면 그것으로 중복 체크
        if (result.placeId && result.placeId.startsWith('place_')) {
          return index === self.findIndex(r => r.placeId === result.placeId)
        }
        // place_id가 없거나 특별한 ID라면 이름+주소로 중복 체크
        return index === self.findIndex(r => 
          r.name === result.name && 
          r.address === result.address && 
          (r.latitude === result.latitude || r.longitude === result.longitude)
        )
      })

      // 검색 유형별 우선순위 정렬
      const sortedResults = uniqueResults.sort((a, b) => {
        const priorityA = a.searchType === 'coordinate' ? 0 :
                         a.searchType === 'plus_code' ? 1 :
                         a.searchType === 'new_text_search' ? 2 :
                         a.searchType === 'new_autocomplete_results' ? 3 :
                         a.searchType !== 'geocoder' ? 4 : 5
        const priorityB = b.searchType === 'coordinate' ? 0 :
                         b.searchType === 'plus_code' ? 1 :
                         b.searchType === 'new_text_search' ? 2 :
                         b.searchType === 'new_autocomplete_results' ? 3 :
                         b.searchType !== 'geocoder' ? 4 : 5
        
        return priorityA - priorityB
      }).slice(0, 10) // 최대 10개 결과

      if (sortedResults.length > 0) {
        setMapSuggestions(sortedResults)
        setShowMapSuggestions(true)
      } else {
        setMapSuggestions([])
        setShowMapSuggestions(false)
      }

      setIsMapSearchLoading(false)
    } catch (error) {
      console.error('향상된 위치 검색 오류:', error)
      setIsMapSearchLoading(false)
    }
  }

  // 주변 장소 검색 및 표시
  const searchNearbyPlaces = async (lat: number, lng: number, query: string = '') => {
    if (!mapLoaded || !window.google?.maps?.places) return

    setIsLoadingNearbyPlaces(true)
    
    try {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      )

      const request = {
        location: { lat, lng },
        radius: 1000, // 1km 반경
        keyword: query, // 검색 키워드 (옵션)
        types: ['restaurant', 'tourist_attraction', 'point_of_interest', 'gas_station', 'lodging'], // 관심 있는 장소 유형
      }

      service.nearbySearch(request, (results: any[], status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          // 결과 필터링 및 정리
          const filteredResults = results
            .filter(place => place.rating && place.user_ratings_total > 0)
            .slice(0, 10) // 상위 10개만 표시
            .map((place, index) => ({
              placeId: place.place_id,
              name: place.name,
              address: place.vicinity || place.formatted_address,
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
              googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              types: place.types,
              marker: null // 나중에 마커 요소 저장
            }))

          setNearbyPlaces(filteredResults)
          setShowNearbyPlaces(true)
          
          // 지도에 마커 표시
          addNearbyPlaceMarkers(filteredResults)
        } else {
          setNearbyPlaces([])
          setShowNearbyPlaces(false)
        }
        setIsLoadingNearbyPlaces(false)
      })
    } catch (error) {
      console.error('주변 장소 검색 오류:', error)
      setIsLoadingNearbyPlaces(false)
    }
  }

  // 주변 장소 마커 생성 및 표시
  const addNearbyPlaceMarkers = (places: typeof nearbyPlaces) => {
    const mapElement = document.getElementById('map')
    if (!mapElement || !window.google?.maps) return

    // 기존 마커들 제거
    nearbyPlaces.forEach(place => {
      if (place.marker) {
        place.marker.setMap(null)
      }
    })

    places.forEach((place, index) => {
      // 지도가 현재 위치에 있는지 확인 (약간의 오차 허용)
      const mapLat = mapModalIndex !== null ? (schedules[mapModalIndex]?.latitude || 36.1699) : 36.1699
      const mapLng = mapModalIndex !== null ? (schedules[mapModalIndex]?.longitude || -115.1398) : -115.1398
      
      let marker: any
      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID

      if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat: place.latitude, lng: place.longitude },
          map: window.google.maps.Map ? (window as any).mapInstance : null,
          title: place.name,
          content: createMarkerContent(index + 1) // 번호가 표시된 마커
        })
      } else {
        marker = new window.google.maps.Marker({
          position: { lat: place.latitude, lng: place.longitude },
          map: window.google.maps.Map ? (window as any).mapInstance : null,
          title: place.name,
          label: (index + 1).toString()
        })
      }

      // 마커 클릭 이벤트 추가
      marker.addListener('click', () => {
        selectNearbyPlace(place)
      })

      // 장소 정보에 마커 저장
      place.marker = marker
    })
  }

  // 마커 내용 생성 (숫자 표시)
  const createMarkerContent = (number: number) => {
    const element = document.createElement('div')
    element.style.cssText = `
      background-color: #1f40e6;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      cursor: pointer;
    `
    element.textContent = number.toString()
    return element
  }

  // 주변 장소 선택
  const selectNearbyPlace = (place: typeof nearbyPlaces[0]) => {
    setModalLatitude(place.latitude.toString())
    setModalLongitude(place.longitude.toString())
    setSelectedAddress(place.address)
    setSelectedGoogleMapLink(place.googleMapsUrl)
    setMapSearchQuery(place.name)
    setShowNearbyPlaces(false)
    
    // 주변 장소 마커 제거
    nearbyPlaces.forEach(p => {
      if (p.marker) {
        p.marker.setMap(null)
      }
    })
    setNearbyPlaces([])
  }

  // 검색어 변경 처리
  const handleMapSearchChange = (value: string) => {
    setMapSearchQuery(value)
    if (value.trim()) {
      searchMapPlaces(value)
    } else {
      setMapSuggestions([])
      setShowMapSuggestions(false)
    }
  }

  // 위치 선택
  const handleMapLocationSelect = (location: {
    placeId: string
    name: string
    address: string
    latitude: number
    longitude: number
    googleMapsUrl: string
    rating?: number
    userRatingsTotal?: number
    types?: string[]
  }) => {
    const lat = location.latitude
    const lng = location.longitude
    
    setMapSearchQuery(location.name)
    setSelectedAddress(location.address)
    setSelectedGoogleMapLink(location.googleMapsUrl)
    setModalLatitude(lat.toString())  // 모달 상태 업데이트
    setModalLongitude(lng.toString()) // 모달 상태 업데이트
    setShowMapSuggestions(false)
    
    // 좌표 입력 필드 업데이트
    const latInput = document.getElementById('latitude') as HTMLInputElement
    const lngInput = document.getElementById('longitude') as HTMLInputElement
    if (latInput) latInput.value = lat.toString()
    if (lngInput) lngInput.value = lng.toString()
    
    console.log('📍 검색된 장소 선택됨:', {
      name: location.name,
      lat: lat,
      lng: lng,
      address: location.address,
      latitudeUpdated: latInput?.value,
      longitudeUpdated: lngInput?.value,
      modalLatitude: modalLatitude,
      modalLongitude: modalLongitude
    })

    // 지도 중심 이동 및 마커 업데이트
          const mapElement = document.getElementById('map')
          if (mapElement && window.google && window.google.maps) {
            // Map ID 설정
            const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
            const mapOptions: any = {
              center: { lat, lng },
              zoom: 15,
              mapTypeId: (window.google as any).maps.MapTypeId.ROADMAP
            }
            
            // Map ID가 있으면 Advanced Markers를 위한 맵 ID 설정
            if (mapId) {
              mapOptions.mapId = mapId
            }

            const map = new (window.google as any).maps.Map(mapElement, mapOptions)
            
            // 지도 인스턴스를 전역에 저장 (마커 업데이트용)
            ;(window as any).mapInstance = map

      // 새로운 Advanced Marker 추가 (드래그 가능)
      let marker: any
      if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
        marker = new window.google.maps.marker.AdvancedMarkerElement({
          position: { lat, lng },
          map: map,
          title: location.name,
          gmpDraggable: true  // Advanced Marker에서는 gmpDraggable 사용
        })
        console.log('TableScheduleAdd 목록선택 - Advanced Marker 생성 성공')
        console.log('🎯 마커 드래그 가능 여부:', marker.gmpDraggable || marker.draggable)
      } else {
        marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: map,
          title: location.name,
          draggable: true
        })
        console.log('TableScheduleAdd 목록선택 - 기본 Marker 사용')
        console.log('🎯 마커 드래그 가능 여부:', marker.draggable)
      }

      // 마커 드래그 이벤트 추가 (검색된 장소 마커용)
      const addDragListener = (markerInstance: any) => {
        // Advanced Marker의 경우 dragend 이벤트가 다르게 작동할 수 있음
        markerInstance.addListener('dragend', () => {
          console.log('🎯 드래그 종료 감지됨')
          
          let newLat: number, newLng: number
          
          if (markerInstance.getPosition) {
            // 일반 Marker
            const position = markerInstance.getPosition()
            newLat = position.lat()
            newLng = position.lng()
          } else if (markerInstance.position) {
            // Advanced Marker
            newLat = markerInstance.position.lat
            newLng = markerInstance.position.lng
          } else {
            console.error('마커 위치를 가져올 수 없습니다')
            return
          }

          console.log('🎯 마커 드래그 완료:', { newLat, newLng })

          // 좌표 입력 필드 업데이트
          const latInput = document.getElementById('latitude') as HTMLInputElement
          const lngInput = document.getElementById('longitude') as HTMLInputElement
          if (latInput) latInput.value = newLat.toString()
          if (lngInput) lngInput.value = newLng.toString()

          // 모달 상태도 업데이트
          setModalLatitude(newLat.toString())
          setModalLongitude(newLng.toString())

          // 역지오코딩으로 주소 가져오기
          const geocoder = new (window.google as any).maps.Geocoder()
          geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address
              setSelectedAddress(address)
              setSelectedGoogleMapLink(`https://www.google.com/maps?q=${newLat},${newLng}`)
              
              console.log('📍 역지오코딩 결과:', {
                address: address,
                newLat: newLat,
                newLng:newLng
              })
              
              // 주변 장소 검색 (드래그된 위치 기준)
              setTimeout(() => {
                searchNearbyPlaces(newLat, newLng)
              }, 500)
            }
          })
        })
        
      }
      
      // 드래그 이벤트 추가
      addDragListener(marker)
      
      // 마커 드래그 관련 추가 이벤트 리스너들
      marker.addListener('dragstart', () => {
        console.log('🎯 마커 드래그 시작됨')
      })
      
      marker.addListener('mousedown', () => {
        console.log('🎯 마커 마우스 다운 이벤트')
      })
      
      // Advanced Marker의 경우 추가 이벤트 리스너
      if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
        // Advanced Marker의 다른 드래그 이벤트들도 시도
        if (marker.gmp && marker.gmp.addListener) {
          marker.gmp.addListener('dragend', () => {
            console.log('🎯 Advanced Marker gmp 드래그 종료')
            const position = marker.position
            const latInput = document.getElementById('latitude') as HTMLInputElement
            const lngInput = document.getElementById('longitude') as HTMLInputElement
            if (latInput) latInput.value = position.lat.toString()
            if (lngInput) lngInput.value = position.lng.toString()
            setModalLatitude(position.lat.toString())
            setModalLongitude(position.lng.toString())
          })
        }
        
        // Advanced Marker의 위치 변경 감지
        marker.addListener('position_changed', () => {
          console.log('🎯 Advanced Marker 위치 변경됨')
          const position = marker.position
          const latInput = document.getElementById('latitude') as HTMLInputElement
          const lngInput = document.getElementById('longitude') as HTMLInputElement
          if (latInput) latInput.value = position.lat.toString()
          if (lngInput) lngInput.value = position.lng.toString()
          setModalLatitude(position.lat.toString())
          setModalLongitude(position.lng.toString())
        })
      }
    }
  }

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.map-search-container')) {
        setShowMapSuggestions(false)
      }
    }

    if (showMapModal) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMapModal])

  // 모달이 열릴 때 지도 초기화
  useEffect(() => {
    if (showMapModal && mapModalIndex !== null) {
      // 현재 스케줄의 위치 정보로 초기화
      const currentSchedule = schedules[mapModalIndex!]
      console.log('모달 초기화 - mapModalIndex:', mapModalIndex, 'currentSchedule:', currentSchedule)
      
      if (currentSchedule?.latitude && currentSchedule?.longitude) {
        console.log('저장된 좌표 발견:', currentSchedule.latitude, currentSchedule.longitude)
        setSelectedAddress(currentSchedule.location_ko || '')
        setSelectedGoogleMapLink(currentSchedule.google_maps_link || `https://www.google.com/maps?q=${currentSchedule.latitude},${currentSchedule.longitude}`)
        setModalLatitude(currentSchedule.latitude.toString())
        setModalLongitude(currentSchedule.longitude.toString())
        
        // 저장된 좌표가 있으면 해당 위치의 주변 장소 검색
        setTimeout(() => {
          searchNearbyPlaces(currentSchedule.latitude!, currentSchedule.longitude!)
        }, 1500) // 시도 초기화 후 충분히 대기
      } else {
        console.log('저장된 좌표 없음, 기본값으로 초기화')
        setSelectedAddress('')
        setSelectedGoogleMapLink('')
        setModalLatitude('')
        setModalLongitude('')
      }
      setMapSearchQuery('')
      
      // Google Maps API 스크립트 로드
      if (!window.google) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
          alert('Google Maps API 키가 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요.')
          return
        }
        
        const script = document.createElement('script')
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`
        script.async = true
        script.defer = true
        script.onload = () => {
          setMapLoaded(true)
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
  }, [showMapModal, mapModalIndex, schedules, initializeMap])

  // 시간 계산 유틸리티 함수들
  const timeToMinutes = (timeStr: string | null): number => {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  const calculateDuration = (startTime: string | null, endTime: string | null): number => {
    if (!startTime || !endTime) return 0
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)
    return endMinutes - startMinutes
  }

  const calculateEndTime = (startTime: string | null, durationMinutes: number): string | null => {
    if (!startTime) return null
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = startMinutes + durationMinutes
    return minutesToTime(endMinutes)
  }

  const addNewSchedule = () => {
    // 마지막 행의 정보를 가져오기
    const lastSchedule = schedules.length > 0 ? schedules[schedules.length - 1] : null
    const lastDayNumber = lastSchedule ? lastSchedule.day_number : 1
    const lastEndTime = lastSchedule ? lastSchedule.end_time : null
    
    // 같은 일차의 마지막 order_index 찾기
    const sameDaySchedules = schedules.filter(s => s.day_number === lastDayNumber)
    const maxOrderIndex = sameDaySchedules.length > 0 
      ? Math.max(...sameDaySchedules.map(s => s.order_index || 0))
      : 0
    
    const newSchedule: ScheduleItem = {
      product_id: productId, // 올바른 product_id 설정
      day_number: lastDayNumber, // 윗 행과 같은 일차
      start_time: lastEndTime, // 윗 행의 종료 시간을 시작 시간으로 (null 가능)
      end_time: lastEndTime ? calculateEndTime(lastEndTime, 60) : null, // 시작 시간이 있으면 + 60분
      duration_minutes: lastEndTime ? 60 : null, // 시간이 없으면 null
      no_time: false, // 시간 없음 체크박스 기본값
      is_break: false,
      is_meal: false,
      is_transport: false,
      is_tour: false,
      latitude: null,
      longitude: null,
      show_to_customers: true,
      title_ko: '',
      title_en: '',
      description_ko: '',
      description_en: '',
      location_ko: '',
      location_en: '',
      guide_notes_ko: '',
      guide_notes_en: '',
      thumbnail_url: '',
      order_index: maxOrderIndex + 1, // 다음 순서로 설정
      two_guide_schedule: null,
      guide_driver_schedule: null
    }
    onSchedulesChange([...schedules, newSchedule])
  }

  const updateSchedule = useCallback((index: number, field: keyof ScheduleItem, value: unknown) => {
    onSchedulesChange((prevSchedules) => {
      const updatedSchedules = [...prevSchedules]
      updatedSchedules[index] = { ...updatedSchedules[index], [field]: value }
      console.log(`🔄 ${field} 업데이트:`, { index, field, value, updatedSchedule: updatedSchedules[index] })
      return updatedSchedules
    })
  }, [onSchedulesChange])

  // 드래그 앤 드롭 핸들러들
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const updatedSchedules = [...schedules]
    const draggedSchedule = updatedSchedules[draggedIndex]
    
    // 같은 일차인 경우에만 이동 허용
    if (draggedSchedule.day_number === updatedSchedules[dropIndex].day_number) {
      // 드래그된 아이템 제거
      updatedSchedules.splice(draggedIndex, 1)
      
      // 새로운 위치에 삽입
      const newIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex
      updatedSchedules.splice(newIndex, 0, draggedSchedule)
      
      // order_index 재정렬
      updatedSchedules.forEach((schedule, index) => {
        schedule.order_index = index + 1
      })
      
      onSchedulesChange(updatedSchedules)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // 시간 업데이트 함수 (첫 번째 줄부터 모든 행의 시간을 순차적으로 계산, 시간 없음 행은 스킵)
  const updateTimesBasedOnDuration = (schedules: ScheduleItem[]) => {
    const updatedSchedules = [...schedules]
    let currentTime = '09:00' // 기본 시작 시간
    
    // 모든 행을 순차적으로 처리
    for (let i = 0; i < updatedSchedules.length; i++) {
      const schedule = updatedSchedules[i]
      
      // 시간 없음이 체크된 행은 스킵
      if (schedule.no_time) {
        continue
      }
      
      if (schedule.duration_minutes && schedule.duration_minutes > 0) {
        // 시작 시간 설정
        updatedSchedules[i] = {
          ...updatedSchedules[i],
          start_time: currentTime
        }
        
        // 종료 시간 계산 (시작 시간 + 소요시간)
        const startMinutes = timeToMinutes(currentTime)
        const endMinutes = startMinutes + schedule.duration_minutes
        const endTime = minutesToTime(endMinutes)
        
        updatedSchedules[i] = {
          ...updatedSchedules[i],
          end_time: endTime
        }
        
        // 다음 일정의 시작 시간을 현재 종료 시간으로 설정
        currentTime = endTime
      }
    }
    
    return updatedSchedules
  }


  // 버킷에서 이미지 목록 가져오기
  const fetchBucketImages = useCallback(async () => {
    setLoadingBucketImages(true)
    try {
      const { data, error } = await supabase.storage
        .from('product-media')
        .list('images', {
          limit: 50,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        console.error('이미지 목록 가져오기 오류:', error)
        return
      }

      const images = await Promise.all(
        data.map(async (file) => {
          const { data: urlData } = supabase.storage
            .from('product-media')
            .getPublicUrl(`images/${file.name}`)
          return {
            name: file.name,
            url: urlData.publicUrl
          }
        })
      )

      setBucketImages(images)
    } catch (error) {
      console.error('이미지 목록 가져오기 예외:', error)
    } finally {
      setLoadingBucketImages(false)
    }
  }, [])

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length > 0 && thumbnailIndex !== null) {
      const file = imageFiles[0]
      setUploadingThumbnail(true)
      try {
        const result = await uploadThumbnail(file, productId)
        if (result.success && result.url) {
          updateSchedule(thumbnailIndex, 'thumbnail_url', result.url)
        } else {
          alert(result.error || '업로드에 실패했습니다.')
        }
      } catch (error) {
        console.error('드래그 업로드 오류:', error)
        alert('업로드 중 오류가 발생했습니다.')
      } finally {
        setUploadingThumbnail(false)
      }
    }
  }, [thumbnailIndex, productId, updateSchedule])

  // 클립보드 붙여넣기 핸들러
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(item => item.type.startsWith('image/'))
    
    if (imageItem && thumbnailIndex !== null) {
      const file = imageItem.getAsFile()
      if (file) {
        setUploadingThumbnail(true)
        try {
          const result = await uploadThumbnail(file, productId)
          if (result.success && result.url) {
            updateSchedule(thumbnailIndex, 'thumbnail_url', result.url)
          } else {
            alert(result.error || '업로드에 실패했습니다.')
          }
        } catch (error) {
          console.error('붙여넣기 업로드 오류:', error)
          alert('업로드 중 오류가 발생했습니다.')
        } finally {
          setUploadingThumbnail(false)
        }
      }
    }
  }, [thumbnailIndex, productId, updateSchedule])

  const removeSchedule = (index: number) => {
    onSchedulesChange(schedules.filter((_, i) => i !== index))
  }

  // 복사 기능 관련 함수들
  const fetchAvailableProducts = async () => {
    try {
      // 먼저 현재 제품의 sub_category를 가져옴
      const { data: currentProduct, error: currentError } = await supabase
        .from('products')
        .select('sub_category')
        .eq('id', productId)
        .single()

      if (currentError) {
        console.error('현재 제품 정보 가져오기 오류:', currentError)
        return
      }

      const subCategory = (currentProduct as any)?.sub_category
      if (!subCategory) {
        console.error('현재 제품의 sub_category를 찾을 수 없습니다.')
        return
      }
      
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .neq('id', productId) // 현재 제품 제외
        .eq('sub_category', subCategory) // 같은 sub_category만
        .order('name')

      if (error) {
        console.error('제품 목록 가져오기 오류:', error)
        return
      }

      setAvailableProducts(data || [])
    } catch (error) {
      console.error('제품 목록 가져오기 예외:', error)
    }
  }

  const handleCopySchedules = async () => {
    if (!selectedProductId || schedules.length === 0) {
      alert('복사할 제품을 선택하고 일정이 있는지 확인해주세요.')
      return
    }

    setCopying(true)
    try {
      // 현재 일정들을 복사하여 새로운 product_id로 설정
      const copiedSchedules = schedules.map(schedule => ({
        ...schedule,
        id: undefined, // 새 ID 생성
        product_id: selectedProductId,
        created_at: undefined,
        updated_at: undefined
      }))

      // Supabase에 복사된 일정들 저장
      const { error } = await supabase
        .from('product_schedules')
        .insert(copiedSchedules as any)

      if (error) {
        console.error('일정 복사 오류:', error)
        alert('일정 복사 중 오류가 발생했습니다.')
        return
      }

      alert('일정이 성공적으로 복사되었습니다.')
      setShowCopyModal(false)
      setSelectedProductId('')
    } catch (error) {
      console.error('일정 복사 예외:', error)
      alert('일정 복사 중 오류가 발생했습니다.')
    } finally {
      setCopying(false)
    }
  }


  // 모든 스케줄 번역 함수
  const translateAllSchedules = async () => {
    setTranslating(true)
    setTranslationError(null)

    try {
      const updatedSchedules = [...schedules]
      
      for (let i = 0; i < schedules.length; i++) {
        const schedule = schedules[i]
        
        // 번역할 필드들 수집
        const fieldsToTranslate: ScheduleTranslationFields = {
          title_ko: schedule.title_ko || '',
          description_ko: schedule.description_ko || '',
          location_ko: schedule.location_ko || '',
          guide_notes_ko: schedule.guide_notes_ko || ''
        }

        // 번역 실행
        const result = await translateScheduleFields(fieldsToTranslate)

        if (result.success && result.translatedFields) {
          // 번역된 내용을 스케줄에 적용
          updatedSchedules[i] = {
            ...updatedSchedules[i],
            ...result.translatedFields
          }
        } else {
          console.warn(`스케줄 ${i + 1}번 번역 실패:`, result.error)
        }

        // API 제한을 고려하여 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      onSchedulesChange(updatedSchedules)
    } catch (error) {
      console.error('전체 번역 오류:', error)
      setTranslationError(`번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setTranslating(false)
    }
  }


  // 시간 합산 계산 함수 (각 가이드 유형별로 분리, 모든 일정의 소요시간 계산)
  const calculateTotalTransportTime = () => {
    let twoGuidesGuideTime = 0
    let twoGuidesAssistantTime = 0
    let guideDriverGuideTime = 0
    let guideDriverDriverTime = 0

    schedules.forEach(schedule => {
      // 시간이 있는 모든 일정을 통계에 포함 (is_transport 조건 제거)
      if (schedule.duration_minutes && schedule.duration_minutes > 0) {
        const duration = schedule.duration_minutes
        
        // 2가이드에서 가이드가 선택된 경우
        if (schedule.two_guide_schedule === 'guide') {
          twoGuidesGuideTime += duration
        }
        // 2가이드에서 어시스턴트가 선택된 경우
        else if (schedule.two_guide_schedule === 'assistant') {
          twoGuidesAssistantTime += duration
        }
        
        // 가이드+드라이버에서 가이드가 선택된 경우
        if (schedule.guide_driver_schedule === 'guide') {
          guideDriverGuideTime += duration
        }
        // 가이드+드라이버에서 드라이버가 선택된 경우
        else if (schedule.guide_driver_schedule === 'assistant') {
          guideDriverDriverTime += duration
        }
      }
    })

    const formatTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      
      if (hours > 0 && mins > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}`
      } else if (hours > 0) {
        return `${hours}:00`
      } else {
        return `${mins}분`
      }
    }

    return {
      twoGuidesGuide: formatTime(twoGuidesGuideTime),
      twoGuidesAssistant: formatTime(twoGuidesAssistantTime),
      guideDriverGuide: formatTime(guideDriverGuideTime),
      guideDriverDriver: formatTime(guideDriverDriverTime)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h4 className="text-lg font-medium text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            테이블 형식 일정 추가
          </h4>
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              {(() => {
                const timeData = calculateTotalTransportTime()
                return (
                  <>
                    <span>2가이드 (가이드: {timeData.twoGuidesGuide}, 어시스턴트: {timeData.twoGuidesAssistant})</span>
                    <span>가이드+드라이버 (가이드: {timeData.guideDriverGuide}, 드라이버: {timeData.guideDriverDriver})</span>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowEnglishFields(!showEnglishFields)}
            className={`px-3 py-1 text-sm rounded-lg border ${
              showEnglishFields 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {showEnglishFields ? 'EN' : 'KO'}
          </button>
          <button
            type="button"
            onClick={translateAllSchedules}
            disabled={translating || schedules.length === 0}
            className="flex items-center px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
            title="모든 스케줄을 한국어에서 영어로 번역"
          >
            {translating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Languages className="h-4 w-4 mr-1" />
            )}
            {translating ? '번역 중...' : '전체 번역'}
          </button>
          <button
            type="button"
            onClick={() => {
              const updatedSchedules = updateTimesBasedOnDuration(schedules)
              onSchedulesChange(updatedSchedules)
            }}
            disabled={schedules.length === 0}
            className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            title="모든 스케줄의 시간을 소요시간 기준으로 자동 계산"
          >
            <Calendar className="h-4 w-4 mr-1" />
            시간 계산
          </button>
          <button
            type="button"
            onClick={() => {
              fetchAvailableProducts()
              setShowCopyModal(true)
            }}
            disabled={schedules.length === 0}
            className="flex items-center px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm"
            title="현재 일정을 다른 제품으로 복사"
          >
            <Copy className="h-4 w-4 mr-1" />
            일정 복사
          </button>
          <button
            type="button"
            onClick={addNewSchedule}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            행 추가
          </button>
          <button
            type="button"
            onClick={() => {
              // 저장 전에 순서 자동 설정
              const updatedSchedules = schedules.map((schedule, index) => ({
                ...schedule,
                order_index: index + 1
              }))
              onSchedulesChange(updatedSchedules)
              onSave()
            }}
            disabled={saving || schedules.length === 0}
            className="flex items-center px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            <Save className="h-4 w-4 mr-1" />
            {saving ? '저장 중...' : '모두 저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
          >
            닫기
          </button>
        </div>
      </div>

      {/* 테이블 헤더 */}
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex gap-2 text-xs font-medium text-gray-600 items-center">
          <div className="w-[24px]"></div>
          <div className="w-[32px] text-center">삭제</div>
          <div className="w-[64px] text-center">썸네일</div>
          <div className="w-[40px] text-center">#</div>
          <div className="w-[40px] text-center">일차</div>
          <div className="w-[120px] text-center">시작</div>
          <div className="w-[120px] text-center">종료</div>
          <div className="w-[50px] text-center">소요(분)</div>
          <div className="w-[32px] text-center">시간없음</div>
          <div className="w-[160px] text-center">제목</div>
          <div className="w-[100px] text-center">설명</div>
          <div className="w-[100px] text-center">가이드메모</div>
          <div className="w-[100px] text-center">2가이드</div>
          <div className="w-[100px] text-center">가이드+드라이버</div>
          <div className="w-[32px] text-center">휴식</div>
          <div className="w-[32px] text-center">식사</div>
          <div className="w-[32px] text-center">이동</div>
          <div className="w-[32px] text-center">관광</div>
          <div className="w-[48px] text-center">고객표시</div>
          <div className="w-[120px] text-center">위치</div>
          <div className="w-[80px] text-center">위도</div>
          <div className="w-[80px] text-center">경도</div>
          <div className="w-[160px] text-center">구글맵</div>
        </div>
      </div>

      {/* 번역 오류 메시지 */}
      {translationError && (
        <div className="px-4 py-2 bg-red-50 border-l-4 border-red-400">
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
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 테이블 내용 */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-2">
          {schedules.map((schedule, index) => (
            <div 
              key={index} 
              className={`flex gap-2 items-center p-2 border rounded-lg transition-all duration-200 ${
                draggedIndex === index ? 'opacity-50 scale-95 shadow-lg' : ''
              } ${
                dragOverIndex === index ? 'bg-blue-50 border-blue-400 border-2 shadow-md transform scale-105' : 'border-gray-200'
              } ${
                draggedIndex !== null && draggedIndex !== index && dragOverIndex === index ? 'border-dashed border-blue-500 bg-blue-100' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {/* 드래그 핸들 */}
              <div className="flex items-center justify-center w-[24px] h-8 cursor-move text-gray-400 hover:text-gray-600">
                <GripVertical className="h-4 w-4" />
              </div>
              {/* 삭제 버튼 */}
              <div className="w-[32px] flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => removeSchedule(index)}
                  className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>


              {/* 썸네일 필드 */}
              <div className="w-[64px] flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailIndex(index)
                    setShowThumbnailModal(true)
                  }}
                  className="h-8 w-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                  title="썸네일 업로드"
                >
                  {schedule.thumbnail_url ? (
                    <Image 
                      src={schedule.thumbnail_url} 
                      alt="썸네일" 
                      width={24}
                      height={24}
                      className="object-cover rounded"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* 순서 */}
              <div className="w-[40px] flex justify-center items-center">
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  {schedule.order_index || index + 1}
                </div>
              </div>

              {/* 일차 */}
              <div className="w-[40px]">
                <input
                  type="number"
                  value={schedule.day_number}
                  onChange={(e) => updateSchedule(index, 'day_number', parseInt(e.target.value))}
                  className="w-full h-8 px-1 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="1"
                />
              </div>

              {/* 시작시간 (선택사항) */}
              <div className="w-[120px]">
                <input
                  type="time"
                  value={schedule.start_time || ''}
                  onChange={(e) => {
                    const newStartTime = e.target.value || null
                    const newEndTime = newStartTime && schedule.duration_minutes 
                      ? calculateEndTime(newStartTime, schedule.duration_minutes) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      start_time: newStartTime,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="선택사항"
                />
              </div>

              {/* 종료시간 (선택사항) */}
              <div className="w-[120px]">
                <input
                  type="time"
                  value={schedule.end_time || ''}
                  onChange={(e) => {
                    const newEndTime = e.target.value || null
                    const newDuration = schedule.start_time && newEndTime 
                      ? calculateDuration(schedule.start_time, newEndTime) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      end_time: newEndTime,
                      duration_minutes: newDuration
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="선택사항"
                />
              </div>

              {/* 소요시간 (선택사항) */}
              <div className="w-[50px]">
                <input
                  type="number"
                  value={schedule.duration_minutes || ''}
                  onChange={(e) => {
                    const newDuration = parseInt(e.target.value) || null
                    const newEndTime = schedule.start_time && newDuration 
                      ? calculateEndTime(schedule.start_time, newDuration) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      duration_minutes: newDuration,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  onWheel={(e) => {
                    e.preventDefault()
                    const delta = e.deltaY > 0 ? -5 : 5
                    const currentDuration = schedule.duration_minutes || 0
                    const newDuration = Math.max(5, currentDuration + delta)
                    const newEndTime = schedule.start_time 
                      ? calculateEndTime(schedule.start_time, newDuration) 
                      : null
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      duration_minutes: newDuration,
                      end_time: newEndTime
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-full h-8 px-1 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  min="5"
                  step="5"
                  placeholder="분"
                />
              </div>

              {/* 시간 없음 체크박스 */}
              <div className="w-[32px] flex justify-center items-center">
                <input
                  type="checkbox"
                  checked={schedule.no_time || false}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      no_time: e.target.checked,
                      start_time: e.target.checked ? null : updatedSchedules[index].start_time,
                      end_time: e.target.checked ? null : updatedSchedules[index].end_time
                      // duration_minutes는 유지
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* 제목과 설명 필드 */}
              <div className="flex items-center" style={{ gap: '10px' }}>
                {/* 제목 필드 */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={showEnglishFields ? (schedule.title_en || '') : (schedule.title_ko || '')}
                    onChange={(e) => {
                      if (showEnglishFields) {
                        updateSchedule(index, 'title_en', e.target.value)
                      } else {
                        updateSchedule(index, 'title_ko', e.target.value)
                      }
                    }}
                    className="w-full h-8 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder={showEnglishFields ? "English title" : "한국어 제목"}
                  />
                </div>

                {/* 설명 필드 */}
                <div className="flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTextModalType('description')
                      setTextModalIndex(index)
                      setShowTextModal(true)
                    }}
                    className={`w-[100px] h-8 px-1 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-left hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                      (showEnglishFields ? !schedule.description_en : !schedule.description_ko) 
                        ? 'bg-red-50 border-red-300 text-red-700' 
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                    }`}
                  >
                    <span className="truncate font-medium">
                      설명
                    </span>
                    <span className="text-xs">📝</span>
                  </button>
                </div>
              </div>

              {/* 가이드 메모 */}
              <div className="w-[100px]">
                <button
                  type="button"
                  onClick={() => {
                    setTextModalType('guide_notes')
                    setTextModalIndex(index)
                    setShowTextModal(true)
                  }}
                  className={`w-full h-8 px-1 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-left hover:bg-gray-50 cursor-pointer flex items-center justify-between ${
                    (showEnglishFields ? !schedule.guide_notes_en : !schedule.guide_notes_ko) 
                      ? 'bg-red-50 border-red-300 text-red-700' 
                      : 'bg-green-50 border-green-300 text-green-700'
                  }`}
                >
                  <span className="truncate font-medium">
                    {showEnglishFields ? "English guide memo" : "가이드 메모"}
                  </span>
                  <span className="text-xs">📝</span>
                </button>
              </div>

              {/* 2가이드 담당자 선택 */}
              <div className="w-[100px]">
                <button
                  type="button"
                  onClick={() => {
                    const currentValue = schedule.two_guide_schedule || ''
                    let nextValue = ''
                    if (currentValue === '') {
                      nextValue = 'guide'
                    } else if (currentValue === 'guide') {
                      nextValue = 'assistant'
                    } else {
                      nextValue = ''
                    }
                    updateSchedule(index, 'two_guide_schedule', nextValue)
                  }}
                  className={`w-full h-8 px-1 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-medium transition-colors ${
                    schedule.two_guide_schedule === 'guide' 
                      ? 'bg-blue-100 border-blue-400 text-blue-800' 
                      : schedule.two_guide_schedule === 'assistant'
                      ? 'bg-purple-100 border-purple-400 text-purple-800'
                      : 'bg-gray-100 border-gray-300 text-gray-600'
                  }`}
                >
                  {schedule.two_guide_schedule === 'guide' 
                    ? '가이드' 
                    : schedule.two_guide_schedule === 'assistant'
                    ? '어시스턴트'
                    : '선택'}
                </button>
              </div>

              {/* 가이드+드라이버 담당자 선택 */}
              <div className="w-[100px]">
                <button
                  type="button"
                  onClick={() => {
                    const currentValue = schedule.guide_driver_schedule || ''
                    let nextValue = ''
                    if (currentValue === '') {
                      nextValue = 'guide'
                    } else if (currentValue === 'guide') {
                      nextValue = 'assistant'
                    } else {
                      nextValue = ''
                    }
                    updateSchedule(index, 'guide_driver_schedule', nextValue)
                  }}
                  className={`w-full h-8 px-1 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center font-medium transition-colors ${
                    schedule.guide_driver_schedule === 'guide' 
                      ? 'bg-blue-100 border-blue-400 text-blue-800' 
                      : schedule.guide_driver_schedule === 'assistant'
                      ? 'bg-orange-100 border-orange-400 text-orange-800'
                      : 'bg-gray-100 border-gray-300 text-gray-600'
                  }`}
                >
                  {schedule.guide_driver_schedule === 'guide' 
                    ? '가이드' 
                    : schedule.guide_driver_schedule === 'assistant'
                    ? '드라이버'
                    : '선택'}
                </button>
              </div>

              {/* 휴식 체크박스 */}
              <div className="w-[32px] flex justify-center items-center">
                <input
                  type="checkbox"
                  checked={schedule.is_break || false}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      is_break: e.target.checked
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* 식사 체크박스 */}
              <div className="w-[32px] flex justify-center items-center">
                <input
                  type="checkbox"
                  checked={schedule.is_meal || false}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      is_meal: e.target.checked
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* 이동 체크박스 */}
              <div className="w-[32px] flex justify-center items-center">
                <input
                  type="checkbox"
                  checked={schedule.is_transport || false}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      is_transport: e.target.checked
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* 관광 체크박스 */}
              <div className="w-[32px] flex justify-center items-center">
                <input
                  type="checkbox"
                  checked={schedule.is_tour || false}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      is_tour: e.target.checked
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* 고객표시 체크박스 */}
              <div className="w-[48px] flex justify-center items-center">
                <input
                  type="checkbox"
                  checked={schedule.show_to_customers || false}
                  onChange={(e) => {
                    const updatedSchedules = [...schedules]
                    updatedSchedules[index] = {
                      ...updatedSchedules[index],
                      show_to_customers: e.target.checked
                    }
                    onSchedulesChange(updatedSchedules)
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>

              {/* 위치 필드 */}
              <div className="w-[120px]">
                <input
                  type="text"
                  value={schedule.location_ko || ''}
                  onChange={(e) => {
                    updateSchedule(index, 'location_ko', e.target.value)
                  }}
                  className="w-full h-8 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="위치명"
                />
              </div>

              {/* 위도 필드 */}
              <div className="w-[80px]">
                <input
                  type="number"
                  step="0.0000001"
                  value={schedule.latitude || ''}
                  onChange={(e) => {
                    updateSchedule(index, 'latitude', e.target.value ? parseFloat(e.target.value) : null)
                  }}
                  className="w-full h-8 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="위도"
                />
              </div>

              {/* 경도 필드 */}
              <div className="w-[80px]">
                <input
                  type="number"
                  step="0.0000001"
                  value={schedule.longitude || ''}
                  onChange={(e) => {
                    updateSchedule(index, 'longitude', e.target.value ? parseFloat(e.target.value) : null)
                  }}
                  className="w-full h-8 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="경도"
                />
              </div>

              {/* 구글맵 링크 필드 */}
              <div className="w-[160px]">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={schedule.google_maps_link || ''}
                    onChange={(e) => {
                      updateSchedule(index, 'google_maps_link', e.target.value)
                    }}
                    className="flex-1 h-8 px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="구글맵 링크"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      console.log('지도 버튼 클릭 - index:', index, 'schedule:', schedules[index])
                      setMapModalIndex(index)
                      setShowMapModal(true)
                    }}
                    className="w-8 h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded flex items-center justify-center"
                  >
                    <MapPin className="h-4 w-4" />
                  </button>
                  {schedule.google_maps_link && (
                    <a
                      href={schedule.google_maps_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 text-green-600 hover:text-green-800 hover:bg-green-50 rounded flex items-center justify-center"
                      title="구글맵 링크 열기"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 지도 위치 선택 모달 */}
        {showLocationPicker && locationPickerIndex !== null && (
        <LocationPickerModal
          currentLat={schedules[locationPickerIndex!]?.latitude ?? undefined}
          currentLng={schedules[locationPickerIndex!]?.longitude ?? undefined}
          scheduleId={schedules[locationPickerIndex!]?.id} // 스케줄 ID 전달
          onLocationSelect={(lat, lng, address) => {
            const updatedSchedules = [...schedules]
            updatedSchedules[locationPickerIndex!] = {
              ...updatedSchedules[locationPickerIndex!],
              latitude: lat,
              longitude: lng,
              location_ko: address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            }
            onSchedulesChange(updatedSchedules)
            setShowLocationPicker(false)
            setLocationPickerIndex(null)
          }}
          onClose={() => {
            setShowLocationPicker(false)
            setLocationPickerIndex(null)
          }}
        />
      )}

      {/* 썸네일 업로드 모달 */}
      {showThumbnailModal && thumbnailIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">썸네일 업로드</h3>
              <button
                onClick={() => {
                  setShowThumbnailModal(false)
                  setThumbnailIndex(null)
                  setShowBucketImages(false)
                }}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 왼쪽: 업로드 영역 */}
              <div className="space-y-4">
                {/* 현재 썸네일 표시 */}
                {schedules[thumbnailIndex!]?.thumbnail_url && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">현재 썸네일:</p>
                    <Image 
                      src={schedules[thumbnailIndex!].thumbnail_url!} 
                      alt="현재 썸네일" 
                      width={400}
                      height={192}
                      className="mx-auto max-w-full max-h-48 object-contain rounded-lg border"
                    />
                  </div>
                )}
                
                {/* 드래그 앤 드롭 영역 */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragOver 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={(e) => handleDragOver(e, thumbnailIndex!)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleFileDrop}
                  onPaste={handlePaste}
                  tabIndex={0}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-2">
                    파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    또는 Ctrl+V로 클립보드 이미지 붙여넣기
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingThumbnail}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {uploadingThumbnail ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        업로드 중...
                      </>
                    ) : (
                      '파일 선택'
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file && thumbnailIndex !== null) {
                        setUploadingThumbnail(true)
                        try {
                          const result = await uploadThumbnail(file, productId)
                          if (result.success && result.url) {
                            updateSchedule(thumbnailIndex!, 'thumbnail_url', result.url)
                          } else {
                            alert(result.error || '업로드에 실패했습니다.')
                          }
                        } catch (error) {
                          console.error('업로드 오류:', error)
                          alert('업로드 중 오류가 발생했습니다.')
                        } finally {
                          setUploadingThumbnail(false)
                        }
                      }
                    }}
                    className="hidden"
                  />
                </div>
                
                {/* URL 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    이미지 URL 입력
                  </label>
                  <input
                    type="url"
                    value={schedules[thumbnailIndex]?.thumbnail_url || ''}
                    onChange={(e) => updateSchedule(thumbnailIndex, 'thumbnail_url', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                {/* 썸네일 삭제 */}
                {schedules[thumbnailIndex]?.thumbnail_url && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (thumbnailIndex !== null) {
                        const currentUrl = schedules[thumbnailIndex].thumbnail_url
                        if (currentUrl) {
                          // Supabase Storage URL인 경우 실제 파일도 삭제
                          if (isSupabaseStorageUrl(currentUrl)) {
                            try {
                              await deleteThumbnail(currentUrl)
                            } catch (error) {
                              console.error('파일 삭제 오류:', error)
                              // 파일 삭제 실패해도 DB에서 URL은 제거
                            }
                          }
                          updateSchedule(thumbnailIndex, 'thumbnail_url', '')
                        }
                      }
                    }}
                    className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    썸네일 삭제
                  </button>
                )}
              </div>
              
              {/* 오른쪽: 버킷 이미지 선택 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-md font-medium text-gray-900">기존 이미지 선택</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBucketImages(!showBucketImages)
                      if (!showBucketImages && bucketImages.length === 0) {
                        fetchBucketImages()
                      }
                    }}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    {showBucketImages ? '숨기기' : '보기'}
                  </button>
                </div>
                
                {showBucketImages && (
                  <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                    {loadingBucketImages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-gray-600">이미지 로딩 중...</span>
                      </div>
                    ) : bucketImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {bucketImages.map((image, index) => (
                          <div
                            key={index}
                            className="relative group cursor-pointer"
                            onClick={() => {
                              if (thumbnailIndex !== null) {
                                updateSchedule(thumbnailIndex, 'thumbnail_url', image.url)
                              }
                            }}
                          >
                            <Image
                              src={image.url}
                              alt={image.name}
                              width={80}
                              height={80}
                              className="w-full h-20 object-cover rounded border hover:border-blue-500 transition-colors"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded flex items-center justify-center">
                              <Copy className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>업로드된 이미지가 없습니다.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowThumbnailModal(false)
                  setThumbnailIndex(null)
                  setShowBucketImages(false)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 텍스트 입력 모달 */}
      {showTextModal && textModalIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {textModalType === 'description' 
                ? (showEnglishFields ? 'English Description' : '한국어 설명')
                : (showEnglishFields ? 'Guide Notes (English)' : '가이드 메모 (한국어)')
              }
            </h3>
            
            <textarea
              value={(() => {
                if (textModalType === 'description') {
                  return showEnglishFields ? (schedules[textModalIndex].description_en || '') : (schedules[textModalIndex].description_ko || '')
                } else {
                  return showEnglishFields ? (schedules[textModalIndex].guide_notes_en || '') : (schedules[textModalIndex].guide_notes_ko || '')
                }
              })()}
              onChange={(e) => {
                if (textModalType === 'description') {
                  if (showEnglishFields) {
                    updateSchedule(textModalIndex, 'description_en', e.target.value)
                  } else {
                    updateSchedule(textModalIndex, 'description_ko', e.target.value)
                  }
                } else {
                  if (showEnglishFields) {
                    updateSchedule(textModalIndex, 'guide_notes_en', e.target.value)
                  } else {
                    updateSchedule(textModalIndex, 'guide_notes_ko', e.target.value)
                  }
                }
              }}
              className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={textModalType === 'description' 
                ? (showEnglishFields ? 'Enter English description...' : '한국어 설명을 입력하세요...')
                : (showEnglishFields ? 'Enter guide notes in English...' : '가이드 메모를 입력하세요...')
              }
            />
            
            <div className="flex justify-end space-x-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowTextModal(false)
                  setTextModalIndex(null)
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새로운 지도 모달 */}
      {showMapModal && mapModalIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">위치 선택</h3>
              <button
                onClick={() => {
                  setShowMapModal(false)
                  setMapModalIndex(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                다양한 방법으로 위치를 검색할 수 있습니다:
              </p>
              <ul className="text-xs text-gray-500 mb-3 ml-4 space-y-1">
                <li>• <strong>장소명:</strong> "Bellagio Hotel", "베네시안 호텔"</li>
                <li>• <strong>주소:</strong> "3750 Las Vegas Blvd S", "라스베가스 스트립"</li>
                <li>• <strong>좌표:</strong> "36.1699, -115.1398" 또는 "36.1699 -115.1398"</li>
                <li>• <strong>Plus Code:</strong> "MGXF+WC Las Vegas"</li>
                <li>• <strong>업체/브랜드:</strong> "마땡땡스 필립", "인앤아웃 버거"</li>
                <li>• <strong>카테고리:</strong> "호텔", "식당", "쇼핑몰"</li>
              </ul>
              <p className="text-xs text-gray-400 mb-3">
                지도에서 클릭하여 좌표를 직접 선택할 수도 있습니다. 또는 아래 검색 결과에서 원하는 장소를 클릭하세요.
              </p>
              
              {/* 검색 기능 */}
              <div className="mb-3 map-search-container">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={mapSearchQuery}
                    onChange={(e) => handleMapSearchChange(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && mapSuggestions.length > 0) {
                        handleMapLocationSelect(mapSuggestions[0])
                      }
                    }}
                    onFocus={() => {
                      if (mapSuggestions.length > 0) {
                        setShowMapSuggestions(true)
                      }
                    }}
                    placeholder="장소명, 주소, 좌표, Plus Code 등으로 검색하세요..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {isMapSearchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>

                {/* 검색 제안 목록 */}
                {showMapSuggestions && mapSuggestions.length > 0 && (
                  <div className="relative z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {mapSuggestions.map((suggestion, index) => (
                  <button
                        key={`${suggestion.placeId || suggestion.searchType}_${index}`}
                        onClick={() => handleMapLocationSelect(suggestion)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate">
                              {suggestion.name}
                            </div>
                            <div className="text-sm text-gray-600 truncate">
                              {suggestion.address}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {suggestion.rating && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-yellow-600">⭐</span>
                                  <span className="text-xs text-gray-600">{suggestion.rating.toFixed(1)}</span>
                                  {suggestion.userRatingsTotal && (
                                    <span className="text-xs text-gray-500">({suggestion.userRatingsTotal.toLocaleString()}개 리뷰)</span>
                                  )}
                                </div>
                              )}
                              {suggestion.types && suggestion.types.includes('plus_code') && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">Plus Code</span>
                                </div>
                              )}
                              {suggestion.types && suggestion.types.includes('geocode') && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs bg-green-100 text-green-700 px-1 rounded">주소 검색</span>
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                좌표: {suggestion.latitude.toFixed(6)}, {suggestion.longitude.toFixed(6)}
                              </div>
                            </div>
                          </div>
                        </div>
                  </button>
                    ))}
                </div>
                )}
              </div>

              {/* 선택된 위치 정보 */}
              {(mapSearchQuery || selectedAddress) && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900">{mapSearchQuery || '저장된 위치'}</span>
                      </div>
                      <div className="text-sm text-blue-700 mb-2">{selectedAddress}</div>
                      <div className="text-xs text-blue-600">
                        좌표: {(document.getElementById('latitude') as HTMLInputElement)?.value || 'N/A'}, {(document.getElementById('longitude') as HTMLInputElement)?.value || 'N/A'}
                      </div>
                    </div>
                    {selectedGoogleMapLink && (
                    <a 
                      href={selectedGoogleMapLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                        <ExternalLink className="w-3 h-3" />
                        구글 맵
                    </a>
                    )}
                  </div>
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

            {/* 선택된 위치 정보 */}
            {(selectedAddress || modalLatitude) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-1">선택된 위치</h4>
                <p className="text-sm text-blue-800">{selectedAddress}</p>
                {(modalLatitude || modalLongitude) && (
                  <p className="text-xs text-blue-600 mt-1">
                    좌표: {modalLatitude || '위도 없음'}, {modalLongitude || '경도 없음'}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  위도 (Latitude)
                </label>
                <input
                  type="number"
                  step="any"
                  id="latitude"
                  value={modalLatitude}
                  onChange={(e) => setModalLatitude(e.target.value)}
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
                  value={modalLongitude}
                  onChange={(e) => setModalLongitude(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: -115.1398"
                />
              </div>
            </div>

            {/* 주변 장소 목록 */}
            {showNearbyPlaces && nearbyPlaces.length > 0 && (
              <div className="mb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                  주변 장소 ({nearbyPlaces.length}개)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                  {nearbyPlaces.map((place, index) => (
                    <div 
                      key={place.placeId}
                      onClick={() => selectNearbyPlace(place)}
                      className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-grow min-w-0">
                        <h5 className="text-sm font-medium text-gray-900 truncate">
                          {place.name}
                        </h5>
                        <p className="text-xs text-gray-600 truncate">
                          {place.address}
                        </p>
                        {place.rating && (
                          <div className="flex items-center mt-1">
                            <span className="text-xs text-yellow-600">⭐</span>
                            <span className="text-xs text-gray-500 ml-1">
                              {place.rating.toFixed(1)} ({place.userRatingsTotal}개 리뷰)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  개수를 클릭하면 해당 장소가 선택됩니다.
                </p>
              </div>
            )}

            {/* 주변 장소 로딩 */}
            {isLoadingNearbyPlaces && (
              <div className="mb-4 flex items-center justify-center py-4">
                <div className="flex items-center space-x-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">주변 장소 검색 중...</span>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMapModal(false)
                  setMapModalIndex(null)
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  // 입력 필드에서 직접 좌표 읽기
                  const latInput = document.getElementById('latitude') as HTMLInputElement
                  const lngInput = document.getElementById('longitude') as HTMLInputElement
                  const lat = latInput?.value?.trim() || modalLatitude.trim()
                  const lng = lngInput?.value?.trim() || modalLongitude.trim()
                  
                  console.log('🔘 좌표 적용 버튼 클릭')
                  console.log('📝 입력 필드에서 읽은 값:', { 
                    lat, 
                    lng, 
                    latInputValue: latInput?.value,
                    lngInputValue: lngInput?.value,
                    modalLatitude,
                    modalLongitude
                  })
                  console.log('📍 모달 상태값:', { 
                    selectedAddress, 
                    selectedGoogleMapLink, 
                    mapModalIndex,
                    currentScheduleId: mapModalIndex !== null ? schedules[mapModalIndex!]?.id : 'null'
                  })
                  console.log('📊 현재 스케줄 데이터:', mapModalIndex !== null ? schedules[mapModalIndex!] : 'null')
                  
                  if (lat && lng && lat.trim() !== '' && lng.trim() !== '') {
                    console.log('✅ 유효한 좌표 감지, 처리 시작')
                    const parsedLat = parseFloat(lat)
                    const parsedLng = parseFloat(lng)
                    console.log('🔄 파싱된 좌표:', { parsedLat, parsedLng })
                    
                    handleMapCoordinateSelect(
                      parsedLat, 
                      parsedLng, 
                      selectedAddress || undefined,
                      selectedGoogleMapLink || undefined
                    )
                  } else {
                    console.warn('❌ 유효하지 않은 좌표:', { lat, lng })
                    alert('위도와 경도를 모두 입력해주세요.')
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

      {/* 일정 복사 모달 */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">일정 복사</h3>
              <button
                onClick={() => {
                  setShowCopyModal(false)
                  setSelectedProductId('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                현재 일정을 다른 제품으로 복사합니다. ({schedules.length}개 일정)
              </p>
              
              <label className="block text-sm font-medium text-gray-700 mb-2">
                복사할 제품 선택
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">제품을 선택하세요</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name || `제품 ${product.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCopyModal(false)
                  setSelectedProductId('')
                }}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCopySchedules}
                disabled={!selectedProductId || copying}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center"
              >
                {copying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    복사 중...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    복사하기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
