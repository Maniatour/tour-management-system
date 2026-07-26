'use client'

import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSimilarCustomerReservationsHint } from '@/hooks/useSimilarCustomerReservationsHint'
import type { Customer } from '@/types/reservation'

type SimilarCustomerReservationsHintButtonProps = {
  customer: Customer
  allCustomers: Customer[]
  productMap?: Map<string, string>
  operatorId?: string | null
  onOpen: (customer: Customer) => void
  className?: string
}

export function SimilarCustomerReservationsHintButton({
  customer,
  allCustomers,
  productMap,
  operatorId,
  onOpen,
  className = '',
}: SimilarCustomerReservationsHintButtonProps) {
  const t = useTranslations('reservations.card')
  const hasSimilar = useSimilarCustomerReservationsHint(
    customer,
    allCustomers,
    productMap,
    operatorId,
    true
  )

  if (!hasSimilar) return null

  return (
    <button
      type="button"
      title={t('similarCustomerReservationsTitle')}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(customer)
      }}
      className={`inline-flex max-w-full items-center gap-0.5 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-violet-800 ring-1 ring-violet-200/80 transition-colors hover:bg-violet-100 ${className}`}
    >
      <Users className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{t('similarCustomerReservations')}</span>
    </button>
  )
}
