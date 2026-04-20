import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '../src/i18n/locales/ko.json')
let s = fs.readFileSync(p, 'utf8')

const a =
  '"close": "닫기",\n      "changeStatusModalTitle"'
const b =
  '"close": "닫기",\n      "simpleNoTour": "배정된 투어 없음",\n      "openTourPageTitle": "투어 페이지 열기 (모달)",\n      "tourDetailModalTitle": "투어 상세",\n      "openTourInNewTab": "새 탭에서 열기",\n      "reservationOptionsModalTitle": "예약 옵션",\n      "reservationOptionsIconTitle": "예약 옵션 추가·수정·삭제",\n      "reservationOptionsShort": "옵션",\n      "changeStatusModalTitle"'

if (!s.includes(a)) {
  console.error('block1 not found')
  process.exit(1)
}
s = s.replace(a, b)

const c = '"viewCalendar": "달력",\n    "filter"'
const d =
  '"viewCalendar": "달력",\n    "viewCardSimple": "간단 보기",\n    "viewCardStandard": "상세 보기",\n    "filter"'

if (!s.includes(c)) {
  console.error('block2 not found')
  process.exit(1)
}
s = s.replace(c, d)

fs.writeFileSync(p, s, 'utf8')
console.log('ok')
