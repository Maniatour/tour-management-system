/**
 * Apply MDGCSUNRISE fields + detail rows immediately from cache + manual titles.
 * node scripts/apply-mdgc-details-only.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })

const PRODUCT_ID = 'MDGCSUNRISE'
const TARGET = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const fields = {
  ja: {
    name: 'ナイトゴブリン',
    customer_name:
      'ラスベガス発｜グランドキャニオン日の出＋アンテロープキャニオン＆ホースシューベンド｜プレミアムグループツアー',
    summary:
      '出発地：ラスベガス\n所要時間：18時間\n出発時間：午前0時（日の出時刻により変動）\nピックアップ：ツアー日前日の夜（23:00 ±30分）\n含まれるもの：入場料、ミネラルウォーター、ホテルピックアップ\n含まれないもの：ガイドチップ／食事',
  },
  'zh-CN': {
    name: '夜精灵',
    customer_name: '拉斯维加斯出发｜大峡谷日出 + 羚羊峡谷 & 马蹄湾｜精品小团游',
    summary:
      '出发地：拉斯维加斯\n行程时长：18小时\n出发时间：凌晨00:00（随日出时间调整）\n接送时间：行程日前一晚（约23:00 ±30分钟）\n包含：门票、瓶装水、酒店接送\n不包含：导游小费 / 餐食',
  },
  'zh-TW': {
    name: '夜精靈',
    customer_name: '拉斯維加斯出發｜大峽谷日出 + 羚羊峽谷 & 馬蹄灣｜精品小團旅遊',
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
}

const slogans = {
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
}

const highlightsExtra = {
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
}

const detailsFromCache = JSON.parse(
  fs.readFileSync(path.join(root, 'tmp-mdgc-i18n/details-from-cache.json'), 'utf8')
)

async function main() {
  const fieldRows = []
  for (const locale of TARGET) {
    const f = fields[locale]
    for (const key of [
      'name',
      'customer_name',
      'summary',
      'departure_city',
      'arrival_city',
      'departure_country',
      'arrival_country',
    ]) {
      const value =
        f[key] ||
        (key.includes('city') ? 'Las Vegas' : key.includes('country') ? 'USA' : null)
      if (!value) continue
      fieldRows.push({
        product_id: PRODUCT_ID,
        field_key: key,
        locale,
        value,
        updated_at: new Date().toISOString(),
      })
    }
  }
  const { error: fe } = await sb.from('product_field_translations').upsert(fieldRows, {
    onConflict: 'product_id,field_key,locale',
  })
  if (fe) throw fe
  console.log('fields upserted', fieldRows.length)

  for (const locale of TARGET) {
    const content = { ...slogans[locale], ...detailsFromCache[locale] }
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
    console.log('details', locale, Object.keys(content).length, 'fields')
  }

  const { data: product } = await sb
    .from('products')
    .select('tour_highlight_labels')
    .eq('id', PRODUCT_ID)
    .single()
  const labels = { ...(product.tour_highlight_labels || {}) }
  for (const [k, map] of Object.entries(highlightsExtra)) {
    labels[k] = { ...(labels[k] || {}), ...map }
  }
  const { error: he } = await sb
    .from('products')
    .update({ tour_highlight_labels: labels })
    .eq('id', PRODUCT_ID)
  if (he) throw he
  console.log('highlights updated')
  console.log('OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
