/** 두 지점 사이 거리(미터), WGS84 가정 */
export function haversineDistanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

/** pickup_hotels.pin 형식: "lat,lng" */
export function parsePickupHotelPin(pin: string | null | undefined): { lat: number; lng: number } | null {
  if (!pin || typeof pin !== 'string') return null
  const parts = pin.split(',').map((s) => parseFloat(s.trim()))
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null
  const [lat, lng] = parts
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** Google Maps URL에서 좌표 추출 (보조). pin이 없을 때만 사용 */
export function parseLatLngFromMapsUrl(url: string | null | undefined): { lat: number; lng: number } | null {
  if (!url || typeof url !== 'string') return null
  let u = url
  try {
    u = decodeURIComponent(url)
  } catch {
    /* keep raw */
  }
  const at = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (at) {
    const lat = parseFloat(at[1])
    const lng = parseFloat(at[2])
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng }
  }
  const q = u.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (q) {
    const lat = parseFloat(q[1])
    const lng = parseFloat(q[2])
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng }
  }
  const ll = u.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (ll) {
    const lat = parseFloat(ll[1])
    const lng = parseFloat(ll[2])
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng }
  }
  return null
}

export function resolvePickupStopCoords(
  pin: string | null | undefined,
  mapsLink: string | null | undefined
): { lat: number; lng: number } | null {
  return parsePickupHotelPin(pin) ?? parseLatLngFromMapsUrl(mapsLink)
}
