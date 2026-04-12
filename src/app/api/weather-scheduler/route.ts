import { NextResponse } from 'next/server'
import { collectDataForDate } from '@/lib/weatherCollectorService'
import { getTourLocalNextNDates } from '@/lib/tourWeatherDates'

export const maxDuration = 300

// Collect weather data for upcoming tours (in-process; avoids broken self-HTTP to wrong APP_URL)
export async function GET() {
  try {
    const dates = getTourLocalNextNDates(7)
    const results = []

    for (const date of dates) {
      try {
        await collectDataForDate(date, false)
        results.push({ date, status: 'success' })
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({ date, status: 'error', error: message })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Weather data collection completed',
      results
    })
  } catch (error) {
    console.error('Error in weather scheduler:', error)
    return NextResponse.json(
      { error: 'Failed to run weather scheduler' },
      { status: 500 }
    )
  }
}
