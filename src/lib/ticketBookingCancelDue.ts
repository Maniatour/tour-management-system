/**
 * 입장권 부킹 Cancel Due 계산 (TicketBookingList / TicketBookingForm 과 동일 규칙)
 */

export type SeasonDate = { start: string; end: string };

export function checkIfSeason(
  checkInDate: string,
  supplierProduct?: { season_dates: SeasonDate[] | null } | null
): boolean {
  if (!checkInDate || !supplierProduct?.season_dates) return false;

  const seasonDates = supplierProduct.season_dates;
  if (!Array.isArray(seasonDates)) return false;

  const checkIn = new Date(checkInDate);
  checkIn.setHours(0, 0, 0, 0);

  return seasonDates.some((period: { start: string; end: string }) => {
    const start = new Date(period.start);
    const end = new Date(period.end);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return checkIn >= start && checkIn <= end;
  });
}

export function getCancelDeadlineDays(
  company: string,
  checkInDate: string,
  supplierProduct?: { season_dates: SeasonDate[] | null } | null
): number {
  const isSeason = checkIfSeason(checkInDate, supplierProduct);

  switch (company) {
    case 'Antelope X':
      return 4;
    case 'SEE CANYON':
      return isSeason ? 5 : 4;
    case 'Mei Tour':
      return isSeason ? 8 : 5;
    default:
      return 0;
  }
}

export function getCancelDueDateForTicketBooking(
  booking: { check_in_date: string; company: string },
  supplierProduct?: { season_dates: SeasonDate[] | null } | null
): string | null {
  if (!booking.check_in_date || !booking.company) return null;

  const cancelDeadlineDays = getCancelDeadlineDays(
    booking.company,
    booking.check_in_date,
    supplierProduct
  );

  if (cancelDeadlineDays === 0) return null;

  const checkInDate = new Date(booking.check_in_date);
  checkInDate.setHours(0, 0, 0, 0);

  const cancelDueDate = new Date(checkInDate);
  cancelDueDate.setDate(cancelDueDate.getDate() - cancelDeadlineDays);

  return cancelDueDate.toISOString().split('T')[0];
}

/** 오늘 날짜 YYYY-MM-DD (로컬 달력 기준) */
export function localDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Cancel Due 가 오늘보다 이전이고, 체크인은 오늘보다 이후인 부킹 (취소 제외)
 * — 취소 기한이 이미 지났는데 아직 체크인 전인 건 점검용
 */
export function isTicketBookingCancelDueStaleBeforeCheckIn(
  booking: { check_in_date: string; company: string; status?: string | null },
  supplierProduct?: { season_dates: SeasonDate[] | null } | null
): boolean {
  if (String(booking.status || '').toLowerCase() === 'cancelled') return false;
  const due = getCancelDueDateForTicketBooking(booking, supplierProduct);
  if (!due || !booking.check_in_date) return false;
  const today = localDateYmd();
  return due < today && booking.check_in_date > today;
}
