import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/api-security'
import { listGoogleBusinessOperatorIdsWithLocation } from '@/lib/googleBusinessConnection'
import { getGoogleReviewStats } from '@/lib/googleReviewAdmin'
import { importGoogleBusinessReviewsUntilDone } from '@/lib/googleReviewImport'
import { insertGoogleReviewImportNotification } from '@/lib/googleReviewImportNotify'

export const maxDuration = 120

function isNinePmLosAngeles(now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now)
  )
  return hour === 21
}

/**
 * 라스베이거스 오후 9시(PDT=04:00 UTC, PST=05:00 UTC)에
 * 마지막 동기화 이후 Google 리뷰만 가져옵니다.
 */
export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  if (!isNinePmLosAngeles()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'not_9pm_los_angeles',
      timestamp: new Date().toISOString(),
    })
  }

  try {
    const operatorIds = await listGoogleBusinessOperatorIdsWithLocation()
    if (operatorIds.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'no_connected_location',
        timestamp: new Date().toISOString(),
      })
    }

    const results = []
    for (const operatorId of operatorIds) {
      const result = await importGoogleBusinessReviewsUntilDone({
        operatorId,
        incremental: true,
        classifiedBy: 'cron:google-reviews-import',
        maxPages: 20,
      })
      let notificationId: string | null = null
      if (result.imported > 0 || result.updated > 0) {
        try {
          const stats = await getGoogleReviewStats(operatorId, 'google')
          const notification = await insertGoogleReviewImportNotification({
            operatorId,
            importedCount: result.imported,
            updatedCount: result.updated,
            classifiedCount: result.classified,
            unclassifiedCount: stats.unclassified,
          })
          notificationId = notification?.id ?? null
        } catch (notifyError) {
          console.error('[cron/google-reviews-import] notify', notifyError)
        }
      }
      results.push({ operatorId, ...result, notificationId })
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/google-reviews-import]', error)
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
