import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import {
  encryptCredentialSecret,
  isCredentialVaultEncryptionConfigured,
} from '@/lib/credentialVaultCrypto'
import {
  parseStaffCredentialVaultCategory,
  type StaffCredentialVaultListItem,
} from '@/lib/staffCredentialVault'
import {
  readRequestAuditMeta,
  resolveStaffCredentialVaultApiAuth,
  type StaffCredentialVaultApiContext,
} from '@/lib/staffCredentialVaultApiAuth'

async function insertVaultAccessLog(
  ctx: StaffCredentialVaultApiContext,
  request: NextRequest,
  credentialId: string,
  action:
    | 'reveal_password'
    | 'copy_password'
    | 'create'
    | 'update'
    | 'delete'
    | 'archive'
    | 'restore'
) {
  const { ipAddress, userAgent } = readRequestAuditMeta(request)
  await fromUntypedTable(supabaseAdmin!, 'staff_credential_vault_access_logs').insert({
    credential_id: credentialId,
    accessor_email: ctx.userEmail,
    accessor_name: ctx.userName,
    accessor_position: ctx.userPosition,
    action,
    ip_address: ipAddress,
    user_agent: userAgent,
  })
}

function toListItem(row: Record<string, unknown>): StaffCredentialVaultListItem {
  return {
    id: String(row.id),
    site_name: String(row.site_name),
    site_url: row.site_url ? String(row.site_url) : null,
    category: row.category as StaffCredentialVaultListItem['category'],
    login_id: String(row.login_id),
    notes: row.notes ? String(row.notes) : null,
    created_by_email: String(row.created_by_email),
    created_by_name: row.created_by_name ? String(row.created_by_name) : null,
    updated_by_email: row.updated_by_email ? String(row.updated_by_email) : null,
    updated_by_name: row.updated_by_name ? String(row.updated_by_name) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    is_archived: Boolean(row.is_archived),
    has_password: Boolean(row.password_ciphertext),
  }
}

export async function GET(request: NextRequest) {
  const auth = await resolveStaffCredentialVaultApiAuth(request)
  if (!auth.ok) return auth.response

  const includeArchived = request.nextUrl.searchParams.get('archived') === '1'
  const category = parseStaffCredentialVaultCategory(
    request.nextUrl.searchParams.get('category')
  )

  let query = fromUntypedTable(supabaseAdmin!, 'staff_credential_vault')
    .select(
      'id, site_name, site_url, category, login_id, notes, created_by_email, created_by_name, updated_by_email, updated_by_name, created_at, updated_at, is_archived, password_ciphertext'
    )
    .order('site_name', { ascending: true })

  if (!includeArchived) {
    query = query.eq('is_archived', false)
  }
  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) {
    console.error('[staff-credential-vault] list', error)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    items: (data || []).map((row) => toListItem(row as Record<string, unknown>)),
  })
}

export async function POST(request: NextRequest) {
  const auth = await resolveStaffCredentialVaultApiAuth(request)
  if (!auth.ok) return auth.response

  if (!isCredentialVaultEncryptionConfigured()) {
    return NextResponse.json(
      {
        error:
          '암호화 키(CREDENTIAL_VAULT_ENCRYPTION_KEY)가 설정되지 않았습니다. 서버 관리자에게 문의하세요.',
      },
      { status: 503 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const siteName = String(body.siteName ?? '').trim()
  const siteUrl = String(body.siteUrl ?? '').trim()
  const loginId = String(body.loginId ?? '').trim()
  const password = String(body.password ?? '')
  const notes = String(body.notes ?? '').trim()
  const category = parseStaffCredentialVaultCategory(body.category) ?? 'other'

  if (!siteName || !loginId || !password) {
    return NextResponse.json(
      { error: '사이트명, 로그인 ID, 비밀번호를 모두 입력해 주세요.' },
      { status: 400 }
    )
  }

  let passwordCiphertext: string
  try {
    passwordCiphertext = encryptCredentialSecret(password)
  } catch (e) {
    console.error('[staff-credential-vault] encrypt', e)
    return NextResponse.json({ error: '비밀번호 암호화에 실패했습니다.' }, { status: 500 })
  }

  const { data, error } = await fromUntypedTable(supabaseAdmin!, 'staff_credential_vault')
    .insert({
      site_name: siteName,
      site_url: siteUrl || null,
      category,
      login_id: loginId,
      password_ciphertext: passwordCiphertext,
      notes: notes || null,
      created_by_email: auth.ctx.userEmail,
      created_by_name: auth.ctx.userName,
      updated_by_email: auth.ctx.userEmail,
      updated_by_name: auth.ctx.userName,
    })
    .select(
      'id, site_name, site_url, category, login_id, notes, created_by_email, created_by_name, updated_by_email, updated_by_name, created_at, updated_at, is_archived, password_ciphertext'
    )
    .single()

  if (error || !data) {
    console.error('[staff-credential-vault] create', error)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }

  await insertVaultAccessLog(auth.ctx, request, data.id, 'create')

  return NextResponse.json({ item: toListItem(data as Record<string, unknown>) })
}
