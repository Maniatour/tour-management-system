import { NextRequest, NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/api-security'
import { POST as postGmailReservationImportSync } from '@/app/api/email/gmail/sync/route'

export const maxDuration = 120

/**
 * Gmail History API로 새 메일만 가져와 예약 가져오기 목록에 넣습니다.
 * Vercel Cron: 5분마다. Gmail API 무료 할당량 범위의 소량 호출입니다.
 */
export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  try {
    const syncReq = new Request('http://127.0.0.1/api/email/gmail/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incremental: true }),
    })
    const res = await postGmailReservationImportSync(syncReq)
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>

    if (res.status === 400 && payload.error === 'Gmail not connected') {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'gmail_not_connected',
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      {
        success: res.ok,
        ...payload,
        timestamp: new Date().toISOString(),
      },
      { status: res.ok ? 200 : res.status }
    )
  } catch (error) {
    console.error('[cron/gmail-reservation-import]', error)
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
