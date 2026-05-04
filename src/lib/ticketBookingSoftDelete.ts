import { isManagerTeamPosition } from '@/lib/roles';

export function isTicketBookingDeletionPending(row: {
  deletion_requested_at?: string | null;
}): boolean {
  return Boolean(row.deletion_requested_at);
}

/** 일반 화면(투어·스케줄·입장권 목록 등)에서 제외 — 삭제 요청(소프트)된 행 */
export function filterTicketBookingsExcludedFromMainUi<T extends { deletion_requested_at?: string | null }>(
  rows: T[] | null | undefined
): T[] {
  if (!rows?.length) return [];
  return rows.filter((r) => !isTicketBookingDeletionPending(r));
}

/**
 * OP 또는 Office Manager(및 team에 저장된 매니저 표기) — 티켓 부킹 삭제 요청(소프트)만 가능.
 * SUPER·그 외 직책은 false.
 */
export function canRequestTicketBookingSoftDelete(rawPosition: string | null | undefined): boolean {
  const p = String(rawPosition ?? '').toLowerCase().trim();
  if (p === 'op') return true;
  return isManagerTeamPosition(rawPosition);
}
