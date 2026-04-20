import fs from 'fs'

const path = 'src/components/reservation/ReservationCardItem.tsx'
let s = fs.readFileSync(path, 'utf8')

if (s.includes('function tourDateProximityBorderClasses')) {
  console.log('already patched')
  process.exit(0)
}

const fn = `function tourDateProximityBorderClasses(tourDate: string | null | undefined): string {
  const key = normalizeTourDateKey(tourDate)
  const iso = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!iso) return 'border border-gray-200'
  const y = Number(iso[1])
  const mo = Number(iso[2])
  const d = Number(iso[3])
  const tour = new Date(y, mo - 1, d)
  if (Number.isNaN(tour.getTime())) return 'border border-gray-200'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((tour.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'border border-gray-200'
  if (diffDays < 3) return 'border-2 border-red-500'
  if (diffDays <= 7) return 'border-2 border-blue-500'
  return 'border border-gray-200'
}

`

const needle = '}\n\nexport const ReservationCardItem = React.memo(function ReservationCardItem({\n  reservation,'
if (!s.includes(needle)) {
  console.error('needle not found')
  process.exit(1)
}

s = s.replace(needle, '}\n\n' + fn + 'export const ReservationCardItem = React.memo(function ReservationCardItem({\n  reservation,')
fs.writeFileSync(path, s, 'utf8')
console.log('patched')
