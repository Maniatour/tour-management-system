import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { evaluateOperatorPilotStatus } from '@/lib/operators/pilotStatus'
import { evaluateKovegasRegression } from '@/lib/operators/kovegasRegression'
import { evaluateOpsFinanceIsolation } from '@/lib/operators/opsFinanceIsolation'
import { evaluateCommerceIsolation } from '@/lib/operators/commerceIsolation'
import { evaluateHostBookReadiness } from '@/lib/operators/hostBookReadiness'
import { evaluateActiveOperatorCookiePrep } from '@/lib/operators/applyActiveOperatorSession'
import { isStaffTenantLockEnabled } from '@/lib/operators/staffTenantLock'
import { createServerSupabase } from '@/lib/supabase-server'
import { isValidOperatorIdFormat } from '@/lib/operators/activeOperatorCookie'
import { KOVEgAS_OPERATOR_ID } from '@/lib/operatorConstants'

/**
 * GET /api/admin/operators/pilot-status?operatorId=
 * Operator B E2E checklist + Kovegas regression + Ops finance stamp smoke
 * + commerce isolation (6e.0–6e.1) + host-book readiness (6e.2)
 * + active-operator cookie/header prep.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const operatorId =
    request.nextUrl.searchParams.get('operatorId') || KOVEgAS_OPERATOR_ID

  try {
    const activeOperatorSession = evaluateActiveOperatorCookiePrep(request)
    const lockEnabled = isStaffTenantLockEnabled()
    let jwtOperatorId: string | null = null
    try {
      const serverSb = await createServerSupabase()
      const {
        data: { user },
      } = await serverSb.auth.getUser()
      const claim =
        user?.app_metadata && typeof user.app_metadata === 'object'
          ? String((user.app_metadata as { operator_id?: string }).operator_id || '')
          : ''
      jwtOperatorId = isValidOperatorIdFormat(claim) ? claim : null
    } catch {
      jwtOperatorId = null
    }
    const staffTenantLock = {
      lockEnabled,
      jwtOperatorId,
      ok: !lockEnabled || jwtOperatorId != null,
      detail: lockEnabled
        ? jwtOperatorId
          ? `SAAS_STAFF_TENANT_LOCK on; JWT operator_id=${jwtOperatorId}`
          : 'SAAS_STAFF_TENANT_LOCK on; JWT claim missing — switch tenant to stamp'
        : 'SAAS_STAFF_TENANT_LOCK off (default) — company_expenses staff SELECT unscoped until claim',
    }
    const [report, regression, opsFinance, commerceIsolation, hostBook] =
      await Promise.all([
        evaluateOperatorPilotStatus(supabaseAdmin, operatorId),
        evaluateKovegasRegression(supabaseAdmin),
        evaluateOpsFinanceIsolation(supabaseAdmin, operatorId),
        evaluateCommerceIsolation(supabaseAdmin, operatorId),
        evaluateHostBookReadiness(supabaseAdmin, operatorId),
      ])
    return NextResponse.json({
      ok: true,
      ...report,
      regression,
      opsFinance,
      commerceIsolation,
      hostBook,
      activeOperatorSession,
      staffTenantLock,
      hint: 'hostBook=6e.2. commerceIsolation=6e.0–6e.1. staffTenantLock=6d.0–6d.3 (opt-in).',
    })
  } catch (err) {
    console.error('[admin/operators/pilot-status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'pilot status failed' },
      { status: 400 }
    )
  }
}
