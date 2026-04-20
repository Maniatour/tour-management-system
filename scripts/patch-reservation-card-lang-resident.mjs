import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '..', 'src', 'components', 'reservation', 'ReservationCardItem.tsx')
let s = fs.readFileSync(p, 'utf8')

const helper = `

function customerLanguageToFlagCountryCode(language: string | null | undefined): string | null {
  if (!language?.trim()) return null
  const lang = language.toLowerCase().trim()
  if (lang === 'kr' || lang === 'ko' || lang.startsWith('ko-') || lang === 'korean') return 'KR'
  if (lang === 'en' || lang.startsWith('en-') || lang === 'english') return 'US'
  if (lang === 'ja' || lang === 'jp' || lang.startsWith('ja-') || lang === 'japanese') return 'JP'
  if (lang === 'zh' || lang === 'cn' || lang.startsWith('zh-') || lang === 'chinese') return 'CN'
  if (lang === 'es' || lang.startsWith('es-') || lang === 'spanish') return 'ES'
  if (lang === 'fr' || lang.startsWith('fr-') || lang === 'french') return 'FR'
  if (lang === 'de' || lang.startsWith('de-') || lang === 'german') return 'DE'
  if (lang === 'it' || lang.startsWith('it-') || lang === 'italian') return 'IT'
  if (lang === 'pt' || lang.startsWith('pt-') || lang === 'portuguese') return 'PT'
  if (lang === 'ru' || lang.startsWith('ru-') || lang === 'russian') return 'RU'
  if (lang === 'th' || lang === 'thai') return 'TH'
  if (lang === 'vi' || lang === 'vietnamese') return 'VN'
  if (lang === 'id' || lang === 'indonesian') return 'ID'
  if (lang === 'ms' || lang === 'malay') return 'MY'
  if (lang === 'ph' || lang === 'filipino') return 'PH'
  return 'US'
}
`

if (!s.includes('function customerLanguageToFlagCountryCode')) {
  s = s.replace(/\r?\n\r?\nfunction reservationStatusLucideIcon/, helper + '\r\n\r\nfunction reservationStatusLucideIcon')
}

const needleSimple =
  /\)\s*:\s*null\}\r?\n\r?\n\r?\n\r?\n            <button\r?\n\r?\n              type=\{"button"\}\r?\n\r?\n              className=\{"text-sm font-medium text-gray-900 truncate min-w-0 flex-1 text-left hover:text-blue-600 hover:underline"\}/

const simpleBlock = `) : null}



            {(() => {

              const flagCode = customerLanguageToFlagCountryCode(customerRow?.language)

              if (!flagCode) return null

              return (

                <ReactCountryFlag

                  countryCode={flagCode}

                  svg

                  style={{ width: 16, height: 12, borderRadius: 2 }}

                  className="shrink-0"

                />

              )

            })()}



            {showResidentStatusUi ? (

              <ResidentStatusIcon

                reservationId={reservation.id}

                customerId={reservation.customerId}

                totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}

                onUpdate={onRefreshReservations}

              />

            ) : null}



            <button

              type="button"

              className="text-sm font-medium text-gray-900 truncate min-w-0 flex-1 text-left hover:text-blue-600 hover:underline"`

if (!s.includes('customerLanguageToFlagCountryCode(customerRow?.language)')) {
  const m = s.match(needleSimple)
  if (!m) {
    console.error('simple card anchor not found')
    process.exit(1)
  }
  s = s.replace(needleSimple, simpleBlock)
}

const removeBottom = `\r\n\r\n        {showResidentStatusUi && (\r\n\r\n          <div className="px-3 pb-2">\r\n\r\n            <ResidentStatusIcon\r\n\r\n              reservationId={reservation.id}\r\n\r\n              customerId={reservation.customerId}\r\n\r\n              totalPeople={(reservation.adults || 0) + (reservation.child || 0) + (reservation.infant || 0)}\r\n\r\n              onUpdate={onRefreshReservations}\r\n\r\n            />\r\n\r\n          </div>\r\n\r\n        )}\r\n\r\n\r\n\r\n        {followUpModalOpen && (`

const removeBottomLf = removeBottom.replace(/\r\n/g, '\n')

if (s.includes(removeBottom)) {
  s = s.replace(removeBottom, '\r\n\r\n        {followUpModalOpen && (')
} else if (s.includes(removeBottomLf)) {
  s = s.replace(removeBottomLf, '\n\n        {followUpModalOpen && (')
} else {
  console.warn('bottom resident block pattern not found (maybe already removed)')
}

const oldIifeStart = '            {(() => {\r\n\r\n              const customer = customers.find(c => c.id === reservation.customerId)\r\n\r\n              if (!customer?.language) return null'
const newIife = `            {(() => {

              const customer = customers.find(c => c.id === reservation.customerId)

              const flagCode = customerLanguageToFlagCountryCode(customer?.language)

              if (!flagCode) return null`

if (s.includes('const getLanguageFlag = (language: string): string => {')) {
  const start = s.indexOf(oldIifeStart)
  if (start === -1) {
    console.error('standard card IIFE start not found (CRLF)')
    process.exit(1)
  }
  const endMarker = '            })()}\r\n\r\n            \r\n\r\n            {/*'
  const end = s.indexOf(endMarker, start)
  if (end === -1) {
    console.error('standard card IIFE end not found')
    process.exit(1)
  }
  const tail = s.slice(end)
  const replacement = `${newIife}

              

              return (

                <ReactCountryFlag

                  countryCode={flagCode}

                  svg

                  style={{

                    width: '16px',

                    height: '12px',

                    borderRadius: '2px',

                    marginRight: '6px'

                  }}

                />

              )

            })()}`
  s = s.slice(0, start) + replacement + tail.slice(endMarker.length)
}

fs.writeFileSync(p, s)
console.log('patched', p)
