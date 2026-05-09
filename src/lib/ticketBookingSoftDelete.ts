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
 * 입장권·호텔 부킹 관리: 소프트 삭제(deletion_requested) 가능 직책.
 * op · office_manager/office manager · manager · super · admin
 */
export function canRequestTicketBookingSoftDelete(rawPosition: string | null | undefined): boolean {
  const p = String(rawPosition ?? '').toLowerCase().trim();
  if (p === 'op' || p === 'super' || p === 'admin') return true;
  return isManagerTeamPosition(rawPosition);
}
