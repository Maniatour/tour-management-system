import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagePath = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')
const lines = fs.readFileSync(pagePath, 'utf8').split('\n')

function sliceLines(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n')
}

const productBody = sliceLines(2342, 2536)
const pickupBody = sliceLines(2538, 2784)
const tourBody = sliceLines(2786, 2964)

const productFile = `'use client'

import { Calendar, MapPin } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { MultilingualProductDetails, ReservationDetails } from '@/components/customer/customerReservationTypes'
import { calculateDuration, formatTimeToAMPM } from '@/lib/reservationDisplayUtils'

type CustomerReservationProductSectionProps = {
  reservation: {
    id: string
    tour_date: string
    multilingualDetails?: MultilingualProductDetails | null
  }
  details?: ReservationDetails | null
}

export default function CustomerReservationProductSection({
  reservation,
  details,
}: CustomerReservationProductSectionProps) {
  const t = useTranslations('common')
  const locale = useLocale()

${productBody.replace(/reservationDetails\[reservation\.id\]/g, 'details').replace(/reservation\.multilingualDetails/g, 'reservation.multilingualDetails')}
}
`

const pickupFile = `'use client'

import Image from 'next/image'
import { Clock, ExternalLink, User, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { PickupSchedule } from '@/components/customer/customerReservationTypes'
import {
  calculatePickupDate,
  formatTimeToAMPM,
  isBefore48Hours,
} from '@/lib/reservationDisplayUtils'

type CustomerReservationPickupSectionProps = {
  reservation: {
    id: string
    tour_date: string
    pickup_hotel: string | null
  }
  pickupSchedule?: PickupSchedule | null
  onSelectMedia: (url: string) => void
}

export default function CustomerReservationPickupSection({
  reservation,
  pickupSchedule,
  onSelectMedia,
}: CustomerReservationPickupSectionProps) {
  const t = useTranslations('common')

  if (!pickupSchedule) return null

${pickupBody.replace(/reservationDetails\[reservation\.id\]\?\.pickupSchedule/g, 'pickupSchedule').replace(/setSelectedMedia/g, 'onSelectMedia')}
}
`

const tourFile = `'use client'

import Image from 'next/image'
import { Car, ExternalLink, Phone, User, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { TourDetails } from '@/components/customer/customerReservationTypes'

type CustomerReservationTourSectionProps = {
  tourDetails?: TourDetails | null
  onSelectMedia: (url: string) => void
}

export default function CustomerReservationTourSection({
  tourDetails,
  onSelectMedia,
}: CustomerReservationTourSectionProps) {
  const t = useTranslations('common')
  const locale = useLocale()

  if (!tourDetails) return null

${tourBody.replace(/reservationDetails\[reservation\.id\]\?\.tourDetails/g, 'tourDetails').replace(/setSelectedMedia/g, 'onSelectMedia')}
}
`

fs.writeFileSync(path.join(root, 'src/components/customer/CustomerReservationProductSection.tsx'), productFile)
fs.writeFileSync(path.join(root, 'src/components/customer/CustomerReservationPickupSection.tsx'), pickupFile)
fs.writeFileSync(path.join(root, 'src/components/customer/CustomerReservationTourSection.tsx'), tourFile)
console.log('components generated')
