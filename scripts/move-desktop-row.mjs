import fs from 'fs'

const path = 'c:/Users/Chad-Office/tour-management-system/src/components/booking/TicketBookingList.tsx'
let s = fs.readFileSync(path, 'utf8')

const start = s.indexOf('                    const cancelDueColorMap = new Map<string, string>();')
const fnStart = s.indexOf(
  "                    const renderDesktopRow = (booking: TicketBooking, rnRowStripe = '') => {",
  start
)
const endMarker = "\n                    if (ticketTableLayout === 'byRn') {"
const fnEnd = s.indexOf(endMarker, fnStart)
if (start < 0 || fnStart < 0 || fnEnd < 0) {
  console.error('markers', start, fnStart, fnEnd)
  process.exit(1)
}
const fnBlock = s.slice(fnStart, fnEnd)
const insertPoint = s.indexOf('  if (loading) {')
if (insertPoint < 0) {
  console.error('loading')
  process.exit(1)
}

const newFn = fnBlock
  .replace(
    "const renderDesktopRow = (booking: TicketBooking, rnRowStripe = '') => {",
    'const renderDesktopRow = (booking: TicketBooking, rnRowStripe = \'\', cancelDueColorMap: Map<string, string>) => {'
  )
  .split('\n')
  .map((line) => line.replace(/^                    /, '  '))
  .join('\n')

let s2 = s.slice(0, start) + '                    const cancelDueColorMap = buildCancelDueColorMapFor(sortedBookings);\n' + s.slice(fnEnd)

const before = s2.slice(0, insertPoint)
const after = s2.slice(insertPoint)
if (before.includes("const renderDesktopRow = (booking: TicketBooking, rnRowStripe = '', cancelDueColorMap")) {
  console.error('already inserted')
  process.exit(1)
}
const out = before + newFn + '\n\n' + after
fs.writeFileSync(path, out)
console.log('ok', newFn.length)
