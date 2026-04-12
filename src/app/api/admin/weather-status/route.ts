import { NextResponse } from 'next/server'
import { supabaseAdmin, createClientSupabase } from '@/lib/supabase'
import { addTourLocalCalendarDays, getTourLocalToday } from '@/lib/tourWeatherDates'

const GOBLIN_LOCATIONS = [
  'Grand Canyon South Rim',
  'Zion Canyon',
  'Page City',
] as const

type WeatherRow = {
  location_name: string
  weather_main: string | null
  temperature: unknown
  updated_at: string | null
  date: string
}

function isCompleteRow(r: WeatherRow): boolean {
  return (
    r.weather_main != null &&
    String(r.weather_main).trim() !== '' &&
    r.temperature != null &&
    r.temperature !== ''
  )
}

function calendarDayDistanceFromToday(dateStr: string, today: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((t(dateStr) - t(today)) / 86400000)
}

function evaluateTodayCoverage(rows: WeatherRow[] | null, today: string) {
  const missingTodayLocations: string[] = []

  for (const name of GOBLIN_LOCATIONS) {
    const candidates = (rows ?? []).filter((r) => r.location_name === name && isCompleteRow(r))
    if (candidates.length === 0) {
      missingTodayLocations.push(name)
      continue
    }
    candidates.sort((a, b) => {
      const da = Math.abs(calendarDayDistanceFromToday(a.date, today))
      const db = Math.abs(calendarDayDistanceFromToday(b.date, today))
      if (da !== db) return da - db
      const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return tb - ta
    })
    const best = candidates[0]
    const dist = Math.abs(calendarDayDistanceFromToday(best.date, today))
    if (dist > 1) {
      missingTodayLocations.push(name)
    }
  }

  return {
    todayComplete: missingTodayLocations.length === 0,
    missingTodayLocations,
  }
}

export async function GET() {
  try {
    const db = supabaseAdmin ?? createClientSupabase()
    const today = getTourLocalToday()
    const windowDates = [
      addTourLocalCalendarDays(today, -1),
      today,
      addTourLocalCalendarDays(today, 1),
    ]

    const { data: windowRows, error: todayErr } = await db
      .from('weather_data')
      .select('location_name, weather_main, temperature, updated_at, date')
      .in('date', windowDates)
      .in('location_name', [...GOBLIN_LOCATIONS])

    if (todayErr) {
      console.error('[weather-status] window query:', todayErr)
      return NextResponse.json(
        { error: 'Failed to load weather status' },
        { status: 500 }
      )
    }

    const { todayComplete, missingTodayLocations } = evaluateTodayCoverage(
      windowRows as WeatherRow[] | null,
      today
    )

    const { data: lastRow, error: lastErr } = await db
      .from('weather_data')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastErr) {
      console.error('[weather-status] last updated query:', lastErr)
    }

    const lastUpdatedAt = lastRow?.updated_at ?? null
    const lastMs = lastUpdatedAt ? new Date(lastUpdatedAt).getTime() : null
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const collectionStale =
      lastMs == null || Number.isNaN(lastMs) || now - lastMs > weekMs

    const needsReminder = !todayComplete || collectionStale

    return NextResponse.json({
      today,
      todayComplete,
      missingTodayLocations,
      lastUpdatedAt,
      collectionStale,
      needsReminder,
    })
  } catch (e) {
    console.error('[weather-status]', e)
    return NextResponse.json(
      { error: 'Failed to load weather status' },
      { status: 500 }
    )
  }
}
