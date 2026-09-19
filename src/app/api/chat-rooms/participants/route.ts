import { NextRequest, NextResponse } from 'next/server'
import { resolveGuideApiAuth } from '@/lib/guideApiAuth'
import { getSupabaseForApiRoute } from '@/lib/api-route-supabase'
import { supabaseAdmin } from '@/lib/supabase'
import {
  assignedTourStaffEmails,
  canRemoveTourChatGuide,
  isGuideOrDriverTeamPosition,
  normalizeStaffEmail,
} from '@/lib/tourChatGuideMembers'

type ChatParticipantGuideRow = {
  id: string
  room_id: string
  participant_id: string
  participant_name: string
  participant_type: string
  is_active: boolean | null
  membership_source: string | null
  joined_at: string | null
}

type TeamMemberRow = {
  email: string
  name_ko: string | null
  name_en: string | null
  nick_name: string | null
  position: string | null
  is_active: boolean | null
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function displayTeamName(member: TeamMemberRow | undefined, email: string): string {
  return (
    member?.name_ko?.trim() ||
    member?.name_en?.trim() ||
    member?.nick_name?.trim() ||
    email
  )
}

async function getDb(request: NextRequest) {
  const clientOrResponse = await getSupabaseForApiRoute(request)
  if (clientOrResponse instanceof NextResponse) return clientOrResponse
  return supabaseAdmin ?? clientOrResponse
}

async function loadRoom(db: Exclude<Awaited<ReturnType<typeof getDb>>, NextResponse>, roomId: string) {
  const { data, error } = await db
    .from('chat_rooms')
    .select('id, tour_id')
    .eq('id', roomId)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; tour_id: string } | null
}

async function loadAssignedEmails(
  db: Exclude<Awaited<ReturnType<typeof getDb>>, NextResponse>,
  tourId: string
): Promise<string[]> {
  const { data, error } = await db
    .from('tours')
    .select('tour_guide_id, assistant_id')
    .eq('id', tourId)
    .maybeSingle()
  if (error) throw error
  const row = data as { tour_guide_id: string | null; assistant_id: string | null } | null
  return assignedTourStaffEmails(row?.tour_guide_id, row?.assistant_id)
}

async function loadGuideParticipants(
  db: Exclude<Awaited<ReturnType<typeof getDb>>, NextResponse>,
  roomId: string
): Promise<ChatParticipantGuideRow[]> {
  const { data, error } = await db
    .from('chat_participants')
    .select('id, room_id, participant_id, participant_name, participant_type, is_active, membership_source, joined_at')
    .eq('room_id', roomId)
    .eq('participant_type', 'guide')
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data || []) as ChatParticipantGuideRow[]
}

async function loadTeamByEmails(
  db: Exclude<Awaited<ReturnType<typeof getDb>>, NextResponse>,
  emails: string[]
): Promise<Map<string, TeamMemberRow>> {
  const unique = [...new Set(emails.map((email) => email.trim()).filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data, error } = await db
    .from('team')
    .select('email, name_ko, name_en, nick_name, position, is_active')
    .in('email', unique)
  if (error) throw error
  const map = new Map<string, TeamMemberRow>()
  for (const row of (data || []) as TeamMemberRow[]) {
    map.set(normalizeStaffEmail(row.email), row)
  }
  return map
}

async function syncAssignedGuides(
  db: Exclude<Awaited<ReturnType<typeof getDb>>, NextResponse>,
  tourId: string
) {
  const { error } = await db.rpc('sync_tour_chat_guide_participants', {
    p_tour_id: tourId,
  })
  if (error) throw error
}

/**
 * GET /api/chat-rooms/participants?room_id=
 * 투어 채팅 가이드 멤버 + 초대 후보
 */
export async function GET(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const roomId = request.nextUrl.searchParams.get('room_id')?.trim()
  if (!roomId) return jsonError('채팅방 ID가 필요합니다.', 400)

  const dbOrResponse = await getDb(request)
  if (dbOrResponse instanceof NextResponse) return dbOrResponse
  const db = dbOrResponse

  try {
    const room = await loadRoom(db, roomId)
    if (!room) return jsonError('채팅방을 찾을 수 없습니다.', 404)

    await syncAssignedGuides(db, room.tour_id)

    const [participants, assignedEmails, teamRows] = await Promise.all([
      loadGuideParticipants(db, roomId),
      loadAssignedEmails(db, room.tour_id),
      db
        .from('team')
        .select('email, name_ko, name_en, nick_name, position, is_active')
        .eq('is_active', true)
        .order('name_ko', { ascending: true }),
    ])

    if (teamRows.error) throw teamRows.error

    const teamMembers = (teamRows.data || []) as TeamMemberRow[]
    const teamByEmail = new Map(teamMembers.map((row) => [normalizeStaffEmail(row.email), row]))

    const activeGuides = participants
      .filter((row) => row.is_active !== false)
      .map((row) => {
        const email = row.participant_id
        const team = teamByEmail.get(normalizeStaffEmail(email))
        const membershipSource = row.membership_source === 'invited' ? 'invited' : 'assignment'
        return {
          id: row.id,
          email,
          name: displayTeamName(team, row.participant_name || email),
          position: team?.position ?? null,
          membership_source: membershipSource,
          assigned: assignedEmails.includes(normalizeStaffEmail(email)),
          can_remove: canRemoveTourChatGuide({
            participantEmail: email,
            membershipSource,
            assignedEmails,
          }),
        }
      })

    const activeEmailSet = new Set(activeGuides.map((row) => normalizeStaffEmail(row.email)))
    const inviteCandidates = teamMembers.map((member) => ({
      email: member.email,
      name: displayTeamName(member, member.email),
      position: member.position,
      is_guide_or_driver: isGuideOrDriverTeamPosition(member.position),
      already_member: activeEmailSet.has(normalizeStaffEmail(member.email)),
    }))

    return NextResponse.json({
      room_id: room.id,
      tour_id: room.tour_id,
      assigned_emails: assignedEmails,
      participants: activeGuides,
      invite_candidates: inviteCandidates,
    })
  } catch (error) {
    console.error('[api/chat-rooms/participants GET]', error)
    const message = error instanceof Error ? error.message : 'participants_load_failed'
    return jsonError(message, 500)
  }
}

/**
 * POST /api/chat-rooms/participants
 * body: { room_id, action: 'sync' | 'invite', emails?: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const dbOrResponse = await getDb(request)
  if (dbOrResponse instanceof NextResponse) return dbOrResponse
  const db = dbOrResponse

  try {
    const body = (await request.json()) as {
      room_id?: string
      action?: string
      emails?: string[]
    }
    const roomId = String(body.room_id ?? '').trim()
    const action = String(body.action ?? '').trim()
    if (!roomId) return jsonError('채팅방 ID가 필요합니다.', 400)

    const room = await loadRoom(db, roomId)
    if (!room) return jsonError('채팅방을 찾을 수 없습니다.', 404)

    if (action === 'sync') {
      await syncAssignedGuides(db, room.tour_id)
      return NextResponse.json({ ok: true, room_id: room.id, tour_id: room.tour_id })
    }

    if (action !== 'invite') {
      return jsonError('지원하지 않는 동작입니다.', 400)
    }

    const rawEmails = Array.isArray(body.emails)
      ? body.emails.map((email) => String(email).trim()).filter(Boolean)
      : []
    const emails = [...new Set(rawEmails.map(normalizeStaffEmail))]
    if (emails.length === 0) return jsonError('초대할 이메일이 필요합니다.', 400)

    const teamMap = await loadTeamByEmails(db, rawEmails)
    const existing = await loadGuideParticipants(db, roomId)
    const existingByEmail = new Map(
      existing.map((row) => [normalizeStaffEmail(row.participant_id), row])
    )

    for (const email of emails) {
      const team = teamMap.get(email)
      const name = displayTeamName(team, team?.email || email)
      const canonicalEmail = team?.email || email
      const current = existingByEmail.get(email)
      if (current) {
        const { error } = await db
          .from('chat_participants')
          .update({
            is_active: true,
            membership_source: 'invited',
            participant_id: canonicalEmail,
            participant_name: name,
          } as never)
          .eq('id', current.id)
        if (error) throw error
      } else {
        const { error } = await db.from('chat_participants').insert({
          room_id: roomId,
          participant_type: 'guide',
          participant_id: canonicalEmail,
          participant_name: name,
          is_active: true,
          membership_source: 'invited',
        } as never)
        if (error) throw error
      }
    }

    return NextResponse.json({ ok: true, invited: emails.length })
  } catch (error) {
    console.error('[api/chat-rooms/participants POST]', error)
    const message = error instanceof Error ? error.message : 'participants_update_failed'
    return jsonError(message, 500)
  }
}

/**
 * DELETE /api/chat-rooms/participants?room_id=&email=
 */
export async function DELETE(request: NextRequest) {
  const auth = await resolveGuideApiAuth(request)
  if (!auth.ok) return auth.response

  const roomId = request.nextUrl.searchParams.get('room_id')?.trim()
  const email = normalizeStaffEmail(request.nextUrl.searchParams.get('email'))
  if (!roomId || !email) return jsonError('채팅방 ID와 이메일이 필요합니다.', 400)

  const dbOrResponse = await getDb(request)
  if (dbOrResponse instanceof NextResponse) return dbOrResponse
  const db = dbOrResponse

  try {
    const room = await loadRoom(db, roomId)
    if (!room) return jsonError('채팅방을 찾을 수 없습니다.', 404)

    await syncAssignedGuides(db, room.tour_id)

    const [assignedEmails, participants] = await Promise.all([
      loadAssignedEmails(db, room.tour_id),
      loadGuideParticipants(db, roomId),
    ])
    const target = participants.find(
      (row) => normalizeStaffEmail(row.participant_id) === email && row.is_active !== false
    )
    if (!target) return jsonError('참여자를 찾을 수 없습니다.', 404)

    if (
      !canRemoveTourChatGuide({
        participantEmail: target.participant_id,
        membershipSource: target.membership_source,
        assignedEmails,
      })
    ) {
      return NextResponse.json(
        {
          error: 'assigned_guide',
          message: '현재 배정된 가이드는 내보낼 수 없습니다. 투어 배정을 변경해 주세요.',
        },
        { status: 409 }
      )
    }

    const { error } = await db
      .from('chat_participants')
      .update({ is_active: false } as never)
      .eq('id', target.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[api/chat-rooms/participants DELETE]', error)
    const message = error instanceof Error ? error.message : 'participants_remove_failed'
    return jsonError(message, 500)
  }
}
