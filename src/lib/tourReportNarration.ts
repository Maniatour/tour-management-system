export type TourReportNarrationSkip = {
  narration_not_played?: boolean | null
  narration_explained_in_person?: boolean | null
  narration_skip_reason?: string | null
}

export function parseNarrationSkip(data: TourReportNarrationSkip | null | undefined): {
  narration_not_played: boolean
  narration_explained_in_person: boolean
  narration_skip_reason: string
} {
  return {
    narration_not_played: Boolean(data?.narration_not_played),
    narration_explained_in_person: Boolean(data?.narration_explained_in_person),
    narration_skip_reason: String(data?.narration_skip_reason ?? '').trim(),
  }
}

export function hasNarrationSkipExplanation(data: TourReportNarrationSkip | null | undefined): boolean {
  const skip = parseNarrationSkip(data)
  if (!skip.narration_not_played) return false
  return skip.narration_explained_in_person || Boolean(skip.narration_skip_reason)
}

export function narrationSkipNeedsDetails(data: TourReportNarrationSkip | null | undefined): boolean {
  const skip = parseNarrationSkip(data)
  return skip.narration_not_played && !skip.narration_explained_in_person && !skip.narration_skip_reason
}

export function serializeNarrationSkip(data: TourReportNarrationSkip | null | undefined): {
  narration_not_played: boolean
  narration_explained_in_person: boolean
  narration_skip_reason: string | null
} {
  const skip = parseNarrationSkip(data)
  if (!skip.narration_not_played) {
    return {
      narration_not_played: false,
      narration_explained_in_person: false,
      narration_skip_reason: null,
    }
  }
  return {
    narration_not_played: true,
    narration_explained_in_person: skip.narration_explained_in_person,
    narration_skip_reason: skip.narration_skip_reason || null,
  }
}

export function narrationSkipSummary(
  data: TourReportNarrationSkip | null | undefined,
  locale: string,
): { title: string; detail: string | null } | null {
  const skip = parseNarrationSkip(data)
  if (!skip.narration_not_played) return null
  const isEn = locale === 'en'
  if (skip.narration_explained_in_person) {
    return {
      title: isEn
        ? 'Narration not played — explained without audio'
        : '나레이션 재생 안 함 — 충분한 설명을 했습니다',
      detail: skip.narration_skip_reason || null,
    }
  }
  return {
    title: isEn ? 'Narration not played' : '나레이션 재생 안 함',
    detail: skip.narration_skip_reason || null,
  }
}
