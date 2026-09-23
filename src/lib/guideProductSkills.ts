export type GuideLanguageCode = 'ko' | 'en' | 'ja'

/** 1은 상, 2는 중, 3은 하. */
export type GuideLanguagePriority = 1 | 2 | 3

export type GuideLanguagePriorities = Partial<Record<GuideLanguageCode, GuideLanguagePriority>>

export type GuideProductSkill = {
  eligible: boolean
  priorities: GuideLanguagePriorities
}

export type GuideProductSkills = Record<string, GuideProductSkill>

export const GUIDE_LANGUAGE_CODES: GuideLanguageCode[] = ['ko', 'en', 'ja']

export const GUIDE_LANGUAGE_PRIORITY_LABEL: Record<GuideLanguagePriority, string> = {
  1: '상',
  2: '중',
  3: '하',
}

const LANGUAGE_LABEL: Record<GuideLanguageCode, string> = {
  ko: '한국어',
  en: '영어',
  ja: '일본어',
}

function parsePriority(value: unknown): GuideLanguagePriority | null {
  const rank = Number(value)
  if (rank === 1 || rank === 2 || rank === 3) return rank
  return null
}

function parsePriorities(value: unknown): GuideLanguagePriorities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const priorities: GuideLanguagePriorities = {}
  for (const code of GUIDE_LANGUAGE_CODES) {
    const rank = parsePriority(source[code])
    if (rank) priorities[code] = rank
  }
  return priorities
}

export function parseGuideProductSkills(value: unknown): GuideProductSkills {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const skills: GuideProductSkills = {}
  for (const [rawId, rawSkill] of Object.entries(value as Record<string, unknown>)) {
    const productId = rawId.trim()
    if (!productId || !rawSkill || typeof rawSkill !== 'object' || Array.isArray(rawSkill)) continue
    const skill = rawSkill as { eligible?: unknown; priorities?: unknown }
    skills[productId] = {
      eligible: skill.eligible !== false,
      priorities: parsePriorities(skill.priorities),
    }
  }
  return skills
}

export function canGuideProduct(skills: GuideProductSkills | null | undefined, productId: string): boolean {
  const id = String(productId || '').trim()
  if (!id) return true
  const skill = skills?.[id]
  if (!skill) return true
  return skill.eligible !== false
}

export function guideLanguagePriority(
  skills: GuideProductSkills | null | undefined,
  productId: string,
  locale: GuideLanguageCode,
): GuideLanguagePriority | null {
  const id = String(productId || '').trim()
  const skill = id ? skills?.[id] : undefined
  if (!skill || skill.eligible === false) return null
  return skill.priorities[locale] ?? null
}

/** 손님 언어 중 가장 낮은 우선순위. 상 3, 중 2, 하 1, 없음 0. */
export function guideLanguagePriorityScore(
  skills: GuideProductSkills | null | undefined,
  productId: string,
  locales: GuideLanguageCode[],
): number {
  if (locales.length === 0) return 0
  let weakest = 3
  for (const locale of locales) {
    const rank = guideLanguagePriority(skills, productId, locale)
    const score = rank == null ? 0 : 4 - rank
    if (score < weakest) weakest = score
  }
  return weakest
}

export function guideLanguagePrioritySummary(
  skills: GuideProductSkills | null | undefined,
  productId: string,
  locales: GuideLanguageCode[],
): string | null {
  const parts = locales.flatMap((locale) => {
    const rank = guideLanguagePriority(skills, productId, locale)
    if (!rank) return []
    return [`${LANGUAGE_LABEL[locale]} 우선순위 ${GUIDE_LANGUAGE_PRIORITY_LABEL[rank]}`]
  })
  return parts.length > 0 ? parts.join(' · ') : null
}
