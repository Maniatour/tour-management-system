import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { createServerSupabase } from '@/lib/supabase-server'
import { resolveOperatorId } from '@/lib/operators/scopeQuery'
import { isStaffTenantLockEnabled } from '@/lib/operators/staffTenantLock'
import { isValidOperatorIdFormat } from '@/lib/operators/activeOperatorCookie'

/**
 * POST /api/admin/operators/active-session
 * Body: { operatorId }
 * When SAAS_STAFF_TENANT_LOCK is on, stamps JWT app_metadata.operator_id (service role).
 * Client should refreshSession() afterward. No booking/payment logic.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!isStaffTenantLockEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      lockEnabled: false,
      hint: 'SAAS_STAFF_TENANT_LOCK off — JWT claim not written; staff SELECT stays unscoped',
    })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  let body: { operatorId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const operatorId = resolveOperatorId(body.operatorId)
  if (!isValidOperatorIdFormat(operatorId)) {
    return NextResponse.json({ error: 'Invalid operatorId' }, { status: 400 })
  }

  const { data: op, error: opErr } = await supabaseAdmin
    .from('operators')
    .select('id')
    .eq('id', operatorId)
    .maybeSingle()

  if (opErr || !op) {
    return NextResponse.json({ error: 'Unknown operator' }, { status: 400 })
  }

  const serverSb = await createServerSupabase()
  const {
    data: { user },
    error: userErr,
  } = await serverSb.auth.getUser()

  if (userErr || !user?.id) {
    return NextResponse.json({ error: 'User session required for JWT stamp' }, { status: 401 })
  }

  const prevMeta =
    user.app_metadata && typeof user.app_metadata === 'object' ? user.app_metadata : {}

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...prevMeta,
      operator_id: operatorId,
    },
  })

  if (updErr) {
    console.error('[admin/operators/active-session]', updErr)
    return NextResponse.json(
      { error: updErr.message || 'Failed to stamp app_metadata.operator_id' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    skipped: false,
    lockEnabled: true,
    operatorId,
    hint: 'Refresh the auth session so JWT carries app_metadata.operator_id',
  })
}

/** GET: lock flag + whether current JWT already has operator_id claim */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  const lockEnabled = isStaffTenantLockEnabled()
  const serverSb = await createServerSupabase()
  const {
    data: { user },
  } = await serverSb.auth.getUser()

  const claim =
    user?.app_metadata && typeof user.app_metadata === 'object'
      ? String((user.app_metadata as { operator_id?: string }).operator_id || '')
      : ''

  return NextResponse.json({
    ok: true,
    lockEnabled,
    jwtOperatorId: isValidOperatorIdFormat(claim) ? claim : null,
    detail: lockEnabled
      ? claim
        ? `lock ON; JWT operator_id=${claim}`
        : 'lock ON; JWT operator_id missing — switch tenant to stamp'
      : 'lock OFF (default) — company_expenses staff SELECT remains unscoped',
  })
}
