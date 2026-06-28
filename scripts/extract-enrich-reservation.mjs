import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lines = fs.readFileSync(
  path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx'),
  'utf8'
).split('\n')

const inner = lines
  .slice(401, 687)
  .map((l) => l.replace(/^                /, '    '))
  .join('\n')
  .replace(/t\('noProductName'\)/g, 'noProductName')
  .replace(/t\('productInfoError'\)/g, "'productInfoError'")
  .replace(/ as unknown as Reservation/g, '')

const file = `import { supabase } from '@/lib/supabase'
import {
  choiceOptionIdsForSupabaseIn,
  UNDECIDED_OPTION_ID,
  undecidedOptionDisplayNames,
} from '@/utils/usResidentChoiceSync'

export type RawCustomerReservation = Record<string, unknown> & {
  id: string
  product_id?: string | null
  channel_id?: string | null
  pickup_hotel?: string | null
}

type EnrichOptions = {
  locale: string
  noProductName: string
}

const emptyProduct = (noProductName: string) => ({
  name: noProductName,
  customer_name_ko: null,
  customer_name_en: null,
  duration: null,
  base_price: null,
})

export async function enrichCustomerReservation(
  reservation: RawCustomerReservation,
  options: EnrichOptions
): Promise<RawCustomerReservation> {
  const { locale, noProductName } = options
${inner}
}

export async function enrichCustomerReservations(
  reservations: RawCustomerReservation[],
  options: EnrichOptions
): Promise<RawCustomerReservation[]> {
  return Promise.all(reservations.map((r) => enrichCustomerReservation(r, options)))
}
`

fs.writeFileSync(path.join(root, 'src/lib/enrichCustomerReservation.ts'), file)
console.log('written enrichCustomerReservation.ts')
