import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { getHotelSupplier } from '@/lib/hotels/suppliers/registry'
import {
  enrichJobsWithDestination,
  hydrateTourPriceCheckResults,
  persistTourPriceCheckQuotes,
} from '@/lib/hotels/services/tour-price-check-service'
import type {
  TourPriceCheckJob,
  TourPriceCheckResult,
} from '@/lib/hotels/tour-price-check-types'
import type { HotelRateQuote } from '@/lib/hotels/types'

export const runtime = 'nodejs'
/** Many unique check-in dates × Page/Kanab — allow several minutes */
export const maxDuration = 300

export type { TourPriceCheckJob, TourPriceCheckResult }

/**
 * POST /api/hotels/rates/tour-price-check
 * - { hydrate: true, jobs } → rebuild badges from hotel_rates (no scrape)
 * - { jobs } → scrape Wyndham, persist to hotel_rates, return matches
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      jobs?: TourPriceCheckJob[]
      hydrate?: boolean
    }
    const jobs = Array.isArray(body.jobs) ? body.jobs : []
    if (!jobs.length) {
      return NextResponse.json({ error: 'jobs[] required' }, { status: 400 })
    }

    if (body.hydrate === true) {
      const results = await hydrateTourPriceCheckResults(jobs)
      const okCount = results.filter((r) => r.ok).length
      return NextResponse.json({
        success: true,
        hydrated: true,
        okCount,
        total: results.length,
        results,
      })
    }

    type GroupJob = TourPriceCheckJob & { destination: string }
    const enriched = enrichJobsWithDestination(jobs)
    const groups = new Map<string, GroupJob[]>()
    for (const job of enriched) {
      const key = `${job.destination}|${job.checkIn}|${job.checkOut}`
      const list = groups.get(key) || []
      list.push(job)
      groups.set(key, list)
    }

    const supplier = getHotelSupplier('wyndham', { forceLive: true })
    const results: TourPriceCheckResult[] = []
    let scrapeCount = 0
    const savedHotelIds = new Set<string>()

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

      const persisted = await persistTourPriceCheckQuotes({
        destination: sample.destination,
        allQuotes,
        jobs: group,
      })
      results.push(...persisted.results)
      for (const id of persisted.savedHotelIds) savedHotelIds.add(id)
    }

    const okCount = results.filter((r) => r.ok).length
    return NextResponse.json({
      success: okCount > 0,
      okCount,
      total: results.length,
      scrapeCount,
      groupCount: groups.size,
      savedHotels: savedHotelIds.size,
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
