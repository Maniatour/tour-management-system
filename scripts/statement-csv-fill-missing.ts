/**
 * 금융 계정 명세 CSV vs DB 비교 후 누락 statement_lines 만 추가.
 *
 * 실행 (미리보기):
 *   npx tsx --tsconfig tsconfig.json scripts/statement-csv-fill-missing.ts "C:\path\CreditCard (1).csv" --account "WellsFargo (CC)"
 *
 * 실제 반영:
 *   npx tsx --tsconfig tsconfig.json scripts/statement-csv-fill-missing.ts "..." --account "WellsFargo (CC)" --apply
 *
 * .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync } from 'fs'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  makeDedupeKey,
  parseStatementCsvText,
  shouldInvertStatementCsvDirections,
  type ParsedStatementRow
} from '../src/lib/statement-csv'

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const supabase = createClient(url, key)

function lineFingerprint(row: {
  posted_date: string
  amount: number | string
  direction: string
  description: string | null
  raw?: Record<string, string> | null
}): string {
  const amt = Number(row.amount)
  const a = Number.isFinite(amt) ? amt.toFixed(2) : String(row.amount)
  const desc = normalizeMatchDescription(row.description, row.raw)
  return `${String(row.posted_date).slice(0, 10)}|${a}|${row.direction}|${desc}`
}

function parsedFingerprint(row: ParsedStatementRow): string {
  const desc = normalizeMatchDescription(row.description, row.raw)
  return `${row.postedDate}|${row.amount.toFixed(2)}|${row.direction}|${desc}`
}

/** DB·CSV 설명 차이(#거래참조 등) 정규화 */
function normalizeMatchDescription(
  description: string | null | undefined,
  raw?: Record<string, string> | null
): string {
  const fromRaw = raw?.description?.trim()
  let s = (fromRaw || description || '').trim()
  if (!s) return ''
  s = s.replace(/\s*#[0-9A-Z]{8,}$/i, '').trim()
  s = s.replace(/\s+/g, ' ')
  return s.toUpperCase()
}

/** 날짜·금액·정규화 설명 (방향 무시) */
function softFingerprint(row: {
  posted_date?: string
  postedDate?: string
  amount: number | string
  description: string | null
  raw?: Record<string, string> | null
}): string {
  const d = String(row.postedDate ?? row.posted_date ?? '').slice(0, 10)
  const amt = Number(row.amount)
  const a = Number.isFinite(amt) ? amt.toFixed(2) : String(row.amount)
  const desc = normalizeMatchDescription(row.description, row.raw)
  return `${d}|${a}|${desc}`
}

function parseArgs(argv: string[]) {
  const positional: string[] = []
  let accountName = 'WellsFargo (CC)'
  let apply = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') apply = true
    else if (a === '--account' && argv[i + 1]) {
      accountName = argv[++i]
    } else if (!a.startsWith('--')) positional.push(a)
  }
  const csvPath = positional[0]
  if (!csvPath) {
    console.error('Usage: statement-csv-fill-missing.ts <csv-path> [--account name] [--apply]')
    process.exit(1)
  }
  return { csvPath, accountName, apply }
}

async function fetchAllLinesForImportIds(importIds: string[]) {
  const out: {
    posted_date: string
    amount: number
    direction: string
    description: string | null
    raw: Record<string, string> | null
  }[] = []
  const chunk = 50
  for (let i = 0; i < importIds.length; i += chunk) {
    const slice = importIds.slice(i, i + chunk)
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from('statement_lines')
        .select('posted_date,amount,direction,description,raw')
        .in('statement_import_id', slice)
        .range(from, from + 999)
      if (error) throw error
      const rows = data || []
      out.push(...(rows as typeof out))
      if (rows.length < 1000) break
      from += 1000
    }
  }
  return out
}

function countByFingerprint<T>(items: T[], fn: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>()
  for (const item of items) {
    const k = fn(item)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

async function main() {
  const { csvPath, accountName, apply } = parseArgs(process.argv.slice(2))
  const csvText = readFileSync(csvPath, 'utf8')
  const baseName = csvPath.split(/[/\\]/).pop() ?? 'import.csv'

  const { data: accounts, error: accErr } = await supabase
    .from('financial_accounts')
    .select('id,name,account_type,statement_csv_direction_mode,operator_id')
    .ilike('name', accountName.replace(/[()]/g, '%').replace(/\s+/g, '%'))
  if (accErr) throw accErr

  const account =
    (accounts || []).find((a) => String(a.name).trim().toLowerCase() === accountName.trim().toLowerCase()) ||
    (accounts || []).find((a) => String(a.name).toLowerCase().includes('wells')) ||
    (accounts || [])[0]

  if (!account?.id) {
    console.error(`금융 계정을 찾지 못했습니다: "${accountName}"`)
    process.exit(1)
  }

  const operatorId =
    String((account as { operator_id?: string | null }).operator_id ?? '').trim() ||
    'a0000000-0000-4000-8000-000000000001'

  console.log(`계정: ${account.name} (${account.id}) operator=${operatorId}`)

  const invert = shouldInvertStatementCsvDirections(
    String(account.account_type ?? ''),
    account.statement_csv_direction_mode as string | null
  )
  console.log(`CSV 방향 반전: ${invert ? 'yes' : 'no'} (mode=${account.statement_csv_direction_mode ?? 'auto'})`)

  const parsed = parseStatementCsvText(csvText, { invertDirections: invert })
  console.log(`CSV 파싱: ${parsed.length}행`)

  const { data: imports, error: impErr } = await supabase
    .from('statement_imports')
    .select('id,period_start,period_end,original_filename,created_at')
    .eq('financial_account_id', account.id)
    .order('created_at', { ascending: true })
  if (impErr) throw impErr

  const importIds = (imports || []).map((im) => String(im.id))
  console.log(`기존 업로드: ${importIds.length}건`)

  const dbLines = importIds.length ? await fetchAllLinesForImportIds(importIds) : []
  console.log(`DB 명세 줄: ${dbLines.length}행`)

  if (dbLines.length > 0 && parsed.length > 0) {
    const sampleCsv = parsed[1] ?? parsed[0]
    const sameDate = dbLines.filter((l) => String(l.posted_date).slice(0, 10) === sampleCsv.postedDate)
    const nearAmt = sameDate.filter((l) => Math.abs(Number(l.amount) - sampleCsv.amount) < 0.02)
    console.log('\n[샘플] CSV:', {
      date: sampleCsv.postedDate,
      amount: sampleCsv.amount,
      direction: sampleCsv.direction,
      desc: sampleCsv.description.slice(0, 80)
    })
    if (nearAmt[0]) {
      console.log('[샘플] DB 유사:', {
        date: nearAmt[0].posted_date,
        amount: nearAmt[0].amount,
        direction: nearAmt[0].direction,
        desc: String(nearAmt[0].description ?? '').slice(0, 80)
      })
    } else if (sameDate[0]) {
      console.log('[샘플] DB 같은날:', sameDate[0])
    } else {
      const dbMin = dbLines.map((l) => String(l.posted_date).slice(0, 10)).sort()[0]
      const dbMax = dbLines.map((l) => String(l.posted_date).slice(0, 10)).sort().reverse()[0]
      const csvMin = parsed.map((r) => r.postedDate).sort()[0]
      const csvMax = parsed.map((r) => r.postedDate).sort().reverse()[0]
      console.log(`[범위] DB ${dbMin} ~ ${dbMax}  |  CSV ${csvMin} ~ ${csvMax}`)
      const vegas = dbLines.filter((l) =>
        String(l.description ?? '').toUpperCase().includes('VEGAS AUTO')
      )
      console.log(`[VEGAS AUTO in DB] ${vegas.length}건`, vegas[0] ?? '(없음)')
      const wy = dbLines.filter((l) => String(l.description ?? '').includes('WYNDHAM'))
      const wyCsv = parsed.filter((r) => r.description.includes('WYNDHAM'))
      console.log(`[WYNDHAM] DB ${wy.length} CSV ${wyCsv.length}`)
      if (wy[0] && wyCsv[0]) {
        console.log('  DB fp:', softFingerprint(wy[0]))
        console.log('  CSV fp:', softFingerprint(wyCsv[0]))
      }
    }
  }

  const dbCountsStrict = countByFingerprint(dbLines, lineFingerprint)
  const csvCountsStrict = countByFingerprint(parsed, parsedFingerprint)
  const dbCountsSoft = countByFingerprint(dbLines, (r) => softFingerprint(r))
  const csvCountsSoft = countByFingerprint(parsed, (r) => softFingerprint(r))

  const strictMissing = [...csvCountsStrict.entries()].reduce(
    (n, [fp, csvN]) => n + Math.max(0, csvN - (dbCountsStrict.get(fp) ?? 0)),
    0
  )
  const softMissing = [...csvCountsSoft.entries()].reduce(
    (n, [fp, csvN]) => n + Math.max(0, csvN - (dbCountsSoft.get(fp) ?? 0)),
    0
  )
  let softOverlap = 0
  for (const r of parsed) {
    if ((dbCountsSoft.get(softFingerprint(r)) ?? 0) > 0) softOverlap++
  }
  console.log(`[soft overlap] CSV 행 중 DB와 일치 ${softOverlap} / ${parsed.length}`)
  console.log(`엄격 매칭(날짜·금액·방향·설명): CSV만 ${strictMissing}행`)
  console.log(`유연 매칭(날짜·금액·설명, 방향 무시): CSV만 ${softMissing}행`)

  const useSoft = softMissing < strictMissing
  if (useSoft) {
    console.log('→ 기존 DB 방향이 CSV와 다를 수 있어 유연 매칭으로 누락을 계산합니다.')
  }

  const dbCounts = useSoft ? dbCountsSoft : dbCountsStrict
  const csvCounts = useSoft ? csvCountsSoft : csvCountsStrict
  const fpFn = useSoft
    ? (row: ParsedStatementRow) => softFingerprint(row)
    : (row: ParsedStatementRow) => parsedFingerprint(row)

  const toAdd: ParsedStatementRow[] = []
  const deficits = new Map<string, number>()

  for (const [fp, csvN] of csvCounts) {
    const dbN = dbCounts.get(fp) ?? 0
    const need = csvN - dbN
    if (need > 0) deficits.set(fp, need)
  }

  for (const row of parsed) {
    const fp = fpFn(row)
    const left = deficits.get(fp) ?? 0
    if (left > 0) {
      toAdd.push(row)
      deficits.set(fp, left - 1)
    }
  }

  const surplusInDb = [...dbCounts.entries()]
    .map(([fp, dbN]) => ({ fp, extra: dbN - (csvCounts.get(fp) ?? 0) }))
    .filter((x) => x.extra > 0)
    .sort((a, b) => b.extra - a.extra)

  console.log(`\n누락(추가 대상): ${toAdd.length}행`)
  if (surplusInDb.length) {
    console.log(`DB에만 더 많은 fingerprint (중복 업로드 등): ${surplusInDb.length}종`)
  }

  if (toAdd.length === 0) {
    console.log('추가할 행이 없습니다.')
    return
  }

  const preview = toAdd.slice(0, 25)
  for (const r of preview) {
    console.log(`  + ${r.postedDate} ${r.direction} ${r.amount.toFixed(2)} ${r.description.slice(0, 60)}`)
  }
  if (toAdd.length > 25) console.log(`  … 외 ${toAdd.length - 25}행`)

  if (!apply) {
    console.log('\n반영하려면 동일 명령에 --apply 를 붙이세요.')
    return
  }

  const dates = toAdd.map((r) => r.postedDate).sort()
  const periodStart = dates[0]
  const periodEnd = dates[dates.length - 1]

  const { data: imp, error: eImp } = await supabase
    .from('statement_imports')
    .insert({
      operator_id: operatorId,
      financial_account_id: account.id,
      period_label: periodStart.slice(0, 7),
      period_start: periodStart,
      period_end: periodEnd,
      status: 'imported',
      imported_by: 'statement-csv-fill-missing.ts',
      original_filename: `delta:${baseName}`.slice(0, 240),
      notes: `누락 ${toAdd.length}행 보정 (${new Date().toISOString()})`
    })
    .select('id')
    .single()

  if (eImp || !imp?.id) {
    console.error('statement_imports insert 실패', eImp)
    process.exit(1)
  }

  const importId = String(imp.id)
  const rows = toAdd.map((r, i) => ({
    operator_id: operatorId,
    statement_import_id: importId,
    posted_date: r.postedDate,
    amount: r.amount,
    direction: r.direction,
    description: r.description,
    merchant: r.merchant,
    external_reference: r.externalReference,
    dedupe_key: makeDedupeKey(importId, r, i),
    raw: r.raw,
    matched_status: 'unmatched' as const
  }))

  const chunk = 150
  for (let i = 0; i < rows.length; i += chunk) {
    const { error: e2 } = await supabase.from('statement_lines').insert(rows.slice(i, i + chunk))
    if (e2) {
      console.error('statement_lines insert 실패', e2)
      await supabase.from('statement_imports').delete().eq('id', importId)
      process.exit(1)
    }
  }

  console.log(`\n완료: import ${importId} 에 ${toAdd.length}행 추가 (${periodStart} ~ ${periodEnd})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
