import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagePath = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')
const lines = fs.readFileSync(pagePath, 'utf8').split('\n')

function sliceLines(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n')
}

const cardBody = sliceLines(1978, 2263)

const file = `'use client'

import Image from 'next/image'
import { Calendar, Clock, MapPin, Users, User, Phone, Mail, Printer } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import CustomerReservationPricing from '@/components/customer/CustomerReservationPricing'
import CustomerReservationProductSection from '@/components/customer/CustomerReservationProductSection'
import CustomerReservationPickupSection from '@/components/customer/CustomerReservationPickupSection'
import CustomerReservationTourSection from '@/components/customer/CustomerReservationTourSection'
import type {
  CustomerReservationCardData,
  CustomerReservationChannel,
  CustomerReservationCustomer,
  ReservationDetails,
} from '@/components/customer/customerReservationTypes'
import { calculatePickupDate, formatTimeToAMPM } from '@/lib/reservationDisplayUtils'

type CustomerReservationCardProps = {
  reservation: CustomerReservationCardData
  customer: CustomerReservationCustomer | null
  channels: CustomerReservationChannel[]
  details?: ReservationDetails | null
  onPrint: () => void
  onSelectMedia: (url: string) => void
}

export default function CustomerReservationCard({
  reservation,
  customer,
  channels,
  details,
  onPrint,
  onSelectMedia,
}: CustomerReservationCardProps) {
  const t = useTranslations('common')
  const locale = useLocale()

  const getStatusText = (status: string) => {
    switch (status) {
      case 'inquiry': return t('inquiry')
      case 'pending': return t('pending')
      case 'confirmed': return t('confirmed')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      case 'no_show': return t('no_show')
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'inquiry': return 'bg-sky-100 text-sky-900'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no_show': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
${cardBody.replace(/handlePrint\(reservation\)/g, 'onPrint()')}
  )
}
`

fs.writeFileSync(path.join(root, 'src/components/customer/CustomerReservationCard.tsx'), file)
console.log('CustomerReservationCard generated')
