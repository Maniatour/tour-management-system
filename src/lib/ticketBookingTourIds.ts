/** 입장권 부킹 다중 투어 연결 (tour_ids + 대표 tour_id) */

/** tour_ids / tour_id 로부터 중복 없는 투어 ID 목록 */
export function normalizeTicketBookingTourIds(
  tourIds: unknown,
  fallbackTourId?: string | null
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: unknown) => {
    const id = String(raw ?? '').trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    out.push(id)
  }

  if (Array.isArray(tourIds)) {
    for (const v of tourIds) push(v)
  } else if (typeof tourIds === 'string' && tourIds.trim()) {
    const s = tourIds.trim()
    if (s.startsWith('{') && s.endsWith('}')) {
      // Postgres text[] 리터럴 방어
      for (const part of s.slice(1, -1).split(',')) {
        push(part.replace(/^"|"$/g, ''))
      }
    } else {
      push(s)
    }
  }

  if (out.length === 0) push(fallbackTourId)
  return out
}

export function primaryTourIdFromTourIds(tourIds: string[]): string | null {
  return tourIds[0] ?? null
}

/** 저장용: tour_ids + 대표 tour_id */
export function ticketBookingTourLinkPayload(tourIdsInput: unknown, fallbackTourId?: string | null) {
  const tour_ids = normalizeTicketBookingTourIds(tourIdsInput, fallbackTourId)
  return {
    tour_ids,
    tour_id: primaryTourIdFromTourIds(tour_ids),
  }
}
