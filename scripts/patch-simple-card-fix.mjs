import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '..', 'src', 'components', 'reservation', 'ReservationCardItem.tsx')
let s = fs.readFileSync(p, 'utf8')

const a = `    } finally {

      setStatusUpdating(false)

    }



  if (cardLayout === 'simple') {`
const b = `    } finally {

      setStatusUpdating(false)

    }

  }



  if (cardLayout === 'simple') {`
if (!s.includes(a)) {
  console.error('patch A not found')
  process.exit(1)
}
s = s.replace(a, b)

const c = `    )

  }

  }



  return (`
const d = `    )

  }



  return (`
if (!s.includes(c)) {
  console.error('patch C not found')
  process.exit(1)
}
s = s.replace(c, d)

if (!s.includes('getProductNameForLocale,')) {
  console.error('import line not found')
  process.exit(1)
}
s = s.replace(
  'getProductNameForLocale,',
  'getProductNameForLocale,\n  getProductName,'
)

const lineNeedle =
  '              {getProductNameForLocale(reservation.productId, products as any || [], locale)}'
const lineReplace =
  '              {getProductName(reservation.productId, products as any || [])}'
const idx = s.indexOf(lineNeedle)
if (idx === -1) {
  console.error('simple card product line not found')
  process.exit(1)
}
s = s.replace(lineNeedle, lineReplace)

fs.writeFileSync(p, s)
console.log('OK', p)
