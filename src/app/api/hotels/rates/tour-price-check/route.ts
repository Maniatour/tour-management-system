import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { getHotelSupplier } from '@/lib/hotels/suppliers/registry'
import { runPool } from '@/lib/hotels/suppliers/wyndham/run-pool'
import {
  destinationsToScrapeForJobs,
  enrichJobsWithDestination,
  hydrateTourHotelRateSurveyResults,
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

/**
 * Parallel scrapes: Page+Kanab per night, and up to N nights at once.
 * Each scrape opens Chromium (~30s mainly on Wyndham goto), so serial was ~N×30s.
 */
const SURVEY_NIGHT_CONCURRENCY = Math.max(
  1,
  Number(process.env.WYNDHAM_SURVEY_CONCURRENCY || 2)
)

export type { TourPriceCheckJob, TourPriceCheckResult }

async function scrapeDestinations(input: {
  destinations: string[]
  checkIn: string
  checkOut: string
  supplierHotelIdPrefix: string
}): Promise<{
  quotesByDestination: Record<string, HotelRateQuote[]>
  failed: Map<string, string>
  scrapeCount: number
}> {
  const supplier = getHotelSupplier('wyndham', { forceLive: true })
  const quotesByDestination: Record<string, HotelRateQuote[]> = {}
  const failed = new Map<string, string>()

  await Promise.all(
    input.destinations.map(async (destination) => {
      try {
        quotesByDestination[destination] = await supplier.getRates({
          supplierHotelId: `${input.supplierHotelIdPrefix}:${destination}`,
          destination,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          rooms: 1,
          guests: 2,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rate fetch failed'
        quotesByDestination[destination] = []
        failed.set(destination, message)
      }
    })
  )

  return {
    quotesByDestination,
    failed,
    scrapeCount: input.destinations.length,
  }
}

/**
 * POST /api/hotels/rates/tour-price-check
 * - { hydrate: true, jobs } → rebuild badges from hotel_rates (no scrape)
 * - { hydrate: true, survey: true, stays } → rebuild survey badges from hotel_rates
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

    if (body.hydrate === true && body.survey === true) {
      const stays = (Array.isArray(body.stays) ? body.stays : []).filter(
        (s) => s?.stayId && s.checkIn && s.checkOut
      )
      if (!stays.length) {
        return NextResponse.json({ error: 'stays[] required' }, { status: 400 })
      }
      const results = await hydrateTourHotelRateSurveyResults(stays)
      const okCount = results.filter((r) => r.ok).length
      return NextResponse.json({
        success: true,
        hydrated: true,
        survey: true,
        okCount,
        total: results.length,
        results,
      })
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

      const dateGroups = [...byDates.values()]

      // 1) Scrape Page+Kanab for each unique night in parallel (wall-clock bottleneck)
      const scrapedGroups = await runPool(
        dateGroups,
        SURVEY_NIGHT_CONCURRENCY,
        async (group) => {
          const sample = group[0]!
          const scraped = await scrapeDestinations({
            destinations: [PAGE_DEST, KANAB_DEST],
            checkIn: sample.checkIn,
            checkOut: sample.checkOut,
            supplierHotelIdPrefix: 'todo-hotel-survey',
          })
          for (const [destination, message] of scraped.failed) {
            console.warn(`[tour-price-check survey] ${destination}: ${message}`)
          }
          return { group, scraped }
        }
      )

      // 2) Persist / build results sequentially (catalog upserts must not race)
      const results = []
      const savedHotelIds = new Set<string>()
      let scrapeCount = 0

      for (const { group, scraped } of scrapedGroups) {
        scrapeCount += scraped.scrapeCount
        const quotesByDestination = scraped.quotesByDestination
        if (
          !(quotesByDestination[PAGE_DEST]?.length) &&
          !(quotesByDestination[KANAB_DEST]?.length)
        ) {
          for (const stay of group) {
            results.push({
              stayId: stay.stayId,
              ok: false as const,
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
        concurrency: SURVEY_NIGHT_CONCURRENCY,
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

    const dateGroups = [...byDates.values()]

    // Scrape nights in parallel; persist sequentially to avoid catalog races
    const scrapedGroups = await runPool(
      dateGroups,
      SURVEY_NIGHT_CONCURRENCY,
      async (group) => {
        const sample = group[0]!
        const destinations = destinationsToScrapeForJobs(group)
        const scraped = await scrapeDestinations({
          destinations,
          checkIn: sample.checkIn,
          checkOut: sample.checkOut,
          supplierHotelIdPrefix: 'todo-price-check',
        })
        for (const [destination, message] of scraped.failed) {
          if (!group.some((j) => j.destination === destination)) {
            console.warn(
              `[tour-price-check] optional scrape failed ${destination}: ${message}`
            )
          }
        }
        return { group, scraped, destinations }
      }
    )

    const results: TourPriceCheckResult[] = []
    const savedHotelIds = new Set<string>()
    let scrapeCount = 0

    for (const { group, scraped } of scrapedGroups) {
      scrapeCount += scraped.scrapeCount
      const quotesByDestination = scraped.quotesByDestination
      const requiredDests = new Set(group.map((j) => j.destination))
      const failedRequired = new Map<string, string>()
      for (const [destination, message] of scraped.failed) {
        if (requiredDests.has(destination)) {
          failedRequired.set(destination, message)
        }
      }

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

      const jobsToPersist = group.filter((j) => !failedRequired.has(j.destination))
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
      concurrency: SURVEY_NIGHT_CONCURRENCY,
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
