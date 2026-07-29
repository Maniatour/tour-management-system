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

type RouteContext = { params: Promise<{ id: string }> }

async function insertVaultAccessLog(
  ctx: StaffCredentialVaultApiContext,
  request: NextRequest,
  credentialId: string,
  action: 'update' | 'delete' | 'archive' | 'restore'
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await resolveStaffCredentialVaultApiAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {
    updated_by_email: auth.ctx.userEmail,
    updated_by_name: auth.ctx.userName,
  }

  if (body.siteName !== undefined) {
    const siteName = String(body.siteName).trim()
    if (!siteName) {
      return NextResponse.json({ error: '사이트명을 입력해 주세요.' }, { status: 400 })
    }
    updates.site_name = siteName
  }
  if (body.siteUrl !== undefined) {
    updates.site_url = String(body.siteUrl).trim() || null
  }
  if (body.loginId !== undefined) {
    const loginId = String(body.loginId).trim()
    if (!loginId) {
      return NextResponse.json({ error: '로그인 ID를 입력해 주세요.' }, { status: 400 })
    }
    updates.login_id = loginId
  }
  if (body.notes !== undefined) {
    updates.notes = String(body.notes).trim() || null
  }
  if (body.category !== undefined) {
    const category = parseStaffCredentialVaultCategory(body.category)
    if (!category) {
      return NextResponse.json({ error: '유효하지 않은 카테고리입니다.' }, { status: 400 })
    }
    updates.category = category
  }
  if (body.isArchived !== undefined) {
    updates.is_archived = Boolean(body.isArchived)
  }
  if (body.password !== undefined && String(body.password).length > 0) {
    if (!isCredentialVaultEncryptionConfigured()) {
      return NextResponse.json(
        { error: '암호화 키가 설정되지 않았습니다.' },
        { status: 503 }
      )
    }
    try {
      updates.password_ciphertext = encryptCredentialSecret(String(body.password))
    } catch (e) {
      console.error('[staff-credential-vault] encrypt update', e)
      return NextResponse.json({ error: '비밀번호 암호화에 실패했습니다.' }, { status: 500 })
    }
  }

  const { data, error } = await fromUntypedTable(supabaseAdmin!, 'staff_credential_vault')
    .update(updates)
    .eq('id', id)
    .select(
      'id, site_name, site_url, category, login_id, notes, created_by_email, created_by_name, updated_by_email, updated_by_name, created_at, updated_at, is_archived, password_ciphertext'
    )
    .maybeSingle()

  if (error) {
    console.error('[staff-credential-vault] update', error)
    return NextResponse.json({ error: '수정에 실패했습니다.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
  }

  const action =
    body.isArchived === true ? 'archive' : body.isArchived === false ? 'restore' : 'update'
  await insertVaultAccessLog(auth.ctx, request, id, action)

  return NextResponse.json({ item: toListItem(data as Record<string, unknown>) })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await resolveStaffCredentialVaultApiAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  const { data: existing, error: fetchError } = await fromUntypedTable(
    supabaseAdmin!,
    'staff_credential_vault'
  )
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[staff-credential-vault] delete fetch', fetchError)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
  }

  await insertVaultAccessLog(auth.ctx, request, id, 'delete')

  const { error } = await fromUntypedTable(supabaseAdmin!, 'staff_credential_vault').delete().eq('id', id)
  if (error) {
    console.error('[staff-credential-vault] delete', error)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
