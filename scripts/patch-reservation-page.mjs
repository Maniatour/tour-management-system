import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')
let s = fs.readFileSync(p, 'utf8')

// Replace handlePrint function with import usage
const handlePrintStart = s.indexOf('  // 프린트 함수')
const handlePrintEnd = s.indexOf('  // channels 데이터 로딩')
if (handlePrintStart < 0 || handlePrintEnd < 0) {
  console.error('handlePrint markers not found')
  process.exit(1)
}
s =
  s.slice(0, handlePrintStart) +
  `  const handlePrint = (reservation: Reservation) => {
    printCustomerReservation(reservation.id)
  }

` +
  s.slice(handlePrintEnd)

// Add imports if missing
if (!s.includes('printCustomerReservation')) {
  s = s.replace(
    "import CustomerReservationListHeader from '@/components/customer/CustomerReservationListHeader'",
    "import CustomerReservationListHeader from '@/components/customer/CustomerReservationListHeader'\nimport CustomerReservationPricing from '@/components/customer/CustomerReservationPricing'\nimport { printCustomerReservation } from '@/lib/printCustomerReservation'"
  )
}

const pricingStart = s.indexOf('                 {/* 가격 정보 */}')
const pricingEnd = s.indexOf('                {/* 특이사항 */}')
if (pricingStart < 0 || pricingEnd < 0) {
  console.error('pricing markers not found', pricingStart, pricingEnd)
  process.exit(1)
}
const pricingReplacement = `                 <CustomerReservationPricing reservation={reservation} />

`
s = s.slice(0, pricingStart) + pricingReplacement + s.slice(pricingEnd)
fs.writeFileSync(p, s)
console.log('reservation page patched')
