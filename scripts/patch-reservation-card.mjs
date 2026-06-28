import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('CustomerReservationCard')) {
  s = s.replace(
    "import CustomerReservationListHeader from '@/components/customer/CustomerReservationListHeader'",
    "import CustomerReservationListHeader from '@/components/customer/CustomerReservationListHeader'\nimport CustomerReservationCard from '@/components/customer/CustomerReservationCard'"
  )
}

const cardStart = s.indexOf('              <div key={reservation.id} id={`reservation-${reservation.id}`}')
const cardEnd = s.indexOf('              ))', cardStart)
if (cardStart < 0 || cardEnd < 0) {
  console.error('card markers not found', cardStart, cardEnd)
  process.exit(1)
}

const replacement = `              <CustomerReservationCard
                key={reservation.id}
                reservation={reservation}
                customer={customer}
                channels={channels}
                details={reservationDetails[reservation.id]}
                onPrint={() => handlePrint(reservation)}
                onSelectMedia={setSelectedMedia}
              />`

s = s.slice(0, cardStart) + replacement + s.slice(cardEnd)

// Remove unused imports if possible - keep icons used elsewhere in page
if (!s.includes('CustomerReservationProductSection')) {
  s = s.replace(
    "import CustomerReservationPricing from '@/components/customer/CustomerReservationPricing'\nimport CustomerReservationProductSection from '@/components/customer/CustomerReservationProductSection'\nimport CustomerReservationPickupSection from '@/components/customer/CustomerReservationPickupSection'\nimport CustomerReservationTourSection from '@/components/customer/CustomerReservationTourSection'\n",
    ''
  )
}

if (!s.includes('formatTimeToAMPM') && !s.includes('calculatePickupDate')) {
  s = s.replace(
    "import { calculatePickupDate, formatTimeToAMPM } from '@/lib/reservationDisplayUtils'\n",
    ''
  )
}

// Remove getStatusText/Color if only used in card
if (!s.includes('getStatusText(')) {
  s = s.replace(
    /  \/\/ 상태 텍스트 변환\n  const getStatusText[\s\S]*?  \/\/ 상태별 색상\n  const getStatusColor[\s\S]*?  \}\n\n\n/,
    ''
  )
}

fs.writeFileSync(p, s)
console.log('page patched with CustomerReservationCard')
