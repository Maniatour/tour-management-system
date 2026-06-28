import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const body = fs.readFileSync(path.join(root, 'tmp-pricing.txt'), 'utf8').trimEnd()

const file = `'use client'

import { useTranslations } from 'next-intl'

export type CustomerReservationPricingData = {
  adults: number
  child: number
  infant: number
  total_people: number
  pricing?: {
    adult_product_price: number
    child_product_price: number
    infant_product_price: number
    product_price_total: number
    required_option_total: number
    option_total: number
    subtotal: number
    coupon_discount: number | null
    additional_discount: number | null
    additional_cost: number | null
    card_fee: number | null
    tax: number | null
    prepayment_cost: number | null
    prepayment_tip: number | null
    private_tour_additional_cost: number
    total_price: number
    deposit_amount: number
    balance_amount: number
    choices_total: number
  }
  products?: {
    base_price: number | null
  }
  payments?: Array<{
    payment_status: string
    amount: number
    payment_method: string
    note?: string
    submit_on: string
    confirmed_on?: string
    amount_krw?: number
  }>
}

type CustomerReservationPricingProps = {
  reservation: CustomerReservationPricingData
}

export default function CustomerReservationPricing({ reservation }: CustomerReservationPricingProps) {
  const t = useTranslations('common')

  return (
${body.replace(/\{t\(/g, '{t(')}
  )
}
`

fs.writeFileSync(
  path.join(root, 'src/components/customer/CustomerReservationPricing.tsx'),
  file
)
console.log('pricing component written')
