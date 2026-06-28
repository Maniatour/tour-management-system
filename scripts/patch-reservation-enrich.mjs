import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const p = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('enrichCustomerReservations')) {
  s = s.replace(
    "import { printCustomerReservation } from '@/lib/printCustomerReservation'",
    "import { printCustomerReservation } from '@/lib/printCustomerReservation'\nimport {\n  enrichCustomerReservations,\n  type RawCustomerReservation,\n} from '@/lib/enrichCustomerReservation'"
  )
}

function replaceMapBlock(source, mapStartPattern, replacement) {
  const mapStart = source.indexOf(mapStartPattern)
  if (mapStart < 0) return { source, ok: false }

  const promiseStart = source.lastIndexOf('await Promise.all(', mapStart)
  const closePattern = '\n          )\n          setReservations(reservationsWithProducts)'
  const closeIdx = source.indexOf(closePattern, mapStart)
  if (promiseStart < 0 || closeIdx < 0) return { source, ok: false }

  const newBlock =
    `          const reservationsWithProducts = (${replacement}) as Reservation[]\n          setReservations(reservationsWithProducts)`
  const end = closeIdx + closePattern.length
  return {
    source: source.slice(0, promiseStart) + newBlock + source.slice(end),
    ok: true,
  }
}

// loadReservations block
let r1 = replaceMapBlock(
  s,
  'reservationsData.map(async (reservation) => {\n              try {\n                const { data: productData',
  'await enrichCustomerReservations(\n            reservationsData as RawCustomerReservation[],\n            { locale, noProductName: t(\'noProductName\') }\n          )'
)
s = r1.source

// loadCustomerReservationsById - second occurrence
const secondMap = s.indexOf(
  'reservationsData.map(async (reservation) => {\n            try {\n              const { data: productData'
)
if (secondMap >= 0) {
  const promiseStart = s.lastIndexOf('await Promise.all(', secondMap)
  const closePattern = '\n        )\n        setReservations(reservationsWithProducts)'
  const closeIdx = s.indexOf(closePattern, secondMap)
  if (promiseStart >= 0 && closeIdx >= 0) {
    const newBlock =
      `        const reservationsWithProducts = (await enrichCustomerReservations(\n          reservationsData as RawCustomerReservation[],\n          { locale, noProductName: t('noProductName') }\n        )) as Reservation[]\n        setReservations(reservationsWithProducts)`
    s = s.slice(0, promiseStart) + newBlock + s.slice(closeIdx + closePattern.length)
  }
}

// loadSimulatedReservations
const simMap = s.indexOf(
  'reservationsData.map(async (reservation) => {\n            try {\n              const { data: productData, error: productError } = await supabase\n                .from(\'products\')'
)
if (simMap >= 0) {
  const promiseStart = s.lastIndexOf('await Promise.all(', simMap)
  const closePattern = '\n        )\n      setReservations(reservationsWithProducts)'
  const closeIdx = s.indexOf(closePattern, simMap)
  if (promiseStart >= 0 && closeIdx >= 0) {
    const newBlock =
      `      const reservationsWithProducts = (await enrichCustomerReservations(\n          reservationsData as RawCustomerReservation[],\n          { locale, noProductName: t('noProductName') }\n        )) as Reservation[]\n      setReservations(reservationsWithProducts)`
    s = s.slice(0, promiseStart) + newBlock + s.slice(closeIdx + closePattern.length)
  }
}

// Remove unused imports from page if choice utils only used in enrich now
if (!s.includes('choiceOptionIdsForSupabaseIn')) {
  s = s.replace(
    `import {\n  choiceOptionIdsForSupabaseIn,\n  UNDECIDED_OPTION_ID,\n  undecidedOptionDisplayNames,\n} from '@/utils/usResidentChoiceSync'\n`,
    ''
  )
}

fs.writeFileSync(p, s)
console.log('page patched for enrich', { r1: r1.ok, secondMap, simMap })
