import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'

type SyncLogRow = {
  success?: boolean | null
  last_sync_time?: string | null
  reservations_count?: number | null
  tours_count?: number | null
  created_at?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const spreadsheetId = searchParams.get('spreadsheetId')

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, message: 'Spreadsheet ID is required' },
        { status: 400 }
      )
    }

    // 동기화 통계 조회
    const { data: syncStats, error } = await fromUntypedTable(supabase, 'sync_logs')
      .select('*')
      .eq('spreadsheet_id', spreadsheetId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching sync stats:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch sync statistics' },
        { status: 500 }
      )
    }

    // 통계 계산
    const stats = (syncStats ?? []) as SyncLogRow[]
    const totalSyncs = stats.length
    const successfulSyncs = stats.filter((s) => s.success).length
    const failedSyncs = totalSyncs - successfulSyncs
    const lastSyncTime = stats[0]?.last_sync_time || null
    const totalReservations = stats.reduce((sum, s) => sum + (s.reservations_count || 0), 0)
    const totalTours = stats.reduce((sum, s) => sum + (s.tours_count || 0), 0)

    // 최근 7일간의 동기화 통계
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentStats } = await fromUntypedTable(supabase, 'sync_logs')
      .select('created_at, success, reservations_count, tours_count')
      .eq('spreadsheet_id', spreadsheetId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    const dailyStats = ((recentStats ?? []) as SyncLogRow[]).reduce((acc, stat) => {
      const createdAt = stat.created_at
      if (!createdAt) return acc
      const date = new Date(createdAt).toISOString().split('T')[0]
      if (!acc[date]) {
        acc[date] = { syncs: 0, successful: 0, reservations: 0, tours: 0 }
      }
      acc[date].syncs++
      if (stat.success) acc[date].successful++
      acc[date].reservations += stat.reservations_count || 0
      acc[date].tours += stat.tours_count || 0
      return acc
    }, {} as Record<string, any>) || {}

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalSyncs,
          successfulSyncs,
          failedSyncs,
          successRate: totalSyncs > 0 ? (successfulSyncs / totalSyncs * 100).toFixed(1) : 0,
          lastSyncTime,
          totalReservations,
          totalTours
        },
        recentSyncs: stats.slice(0, 5),
        dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          ...stats
        }))
      }
    })

  } catch (error) {
    console.error('Sync stats error:', error)
    return NextResponse.json(
      { success: false, message: `Failed to fetch sync statistics: ${error}` },
      { status: 500 }
    )
  }
}
