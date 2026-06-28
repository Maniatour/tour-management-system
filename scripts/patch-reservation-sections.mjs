import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')
let s = fs.readFileSync(p, 'utf8')

// Remove helper functions block
const helperStart = s.indexOf('  // 투어 날짜로부터 48시간 이전인지 확인하는 함수')
const helperEnd = s.indexOf('  // 인증 확인 (시뮬레이션 상태 우선 확인)')
if (helperStart < 0 || helperEnd < 0) {
  console.error('helper markers not found')
  process.exit(1)
}
s = s.slice(0, helperStart) + s.slice(helperEnd)

// Add imports
if (!s.includes('CustomerReservationProductSection')) {
  s = s.replace(
    "import CustomerReservationPricing from '@/components/customer/CustomerReservationPricing'",
    "import CustomerReservationPricing from '@/components/customer/CustomerReservationPricing'\nimport CustomerReservationProductSection from '@/components/customer/CustomerReservationProductSection'\nimport CustomerReservationPickupSection from '@/components/customer/CustomerReservationPickupSection'\nimport CustomerReservationTourSection from '@/components/customer/CustomerReservationTourSection'\nimport type { ReservationDetails } from '@/components/customer/customerReservationTypes'"
  )
  s = s.replace(
    "import { printCustomerReservation } from '@/lib/printCustomerReservation'",
    "import { printCustomerReservation } from '@/lib/printCustomerReservation'\nimport { calculatePickupDate, formatTimeToAMPM } from '@/lib/reservationDisplayUtils'"
  )
}

// Replace detail sections
const detailStart = s.indexOf('                    {/* Recruiting 상태 안내문 - Product Details 위에 표시 */}')
const detailEnd = s.indexOf('                    {/* 예약 일시 */}')
if (detailStart < 0 || detailEnd < 0) {
  console.error('detail markers not found', detailStart, detailEnd)
  process.exit(1)
}

const replacement = `                    <CustomerReservationProductSection
                      reservation={reservation}
                      details={reservationDetails[reservation.id]}
                    />
                    <CustomerReservationPickupSection
                      reservation={reservation}
                      pickupSchedule={reservationDetails[reservation.id]?.pickupSchedule}
                      onSelectMedia={setSelectedMedia}
                    />
                    <CustomerReservationTourSection
                      tourDetails={reservationDetails[reservation.id]?.tourDetails}
                      onSelectMedia={setSelectedMedia}
                    />

`
s = s.slice(0, detailStart) + replacement + s.slice(detailEnd)

// Clean unused lucide imports - remove MapPin, Users, User, Phone, Car, ExternalLink if only used in extracted sections
// Keep Calendar, Clock for summary row; Mail, Printer, X for other UI
s = s.replace(
  "import { Calendar, Clock, MapPin, Users, User, Phone, Mail, ExternalLink, X, Car, Printer } from 'lucide-react'",
  "import { Calendar, Clock, Mail, X, Printer } from 'lucide-react'"
)

// Replace local ReservationDetails interface with imported type - remove duplicate interfaces
// Keep Reservation interface but use imported ReservationDetails for state
s = s.replace(
  'interface ReservationDetails {\n  productDetails?: ProductDetails | null\n  pickupSchedule?: PickupSchedule | null\n  tourDetails?: TourDetails | null\n  productSchedules?: ProductSchedule[] | null\n}\n\ninterface ProductSchedule {',
  'interface ProductSchedule {'
)

fs.writeFileSync(p, s)
console.log('page patched')
