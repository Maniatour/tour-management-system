import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cardPath = path.join(root, 'src/components/customer/CustomerReservationCard.tsx')
const lines = fs.readFileSync(cardPath, 'utf8').split('\n')

const pricingStart = lines.findIndex((l) => l.includes('/* 가격 정보 */'))
const specialStart = lines.findIndex((l) => l.includes('/* 특이사항 */'))
const detailInnerStart = lines.findIndex((l) => l.includes('<div className="border-t border-gray-200 pt-6 mt-4 space-y-6">'))
const reservationDateStart = lines.findIndex((l) => l.includes('/* 예약 일시 */'))

if (pricingStart < 0 || specialStart < 0 || detailInnerStart < 0 || reservationDateStart < 0) {
  console.error('markers not found', { pricingStart, specialStart, detailInnerStart, reservationDateStart })
  process.exit(1)
}

const beforePricing = lines.slice(0, pricingStart)
const specialNotes = lines.slice(specialStart, detailInnerStart)
const afterDetailOpen = lines.slice(detailInnerStart, detailInnerStart + 1)
const footer = lines.slice(reservationDateStart)

const middle = [
  '                 <CustomerReservationPricing reservation={reservation} />',
  '',
  ...specialNotes,
  ...afterDetailOpen,
  '                    <CustomerReservationProductSection',
  '                      reservation={reservation}',
  '                      details={details}',
  '                    />',
  '                    <CustomerReservationPickupSection',
  '                      reservation={reservation}',
  '                      pickupSchedule={details?.pickupSchedule ?? null}',
  '                      onSelectMedia={onSelectMedia}',
  '                    />',
  '                    <CustomerReservationTourSection',
  '                      tourDetails={details?.tourDetails ?? null}',
  '                      onSelectMedia={onSelectMedia}',
  '                    />',
  '',
  ...footer,
]

const header = beforePricing.join('\n')
const tail = lines.slice(-2).join('\n') // closing ) and }
const result = [...beforePricing, ...middle, ...lines.slice(-2)].join('\n')
fs.writeFileSync(cardPath, result)
console.log('card slimmed', beforePricing.length, '->', result.split('\n').length, 'lines')
