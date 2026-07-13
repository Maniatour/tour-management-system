import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendIncompleteTourChecklistReminders } from '@/lib/sopTourChecklistReminders'
import { verifyCronAuth } from '@/lib/api-security'

export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const today = new Date()
    const dateTo = today.toISOString().slice(0, 10)
    const dateFrom = new Date(today)
    dateFrom.setDate(dateFrom.getDate() - 7)

    const result = await sendIncompleteTourChecklistReminders(supabaseAdmin, {
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo,
      locale: 'ko',
    })

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/remind-tour-checklists] unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
