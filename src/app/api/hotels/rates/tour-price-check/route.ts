import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { getHotelSupplier } from '@/lib/hotels/suppliers/registry'
import {
  destinationsToScrapeForJobs,
  enrichJobsWithDestination,
  hydrateTourPriceCheckResults,
  KANAB_DEST,
  PAGE_DEST,
  persistTourPriceCheckQuotes,
  runTourHotelRateSurvey,
} from '@/lib/hotels/services/tour-price-check-service'
import type {
  TourHotelRateSurveyStay,
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
 * - { survey: true, stays } → Page+Kanab market survey for unbooked tours
 * - { jobs } → scrape Wyndham, persist to hotel_rates, return matches
 *
 * Page / Kanab bookings always scrape both Page AZ + Kanab UT for the same dates
 * so the UI can show same-hotel and cheapest-alt-city badges.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as {
      jobs?: TourPriceCheckJob[]
      hydrate?: boolean
      survey?: boolean
      stays?: TourHotelRateSurveyStay[]
    }

    if (body.hydrate === true) {
      const jobs = Array.isArray(body.jobs) ? body.jobs : []
      if (!jobs.length) {
        return NextResponse.json({ error: 'jobs[] required' }, { status: 400 })
      }
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

    if (body.survey === true) {
      const stays = (Array.isArray(body.stays) ? body.stays : []).filter(
        (s) => s?.stayId && s.checkIn && s.checkOut
      )
      if (!stays.length) {
        return NextResponse.json({ error: 'stays[] required' }, { status: 400 })
      }

      const byDates = new Map<string, TourHotelRateSurveyStay[]>()
      for (const stay of stays) {
        const key = `${stay.checkIn}|${stay.checkOut}`
        const list = byDates.get(key) || []
        list.push(stay)
        byDates.set(key, list)
      }

      const supplier = getHotelSupplier('wyndham', { forceLive: true })
      const results = []
      let scrapeCount = 0
      const savedHotelIds = new Set<string>()

      for (const [, group] of byDates) {
        const sample = group[0]!
        const quotesByDestination: Record<string, HotelRateQuote[]> = {}

        for (const destination of [PAGE_DEST, KANAB_DEST]) {
          scrapeCount += 1
          try {
            quotesByDestination[destination] = await supplier.getRates({
              supplierHotelId: `todo-hotel-survey:${destination}`,
              destination,
              checkIn: sample.checkIn,
              checkOut: sample.checkOut,
              rooms: 1,
              guests: 2,
            })
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Rate fetch failed'
            console.warn(`[tour-price-check survey] ${destination}: ${message}`)
            quotesByDestination[destination] = []
          }
        }

        if (
          !(quotesByDestination[PAGE_DEST]?.length) &&
          !(quotesByDestination[KANAB_DEST]?.length)
        ) {
          for (const stay of group) {
            results.push({
              stayId: stay.stayId,
              ok: false,
              checkIn: stay.checkIn,
              checkOut: stay.checkOut,
              nightIndex: stay.nightIndex,
              tourId: stay.tourId,
              error: 'Page/Kanab 요금 조회에 실패했습니다.',
            })
          }
          continue
        }

        const surveyed = await runTourHotelRateSurvey({
          quotesByDestination,
          stays: group,
        })
        results.push(...surveyed.results)
        for (const id of surveyed.savedHotelIds) savedHotelIds.add(id)
      }

      const okCount = results.filter((r) => r.ok).length
      return NextResponse.json({
        success: okCount > 0,
        survey: true,
        okCount,
        total: results.length,
        scrapeCount,
        groupCount: byDates.size,
        savedHotels: savedHotelIds.size,
        results,
      })
    }

    const jobs = Array.isArray(body.jobs) ? body.jobs : []
    if (!jobs.length) {
      return NextResponse.json({ error: 'jobs[] required' }, { status: 400 })
    }

    type GroupJob = TourPriceCheckJob & { destination: string }
    const enriched = enrichJobsWithDestination(jobs)

    /** One scrape plan per check-in/out (Page jobs pull Page+Kanab). */
    const byDates = new Map<string, GroupJob[]>()
    for (const job of enriched) {
      const key = `${job.checkIn}|${job.checkOut}`
      const list = byDates.get(key) || []
      list.push(job)
      byDates.set(key, list)
    }

    const supplier = getHotelSupplier('wyndham', { forceLive: true })
    const results: TourPriceCheckResult[] = []
    let scrapeCount = 0
    const savedHotelIds = new Set<string>()

    for (const [, group] of byDates) {
      const sample = group[0]!
      const destinations = destinationsToScrapeForJobs(group)
      const requiredDests = new Set(group.map((j) => j.destination))
      const quotesByDestination: Record<string, HotelRateQuote[]> = {}
      const failedRequired = new Map<string, string>()

      for (const destination of destinations) {
        scrapeCount += 1
        try {
          quotesByDestination[destination] = await supplier.getRates({
            supplierHotelId: `todo-price-check:${destination}`,
            destination,
            checkIn: sample.checkIn,
            checkOut: sample.checkOut,
            rooms: 1,
            guests: 2,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Rate fetch failed'
          quotesByDestination[destination] = []
          if (requiredDests.has(destination)) {
            failedRequired.set(destination, message)
          } else {
            console.warn(
              `[tour-price-check] optional scrape failed ${destination}: ${message}`
            )
          }
        }
      }

      const jobsToPersist = group.filter((j) => !failedRequired.has(j.destination))
      for (const job of group) {
        const err = failedRequired.get(job.destination)
        if (err) {
          results.push({
            bookingId: job.bookingId,
            ok: false,
            error: err,
            destination: job.destination,
            bookedUnit: job.bookedUnitPrice ?? null,
          })
        }
      }

      if (!jobsToPersist.length) continue

      const persisted = await persistTourPriceCheckQuotes({
        quotesByDestination,
        jobs: jobsToPersist,
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
      groupCount: byDates.size,
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
