import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyCronAuth } from '@/lib/api-security'
import { advanceGuideToursVisibleUntilInDb } from '@/lib/guideToursVisibleUntil'

/**
 * 라스베이거스 달력 날짜가 바뀌면 가이드 공개 마감일을 하루(또는 밀린 일수)만큼 연장.
 * 하루 1회: 08:00 UTC ≈ LV 자정(PST) / 01:00(PDT). 날짜 비교로 중복 연장 방지.
 */
export async function GET(request: NextRequest) {
  const cronDenied = verifyCronAuth(request)
  if (cronDenied) return cronDenied

  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.' },
        { status: 500 },
      )
    }

    const result = await advanceGuideToursVisibleUntilInDb(supabaseAdmin)

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/advance-guide-tours-visible-until]', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
