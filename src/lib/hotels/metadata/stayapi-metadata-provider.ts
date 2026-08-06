import type { HotelMetadata } from '@/lib/hotels/types'

/**
 * Optional hotel metadata enrichment (images, description, amenities).
 * MUST NOT be used for reservations, confirmation numbers, or tour costs.
 */
export interface HotelMetadataProvider {
  readonly source: 'stayapi'
  enrichByExternalId(externalId: string): Promise<HotelMetadata | null>
  searchByName(name: string, city?: string): Promise<HotelMetadata[]>
}

/**
 * StayAPI metadata-only client.
 * Reservations / rates / allocations belong to HotelSupplier adapters.
 */
export function createStayApiMetadataProvider(): HotelMetadataProvider {
  const apiKey = process.env.STAYAPI_API_KEY
  const baseUrl = process.env.STAYAPI_BASE_URL || 'https://api.stayapi.com'

  return {
    source: 'stayapi',

    async enrichByExternalId(externalId: string): Promise<HotelMetadata | null> {
      if (!apiKey) {
        return {
          description: 'StayAPI not configured (STAYAPI_API_KEY missing)',
          raw: { configured: false, externalId },
        }
      }

      try {
        const res = await fetch(`${baseUrl}/properties/${encodeURIComponent(externalId)}`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        })
        if (!res.ok) return null
        const data = (await res.json()) as Record<string, unknown>
        return mapStayApiProperty(data)
      } catch {
        return null
      }
    },

    async searchByName(name: string, city?: string): Promise<HotelMetadata[]> {
      if (!apiKey) return []

      try {
        const url = new URL(`${baseUrl}/properties/search`)
        url.searchParams.set('q', name)
        if (city) url.searchParams.set('city', city)
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        })
        if (!res.ok) return []
        const data = (await res.json()) as { results?: Record<string, unknown>[] }
        return (data.results || []).map(mapStayApiProperty)
      } catch {
        return []
      }
    },
  }
}

function mapStayApiProperty(data: Record<string, unknown>): HotelMetadata {
  const location = (data.location || data.address || {}) as Record<string, unknown>
  return {
    name: typeof data.name === 'string' ? data.name : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    address: typeof location.line1 === 'string' ? location.line1 : undefined,
    city: typeof location.city === 'string' ? location.city : undefined,
    state: typeof location.state === 'string' ? location.state : undefined,
    country: typeof location.country === 'string' ? location.country : undefined,
    latitude: typeof location.lat === 'number' ? location.lat : undefined,
    longitude: typeof location.lng === 'number' ? location.lng : undefined,
    images: Array.isArray(data.images)
      ? data.images.filter((x): x is string => typeof x === 'string')
      : undefined,
    amenities: Array.isArray(data.amenities)
      ? data.amenities.filter((x): x is string => typeof x === 'string')
      : undefined,
    raw: data,
  }
}
