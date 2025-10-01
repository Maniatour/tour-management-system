'use client'

import React, { useState, useEffect } from 'react'
import { MapPin, Search, X } from 'lucide-react'

// Google Maps 타입 정의
declare global {
  interface Window {
    google: any
  }
}

interface LocationPickerModalProps {
  currentLat?: number
  currentLng?: number
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  onClose: () => void
}

export default function LocationPickerModal({ 
  currentLat, 
  currentLng, 
  onLocationSelect, 
  onClose 
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLat, setSelectedLat] = useState(currentLat || 36.1699) // 라스베가스 위도
  const [selectedLng, setSelectedLng] = useState(currentLng || -115.1398) // 라스베가스 경도
  const [address, setAddress] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const [map, setMap] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)

  // 라스베가스 중심 좌표
  const LAS_VEGAS_CENTER = { lat: 36.1699, lng: -115.1398 }

  useEffect(() => {
    // Google Maps API 로드 (중복 로드 방지)
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    
    if (!window.google && !existingScript) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      script.id = 'google-maps-script'
      
      // 스크립트 로드 완료 후 초기화
      script.onload = () => {
        if (window.google) {
          initializeMap()
        }
      }
      
      document.head.appendChild(script)
    } else if (window.google) {
      // 이미 로드된 경우 바로 초기화
      initializeMap()
    }
  }, [])

  const initializeMap = () => {
    const mapElement = document.getElementById('map')
    if (!mapElement || !window.google) return

    const newMap = new window.google.maps.Map(mapElement, {
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
    })

    const newMarker = new window.google.maps.Marker({
      position: currentLat && currentLng ? { lat: currentLat, lng: currentLng } : LAS_VEGAS_CENTER,
      map: newMap,
      draggable: true,
      title: '선택된 위치'
    })

    // 지도 클릭 이벤트
    newMap.addListener('click', (event: any) => {
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
    geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address)
      } else {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      }
    })
  }

  const handleSearch = () => {
    if (!window.google || !searchQuery.trim()) return

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: searchQuery }, (results: any[], status: string) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location
        const lat = location.lat()
        const lng = location.lng()
        
        setSelectedLat(lat)
        setSelectedLng(lng)
        
        if (map && marker) {
          map.setCenter({ lat, lng })
          marker.setPosition({ lat, lng })
        }
        
        setAddress(results[0].formatted_address)
      }
    })
  }

  const handleConfirm = () => {
    onLocationSelect(selectedLat, selectedLng, address)
    onClose()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

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
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="라스베가스 지역 검색 (예: Strip, Fremont Street, Red Rock Canyon)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              검색
            </button>
          </div>
        </div>

        {/* 지도 영역 */}
        <div className="flex-1 relative">
          <div id="map" className="w-full h-full" />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">지도를 불러오는 중...</p>
              </div>
            </div>
          )}
        </div>

        {/* 선택된 위치 정보 */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                선택된 위치
              </label>
              <p className="text-sm text-gray-600">{address || '위치를 선택해주세요'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  위도
                </label>
                <p className="text-sm text-gray-600">{selectedLat.toFixed(6)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  경도
                </label>
                <p className="text-sm text-gray-600">{selectedLng.toFixed(6)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
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
  )
}
