import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import {
  runManualWyndhamLogin,
  WyndhamAutomationError,
} from '@/lib/hotels/suppliers/wyndham/session'

export const runtime = 'nodejs'
/** Admin may take several minutes to complete Sign In in the opened Chrome window. */
export const maxDuration = 300

/**
 * POST /api/hotels/wyndham/login
 * Opens headed Chrome on the server machine → admin Signs In → saves auth-state.
 * Only works when Next.js runs locally (or on a desktop worker), not on serverless without a display.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const result = await runManualWyndhamLogin({ timeoutMs: 5 * 60_000 })
    return NextResponse.json({
      success: true,
      message:
        'Wyndham 로그인 세션을 저장했습니다. 이제 「멤버 요금 가져오기」를 실행하세요.',
      ...result,
    })
  } catch (error) {
    console.error('[api/hotels/wyndham/login]', error)
    const message =
      error instanceof Error ? error.message : 'Wyndham 로그인 실패'
    const status = error instanceof WyndhamAutomationError ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
