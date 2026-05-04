import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { supabase as supabaseAnon } from '@/lib/supabase'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'
import { isPublishableSopDocument, parseSopDocumentJson, sopDocumentToJson } from '@/types/sopStructure'

function getSupabaseUser(token: string) {
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
    const docKind = body.doc_kind === 'employee_contract' ? 'employee_contract' : 'sop'
    const emailsIn = Array.isArray(body.recipient_emails) ? body.recipient_emails : []
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    const structure = parseSopDocumentJson(body.body_structure)
    if (!structure || !isPublishableSopDocument(structure)) {
      return NextResponse.json({ error: '문서 구조가 비어 있거나 올바르지 않습니다' }, { status: 400 })
    }

    const emails = [...new Set(emailsIn.map((e: unknown) => normalizeEmail(String(e || ''))))].filter(Boolean)
    if (emails.length === 0) {
      return NextResponse.json({ error: '수신할 팀원 이메일을 한 명 이상 선택하세요' }, { status: 400 })
    }

    const sb = getSupabaseUser(token)
    const email = normalizeEmail(user.email)

    const { data: teamRow, error: teamErr } = await sb
      .from('team')
      .select('position, is_active, email')
      .eq('email', email)
      .maybeSingle()

    if (teamErr) {
      console.error('sign-campaign team lookup:', teamErr)
      return NextResponse.json({ error: '권한 확인에 실패했습니다' }, { status: 500 })
    }

    if (!canManageCompanySop(user.email, teamRow)) {
      return NextResponse.json({ error: '발송 권한이 없습니다' }, { status: 403 })
    }

    const { data: campaign, error: cErr } = await sb
      .from('company_structured_doc_sign_campaigns')
      .insert({
        doc_kind: docKind,
        body_structure: sopDocumentToJson(structure) as Json,
        title: title || (docKind === 'sop' ? 'SOP 확인·서명 요청' : '직원 계약서 확인·서명 요청'),
        note,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (cErr || !campaign?.id) {
      console.error('sign-campaign insert:', cErr)
      return NextResponse.json({ error: cErr?.message || '캠페인 생성에 실패했습니다' }, { status: 500 })
    }

    const rows = emails.map((recipient_email) => ({
      campaign_id: campaign.id,
      recipient_email,
      status: 'pending' as const,
    }))

    const { error: rErr } = await sb.from('company_structured_doc_sign_campaign_recipients').insert(rows)
    if (rErr) {
      console.error('sign-campaign recipients:', rErr)
      await sb.from('company_structured_doc_sign_campaigns').delete().eq('id', campaign.id)
      return NextResponse.json({ error: rErr.message || '수신자 저장에 실패했습니다' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, campaign_id: campaign.id, recipient_count: emails.length })
  } catch (e) {
    console.error('sign-campaign:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : '서버 오류' }, { status: 500 })
  }
}
