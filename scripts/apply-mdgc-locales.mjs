/**
 * Translate remaining short MDGC entities (FAQ/choices/options/courses) via MyMemory,
 * merge with cached details + manual titles, apply to DB.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })

const PRODUCT_ID = 'MDGCSUNRISE'
const TARGET_LOCALES = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const OUT_PATH = path.join(root, 'tmp-mdgc-translations.json')
const CACHE_PATH = path.join(root, 'tmp-mdgc-translation-cache.json')
const DETAILS_CACHE = path.join(root, 'tmp-mdgc-i18n/details-from-cache.json')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const LANG = {
  ja: 'ja',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  es: 'es',
  fr: 'fr',
  de: 'de',
}

const MANUAL = {
  fields: {
    ja: {
      name: 'ナイトゴブリン',
      customer_name:
        'ラスベガス発｜グランドキャニオン日の出＋アンテロープキャニオン＆ホースシューベンド｜プレミアムグループツアー',
      summary:
        '出発地：ラスベガス\n所要時間：18時間\n出発時間：午前0時（日の出時刻により変動）\nピックアップ：ツアー日前日の夜（23:00 ±30分）\n含まれるもの：入場料、ミネラルウォーター、ホテルピックアップ\n含まれないもの：ガイドチップ／食事',
      departure_city: 'Las Vegas',
      arrival_city: 'Las Vegas',
      departure_country: 'USA',
      arrival_country: 'USA',
    },
    'zh-CN': {
      name: '夜精灵',
      customer_name: '拉斯维加斯出发｜大峡谷日出 + 羚羊峡谷 & 马蹄湾｜精品小团游',
      summary:
        '出发地：拉斯维加斯\n行程时长：18小时\n出发时间：凌晨00:00（随日出时间调整）\n接送时间：行程日前一晚（约23:00 ±30分钟）\n包含：门票、瓶装水、酒店接送\n不包含：导游小费 / 餐食',
      departure_city: 'Las Vegas',
      arrival_city: 'Las Vegas',
      departure_country: 'USA',
      arrival_country: 'USA',
    },
    'zh-TW': {
      name: '夜精靈',
      customer_name: '拉斯維加斯出發｜大峽谷日出 + 羚羊峽谷 & 馬蹄灣｜精品小團旅遊',
      summary:
        '出發地：拉斯維加斯\n行程時長：18小時\n出發時間：凌晨00:00（依日出時間調整）\n接送時間：行程日前一晚（約23:00 ±30分鐘）\n包含：門票、瓶裝水、飯店接送\n不包含：導遊小費 / 餐食',
      departure_city: 'Las Vegas',
      arrival_city: 'Las Vegas',
      departure_country: 'USA',
      arrival_country: 'USA',
    },
    es: {
      name: 'Night Goblin',
      customer_name:
        'Las Vegas > Amanecer en el Gran Cañón + Antelope Canyon y Horseshoe Bend | Tour premium en grupo',
      summary:
        'Salida: Las Vegas\nDuración: 18 horas\nHora de salida: 00:00 (puede variar según el amanecer)\nRecogida: la noche anterior a la fecha del tour (alrededor de las 23:00 ± 30 min)\nIncluye: entradas, agua embotellada, recogida en hotel\nNo incluye: propina al guía / comidas',
      departure_city: 'Las Vegas',
      arrival_city: 'Las Vegas',
      departure_country: 'USA',
      arrival_country: 'USA',
    },
    fr: {
      name: 'Night Goblin',
      customer_name:
        'Las Vegas > Lever de soleil au Grand Canyon + Antelope Canyon & Horseshoe Bend | Circuit premium en groupe',
      summary:
        'Départ : Las Vegas\nDurée : 18 heures\nHeure de départ : 00 h 00 (selon l’heure du lever du soleil)\nPrise en charge : la veille au soir (vers 23 h 00 ± 30 min)\nInclus : droits d’entrée, eau en bouteille, prise en charge à l’hôtel\nNon inclus : pourboire du guide / repas',
      departure_city: 'Las Vegas',
      arrival_city: 'Las Vegas',
      departure_country: 'USA',
      arrival_country: 'USA',
    },
    de: {
      name: 'Night Goblin',
      customer_name:
        'Las Vegas > Grand-Canyon-Sonnenaufgang + Antelope Canyon & Horseshoe Bend | Premium-Gruppentour',
      summary:
        'Abfahrt: Las Vegas\nDauer: 18 Stunden\nAbfahrtzeit: 00:00 Uhr (je nach Sonnenaufgang)\nAbholung: am Vorabend des Tourdatums (ca. 23:00 ± 30 Min.)\nInklusive: Eintrittsgelder, Mineralwasser, Hotelabholung\nNicht inklusive: Guide-Trinkgeld / Mahlzeiten',
      departure_city: 'Las Vegas',
      arrival_city: 'Las Vegas',
      departure_country: 'USA',
      arrival_country: 'USA',
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
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8')
}

function stripEmoji(s) {
  return String(s).replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu,
    ''
  )
}

async function translateText(text, locale) {
  if (!text || !String(text).trim()) return ''
  const cache = loadCache()
  const key = `mm2::${locale}::${text}`
  if (cache[key]) return cache[key]
  for (const prefix of ['gt', 'mm']) {
    const k = `${prefix}::${locale}::${text}`
    if (cache[k]) {
      cache[key] = cache[k]
      saveCache(cache)
      return cache[k]
    }
  }

  const clean = stripEmoji(text).trim() || text
  const chunks = []
  if (clean.length <= 450) chunks.push(clean)
  else {
    let buf = ''
    for (const part of clean.split(/(\n+)/)) {
      if ((buf + part).length > 450 && buf) {
        chunks.push(buf)
        buf = part
      } else buf += part
    }
    if (buf) chunks.push(buf)
  }

  const out = []
  for (const chunk of chunks) {
    let translated = null
    for (let attempt = 1; attempt <= 8; attempt++) {
      const url =
        'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(chunk) +
        '&langpair=en|' +
        encodeURIComponent(LANG[locale])
      const res = await fetch(url)
      const data = await res.json()
      const t = data.responseData?.translatedText
      if (
        data.responseStatus === 200 &&
        t &&
        !/MYMEMORY WARNING|YOU USED ALL AVAILABLE/i.test(t)
      ) {
        translated = t
        break
      }
      await new Promise((r) => setTimeout(r, 1200 * attempt))
    }
    if (!translated) throw new Error(`translate fail ${locale}: ${chunk.slice(0, 40)}`)
    out.push(translated)
    await new Promise((r) => setTimeout(r, 400))
  }

  const result = out.join('')
  cache[key] = result
  saveCache(cache)
  return result
}

function mergeI18n(existing, field, locale, value) {
  const next = { ...(existing || {}) }
  const map = { ...(next[field] || {}) }
  if (value?.trim()) map[locale] = value
  next[field] = map
  return next
}

async function main() {
  const detailsFromCache = JSON.parse(fs.readFileSync(DETAILS_CACHE, 'utf8'))
  const { data: product } = await sb
    .from('products')
    .select('tour_highlight_labels')
    .eq('id', PRODUCT_ID)
    .single()
  const { data: faqLinks } = await sb
    .from('product_faq_links')
    .select('faq:faq_library(id, question, answer, question_en, answer_en, content_i18n)')
    .eq('product_id', PRODUCT_ID)
  const { data: choices } = await sb
    .from('product_choices')
    .select('id, content_i18n, choice_group_en, description_en')
    .eq('product_id', PRODUCT_ID)
  const choiceIds = (choices || []).map((c) => c.id)
  const { data: options } = await sb
    .from('choice_options')
    .select('id, option_name, content_i18n')
    .in('choice_id', choiceIds)
  const { data: courseLinks } = await sb
    .from('product_tour_courses')
    .select(
      'course:tour_courses(id, customer_name_ko, customer_name_en, customer_description_ko, customer_description_en, content_i18n)'
    )
    .eq('product_id', PRODUCT_ID)

  const payload = {
    generatedAt: new Date().toISOString(),
    productId: PRODUCT_ID,
    locales: TARGET_LOCALES,
    fields: MANUAL.fields,
    details: {},
    faqs: {},
    choices: {},
    options: {},
    courses: {},
    highlightLabels: {},
  }

  for (const locale of TARGET_LOCALES) {
    payload.details[locale] = {
      ...MANUAL.slogans[locale],
      ...detailsFromCache[locale],
    }
  }

  const labels = product.tour_highlight_labels || {}
  for (const [k, v] of Object.entries(labels)) {
    payload.highlightLabels[k] = { ...(v || {}), ...(MANUAL.highlights[k] || {}) }
  }

  for (const row of faqLinks || []) {
    const f = row.faq
    if (!f) continue
    const qEn = f.content_i18n?.question?.en || f.question_en
    const aEn = f.content_i18n?.answer?.en || f.answer_en
    const qKo = f.content_i18n?.question?.ko || f.question
    const aKo = f.content_i18n?.answer?.ko || f.answer
    const next = {
      question: { ko: qKo, en: qEn },
      answer: { ko: aKo, en: aEn },
    }
    for (const locale of TARGET_LOCALES) {
      console.log('faq', f.id.slice(0, 8), locale)
      next.question[locale] = await translateText(qEn || qKo, locale)
      next.answer[locale] = await translateText(aEn || aKo, locale)
    }
    payload.faqs[f.id] = next
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
  }

  for (const choice of choices || []) {
    const cur = choice.content_i18n || {}
    const nameEn = cur.name?.en || choice.choice_group_en
    const descEn = cur.description?.en || choice.description_en
    let next = { ...cur }
    for (const locale of TARGET_LOCALES) {
      console.log('choice', choice.id.slice(0, 8), locale)
      if (nameEn) next = mergeI18n(next, 'name', locale, await translateText(nameEn, locale))
      if (descEn)
        next = mergeI18n(next, 'description', locale, await translateText(descEn, locale))
    }
    payload.choices[choice.id] = next
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
  }

  for (const opt of options || []) {
    const cur = opt.content_i18n || {}
    const nameEn = cur.name?.en || opt.option_name
    const descEn = cur.description?.en || ''
    let next = { ...cur }
    for (const locale of TARGET_LOCALES) {
      console.log('option', opt.id.slice(0, 8), locale)
      if (nameEn) next = mergeI18n(next, 'name', locale, await translateText(nameEn, locale))
      if (descEn)
        next = mergeI18n(next, 'description', locale, await translateText(descEn, locale))
    }
    payload.options[opt.id] = next
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
  }

  for (const link of courseLinks || []) {
    const c = link.course
    if (!c) continue
    const nameEn = c.content_i18n?.name?.en || c.customer_name_en
    const nameKo = c.content_i18n?.name?.ko || c.customer_name_ko
    const descEn = c.content_i18n?.description?.en || c.customer_description_en || ''
    const descKo = c.content_i18n?.description?.ko || c.customer_description_ko || ''
    if (!nameEn && !nameKo) continue
    let next = { ...(c.content_i18n || {}) }
    for (const locale of TARGET_LOCALES) {
      console.log('course', (nameEn || nameKo || '').slice(0, 20), locale)
      next = mergeI18n(next, 'name', locale, await translateText(nameEn || nameKo, locale))
      if (descEn || descKo) {
        next = mergeI18n(
          next,
          'description',
          locale,
          await translateText(descEn || descKo, locale)
        )
      }
    }
    if (nameKo || nameEn) {
      next.name = {
        ...(next.name || {}),
        ...(nameKo ? { ko: nameKo } : {}),
        ...(nameEn ? { en: nameEn } : {}),
      }
    }
    if (descKo || descEn) {
      next.description = {
        ...(next.description || {}),
        ...(descKo ? { ko: descKo } : {}),
        ...(descEn ? { en: descEn } : {}),
      }
    }
    payload.courses[c.id] = next
    fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
  console.log('Wrote', OUT_PATH)

  // Apply
  const fieldRows = []
  for (const locale of TARGET_LOCALES) {
    for (const [field_key, value] of Object.entries(payload.fields[locale] || {})) {
      fieldRows.push({
        product_id: PRODUCT_ID,
        field_key,
        locale,
        value,
        updated_at: new Date().toISOString(),
      })
    }
  }
  {
    const { error } = await sb.from('product_field_translations').upsert(fieldRows, {
      onConflict: 'product_id,field_key,locale',
    })
    if (error) throw error
    console.log('fields', fieldRows.length)
  }

  for (const locale of TARGET_LOCALES) {
    const content = payload.details[locale]
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
      if (error) throw error
    } else {
      const { error } = await sb.from('product_details_multilingual').insert(row)
      if (error) throw error
    }
    console.log('details', locale)
  }

  {
    const { error } = await sb
      .from('products')
      .update({ tour_highlight_labels: payload.highlightLabels })
      .eq('id', PRODUCT_ID)
    if (error) throw error
  }

  for (const [id, content_i18n] of Object.entries(payload.faqs)) {
    const { error } = await sb.from('faq_library').update({ content_i18n }).eq('id', id)
    if (error) throw error
  }
  console.log('faqs', Object.keys(payload.faqs).length)

  for (const [id, content_i18n] of Object.entries(payload.choices)) {
    const { error } = await sb.from('product_choices').update({ content_i18n }).eq('id', id)
    if (error) throw error
  }
  for (const [id, content_i18n] of Object.entries(payload.options)) {
    const { error } = await sb.from('choice_options').update({ content_i18n }).eq('id', id)
    if (error) throw error
  }
  for (const [id, content_i18n] of Object.entries(payload.courses)) {
    const { error } = await sb.from('tour_courses').update({ content_i18n }).eq('id', id)
    if (error) throw error
  }

  console.log('Done', {
    choices: Object.keys(payload.choices).length,
    options: Object.keys(payload.options).length,
    courses: Object.keys(payload.courses).length,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
