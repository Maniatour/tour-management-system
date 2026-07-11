'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function LocationSearch({
  onLocationSelect,
  initialLocation,
  placeholder = '위치를 검색하세요...',
  className = '',
}: LocationSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<LocationData[]>([])
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(initialLocation || null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 구글 맵 API 로드 (중복 로드 방지)
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google?.maps?.places) {
        setMapLoaded(true)
        return
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        existingScript.addEventListener('load', () => setMapLoaded(true))
        return
      }

      const script = document.createElement('script')
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.error('Google Maps API key is not configured')
        return
      }
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => setMapLoaded(true)
      document.head.appendChild(script)
    }

    loadGoogleMaps()
  }, [])

  const isPlusCode = (query: string) => {
    const plusCodePattern = /^[A-Z0-9]{2,10}\+[A-Z0-9]{2,10}$/i
    return plusCodePattern.test(query.trim())
  }

  const decodePlusCode = async (plusCode: string): Promise<google.maps.GeocoderResult | null> => {
    try {
      const geocoder = new window.google.maps.Geocoder()
      const result = await new Promise<google.maps.GeocoderResult>((resolve, reject) => {
        geocoder.geocode(
          { address: plusCode },
          (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
            if (status === 'OK' && results?.[0]) {
              resolve(results[0])
            } else {
              reject(new Error('Plus Code 디코딩 실패'))
            }
          }
        )
      })
      return result
    } catch (error) {
      console.error('Plus Code 디코딩 오류:', error)
      return null
    }
  }

  const searchPlaces = async (query: string) => {
    if (!query.trim() || !mapLoaded || !window.google?.maps?.places) return

    setIsLoading(true)
    try {
      if (isPlusCode(query)) {
        const geocodeResult = await decodePlusCode(query)
        if (geocodeResult) {
          const location = geocodeResult.geometry.location
          const lat = location.lat()
          const lng = location.lng()

          setSuggestions([
            {
              placeId: `plus_code_${Date.now()}`,
              name: `Plus Code 위치 (${query})`,
              address: geocodeResult.formatted_address ?? '',
              latitude: lat,
              longitude: lng,
              googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
              types: ['plus_code'],
            },
          ])
          setShowSuggestions(true)
          setIsLoading(false)
          return
        }
      }

      const service = new window.google.maps.places.PlacesService(document.createElement('div'))

      const request = {
        query,
        fields: ['place_id', 'name', 'formatted_address', 'geometry', 'url', 'types', 'rating', 'user_ratings_total'],
        locationBias: { lat: 36.1699, lng: -115.1398, radius: 100000 },
        region: 'US',
      }

      service.textSearch(
        request,
        (results: google.maps.places.PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            const sortedResults = results
              .filter((place) => place.rating != null && (place.user_ratings_total ?? 0) > 0)
              .sort((a, b) => {
                const scoreA = (a.rating ?? 0) * Math.log((a.user_ratings_total ?? 0) + 1)
                const scoreB = (b.rating ?? 0) * Math.log((b.user_ratings_total ?? 0) + 1)
                return scoreB - scoreA
              })
              .slice(0, 8)

            const formattedResults: LocationData[] = sortedResults.flatMap((place) => {
              const lat = place.geometry?.location?.lat()
              const lng = place.geometry?.location?.lng()
              if (lat == null || lng == null || !place.place_id) return []
              return [
                {
                  placeId: place.place_id,
                  name: place.name ?? '',
                  address: place.formatted_address ?? '',
                  latitude: lat,
                  longitude: lng,
                  googleMapsUrl:
                    place.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
                  ...(place.rating != null ? { rating: place.rating } : {}),
                  ...(place.user_ratings_total != null
                    ? { userRatingsTotal: place.user_ratings_total }
                    : {}),
                  ...(place.types ? { types: place.types } : {}),
                },
              ]
            })

            setSuggestions(formattedResults)
            setShowSuggestions(true)
          } else {
            const geocoder = new window.google.maps.Geocoder()
            geocoder.geocode(
              { address: query },
              (geocodeResults: google.maps.GeocoderResult[] | null, geocodeStatus: google.maps.GeocoderStatus) => {
                if (geocodeStatus === 'OK' && geocodeResults?.[0]) {
                  const location = geocodeResults[0].geometry.location
                  setSuggestions([
                    {
                      placeId: `geocode_${Date.now()}`,
                      name: '검색된 위치',
                      address: geocodeResults[0].formatted_address ?? '',
                      latitude: location.lat(),
                      longitude: location.lng(),
                      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
                      types: ['geocode'],
                    },
                  ])
                  setShowSuggestions(true)
                } else {
                  setSuggestions([])
                  setShowSuggestions(false)
                }
                setIsLoading(false)
              }
            )
            return
          }
          setIsLoading(false)
        }
      )
    } catch (error) {
      console.error('위치 검색 오류:', error)
      setIsLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (value.trim()) {
      void searchPlaces(value)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleLocationSelect = (location: LocationData) => {
    setSelectedLocation(location)
    setSearchTerm(location.name)
    setShowSuggestions(false)
    onLocationSelect(location)
  }

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
      googleMapsUrl: '',
    })
  }

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
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
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

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              onClick={() => handleLocationSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{suggestion.name}</div>
                  <div className="text-sm text-gray-600 truncate">{suggestion.address}</div>
                  {suggestion.rating != null && (
                    <div className="text-xs text-gray-500 mt-1">
                      ⭐ {suggestion.rating.toFixed(1)}
                      {suggestion.userRatingsTotal != null &&
                        ` (${suggestion.userRatingsTotal.toLocaleString()} reviews)`}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedLocation && selectedLocation.placeId && (
        <div className="mt-2 p-3 bg-muted/50 border border-border rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground">{selectedLocation.name}</div>
              <div className="text-sm text-primary truncate">{selectedLocation.address}</div>
              <div className="text-xs text-primary mt-1">
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </div>
            </div>
            {selectedLocation.googleMapsUrl && (
              <a
                href={selectedLocation.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 flex-shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute right-10 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
        </div>
      )}
    </div>
  )
}
