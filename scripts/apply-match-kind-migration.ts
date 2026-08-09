import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

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

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260809010000_reconciliation_matches_match_kind.sql'),
  'utf8'
)

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(sql)
    const r = await client.query(
      `select column_name, data_type from information_schema.columns
       where table_schema='public' and table_name='reconciliation_matches' and column_name='match_kind'`
    )
    console.log('match_kind column:', r.rows)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
