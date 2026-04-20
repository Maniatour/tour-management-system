import fs from 'fs'
const p = 'src/utils/reservationUtils.ts'
let s = fs.readFileSync(p, 'utf8')
if (s.includes('isoToLocalCalendarDateKey')) {
  console.log('already')
  process.exit(0)
}
const ins = `export function isoToLocalCalendarDateKey(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim() === '') return null
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return \`\${year}-\${month}-\${day}\`
}

`
const old = "  return s.split('T')[0] ?? ''\n}\n\n/**"
if (!s.includes(old)) {
  console.error('needle missing')
  process.exit(1)
}
s = s.replace(old, "  return s.split('T')[0] ?? ''\n}\n\n" + ins + '/**')
fs.writeFileSync(p, s)
console.log('ok')
