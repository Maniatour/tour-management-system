import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { supabase as supabaseAnon } from '@/lib/supabase'
import { canManageCompanySop, normalizeEmail } from '@/lib/sopPermissions'
import { sendEmployeeContractPublishedStaffPush } from '@/lib/sendStaffSopPush'
import {
  parseSopDocumentJson,
  parseSopPlainTextToDocument,
  flattenSopDocumentToPlainText,
  isPublishableSopDocument,
  primaryDocumentTitle,
} from '@/types/sopStructure'

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
    const legacyTitle = typeof body.title === 'string' ? body.title.trim() : ''
    const legacyMd = typeof body.body_md === 'string' ? body.body_md : ''
    const locale = typeof body.locale === 'string' && body.locale === 'en' ? 'en' : 'ko'

    let structure = parseSopDocumentJson(body.body_structure)
    if (!structure && legacyMd.trim()) {
      structure = parseSopPlainTextToDocument(legacyMd)
    }
    if (!structure || !isPublishableSopDocument(structure)) {
      return NextResponse.json(
        { error: '계약서 구조(섹션·카테고리·내용)가 비어 있거나 올바르지 않습니다' },
        { status: 400 }
      )
    }

    const bodyMd = flattenSopDocumentToPlainText(structure, 'ko')
    const title = primaryDocumentTitle(structure).trim() || legacyTitle
    if (!title || !bodyMd.trim()) {
      return NextResponse.json({ error: '제목과 본문이 필요합니다' }, { status: 400 })
    }

    const sb = userClient(token)
    const email = normalizeEmail(user.email)

    const { data: teamRow, error: teamErr } = await sb
      .from('team')
      .select('position, is_active, email')
      .eq('email', email)
      .maybeSingle()

    if (teamErr) {
      console.error('Employee contract publish team lookup:', teamErr)
      return NextResponse.json({ error: '권한 확인에 실패했습니다' }, { status: 500 })
    }

    if (!canManageCompanySop(user.email, teamRow)) {
      return NextResponse.json({ error: '계약서를 게시할 권한이 없습니다' }, { status: 403 })
    }

    const { data: maxRow } = await sb
      .from('company_employee_contract_versions')
      .select('version_number')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (maxRow?.version_number ?? 0) + 1

    const { data: inserted, error: insErr } = await sb
      .from('company_employee_contract_versions')
      .insert({
        version_number: nextVersion,
        title,
        body_md: bodyMd,
        body_structure: JSON.parse(JSON.stringify(structure)) as Json,
        published_by: user.id,
      })
      .select('id, version_number, title')
      .single()

    if (insErr || !inserted) {
      console.error('Employee contract insert:', insErr)
      return NextResponse.json({ error: insErr?.message || '저장에 실패했습니다' }, { status: 500 })
    }

    const signPath = `/${locale}/employee-contract/sign?version=${inserted.id}`
    const admin = getSupabaseAdmin()
    const pushResult = await sendEmployeeContractPublishedStaffPush(admin, {
      versionId: inserted.id,
      title: inserted.title,
      signPath,
    })

    return NextResponse.json({
      version: inserted,
      push: pushResult,
    })
  } catch (e) {
    console.error('Employee contract publish:', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
