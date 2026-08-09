/**
 * 2025 수동 매칭에서 (paid_to ↔ 명세 토큰) 별칭을 학습하고,
 * 미연결 고빈도 payment_methods 에 financial_account_id 를 연결한다.
 *
 * Usage:
 *   npx tsx scripts/learn-statement-match-aliases-from-2025.ts           # dry-run
 *   npx tsx scripts/learn-statement-match-aliases-from-2025.ts --apply   # write DB
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { formatStatementLineDescription } from '../src/lib/statement-display'
import {
  isBlockedPaidToForAliasLearning,
  normalizeVendorMatchText,
} from '../src/lib/statement-match-text'
import {
  buildPaymentMethodAccountIndex,
  resolvePaymentMethodAccountRow,
} from '../src/lib/payment-method-financial-account'

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    const key = line.slice(0, i).trim()
    let value = line.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const APPLY = process.argv.includes('--apply')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or service/anon key')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const ALIAS_MIN_COUNT = 5
/** 추가 연결용 — 1차보다 완화 */
const PM_MIN_COUNT = 5
const PM_DOMINANCE = 0.7
/** 공란 payment_method 백필: 해당 계정에서 가장 많이 쓰인 카드 */
const EMPTY_PM_MIN_COUNT = 8
const EMPTY_PM_DOMINANCE = 0.75

const BAD_ALIAS_NORMS = new Set(
  [
    'city of',
    'city',
    'parking',
    'tickets',
    'gas',
    'hotel',
    'payment',
    'purchase',
    'interest',
    'finance charge',
  ].map((s) => normalizeVendorMatchText(s))
)

/** 명세 적요에서 별칭 후보 (짧게 정규화, 의미 있는 앞부분 유지) */
function aliasTokenFromLine(description: string | null, merchant: string | null): string | null {
  const formatted = formatStatementLineDescription(description, merchant)
  if (!formatted || formatted === '—') return null
  let t = formatted.replace(/\s+/g, ' ').trim()

  // 끝의 주 코드만 제거 (AZ/NV/UT 등) — 도시명은 HSB/주유소 구분에 쓰일 수 있어 유지
  t = t.replace(/\s+[A-Z]{2}\s*$/i, '').trim()

  // 전화·참조 꼬리 축소
  t = t.replace(/\s+\d{3}[-.]?\d{3}[-.]?\d{4}\b.*$/i, '').trim()
  t = t.replace(/\s+#\d+\s*$/i, '').trim()

  // 앞쪽 의미 단위 유지 (최대 ~36자, 단어 경계)
  if (t.length > 36) {
    const cut = t.slice(0, 36)
    const sp = cut.lastIndexOf(' ')
    t = (sp >= 12 ? cut.slice(0, sp) : cut).trim()
  }

  const norm = normalizeVendorMatchText(t)
  if (norm.length < 6) return null
  if (BAD_ALIAS_NORMS.has(norm)) return null
  // 단어 2개 미만이면서 너무 일반적이면 제외
  const words = norm.split(' ').filter((w) => w.length >= 2)
  if (words.length < 2 && norm.length < 8) return null
  return t
}

async function fetchAllMatched2025Lines() {
  const lines: Array<{
    id: string
    posted_date: string
    description: string | null
    merchant: string | null
    statement_import_id: string
  }> = []
  let from = 0
  for (;;) {
    const { data, error } = await sb
      .from('statement_lines')
      .select('id,posted_date,description,merchant,statement_import_id')
      .gte('posted_date', '2025-01-01')
      .lt('posted_date', '2026-01-01')
      .in('matched_status', ['matched', 'partial'])
      .range(from, from + 999)
    if (error) throw error
    lines.push(...((data || []) as typeof lines))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return lines
}

async function main() {
  console.log(APPLY ? '=== APPLY mode ===' : '=== DRY-RUN (pass --apply to write) ===')

  const lines = await fetchAllMatched2025Lines()
  console.log('2025 matched lines:', lines.length)
  const lineById = new Map(lines.map((l) => [l.id, l]))

  const { data: imports } = await sb.from('statement_imports').select('id,financial_account_id')
  const impToAcc = new Map((imports || []).map((i: { id: string; financial_account_id: string }) => [i.id, i.financial_account_id]))
  const { data: accounts } = await sb.from('financial_accounts').select('id,name')
  const accName = new Map((accounts || []).map((a: { id: string; name: string }) => [a.id, a.name]))

  const matches: Array<{
    statement_line_id: string
    source_table: string
    source_id: string
  }> = []
  const lineIds = lines.map((l) => l.id)
  for (let i = 0; i < lineIds.length; i += 200) {
    const { data, error } = await sb
      .from('reconciliation_matches')
      .select('statement_line_id,source_table,source_id')
      .in('statement_line_id', lineIds.slice(i, i + 200))
      .in('source_table', ['tour_expenses', 'company_expenses', 'reservation_expenses'])
    if (error) throw error
    matches.push(...((data || []) as typeof matches))
  }
  console.log('expense matches:', matches.length)

  const byTable: Record<string, string[]> = {}
  for (const m of matches) {
    ;(byTable[m.source_table] ||= []).push(m.source_id)
  }
  const expenseByKey = new Map<string, { paid_to: string | null; payment_method: string | null }>()
  for (const [table, ids] of Object.entries(byTable)) {
    const uniq = [...new Set(ids)]
    for (let i = 0; i < uniq.length; i += 100) {
      const { data, error } = await sb
        .from(table)
        .select('id,paid_to,payment_method')
        .in('id', uniq.slice(i, i + 100))
      if (error) throw error
      for (const r of (data || []) as Array<{ id: string; paid_to: string | null; payment_method: string | null }>) {
        expenseByKey.set(`${table}:${r.id}`, {
          paid_to: r.paid_to,
          payment_method: r.payment_method,
        })
      }
    }
  }

  // --- Alias learning ---
  type PairAgg = { paidTo: string; alias: string; count: number }
  const pairCounts = new Map<string, PairAgg>()

  for (const m of matches) {
    const line = lineById.get(m.statement_line_id)
    const exp = expenseByKey.get(`${m.source_table}:${m.source_id}`)
    if (!line || !exp?.paid_to) continue
    const paidTo = String(exp.paid_to).trim()
    if (isBlockedPaidToForAliasLearning(paidTo)) continue

    const alias = aliasTokenFromLine(line.description, line.merchant)
    if (!alias) continue

    const paidNorm = normalizeVendorMatchText(paidTo)
    const aliasNorm = normalizeVendorMatchText(alias)
    if (!aliasNorm || aliasNorm === paidNorm) continue
    // 이미 paid_to 토큰이 명세에 있으면 별칭 불필요
    if (aliasNorm.includes(paidNorm.split(' ')[0] || '___') && (paidNorm.split(' ')[0] || '').length >= 4) {
      continue
    }
    const firstPaid = paidNorm.split(' ')[0] || ''
    if (firstPaid.length >= 3 && aliasNorm.includes(firstPaid)) continue

    const key = `${paidNorm}||${aliasNorm}`
    const prev = pairCounts.get(key)
    if (prev) prev.count += 1
    else pairCounts.set(key, { paidTo, alias, count: 1 })
  }

  const learnedPairs = [...pairCounts.values()]
    .filter((p) => p.count >= ALIAS_MIN_COUNT)
    .sort((a, b) => b.count - a.count)

  console.log(`\nLearned alias pairs (>=${ALIAS_MIN_COUNT}):`, learnedPairs.length)
  for (const p of learnedPairs.slice(0, 40)) {
    console.log(`  [${p.count}] ${p.paidTo}  <=  ${p.alias}`)
  }

  const { data: vendors } = await sb.from('expense_vendors').select('id,name,match_aliases')
  const vendorsList = (vendors || []) as Array<{
    id: string
    name: string
    match_aliases: string[] | null
  }>
  const vendorByNorm = new Map(
    vendorsList.map((v) => [normalizeVendorMatchText(v.name), v] as const)
  )

  const aliasUpdates: Array<{ id: string; name: string; aliases: string[]; added: string[] }> = []
  const vendorCreates: Array<{ name: string; aliases: string[] }> = []

  const aliasesByPaid = new Map<string, { paidTo: string; aliases: Map<string, string> }>()
  for (const p of learnedPairs) {
    const nk = normalizeVendorMatchText(p.paidTo)
    let bucket = aliasesByPaid.get(nk)
    if (!bucket) {
      bucket = { paidTo: p.paidTo, aliases: new Map() }
      aliasesByPaid.set(nk, bucket)
    }
    bucket.aliases.set(normalizeVendorMatchText(p.alias), p.alias)
  }

  for (const { paidTo, aliases } of aliasesByPaid.values()) {
    const existing = vendorByNorm.get(normalizeVendorMatchText(paidTo))
    const newAliases = [...aliases.values()]
    if (existing) {
      const current = (existing.match_aliases ?? []).map((a) => String(a).trim()).filter(Boolean)
      const currentNorm = new Set(current.map((a) => normalizeVendorMatchText(a)))
      const added = newAliases.filter((a) => !currentNorm.has(normalizeVendorMatchText(a)))
      if (added.length === 0) continue
      aliasUpdates.push({
        id: existing.id,
        name: existing.name,
        aliases: [...new Set([...current, ...added])],
        added,
      })
    } else {
      vendorCreates.push({ name: paidTo, aliases: newAliases })
    }
  }

  console.log('\nVendor alias updates:', aliasUpdates.length)
  for (const u of aliasUpdates.slice(0, 25)) {
    console.log(`  update ${u.name}: +${u.added.join(' | ')}`)
  }
  console.log('Vendor creates:', vendorCreates.length)
  for (const c of vendorCreates.slice(0, 25)) {
    console.log(`  create ${c.name}: ${c.aliases.join(' | ')}`)
  }

  // --- Payment method linking ---
  const { data: pms } = await sb
    .from('payment_methods')
    .select('id,method,display_name,financial_account_id')
  const pmRows = (pms || []) as Array<{
    id: string
    method: string | null
    display_name: string | null
    financial_account_id: string | null
  }>
  const pmIndex = buildPaymentMethodAccountIndex(pmRows)

  type PmAccCount = Map<string, number>
  const pmCooccur = new Map<string, PmAccCount>() // pm lookup key → accountId → count

  for (const m of matches) {
    const line = lineById.get(m.statement_line_id)
    const exp = expenseByKey.get(`${m.source_table}:${m.source_id}`)
    if (!line || !exp?.payment_method) continue
    const pmRaw = String(exp.payment_method).trim()
    if (!pmRaw) continue
    const acc = impToAcc.get(line.statement_import_id)
    if (!acc) continue
    const resolved = resolvePaymentMethodAccountRow(pmRaw, pmIndex)
    const pmId = resolved?.id
    if (!pmId) continue
    // only care about currently unlinked
    if (resolved.financial_account_id) continue
    let map = pmCooccur.get(pmId)
    if (!map) {
      map = new Map()
      pmCooccur.set(pmId, map)
    }
    map.set(acc, (map.get(acc) || 0) + 1)
  }

  const pmLinks: Array<{ id: string; method: string; accountId: string; accountName: string; n: number; ratio: number }> = []
  const GENERIC_PM = new Set(
    ['card', 'credit_card', 'credit card', 'debit', 'debit_card', 'other', 'cash', 'check', 'paypal', 'venmo', 'zelle', 'square'].map(
      (s) => s.toLowerCase()
    )
  )
  for (const [pmId, counts] of pmCooccur) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    if (total < PM_MIN_COUNT) continue
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (!best) continue
    const ratio = best[1] / total
    if (ratio < PM_DOMINANCE) continue
    const pm = pmRows.find((p) => p.id === pmId)
    if (!pm || pm.financial_account_id) continue
    const methodLabel = String(pm.method || pm.display_name || '').trim()
    if (GENERIC_PM.has(methodLabel.toLowerCase())) continue
    pmLinks.push({
      id: pmId,
      method: methodLabel || pmId,
      accountId: best[0],
      accountName: accName.get(best[0]) || best[0],
      n: total,
      ratio,
    })
  }
  pmLinks.sort((a, b) => b.n - a.n)

  console.log(`\nPM links (>=${PM_MIN_COUNT}, >=${PM_DOMINANCE * 100}%):`, pmLinks.length)
  for (const l of pmLinks) {
    console.log(`  ${l.method} → ${l.accountName} (n=${l.n}, ${(l.ratio * 100).toFixed(0)}%)`)
  }

  // --- Empty payment_method backfill suggestions (per account dominant PM) ---
  // accountId → method string → count (only non-empty resolvable PMs with FA linked)
  const accountPmCounts = new Map<string, Map<string, number>>()
  const emptyExpenseKeys: Array<{ table: string; id: string; accountId: string }> = []

  for (const m of matches) {
    const line = lineById.get(m.statement_line_id)
    const exp = expenseByKey.get(`${m.source_table}:${m.source_id}`)
    if (!line || !exp) continue
    const acc = impToAcc.get(line.statement_import_id)
    if (!acc) continue
    const pmRaw = String(exp.payment_method ?? '').trim()
    if (!pmRaw) {
      emptyExpenseKeys.push({ table: m.source_table, id: m.source_id, accountId: acc })
      continue
    }
    const resolved = resolvePaymentMethodAccountRow(pmRaw, pmIndex)
    if (!resolved?.financial_account_id) continue
    // store the canonical method string for writing back
    const methodVal = String(resolved.method || pmRaw).trim()
    let map = accountPmCounts.get(acc)
    if (!map) {
      map = new Map()
      accountPmCounts.set(acc, map)
    }
    map.set(methodVal, (map.get(methodVal) || 0) + 1)
  }

  const accountDefaultPm = new Map<string, { method: string; n: number; ratio: number }>()
  for (const [acc, counts] of accountPmCounts) {
    const total = [...counts.values()].reduce((a, b) => a + b, 0)
    if (total < EMPTY_PM_MIN_COUNT) continue
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (!best) continue
    const ratio = best[1] / total
    if (ratio < EMPTY_PM_DOMINANCE) continue
    accountDefaultPm.set(acc, { method: best[0], n: total, ratio })
  }

  const emptyPmUpdates: Array<{ table: string; id: string; method: string; accountName: string }> = []
  const seenEmpty = new Set<string>()
  for (const row of emptyExpenseKeys) {
    const key = `${row.table}:${row.id}`
    if (seenEmpty.has(key)) continue
    seenEmpty.add(key)
    const def = accountDefaultPm.get(row.accountId)
    if (!def) continue
    emptyPmUpdates.push({
      table: row.table,
      id: row.id,
      method: def.method,
      accountName: accName.get(row.accountId) || row.accountId,
    })
  }

  console.log('\nAccount default PM for empty backfill:')
  for (const [acc, def] of accountDefaultPm) {
    console.log(`  ${accName.get(acc)} → ${def.method} (n=${def.n}, ${(def.ratio * 100).toFixed(0)}%)`)
  }
  console.log('Empty payment_method expenses to fill:', emptyPmUpdates.length)

  if (!APPLY) {
    console.log('\nDry-run complete. Re-run with --apply to write.')
    return
  }

  let aliasWrite = 0
  for (const u of aliasUpdates) {
    const { error } = await sb
      .from('expense_vendors')
      .update({ match_aliases: u.aliases })
      .eq('id', u.id)
    if (error) {
      console.error('alias update failed', u.name, error.message)
      continue
    }
    aliasWrite += 1
  }
  for (const c of vendorCreates) {
    const { error } = await sb.from('expense_vendors').insert({
      name: c.name,
      usage_type: 'reusable',
      match_aliases: c.aliases,
    })
    if (error) {
      // 이름 충돌 시 기존 행에 별칭만 병합 시도
      const existing = vendorByNorm.get(normalizeVendorMatchText(c.name))
      if (existing) {
        const merged = [...new Set([...(existing.match_aliases ?? []), ...c.aliases])]
        const { error: e2 } = await sb
          .from('expense_vendors')
          .update({ match_aliases: merged })
          .eq('id', existing.id)
        if (e2) console.error('alias merge failed', c.name, e2.message)
        else aliasWrite += 1
      } else {
        console.error('vendor create failed', c.name, error.message)
      }
      continue
    }
    aliasWrite += 1
  }

  let pmWrite = 0
  for (const l of pmLinks) {
    const { error } = await sb
      .from('payment_methods')
      .update({ financial_account_id: l.accountId })
      .eq('id', l.id)
      .is('financial_account_id', null)
    if (error) {
      console.error('pm link failed', l.method, error.message)
      continue
    }
    pmWrite += 1
  }

  let emptyPmWrite = 0
  for (const u of emptyPmUpdates) {
    const { error } = await sb
      .from(u.table)
      .update({ payment_method: u.method })
      .eq('id', u.id)
      .or('payment_method.is.null,payment_method.eq.')
    if (error) {
      // fallback: only null
      const { error: e2 } = await sb
        .from(u.table)
        .update({ payment_method: u.method })
        .eq('id', u.id)
        .is('payment_method', null)
      if (e2) {
        console.error('empty pm fill failed', u.table, u.id, e2.message)
        continue
      }
    }
    emptyPmWrite += 1
  }

  console.log(
    `\nApplied: vendor alias rows=${aliasWrite}, payment_methods linked=${pmWrite}, empty PM filled=${emptyPmWrite}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
