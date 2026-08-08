/**
 * Auto-assign product tags from tour title/summary + tour course text.
 *
 * Prefer product names / summaries / course names over long boilerplate
 * (pickup, insurance, shared includes) to reduce false positives.
 *
 * Usage:
 *   npx tsx scripts/auto-tag-products-from-content.ts           # dry-run
 *   npx tsx scripts/auto-tag-products-from-content.ts --apply   # write to DB
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { KOVEgAS_OPERATOR_ID } from '../src/lib/operatorConstants'
import {
  HOME_DESTINATION_LINK_TAGS,
  HOME_TRAVEL_STYLE_LINK_TAGS,
} from '../src/lib/homeLinkTags'

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or service/anon key')
  process.exit(1)
}

const apply = process.argv.includes('--apply')
const supabase = createClient(url, key)

type Scope = 'title' | 'any'

type Rule = {
  key: string
  /** Match only names/summaries/course titles when 'title' */
  scope: Scope
  patterns: string[]
}

/** Skip homeLinkTags legacy queries that are too broad for auto-tagging. */
const SKIP_LEGACY = new Set([
  '시티',
  '쇼',
  '버스',
  '당일',
  '숙박',
  '공연',
  '불의',
  '이벤트',
  '쿠폰',
])

const RULES: Rule[] = [
  // Destinations — title preferred
  {
    key: 'las_vegas',
    scope: 'title',
    patterns: ['라스베가스', '라스베이거스', '라스 베이거스', 'las vegas'],
  },
  {
    key: 'grand_canyon',
    scope: 'any',
    patterns: ['그랜드캐년', '그랜드 캐년', '그랜드 캐니언', 'grand canyon'],
  },
  {
    key: 'grand_canyon_west',
    scope: 'any',
    patterns: ['웨스트림', '웨스트 림', 'west rim', 'grand canyon west', '스카이워크', 'skywalk'],
  },
  {
    key: 'grand_canyon_south',
    scope: 'any',
    patterns: ['사우스림', '사우스 림', 'south rim'],
  },
  {
    key: 'antelope_canyon',
    scope: 'any',
    patterns: ['앤텔롭', '안텔롭', '앤텔로프', 'antelope canyon', 'antelope'],
  },
  {
    key: 'upper_antelope',
    scope: 'any',
    patterns: ['어퍼앤텔롭', '어퍼 앤텔롭', 'upper antelope'],
  },
  {
    key: 'lower_antelope',
    scope: 'any',
    patterns: ['로워앤텔롭', '로워 앤텔롭', 'lower antelope'],
  },
  {
    key: 'zion',
    scope: 'any',
    patterns: ['자이언캐년', '자이언 캐년', 'zion canyon', 'zion national', 'zion'],
  },
  {
    key: 'bryce_canyon',
    scope: 'any',
    patterns: ['브라이스캐년', '브라이스 캐년', '브라이스', 'bryce'],
  },
  {
    key: 'horseshoe_bend',
    scope: 'any',
    patterns: ['홀슈밴드', '홀슈 밴드', '홀스슈', 'horseshoe bend', 'horseshoe'],
  },
  {
    key: 'death_valley',
    scope: 'any',
    patterns: ['데스밸리', '데스 밸리', 'death valley'],
  },
  {
    key: 'valley_of_fire',
    scope: 'any',
    patterns: ['불의계곡', '불의 계곡', 'valley of fire'],
  },
  {
    key: 'monument_valley',
    scope: 'any',
    patterns: ['모뉴먼트밸리', '모뉴먼트 밸리', 'monument valley', '모뉴먼트'],
  },
  {
    key: 'sedona',
    scope: 'any',
    patterns: ['세도나', 'sedona'],
  },
  {
    key: 'page',
    scope: 'title',
    patterns: ['페이지(', '페이지,', '페이지 ', 'page, az', 'page arizona', ' to page', '페이지 출발'],
  },
  {
    key: 'lake_powell',
    scope: 'any',
    patterns: ['레이크파월', '레이크 파월', '파월호', 'lake powell'],
  },
  {
    key: 'hoover_dam',
    scope: 'any',
    patterns: ['후버댐', '후버 댐', 'hoover dam'],
  },
  {
    key: 'red_rock',
    scope: 'any',
    patterns: ['레드락', '레드 락', 'red rock'],
  },
  {
    key: 'moab',
    scope: 'any',
    patterns: ['모아브', 'moab'],
  },
  {
    key: 'arches',
    scope: 'any',
    patterns: ['아치스', 'arches national', 'arches'],
  },
  {
    key: 'yosemite',
    scope: 'any',
    patterns: ['요세미티', 'yosemite'],
  },
  {
    key: 'san_francisco',
    scope: 'title',
    patterns: ['샌프란시스코', '샌프란', 'san francisco'],
  },
  {
    key: 'los_angeles',
    scope: 'title',
    patterns: ['로스앤젤레스', '로스 앤젤레스', 'los angeles', '엘에이'],
  },

  // Travel styles — mostly title to avoid shared body copy
  {
    key: 'day_tour',
    scope: 'title',
    patterns: ['당일투어', '당일 투어', '하루투어', 'day tour', 'day trip', '1일 투어', '1일투어'],
  },
  {
    key: 'overnight_tour',
    scope: 'title',
    patterns: ['숙박투어', '숙박 투어', '1박', '2박', '3박', 'overnight', '연박'],
  },
  {
    key: 'multi_day',
    scope: 'title',
    patterns: ['2박', '3박', '4박', '연박', 'multi-day', 'multiday', '여러날'],
  },
  {
    key: 'suburban_tour',
    scope: 'title',
    patterns: ['근교투어', '근교 투어', '근교'],
  },
  {
    key: 'city_tour',
    scope: 'title',
    patterns: ['시티투어', '시티 투어', 'city tour', '시내관광'],
  },
  {
    key: 'helicopter',
    scope: 'any',
    patterns: ['헬리콥터', '헬기', 'helicopter'],
  },
  {
    key: 'light_aircraft',
    scope: 'any',
    patterns: ['경비행기', '비행기투어', '비행기 투어', 'airplane tour', 'small aircraft'],
  },
  {
    key: 'bus_tour',
    scope: 'title',
    patterns: ['버스투어', '버스 투어', 'bus tour', '대형버스'],
  },
  {
    key: 'van_tour',
    scope: 'title',
    patterns: ['밴투어', '밴 투어', 'van tour', '미니밴'],
  },
  {
    key: 'premium_tour',
    scope: 'title',
    patterns: ['프리미엄', 'premium'],
  },
  {
    key: 'small_group',
    scope: 'title',
    patterns: ['소그룹', '소규모', 'small group'],
  },
  {
    key: 'private_tour',
    scope: 'title',
    patterns: ['단독투어', '단독 투어', '프라이빗', 'private tour', '전세'],
  },
  {
    key: 'show_ticket',
    scope: 'title',
    patterns: [
      '쇼티켓',
      '쇼 티켓',
      '매직 쇼',
      '매직쇼',
      '마이크 쇼',
      'show ticket',
      'cirque',
      '시르크',
      '공연 티켓',
      '공연티켓',
    ],
  },
  {
    key: 'attraction',
    scope: 'title',
    patterns: ['어트랙션', 'attraction', '테마파크', '입장권', '뮤지엄', 'museum'],
  },
  {
    key: 'event',
    scope: 'title',
    patterns: ['이벤트', 'event'],
  },
  {
    key: 'coupon',
    scope: 'title',
    patterns: ['쿠폰', 'coupon'],
  },
  {
    key: 'travel_insurance',
    scope: 'title',
    patterns: ['여행자보험', '여행자 보험', 'travel insurance'],
  },
  {
    key: 'convention',
    scope: 'title',
    patterns: ['컨벤션', 'convention', '통역'],
  },
  {
    key: 'sunrise',
    scope: 'title',
    patterns: ['일출', 'sunrise'],
  },
  {
    key: 'sunset',
    scope: 'title',
    patterns: ['일몰', 'sunset'],
  },
  {
    key: 'night_view',
    scope: 'title',
    patterns: ['야경', 'night view', 'night tour'],
  },
  {
    key: 'skywalk',
    scope: 'any',
    patterns: ['스카이워크', 'skywalk'],
  },
  {
    key: 'hiking',
    scope: 'title',
    patterns: ['하이킹', '트레킹', 'hiking'],
  },
  {
    key: 'jeep_tour',
    scope: 'any',
    patterns: ['지프투어', '지프 투어', 'jeep tour', 'jeep'],
  },
  {
    key: 'boat_tour',
    scope: 'any',
    patterns: ['보트투어', '보트 투어', '유람선', 'boat tour'],
  },
  {
    key: 'rafting',
    scope: 'any',
    patterns: ['래프팅', 'rafting'],
  },
  {
    key: 'photo_tour',
    scope: 'title',
    patterns: ['포토투어', '사진투어', 'photo tour'],
  },
  {
    key: 'korean_guide',
    scope: 'title',
    patterns: ['한국어 가이드', '한글 가이드', '한국어가이드', 'korean guide'],
  },
  {
    key: 'half_day',
    scope: 'title',
    patterns: ['반나절', 'half day', 'half-day'],
  },
  {
    key: 'full_day',
    scope: 'title',
    patterns: ['종일투어', '하루종일', 'full day', 'full-day'],
  },
  {
    key: 'family',
    scope: 'title',
    patterns: ['가족투어', '가족 투어', 'family tour', '아이동반'],
  },
]

function isBroadLegacy(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (SKIP_LEGACY.has(v)) return true
  if (v.length < 2) return true
  // Single short English word without space tends to over-match
  if (/^[a-z]+$/.test(v) && v.length <= 3) return true
  return false
}

function buildRules(): Rule[] {
  const byKey = new Map<string, Rule>()

  const add = (key: string, scope: Scope, patterns: string[]) => {
    const existing = byKey.get(key)
    const set = new Set(existing?.patterns ?? [])
    for (const pattern of patterns) {
      const trimmed = pattern.trim().toLowerCase()
      if (!trimmed || isBroadLegacy(trimmed)) continue
      set.add(trimmed)
    }
    byKey.set(key, {
      key,
      scope: existing?.scope === 'any' || scope === 'any' ? 'any' : 'title',
      patterns: [...set].sort((a, b) => b.length - a.length),
    })
  }

  for (const rule of RULES) {
    add(rule.key, rule.scope, rule.patterns)
  }

  // Seed labels from home link catalog (not broad legacy stubs)
  for (const def of [...HOME_DESTINATION_LINK_TAGS, ...HOME_TRAVEL_STYLE_LINK_TAGS]) {
    const scope: Scope = HOME_DESTINATION_LINK_TAGS.some((d) => d.key === def.key)
      ? 'any'
      : 'title'
    add(def.key, scope, [
      def.labelKo,
      def.labelEn,
      def.key.replace(/_/g, ' '),
      ...(def.legacyQueries ?? []).filter((q) => !isBroadLegacy(q)),
    ])
  }

  // las_vegas / city departures stay title-scoped even if home catalog marked any
  const titleOnly = new Set([
    'las_vegas',
    'san_francisco',
    'los_angeles',
    'day_tour',
    'overnight_tour',
    'multi_day',
    'suburban_tour',
    'city_tour',
    'bus_tour',
    'show_ticket',
    'attraction',
    'event',
    'coupon',
    'travel_insurance',
    'convention',
    'family',
    'page',
  ])
  for (const key of titleOnly) {
    const rule = byKey.get(key)
    if (rule) rule.scope = 'title'
  }

  return [...byKey.values()]
}

function normalizeCorpus(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function includesPattern(corpus: string, pattern: string): boolean {
  let from = 0
  while (from <= corpus.length) {
    const idx = corpus.indexOf(pattern, from)
    if (idx < 0) return false

    // Avoid 자이언트 matching 자이언
    if (pattern === '자이언' || pattern === '자이온') {
      const after = corpus.slice(idx + pattern.length, idx + pattern.length + 1)
      if (after === '트') {
        from = idx + 1
        continue
      }
    }

    // Short Latin tokens need word-ish boundaries
    if (/^[a-z][a-z\s\-]*[a-z]$/i.test(pattern) && !pattern.includes(' ')) {
      const before = idx === 0 ? ' ' : corpus[idx - 1]
      const after =
        idx + pattern.length >= corpus.length ? ' ' : corpus[idx + pattern.length]
      if (/[a-z0-9]/i.test(before) || /[a-z0-9]/i.test(after)) {
        from = idx + 1
        continue
      }
    }

    return true
  }
  return false
}

function inferTags(titleCorpus: string, bodyCorpus: string, rules: Rule[]): string[] {
  const matched = new Set<string>()
  for (const rule of rules) {
    const corpus = rule.scope === 'title' ? titleCorpus : `${titleCorpus}\n${bodyCorpus}`
    if (!corpus.trim()) continue
    for (const pattern of rule.patterns) {
      if (includesPattern(corpus, pattern)) {
        matched.add(rule.key)
        break
      }
    }
  }

  // Consistency / cleanup
  if (matched.has('grand_canyon_west') || matched.has('grand_canyon_south') || matched.has('skywalk')) {
    matched.add('grand_canyon')
  }
  if (matched.has('upper_antelope') || matched.has('lower_antelope')) {
    matched.add('antelope_canyon')
  }
  if (matched.has('skywalk')) {
    matched.add('grand_canyon_west')
  }
  if (matched.has('overnight_tour') || matched.has('multi_day')) {
    matched.delete('day_tour')
  }
  if (matched.has('multi_day')) {
    matched.add('overnight_tour')
  }

  // Titles ending with/containing standalone 쇼 (e.g. 매직 마이크 쇼)
  if (/(^|[\s|·/>])쇼(\s|$)/.test(titleCorpus) || titleCorpus.endsWith('쇼')) {
    matched.add('show_ticket')
  }

  return [...matched]
}

function mergeTags(existing: string[] | null | undefined, inferred: string[]): string[] {
  const next = new Set<string>()
  for (const tag of existing ?? []) {
    const value = tag.trim()
    if (value) next.add(value)
  }
  for (const tag of inferred) next.add(tag)
  return [...next]
}

function collectI18nText(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const out: string[] = []
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      out.push(node)
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      Object.values(node).forEach(walk)
    }
  }
  walk(value)
  return out
}

type ProductRow = {
  id: string
  name: string | null
  name_ko: string | null
  name_en: string | null
  customer_name_ko: string | null
  customer_name_en: string | null
  summary_ko: string | null
  summary_en: string | null
  description: string | null
  category: string | null
  sub_category: string | null
  duration: string | null
  departure_city: string | null
  arrival_city: string | null
  tags: string[] | null
  status: string | null
}

async function main() {
  const rules = buildRules()
  console.log(`Rules: ${rules.length} tag keys, apply=${apply}`)

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(
      'id, name, name_ko, name_en, customer_name_ko, customer_name_en, summary_ko, summary_en, description, category, sub_category, duration, departure_city, arrival_city, tags, status'
    )
    .eq('operator_id', KOVEgAS_OPERATOR_ID)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (productsError) throw productsError
  const rows = (products ?? []) as ProductRow[]
  console.log(`Products: ${rows.length}`)

  const productIds = rows.map((row) => row.id)
  const detailsByProduct = new Map<string, Record<string, unknown>>()
  const courseTitleByProduct = new Map<string, string[]>()
  const courseBodyByProduct = new Map<string, string[]>()

  for (let i = 0; i < productIds.length; i += 100) {
    const chunk = productIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('product_details')
      .select('product_id, description, slogan1, slogan2, slogan3')
      .in('product_id', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      detailsByProduct.set(String((row as { product_id: string }).product_id), row as Record<string, unknown>)
    }
  }

  for (let i = 0; i < productIds.length; i += 100) {
    const chunk = productIds.slice(i, i + 100)
    const { data, error } = await supabase
      .from('product_details_multilingual')
      .select('product_id, language_code, description, slogan1, slogan2, slogan3')
      .in('product_id', chunk)
      .in('language_code', ['ko', 'en'])
    if (error) {
      console.warn('product_details_multilingual skipped:', error.message)
    } else {
      for (const row of data ?? []) {
        const id = String((row as { product_id: string }).product_id)
        const prev = detailsByProduct.get(id) ?? {}
        detailsByProduct.set(id, {
          ...prev,
          [`ml_${(row as { language_code: string }).language_code}`]: row,
        })
      }
    }
  }

  for (let i = 0; i < productIds.length; i += 50) {
    const chunk = productIds.slice(i, i + 50)
    const { data, error } = await supabase
      .from('product_tour_courses')
      .select(
        `
        product_id,
        tour_courses(
          name_ko, name_en, customer_name_ko, customer_name_en,
          description_ko, description_en, customer_description_ko, customer_description_en,
          location, point_name, category, content_i18n
        )
      `
      )
      .in('product_id', chunk)

    if (error) throw error

    for (const row of data ?? []) {
      const productId = String((row as { product_id: string }).product_id)
      const joined = (row as { tour_courses?: Record<string, unknown> | Record<string, unknown>[] | null })
        .tour_courses
      const courses = !joined ? [] : Array.isArray(joined) ? joined : [joined]
      for (const course of courses) {
        const titles = [
          course.name_ko,
          course.name_en,
          course.customer_name_ko,
          course.customer_name_en,
          course.location,
          course.point_name,
          course.category,
        ].filter((value): value is string => typeof value === 'string')
        const bodies = [
          course.description_ko,
          course.description_en,
          course.customer_description_ko,
          course.customer_description_en,
          ...collectI18nText(course.content_i18n),
        ].filter((value): value is string => typeof value === 'string')
        courseTitleByProduct.set(productId, [...(courseTitleByProduct.get(productId) ?? []), ...titles])
        courseBodyByProduct.set(productId, [...(courseBodyByProduct.get(productId) ?? []), ...bodies])
      }
    }
  }

  let changed = 0
  let unchanged = 0
  let updated = 0
  const samples: Array<{ id: string; name: string; added: string[] }> = []
  const tagCounts = new Map<string, number>()

  for (const product of rows) {
    const details = detailsByProduct.get(product.id) ?? {}
    const mlKo = (details.ml_ko ?? {}) as Record<string, unknown>
    const mlEn = (details.ml_en ?? {}) as Record<string, unknown>

    const titleCorpus = normalizeCorpus([
      product.name,
      product.name_ko,
      product.name_en,
      product.customer_name_ko,
      product.customer_name_en,
      product.summary_ko,
      product.summary_en,
      product.category,
      product.sub_category,
      product.duration,
      product.departure_city,
      product.arrival_city,
      details.slogan1 as string,
      details.slogan2 as string,
      details.slogan3 as string,
      mlKo.slogan1 as string,
      mlKo.slogan2 as string,
      mlKo.slogan3 as string,
      mlEn.slogan1 as string,
      mlEn.slogan2 as string,
      mlEn.slogan3 as string,
      ...(courseTitleByProduct.get(product.id) ?? []),
    ])

    const bodyCorpus = normalizeCorpus([
      product.description,
      details.description as string,
      mlKo.description as string,
      mlEn.description as string,
      ...(courseBodyByProduct.get(product.id) ?? []),
    ])

    const inferred = inferTags(titleCorpus, bodyCorpus, rules)
    const nextTags = mergeTags(product.tags, inferred)
    const before = new Set((product.tags ?? []).map((tag) => tag.trim()).filter(Boolean))
    const added = nextTags.filter((tag) => !before.has(tag))

    for (const tag of added) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }

    if (added.length === 0) {
      unchanged += 1
      continue
    }

    changed += 1
    if (samples.length < 30) {
      samples.push({
        id: product.id,
        name: product.customer_name_ko || product.name_ko || product.name || product.id,
        added,
      })
    }

    if (apply) {
      const { error } = await supabase
        .from('products')
        .update({ tags: nextTags })
        .eq('id', product.id)
        .eq('operator_id', KOVEgAS_OPERATOR_ID)
      if (error) {
        console.error(`Failed ${product.id}:`, error.message)
      } else {
        updated += 1
      }
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        products: rows.length,
        productsWithNewTags: changed,
        unchanged,
        updated,
        topAddedTags: topTags,
        sample: samples,
      },
      null,
      2
    )
  )

  if (!apply) {
    console.log('\nRe-run with --apply to write tags to the database.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
