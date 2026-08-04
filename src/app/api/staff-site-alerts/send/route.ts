import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import {
  canSendStaffSiteAlert,
  canUseSendAsJoeyShimOption,
  canUseSendAsJudyOption,
  parseStaffSiteAlertSenderProxy,
  staffSiteAlertDisplaySenderName,
  staffSiteAlertSentAsSuperFlag,
  STAFF_SITE_ALERT_PROXY_SENDERS,
  teamPositionMatchesTargetGroup,
  type StaffSiteAlertSendPayload,
  type StaffSiteAlertTargetGroup,
} from '@/lib/staffSiteAlert'
import { fetchAuthTeamMemberRow } from '@/lib/authTeamRoleLookup'
import { getUserRole } from '@/lib/roles'

const VALID_GROUPS = new Set<StaffSiteAlertTargetGroup>([
  'guide',
  'driver',
  'op',
  'office_manager',
  'office_staff',
])

export async function POST(request: NextRequest) {
  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse

  const {
    data: { user },
    error: userError,
  } = await clientOrResponse.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const teamMember = await fetchAuthTeamMemberRow(user.email.toLowerCase())
  const userRole = getUserRole(
    user.email,
    teamMember
      ? {
          ...(teamMember.position ? { position: teamMember.position } : {}),
          is_active: teamMember.is_active,
        }
      : undefined
  )
  const userPosition = teamMember?.position ?? null

  if (
    !canSendStaffSiteAlert({
      userRole,
      userPosition,
      authUserEmail: user.email,
    })
  ) {
    return NextResponse.json({ error: '발송 권한이 없습니다.' }, { status: 403 })
  }

  let body: StaffSiteAlertSendPayload
  try {
    body = (await request.json()) as StaffSiteAlertSendPayload
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const titleKo = (body.titleKo || '').trim()
  const titleEn = (body.titleEn || '').trim()
  const bodyKo = (body.bodyKo || '').trim()
  const bodyEn = (body.bodyEn || '').trim()
  const locale = typeof body.locale === 'string' ? body.locale : 'ko'
  const recipientMode = body.recipientMode === 'individual' ? 'individual' : 'group'
  const targetGroups = Array.isArray(body.targetGroups)
    ? body.targetGroups.filter((g): g is StaffSiteAlertTargetGroup => VALID_GROUPS.has(g as StaffSiteAlertTargetGroup))
    : []
  const targetIndividuals = Array.isArray(body.targetIndividuals)
    ? [
        ...new Set(
          body.targetIndividuals
            .map((email) => String(email ?? '').trim().toLowerCase())
            .filter(Boolean)
        ),
      ]
    : []
  const requiresSignature = Boolean(body.requiresSignature)
  const senderProxy = parseStaffSiteAlertSenderProxy(body)
  const linkedHubArticleIds = Array.isArray(body.linkedHubArticleIds)
    ? [...new Set(body.linkedHubArticleIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
    : []

  if (senderProxy === 'joey_shim' && !canUseSendAsJoeyShimOption({ userRole, userPosition, authUserEmail: user.email })) {
    return NextResponse.json({ error: 'Joey Shim 계정으로 발송할 권한이 없습니다.' }, { status: 403 })
  }
  if (senderProxy === 'judy' && !canUseSendAsJudyOption({ userRole, userPosition, authUserEmail: user.email })) {
    return NextResponse.json({ error: 'Judy 계정으로 발송할 권한이 없습니다.' }, { status: 403 })
  }

  if (!titleKo || !bodyKo) {
    return NextResponse.json({ error: '한글 제목과 내용을 입력해 주세요.' }, { status: 400 })
  }
  if (recipientMode === 'group' && targetGroups.length === 0) {
    return NextResponse.json({ error: '수신 대상 그룹을 하나 이상 선택해 주세요.' }, { status: 400 })
  }
  if (recipientMode === 'individual' && targetIndividuals.length === 0) {
    return NextResponse.json({ error: '수신 직원을 한 명 이상 선택해 주세요.' }, { status: 400 })
  }

  const db = supabaseAdmin ?? clientOrResponse

  const { data: teamRows, error: teamError } = await db
    .from('team')
    .select('email, name_ko, position, is_active')
    .eq('is_active', true)

  if (teamError) {
    console.error('[staff-site-alerts/send] team', teamError)
    return NextResponse.json({ error: '팀원 목록을 불러오지 못했습니다.' }, { status: 500 })
  }

  const recipients = (teamRows || []).filter((row) => {
    const email = (row.email || '').trim().toLowerCase()
    if (!email) return false
    if (recipientMode === 'individual') {
      return targetIndividuals.includes(email)
    }
    return targetGroups.some((group) => teamPositionMatchesTargetGroup(row.position, group))
  })

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          recipientMode === 'individual'
            ? '선택한 직원 중 활성 팀원이 없습니다.'
            : '선택한 그룹에 해당하는 활성 팀원이 없습니다.',
      },
      { status: 400 }
    )
  }

  const senderName =
    teamMember?.name_ko || (user.email || '').split('@')[0]
  const displaySenderName = staffSiteAlertDisplaySenderName(senderProxy, senderName, locale)

  if (senderProxy === 'judy') {
    const judyEmail = STAFF_SITE_ALERT_PROXY_SENDERS.judy.email.toLowerCase()
    const judyRow = (teamRows || []).find(
      (row) => (row.email || '').trim().toLowerCase() === judyEmail
    )
    if (!judyRow || !teamPositionMatchesTargetGroup(judyRow.position, 'office_manager')) {
      return NextResponse.json(
        { error: 'Judy(Office Manager) 팀원 정보를 확인할 수 없습니다.' },
        { status: 400 }
      )
    }
  }

  const { data: alert, error: alertError } = await db
    .from('staff_site_alerts')
    .insert({
      title_ko: titleKo,
      title_en: titleEn,
      body_ko: bodyKo,
      body_en: bodyEn,
      target_positions: recipientMode === 'group' ? targetGroups : [],
      target_individuals: recipientMode === 'individual' ? targetIndividuals : [],
      linked_hub_article_ids: linkedHubArticleIds,
      requires_signature: requiresSignature,
      sent_as_super: staffSiteAlertSentAsSuperFlag(senderProxy),
      sent_by_email: user.email.toLowerCase(),
      sent_by_name: senderName,
      display_sender_name: displaySenderName,
    })
    .select('id')
    .single()

  if (alertError || !alert) {
    console.error('[staff-site-alerts/send] alert', alertError)
    return NextResponse.json({ error: '알림 저장에 실패했습니다.' }, { status: 500 })
  }

  const recipientRows = recipients.map((row) => ({
    alert_id: alert.id,
    recipient_email: (row.email || '').trim().toLowerCase(),
    recipient_user_id: null,
    recipient_position: row.position ?? null,
  }))

  const { error: recipientError } = await db.from('staff_site_alert_recipients').insert(recipientRows)

  if (recipientError) {
    console.error('[staff-site-alerts/send] recipients', recipientError)
    await db.from('staff_site_alerts').delete().eq('id', alert.id)
    return NextResponse.json({ error: '수신자 등록에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    alertId: alert.id,
    recipientCount: recipientRows.length,
  })
}
