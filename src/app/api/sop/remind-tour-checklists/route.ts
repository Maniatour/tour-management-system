import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { supabase as supabaseAnon } from '@/lib/supabase'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'
import { sendIncompleteTourChecklistReminders } from '@/lib/sopTourChecklistReminders'

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service role key is required')
  }
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

function userClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient<Database>(supabaseUrl, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }
    const token = authHeader.split(' ')[1]
    const {
      data: { user },
      error: authError,
    } = await supabaseAnon.auth.getUser(token)
    if (authError || !user?.email) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const locale = typeof body.locale === 'string' && body.locale === 'en' ? 'en' : 'ko'
    const tourIds = Array.isArray(body.tourIds)
      ? body.tourIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
      : undefined

    const today = new Date()
    const dateTo = typeof body.dateTo === 'string' ? body.dateTo : today.toISOString().slice(0, 10)
    const dateFromDefault = new Date(today)
    dateFromDefault.setDate(dateFromDefault.getDate() - 14)
    const dateFrom =
      typeof body.dateFrom === 'string' ? body.dateFrom : dateFromDefault.toISOString().slice(0, 10)

    const sb = userClient(token)
    const email = normalizeEmail(user.email)

    const { data: teamRow, error: teamErr } = await sb
      .from('team')
      .select('position, is_active, email')
      .eq('email', email)
      .maybeSingle()

    if (teamErr || !canManageCompanySop(user.email, teamRow)) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    const result = await sendIncompleteTourChecklistReminders(admin, {
      dateFrom,
      dateTo,
      tourIds,
      locale,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[sop/remind-tour-checklists]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    )
  }
}
