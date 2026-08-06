import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { getWyndhamAutomationStatus } from '@/lib/hotels/suppliers/wyndham/status'

/**
 * GET /api/hotels/wyndham/status
 * Readiness for login + member-rate scraping (no secrets returned).
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  try {
    const status = await getWyndhamAutomationStatus()
    return NextResponse.json({ success: true, status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
