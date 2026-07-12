'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fetchCustomerPickupHotels,
  filterCustomerPickupHotels,
  type CustomerPickupHotelLocation,
} from '@/lib/customerPickupHotels'
import { isGoogleMapsReady, loadGoogleMapsApi } from '@/lib/loadGoogleMapsApi'

type ProductDetailDeparturePointModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
}

const LAS_VEGAS_CENTER = { lat: 36.1699, lng: -115.1398 }

export default function ProductDetailDeparturePointModal({
  open,
  onOpenChange,
  locale,
}: ProductDetailDeparturePointModalProps) {
  const t = useTranslations('productDetail')
  const isEnglish = locale.trim().toLowerCase() === 'en'
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())

  const [loading, setLoading] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [hotels, setHotels] = useState<CustomerPickupHotelLocation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null)

  const filteredHotels = useMemo(
    () => filterCustomerPickupHotels(hotels, searchQuery),
    [hotels, searchQuery]
  )

  const selectedHotel = useMemo(
    () => filteredHotels.find((hotel) => hotel.id === selectedHotelId) ?? null,
    [filteredHotels, selectedHotelId]
  )

  const focusHotel = useCallback((hotel: CustomerPickupHotelLocation) => {
    setSelectedHotelId(hotel.id)
    if (!mapRef.current) return

    mapRef.current.setCenter({ lat: hotel.latitude, lng: hotel.longitude })
    mapRef.current.setZoom(14)
  }, [])

  const renderMapLayers = useCallback(
    (hotelsToRender: CustomerPickupHotelLocation[]) => {
      if (!mapRef.current || !window.google?.maps) return

      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current.clear()

      let minLat = Number.POSITIVE_INFINITY
      let maxLat = Number.NEGATIVE_INFINITY
      let minLng = Number.POSITIVE_INFINITY
      let maxLng = Number.NEGATIVE_INFINITY

      hotelsToRender.forEach((hotel) => {
        const position = { lat: hotel.latitude, lng: hotel.longitude }
        minLat = Math.min(minLat, position.lat)
        maxLat = Math.max(maxLat, position.lat)
        minLng = Math.min(minLng, position.lng)
        maxLng = Math.max(maxLng, position.lng)

        const markerOptions: google.maps.MarkerOptions = {
          map: mapRef.current!,
          position,
          title: hotel.hotel,
        }

        if (hotel.group_number != null) {
          markerOptions.label = `${hotel.group_number}`
        }

        const marker = new window.google.maps.Marker(markerOptions)
        marker.addListener('click', () => focusHotel(hotel))
        markersRef.current.set(hotel.id, marker)
      })

      if (hotelsToRender.length === 1) {
        mapRef.current.setCenter({
          lat: hotelsToRender[0]!.latitude,
          lng: hotelsToRender[0]!.longitude,
        })
        mapRef.current.setZoom(14)
        return
      }

      if (hotelsToRender.length > 1) {
        const bounds = new window.google.maps.LatLngBounds(
          { lat: minLat, lng: minLng },
          { lat: maxLat, lng: maxLng }
        )
        mapRef.current.fitBounds(bounds, 48)
      }
    },
    [focusHotel]
  )

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || mapRef.current || !isGoogleMapsReady()) return

    try {
      mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
        center: LAS_VEGAS_CENTER,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })
      setMapReady(true)
    } catch (error) {
      console.error('Failed to initialize departure point map:', error)
      setMapError(t('mapsUnavailable'))
    }
  }, [t])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    const boot = async () => {
      setLoading(true)
      setMapError(null)
      mapRef.current = null
      setMapReady(false)

      try {
        const [locations] = await Promise.all([
          fetchCustomerPickupHotels(),
          loadGoogleMapsApi(),
        ])

        if (cancelled) return
        setHotels(locations)
      } catch {
        if (!cancelled) {
          setMapError(t('mapsUnavailable'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [open, t])

  useEffect(() => {
    if (!open || loading || mapError || mapRef.current || !isGoogleMapsReady()) return

    let cancelled = false
    let retryTimer: number | undefined

    const tryInitialize = (attempt = 0) => {
      if (cancelled || mapRef.current) return
      if (!mapContainerRef.current) {
        retryTimer = window.setTimeout(() => tryInitialize(attempt + 1), 50)
        return
      }

      if (!isGoogleMapsReady()) {
        if (attempt < 20) {
          retryTimer = window.setTimeout(() => tryInitialize(attempt + 1), 50)
        }
        return
      }

      initializeMap()
    }

    const frame = window.requestAnimationFrame(() => tryInitialize())

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [initializeMap, loading, mapError, open])

  useEffect(() => {
    if (!open || !mapReady || !mapRef.current) return
    renderMapLayers(filteredHotels)
  }, [filteredHotels, mapReady, open, renderMapLayers])

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSelectedHotelId(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="airbnb-departure-modal max-w-3xl gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-[#e5e7eb] px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-xl font-bold text-[#1a2b49]">
            {t('findLocationToSelect')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchAvailableLocations')}
              className="airbnb-departure-search h-12 w-full rounded-xl border border-[#f97316] bg-white pl-10 pr-4 text-sm text-[#1a2b49] outline-none ring-0 placeholder:text-[#9ca3af] focus:border-[#ea580c] focus:ring-2 focus:ring-[#fdba74]"
            />
          </div>

          {searchQuery.trim() && filteredHotels.length > 0 ? (
            <div className="airbnb-departure-results">
              {filteredHotels.slice(0, 6).map((hotel) => (
                <button
                  key={hotel.id}
                  type="button"
                  className={`airbnb-departure-result ${selectedHotelId === hotel.id ? 'is-selected' : ''}`}
                  onClick={() => focusHotel(hotel)}
                >
                  <span className="font-semibold text-[#1a2b49]">{hotel.hotel}</span>
                  <span className="text-xs text-[#6b7280]">
                    {[hotel.pick_up_location, hotel.address].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {searchQuery.trim() && filteredHotels.length === 0 && !loading ? (
            <p className="text-sm text-[#6b7280]">{t('noPickupLocationsFound')}</p>
          ) : null}

          <div className="airbnb-departure-map-shell">
            {loading ? (
              <div className="airbnb-departure-map-loading">
                <Loader2 className="h-6 w-6 animate-spin text-[#6b7280]" aria-hidden />
                <span>{t('loadingPickupLocations')}</span>
              </div>
            ) : null}

            {mapError ? (
              <div className="airbnb-departure-map-loading">
                <span>{mapError}</span>
              </div>
            ) : null}

            <div ref={mapContainerRef} className="airbnb-departure-map" aria-label={t('findLocationToSelect')} />
          </div>

          {selectedHotel ? (
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <MapPin className="h-4 w-4 text-[#1a2b49]" aria-hidden />
                <p className="font-semibold text-[#1a2b49]">{selectedHotel.hotel}</p>
                <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-xs font-bold text-[#047857]">
                  {t('freePickupBadge')}
                </span>
              </div>
              {selectedHotel.pick_up_location ? (
                <p className="text-sm text-[#4b5563]">{selectedHotel.pick_up_location}</p>
              ) : null}
              {selectedHotel.address ? (
                <p className="mt-1 text-sm text-[#6b7280]">{selectedHotel.address}</p>
              ) : null}
              {selectedHotel.link ? (
                <a
                  href={selectedHotel.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-[#2563eb] underline underline-offset-2"
                >
                  {isEnglish ? 'Open in Google Maps' : 'Google 지도에서 보기'}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
