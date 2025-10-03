'use client'

import React, { useState, useEffect, useRef } from 'react'
import { MapPin, Search, X, ExternalLink } from 'lucide-react'

interface LocationData {
  name: string
  address: string
  latitude: number
  longitude: number
  placeId: string
  googleMapsUrl: string
  rating?: number
  userRatingsTotal?: number
  types?: string[]
}

interface LocationSearchProps {
  onLocationSelect: (location: LocationData) => void
  initialLocation?: LocationData
  placeholder?: string
  className?: string
}

declare global {
  interface Window {
    google: any
  }
}

export default function LocationSearch({ 
  onLocationSelect, 
  initialLocation,
  placeholder = "위치를 검색하세요...",
  className = ""
}: LocationSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 구글 맵 API 로드 (중복 로드 방지)
  useEffect(() => {
    const loadGoogleMaps = () => {
      // 이미 로드된 경우
      if (window.google && window.google.maps && window.google.maps.places) {
        setMapLoaded(true)
        return
      }

      // 이미 스크립트가 있는지 확인
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        // 스크립트가 있지만 아직 로드되지 않은 경우 대기
        const checkLoaded = () => {
          if (window.google && window.google.maps && window.google.maps.places) {
            setMapLoaded(true)
          } else {
            setTimeout(checkLoaded, 100)
          }
        }
        checkLoaded()
        return
      }

      // 새로운 스크립트 로드
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&loading=async`
      script.async = true
      script.defer = true
      script.id = 'google-maps-script'
      
      script.onload = () => {
        const checkGoogleMaps = () => {
          if (window.google && window.google.maps && window.google.maps.places) {
            setMapLoaded(true)
          } else {
            setTimeout(checkGoogleMaps, 50)
          }
        }
        checkGoogleMaps()
      }
      
      script.onerror = () => {
        console.error('Google Maps API 로드 실패')
      }
      
      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [])

  // Plus Code 패턴 감지
  const isPlusCode = (query: string) => {
    // Plus Code 패턴: 알파벳+숫자 조합 (예: MGXF+WC, 8FVC9G8F+5W)
    const plusCodePattern = /^[A-Z0-9]{2,10}\+[A-Z0-9]{2,10}$/i
    return plusCodePattern.test(query.trim())
  }

  // Plus Code를 좌표로 변환
  const decodePlusCode = async (plusCode: string) => {
    try {
      const geocoder = new window.google.maps.Geocoder()
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

  // 위치 검색 (Plus Code 지원 포함)
  const searchPlaces = async (query: string) => {
    if (!query.trim() || !mapLoaded) return

    setIsLoading(true)
    try {
      // Plus Code인 경우 특별 처리
      if (isPlusCode(query)) {
        const geocodeResult = await decodePlusCode(query)
        if (geocodeResult) {
          const location = geocodeResult.geometry.location
          const lat = location.lat()
          const lng = location.lng()
          
          const plusCodeResult = {
            placeId: `plus_code_${Date.now()}`,
            name: `Plus Code 위치 (${query})`,
            address: geocodeResult.formatted_address,
            latitude: lat,
            longitude: lng,
            googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
            rating: null,
            userRatingsTotal: null,
            types: ['plus_code']
          }
          
          setSuggestions([plusCodeResult])
          setShowSuggestions(true)
          setIsLoading(false)
          return
        }
      }

      // 일반 장소 검색
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      )

      const request = {
        query: query,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'url', 'types', 'rating', 'user_ratings_total'],
        locationBias: { lat: 36.1699, lng: -115.1398, radius: 100000 }, // 라스베가스 중심 100km 반경
        region: 'US' // 미국 지역 우선
      }

      service.textSearch(request, (results: any[], status: any) => {
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
          // Places API 실패 시 Geocoder로 일반 주소 검색 시도
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ address: query }, (geocodeResults: any[], geocodeStatus: any) => {
            if (geocodeStatus === 'OK' && geocodeResults && geocodeResults[0]) {
              const location = geocodeResults[0].geometry.location
              const lat = location.lat()
              const lng = location.lng()
              
              const geocodeResult = {
                placeId: `geocode_${Date.now()}`,
                name: `검색된 위치`,
                address: geocodeResults[0].formatted_address,
                latitude: lat,
                longitude: lng,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                rating: null,
                userRatingsTotal: null,
                types: ['geocode']
              }
              
              setSuggestions([geocodeResult])
              setShowSuggestions(true)
            } else {
              // 모든 검색 실패 시 빈 결과 표시
              setSuggestions([])
              setShowSuggestions(false)
            }
            setIsLoading(false)
          })
        }
      })
    } catch (error) {
      console.error('위치 검색 오류:', error)
      setIsLoading(false)
    }
  }

  // 검색어 변경 처리
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (value.trim()) {
      searchPlaces(value)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  // 위치 선택
  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location)
    setSearchTerm(location.name)
    setShowSuggestions(false)
    onLocationSelect(location)
  }

  // 선택된 위치 제거
  const clearSelection = () => {
    setSelectedLocation(null)
    setSearchTerm('')
    setSuggestions([])
    setShowSuggestions(false)
    onLocationSelect({
      name: '',
      address: '',
      latitude: 0,
      longitude: 0,
      placeId: '',
      googleMapsUrl: ''
    })
  }

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`relative ${className}`}>
      {/* 검색 입력 */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {selectedLocation && (
          <button
            onClick={clearSelection}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 검색 제안 목록 */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
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

      {/* 선택된 위치 정보 */}
      {selectedLocation && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">{selectedLocation.name}</span>
                {selectedLocation.rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-yellow-600">⭐</span>
                    <span className="text-xs text-blue-700">{selectedLocation.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-blue-700 mb-2">{selectedLocation.address}</div>
              <div className="text-xs text-blue-600">
                좌표: {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </div>
            </div>
            <a
              href={selectedLocation.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
            >
              <ExternalLink className="w-3 h-3" />
              구글 맵
            </a>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* API 키 없음 경고 */}
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ Google Maps API 키가 설정되지 않았습니다. 환경변수를 확인해주세요.
        </div>
      )}
    </div>
  )
}

