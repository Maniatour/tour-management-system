import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import { createOperator, listOperators } from '@/lib/operators/operatorService'

/** GET /api/admin/operators — list tenants */
export async function GET(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  try {
    const operators = await listOperators(supabaseAdmin)
    return NextResponse.json({ ok: true, operators })
  } catch (err) {
    console.error('[admin/operators GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'list failed' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/operators — create tenant + owner membership
 * Body: { name, slug, ownerEmail, timezone?, planCode?, enableOperations?, status? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      slug?: string
      ownerEmail?: string
      timezone?: string
      planCode?: string
      enableOperations?: boolean
      status?: 'active' | 'pending'
      subdomain?: string
    }

    if (!body.name?.trim() || !body.slug?.trim() || !body.ownerEmail?.trim()) {
      return NextResponse.json(
        { error: 'name, slug, and ownerEmail are required' },
        { status: 400 }
      )
    }

    const result = await createOperator(supabaseAdmin, {
      name: body.name,
      slug: body.slug,
      ownerEmail: body.ownerEmail,
      ...(body.timezone ? { timezone: body.timezone } : {}),
      ...(body.planCode ? { planCode: body.planCode } : {}),
      ...(body.subdomain ? { subdomain: body.subdomain } : {}),
      enableOperations: body.enableOperations === true,
      status: body.status || 'pending',
    })

    return NextResponse.json({
      ok: true,
      ...result,
      hint: 'Invite members via POST /api/admin/operators/:id/members. Start Connect via POST /api/admin/operators/:id/stripe-connect.',
    })
  } catch (err) {
    console.error('[admin/operators POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'create failed' },
      { status: 400 }
    )
  }
}
