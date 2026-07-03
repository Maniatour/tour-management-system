import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { supabase as supabaseAnon } from '@/lib/supabase'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'
import { sendStructuredDocUnsignedReminderPush } from '@/lib/sendStaffSopPush'

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
    const docKind = body.docKind === 'employee_contract' ? 'employee_contract' : 'sop'
    const versionId = typeof body.versionId === 'string' ? body.versionId.trim() : ''
    const locale = typeof body.locale === 'string' && body.locale === 'en' ? 'en' : 'ko'

    if (!versionId) {
      return NextResponse.json({ error: 'versionId가 필요합니다' }, { status: 400 })
    }

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

    const versionTable = docKind === 'sop' ? 'company_sop_versions' : 'company_employee_contract_versions'
    const sigTable = docKind === 'sop' ? 'sop_signatures' : 'employee_contract_signatures'

    const { data: versionRow, error: versionErr } = await sb
      .from(versionTable)
      .select('id, title, version_number')
      .eq('id', versionId)
      .maybeSingle()

    if (versionErr || !versionRow) {
      return NextResponse.json({ error: '버전을 찾을 수 없습니다' }, { status: 404 })
    }

    const { data: teamRows, error: teamListErr } = await sb
      .from('team')
      .select('email')
      .eq('is_active', true)

    if (teamListErr) {
      return NextResponse.json({ error: teamListErr.message }, { status: 500 })
    }

    const { data: sigRows, error: sigErr } = await sb
      .from(sigTable)
      .select('signer_email')
      .eq('version_id', versionId)

    if (sigErr) {
      return NextResponse.json({ error: sigErr.message }, { status: 500 })
    }

    const signed = new Set((sigRows || []).map((s) => (s.signer_email || '').trim().toLowerCase()))
    const pendingEmails = (teamRows || [])
      .map((t) => (t.email || '').trim().toLowerCase())
      .filter((e) => e && !signed.has(e))

    if (pendingEmails.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        pendingCount: 0,
        noSubscriptions: 0,
        skippedNoVapid: false,
      })
    }

    const signPath =
      docKind === 'sop'
        ? `/${locale}/sop/sign?version=${versionId}`
        : `/${locale}/employee-contract/sign?version=${versionId}`

    const admin = getSupabaseAdmin()
    const pushResult = await sendStructuredDocUnsignedReminderPush(admin, {
      docKind,
      versionId,
      title: versionRow.title,
      signPath,
      targetEmailsLower: pendingEmails,
    })

    return NextResponse.json({
      ...pushResult,
      pendingCount: pendingEmails.length,
    })
  } catch (e) {
    console.error('remind-unsigned:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '리마인드 발송에 실패했습니다' },
      { status: 500 }
    )
  }
}
