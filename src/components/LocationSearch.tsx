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

  // 위치 검색
  const searchPlaces = async (query: string) => {
    if (!query.trim() || !mapLoaded) return

    setIsLoading(true)
    try {
      const service = new window.google.maps.places.PlacesService(
        document.createElement('div')
      )

      const request = {
        query: query,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'url']
      }

      service.textSearch(request, (results: any[], status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          const formattedResults = results.slice(0, 5).map((place) => ({
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            googleMapsUrl: place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
          }))
          
          setSuggestions(formattedResults)
          setShowSuggestions(true)
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
                  <div className="text-xs text-gray-500 mt-1">
                    좌표: {suggestion.latitude.toFixed(6)}, {suggestion.longitude.toFixed(6)}
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

