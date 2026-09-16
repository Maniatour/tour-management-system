import { doesGuideSupportLanguage, type TeamLanguageData } from '@/lib/guideLanguageDetection'
import { reservationOpsLanguageBucket } from '@/lib/reservationTourLanguage'

export type ScheduleGuestLangBucket = 'ko' | 'ja' | 'en'
export type ScheduleRequiredGuideLang = 'ko' | 'ja'

export type ScheduleGuideLanguageMismatch = {
  tourId: string
  teamIndex: number
  guideName: string
  assistantName: string
  guestLocales: ScheduleGuestLangBucket[]
  staffLocales: ScheduleGuestLangBucket[]
  missingLocales: ScheduleRequiredGuideLang[]
  guestPeople: { ko: number; ja: number; en: number }
}

export type ScheduleProductCellPulseReasonKind =
  | 'capacity_overflow'
  | 'unconfirmed_tour'
  | 'guide_language'

export type ScheduleProductCellPulseReason = {
  kind: ScheduleProductCellPulseReasonKind
  missingLocales?: ScheduleRequiredGuideLang[]
}

const GUEST_LOCALE_ORDER: ScheduleGuestLangBucket[] = ['ko', 'ja', 'en']
const REQUIRED_GUIDE_LOCALES: ScheduleRequiredGuideLang[] = ['ko', 'ja']

export function customerLanguageToScheduleBucket(
  language: string | null | undefined,
): ScheduleGuestLangBucket {
  const lang = String(language || '').toLowerCase().trim()
  if (!lang) return 'en'
  if (
    lang === 'ko' ||
    lang === 'kr' ||
    lang === 'kor' ||
    lang === 'korean' ||
    lang === '한국어' ||
    lang === '한글' ||
    lang.startsWith('ko-') ||
    lang.includes('한국')
  ) {
    return 'ko'
  }
  if (
    lang === 'ja' ||
    lang === 'jp' ||
    lang === 'jpn' ||
    lang === 'japanese' ||
    lang === '일본어' ||
    lang === '日本語' ||
    lang.startsWith('ja-') ||
    lang.includes('일본')
  ) {
    return 'ja'
  }
  return 'en'
}

export function reservationToScheduleBucket(
  tourLanguage: string | null | undefined,
  customerLanguage: string | null | undefined,
): ScheduleGuestLangBucket {
  return reservationOpsLanguageBucket(tourLanguage, customerLanguage)
}

export function collectStaffScheduleLocales(
  members: Array<TeamLanguageData | null | undefined>,
): ScheduleGuestLangBucket[] {
  const set = new Set<ScheduleGuestLangBucket>()
  for (const member of members) {
    if (!member) continue
    if (doesGuideSupportLanguage(member, 'ko')) set.add('ko')
    if (doesGuideSupportLanguage(member, 'ja')) set.add('ja')
    if (doesGuideSupportLanguage(member, 'en')) set.add('en')
  }
  return GUEST_LOCALE_ORDER.filter((locale) => set.has(locale))
}

export function requiredGuideLocalesFromGuestBuckets(
  buckets: Iterable<ScheduleGuestLangBucket>,
): ScheduleRequiredGuideLang[] {
  const set = new Set<ScheduleRequiredGuideLang>()
  for (const bucket of buckets) {
    if (bucket === 'ko' || bucket === 'ja') set.add(bucket)
  }
  return REQUIRED_GUIDE_LOCALES.filter((locale) => set.has(locale))
}

export function collectTourLanguageStaffEmails(args: {
  guideEmail?: string | null | undefined
  assistantEmail?: string | null | undefined
}): string[] {
  const emails: string[] = []
  const seen = new Set<string>()
  for (const raw of [args.guideEmail, args.assistantEmail]) {
    const email = String(raw || '').trim()
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    emails.push(email)
  }
  return emails
}

export function findTourGuideLanguageMismatch(args: {
  tourId: string
  teamIndex: number
  guideName: string
  assistantName: string
  guideEmail?: string | null | undefined
  assistantEmail?: string | null | undefined
  teamType?: string | null
  guestPeople: { ko: number; ja: number; en: number }
  staffByEmail: Map<string, TeamLanguageData>
}): ScheduleGuideLanguageMismatch | null {
  const staffEmails = collectTourLanguageStaffEmails({
    guideEmail: args.guideEmail,
    assistantEmail: args.assistantEmail,
  })
  if (staffEmails.length === 0) return null

  const guestLocales = GUEST_LOCALE_ORDER.filter((locale) => args.guestPeople[locale] > 0)
  const required = requiredGuideLocalesFromGuestBuckets(guestLocales)
  if (required.length === 0) return null

  const staffMembers = staffEmails.map((email) => {
    const key = email.toLowerCase()
    return args.staffByEmail.get(key) ?? args.staffByEmail.get(email) ?? null
  })
  const staffLocales = collectStaffScheduleLocales(staffMembers)
  const staffSet = new Set(staffLocales)
  const missingLocales = required.filter((locale) => !staffSet.has(locale))
  if (missingLocales.length === 0) return null

  return {
    tourId: args.tourId,
    teamIndex: args.teamIndex,
    guideName: args.guideName,
    assistantName: args.assistantName,
    guestLocales,
    staffLocales,
    missingLocales,
    guestPeople: args.guestPeople,
  }
}

export function unionMissingGuideLocales(
  mismatches: Array<{ missingLocales?: ScheduleRequiredGuideLang[] }>,
): ScheduleRequiredGuideLang[] {
  const set = new Set<ScheduleRequiredGuideLang>()
  for (const mismatch of mismatches) {
    for (const locale of mismatch.missingLocales || []) {
      if (locale === 'ko' || locale === 'ja') set.add(locale)
    }
  }
  return REQUIRED_GUIDE_LOCALES.filter((locale) => set.has(locale))
}

export const SCHEDULE_PRODUCT_CELL_LANG_SWATCH = {
  ko: { bg: 'bg-yellow-100', border: 'border-yellow-300', title: '한국어' },
  en: { bg: 'bg-red-100', border: 'border-red-300', title: '영어' },
  ja: { bg: 'bg-sky-100', border: 'border-sky-300', title: '일본어' },
  koEn: { bg: 'bg-orange-100', border: 'border-orange-300', title: '한국어 & 영어' },
  koJa: { bg: 'bg-lime-100', border: 'border-lime-300', title: '한국어 & 일본어' },
  enJa: { bg: 'bg-violet-100', border: 'border-violet-300', title: '일본어 & 영어' },
  all: { bg: 'bg-amber-100', border: 'border-amber-300', title: '한국어 & 영어 & 일본어' },
} as const

export function scheduleProductCellLangBgClass(ko: number, en: number, ja: number): string {
  const hasKo = ko > 0
  const hasEn = en > 0
  const hasJa = ja > 0
  const present = [hasKo, hasEn, hasJa].filter(Boolean).length
  if (present === 0) return 'bg-white'
  if (present === 3) return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.all.bg
  if (hasKo && hasEn) return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.koEn.bg
  if (hasKo && hasJa) return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.koJa.bg
  if (hasEn && hasJa) return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.enJa.bg
  if (hasKo) return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.ko.bg
  if (hasJa) return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.ja.bg
  return SCHEDULE_PRODUCT_CELL_LANG_SWATCH.en.bg
}

export function scheduleGuestLangLabel(
  localeCode: ScheduleGuestLangBucket | ScheduleRequiredGuideLang,
  uiLocale: string,
): string {
  const isKo = uiLocale === 'ko'
  if (localeCode === 'ko') return isKo ? '한국어' : 'Korean'
  if (localeCode === 'ja') return isKo ? '일본어' : 'Japanese'
  return isKo ? '영어' : 'English'
}

export function scheduleProductCellPulseReasonLabel(
  reason: ScheduleProductCellPulseReason,
  uiLocale: string,
): string {
  const isKo = uiLocale === 'ko'
  if (reason.kind === 'capacity_overflow') return isKo ? '정원 초과' : 'Over capacity'
  if (reason.kind === 'unconfirmed_tour') return isKo ? '미확정 투어' : 'Tour not confirmed'
  const missing = (reason.missingLocales || []).map((locale) => scheduleGuestLangLabel(locale, uiLocale))
  if (missing.length > 0) {
    return isKo ? `가이드 언어 · ${missing.join('·')}` : `Guide language · ${missing.join('/')}`
  }
  return isKo ? '가이드 언어 불일치' : 'Guide language mismatch'
}

export function scheduleGuideLanguageMismatchLine(
  mismatch: ScheduleGuideLanguageMismatch,
  uiLocale: string,
): string {
  const isKo = uiLocale === 'ko'
  const missing = mismatch.missingLocales.map((locale) => scheduleGuestLangLabel(locale, uiLocale)).join(isKo ? '·' : '/')
  const team = isKo ? `팀${mismatch.teamIndex}` : `Team ${mismatch.teamIndex}`
  const names = [mismatch.guideName, mismatch.assistantName].filter(
    (name) => name && name !== '—',
  )
  const staffNames = names.length > 0 ? names.join(', ') : isKo ? '가이드 미표기' : 'Guide'
  return isKo ? `${team} ${staffNames}: ${missing} 필요` : `${team} ${staffNames}: ${missing} needed`
}

export function addScheduleProductCellPulseReason(
  map: Map<string, ScheduleProductCellPulseReason[]>,
  productId: string,
  dateString: string,
  reason: ScheduleProductCellPulseReason,
) {
  if (!productId || !dateString) return
  const key = `${productId}|${dateString}`
  const existing = map.get(key) || []
  if (existing.some((item) => item.kind === reason.kind)) {
    if (reason.kind === 'guide_language') {
      const merged = existing.map((item) =>
        item.kind === 'guide_language'
          ? { ...item, missingLocales: unionMissingGuideLocales([item, reason]) }
          : item,
      )
      map.set(key, merged)
    }
    return
  }
  const next = [...existing, reason]
  next.sort((a, b) => pulseReasonSortIndex(a.kind) - pulseReasonSortIndex(b.kind))
  map.set(key, next)
}

function pulseReasonSortIndex(kind: ScheduleProductCellPulseReasonKind): number {
  if (kind === 'guide_language') return 0
  if (kind === 'capacity_overflow') return 1
  return 2
}
