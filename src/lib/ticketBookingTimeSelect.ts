/**
 * 새 부킹 폼·변경 요청 모달 공통 — 6:00~18:55, 5분 단위 슬롯 (편집 폼과 동일 규칙)
 */

/** DB `time` / 문자열 → 선택용 HH:MM (분을 5분 단위로 반올림 — 편집 폼 `formatTimeForDropdown` 과 동일) */
export function normalizeDbTimeToTicketSelectSlot(raw: string | null | undefined): string {
  if (!raw) return '';
  const timeStr = String(raw).trim();
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!timeMatch) return '';
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const roundedMinutes = Math.round(minutes / 5) * 5;
  return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
}

export type TicketBookingTimeSlotOption = {
  value: string;
  hour: number;
  bg: string;
  text: string;
};

/** 폼과 동일: 6시~18시, 5분 간격 */
export function getTicketBookingTimeSelectOptions(): TicketBookingTimeSlotOption[] {
  const out: TicketBookingTimeSlotOption[] = [];
  for (let i = 0; i < 13 * 12; i++) {
    const hour = Math.floor(i / 12) + 6;
    const minute = (i % 12) * 5;
    const value = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const { bg, text } = getTicketBookingTimeSlotColors(hour);
    out.push({ value, hour, bg, text });
  }
  return out;
}

/** TicketBookingForm 시간 `<option>` 과 동일 색상 */
export function getTicketBookingTimeSlotColors(hour: number): { bg: string; text: string } {
  if (hour === 6) return { bg: '#dbeafe', text: '#1e40af' };
  if (hour === 7) return { bg: '#dcfce7', text: '#166534' };
  if (hour === 8) return { bg: '#fef3c7', text: '#92400e' };
  if (hour === 9) return { bg: '#fce7f3', text: '#be185d' };
  if (hour === 10) return { bg: '#e0e7ff', text: '#3730a3' };
  if (hour === 11) return { bg: '#f0fdf4', text: '#14532d' };
  if (hour === 12) return { bg: '#fefce8', text: '#a16207' };
  if (hour === 13) return { bg: '#fff7ed', text: '#9a3412' };
  if (hour === 14) return { bg: '#fef2f2', text: '#dc2626' };
  if (hour === 15) return { bg: '#f3e8ff', text: '#7c3aed' };
  if (hour === 16) return { bg: '#ecfdf5', text: '#059669' };
  if (hour === 17) return { bg: '#f0f9ff', text: '#0284c7' };
  if (hour === 18) return { bg: '#f8fafc', text: '#475569' };
  return { bg: '#f9fafb', text: '#111827' };
}
