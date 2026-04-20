const fs = require('fs')
const p = require('path').join(__dirname, '../src/app/[locale]/guide/tours/[id]/page.tsx')
let s = fs.readFileSync(p, 'utf8')
const oldImport = `import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
} from '@/utils/tourUtils'`
const newImport = `import {
  isReservationCancelledStatus,
  isReservationDeletedStatus,
  normalizeReservationIds,
} from '@/utils/tourUtils'`
if (!s.includes(oldImport)) {
  console.error('import block not found')
  process.exit(1)
}
s = s.replace(oldImport, newImport)
const oldBlock = `      if ((tourData as TourRow & { reservation_ids?: string[] | string }).reservation_ids) {
        const ids = Array.isArray((tourData as TourRow & { reservation_ids: string[] | string }).reservation_ids) 
          ? (tourData as TourRow & { reservation_ids: string[] }).reservation_ids 
          : String((tourData as TourRow & { reservation_ids: string }).reservation_ids).split(',').map(id => id.trim()).filter(id => id)`
const newBlock = `      const normalizedTourReservationIds = normalizeReservationIds(
        (tourData as TourRow & { reservation_ids?: unknown }).reservation_ids
      )
      if (normalizedTourReservationIds.length > 0) {
        const ids = normalizedTourReservationIds`
if (!s.includes(oldBlock)) {
  console.error('reservation ids block not found')
  process.exit(1)
}
s = s.replace(oldBlock, newBlock)
fs.writeFileSync(p, s, 'utf8')
console.log('patched', p)
