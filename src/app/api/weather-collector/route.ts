import { NextRequest, NextResponse } from 'next/server'
import { collectDataForDate, collect1MonthSunriseSunset } from '@/lib/weatherCollectorService'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is a 1-month sunrise/sunset collection request
    if (body.collect1MonthSunriseSunset) {
      const { startDate } = body
      
      if (!startDate) {
        return NextResponse.json({ error: 'Start date is required for 1-month collection' }, { status: 400 })
      }
      
      const result = await collect1MonthSunriseSunset(startDate)
      
      return NextResponse.json({ 
        success: true, 
        message: `1개월 일출/일몰 데이터 수집 완료 (${result.startDate} ~ ${result.endDate}). 성공: ${result.successCount}개, 실패: ${result.errorCount}개`,
        details: result
      })
    }
    
    // Regular single date collection
    const { date, updateWeatherOnly } = body
    
    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    await collectDataForDate(date, updateWeatherOnly || false)
    
    const message = updateWeatherOnly 
      ? `Weather data updated for ${date}` 
      : `Data collected for ${date}`
    
    return NextResponse.json({ 
      success: true, 
      message 
    })
  } catch (error) {
    console.error('Error in weather data collection:', error)
    return NextResponse.json(
      { error: 'Failed to collect weather data' }, 
      { status: 500 }
    )
  }
}

// Collect data for multiple dates (for scheduling)
export async function PUT(request: NextRequest) {
  try {
    const { startDate, endDate } = await request.json()
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates = []
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    for (const date of dates) {
      await collectDataForDate(date)
      // Add delay between dates to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Data collected for ${dates.length} dates from ${startDate} to ${endDate}` 
    })
  } catch (error) {
    console.error('Error in bulk weather data collection:', error)
    return NextResponse.json(
      { error: 'Failed to collect weather data' }, 
      { status: 500 }
    )
  }
}
