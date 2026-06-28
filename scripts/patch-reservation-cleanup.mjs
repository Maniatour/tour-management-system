import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagePath = path.join(root, 'src/app/[locale]/dashboard/reservations/[customer_id]/[id]/page.tsx')

function removeConsoleLogs(source) {
  const lines = source.split('\n')
  const result = []
  let i = 0
  while (i < lines.length) {
    if (/console\.log\s*\(/.test(lines[i])) {
      let open =
        (lines[i].match(/\(/g) || []).length - (lines[i].match(/\)/g) || []).length
      i++
      while (open > 0 && i < lines.length) {
        open += (lines[i].match(/\(/g) || []).length - (lines[i].match(/\)/g) || []).length
        i++
      }
      continue
    }
    result.push(lines[i])
    i++
  }
  return result.join('\n')
}

let s = fs.readFileSync(pagePath, 'utf8')

// Remove auth-only logging effects
s = s.replace(
  /  \/\/ 인증 확인 \(시뮬레이션 상태 우선 확인\)\n  useEffect\(\(\) => \{[\s\S]*?\}, \[user, isSimulating, simulatedUser, router, locale\]\)\n\n  \/\/ 시뮬레이션 상태 변화 감지[\s\S]*?\}, \[isSimulating, simulatedUser\]\)\n\n/,
  ''
)

// Remove debug pricing sample queries block
s = s.replace(
  /                  \/\/ 디버깅: reservation_pricing 테이블에 어떤 데이터가 있는지 확인\n                  const \{ data: allPricingData[\s\S]*?console\.log\('특정 reservation_id 검색 결과:', specificPricingData\)\n                  \}\n\n                  /,
  '                  '
)

s = removeConsoleLogs(s)

// Collapse excessive blank lines in try blocks (optional cleanup)
s = s.replace(/\n{3,}/g, '\n\n')

fs.writeFileSync(pagePath, s)
console.log('console.log cleanup done')
