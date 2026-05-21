import { NextRequest, NextResponse } from 'next/server'
import {
  getSunriseSunsetForLocation,
  parseSunriseSunsetQuery,
} from '@/lib/sunriseSunsetFetch'

/**
 * GET /api/sunrise-sunset?lat=&lng=&date=YYYY-MM-DD
 * 브라우저 CORS 회피 + sunrise-sunset.org 장애 시 suncalc 로 계산.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = parseSunriseSunsetQuery(
    searchParams.get('lat'),
    searchParams.get('lng'),
    searchParams.get('date')
  )

  if (!parsed) {
    return NextResponse.json({ error: 'Invalid lat, lng, or date' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const result = await getSunriseSunsetForLocation(
      parsed.lat,
      parsed.lng,
      parsed.date,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    return NextResponse.json(
      { sunrise: result.sunrise, sunset: result.sunset, source: result.source },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
        },
      }
    )
  } catch (error) {
    clearTimeout(timeoutId)
    console.warn('[api/sunrise-sunset]', error)
    return NextResponse.json({ error: 'Sunrise/sunset fetch failed' }, { status: 500 })
  }
}
