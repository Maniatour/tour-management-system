/**
 * MDGCSUNRISE multilingual fill via MyMemory (en→target), with glossary polish.
 * node scripts/translate-mdgc-locales.mjs
 * node scripts/translate-mdgc-locales.mjs --dry
 * node scripts/translate-mdgc-locales.mjs --apply-only
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { translate as gTranslate } from '@vitalets/google-translate-api'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const PRODUCT_ID = 'MDGCSUNRISE'
const TARGET_LOCALES = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const DETAIL_FIELDS = [
  'slogan1',
  'slogan2',
  'slogan3',
  'description',
  'included',
  'not_included',
  'pickup_drop_info',
  'luggage_info',
  'tour_operation_info',
  'preparation_info',
  'small_group_info',
  'notice_info',
  'cancellation_policy',
]
const OUT_PATH = path.join(root, 'tmp-mdgc-translations.json')
const CACHE_PATH = path.join(root, 'tmp-mdgc-translation-cache.json')

const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry')
const APPLY_ONLY = args.has('--apply-only')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const GTRANSLATE_LANG = {
  ja: 'ja',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  es: 'es',
  fr: 'fr',
  de: 'de',
}

/** Hand-polished overrides for short high-visibility fields */
const MANUAL = {
  fields: {
    ja: {
      name: 'ナイトゴブリン',
      customer_name:
        'ラスベガス発｜グランドキャニオン日の出＋アンテロープキャニオン＆ホースシューベンド｜プレミアムグループツアー',
      summary:
        '出発地：ラスベガス\n所要時間：18時間\n出発時間：午前0時（日の出時刻により変動）\nピックアップ：ツアー日前日の夜（23:00 ±30分）\n含まれるもの：入場料、ミネラルウォーター、ホテルピックアップ\n含まれないもの：ガイドチップ／食事',
    },
    'zh-CN': {
      name: '夜精灵',
      customer_name:
        '拉斯维加斯出发｜大峡谷日出 + 羚羊峡谷 & 马蹄湾｜精品小团游',
      summary:
        '出发地：拉斯维加斯\n行程时长：18小时\n出发时间：凌晨00:00（随日出时间调整）\n接送时间：行程日前一晚（约23:00 ±30分钟）\n包含：门票、瓶装水、酒店接送\n不包含：导游小费 / 餐食',
    },
    'zh-TW': {
      name: '夜精靈',
      customer_name:
        '拉斯維加斯出發｜大峽谷日出 + 羚羊峽谷 & 馬蹄灣｜精品小團旅遊',
      summary:
        '出發地：拉斯維加斯\n行程時長：18小時\n出發時間：凌晨00:00（依日出時間調整）\n接送時間：行程日前一晚（約23:00 ±30分鐘）\n包含：門票、瓶裝水、飯店接送\n不包含：導遊小費 / 餐食',
    },
    es: {
      name: 'Night Goblin',
      customer_name:
        'Las Vegas > Amanecer en el Gran Cañón + Antelope Canyon y Horseshoe Bend | Tour premium en grupo',
      summary:
        'Salida: Las Vegas\nDuración: 18 horas\nHora de salida: 00:00 (puede variar según el amanecer)\nRecogida: la noche anterior a la fecha del tour (alrededor de las 23:00 ± 30 min)\nIncluye: entradas, agua embotellada, recogida en hotel\nNo incluye: propina al guía / comidas',
    },
    fr: {
      name: 'Night Goblin',
      customer_name:
        'Las Vegas > Lever de soleil au Grand Canyon + Antelope Canyon & Horseshoe Bend | Circuit premium en groupe',
      summary:
        'Départ : Las Vegas\nDurée : 18 heures\nHeure de départ : 00 h 00 (selon l’heure du lever du soleil)\nPrise en charge : la veille au soir (vers 23 h 00 ± 30 min)\nInclus : droits d’entrée, eau en bouteille, prise en charge à l’hôtel\nNon inclus : pourboire du guide / repas',
    },
    de: {
      name: 'Night Goblin',
      customer_name:
        'Las Vegas > Grand-Canyon-Sonnenaufgang + Antelope Canyon & Horseshoe Bend | Premium-Gruppentour',
      summary:
        'Abfahrt: Las Vegas\nDauer: 18 Stunden\nAbfahrtzeit: 00:00 Uhr (je nach Sonnenaufgang)\nAbholung: am Vorabend des Tourdatums (ca. 23:00 ± 30 Min.)\nInklusive: Eintrittsgelder, Mineralwasser, Hotelabholung\nNicht inklusive: Guide-Trinkgeld / Mahlzeiten',
    },
  },
  slogans: {
    ja: {
      slogan1: 'ラスベガス発、1日で巡るグランドキャニオン日の出ツアー',
      slogan2: '宿泊なしで楽しむ、夜出発のナイトゴブリン・グランドキャニオンツアー',
      slogan3: '夜空から日の出まで。グランドサークルを1日で完結',
    },
    'zh-CN': {
      slogan1: '拉斯维加斯出发，一天看尽大峡谷日出',
      slogan2: '无需住宿——夜精灵大峡谷日出一日游',
      slogan3: '从夜空到日出，一天走完大环线精华',
    },
    'zh-TW': {
      slogan1: '拉斯維加斯出發，一天看盡大峽谷日出',
      slogan2: '無需住宿——夜精靈大峽谷日出一日遊',
      slogan3: '從夜空到日出，一天走完大環線精華',
    },
    es: {
      slogan1: 'Tour al amanecer en el Gran Cañón desde Las Vegas en un día',
      slogan2: 'Tour Night Goblin: Gran Cañón desde Las Vegas sin alojamiento',
      slogan3: 'Gran Círculo en un día: cielo nocturno y amanecer incluidos',
    },
    fr: {
      slogan1: 'Lever de soleil au Grand Canyon au départ de Las Vegas en une journée',
      slogan2: 'Tour Night Goblin : Grand Canyon depuis Las Vegas sans hébergement',
      slogan3: 'Grand Circle en une journée : ciel nocturne et lever du soleil',
    },
    de: {
      slogan1: 'Grand-Canyon-Sonnenaufgang ab Las Vegas an einem Tag',
      slogan2: 'Night-Goblin-Tour: Grand Canyon ab Las Vegas ohne Übernachtung',
      slogan3: 'Grand Circle an einem Tag – Sternenhimmel und Sonnenaufgang',
    },
  },
  highlights: {
    trustSmallGroup: {
      ja: '米国運輸省（DOT）正式認可',
      'zh-CN': '美国联邦交通部正式许可',
      'zh-TW': '美國聯邦交通部正式許可',
      es: 'Autorizado por el DOT de EE. UU.',
      fr: 'Autorisé par le DOT des États-Unis',
      de: 'Offiziell vom US-DOT zugelassen',
    },
    trustFreeCancellation: {
      ja: '出発確定前は無料キャンセル',
      'zh-CN': '出发确认前可免费取消',
      'zh-TW': '出發確認前可免費取消',
      es: 'Cancelación gratuita antes de la confirmación',
      fr: 'Annulation gratuite avant confirmation',
      de: 'Kostenlose Stornierung vor Abfahrtsbestätigung',
    },
    trustLicensedOperator: {
      ja: '100万ドル車両保険',
      'zh-CN': '百万美元车辆保险',
      'zh-TW': '百萬美元車輛保險',
      es: 'Seguro de vehículo de $1 millón',
      fr: 'Assurance véhicule d’1 million $',
      de: 'Fahrzeugversicherung über 1 Mio $',
    },
  },
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {}
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8')
}

function chunkText(text, maxLen = 3500) {
  const s = String(text)
  if (s.length <= maxLen) return [s]
  const parts = []
  let buf = ''
  for (const para of s.split(/(\n+)/)) {
    if ((buf + para).length > maxLen && buf) {
      parts.push(buf)
      buf = para
    } else {
      buf += para
    }
    while (buf.length > maxLen) {
      parts.push(buf.slice(0, maxLen))
      buf = buf.slice(maxLen)
    }
  }
  if (buf) parts.push(buf)
  return parts
}

async function mymemoryTranslate(text, locale) {
  if (!text || !String(text).trim()) return ''
  const cache = loadCache()
  const key = `gt::${locale}::${text}`
  if (cache[key]) return cache[key]
  // reuse older MyMemory cache if present
  const legacy = `mm::${locale}::${text}`
  if (cache[legacy]) {
    cache[key] = cache[legacy]
    saveCache(cache)
    return cache[legacy]
  }

  const chunks = chunkText(text)
  const out = []
  for (const chunk of chunks) {
    let attempt = 0
    let translated = null
    while (attempt < 12) {
      attempt += 1
      try {
        const res = await gTranslate(chunk, {
          from: 'en',
          to: GTRANSLATE_LANG[locale],
        })
        translated = res.text
        break
      } catch (err) {
        const wait = Math.min(30000, 2000 * attempt)
        console.warn(`  retry ${attempt} ${locale} after ${wait}ms: ${err.name || err.message}`)
        await new Promise((r) => setTimeout(r, wait))
        if (attempt >= 12) throw err
      }
    }
    if (!translated) throw new Error(`Google translate failed for ${locale}`)
    out.push(translated)
    await new Promise((r) => setTimeout(r, 800))
  }

  const result = polish(out.join(''), locale)
  cache[key] = result
  saveCache(cache)
  return result
}

function polish(text, locale) {
  let t = text
  // common glossary fixes after MT
  const replacements = {
    ja: [
      [/Night Goblin/gi, 'ナイトゴブリン'],
      [/Bamdokkaebi/gi, 'ナイトゴブリン'],
      [/Las Vegas Mania/g, 'ラスベガス・マニア'],
    ],
    'zh-CN': [
      [/Night Goblin/gi, '夜精灵'],
      [/Bamdokkaebi/gi, '夜精灵'],
      [/Las Vegas Mania/g, '拉斯维加斯 Mania'],
    ],
    'zh-TW': [
      [/Night Goblin/gi, '夜精靈'],
      [/Bamdokkaebi/gi, '夜精靈'],
      [/Las Vegas Mania/g, '拉斯維加斯 Mania'],
    ],
  }
  for (const [re, to] of replacements[locale] || []) {
    t = t.replace(re, to)
  }
  return t
}

function pickFilled(row, fields) {
  const o = {}
  for (const f of fields) {
    if (row?.[f] != null && String(row[f]).trim()) o[f] = row[f]
  }
  return o
}

function mergeI18n(existing, field, locale, value) {
  const next = { ...(existing || {}) }
  const map = { ...(next[field] || {}) }
  if (value && String(value).trim()) map[locale] = value
  next[field] = map
  return next
}

async function loadSource() {
  const { data: en } = await sb
    .from('product_details_multilingual')
    .select('*')
    .eq('product_id', PRODUCT_ID)
    .eq('language_code', 'en')
    .is('channel_id', null)
    .maybeSingle()
  const { data: ko } = await sb
    .from('product_details_multilingual')
    .select('*')
    .eq('product_id', PRODUCT_ID)
    .eq('language_code', 'ko')
    .eq('channel_id', 'M00001')
    .maybeSingle()
  const { data: product } = await sb
    .from('products')
    .select(
      'name_ko,name_en,customer_name_ko,customer_name_en,summary_ko,summary_en,tour_highlight_labels,departure_city_ko,departure_city_en,arrival_city_ko,arrival_city_en,departure_country_ko,departure_country_en,arrival_country_ko,arrival_country_en'
    )
    .eq('id', PRODUCT_ID)
    .single()
  const { data: faqLinks } = await sb
    .from('product_faq_links')
    .select('faq:faq_library(id, question, answer, question_en, answer_en, content_i18n)')
    .eq('product_id', PRODUCT_ID)
  const { data: choices } = await sb
    .from('product_choices')
    .select('id, content_i18n, choice_group_ko, choice_group_en, description_ko, description_en')
    .eq('product_id', PRODUCT_ID)
  const choiceIds = (choices || []).map((c) => c.id)
  const { data: options } = await sb
    .from('choice_options')
    .select('id, choice_id, option_name, option_name_ko, content_i18n')
    .in('choice_id', choiceIds)
  const { data: courseLinks } = await sb
    .from('product_tour_courses')
    .select(
      'course:tour_courses(id, customer_name_ko, customer_name_en, customer_description_ko, customer_description_en, content_i18n)'
    )
    .eq('product_id', PRODUCT_ID)

  return {
    product,
    detailsEn: pickFilled(en, DETAIL_FIELDS),
    detailsKo: pickFilled(ko, DETAIL_FIELDS),
    faqs: (faqLinks || [])
      .map((l) => l.faq)
      .filter(Boolean)
      .map((f) => ({
        id: f.id,
        question_ko: f.content_i18n?.question?.ko || f.question,
        question_en: f.content_i18n?.question?.en || f.question_en,
        answer_ko: f.content_i18n?.answer?.ko || f.answer,
        answer_en: f.content_i18n?.answer?.en || f.answer_en,
        content_i18n: f.content_i18n || {},
      })),
    choices: choices || [],
    options: options || [],
    courses: (courseLinks || [])
      .map((l) => l.course)
      .filter(Boolean)
      .map((c) => ({
        id: c.id,
        name_ko: c.content_i18n?.name?.ko || c.customer_name_ko,
        name_en: c.content_i18n?.name?.en || c.customer_name_en,
        desc_ko: c.content_i18n?.description?.ko || c.customer_description_ko || '',
        desc_en: c.content_i18n?.description?.en || c.customer_description_en || '',
        content_i18n: c.content_i18n || {},
      })),
  }
}

async function buildTranslations(source) {
  const payload = {
    generatedAt: new Date().toISOString(),
    productId: PRODUCT_ID,
    locales: TARGET_LOCALES,
    fields: {},
    details: {},
    faqs: {},
    choices: {},
    options: {},
    courses: {},
    highlightLabels: {},
  }

  const p = source.product

  for (const locale of TARGET_LOCALES) {
    const manual = MANUAL.fields[locale]
    payload.fields[locale] = {
      name: manual.name,
      customer_name: manual.customer_name,
      summary: manual.summary,
      departure_city: p.departure_city_en || 'Las Vegas',
      arrival_city: p.arrival_city_en || 'Las Vegas',
      departure_country: p.departure_country_en || 'USA',
      arrival_country: p.arrival_country_en || 'USA',
    }
  }

  for (const locale of TARGET_LOCALES) {
    const row = { ...MANUAL.slogans[locale] }
    for (const field of DETAIL_FIELDS) {
      if (field.startsWith('slogan')) continue
      const en = source.detailsEn[field]
      if (!en) continue
      console.log(`details ${locale}.${field}…`)
      row[field] = await mymemoryTranslate(en, locale)
    }
    payload.details[locale] = row
  }

  const labels = p.tour_highlight_labels || {}
  for (const [labelKey, byLocale] of Object.entries(labels)) {
    payload.highlightLabels[labelKey] = { ...(byLocale || {}) }
    for (const locale of TARGET_LOCALES) {
      payload.highlightLabels[labelKey][locale] =
        MANUAL.highlights[labelKey]?.[locale] ||
        (await mymemoryTranslate(byLocale.ko || byLocale.en || '', locale))
    }
  }

  for (const faq of source.faqs) {
    const next = { ...(faq.content_i18n || {}) }
    next.question = { ...(next.question || {}), ko: faq.question_ko, en: faq.question_en }
    next.answer = { ...(next.answer || {}), ko: faq.answer_ko, en: faq.answer_en }
    for (const locale of TARGET_LOCALES) {
      console.log(`faq ${faq.id.slice(0, 8)} ${locale}`)
      next.question[locale] = await mymemoryTranslate(faq.question_en || faq.question_ko, locale)
      next.answer[locale] = await mymemoryTranslate(faq.answer_en || faq.answer_ko, locale)
    }
    payload.faqs[faq.id] = next
  }

  for (const choice of source.choices) {
    const cur = choice.content_i18n || {}
    const nameEn = cur.name?.en || choice.choice_group_en
    const descEn = cur.description?.en || choice.description_en
    let next = { ...cur }
    for (const locale of TARGET_LOCALES) {
      if (nameEn) next = mergeI18n(next, 'name', locale, await mymemoryTranslate(nameEn, locale))
      if (descEn)
        next = mergeI18n(next, 'description', locale, await mymemoryTranslate(descEn, locale))
    }
    payload.choices[choice.id] = next
  }

  for (const opt of source.options) {
    const cur = opt.content_i18n || {}
    const nameEn = cur.name?.en || opt.option_name
    const descEn = cur.description?.en || ''
    let next = { ...cur }
    for (const locale of TARGET_LOCALES) {
      if (nameEn) next = mergeI18n(next, 'name', locale, await mymemoryTranslate(nameEn, locale))
      if (descEn)
        next = mergeI18n(next, 'description', locale, await mymemoryTranslate(descEn, locale))
    }
    payload.options[opt.id] = next
  }

  for (const course of source.courses) {
    if (!course.name_en && !course.name_ko) continue
    let next = { ...(course.content_i18n || {}) }
    for (const locale of TARGET_LOCALES) {
      if (course.name_en || course.name_ko) {
        next = mergeI18n(
          next,
          'name',
          locale,
          await mymemoryTranslate(course.name_en || course.name_ko, locale)
        )
      }
      if (course.desc_en || course.desc_ko) {
        next = mergeI18n(
          next,
          'description',
          locale,
          await mymemoryTranslate(course.desc_en || course.desc_ko, locale)
        )
      }
    }
    if (course.name_ko || course.name_en) {
      next.name = {
        ...(next.name || {}),
        ...(course.name_ko ? { ko: course.name_ko } : {}),
        ...(course.name_en ? { en: course.name_en } : {}),
      }
    }
    if (course.desc_ko || course.desc_en) {
      next.description = {
        ...(next.description || {}),
        ...(course.desc_ko ? { ko: course.desc_ko } : {}),
        ...(course.desc_en ? { en: course.desc_en } : {}),
      }
    }
    payload.courses[course.id] = next
  }

  return payload
}

async function applyTranslations(payload) {
  const stats = {
    fieldUpserts: 0,
    detailUpserts: 0,
    faqUpdates: 0,
    choiceUpdates: 0,
    optionUpdates: 0,
    courseUpdates: 0,
    productUpdate: false,
  }

  const fieldRows = []
  for (const locale of TARGET_LOCALES) {
    const f = payload.fields[locale] || {}
    for (const [field_key, value] of Object.entries(f)) {
      if (!value) continue
      fieldRows.push({
        product_id: PRODUCT_ID,
        field_key,
        locale,
        value,
        updated_at: new Date().toISOString(),
      })
    }
  }
  if (fieldRows.length) {
    const { error } = await sb.from('product_field_translations').upsert(fieldRows, {
      onConflict: 'product_id,field_key,locale',
    })
    if (error) throw new Error(`field_translations: ${error.message}`)
    stats.fieldUpserts = fieldRows.length
  }

  for (const locale of TARGET_LOCALES) {
    const content = payload.details[locale]
    if (!content || !Object.keys(content).length) continue
    const { data: existing } = await sb
      .from('product_details_multilingual')
      .select('id')
      .eq('product_id', PRODUCT_ID)
      .eq('language_code', locale)
      .is('channel_id', null)
      .eq('variant_key', 'default')
      .maybeSingle()

    const row = {
      product_id: PRODUCT_ID,
      language_code: locale,
      channel_id: null,
      variant_key: 'default',
      ...content,
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await sb
        .from('product_details_multilingual')
        .update(row)
        .eq('id', existing.id)
      if (error) throw new Error(`details update ${locale}: ${error.message}`)
    } else {
      const { error } = await sb.from('product_details_multilingual').insert(row)
      if (error) throw new Error(`details insert ${locale}: ${error.message}`)
    }
    stats.detailUpserts += 1
  }

  if (payload.highlightLabels && Object.keys(payload.highlightLabels).length) {
    const { error } = await sb
      .from('products')
      .update({ tour_highlight_labels: payload.highlightLabels })
      .eq('id', PRODUCT_ID)
    if (error) throw new Error(`highlight labels: ${error.message}`)
    stats.productUpdate = true
  }

  for (const [id, content_i18n] of Object.entries(payload.faqs || {})) {
    const { error } = await sb.from('faq_library').update({ content_i18n }).eq('id', id)
    if (error) throw new Error(`faq ${id}: ${error.message}`)
    stats.faqUpdates += 1
  }

  for (const [id, content_i18n] of Object.entries(payload.choices || {})) {
    const { error } = await sb.from('product_choices').update({ content_i18n }).eq('id', id)
    if (error) throw new Error(`choice ${id}: ${error.message}`)
    stats.choiceUpdates += 1
  }

  for (const [id, content_i18n] of Object.entries(payload.options || {})) {
    const { error } = await sb.from('choice_options').update({ content_i18n }).eq('id', id)
    if (error) throw new Error(`option ${id}: ${error.message}`)
    stats.optionUpdates += 1
  }

  for (const [id, content_i18n] of Object.entries(payload.courses || {})) {
    const { error } = await sb.from('tour_courses').update({ content_i18n }).eq('id', id)
    if (error) throw new Error(`course ${id}: ${error.message}`)
    stats.courseUpdates += 1
  }

  return stats
}

async function main() {
  let payload
  if (APPLY_ONLY) {
    payload = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'))
    console.log('Loaded existing translations JSON')
  } else {
    console.log('Loading source…')
    const source = await loadSource()
    console.log(
      `Source: details=${Object.keys(source.detailsEn).length} faqs=${source.faqs.length} choices=${source.choices.length} options=${source.options.length} courses=${source.courses.length}`
    )
    payload = await buildTranslations(source)
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
    console.log(`Wrote ${OUT_PATH}`)
  }

  if (DRY) {
    console.log('Dry run — skip DB write')
    return
  }

  console.log('Applying to DB…')
  const stats = await applyTranslations(payload)
  console.log('Done:', stats)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
