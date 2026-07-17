/**
 * 초이스 옵션 재생성으로 예약 JSON(reservations.choices)의 option_id 가 orphan 된 경우,
 * 가격 다수결로 현재 살아있는 옵션에 매핑하여 choice_option_aliases 테이블을 채운다.
 *
 * 실행: node scripts/backfill-choice-option-aliases.mjs
 *
 * 옵션 재삽입(ChoicesTabNew) 이 upsert(ID 유지)로 고쳐졌으므로 신규 orphan 은 더 생기지 않는다.
 * 이 스크립트는 기존 과거 데이터 복구용이며 반복 실행해도 안전(멱등).
 */
import fs from 'fs'
import pg from 'pg'

const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/DATABASE_URL=(.+)/)[1].trim()
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await c.connect()

// 현재 살아있는 옵션 (choice_id 별 단가 목록)
const liveRes = await c.query(
  `select id, choice_id, option_name_ko, internal_name, adult_price::numeric as adult_price from choice_options`
)
const liveByChoice = new Map()
for (const o of liveRes.rows) {
  const arr = liveByChoice.get(o.choice_id) || []
  arr.push(o)
  liveByChoice.set(o.choice_id, arr)
}

// JSON 에 등장하는 orphan option_id 별 사용 내역
const itemsRes = await c.query(`
  select
    item->>'choice_id' as choice_id,
    item->>'option_id' as option_id,
    (item->>'total_price')::numeric as total_price,
    (item->>'quantity')::numeric as qty,
    coalesce(r.adults,0) as adults,
    coalesce(r.child,0) as child
  from reservations r
  cross join lateral jsonb_array_elements(r.choices->'required') as item
  where r.choices is not null
    and item->>'option_id' is not null
    and item->>'option_id' <> '__undecided__'
    and not exists (select 1 from choice_options co where co.id = (item->>'option_id')::uuid)
`)

// orphan 별 집계
const agg = new Map() // key: option_id -> { choice_id, votes: Map<liveId, count>, total }
for (const row of itemsRes.rows) {
  const key = row.option_id
  if (!agg.has(key)) agg.set(key, { choice_id: row.choice_id, votes: new Map(), total: 0, priced: 0 })
  const entry = agg.get(key)
  entry.total++

  const price = Number(row.total_price || 0)
  if (!(price > 0)) continue
  entry.priced++

  const live = liveByChoice.get(row.choice_id) || []
  if (live.length === 0) continue

  const qtys = [Number(row.qty || 1), row.adults + row.child, Number(row.adults), 1].filter((n) => n > 0)
  let matched = null

  for (const q of qtys) {
    const unit = price / q
    const hit = live.filter((o) => Math.abs(Number(o.adult_price) - unit) < 0.011)
    if (hit.length === 1) { matched = hit[0]; break }
  }
  if (!matched) {
    const div = live.filter((o) => {
      const p = Number(o.adult_price)
      return p > 0 && Math.abs(price / p - Math.round(price / p)) < 0.011
    })
    if (div.length === 1) matched = div[0]
  }
  if (matched) {
    entry.votes.set(matched.id, (entry.votes.get(matched.id) || 0) + 1)
  }
}

// 다수결 판정 후 삽입
let inserted = 0
const skipped = []
for (const [oldId, entry] of agg.entries()) {
  let best = null
  let bestCount = 0
  let secondCount = 0
  for (const [liveId, cnt] of entry.votes.entries()) {
    if (cnt > bestCount) { secondCount = bestCount; best = liveId; bestCount = cnt }
    else if (cnt > secondCount) secondCount = cnt
  }

  // 신뢰 기준: 최소 3표 이상 + 2위 대비 압도적(2위=0 또는 best가 90%+)
  const confident =
    best && bestCount >= 3 && (secondCount === 0 || bestCount / (bestCount + secondCount) >= 0.9)

  if (!confident) {
    skipped.push({ oldId, choice_id: entry.choice_id, total: entry.total, priced: entry.priced, votes: [...entry.votes] })
    continue
  }

  const live = (liveByChoice.get(entry.choice_id) || []).find((o) => o.id === best)
  await c.query(
    `insert into choice_option_aliases (old_option_id, choice_id, current_option_id, confidence, note)
     values ($1,$2,$3,'price_majority',$4)
     on conflict (old_option_id) do update
       set current_option_id = excluded.current_option_id,
           choice_id = excluded.choice_id,
           confidence = excluded.confidence,
           note = excluded.note`,
    [oldId, entry.choice_id, best, `votes=${bestCount}/${bestCount + secondCount} → ${live?.internal_name || live?.option_name_ko}`]
  )
  inserted++
  console.log(`ALIAS ${oldId.slice(0, 8)} (choice ${entry.choice_id.slice(0, 8)}) → ${best.slice(0, 8)} [${live?.internal_name || live?.option_name_ko}] votes=${bestCount}/${bestCount + secondCount}`)
}

console.log(`\n삽입/갱신: ${inserted}건`)
console.log(`\n판정 불가(가격 신호 부족, 스킵): ${skipped.length}건`)
for (const s of skipped) {
  console.log(`  skip ${s.oldId.slice(0, 8)} choice=${s.choice_id.slice(0, 8)} total=${s.total} priced=${s.priced} votes=${JSON.stringify(s.votes.map(([id, n]) => [id.slice(0, 8), n]))}`)
}

await c.end()
