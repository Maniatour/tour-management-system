import { NextRequest, NextResponse } from 'next/server'
import { requireStaffApiAuth } from '@/lib/api-security'
import { supabaseAdmin } from '@/lib/supabase'
import {
  inviteOperatorMember,
  listOperatorMembers,
} from '@/lib/operators/operatorService'
import type { OperatorMemberRole } from '@/lib/operatorConstants'

type RouteContext = { params: Promise<{ id: string }> }

/** GET /api/admin/operators/:id/members */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const members = await listOperatorMembers(supabaseAdmin, id)
    return NextResponse.json({ ok: true, members })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'list failed' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/operators/:id/members
 * Body: { email, role? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireStaffApiAuth(request)
  if (!auth.ok) return auth.response

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'supabaseAdmin required' }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      role?: OperatorMemberRole
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const result = await inviteOperatorMember(supabaseAdmin, {
      operatorId: id,
      email: body.email,
      ...(body.role ? { role: body.role } : {}),
    })

    return NextResponse.json({
      ok: true,
      ...result,
      hint: 'Member status=invited until they sign in; OperatorContext resolves active memberships by email.',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invite failed' },
      { status: 400 }
    )
  }
}
