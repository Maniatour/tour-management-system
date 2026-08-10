/**
 * Fill missing i18n for active+published products (ja/zh-CN/zh-TW/es/fr/de).
 * Uses Google translate_a/single?client=gtx + travel glossary polish.
 *
 * Prefer EN source; fall back to KO→EN→target.
 * Cache + resume. Skips empty sources.
 *
 * node scripts/fill-active-published-product-i18n.mjs
 * node scripts/fill-active-published-product-i18n.mjs --dry-run
 * node scripts/fill-active-published-product-i18n.mjs --product=MDGC1D
 * node scripts/fill-active-published-product-i18n.mjs --short-only
 * node scripts/fill-active-published-product-i18n.mjs --long-only
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })

const TARGETS = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const DETAIL_FIELDS = [
  'slogan1',
  'slogan2',
  'slogan3',
  'slogan4',
  'slogan5',
  'description',
  'included',
  'not_included',
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'notice_info',
  'vehicle_info',
  'cancellation_policy',
]
const BASIC_FIELDS = ['name', 'customer_name', 'summary']
const SHORT_DETAIL = new Set(['slogan1', 'slogan2', 'slogan3', 'slogan4', 'slogan5'])
const SHORT_BASIC = new Set(['name', 'customer_name', 'summary'])

const CACHE_PATH = path.join(root, 'tmp-active-published-gtx-cache.json')
const LOG_PATH = path.join(root, 'tmp-active-published-i18n.log')
const PROGRESS_PATH = path.join(root, 'tmp-active-published-i18n-progress.json')

const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry-run')
const SHORT_ONLY = args.has('--short-only')
const LONG_ONLY = args.has('--long-only')
const productArg = [...args].find((a) => a.startsWith('--product='))
const ONLY_PRODUCT = productArg ? productArg.split('=')[1] : null

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GTX_TL = {
  ja: 'ja',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  es: 'es',
  fr: 'fr',
  de: 'de',
  en: 'en',
  ko: 'ko',
}

/** Travel / brand glossary applied after MT (longest keys first). */
const GLOSSARY = [
  // Brand / product nicknames
  [/Night Goblin/gi, { ja: 'ナイトゴブリン', 'zh-CN': '夜精灵', 'zh-TW': '夜精靈', es: 'Night Goblin', fr: 'Night Goblin', de: 'Night Goblin' }],
  [/밤도깨비/g, { ja: 'ナイトゴブリン', 'zh-CN': '夜精灵', 'zh-TW': '夜精靈', es: 'Night Goblin', fr: 'Night Goblin', de: 'Night Goblin' }],
  // Places
  [/Horseshoe Bend/gi, { ja: 'ホースシューベンド', 'zh-CN': '马蹄湾', 'zh-TW': '馬蹄灣', es: 'Horseshoe Bend', fr: 'Horseshoe Bend', de: 'Horseshoe Bend' }],
  [/Antelope Canyon/gi, { ja: 'アンテロープキャニオン', 'zh-CN': '羚羊峡谷', 'zh-TW': '羚羊峽谷', es: 'Antelope Canyon', fr: 'Antelope Canyon', de: 'Antelope Canyon' }],
  [/Grand Canyon West/gi, { ja: 'グランドキャニオン・ウェスト', 'zh-CN': '大峡谷西缘', 'zh-TW': '大峽谷西緣', es: 'Grand Canyon West', fr: 'Grand Canyon West', de: 'Grand Canyon West' }],
  [/Grand Canyon/gi, { ja: 'グランドキャニオン', 'zh-CN': '大峡谷', 'zh-TW': '大峽谷', es: 'Gran Cañón', fr: 'Grand Canyon', de: 'Grand Canyon' }],
  [/Monument Valley/gi, { ja: 'モニュメントバレー', 'zh-CN': '纪念碑谷', 'zh-TW': '紀念碑谷', es: 'Monument Valley', fr: 'Monument Valley', de: 'Monument Valley' }],
  [/Bryce Canyon/gi, { ja: 'ブライスキャニオン', 'zh-CN': '布莱斯峡谷', 'zh-TW': '布萊斯峽谷', es: 'Bryce Canyon', fr: 'Bryce Canyon', de: 'Bryce Canyon' }],
  [/Zion National Park/gi, { ja: 'ザイオン国立公園', 'zh-CN': '锡安国家公园', 'zh-TW': '錫安國家公園', es: 'Parque Nacional Zion', fr: 'Parc national de Zion', de: 'Zion-Nationalpark' }],
  [/\bZion\b/gi, { ja: 'ザイオン', 'zh-CN': '锡安', 'zh-TW': '錫安', es: 'Zion', fr: 'Zion', de: 'Zion' }],
  [/Arches National Park/gi, { ja: 'アーチーズ国立公園', 'zh-CN': '拱门国家公园', 'zh-TW': '拱門國家公園', es: 'Parque Nacional Arches', fr: 'Parc national des Arches', de: 'Arches-Nationalpark' }],
  [/Canyonlands/gi, { ja: 'キャニオンランズ', 'zh-CN': '峡谷地', 'zh-TW': '峽谷地', es: 'Canyonlands', fr: 'Canyonlands', de: 'Canyonlands' }],
  [/Valley of Fire/gi, { ja: 'バレー・オブ・ファイア', 'zh-CN': '火谷', 'zh-TW': '火谷', es: 'Valley of Fire', fr: 'Valley of Fire', de: 'Valley of Fire' }],
  [/Death Valley/gi, { ja: 'デスバレー', 'zh-CN': '死亡谷', 'zh-TW': '死亡谷', es: 'Valle de la Muerte', fr: 'Vallée de la Mort', de: 'Death Valley' }],
  [/Hoover Dam/gi, { ja: 'フーバーダム', 'zh-CN': '胡佛大坝', 'zh-TW': '胡佛大壩', es: 'Presa Hoover', fr: 'Barrage Hoover', de: 'Hoover-Damm' }],
  [/Seven Magic Mountains/gi, { ja: 'セブンマジックマウンテン', 'zh-CN': '七魔法山', 'zh-TW': '七魔法山', es: 'Seven Magic Mountains', fr: 'Seven Magic Mountains', de: 'Seven Magic Mountains' }],
  [/Las Vegas/gi, { ja: 'ラスベガス', 'zh-CN': '拉斯维加斯', 'zh-TW': '拉斯維加斯', es: 'Las Vegas', fr: 'Las Vegas', de: 'Las Vegas' }],
  [/Muir Woods/gi, { ja: 'ミューアウッズ', 'zh-CN': '缪尔森林', 'zh-TW': '繆爾森林', es: 'Muir Woods', fr: 'Muir Woods', de: 'Muir Woods' }],
  [/Sausalito/gi, { ja: 'ソーサリート', 'zh-CN': '索萨利托', 'zh-TW': '索薩利托', es: 'Sausalito', fr: 'Sausalito', de: 'Sausalito' }],
  [/South Rim/gi, { ja: 'サウスリム', 'zh-CN': '南缘', 'zh-TW': '南緣', es: 'South Rim', fr: 'South Rim', de: 'South Rim' }],
  [/East Rim/gi, { ja: 'イーストリム', 'zh-CN': '东缘', 'zh-TW': '東緣', es: 'East Rim', fr: 'East Rim', de: 'East Rim' }],
  [/West Rim/gi, { ja: 'ウェストリム', 'zh-CN': '西缘', 'zh-TW': '西緣', es: 'West Rim', fr: 'West Rim', de: 'West Rim' }],
  [/Grand Circle/gi, { ja: 'グランドサークル', 'zh-CN': '大环线', 'zh-TW': '大環線', es: 'Grand Circle', fr: 'Grand Circle', de: 'Grand Circle' }],
  [/Rhyolite/gi, { ja: 'ライオライト', 'zh-CN': '莱奥莱特', 'zh-TW': '萊奧萊特', es: 'Rhyolite', fr: 'Rhyolite', de: 'Rhyolite' }],
  [/Bellagio/gi, { ja: 'ベラージオ', 'zh-CN': '贝拉吉奥', 'zh-TW': '貝拉吉歐', es: 'Bellagio', fr: 'Bellagio', de: 'Bellagio' }],
  // Korean place names often left untranslated by MT
  [/그랜드캐년/g, { ja: 'グランドキャニオン', 'zh-CN': '大峡谷', 'zh-TW': '大峽谷', es: 'Gran Cañón', fr: 'Grand Canyon', de: 'Grand Canyon' }],
  [/앤텔롭캐년|앤텔로프\s*캐년/g, { ja: 'アンテロープキャニオン', 'zh-CN': '羚羊峡谷', 'zh-TW': '羚羊峽谷', es: 'Antelope Canyon', fr: 'Antelope Canyon', de: 'Antelope Canyon' }],
  [/홀슈밴드|호스슈\s*벤드/g, { ja: 'ホースシューベンド', 'zh-CN': '马蹄湾', 'zh-TW': '馬蹄灣', es: 'Horseshoe Bend', fr: 'Horseshoe Bend', de: 'Horseshoe Bend' }],
  [/라스베가스|라스베이거스/g, { ja: 'ラスベガス', 'zh-CN': '拉斯维加斯', 'zh-TW': '拉斯維加斯', es: 'Las Vegas', fr: 'Las Vegas', de: 'Las Vegas' }],
  [/자이언/g, { ja: 'ザイオン', 'zh-CN': '锡安', 'zh-TW': '錫安', es: 'Zion', fr: 'Zion', de: 'Zion' }],
  [/브라이스/g, { ja: 'ブライス', 'zh-CN': '布莱斯', 'zh-TW': '布萊斯', es: 'Bryce', fr: 'Bryce', de: 'Bryce' }],
  [/모뉴먼트밸리/g, { ja: 'モニュメントバレー', 'zh-CN': '纪念碑谷', 'zh-TW': '紀念碑谷', es: 'Monument Valley', fr: 'Monument Valley', de: 'Monument Valley' }],
  [/데스밸리/g, { ja: 'デスバレー', 'zh-CN': '死亡谷', 'zh-TW': '死亡谷', es: 'Valle de la Muerte', fr: 'Vallée de la Mort', de: 'Death Valley' }],
  [/후버댐/g, { ja: 'フーバーダム', 'zh-CN': '胡佛大坝', 'zh-TW': '胡佛大壩', es: 'Presa Hoover', fr: 'Barrage Hoover', de: 'Hoover-Damm' }],
  [/소규모\s*그룹/g, { ja: '少人数グループ', 'zh-CN': '小团', 'zh-TW': '小團', es: 'grupo reducido', fr: 'petit groupe', de: 'Kleine Gruppe' }],
  [/프리미엄/g, { ja: 'プレミアム', 'zh-CN': '精品', 'zh-TW': '精品', es: 'premium', fr: 'premium', de: 'Premium' }],
]

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_PATH, line + '\n')
}

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
}

function filled(v) {
  return (
    String(v ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .trim().length > 0
  )
}

function isShortJob(job) {
  if (job.kind === 'field') return SHORT_BASIC.has(job.fieldKey)
  if (job.kind === 'detail') return SHORT_DETAIL.has(job.fieldKey)
  return true
}

function applyGlossary(text, locale) {
  let out = String(text ?? '')
  for (const [re, map] of GLOSSARY) {
    const rep = map[locale]
    if (!rep) continue
    out = out.replace(re, rep)
  }
  return out
}

function parseGtx(jsonText) {
  const data = JSON.parse(jsonText)
  if (!Array.isArray(data?.[0])) return ''
  return data[0]
    .map((part) => (Array.isArray(part) ? part[0] : ''))
    .filter(Boolean)
    .join('')
}

function chunkText(text, maxLen = 1400) {
  const s = String(text)
  if (s.length <= maxLen) return [s]
  const parts = []
  let buf = ''
  for (const para of s.split(/(\n+)/)) {
    if ((buf + para).length > maxLen && buf) {
      parts.push(buf)
      buf = para
    } else buf += para
    while (buf.length > maxLen) {
      parts.push(buf.slice(0, maxLen))
      buf = buf.slice(maxLen)
    }
  }
  if (buf) parts.push(buf)
  return parts
}

function loadCache() {
  return loadJson(CACHE_PATH, {})
}

function saveCache(cache) {
  saveJson(CACHE_PATH, cache)
}

async function gtxTranslate(text, from, to) {
  if (!text?.trim()) return ''
  if (from === to) return text
  const cache = loadCache()
  const key = `gtx::${from}::${to}::${text}`
  if (cache[key]) return applyGlossary(cache[key], to)

  const chunks = chunkText(text)
  const out = []
  for (const chunk of chunks) {
    let translated = null
    for (let attempt = 1; attempt <= 12; attempt++) {
      try {
        const url =
          'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
          encodeURIComponent(GTX_TL[from] || from) +
          '&tl=' +
          encodeURIComponent(GTX_TL[to] || to) +
          '&dt=t&q=' +
          encodeURIComponent(chunk)
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        translated = parseGtx(await res.text())
        if (!translated) throw new Error('empty translation')
        break
      } catch (err) {
        const wait = Math.min(60000, 1200 * attempt)
        log(`retry ${attempt} ${from}->${to} wait ${wait}ms ${err.message || err}`)
        await new Promise((r) => setTimeout(r, wait))
      }
    }
    if (!translated) throw new Error(`gtx failed ${from}->${to}`)
    out.push(translated)
    await new Promise((r) => setTimeout(r, 280))
  }

  const result = out.join('')
  cache[key] = result
  saveCache(cache)
  return applyGlossary(result, to)
}

async function translateSmart(sourceText, sourceLang, targetLocale) {
  if (sourceLang === targetLocale) return sourceText
  // Prefer EN pivot for consistency across targets
  if (sourceLang === 'en') {
    return gtxTranslate(sourceText, 'en', targetLocale)
  }
  const en = await gtxTranslate(sourceText, sourceLang, 'en')
  if (targetLocale === 'en') return en
  return gtxTranslate(en, 'en', targetLocale)
}

function jobKey(job) {
  return [
    job.kind,
    job.productId,
    job.fieldKey || '',
    job.choiceId || '',
    job.optionId || '',
    job.courseId || '',
    job.locale,
  ].join('::')
}

async function collectJobs() {
  let q = sb
    .from('products')
    .select(
      'id, name, product_code, customer_name_ko, customer_name_en, name_ko, name_en, summary_ko, summary_en'
    )
    .eq('status', 'active')
    .eq('is_published', true)
  if (ONLY_PRODUCT) {
    q = q.or(`product_code.eq.${ONLY_PRODUCT},id.eq.${ONLY_PRODUCT}`)
  }
  const { data: products, error } = await q.order('name')
  if (error) throw error

  const ids = (products || []).map((p) => p.id)
  if (!ids.length) return []

  const [{ data: fieldRows }, { data: detailRows }, { data: choices }, { data: courses }] =
    await Promise.all([
      sb.from('product_field_translations').select('*').in('product_id', ids),
      sb.from('product_details_multilingual').select('*').in('product_id', ids).is('channel_id', null),
      sb
        .from('product_choices')
        .select('id, product_id, choice_name, choice_name_ko, choice_name_en, content_i18n')
        .in('product_id', ids),
      sb
        .from('tour_courses')
        .select(
          'id, product_id, name, customer_name_ko, customer_name_en, customer_description_ko, customer_description_en, content_i18n'
        )
        .in('product_id', ids),
    ])

  const choiceIds = (choices || []).map((c) => c.id)
  const { data: options } = choiceIds.length
    ? await sb
        .from('choice_options')
        .select(
          'id, choice_id, option_name, option_name_ko, option_name_en, content_i18n'
        )
        .in('choice_id', choiceIds)
    : { data: [] }

  const jobs = []

  for (const p of products || []) {
    const fields = (fieldRows || []).filter((f) => f.product_id === p.id)
    const details = (detailRows || []).filter((d) => d.product_id === p.id)
    const koD = details.find((d) => d.language_code === 'ko')
    const enD = details.find((d) => d.language_code === 'en')

    const basicSource = {
      name: {
        en: fields.find((f) => f.field_key === 'name' && f.locale === 'en')?.value || p.name_en || p.name,
        ko: fields.find((f) => f.field_key === 'name' && f.locale === 'ko')?.value || p.name_ko || p.name,
      },
      customer_name: {
        en:
          fields.find((f) => f.field_key === 'customer_name' && f.locale === 'en')?.value ||
          p.customer_name_en,
        ko:
          fields.find((f) => f.field_key === 'customer_name' && f.locale === 'ko')?.value ||
          p.customer_name_ko,
      },
      summary: {
        en: fields.find((f) => f.field_key === 'summary' && f.locale === 'en')?.value || p.summary_en,
        ko: fields.find((f) => f.field_key === 'summary' && f.locale === 'ko')?.value || p.summary_ko,
      },
    }

    for (const locale of TARGETS) {
      for (const bf of BASIC_FIELDS) {
        const existing = fields.find((f) => f.field_key === bf && f.locale === locale)
        if (filled(existing?.value)) continue
        const src = filled(basicSource[bf].en)
          ? { lang: 'en', text: basicSource[bf].en }
          : filled(basicSource[bf].ko)
            ? { lang: 'ko', text: basicSource[bf].ko }
            : null
        if (!src) continue
        jobs.push({
          kind: 'field',
          productId: p.id,
          productCode: p.product_code || p.id,
          fieldKey: bf,
          locale,
          sourceLang: src.lang,
          sourceText: src.text,
        })
      }

      const drow = details.find((d) => d.language_code === locale)
      for (const df of DETAIL_FIELDS) {
        const vis = drow?.customer_page_visibility
        const hidden =
          vis &&
          typeof vis === 'object' &&
          Object.prototype.hasOwnProperty.call(vis, df) &&
          vis[df] === false
        if (hidden) continue
        if (filled(drow?.[df])) continue
        const srcText = filled(enD?.[df])
          ? { lang: 'en', text: enD[df] }
          : filled(koD?.[df])
            ? { lang: 'ko', text: koD[df] }
            : null
        if (!srcText) continue
        jobs.push({
          kind: 'detail',
          productId: p.id,
          productCode: p.product_code || p.id,
          fieldKey: df,
          locale,
          sourceLang: srcText.lang,
          sourceText: srcText.text,
          visibility: koD?.customer_page_visibility || enD?.customer_page_visibility || null,
        })
      }
    }

    for (const ch of (choices || []).filter((c) => c.product_id === p.id)) {
      for (const locale of TARGETS) {
        const name = ch.content_i18n?.name?.[locale] || ch.content_i18n?.choice_name?.[locale]
        if (filled(name)) continue
        const src = filled(ch.choice_name_en)
          ? { lang: 'en', text: ch.choice_name_en }
          : filled(ch.choice_name_ko)
            ? { lang: 'ko', text: ch.choice_name_ko }
            : filled(ch.choice_name)
              ? { lang: 'ko', text: ch.choice_name }
              : null
        if (!src) continue
        jobs.push({
          kind: 'choice',
          productId: p.id,
          productCode: p.product_code || p.id,
          choiceId: ch.id,
          fieldKey: 'name',
          locale,
          sourceLang: src.lang,
          sourceText: src.text,
          existingI18n: ch.content_i18n || {},
        })
      }
      for (const opt of (options || []).filter((o) => o.choice_id === ch.id)) {
        for (const locale of TARGETS) {
          const on = opt.content_i18n?.name?.[locale] || opt.content_i18n?.option_name?.[locale]
          if (filled(on)) continue
          const src = filled(opt.option_name_en)
            ? { lang: 'en', text: opt.option_name_en }
            : filled(opt.option_name_ko)
              ? { lang: 'ko', text: opt.option_name_ko }
              : filled(opt.option_name)
                ? { lang: 'en', text: opt.option_name }
                : null
          if (!src) continue
          jobs.push({
            kind: 'option',
            productId: p.id,
            productCode: p.product_code || p.id,
            optionId: opt.id,
            choiceId: ch.id,
            fieldKey: 'name',
            locale,
            sourceLang: src.lang,
            sourceText: src.text,
            existingI18n: opt.content_i18n || {},
          })
        }
      }
    }

    for (const course of (courses || []).filter((c) => c.product_id === p.id)) {
      for (const locale of TARGETS) {
        const cn = course.content_i18n?.customer_name?.[locale] || course.content_i18n?.name?.[locale]
        const cd = course.content_i18n?.customer_description?.[locale]
        if (!filled(cn) && (filled(course.customer_name_en) || filled(course.customer_name_ko) || filled(course.name))) {
          const src = filled(course.customer_name_en)
            ? { lang: 'en', text: course.customer_name_en }
            : filled(course.customer_name_ko)
              ? { lang: 'ko', text: course.customer_name_ko }
              : { lang: 'en', text: course.name }
          jobs.push({
            kind: 'courseName',
            productId: p.id,
            productCode: p.product_code || p.id,
            courseId: course.id,
            locale,
            sourceLang: src.lang,
            sourceText: src.text,
            existingI18n: course.content_i18n || {},
          })
        }
        if (!filled(cd) && (filled(course.customer_description_en) || filled(course.customer_description_ko))) {
          const src = filled(course.customer_description_en)
            ? { lang: 'en', text: course.customer_description_en }
            : { lang: 'ko', text: course.customer_description_ko }
          jobs.push({
            kind: 'courseDesc',
            productId: p.id,
            productCode: p.product_code || p.id,
            courseId: course.id,
            locale,
            sourceLang: src.lang,
            sourceText: src.text,
            existingI18n: course.content_i18n || {},
          })
        }
      }
    }
  }

  return jobs.filter((j) => {
    if (SHORT_ONLY) return isShortJob(j)
    if (LONG_ONLY) return !isShortJob(j)
    return true
  })
}

async function upsertField(job, value) {
  if (DRY) return
  const { error } = await sb.from('product_field_translations').upsert(
    {
      product_id: job.productId,
      field_key: job.fieldKey,
      locale: job.locale,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'product_id,field_key,locale' }
  )
  if (error) throw error
}

async function upsertDetail(job, value) {
  if (DRY) return
  const { data: existing, error: selErr } = await sb
    .from('product_details_multilingual')
    .select('id, customer_page_visibility')
    .eq('product_id', job.productId)
    .eq('language_code', job.locale)
    .is('channel_id', null)
    .maybeSingle()
  if (selErr) throw selErr

  const payload = {
    product_id: job.productId,
    language_code: job.locale,
    channel_id: null,
    [job.fieldKey]: value,
    updated_at: new Date().toISOString(),
  }
  if (job.visibility != null && !existing) {
    payload.customer_page_visibility = job.visibility
  }

  if (existing?.id) {
    const { error } = await sb
      .from('product_details_multilingual')
      .update({ [job.fieldKey]: value, updated_at: payload.updated_at })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await sb.from('product_details_multilingual').insert(payload)
    if (error) throw error
  }
}

async function upsertChoice(job, value) {
  if (DRY) return
  const content_i18n = { ...(job.existingI18n || {}) }
  content_i18n.name = { ...(content_i18n.name || {}), [job.locale]: value }
  const { error } = await sb
    .from('product_choices')
    .update({ content_i18n, updated_at: new Date().toISOString() })
    .eq('id', job.choiceId)
  if (error) throw error
}

async function upsertOption(job, value) {
  if (DRY) return
  const content_i18n = { ...(job.existingI18n || {}) }
  content_i18n.name = { ...(content_i18n.name || {}), [job.locale]: value }
  const { error } = await sb
    .from('choice_options')
    .update({ content_i18n, updated_at: new Date().toISOString() })
    .eq('id', job.optionId)
  if (error) throw error
}

async function upsertCourse(job, value) {
  if (DRY) return
  const content_i18n = { ...(job.existingI18n || {}) }
  if (job.kind === 'courseName') {
    content_i18n.customer_name = { ...(content_i18n.customer_name || {}), [job.locale]: value }
    content_i18n.name = { ...(content_i18n.name || {}), [job.locale]: value }
  } else {
    content_i18n.customer_description = {
      ...(content_i18n.customer_description || {}),
      [job.locale]: value,
    }
  }
  const { error } = await sb
    .from('tour_courses')
    .update({ content_i18n, updated_at: new Date().toISOString() })
    .eq('id', job.courseId)
  if (error) throw error
}

async function applyJob(job, value) {
  switch (job.kind) {
    case 'field':
      return upsertField(job, value)
    case 'detail':
      return upsertDetail(job, value)
    case 'choice':
      return upsertChoice(job, value)
    case 'option':
      return upsertOption(job, value)
    case 'courseName':
    case 'courseDesc':
      return upsertCourse(job, value)
    default:
      throw new Error(`unknown kind ${job.kind}`)
  }
}

async function main() {
  log(
    `start dry=${DRY} shortOnly=${SHORT_ONLY} longOnly=${LONG_ONLY} product=${ONLY_PRODUCT || 'ALL'}`
  )
  const jobs = await collectJobs()
  const progress = loadJson(PROGRESS_PATH, { done: {} })
  log(`jobs=${jobs.length}`)

  let ok = 0
  let skip = 0
  let fail = 0

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const key = jobKey(job)
    if (progress.done[key]) {
      skip++
      continue
    }
    try {
      log(
        `[${i + 1}/${jobs.length}] ${job.productCode} ${job.kind}:${job.fieldKey || job.kind} -> ${job.locale} (${job.sourceText.length}c)`
      )
      const translated = await translateSmart(job.sourceText, job.sourceLang, job.locale)
      if (!filled(translated)) throw new Error('empty result')
      await applyJob(job, translated)
      progress.done[key] = { at: new Date().toISOString(), chars: translated.length }
      if (i % 5 === 0) saveJson(PROGRESS_PATH, progress)
      ok++
    } catch (err) {
      fail++
      log(`FAIL ${key} ${err.message || err}`)
      saveJson(PROGRESS_PATH, progress)
      // continue; don't abort whole run
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  saveJson(PROGRESS_PATH, progress)
  log(`done ok=${ok} skip=${skip} fail=${fail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
