import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import { decryptCredentialSecret } from '@/lib/credentialVaultCrypto'
import {
  readRequestAuditMeta,
  resolveStaffCredentialVaultApiAuth,
} from '@/lib/staffCredentialVaultApiAuth'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await resolveStaffCredentialVaultApiAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params

  let action: 'reveal_password' | 'copy_password' = 'reveal_password'
  try {
    const body = (await request.json()) as { action?: string }
    if (body.action === 'copy_password') {
      action = 'copy_password'
    }
  } catch {
    /* default reveal */
  }

  const { data, error } = await fromUntypedTable(supabaseAdmin!, 'staff_credential_vault')
    .select('id, password_ciphertext, is_archived')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[staff-credential-vault/reveal] fetch', error)
    return NextResponse.json({ error: '비밀번호를 불러오지 못했습니다.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (data.is_archived) {
    return NextResponse.json({ error: '보관된 항목입니다.' }, { status: 400 })
  }

  let password: string
  try {
    password = decryptCredentialSecret(data.password_ciphertext)
  } catch (e) {
    console.error('[staff-credential-vault/reveal] decrypt', e)
    return NextResponse.json(
      { error: '비밀번호 복호화에 실패했습니다. 암호화 키를 확인하세요.' },
      { status: 500 }
    )
  }

  const { ipAddress, userAgent } = readRequestAuditMeta(request)
  const { error: logError } = await fromUntypedTable(
    supabaseAdmin!,
    'staff_credential_vault_access_logs'
  ).insert({
      credential_id: id,
      accessor_email: auth.ctx.userEmail,
      accessor_name: auth.ctx.userName,
      accessor_position: auth.ctx.userPosition,
      action,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

  if (logError) {
    console.error('[staff-credential-vault/reveal] audit log', logError)
  }

  return NextResponse.json({ password })
}
