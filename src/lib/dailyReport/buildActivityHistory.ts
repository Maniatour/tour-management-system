import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  fetchActivityDigestInRange,
  isSystemActorEmail,
  type AwayChangeItem,
} from '@/lib/awayChangeDigest'
import { toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import type {
  DailyReportActivityHistory,
  DailyReportActivityHistoryGroup,
  DailyReportActivityHistoryItem,
} from '@/lib/dailyReport/types'

function formatShortTourDate(raw: string): string {
  const s = raw.trim()
  const ymd = s.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/)
  if (ymd) {
    return `${Number(ymd[2])}/${Number(ymd[3])}/${ymd[1].slice(2)}`
  }
  return s
}

function categoryLabel(item: AwayChangeItem, isKo: boolean): string {
  if (item.labelKey === 'reservation') return isKo ? '예약' : 'Res'
  if (item.labelKey === 'tour') return isKo ? '투어' : 'Tour'
  if (item.labelKey === 'ticketBooking') return isKo ? '입장권' : 'Ticket'
  if (item.labelKey === 'hotelBooking') return isKo ? '호텔' : 'Hotel'
  return isKo ? '활동' : 'Activity'
}

function actionLabel(action: string, isKo: boolean): string {
  const kind = actionKindFromAction(action)
  if (kind === 'add') return isKo ? '추가' : 'Add'
  if (kind === 'delete') return isKo ? '삭제' : 'Delete'
  return isKo ? '수정' : 'Edit'
}

function actionKindFromAction(action: string): 'add' | 'edit' | 'delete' {
  const a = (action || '').trim().toUpperCase()
  if (a === 'INSERT' || a === 'CREATED' || a === 'CREATE') return 'add'
  if (a === 'DELETE' || a === 'DELETED' || a === 'REMOVED') return 'delete'
  return 'edit'
}

function reservationContext(item: AwayChangeItem, isKo: boolean): {
  customer: string
  tourLine: string
} {
  const subtitle = (item.headerSubtitle || '').trim()
  const parts = subtitle.split('·').map((p) => p.trim()).filter(Boolean)
  const customer = parts[0] || (isKo ? '고객' : 'Customer')
  const peopleRaw = parts[1] || ''
  const people = peopleRaw.replace(/^예약\s*/, '').trim()

  let title = (item.headerTitle || '')
    .replace(/\s*투어$/u, '')
    .replace(/\s*tour$/iu, '')
    .trim()

  // "2026.08.19 상품" or "08/19/2026 상품" → "8/19/26 상품"
  const titleMatch = title.match(/^(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.*)$/)
  if (titleMatch) {
    title = `${formatShortTourDate(titleMatch[1])} ${titleMatch[2]}`.trim()
  }

  const tourLine = [title, people].filter(Boolean).join(' ')
  return { customer, tourLine }
}

function statusDiffBracket(item: AwayChangeItem): string | null {
  const line = item.diffLines.find((d) => {
    const l = (d.label || '').toLowerCase()
    return l.includes('상태') || l.includes('status')
  })
  if (!line) return null
  if (!line.beforeText || !line.afterText) return null
  if (line.beforeText === line.afterText) return null
  return `[${line.beforeText}] > [${line.afterText}]`
}

function isTourLinkDiff(label: string): boolean {
  const l = (label || '').toLowerCase()
  return l.includes('연결 투어') || l.includes('linked tour') || l === 'tour_id'
}

function isEmptyDiffValue(v: string | null | undefined): boolean {
  const s = (v || '').trim()
  return !s || s === '—'
}

/** 투어 연결/해제 뱃지 */
function tourLinkBadges(item: AwayChangeItem, isKo: boolean): string[] {
  if (item.labelKey !== 'reservation') return []
  const line = item.diffLines.find((d) => isTourLinkDiff(d.label))
  if (!line) return []
  const beforeEmpty = isEmptyDiffValue(line.beforeText)
  const afterEmpty = isEmptyDiffValue(line.afterText)
  if (beforeEmpty && !afterEmpty) {
    return [isKo ? '투어 연결됨' : 'Tour linked']
  }
  if (!beforeEmpty && afterEmpty) {
    return [isKo ? '투어 연결 해제' : 'Tour unlinked']
  }
  if (!beforeEmpty && !afterEmpty && line.beforeText !== line.afterText) {
    return [isKo ? '투어 변경' : 'Tour changed']
  }
  return []
}

function causeBadge(cause: string | null | undefined, isKo: boolean): string | null {
  if (!cause) return null
  if (cause === 'auto_tour_assign') {
    return isKo ? '자동 투어 배정' : 'Auto tour assign'
  }
  return cause
}

/** 시스템(또는 원인 미상) 변경에 대해 필드 패턴으로 사유 추론 */
function inferredSystemCauseBadges(item: AwayChangeItem, isKo: boolean): string[] {
  const out: string[] = []
  const explicit = causeBadge(item.auditCause, isKo)
  if (explicit) out.push(explicit)

  if (item.labelKey === 'tour') {
    const hasResAssign = item.diffLines.some((d) => {
      const l = (d.label || '').toLowerCase()
      return l.includes('예약 배정') || l.includes('reservation')
    })
    if (hasResAssign && !explicit) {
      out.push(isKo ? '예약 연결/해제로 배정 갱신' : 'Updated by reservation link')
    }
    if ((item.action || '').toUpperCase() === 'INSERT' && !explicit) {
      out.push(isKo ? '자동 투어 생성' : 'Auto tour created')
    }
  }

  if (item.labelKey === 'reservation') {
    const links = tourLinkBadges(item, isKo)
    if (links.length && item.auditCause === 'auto_tour_assign' && !explicit) {
      out.push(isKo ? '예약→투어 자동 연결' : 'Auto reservation→tour link')
    }
  }

  return [...new Set(out)]
}

function isPickupTimeDiff(label: string): boolean {
  const l = (label || '').toLowerCase()
  return (
    l.includes('픽업시간') ||
    l.includes('픽업 시간') ||
    l.includes('pickup time') ||
    l === 'pickup_time'
  )
}

function formatHmForBadge(raw: string): string {
  const s = (raw || '').trim()
  if (!s || s === '—') return '—'
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  return s
}

function otherDiffSuffix(item: AwayChangeItem, isKo: boolean): string {
  const statusish = (label: string) => {
    const l = label.toLowerCase()
    return l.includes('상태') || l.includes('status')
  }
  const lines = item.diffLines
    .filter(
      (d) =>
        !statusish(d.label) &&
        !isTourLinkDiff(d.label) &&
        !isPickupTimeDiff(d.label)
    )
    .slice(0, 2)
  if (!lines.length) return ''
  const isInsert = (item.action || '').toUpperCase() === 'INSERT'
  return lines
    .map((d) => {
      if (isInsert || d.beforeText === '—') {
        return `${d.label} ${d.afterText}`
      }
      return `${d.label} ${d.beforeText}→${d.afterText}`
    })
    .join(isKo ? ' · ' : '; ')
}

function diffLineBadge(
  d: { label: string; beforeText: string; afterText: string },
  isKo: boolean,
  opts?: { labelKey?: AwayChangeItem['labelKey'] }
): string {
  if (isPickupTimeDiff(d.label)) {
    const before = formatHmForBadge(d.beforeText)
    const after = formatHmForBadge(d.afterText)
    return isKo
      ? `픽업시간 변경 ${before} ▶ ${after}`
      : `Pickup time ${before} ▶ ${after}`
  }

  const label = (d.label || '').trim()
  const isInsertish = !d.beforeText || d.beforeText === '—'

  // 예약/투어 "생성" 라벨이 서로 섞이지 않게
  if (
    label === (isKo ? '생성' : 'Created') ||
    label === (isKo ? '예약 생성' : 'Reservation created') ||
    label === (isKo ? '투어 생성' : 'Tour created')
  ) {
    if (opts?.labelKey === 'reservation' || label.includes('예약') || label.toLowerCase().includes('reservation')) {
      if (isInsertish && d.afterText && d.afterText !== '—') {
        return isKo ? `예약 생성 · ${d.afterText}` : `Reservation created · ${d.afterText}`
      }
      return isKo ? '예약 생성' : 'Reservation created'
    }
    if (opts?.labelKey === 'tour' || label.includes('투어') || label.toLowerCase().includes('tour')) {
      return isKo ? '투어 생성' : 'Tour created'
    }
  }

  if (isInsertish) {
    // 초이스 요약처럼 after만 의미 있는 경우
    if (label.toLowerCase().includes('초이스') || label.toLowerCase().includes('choice')) {
      return `${label} ${d.afterText}`
    }
    return `${label} ${d.afterText}`.trim()
  }
  return `${label} ${d.beforeText} → ${d.afterText}`
}

function formatSummaryParts(
  item: AwayChangeItem,
  isKo: boolean
): { summary: string; badges: string[] } {
  const cat = categoryLabel(item, isKo)
  const prefix = `[${cat}]`
  const badges: string[] = []
  const systemish = isSystemActorEmail(item.actor)
  if (systemish || item.auditCause) {
    badges.push(...inferredSystemCauseBadges(item, isKo))
  }

  if (item.labelKey === 'reservation') {
    const { customer, tourLine } = reservationContext(item, isKo)
    const base = `${customer}, ${tourLine}`.replace(/,\s*$/, '')
    const status = statusDiffBracket(item)
    badges.push(...tourLinkBadges(item, isKo))

    if ((item.action || '').toUpperCase() === 'INSERT') {
      const insertBadges = item.diffLines
        .slice(0, 3)
        .map((d) => diffLineBadge(d, isKo, { labelKey: 'reservation' }))
        .filter(Boolean)
      for (const b of insertBadges) {
        if (!badges.includes(b)) badges.push(b)
      }
      if (!badges.length) badges.push(isKo ? '예약 생성' : 'Reservation created')
      return { summary: `${prefix} ${base}`, badges }
    }

    if (status) {
      const m = status.match(/\[([^\]]+)\]\s*>\s*\[([^\]]+)\]/)
      if (m) badges.push(`${m[1]} > ${m[2]}`)
    }

    const changeBadges = item.diffLines
      .filter((d) => !isTourLinkDiff(d.label))
      .filter((d) => {
        const l = d.label.toLowerCase()
        return !l.includes('상태') && !l.includes('status')
      })
      .slice(0, 5)
      .map((d) => diffLineBadge(d, isKo, { labelKey: 'reservation' }))
      .filter(Boolean)

    for (const b of changeBadges) {
      if (!badges.includes(b)) badges.push(b)
    }

    return { summary: `${prefix} ${base}`, badges }
  }

  if (item.labelKey === 'tour') {
    let title = (item.headerTitle || '')
      .replace(/\s*투어$/u, '')
      .replace(/\s*tour$/iu, '')
      .trim()
    const titleMatch = title.match(/^(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.*)$/)
    if (titleMatch) {
      title = `${formatShortTourDate(titleMatch[1])} ${titleMatch[2]}`.trim()
    }

    const changeBadges = item.diffLines
      .slice(0, 5)
      .map((d) => diffLineBadge(d, isKo, { labelKey: 'tour' }))
      .filter(Boolean)
    badges.push(...changeBadges)

    if (!badges.length && (item.action || '').toUpperCase() === 'UPDATE') {
      badges.push(isKo ? '세부 변경 없음' : 'No field details')
    }

    return { summary: `${prefix} ${title}`, badges }
  }

  if (item.labelKey === 'ticketBooking' || item.labelKey === 'hotelBooking') {
    const title = item.headerTitle || (isKo ? '부킹' : 'Booking')
    const changeBadges = item.diffLines
      .slice(0, 4)
      .map((d) => diffLineBadge(d, isKo))
      .filter(Boolean)
    badges.push(...changeBadges)
    return { summary: `${prefix} ${title}`, badges }
  }

  const title = item.headerTitle || item.headerSubtitle || item.recordId
  const extra = otherDiffSuffix(item, isKo)
  return {
    summary: extra ? `${prefix} ${title} · ${extra}` : `${prefix} ${title}`,
    badges,
  }
}

function toHistoryItem(
  item: AwayChangeItem,
  staffNameForEmail: (email: string | null | undefined) => string | null,
  isKo: boolean
): DailyReportActivityHistoryItem {
  const systemish = isSystemActorEmail(item.actor)
  const email = systemish ? null : (item.actor || '').trim().toLowerCase() || null
  const actorName = systemish
    ? isKo
      ? '시스템'
      : 'System'
    : item.actorNickName?.trim() ||
      staffNameForEmail(email) ||
      (email ? email.split('@')[0] : null) ||
      email ||
      (isKo ? '시스템' : 'System')

  const { summary, badges } = formatSummaryParts(item, isKo)
  const actionKind = actionKindFromAction(item.action)

  return {
    id: `${item.kind}-${item.id}`,
    at: item.at,
    actorEmail: email,
    actorName,
    category: categoryLabel(item, isKo),
    actionLabel: actionLabel(item.action, isKo),
    actionKind,
    summary,
    badges,
  }
}

export async function buildDailyReportActivityHistory(
  client: SupabaseClient<Database>,
  args: {
    /** 보고 시작일 YYYY-MM-DD (라스베가스) */
    startYmd: string
    /** 보고 종료일 YYYY-MM-DD (라스베가스) */
    endYmd: string
    rangeStartIso: string
    rangeEndIso: string
    staffNameForEmail: (email: string | null | undefined) => string | null
    locale?: string
  }
): Promise<DailyReportActivityHistory> {
  const isKo = (args.locale ?? 'ko') !== 'en'
  const digest = await fetchActivityDigestInRange(client, {
    rangeStartIso: args.rangeStartIso,
    rangeEndIso: args.rangeEndIso,
    locale: isKo ? 'ko' : 'en',
    auditLimit: 600,
    bookingLimit: 300,
  })

  // DB ISO 구간 조회 후에도, 활동 시각의 라스베가스 달력일을 기준으로 재필터
  const inLasVegasRange = (iso: string) => {
    const ymd = toLasVegasDateKey(iso)
    if (!ymd) return false
    return ymd >= args.startYmd && ymd <= args.endYmd
  }

  const items = digest
    .filter((row) => inLasVegasRange(row.at))
    .map((row) => toHistoryItem(row, args.staffNameForEmail, isKo))

  const groupMap = new Map<string, DailyReportActivityHistoryGroup>()
  for (const item of items) {
    const key = (item.actorEmail || item.actorName || 'system').toLowerCase()
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        actorEmail: item.actorEmail,
        actorName: item.actorName || (isKo ? '시스템' : 'System'),
        items: [],
      })
    }
    groupMap.get(key)!.items.push(item)
  }

  const groups = [...groupMap.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    }))
    .sort((a, b) => {
      // 시스템을 맨 아래
      const aSys = a.actorName === '시스템' || a.actorName === 'System'
      const bSys = b.actorName === '시스템' || b.actorName === 'System'
      if (aSys !== bSys) return aSys ? 1 : -1
      return a.actorName.localeCompare(b.actorName, isKo ? 'ko' : 'en')
    })

  return {
    groups,
    items,
    totalCount: items.length,
  }
}

export function emptyDailyReportActivityHistory(): DailyReportActivityHistory {
  return { groups: [], items: [], totalCount: 0 }
}
