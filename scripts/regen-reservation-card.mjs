import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const content = execSync(
  'git show HEAD:src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx',
  { encoding: 'utf8', cwd: root }
)
const lines = content.split('\n')
const openDiv = lines.findIndex((l) => l.includes('id={`reservation-${reservation.id}`}'))
const end = lines.findIndex((l, i) => i > openDiv && l.trim() === '))')
const cardBody = lines.slice(openDiv, end).join('\n')

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
${cardBody
  .replace(/handlePrint\(reservation\)/g, 'onPrint()')
  .replace(/reservationDetails\[reservation\.id\]/g, 'details')
  .replace(/setSelectedMedia/g, 'onSelectMedia')}
  )
}
`

fs.writeFileSync(path.join(root, 'src/components/customer/CustomerReservationCard.tsx'), file)
console.log('regenerated from HEAD lines', openDiv + 1, '-', end)
