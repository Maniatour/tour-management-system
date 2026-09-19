import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/api-security'
import { runCompetitorPriceCheck } from '@/lib/market-research/job'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

export const maxDuration = 120

export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  try {
    const result = await runCompetitorPriceCheck({ operatorId: KOVEgAS_OPERATOR_ID })
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/competitor-price-check]', error)
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
