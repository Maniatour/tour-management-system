export type WaiverInvitationCanonicalCandidate = {
  id: string
  createdAtMs: number
  hasParticipants: boolean
  lastOpenedAtMs: number | null
}

/** Prefer the invitation the guest actually opened; otherwise the one with participants; otherwise the oldest. */
export function pickCanonicalWaiverInvitation<T extends WaiverInvitationCanonicalCandidate>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => {
    const aOpen = a.lastOpenedAtMs
    const bOpen = b.lastOpenedAtMs
    if (aOpen != null && bOpen != null && aOpen !== bOpen) return bOpen - aOpen
    if (aOpen != null && bOpen == null) return -1
    if (aOpen == null && bOpen != null) return 1
    if (a.hasParticipants !== b.hasParticipants) return a.hasParticipants ? -1 : 1
    if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
}
