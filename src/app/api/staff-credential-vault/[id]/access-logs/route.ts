import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { fromUntypedTable } from '@/lib/supabaseUntypedTable'
import type { StaffCredentialVaultAccessLogRow } from '@/lib/staffCredentialVault'
import { resolveStaffCredentialVaultApiAuth } from '@/lib/staffCredentialVaultApiAuth'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await resolveStaffCredentialVaultApiAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await context.params
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 200)
    : 50

  const { data: credential, error: credentialError } = await fromUntypedTable(
    supabaseAdmin!,
    'staff_credential_vault'
  )
    .select('id, site_name')
    .eq('id', id)
    .maybeSingle()

  if (credentialError) {
    console.error('[staff-credential-vault/access-logs] credential', credentialError)
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 500 })
  }
  if (!credential) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
  }

  const { data, error } = await fromUntypedTable(supabaseAdmin!, 'staff_credential_vault_access_logs')
    .select(
      'id, credential_id, accessor_email, accessor_name, accessor_position, action, accessed_at, ip_address, user_agent'
    )
    .eq('credential_id', id)
    .order('accessed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[staff-credential-vault/access-logs] list', error)
    return NextResponse.json({ error: '열람 기록을 불러오지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    siteName: credential.site_name,
    logs: (data || []) as StaffCredentialVaultAccessLogRow[],
  })
}
