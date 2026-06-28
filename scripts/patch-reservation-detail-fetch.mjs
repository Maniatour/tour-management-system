import fs from 'fs'

const path = 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx'
let content = fs.readFileSync(path, 'utf8')

// Add import after fetchCustomerReservationList import
if (!content.includes('fetchReservationDetailBundle')) {
  content = content.replace(
    `} from '@/lib/fetchCustomerReservationList'`,
    `} from '@/lib/fetchCustomerReservationList'\nimport { fetchReservationDetailBundle } from '@/lib/fetchReservationDetailSections'`
  )
}

// Remove local section types (PickupSchedule through SupabaseTourDetails)
content = content.replace(
  /interface PickupSchedule \{[\s\S]*?interface SupabaseTourDetails \{[\s\S]*?\}\n\n/,
  ''
)

// Replace getProductDetails through getProductSchedules block with nothing
content = content.replace(
  /  \/\/ 상품 세부 정보 가져오기[\s\S]*?  \}, \[\]\)\n\n  \/\/ 예약 상세 정보 자동 로드/,
  `  // 예약 상세 정보 자동 로드`
)

// Simplify loadReservationDetails body
content = content.replace(
  `        const [productDetails, pickupSchedule, tourDetails, productSchedules] = await Promise.all([
          getProductDetails(reservation.product_id, reservation.channel_id),
          getPickupSchedule(reservationId),
          getTourDetails(reservationId),
          getProductSchedules(reservation.product_id)
        ])
        
        setReservationDetails(prev => ({
          ...prev,
          [reservationId]: {
            productDetails,
            pickupSchedule,
            tourDetails,
            productSchedules
          }
        } as Record<string, ReservationDetails>))`,
  `        const bundle = await fetchReservationDetailBundle(
          reservationId,
          reservation.product_id,
          locale,
          reservation.channel_id
        )

        setReservationDetails((prev) => ({
          ...prev,
          [reservationId]: bundle,
        }))`
)

content = content.replace(
  `  }, [reservations, reservationDetails, getProductDetails, getPickupSchedule, getTourDetails, getProductSchedules])`,
  `  }, [reservations, reservationDetails, locale])`
)

fs.writeFileSync(path, content)
console.log('patched reservation page')
