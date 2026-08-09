/** 팀원 간 팀 조합: 절대 금지 / 기피 */

import { supabase } from '@/lib/supabase'

export type TeamPairRestrictionLevel = 'never' | 'avoid' | null

export type TeamDoNotTeamMember = {
  email: string
  name_ko?: string | null
  nick_name?: string | null
  name_en?: string | null
  /** 절대 팀 금지 */
  do_not_team_with?: string[] | null
  /** 기피 (경고) */
  avoid_team_with?: string[] | null
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email || '')
    .trim()
    .toLowerCase()
}

export function normalizeTeamEmailList(list: string[] | null | undefined): string[] {
  return Array.from(new Set((list || []).map(normalizeEmail).filter(Boolean)))
}

/** @deprecated use normalizeTeamEmailList */
export const normalizeDoNotTeamWithList = normalizeTeamEmailList

function memberDisplayName(m: TeamDoNotTeamMember | undefined, fallbackEmail: string): string {
  if (!m) return fallbackEmail
  const nick = (m.nick_name || '').trim()
  if (nick) return nick
  const ko = (m.name_ko || '').trim()
  if (ko) return ko
  const en = (m.name_en || '').trim()
  if (en) return en
  return fallbackEmail
}

function findMember(
  members: TeamDoNotTeamMember[],
  email: string,
): TeamDoNotTeamMember | undefined {
  return members.find((m) => normalizeEmail(m.email) === email)
}

function listHas(list: string[] | null | undefined, email: string): boolean {
  return normalizeTeamEmailList(list).includes(email)
}

/** never > avoid > null (양방향 중 더 강한 쪽) */
export function getTeamPairRestriction(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
  members: TeamDoNotTeamMember[],
): TeamPairRestrictionLevel {
  const a = normalizeEmail(emailA)
  const b = normalizeEmail(emailB)
  if (!a || !b || a === b) return null
  const memberA = findMember(members, a)
  const memberB = findMember(members, b)
  const never =
    listHas(memberA?.do_not_team_with, b) || listHas(memberB?.do_not_team_with, a)
  if (never) return 'never'
  const avoid =
    listHas(memberA?.avoid_team_with, b) || listHas(memberB?.avoid_team_with, a)
  if (avoid) return 'avoid'
  return null
}

export function getNeverTeamPairMessage(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
  members: TeamDoNotTeamMember[],
  locale: string = 'ko',
): string | null {
  if (getTeamPairRestriction(emailA, emailB, members) !== 'never') return null
  const a = normalizeEmail(emailA)
  const b = normalizeEmail(emailB)
  const nameA = memberDisplayName(findMember(members, a), a)
  const nameB = memberDisplayName(findMember(members, b), b)
  if (locale === 'ko') {
    return `${nameA}와(과) ${nameB}는 같이 팀을 꾸릴 수 없습니다.\n(절대 팀 금지)`
  }
  return `${nameA} and ${nameB} cannot be assigned to the same team.\n(Hard restriction)`
}

export function getAvoidTeamPairMessage(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
  members: TeamDoNotTeamMember[],
  locale: string = 'ko',
): string | null {
  if (getTeamPairRestriction(emailA, emailB, members) !== 'avoid') return null
  const a = normalizeEmail(emailA)
  const b = normalizeEmail(emailB)
  const nameA = memberDisplayName(findMember(members, a), a)
  const nameB = memberDisplayName(findMember(members, b), b)
  if (locale === 'ko') {
    return `${nameA}와(과) ${nameB}는 팀 배정을 기피하도록 설정되어 있습니다.\n그래도 배정하시겠습니까?`
  }
  return `${nameA} and ${nameB} prefer not to work on the same team.\nAssign them together anyway?`
}

/**
 * 팀 배정 가드.
 * - 절대 금지: alert 후 false
 * - 기피: confirm, 취소 시 false
 * - 제한 없음: true
 */
export function allowTeamPairAssignment(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
  members: TeamDoNotTeamMember[],
  locale: string = 'ko',
): boolean {
  const level = getTeamPairRestriction(emailA, emailB, members)
  if (!level) return true
  if (typeof window === 'undefined') return level !== 'never'
  if (level === 'never') {
    const msg = getNeverTeamPairMessage(emailA, emailB, members, locale)
    if (msg) window.alert(msg)
    return false
  }
  const msg = getAvoidTeamPairMessage(emailA, emailB, members, locale)
  if (!msg) return true
  return window.confirm(msg)
}

/** @deprecated use allowTeamPairAssignment */
export const confirmDoNotTeamAssignment = allowTeamPairAssignment

export type DoNotTeamPeerUpdate = {
  email: string
  do_not_team_with: string[]
  avoid_team_with: string[]
}

function ensureExclusiveLists(neverList: string[], avoidList: string[]): {
  never: string[]
  avoid: string[]
} {
  const never = normalizeTeamEmailList(neverList)
  const neverSet = new Set(never)
  const avoid = normalizeTeamEmailList(avoidList).filter((e) => !neverSet.has(e))
  return { never, avoid }
}

/**
 * self의 never/avoid 변경을 상대방에도 반영.
 * 상대 쪽에서도 never/avoid는 상호 배타 (절대가 우선).
 */
export async function syncDoNotTeamWithPeers(params: {
  selfEmail: string
  previousNeverList: string[] | null | undefined
  nextNeverList: string[] | null | undefined
  previousAvoidList: string[] | null | undefined
  nextAvoidList: string[] | null | undefined
}): Promise<{ error: string | null; peerUpdates: DoNotTeamPeerUpdate[] }> {
  const self = normalizeEmail(params.selfEmail)
  if (!self) return { error: null, peerUpdates: [] }

  const prevNever = new Set(normalizeTeamEmailList(params.previousNeverList))
  const nextNever = new Set(normalizeTeamEmailList(params.nextNeverList))
  const prevAvoid = new Set(normalizeTeamEmailList(params.previousAvoidList))
  const nextAvoid = new Set(normalizeTeamEmailList(params.nextAvoidList))
  prevNever.delete(self)
  nextNever.delete(self)
  prevAvoid.delete(self)
  nextAvoid.delete(self)

  const affected = new Set<string>([
    ...prevNever,
    ...nextNever,
    ...prevAvoid,
    ...nextAvoid,
  ])
  if (affected.size === 0) return { error: null, peerUpdates: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('team')
    .select('email, do_not_team_with, avoid_team_with')

  if (error) {
    return { error: error.message || 'peer sync failed', peerUpdates: [] }
  }

  const peerUpdates: DoNotTeamPeerUpdate[] = []
  for (const row of (data || []) as Array<{
    email: string
    do_not_team_with: string[] | null
    avoid_team_with: string[] | null
  }>) {
    const emailNorm = normalizeEmail(row.email)
    if (!affected.has(emailNorm) || emailNorm === self) continue

    const neverSet = new Set(normalizeTeamEmailList(row.do_not_team_with))
    const avoidSet = new Set(normalizeTeamEmailList(row.avoid_team_with))

    // 절대 금지
    if (nextNever.has(emailNorm)) {
      neverSet.add(self)
      avoidSet.delete(self)
    } else if (prevNever.has(emailNorm) && !nextNever.has(emailNorm)) {
      neverSet.delete(self)
    }

    // 기피 (절대에 있으면 기피 추가하지 않음)
    if (nextAvoid.has(emailNorm) && !nextNever.has(emailNorm)) {
      if (!neverSet.has(self)) avoidSet.add(self)
    } else if (prevAvoid.has(emailNorm) && !nextAvoid.has(emailNorm)) {
      avoidSet.delete(self)
    }

    // 절대에 있으면 기피에서 제거
    if (neverSet.has(self)) avoidSet.delete(self)

    const updatedNever = Array.from(neverSet)
    const updatedAvoid = Array.from(avoidSet)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('team')
      .update({
        do_not_team_with: updatedNever,
        avoid_team_with: updatedAvoid,
      })
      .eq('email', row.email)

    if (updateError) {
      return {
        error: updateError.message || 'peer sync update failed',
        peerUpdates,
      }
    }
    peerUpdates.push({
      email: row.email,
      do_not_team_with: updatedNever,
      avoid_team_with: updatedAvoid,
    })
  }

  return { error: null, peerUpdates }
}

export { ensureExclusiveLists }
