/** 브라우저 로컬 달력 기준 YYYY-MM-DD (투어 일정·픽업 창과 동일 기준) */
export function localDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
