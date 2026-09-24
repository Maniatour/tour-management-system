import type { AutoAssignGuidePlanEntry, AutoAssignGuideRank, AutoAssignWeeklyLoad } from '@/lib/schedule/autoAssignSchedule'

export type AutoAssignGuideChoice = {
  email: string
  name: string
}

function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

function rankOf(value: unknown): AutoAssignGuideRank {
  return value === 'priority' || value === 'low' || value === 'standby' || value === 'normal' ? value : 'normal'
}

function loadOf(value: unknown): AutoAssignWeeklyLoad {
  return value === 1 || value === 2 || value === 3 ? value : 3
}

export const AUTO_ASSIGN_GUIDE_PLAN_SETTING_KEY = 'auto_assign_guide_plan'

/** shared_settings.setting_value 또는 예전 로컬 저장본에서 가이드 순서를 읽는다. */
export function parseStoredGuidePlan(value: unknown): AutoAssignGuidePlanEntry[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { entries?: unknown }).entries)
      ? (value as { entries: unknown[] }).entries
      : []
  const entries: AutoAssignGuidePlanEntry[] = []
  const used = new Set<string>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const email = String((item as { email?: unknown }).email || '').trim()
    const key = emailKey(email)
    if (!key || used.has(key)) continue
    used.add(key)
    entries.push({
      email,
      rank: rankOf((item as { rank?: unknown }).rank),
      weeklyLoad: loadOf((item as { weeklyLoad?: unknown }).weeklyLoad),
    })
  }
  return entries
}

/** 저장된 칸·순서를 유지하고, 새로 들어온 가이드만 일반에 붙인다. */
export function mergeGuidePlan(
  guides: AutoAssignGuideChoice[],
  saved: AutoAssignGuidePlanEntry[],
): AutoAssignGuidePlanEntry[] {
  const guidesByEmail = new Map(guides.filter((guide) => guide.email.trim()).map((guide) => [emailKey(guide.email), guide]))
  const used = new Set<string>()
  const ordered: AutoAssignGuidePlanEntry[] = []
  for (const entry of saved) {
    const guide = guidesByEmail.get(emailKey(entry.email))
    if (!guide || used.has(emailKey(guide.email))) continue
    used.add(emailKey(guide.email))
    ordered.push({
      email: guide.email,
      rank: rankOf(entry.rank),
      weeklyLoad: loadOf(entry.weeklyLoad),
    })
  }
  for (const guide of guides) {
    const key = emailKey(guide.email)
    if (!key || used.has(key)) continue
    used.add(key)
    ordered.push({ email: guide.email, rank: 'normal', weeklyLoad: 3 })
  }
  return ordered
}

export function sameGuidePlan(left: AutoAssignGuidePlanEntry[], right: AutoAssignGuidePlanEntry[]): boolean {
  if (left.length !== right.length) return false
  return left.every(
    (entry, index) =>
      emailKey(entry.email) === emailKey(right[index]?.email || '') &&
      entry.rank === right[index]?.rank &&
      entry.weeklyLoad === right[index]?.weeklyLoad,
  )
}
