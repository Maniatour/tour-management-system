import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/api-security'
import { runReservationStatusMonitor } from '@/lib/hotels/jobs/reservation-status-monitor'

export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  try {
    const result = await runReservationStatusMonitor()
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/hotel-reservation-monitor]', error)
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
