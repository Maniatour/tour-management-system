/** Minimal Google Maps JS API types for client-side map components. */

declare namespace google.maps {
  interface MapOptions {
    center?: { lat: number; lng: number }
    zoom?: number
    mapTypeId?: string
    mapTypeControl?: boolean
    streetViewControl?: boolean
    fullscreenControl?: boolean
    mapId?: string
    styles?: Array<Record<string, unknown>>
    [key: string]: unknown
  }

  class Map {
    constructor(el: HTMLElement, opts?: MapOptions)
    fitBounds(bounds: LatLngBounds, padding?: number): void
    setCenter(center: { lat: number; lng: number } | LatLng): void
    setZoom(zoom: number): void
    addListener(eventName: string, handler: (event: MapMouseEvent) => void): MapsEventListener
  }

  interface MapMouseEvent {
    latLng?: LatLng | null
  }

  interface MapsEventListener {
    remove(): void
  }

  namespace MapTypeId {
    const ROADMAP: string
  }

  class DirectionsService {
    route(
      request: DirectionsRequest,
      callback: (result: DirectionsResult | null, status: DirectionsStatus) => void
    ): void
  }

  class DirectionsRenderer {
    constructor(opts?: { map?: Map; suppressMarkers?: boolean })
    setDirections(result: DirectionsResult | null): void
    setMap(map: Map | null): void
  }

  class LatLng {
    constructor(lat: number, lng: number)
    lat(): number
    lng(): number
  }

  class LatLngBounds {
    constructor(
      sw?: LatLng | { lat: number; lng: number },
      ne?: LatLng | { lat: number; lng: number }
    )
  }

  class Size {
    constructor(width: number, height: number)
  }

  class Point {
    constructor(x: number, y: number)
  }

  class Geocoder {
    geocode(
      request: { address?: string; location?: { lat: number; lng: number } },
      callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
    ): void
  }

  class Marker {
    constructor(opts?: MarkerOptions)
    setMap(map: Map | null): void
    getPosition(): LatLng | null | undefined
    setPosition(latLng: LatLng | { lat: number; lng: number } | null): void
    addListener(eventName: string, handler: () => void): MapsEventListener
  }

  namespace marker {
    class AdvancedMarkerElement {
      constructor(opts?: {
        map?: Map
        position?: LatLng | { lat: number; lng: number }
        title?: string
        gmpDraggable?: boolean
      })
      position?: LatLng | { lat: number; lng: number } | null
      addEventListener(eventName: string, handler: () => void): void
    }
  }

  interface MarkerOptions {
    position?: LatLng | { lat: number; lng: number }
    map?: Map
    label?: string | { text: string; color?: string }
    icon?:
      | string
      | {
          url: string
          scaledSize?: Size
          anchor?: Point
        }
    title?: string
    draggable?: boolean
    [key: string]: unknown
  }

  namespace places {
    class PlacesService {
      constructor(attrContainer: HTMLDivElement | Map)
      textSearch(
        request: Record<string, unknown>,
        callback: (results: PlaceResult[] | null, status: PlacesServiceStatus) => void
      ): void
    }

    enum PlacesServiceStatus {
      OK = 'OK',
    }

    interface PlaceResult {
      place_id?: string
      name?: string
      formatted_address?: string
      geometry?: { location?: LatLng }
      rating?: number
      user_ratings_total?: number
      types?: string[]
      url?: string
    }
  }

  type DirectionsStatus = string
  type GeocoderStatus = string

  interface GeocoderResult {
    formatted_address?: string
    geometry: { location: LatLng }
  }

  interface DirectionsWaypoint {
    location: LatLng | string | { lat: number; lng: number }
    stopover?: boolean
  }

  interface DirectionsRequest {
    origin: LatLng | string | { lat: number; lng: number }
    destination: LatLng | string | { lat: number; lng: number }
    waypoints?: DirectionsWaypoint[]
    optimizeWaypoints?: boolean
    travelMode?: TravelMode
  }

  interface DirectionsResult {
    routes: DirectionsRoute[]
  }

  interface DirectionsRoute {
    legs: DirectionsLeg[]
    waypoint_order?: number[]
    bounds?: LatLngBounds
  }

  interface DirectionsLeg {
    duration?: { value: number; text: string }
    distance?: { value: number; text: string }
  }

  enum TravelMode {
    DRIVING = 'DRIVING',
  }

  function importLibrary(name: string): Promise<unknown>
}

interface Window {
  google?: {
    maps: typeof google.maps
  }
}
