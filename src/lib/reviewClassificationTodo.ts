import { opTodoBusinessDateKey } from '@/lib/opTodoBusinessDay'
import { toLasVegasDateKey } from '@/lib/dailyReport/dateUtils'
import type { OtaReviewSource } from '@/lib/reviewSources'

export const REVIEW_CLASSIFICATION_PANEL = {
  titleKo: '리뷰 분류',
  titleEn: 'Review classification',
} as const

export const REVIEW_CLASSIFICATION_OTA_SOURCES = [
  'getyourguide',
  'viator',
  'klook',
  'kkday',
] as const

export type ReviewClassificationOtaSource = (typeof REVIEW_CLASSIFICATION_OTA_SOURCES)[number]

export const REVIEW_CLASSIFICATION_TOUR_LINK_START_DATE = '2026-08-01'

export type OtaReviewManualCheckStatus = 'no_review' | 'follow_up'

export type OtaReviewPlatformStatus = {
  source: ReviewClassificationOtaSource
  lastImportedAt: string | null
  checkStatus: OtaReviewManualCheckStatus | null
  checkedAt: string | null
  checkedByEmail: string | null
}

export function reviewClassificationPanelTitle(locale: string): string {
  return locale === 'ko' ? REVIEW_CLASSIFICATION_PANEL.titleKo : REVIEW_CLASSIFICATION_PANEL.titleEn
}

export function reviewClassificationCompletionDateKey(): string {
  return opTodoBusinessDateKey()
}

export function shouldHideTodoChipForReviewClassificationPanel(todo: {
  title?: string | null
}): boolean {
  const normalized = (todo.title || '').replace(/\s+/g, ' ').trim()
  if (normalized === REVIEW_CLASSIFICATION_PANEL.titleKo) return true
  if (normalized.toLowerCase() === REVIEW_CLASSIFICATION_PANEL.titleEn.toLowerCase()) return true
  return false
}

export function reviewClassificationCompletionStorageKey(
  dateKey = reviewClassificationCompletionDateKey()
): string {
  return `review-classification.completed.${dateKey}`
}

export function readReviewClassificationLocalCompleted(
  dateKey = reviewClassificationCompletionDateKey()
): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(reviewClassificationCompletionStorageKey(dateKey)) === '1'
}

export function writeReviewClassificationLocalCompleted(
  completed: boolean,
  dateKey = reviewClassificationCompletionDateKey()
): void {
  if (typeof window === 'undefined') return
  const key = reviewClassificationCompletionStorageKey(dateKey)
  if (completed) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
}

export type ReviewClassificationLinkedTodo = {
  id: string
  completed: boolean
  category: 'daily' | 'weekly' | 'monthly' | 'yearly'
}

export function findReviewClassificationLinkedTodo<
  T extends { title?: string | null; id: string; completed: boolean },
>(todos: T[]): T | null {
  return todos.find((todo) => shouldHideTodoChipForReviewClassificationPanel(todo)) ?? null
}

export function reviewClassificationTodoFormSeed(locale: string) {
  return {
    title: reviewClassificationPanelTitle(locale),
    category: 'daily' as const,
    department: 'office' as const,
  }
}

export function isReviewClassificationOtaSource(
  value: string
): value is ReviewClassificationOtaSource {
  return (REVIEW_CLASSIFICATION_OTA_SOURCES as readonly string[]).includes(value)
}

/** 가져오기 시각과 리뷰없음 클릭 시각 중 더 최근 값. */
export function otaLastActivityAt(
  platform: Pick<OtaReviewPlatformStatus, 'lastImportedAt' | 'checkStatus' | 'checkedAt'>
): string | null {
  const candidates: string[] = []
  if (platform.lastImportedAt) candidates.push(platform.lastImportedAt)
  if (platform.checkStatus === 'no_review' && platform.checkedAt) {
    candidates.push(platform.checkedAt)
  }
  if (!candidates.length) return null
  return candidates.reduce((latest, iso) => (iso > latest ? iso : latest))
}

export function isOtaReviewPlatformDue(
  platform: Pick<OtaReviewPlatformStatus, 'lastImportedAt' | 'checkStatus' | 'checkedAt'>,
  todayKey: string
): boolean {
  return toLasVegasDateKey(otaLastActivityAt(platform)) !== todayKey
}

export function reviewClassificationWorkCount(
  googleWithoutTour: number,
  platforms: Array<Pick<OtaReviewPlatformStatus, 'lastImportedAt' | 'checkStatus' | 'checkedAt'>>,
  todayKey: string
): number {
  const otaDue = platforms.filter((platform) => isOtaReviewPlatformDue(platform, todayKey)).length
  return Math.max(0, googleWithoutTour) + otaDue
}

function otaCheckStorageKey(source: OtaReviewSource | ReviewClassificationOtaSource): string {
  return `review-classification.ota-check.${source}`
}

export function readOtaReviewLocalCheck(
  source: ReviewClassificationOtaSource
): Pick<OtaReviewPlatformStatus, 'checkStatus' | 'checkedAt' | 'checkedByEmail'> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(otaCheckStorageKey(source))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      checkStatus?: OtaReviewManualCheckStatus | null
      checkedAt?: string | null
      checkedByEmail?: string | null
    }
    if (parsed.checkStatus !== 'no_review' && parsed.checkStatus !== 'follow_up') return null
    return {
      checkStatus: parsed.checkStatus,
      checkedAt: parsed.checkedAt ?? null,
      checkedByEmail: parsed.checkedByEmail ?? null,
    }
  } catch {
    return null
  }
}

export function writeOtaReviewLocalCheck(
  source: ReviewClassificationOtaSource,
  check: Pick<OtaReviewPlatformStatus, 'checkStatus' | 'checkedAt' | 'checkedByEmail'>
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(otaCheckStorageKey(source), JSON.stringify(check))
  } catch {
    /* quota */
  }
}

export function mergeOtaPlatformWithLocalCheck(
  platform: OtaReviewPlatformStatus
): OtaReviewPlatformStatus {
  if (platform.checkedAt) return platform
  const local = readOtaReviewLocalCheck(platform.source)
  if (!local) return platform
  return {
    ...platform,
    checkStatus: local.checkStatus,
    checkedAt: local.checkedAt,
    checkedByEmail: local.checkedByEmail,
  }
}
