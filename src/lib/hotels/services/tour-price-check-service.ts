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
  TourHotelRateSurveyResult,
  TourHotelRateSurveyStay,
  TourPriceCheckJob,
  TourPriceCheckRateItem,
  TourPriceCheckResult,
} from '@/lib/hotels/tour-price-check-types'
import type { HotelRateQuote, HotelRow } from '@/lib/hotels/types'

export const PAGE_DEST = 'Page AZ'
export const KANAB_DEST = 'Kanab UT'

function bookedUnitOf(job: TourPriceCheckJob): number | null {
  return job.bookedUnitPrice != null && Number.isFinite(job.bookedUnitPrice)
    ? Number(job.bookedUnitPrice)
    : null
}

function roundDiff(market: number, booked: number | null): number | null {
  if (booked == null) return null
  return Math.round((market - booked) * 100) / 100
}

export function isPageTourDestination(destination: string): boolean {
  return /page/i.test(destination)
}

export function isKanabTourDestination(destination: string): boolean {
  return /kanab/i.test(destination)
}

/** Page ↔ Kanab dual compare (same-hotel + cheapest across both cities). */
export function usesPageKanabCompare(destination: string): boolean {
  return isPageTourDestination(destination) || isKanabTourDestination(destination)
}

/** Destinations that must be scraped for a job set on one check-in/out. */
export function destinationsToScrapeForJobs(
  jobs: Array<{ destination: string }>
): string[] {
  const set = new Set<string>()
  let needsBoth = false
  for (const job of jobs) {
    set.add(job.destination)
    if (usesPageKanabCompare(job.destination)) needsBoth = true
  }
  if (needsBoth) {
    set.add(PAGE_DEST)
    set.add(KANAB_DEST)
  }
  return [...set]
}

function altDestinationFor(primary: string): string {
  if (isPageTourDestination(primary)) return KANAB_DEST
  if (isKanabTourDestination(primary)) return PAGE_DEST
  return ''
}

function tagQuotes(
  quotes: HotelRateQuote[],
  destination: string
): HotelRateQuote[] {
  return quotes.map((q) => ({
    ...q,
    raw: { ...(q.raw || {}), destination },
  }))
}

function quoteDestination(q: HotelRateQuote): string {
  const d = q.raw?.destination
  return typeof d === 'string' && d.trim() ? d : ''
}

function buildPropertyRates(
  allQuotes: HotelRateQuote[],
  opts?: { matchedRoomType?: string; cheapestRoomType?: string }
): TourPriceCheckRateItem[] {
  const propertyRates: TourPriceCheckRateItem[] = []
  const seen = new Set<string>()
  for (const q of allQuotes) {
    const key = `${quoteDestination(q)}|${q.roomType || q.supplierRoomId || ''}`
    if (!q.roomType || seen.has(key)) continue
    seen.add(key)
    if (!(q.price > 0)) continue
    const dest = quoteDestination(q)
    const item: TourPriceCheckRateItem = {
      roomType: q.roomType,
      price: q.price,
    }
    if (dest) item.destination = dest
    if (opts?.matchedRoomType === q.roomType) item.matched = true
    if (opts?.cheapestRoomType === q.roomType) item.cheapest = true
    propertyRates.push(item)
  }
  propertyRates.sort((a, b) => a.price - b.price)
  return propertyRates
}

function findCheapestProperty(allQuotes: HotelRateQuote[]): {
  roomType: string
  price: number
  destination: string
} | null {
  let best: { roomType: string; price: number; destination: string } | null = null
  const seen = new Set<string>()
  for (const q of allQuotes) {
    const key = `${quoteDestination(q)}|${q.roomType || ''}`
    if (!q.roomType || !(q.price > 0) || seen.has(key)) continue
    seen.add(key)
    if (!best || q.price < best.price) {
      best = {
        roomType: q.roomType,
        price: q.price,
        destination: quoteDestination(q) || '',
      }
    }
  }
  return best
}

/**
 * Keep only scraped quotes that match active hotels catalog rows
 * (호텔 관리 · 투어 숙박). One quote set per catalog hotel (lowest night price).
 */
function filterQuotesToCatalogHotels(
  allQuotes: HotelRateQuote[],
  catalog: HotelRow[],
  destination: string
): HotelRateQuote[] {
  if (!allQuotes.length || !catalog.length) return []
  const destHotels = catalog.filter((h) => hotelMatchesDestination(h, destination))
  const out: HotelRateQuote[] = []
  const seenHotelIds = new Set<string>()

  for (const hotel of destHotels) {
    if (seenHotelIds.has(hotel.hotel_id)) continue
    const matched = pickQuotesForHotel(
      { name: hotel.name, supplierHotelId: hotel.supplier_hotel_id },
      allQuotes
    )
    if (!matched.length) continue
    seenHotelIds.add(hotel.hotel_id)
    // Use catalog display name; keep lowest-priced night sample for survey UI
    const sample = matched.reduce((a, b) => (a.price <= b.price ? a : b))
    out.push({
      ...sample,
      roomType: hotel.name,
      supplierHotelId: hotel.supplier_hotel_id,
      raw: {
        ...(sample.raw || {}),
        destination,
        catalogHotelId: hotel.hotel_id,
        catalogName: hotel.name,
      },
    })
  }
  return out
}

async function persistQuotesForDestination(input: {
  destination: string
  allQuotes: HotelRateQuote[]
  catalog: HotelRow[]
}): Promise<{ savedHotelIds: string[]; workingCatalog: HotelRow[] }> {
  const { destination, allQuotes } = input
  let workingCatalog = [...input.catalog]
  const destCatalog = workingCatalog.filter((h) =>
    hotelMatchesDestination(h, destination)
  )
  const savedHotelIds: string[] = []

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

  return { savedHotelIds, workingCatalog }
}

async function ensureCatalogAndPersistMatch(input: {
  jobHotel: string
  destination: string
  matched: HotelRateQuote[]
  workingCatalog: HotelRow[]
}): Promise<{ hotel: HotelRow; workingCatalog: HotelRow[] }> {
  const { jobHotel, destination, matched } = input
  let workingCatalog = [...input.workingCatalog]
  const roomType = matched[0]?.roomType
  const { city, state } = parseDestinationCityState(destination)

  let catalogHotel =
    findBestCatalogHotel(workingCatalog, jobHotel, destination) ||
    findBestCatalogHotel(workingCatalog, roomType || jobHotel, destination)

  if (!catalogHotel) {
    const supplierHotelId =
      matched[0]?.supplierRoomId ||
      matched[0]?.roomType ||
      `wyndham:${normalizeSlug(roomType || jobHotel)}`
    catalogHotel = await upsertHotel({
      supplier: 'wyndham',
      supplierHotelId,
      name: roomType || jobHotel,
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
  return { hotel: catalogHotel, workingCatalog }
}

/**
 * Persist scraped quotes per destination and build todo results.
 * Page jobs get same-hotel + Page/Kanab cheapest badges when alt quotes exist.
 */
export async function persistTourPriceCheckQuotes(input: {
  quotesByDestination: Record<string, HotelRateQuote[]>
  jobs: Array<TourPriceCheckJob & { destination: string }>
}): Promise<{
  results: TourPriceCheckResult[]
  savedHotelIds: string[]
}> {
  const { quotesByDestination, jobs } = input
  const catalog = await listHotels({ supplier: 'wyndham', activeOnly: true })
  let workingCatalog = [...catalog]
  const savedHotelIds: string[] = []

  for (const [destination, quotes] of Object.entries(quotesByDestination)) {
    const tagged = tagQuotes(quotes, destination)
    const persisted = await persistQuotesForDestination({
      destination,
      allQuotes: tagged,
      catalog: workingCatalog,
    })
    workingCatalog = persisted.workingCatalog
    for (const id of persisted.savedHotelIds) {
      if (!savedHotelIds.includes(id)) savedHotelIds.push(id)
    }
  }

  const results: TourPriceCheckResult[] = []
  const checkedAt = new Date().toISOString()

  for (const job of jobs) {
    const bookedUnit = bookedUnitOf(job)
    const primaryQuotes = tagQuotes(
      quotesByDestination[job.destination] || [],
      job.destination
    )
    const compareAlt = usesPageKanabCompare(job.destination)
    const altDest = altDestinationFor(job.destination)
    const altQuotes =
      compareAlt && altDest
        ? tagQuotes(quotesByDestination[altDest] || [], altDest)
        : []
    const combinedQuotes = compareAlt
      ? [...primaryQuotes, ...altQuotes]
      : primaryQuotes

    const matched = pickQuotesForHotel(
      { name: job.hotel, supplierHotelId: job.hotel },
      primaryQuotes
    )
    const marketPrice = matched[0]?.price
    const roomType = matched[0]?.roomType
    const cheapest = findCheapestProperty(combinedQuotes)
    const rateOpts: { matchedRoomType?: string; cheapestRoomType?: string } = {}
    if (roomType) rateOpts.matchedRoomType = roomType
    if (cheapest?.roomType) rateOpts.cheapestRoomType = cheapest.roomType
    const propertyRates = buildPropertyRates(combinedQuotes, rateOpts)

    if (marketPrice == null || !(marketPrice > 0)) {
      const fail: TourPriceCheckResult = {
        bookingId: job.bookingId,
        ok: false,
        error: '검색 결과에서 해당 호텔을 찾지 못했습니다.',
        destination: job.destination,
        bookedUnit,
        rates: propertyRates,
        cheapestDiff: cheapest ? roundDiff(cheapest.price, bookedUnit) : null,
      }
      if (compareAlt) fail.compareAltCities = true
      if (cheapest?.price != null) fail.cheapestPrice = cheapest.price
      if (cheapest?.roomType) fail.cheapestHotel = cheapest.roomType
      if (cheapest?.destination) fail.cheapestDestination = cheapest.destination
      results.push(fail)
      continue
    }

    const ensured = await ensureCatalogAndPersistMatch({
      jobHotel: job.hotel,
      destination: job.destination,
      matched,
      workingCatalog,
    })
    workingCatalog = ensured.workingCatalog
    if (!savedHotelIds.includes(ensured.hotel.hotel_id)) {
      savedHotelIds.push(ensured.hotel.hotel_id)
    }

    const result: TourPriceCheckResult = {
      bookingId: job.bookingId,
      ok: true,
      marketPrice,
      roomType,
      bookedUnit,
      diff: roundDiff(marketPrice, bookedUnit),
      destination: job.destination,
      hotelId: ensured.hotel.hotel_id,
      checkedAt,
      rates: propertyRates,
    }

    if (compareAlt && cheapest) {
      result.compareAltCities = true
      result.cheapestPrice = cheapest.price
      result.cheapestHotel = cheapest.roomType
      if (cheapest.destination) result.cheapestDestination = cheapest.destination
      result.cheapestDiff = roundDiff(cheapest.price, bookedUnit)
    }

    results.push(result)
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
 * Page bookings also compute cheapest across Page + Kanab catalog rates.
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
    const compareAlt = usesPageKanabCompare(destination)
    const catalogHotel = findBestCatalogHotel(catalog, job.hotel, destination)

    const destList = compareAlt ? [PAGE_DEST, KANAB_DEST] : [destination]
    const ratesList: TourPriceCheckRateItem[] = []
    let cheapest: {
      hotelId: string
      name: string
      price: number
      destination: string
    } | null = null

    for (const dest of destList) {
      const destHotels = catalog.filter((h) => hotelMatchesDestination(h, dest))
      for (const h of destHotels) {
        const r = rateByHotelDate.get(`${h.hotel_id}|${job.checkIn}`)
        if (!r || !(Number(r.price) > 0)) continue
        const price = Number(r.price)
        ratesList.push({
          roomType: h.name,
          price,
          destination: dest,
          matched: catalogHotel?.hotel_id === h.hotel_id,
        })
        if (!cheapest || price < cheapest.price) {
          cheapest = {
            hotelId: h.hotel_id,
            name: h.name,
            price,
            destination: dest,
          }
        }
      }
    }
    ratesList.sort((a, b) => a.price - b.price)
    if (cheapest) {
      for (const item of ratesList) {
        if (
          item.roomType === cheapest.name &&
          item.destination === cheapest.destination
        ) {
          item.cheapest = true
        }
      }
    }

    if (!catalogHotel) {
      const fail: TourPriceCheckResult = {
        bookingId: job.bookingId,
        ok: false,
        destination,
        bookedUnit,
        rates: ratesList,
        cheapestDiff: cheapest ? roundDiff(cheapest.price, bookedUnit) : null,
      }
      if (compareAlt) fail.compareAltCities = true
      if (cheapest) {
        fail.cheapestPrice = cheapest.price
        fail.cheapestHotel = cheapest.name
        fail.cheapestDestination = cheapest.destination
      }
      results.push(fail)
      continue
    }

    const rate = rateByHotelDate.get(`${catalogHotel.hotel_id}|${job.checkIn}`)
    if (!rate || !(Number(rate.price) > 0)) {
      const fail: TourPriceCheckResult = {
        bookingId: job.bookingId,
        ok: false,
        destination,
        bookedUnit,
        hotelId: catalogHotel.hotel_id,
        rates: ratesList,
        cheapestDiff: cheapest ? roundDiff(cheapest.price, bookedUnit) : null,
      }
      if (compareAlt) fail.compareAltCities = true
      if (cheapest) {
        fail.cheapestPrice = cheapest.price
        fail.cheapestHotel = cheapest.name
        fail.cheapestDestination = cheapest.destination
      }
      results.push(fail)
      continue
    }

    const marketPrice = Number(rate.price)
    const result: TourPriceCheckResult = {
      bookingId: job.bookingId,
      ok: true,
      marketPrice,
      roomType: catalogHotel.name,
      bookedUnit,
      diff: roundDiff(marketPrice, bookedUnit),
      destination,
      hotelId: catalogHotel.hotel_id,
      checkedAt: rate.checked_at,
      rates: ratesList,
    }

    if (compareAlt && cheapest) {
      result.compareAltCities = true
      result.cheapestPrice = cheapest.price
      result.cheapestHotel = cheapest.name
      result.cheapestDestination = cheapest.destination
      result.cheapestDiff = roundDiff(cheapest.price, bookedUnit)
    }

    results.push(result)
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

/**
 * Market survey for unbooked multi-day tours — scrape Page + Kanab and persist catalog rates.
 * UI/cheapest use only hotels already in the 호텔 관리 catalog (not every Wyndham listing).
 */
export async function runTourHotelRateSurvey(input: {
  quotesByDestination: Record<string, HotelRateQuote[]>
  stays: TourHotelRateSurveyStay[]
}): Promise<{
  results: TourHotelRateSurveyResult[]
  savedHotelIds: string[]
}> {
  const { quotesByDestination, stays } = input
  const catalog = await listHotels({ supplier: 'wyndham', activeOnly: true })
  let workingCatalog = [...catalog]
  const savedHotelIds: string[] = []

  for (const [destination, quotes] of Object.entries(quotesByDestination)) {
    const tagged = tagQuotes(quotes, destination)
    const persisted = await persistQuotesForDestination({
      destination,
      allQuotes: tagged,
      catalog: workingCatalog,
    })
    workingCatalog = persisted.workingCatalog
    for (const id of persisted.savedHotelIds) {
      if (!savedHotelIds.includes(id)) savedHotelIds.push(id)
    }
  }

  const pageQuotes = filterQuotesToCatalogHotels(
    tagQuotes(quotesByDestination[PAGE_DEST] || [], PAGE_DEST),
    catalog,
    PAGE_DEST
  )
  const kanabQuotes = filterQuotesToCatalogHotels(
    tagQuotes(quotesByDestination[KANAB_DEST] || [], KANAB_DEST),
    catalog,
    KANAB_DEST
  )
  const combined = [...pageQuotes, ...kanabQuotes]
  const cheapest = findCheapestProperty(combined)
  const rateOpts: { cheapestRoomType?: string } = {}
  if (cheapest?.roomType) rateOpts.cheapestRoomType = cheapest.roomType
  const rates = buildPropertyRates(combined, rateOpts)
  const checkedAt = new Date().toISOString()

  const emptyCatalog =
    catalog.filter(
      (h) =>
        hotelMatchesDestination(h, PAGE_DEST) || hotelMatchesDestination(h, KANAB_DEST)
    ).length === 0

  const results: TourHotelRateSurveyResult[] = stays.map((stay) => {
    if (!combined.length || !cheapest) {
      const fail: TourHotelRateSurveyResult = {
        stayId: stay.stayId,
        ok: false,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        error: emptyCatalog
          ? '호텔 관리 카탈로그에 Page/Kanab 호텔이 없습니다. 먼저 호텔을 추가하세요.'
          : '카탈로그 호텔에 맞는 Page/Kanab 공개 요금을 찾지 못했습니다.',
        rates,
        checkedAt,
      }
      if (stay.nightIndex != null) fail.nightIndex = stay.nightIndex
      if (stay.tourId) fail.tourId = stay.tourId
      return fail
    }

    const ok: TourHotelRateSurveyResult = {
      stayId: stay.stayId,
      ok: true,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      cheapestPrice: cheapest.price,
      cheapestHotel: cheapest.roomType,
      rates,
      checkedAt,
    }
    if (stay.nightIndex != null) ok.nightIndex = stay.nightIndex
    if (stay.tourId) ok.tourId = stay.tourId
    if (cheapest.destination) ok.cheapestDestination = cheapest.destination
    return ok
  })

  return { results, savedHotelIds }
}
