import {
  listHotels,
  upsertHotel,
  upsertRoom,
} from '@/lib/hotels/services/hotel-catalog-service'
import { persistRateQuotes } from '@/lib/hotels/services/rate-service'
import { getHotelAdminClient } from '@/lib/hotels/hotel-db'
import {
  findBestCatalogHotel,
  hotelMatchesDestination,
  parseDestinationCityState,
  pickQuotesForHotel,
  resolveTourHotelPriceCheckDestination,
} from '@/lib/hotels/suppliers/wyndham/match-hotel'
import type {
  TourPriceCheckJob,
  TourPriceCheckRateItem,
  TourPriceCheckResult,
} from '@/lib/hotels/tour-price-check-types'
import type { HotelRateQuote } from '@/lib/hotels/types'

function bookedUnitOf(job: TourPriceCheckJob): number | null {
  return job.bookedUnitPrice != null && Number.isFinite(job.bookedUnitPrice)
    ? Number(job.bookedUnitPrice)
    : null
}

function buildPropertyRates(allQuotes: HotelRateQuote[]): TourPriceCheckRateItem[] {
  const propertyRates: TourPriceCheckRateItem[] = []
  const seen = new Set<string>()
  for (const q of allQuotes) {
    const key = q.roomType || q.supplierRoomId || ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (q.price > 0) {
      propertyRates.push({ roomType: q.roomType, price: q.price })
    }
  }
  propertyRates.sort((a, b) => a.price - b.price)
  return propertyRates
}

/**
 * Persist scraped quotes into hotel_rates for matching catalog hotels
 * (same store used by 호텔 관리 · 투어 숙박). Creates catalog rows when missing.
 */
export async function persistTourPriceCheckQuotes(input: {
  destination: string
  allQuotes: HotelRateQuote[]
  jobs: Array<TourPriceCheckJob & { destination: string }>
}): Promise<{
  results: TourPriceCheckResult[]
  savedHotelIds: string[]
}> {
  const { destination, allQuotes, jobs } = input
  const propertyRates = buildPropertyRates(allQuotes)
  const { city, state } = parseDestinationCityState(destination)
  const catalog = await listHotels({ supplier: 'wyndham', activeOnly: true })
  const destCatalog = catalog.filter((h) => hotelMatchesDestination(h, destination))
  const savedHotelIds: string[] = []

  // Persist every catalog hotel that appears in this scrape (hotels admin compatibility)
  for (const hotel of destCatalog) {
    const quotes = pickQuotesForHotel(
      { name: hotel.name, supplierHotelId: hotel.supplier_hotel_id },
      allQuotes
    )
    if (!quotes.length) continue
    for (const quote of quotes) {
      if (quote.roomType) {
        await upsertRoom({
          hotelId: hotel.hotel_id,
          roomType: quote.roomType,
          bedType: quote.bedType,
          capacity: quote.capacity,
          supplierRoomId: quote.supplierRoomId,
        })
      }
    }
    await persistRateQuotes({ hotelId: hotel.hotel_id, quotes })
    savedHotelIds.push(hotel.hotel_id)
  }

  const results: TourPriceCheckResult[] = []
  let workingCatalog = [...catalog]

  for (const job of jobs) {
    const bookedUnit = bookedUnitOf(job)
    const matched = pickQuotesForHotel(
      { name: job.hotel, supplierHotelId: job.hotel },
      allQuotes
    )
    const marketPrice = matched[0]?.price
    const roomType = matched[0]?.roomType

    if (marketPrice == null || !(marketPrice > 0)) {
      results.push({
        bookingId: job.bookingId,
        ok: false,
        error: '검색 결과에서 해당 호텔을 찾지 못했습니다.',
        destination,
        bookedUnit,
        rates: propertyRates,
      })
      continue
    }

    let catalogHotel =
      findBestCatalogHotel(workingCatalog, job.hotel, destination) ||
      findBestCatalogHotel(workingCatalog, roomType || job.hotel, destination)

    if (!catalogHotel) {
      const supplierHotelId =
        matched[0]?.supplierRoomId ||
        matched[0]?.roomType ||
        `wyndham:${normalizeSlug(roomType || job.hotel)}`
      catalogHotel = await upsertHotel({
        supplier: 'wyndham',
        supplierHotelId,
        name: roomType || job.hotel,
        city,
        state: state || undefined,
        country: 'US',
      })
      workingCatalog = [...workingCatalog, catalogHotel]
    }

    for (const quote of matched) {
      if (quote.roomType) {
        await upsertRoom({
          hotelId: catalogHotel.hotel_id,
          roomType: quote.roomType,
          bedType: quote.bedType,
          capacity: quote.capacity,
          supplierRoomId: quote.supplierRoomId,
        })
      }
    }
    await persistRateQuotes({ hotelId: catalogHotel.hotel_id, quotes: matched })
    if (!savedHotelIds.includes(catalogHotel.hotel_id)) {
      savedHotelIds.push(catalogHotel.hotel_id)
    }

    const diff =
      bookedUnit != null ? Math.round((marketPrice - bookedUnit) * 100) / 100 : null

    results.push({
      bookingId: job.bookingId,
      ok: true,
      marketPrice,
      roomType,
      bookedUnit,
      diff,
      destination,
      hotelId: catalogHotel.hotel_id,
      checkedAt: new Date().toISOString(),
      rates: propertyRates.map((r) => ({
        ...r,
        matched: r.roomType === roomType,
      })),
    })
  }

  return { results, savedHotelIds }
}

function normalizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/**
 * Rebuild todo price-check badges from hotel_rates (shared with hotels admin page).
 */
export async function hydrateTourPriceCheckResults(
  jobs: TourPriceCheckJob[]
): Promise<TourPriceCheckResult[]> {
  if (!jobs.length) return []

  const catalog = await listHotels({ supplier: 'wyndham', activeOnly: true })
  const stayDates = [...new Set(jobs.map((j) => j.checkIn).filter(Boolean))]
  const db = getHotelAdminClient()

  let ratesQuery = db
    .from('hotel_rates')
    .select('hotel_id, stay_date, price, currency, checked_at, hotels(name, city, state)')
    .eq('supplier', 'wyndham')
    .order('checked_at', { ascending: false })

  if (stayDates.length === 1) {
    ratesQuery = ratesQuery.eq('stay_date', stayDates[0]!)
  } else if (stayDates.length > 1) {
    ratesQuery = ratesQuery.in('stay_date', stayDates)
  }

  const { data: rateRows, error } = await ratesQuery.limit(2000)
  if (error) throw new Error(error.message)

  type RateRow = {
    hotel_id: string
    stay_date: string
    price: number
    currency: string
    checked_at: string
    hotels?: { name: string; city: string | null; state: string | null } | null
  }

  const rates = (rateRows || []) as unknown as RateRow[]
  const rateByHotelDate = new Map<string, RateRow>()
  for (const row of rates) {
    const key = `${row.hotel_id}|${row.stay_date}`
    if (!rateByHotelDate.has(key)) rateByHotelDate.set(key, row)
  }

  const results: TourPriceCheckResult[] = []

  for (const job of jobs) {
    const destination = resolveTourHotelPriceCheckDestination(job.hotel, job.city)
    const bookedUnit = bookedUnitOf(job)
    const catalogHotel = findBestCatalogHotel(catalog, job.hotel, destination)

    if (!catalogHotel) {
      results.push({
        bookingId: job.bookingId,
        ok: false,
        destination,
        bookedUnit,
      })
      continue
    }

    const rate = rateByHotelDate.get(`${catalogHotel.hotel_id}|${job.checkIn}`)
    if (!rate || !(Number(rate.price) > 0)) {
      results.push({
        bookingId: job.bookingId,
        ok: false,
        destination,
        bookedUnit,
        hotelId: catalogHotel.hotel_id,
      })
      continue
    }

    const marketPrice = Number(rate.price)
    const diff =
      bookedUnit != null ? Math.round((marketPrice - bookedUnit) * 100) / 100 : null

    const destHotels = catalog.filter((h) => hotelMatchesDestination(h, destination))
    const ratesList: TourPriceCheckRateItem[] = []
    for (const h of destHotels) {
      const r = rateByHotelDate.get(`${h.hotel_id}|${job.checkIn}`)
      if (!r || !(Number(r.price) > 0)) continue
      ratesList.push({
        roomType: h.name,
        price: Number(r.price),
        matched: h.hotel_id === catalogHotel.hotel_id,
      })
    }
    ratesList.sort((a, b) => a.price - b.price)

    results.push({
      bookingId: job.bookingId,
      ok: true,
      marketPrice,
      roomType: catalogHotel.name,
      bookedUnit,
      diff,
      destination,
      hotelId: catalogHotel.hotel_id,
      checkedAt: rate.checked_at,
      rates: ratesList,
    })
  }

  return results
}

export function enrichJobsWithDestination(
  jobs: TourPriceCheckJob[]
): Array<TourPriceCheckJob & { destination: string }> {
  return jobs
    .filter((j) => j.bookingId && j.checkIn && j.checkOut && j.hotel)
    .map((j) => ({
      ...j,
      destination: resolveTourHotelPriceCheckDestination(j.hotel, j.city),
    }))
}
