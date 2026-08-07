import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { getHotelSupplier } from '@/lib/hotels/suppliers/registry'
import {
  pickQuotesForHotel,
  resolveTourHotelPriceCheckDestination,
} from '@/lib/hotels/suppliers/wyndham/match-hotel'
import type {
  TourPriceCheckJob,
  TourPriceCheckRateItem,
  TourPriceCheckResult,
} from '@/lib/hotels/tour-price-check-types'
import type { HotelRateQuote } from '@/lib/hotels/types'

export const runtime = 'nodejs'
/** Many unique check-in dates × Page/Kanab — allow several minutes */
export const maxDuration = 300

export type { TourPriceCheckJob, TourPriceCheckRateItem, TourPriceCheckResult }

/**
 * POST /api/hotels/rates/tour-price-check
 * One Playwright scrape per unique (destination, checkIn, checkOut), then match each booking.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as { jobs?: TourPriceCheckJob[] }
    const jobs = Array.isArray(body.jobs) ? body.jobs : []
    if (!jobs.length) {
      return NextResponse.json({ error: 'jobs[] required' }, { status: 400 })
    }

    type GroupJob = TourPriceCheckJob & { destination: string }
    const groups = new Map<string, GroupJob[]>()
    for (const job of jobs) {
      if (!job.bookingId || !job.checkIn || !job.checkOut || !job.hotel) continue
      const destination = resolveTourHotelPriceCheckDestination(job.hotel, job.city)
      const key = `${destination}|${job.checkIn}|${job.checkOut}`
      const list = groups.get(key) || []
      list.push({ ...job, destination })
      groups.set(key, list)
    }

    const supplier = getHotelSupplier('wyndham', { forceLive: true })
    const results: TourPriceCheckResult[] = []
    let scrapeCount = 0

    for (const [, group] of groups) {
      const sample = group[0]!
      scrapeCount += 1
      let allQuotes: HotelRateQuote[] = []
      try {
        allQuotes = await supplier.getRates({
          supplierHotelId: `todo-price-check:${sample.destination}`,
          destination: sample.destination,
          checkIn: sample.checkIn,
          checkOut: sample.checkOut,
          rooms: 1,
          guests: 2,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rate fetch failed'
        for (const job of group) {
          results.push({
            bookingId: job.bookingId,
            ok: false,
            error: message,
            destination: job.destination,
            bookedUnit: job.bookedUnitPrice ?? null,
          })
        }
        continue
      }

      // Unique properties for hover list (lowest price per roomType)
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

      for (const job of group) {
        const matched = pickQuotesForHotel(
          { name: job.hotel, supplierHotelId: job.hotel },
          allQuotes
        )
        const marketPrice = matched[0]?.price
        const roomType = matched[0]?.roomType
        const bookedUnit =
          job.bookedUnitPrice != null && Number.isFinite(job.bookedUnitPrice)
            ? Number(job.bookedUnitPrice)
            : null

        if (marketPrice == null || !(marketPrice > 0)) {
          results.push({
            bookingId: job.bookingId,
            ok: false,
            error: '검색 결과에서 해당 호텔을 찾지 못했습니다.',
            destination: job.destination,
            bookedUnit,
            rates: propertyRates,
          })
          continue
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
          destination: job.destination,
          rates: propertyRates.map((r) => ({
            ...r,
            matched: r.roomType === roomType,
          })),
        })
      }
    }

    const okCount = results.filter((r) => r.ok).length
    return NextResponse.json({
      success: okCount > 0,
      okCount,
      total: results.length,
      scrapeCount,
      groupCount: groups.size,
      results,
    })
  } catch (error) {
    console.error('[api/hotels/rates/tour-price-check]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Tour price check failed' },
      { status: 500 }
    )
  }
}
