import { NextRequest, NextResponse } from 'next/server'

// Generate dates for the next 7 days
function generateNext7Days() {
  const dates = []
  const today = new Date()
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }
  
  return dates
}

// Collect weather data for upcoming tours
export async function GET() {
  try {
    const dates = generateNext7Days()
    const results = []
    
    for (const date of dates) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/weather-collector`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ date })
        })
        
        if (response.ok) {
          results.push({ date, status: 'success' })
        } else {
          results.push({ date, status: 'error', error: await response.text() })
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (error) {
        results.push({ date, status: 'error', error: error.message })
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
