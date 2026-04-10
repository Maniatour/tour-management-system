/**
 * <input type="datetime-local" /> 값 (로컬 분 단위) ↔ DB timestamptz(ISO)
 */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Date 또는 ISO 문자열을 datetime-local value (YYYY-MM-DDTHH:mm)로 */
export function formatDateTimeForDatetimeLocalInput(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(d.getTime())) {
    return formatDateTimeForDatetimeLocalInput(new Date())
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** datetime-local 또는 과거 호환 YYYY-MM-DD만 온 경우 → ISO 문자열 (DB 저장용) */
export function parseDatetimeLocalInputToISOString(value: string): string {
  const v = value?.trim() ?? ''
  if (!v) return new Date().toISOString()
  if (v.includes('T')) {
    const d = new Date(v)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const day = Number(m[3])
    return new Date(y, mo - 1, day, 0, 0, 0, 0).toISOString()
  }
  return new Date().toISOString()
}
