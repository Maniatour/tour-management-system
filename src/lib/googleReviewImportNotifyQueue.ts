import type { GoogleReviewImportNotifyRow } from '@/lib/googleReviewImportNotify'

export function mergeGoogleReviewImportNotifyRows(
  existing: GoogleReviewImportNotifyRow[],
  incoming: GoogleReviewImportNotifyRow[]
): GoogleReviewImportNotifyRow[] {
  const byId = new Map(existing.map((row) => [row.id, row]))
  for (const row of incoming) {
    byId.set(row.id, row)
  }
  return [...byId.values()]
}

export function pickLatestGoogleReviewImportNotification(
  rows: GoogleReviewImportNotifyRow[],
  dismissedIds: Set<string>
): GoogleReviewImportNotifyRow | null {
  let latest: GoogleReviewImportNotifyRow | null = null
  for (const row of rows) {
    if (dismissedIds.has(row.id)) continue
    if (!latest || row.created_at > latest.created_at) latest = row
  }
  return latest
}

export function googleReviewImportNotifyIdsAtOrBefore(
  rows: GoogleReviewImportNotifyRow[],
  createdAt: string
): string[] {
  return rows.filter((row) => row.created_at <= createdAt).map((row) => row.id)
}
