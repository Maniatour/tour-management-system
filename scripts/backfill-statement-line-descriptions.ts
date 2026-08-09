/**
 * WellsFargo 등 raw pipe 적요(description)를 사람이 읽는 형태로 백필하고 merchant를 채운다.
 * raw JSON은 그대로 두고 description/merchant만 갱신.
 *
 * Usage:
 *   npx tsx scripts/backfill-statement-line-descriptions.ts
 *   npx tsx scripts/backfill-statement-line-descriptions.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { normalizeImportedStatementFields } from '../src/lib/statement-field-normalize'

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
  console.error('Missing credentials')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  console.log(APPLY ? '=== APPLY ===' : '=== DRY-RUN ===')
  let scanned = 0
  let candidates = 0
  let updated = 0
  const samples: Array<{ id: string; before: string; after: string; merchant: string | null }> = []
  /** 업데이트하면 ilike 결과셋이 줄어들므로 id 커서 사용 */
  let lastId = '00000000-0000-0000-0000-000000000000'

  for (;;) {
    const { data, error } = await sb
      .from('statement_lines')
      .select('id, description, merchant')
      .or('description.ilike.%date:%,description.ilike.%descriptions:%')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(200)
    if (error) throw error
    const batch = (data || []) as Array<{
      id: string
      description: string | null
      merchant: string | null
    }>
    if (batch.length === 0) break

    for (const row of batch) {
      lastId = row.id
      scanned += 1
      const desc = String(row.description ?? '')
      if (!desc.includes('|') && !/descriptions?\s*:/i.test(desc)) continue
      const norm = normalizeImportedStatementFields(desc, row.merchant)
      if (norm.description === desc && (norm.merchant || null) === (row.merchant || null)) continue

      candidates += 1
      if (samples.length < 12) {
        samples.push({
          id: row.id,
          before: desc.slice(0, 80),
          after: norm.description.slice(0, 80),
          merchant: norm.merchant,
        })
      }

      if (APPLY) {
        const { error: upErr } = await sb
          .from('statement_lines')
          .update({
            description: norm.description,
            merchant: norm.merchant,
          })
          .eq('id', row.id)
        if (upErr) {
          console.error('update failed', row.id, upErr.message)
          continue
        }
        updated += 1
      }
    }
  }

  console.log('scanned', scanned, 'candidates', candidates, 'updated', updated)
  console.log('samples', JSON.stringify(samples, null, 2))
  if (!APPLY) console.log('Re-run with --apply to write.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
