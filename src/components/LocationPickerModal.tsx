'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Google Maps 타입 정의
declare global {
  interface Window {
    google: typeof google
  }
}

interface LocationPickerModalProps {
  currentLat?: number
  currentLng?: number
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  onClose: () => void
  scheduleId?: string // 스케줄 ID 추가 (선택적)
}

export default function LocationPickerModal({ 
  currentLat, 
  currentLng, 
  onLocationSelect, 
  onClose,
  scheduleId
}: LocationPickerModalProps) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedLat, setSelectedLat] = useState(currentLat || 36.1699) // 라스베가스 위도
  const [selectedLng, setSelectedLng] = useState(currentLng || -115.1398) // 라스베가스 경도
  const [address, setAddress] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [marker, setMarker] = useState<google.maps.Marker | null>(null)
  const [apiKeyError, setApiKeyError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 라스베가스 중심 좌표
  const LAS_VEGAS_CENTER = { lat: 36.1699, lng: -115.1398 }

  useEffect(() => {
    // Google Maps API 키 확인
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey || apiKey === 'undefined') {
      console.error('Google Maps API 키가 설정되지 않았습니다. .env.local 파일에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY를 설정해주세요.')
      setApiKeyError(true)
      return
    }

    // Google Maps API 로드 (중복 로드 방지)
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    
    if (!window.google && !existingScript) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.id = 'google-maps-script'
      
      // 스크립트 로드 완료 후 초기화
      script.onload = () => {
        // Google Maps API가 완전히 로드될 때까지 대기
        const checkGoogleMaps = () => {
          if (window.google && window.google.maps && window.google.maps.MapTypeId) {
            initializeMap()
          } else {
            setTimeout(checkGoogleMaps, 50)
          }
        }
        checkGoogleMaps()
      }
      
      // 스크립트 로드 실패 처리
      script.onerror = () => {
        console.error('Google Maps API 스크립트 로드에 실패했습니다.')
        setApiKeyError(true)
      }
      
      document.head.appendChild(script)
    } else if (window.google && window.google.maps && window.google.maps.MapTypeId) {
      // 이미 로드된 경우 바로 초기화
      initializeMap()
    } else if (window.google) {
      // Google이 로드되었지만 Maps API가 아직 준비되지 않은 경우
      const checkGoogleMaps = () => {
        if (window.google && window.google.maps && window.google.maps.MapTypeId) {
          initializeMap()
        } else {
          setTimeout(checkGoogleMaps, 50)
        }
      }
      checkGoogleMaps()
    }
  }, [])

  // currentLat, currentLng가 변경될 때 지도와 마커 업데이트 (모달 열 때만)
  useEffect(() => {
    if (map && marker && currentLat && currentLng) {
      const newPosition = { lat: currentLat, lng: currentLng }
      map.setCenter(newPosition)
      marker.setPosition(newPosition)
      setSelectedLat(currentLat)
      setSelectedLng(currentLng)
      reverseGeocode(currentLat, currentLng)
    }
  }, [map, marker, initializeMap])

  const initializeMap = () => {
    const mapElement = document.getElementById('map')
    if (!mapElement || !window.google || !window.google.maps) return

    // Google Maps API가 완전히 로드되었는지 확인
    if (!window.google.maps.MapTypeId || !window.google.maps.MapTypeId.ROADMAP) {
      console.warn('Google Maps API가 완전히 로드되지 않았습니다. 잠시 후 다시 시도합니다.')
      setTimeout(initializeMap, 100)
      return
    }

    // Map ID 설정
    const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
    console.log('LocationPickerModal Map ID:', mapId ? '설정됨' : '설정되지 않음', mapId)
    
    const mapOptions: google.maps.MapOptions = {
      center: currentLat && currentLng ? { lat: currentLat, lng: currentLng } : LAS_VEGAS_CENTER,
      zoom: 13,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    }
    
    // Map ID가 있으면 Advanced Markers를 위한 맵 ID 설정
    if (mapId) {
      mapOptions.mapId = mapId
      console.log('LocationPickerModal - Advanced Markers Map ID 설정:', mapId)
    } else {
      console.warn('LocationPickerModal - Map ID 없음, 기본 마커 사용')
    }

    const newMap = new window.google.maps.Map(mapElement, mapOptions)

    // Advanced Marker 또는 기본 Marker 생성
    let newMarker: google.maps.Marker
    if (window.google?.maps?.marker?.AdvancedMarkerElement && mapId) {
      newMarker = new window.google.maps.marker.AdvancedMarkerElement({
        position: currentLat && currentLng ? { lat: currentLat, lng: currentLng } : LAS_VEGAS_CENTER,
        map: newMap,
        draggable: true,
        title: '선택된 위치'
      })
      console.log('LocationPickerModal - Advanced Marker 생성 성공')
    } else {
      newMarker = new window.google.maps.Marker({
        position: currentLat && currentLng ? { lat: currentLat, lng: currentLng } : LAS_VEGAS_CENTER,
        map: newMap,
        draggable: true,
        title: '선택된 위치'
      })
      console.log('LocationPickerModal - 기본 Marker 사용')
    }

    // 지도 클릭 이벤트
    newMap.addListener('click', (event: google.maps.MapMouseEvent) => {
      const lat = event.latLng.lat()
      const lng = event.latLng.lng()
      newMarker.setPosition({ lat, lng })
      setSelectedLat(lat)
      setSelectedLng(lng)
      reverseGeocode(lat, lng)
    })

    // 마커 드래그 이벤트
    newMarker.addListener('dragend', () => {
      const position = newMarker.getPosition()
      const lat = position.lat()
      const lng = position.lng()
      setSelectedLat(lat)
      setSelectedLng(lng)
      reverseGeocode(lat, lng)
    })

    setMap(newMap)
    setMarker(newMarker)
    setMapLoaded(true)

    // 초기 주소 설정
    if (currentLat && currentLng) {
      reverseGeocode(currentLat, currentLng)
    }
  }

  const reverseGeocode = (lat: number, lng: number) => {
    if (!window.google) return

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results: google.maps.GeocoderResult[], status: string) => {
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address)
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      }
    })
  }

  // 위치 검색 (LocationSearch와 같은 방식)
  const searchPlaces = async (query: string) => {
    if (!query.trim() || !mapLoaded) return

    setIsLoading(true)
    try {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      )

      const request = {
        query: query,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'url', 'types', 'rating', 'user_ratings_total'],
        locationBias: { lat: 36.1699, lng: -115.1398, radius: 100000 }, // 라스베가스 중심 100km 반경
        region: 'US' // 미국 지역 우선
      }

      service.textSearch(request, (results: google.maps.places.PlaceResult[], status: google.maps.places.PlacesServiceStatus) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          // 결과를 평점과 리뷰 수로 정렬하여 더 관련성 높은 결과 우선 표시
          const sortedResults = results
            .filter(place => place.rating && place.user_ratings_total > 0) // 평점이 있는 장소만
            .sort((a, b) => {
              // 평점과 리뷰 수를 고려한 점수 계산
              const scoreA = (a.rating * Math.log(a.user_ratings_total + 1))
              const scoreB = (b.rating * Math.log(b.user_ratings_total + 1))
              return scoreB - scoreA
            })
            .slice(0, 8) // 상위 8개 결과만 표시

          const formattedResults = sortedResults.map((place) => ({
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            types: place.types
          }))
          
          setSuggestions(formattedResults)
          setShowSuggestions(true)
        } else {
          // Places API 실패 시 빈 결과 표시
          setSuggestions([])
          setShowSuggestions(false)
        }
        setIsLoading(false)
      })
    } catch (error) {
      console.error('위치 검색 오류:', error)
      setIsLoading(false)
    }
  }

  // 검색어 변경 처리
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (value.trim()) {
      searchPlaces(value)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  // 위치 선택
  const handleLocationSelect = (location: google.maps.places.PlaceResult) => {
    const lat = location.latitude
    const lng = location.longitude
    
    setSelectedLat(lat)
    setSelectedLng(lng)
    setSearchQuery(location.name)
    setAddress(location.address)
    setShowSuggestions(false)
    
    if (map && marker) {
      map.setCenter({ lat, lng })
      marker.setPosition({ lat, lng })
    }
  }

  const handleConfirm = async () => {
    // 스케줄 ID가 있으면 Supabase에 즉시 저장
    if (scheduleId) {
      try {
        const { error } = await supabase
          .from('product_schedules')
          .update({
            latitude: selectedLat,
            longitude: selectedLng,
            location_ko: address
          })
          .eq('id', scheduleId)

        if (error) {
          console.error('좌표 저장 오류:', error)
          alert('좌표 저장 중 오류가 발생했습니다.')
          return
        }
        
        console.log('좌표가 성공적으로 저장되었습니다:', { 
          lat: selectedLat, 
          lng: selectedLng, 
          address 
        })
      } catch (error) {
        console.error('좌표 저장 중 예외 발생:', error)
        alert('좌표 저장 중 오류가 발생했습니다.')
        return
      }
    }
    
    onLocationSelect(selectedLat, selectedLng, address)
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Enter 키를 누르면 첫 번째 제안을 선택하거나 검색 실행
      if (suggestions.length > 0) {
        handleLocationSelect(suggestions[0])
      }
    }
  }

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.search-container')) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            위치 선택
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 검색 바 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative search-container">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowSuggestions(true)
                }
              }}
              placeholder="라스베가스 지역 검색 (예: Strip, Fremont Street, Red Rock Canyon)"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>

          {/* 검색 제안 목록 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.placeId}
                  onClick={() => handleLocationSelect(suggestion)}
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

        {/* 지도 영역 */}
        <div className="flex-1 relative">
          {apiKeyError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-6">
                <div className="text-red-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Google Maps API 키 오류</h3>
                <p className="text-gray-600 mb-4">
                  Google Maps API 키가 설정되지 않았습니다.
                </p>
                <div className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                  <p className="font-medium mb-2">해결 방법:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>프로젝트 루트에 <code className="bg-gray-200 px-1 rounded">.env.local</code> 파일 생성</li>
                    <li>다음 내용 추가:</li>
                  </ol>
                  <pre className="mt-2 bg-gray-200 p-2 rounded text-xs overflow-x-auto">
{`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here`}
                  </pre>
                  <p className="mt-2 text-xs text-gray-500">
                    * Google Cloud Console에서 Maps JavaScript API 키를 발급받아 사용하세요.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div id="map" className="w-full h-full" />
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">지도를 불러오는 중...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 선택된 위치 정보 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          {address ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">{searchQuery || '선택된 위치'}</span>
                  </div>
                  <div className="text-sm text-blue-700 mb-2">{address}</div>
                  <div className="text-xs text-blue-600">
                    좌표: {selectedLat.toFixed(6)}, {selectedLng.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>위치를 검색하거나 지도에서 클릭하여 선택해주세요</p>
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex justify-between gap-2 p-4 border-t border-gray-200">
          <button
            onClick={() => {
              setSelectedLat(36.1699)
              setSelectedLng(-115.1398)
              setAddress('')
              setSearchQuery('')
              if (map && marker) {
                map.setCenter(LAS_VEGAS_CENTER)
                marker.setPosition(LAS_VEGAS_CENTER)
              }
            }}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            위치 초기화
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              위치 선택
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
