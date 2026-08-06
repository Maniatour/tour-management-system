import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/api-security'
import { runDailyHotelRateCheck } from '@/lib/hotels/jobs/daily-rate-check'

export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  try {
    const result = await runDailyHotelRateCheck()
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/hotel-rate-check]', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
