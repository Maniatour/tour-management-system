/**
 * Native-speaker polish for short marketing i18n on active+published products.
 * Fields: name, customer_name, summary + slogan1–5 (channel_id null).
 * Locales: ja, zh-CN, zh-TW, es, fr, de
 *
 * node scripts/polish-active-published-short-i18n.mjs
 * node scripts/polish-active-published-short-i18n.mjs --dry-run
 * node scripts/polish-active-published-short-i18n.mjs --product=AC1
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })

const TARGETS = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const BASIC = ['name', 'customer_name', 'summary']
const SLOGANS = ['slogan1', 'slogan2', 'slogan3', 'slogan4', 'slogan5']

const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry-run')
const productArg = [...args].find((a) => a.startsWith('--product='))
const ONLY = productArg ? productArg.split('=')[1] : null

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function filled(v) {
  return String(v ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim().length > 0
}

/**
 * Hand-polished short marketing copy keyed by product_code.
 * Only include a field when EN or KO source exists (script still double-checks).
 */
const POLISH = {
  AC1: {
    name: {
      ja: 'アンテロープキャニオン＆ホースシューベンド 1日ツアー',
      'zh-CN': '羚羊峡谷 & 马蹄湾一日游',
      'zh-TW': '羚羊峽谷 & 馬蹄灣一日遊',
      es: 'Tour de 1 día: Antelope Canyon y Horseshoe Bend',
      fr: 'Excursion d’une journée : Antelope Canyon et Horseshoe Bend',
      de: '1-Tages-Tour: Antelope Canyon & Horseshoe Bend',
    },
    customer_name: {
      ja: 'アンテロープキャニオン＆ホースシューベンド 1日ツアー',
      'zh-CN': '羚羊峡谷 & 马蹄湾一日游',
      'zh-TW': '羚羊峽谷 & 馬蹄灣一日遊',
      es: 'Tour de 1 día: Antelope Canyon y Horseshoe Bend',
      fr: 'Excursion d’une journée : Antelope Canyon et Horseshoe Bend',
      de: '1-Tages-Tour: Antelope Canyon & Horseshoe Bend',
    },
    summary: {
      ja: '毎日出発\n2025年12月16日〜2026年3月1日、および2026年12月16日〜2027年3月1日出発の場合、お一人様あたり10ドルの追加料金がかかります',
      'zh-CN': '每日出发\n2025年12月16日至2026年3月1日，以及2026年12月16日至2027年3月1日期间出发，每人加收10美元附加费',
      'zh-TW': '每日出發\n2025年12月16日至2026年3月1日，以及2026年12月16日至2027年3月1日期間出發，每人加收10美元附加費',
      es: 'Salidas diarias\nSe aplica un cargo adicional de 10 USD por persona en salidas del 16 dic 2025–1 mar 2026 y del 16 dic 2026–1 mar 2027',
      fr: 'Départs quotidiens\nSupplément de 10 USD par personne pour les départs du 16 déc. 2025 au 1er mars 2026 et du 16 déc. 2026 au 1er mars 2027',
      de: 'Tägliche Abfahrten\nZuschlag von 10 USD pro Person für Abfahrten vom 16. Dez. 2025–1. März 2026 und 16. Dez. 2026–1. März 2027',
    },
    slogans: {
      slogan1: {
        ja: '光の渓谷と曲線の絶壁——アンテロープキャニオンとホースシューベンドを1日で',
        'zh-CN': '光之峡谷与曲线绝壁——一天尽览羚羊峡谷与马蹄湾',
        'zh-TW': '光之峽谷與曲線絕壁——一天盡覽羚羊峽谷與馬蹄灣',
        es: 'Luz del cañón y curvas icónicas: Antelope Canyon y Horseshoe Bend en un día',
        fr: 'Lumière du canyon et courbes emblématiques : Antelope Canyon et Horseshoe Bend en une journée',
        de: 'Licht im Canyon, ikonische Kurven: Antelope Canyon & Horseshoe Bend an einem Tag',
      },
      slogan2: {
        ja: '移動は軽やかに、感動は大きく——安心して巡る必見スポット2か所',
        'zh-CN': '轻松出行，尽享必打卡双景点',
        'zh-TW': '輕鬆出行，盡享必打卡雙景點',
        es: 'Viaje cómodo a dos maravillas imprescindibles',
        fr: 'Deux merveilles incontournables, en tout confort',
        de: 'Zwei Must-sees bequem und sicher erleben',
      },
    },
  },

  AG2: {
    name: {
      ja: 'グランドキャニオン1泊2日｜サウス＆イースト＋ホースシューベンド＋アンテロープ',
      'zh-CN': '大峡谷两日游｜南缘&东缘 + 马蹄湾 + 羚羊峡谷',
      'zh-TW': '大峽谷兩日遊｜南緣&東緣 + 馬蹄灣 + 羚羊峽谷',
      es: 'Tour 2 días | Gran Cañón (Sur y Este) + Horseshoe Bend + Antelope Canyon',
      fr: 'Circuit 2 jours | Grand Canyon (Sud & Est) + Horseshoe Bend + Antelope Canyon',
      de: '2-Tages-Tour | Grand Canyon (Süd & Ost) + Horseshoe Bend + Antelope Canyon',
    },
    customer_name: {
      ja: 'ラスベガス発｜1泊2日ツアー｜グランドキャニオン（サウスリム・イーストリム）＋ホースシューベンド＋アンテロープキャニオン',
      'zh-CN': '拉斯维加斯出发｜两日一夜｜大峡谷（南缘·东缘）+ 马蹄湾 + 羚羊峡谷',
      'zh-TW': '拉斯維加斯出發｜兩日一夜｜大峽谷（南緣·東緣）+ 馬蹄灣 + 羚羊峽谷',
      es: 'Las Vegas > Tour de 2 días | Gran Cañón (South & East Rim) + Horseshoe Bend + Antelope Canyon',
      fr: 'Las Vegas > Circuit de 2 jours | Grand Canyon (South & East Rim) + Horseshoe Bend + Antelope Canyon',
      de: 'Las Vegas > 2-Tages-Tour | Grand Canyon (South & East Rim) + Horseshoe Bend + Antelope Canyon',
    },
    slogans: {
      slogan1: {
        ja: 'グランドサークルの要点を1泊2日で——グランドキャニオン・ホースシューベンド・アンテロープキャニオン',
        'zh-CN': '两日一夜走完大环线精华——大峡谷、马蹄湾、羚羊峡谷一网打尽',
        'zh-TW': '兩日一夜走完大環線精華——大峽谷、馬蹄灣、羚羊峽谷一次收齊',
        es: 'Lo esencial del Grand Circle en 2 días y 1 noche: Gran Cañón, Horseshoe Bend y Antelope Canyon',
        fr: 'L’essentiel du Grand Circle en 2 jours / 1 nuit : Grand Canyon, Horseshoe Bend et Antelope Canyon',
        de: 'Grand-Circle-Highlights in 2 Tagen / 1 Nacht: Grand Canyon, Horseshoe Bend & Antelope Canyon',
      },
      slogan2: {
        ja: 'ヘリ・カヤック・アンテロープなど選べるオプション。安全で効率的な行程',
        'zh-CN': '可选直升机、皮划艇与羚羊峡谷等项目，行程安全高效',
        'zh-TW': '可選直升機、獨木舟與羚羊峽谷等項目，行程安全高效',
        es: 'Más opciones (helicóptero, kayak y Antelope Canyon) con un itinerario seguro y eficiente',
        fr: 'Plus d’options (hélicoptère, kayak, Antelope Canyon) avec un itinéraire sûr et efficace',
        de: 'Mehr Optionen (Helikopter, Kajak, Antelope Canyon) mit sicherem, effizientem Ablauf',
      },
    },
  },

  MDDEATH: {
    name: {
      ja: 'デスバレー',
      'zh-CN': '死亡谷',
      'zh-TW': '死亡谷',
      es: 'Death Valley',
      fr: 'Death Valley',
      de: 'Death Valley',
    },
    customer_name: {
      ja: 'ラスベガス発｜デスバレー＆ライオライト・ゴーストタウン 1日ツアー｜プレミアム少人数',
      'zh-CN': '拉斯维加斯出发｜死亡谷 & 莱奥莱特鬼城一日游｜精品小团',
      'zh-TW': '拉斯維加斯出發｜死亡谷 & 萊奧萊特鬼城一日遊｜精品小團',
      es: 'Las Vegas > Tour de un día: Valle de la Muerte y pueblo fantasma de Rhyolite | Grupo reducido premium',
      fr: 'Las Vegas > Excursion d’une journée : Vallée de la Mort et ville fantôme de Rhyolite | Petit groupe premium',
      de: 'Las Vegas > Tagestour: Death Valley & Geisterstadt Rhyolite | Premium-Kleingruppe',
    },
    slogans: {
      slogan1: {
        ja: '地球で最も低く、最も暑い場所——デスバレーで迎える超現実的な日の出',
        'zh-CN': '地球最低、最热之地——在死亡谷体验超现实日出',
        'zh-TW': '地球最低、最熱之地——在死亡谷體驗超現實日出',
        es: 'Amanecer surrealista en el Valle de la Muerte, el lugar más bajo y caluroso de la Tierra',
        fr: 'Lever de soleil surréaliste dans la Vallée de la Mort, le lieu le plus bas et le plus chaud de la planète',
        de: 'Surrealer Sonnenaufgang im Death Valley – dem niedrigsten und heißesten Ort der Erde',
      },
      slogan2: {
        ja: '荒涼の中の美しさ——ザブリスキーポイントの日の出からバッドウォーター盆地まで、1日で楽しむデスバレー',
        'zh-CN': '荒凉中的美——从扎布里斯基角日出到恶水盐湖，一天尽览死亡谷精华',
        'zh-TW': '荒涼中的美——從扎布里斯基角日出到惡水鹽湖，一天盡覽死亡谷精華',
        es: 'Belleza en el desierto: del amanecer en Zabriskie Point a las salinas de Badwater Basin en un día',
        fr: 'Beauté du désert : du lever de soleil à Zabriskie Point aux salines de Badwater Basin en une journée',
        de: 'Schönheit in der Ödnis: Von Zabriskie Point bis Badwater Basin – Death Valley an einem Tag',
      },
      slogan3: {
        ja: '砂漠の極限が生んだ傑作——ラスベガス発デスバレー プレミアム日帰りツアー',
        'zh-CN': '沙漠极端气候造就的杰作——拉斯维加斯出发死亡谷精品一日游',
        'zh-TW': '沙漠極端氣候造就的傑作——拉斯維加斯出發死亡谷精品一日遊',
        es: 'Una obra maestra del desierto extremo — Tour premium de un día a Death Valley desde Las Vegas',
        fr: 'Un chef-d’œuvre forgé par les extrêmes du désert — Excursion premium Death Valley au départ de Las Vegas',
        de: 'Ein Meisterwerk der Wüstenextreme — Premium-Tagestour Death Valley ab Las Vegas',
      },
    },
  },

  MDDT: {
    name: {
      ja: 'ラスベガス近郊名所 1日ツアー｜フーバーダム＆バレー・オブ・ファイア',
      'zh-CN': '拉斯维加斯周边景点一日游｜胡佛大坝 & 火谷',
      'zh-TW': '拉斯維加斯週邊景點一日遊｜胡佛大壩 & 火谷',
      es: 'Tour de un día por atracciones cercanas | Presa Hoover y Valley of Fire',
      fr: 'Excursion d’une journée aux attractions proches | Barrage Hoover et Valley of Fire',
      de: 'Tagestour zu Nahzielen | Hoover-Damm & Valley of Fire',
    },
    customer_name: {
      ja: 'ラスベガス近郊5大名所デーツアー｜フーバーダム・バレー・オブ・ファイア・ネルソン・セブンマジックマウンテン',
      'zh-CN': '拉斯维加斯周边五大景点一日游｜胡佛大坝·火谷·纳尔逊鬼城·七魔法山',
      'zh-TW': '拉斯維加斯週邊五大景點一日遊｜胡佛大壩·火谷·納爾遜鬼城·七魔法山',
      es: 'Tour de un día a 5 atracciones cercanas | Presa Hoover, Valley of Fire, Nelson y Seven Magic Mountains',
      fr: 'Excursion d’une journée : 5 sites proches | Barrage Hoover, Valley of Fire, Nelson et Seven Magic Mountains',
      de: 'Tagestour zu 5 Nahzielen | Hoover-Damm, Valley of Fire, Nelson & Seven Magic Mountains',
    },
    summary: {
      ja: 'ラスベガス近郊の代表スポットを1日で巡るツアーです。バレー・オブ・ファイア州立公園、フーバーダムとミード湖、西部劇の撮影地のようなネルソン・ゴーストタウン、色鮮やかなセブンマジックマウンテンまで。初めてのラスベガス旅行にもおすすめの行程です。',
      'zh-CN': '一天打卡拉斯维加斯周边代表性景点：火谷州立公园、胡佛大坝与米德湖、西部片取景地般的纳尔逊鬼城，以及色彩斑斓的七魔法山——非常适合第一次来拉斯维加斯的旅客。',
      'zh-TW': '一天打卡拉斯維加斯週邊代表性景點：火谷州立公園、胡佛大壩與米德湖、西部片取景地般的納爾遜鬼城，以及色彩繽紛的七魔法山——非常適合第一次來拉斯維加斯的旅客。',
      es: 'Explore en un día las principales atracciones cercanas a Las Vegas: Valley of Fire, Presa Hoover y Lake Mead, el histórico Nelson Ghost Town y las coloridas Seven Magic Mountains. Ideal para una primera visita.',
      fr: 'Découvrez en une journée les sites phares autour de Las Vegas : Valley of Fire, barrage Hoover et lac Mead, le village fantôme de Nelson et les colorées Seven Magic Mountains. Idéal pour une première visite.',
      de: 'Entdecken Sie an einem Tag die Top-Ziele rund um Las Vegas: Valley of Fire, Hoover-Damm & Lake Mead, die historische Geisterstadt Nelson und die bunten Seven Magic Mountains – ideal für den ersten Besuch.',
    },
  },

  MDFIRE: {
    name: {
      ja: 'バレー・オブ・ファイア ツアー',
      'zh-CN': '火谷之旅',
      'zh-TW': '火谷之旅',
      es: 'Tour Valley of Fire',
      fr: 'Tour Valley of Fire',
      de: 'Valley-of-Fire-Tour',
    },
    customer_name: {
      ja: 'ラスベガス発｜バレー・オブ・ファイア 半日ツアー｜プレミアム少人数',
      'zh-CN': '拉斯维加斯出发｜火谷半日游｜精品小团',
      'zh-TW': '拉斯維加斯出發｜火谷半日遊｜精品小團',
      es: 'Las Vegas > Tour de medio día a Valley of Fire | Grupo reducido premium',
      fr: 'Las Vegas > Demi-journée à Valley of Fire | Petit groupe premium',
      de: 'Las Vegas > Halbtagestour Valley of Fire | Premium-Kleingruppe',
    },
    summary: {
      ja: '出発地：ラスベガス\n所要時間：5時間\n含まれるもの：入場料、ミネラルウォーター、ホテルピックアップ\n含まれないもの：ガイドチップ',
      'zh-CN': '出发地：拉斯维加斯\n行程时长：5小时\n包含：门票、瓶装水、酒店接送\n不包含：导游小费',
      'zh-TW': '出發地：拉斯維加斯\n行程時長：5小時\n包含：門票、瓶裝水、飯店接送\n不包含：導遊小費',
      es: 'Salida: Las Vegas\nDuración: 5 horas\nIncluye: entradas, agua embotellada, recogida en hotel\nNo incluye: propina al guía',
      fr: 'Départ : Las Vegas\nDurée : 5 heures\nInclus : droits d’entrée, eau en bouteille, prise en charge à l’hôtel\nNon inclus : pourboire du guide',
      de: 'Abfahrt: Las Vegas\nDauer: 5 Stunden\nInklusive: Eintritt, Mineralwasser, Hotelabholung\nNicht inklusive: Guide-Trinkgeld',
    },
    slogans: {
      slogan1: {
        ja: 'ラスベガス発バレー・オブ・ファイア——赤岩の絶景をめぐる旅',
        'zh-CN': '拉斯维加斯出发火谷之旅——穿越壮丽红岩地貌',
        'zh-TW': '拉斯維加斯出發火谷之旅——穿越壯麗紅岩地貌',
        es: 'Tour a Valley of Fire desde Las Vegas: un viaje por el espectacular paisaje de roca roja',
        fr: 'Valley of Fire au départ de Las Vegas : un voyage dans un paysage de roches rouges spectaculaire',
        de: 'Valley of Fire ab Las Vegas – Reise durch spektakuläre Rotfelsenlandschaft',
      },
      slogan2: {
        ja: 'バレー・オブ・ファイア州立公園——ネバダの赤い砂漠を体感',
        'zh-CN': '火谷州立公园——感受内华达红色沙漠',
        'zh-TW': '火谷州立公園——感受內華達紅色沙漠',
        es: 'Valley of Fire State Park: el desierto rojo más impresionante de Nevada',
        fr: 'Valley of Fire State Park : le désert rouge spectaculaire du Nevada',
        de: 'Valley of Fire State Park – Nevadas beeindruckende rote Wüste',
      },
      slogan3: {
        ja: '少人数で巡るバレー・オブ・ファイア——フォトスポットと自然トレイル',
        'zh-CN': '精品小团探索火谷——经典拍照点与自然步道',
        'zh-TW': '精品小團探索火谷——經典拍照點與自然步道',
        es: 'Aventura en grupo reducido: puntos icónicos para fotos y senderos panorámicos',
        fr: 'Aventure en petit groupe : spots photo iconiques et sentiers panoramiques',
        de: 'Kleingruppen-Abenteuer: ikonische Fotospots und Panoramawege',
      },
    },
  },

  MDGC1D: {
    name: {
      ja: 'グランドサークル 1日ツアー',
      'zh-CN': '大环线一日游',
      'zh-TW': '大環線一日遊',
      es: 'Tour de 1 día por el Grand Circle',
      fr: 'Excursion d’une journée Grand Circle',
      de: 'Grand-Circle-1-Tages-Tour',
    },
    customer_name: {
      ja: 'グランドサークル日帰り｜アンテロープキャニオン＋ホースシューベンド＋グランドキャニオン｜プレミアム少人数',
      'zh-CN': '大环线一日游｜羚羊峡谷 + 马蹄湾 + 大峡谷｜精品小团',
      'zh-TW': '大環線一日遊｜羚羊峽谷 + 馬蹄灣 + 大峽谷｜精品小團',
      es: 'Grand Circle en 1 día | Antelope Canyon + Horseshoe Bend + Gran Cañón | Grupo reducido premium',
      fr: 'Grand Circle en 1 jour | Antelope Canyon + Horseshoe Bend + Grand Canyon | Petit groupe premium',
      de: 'Grand Circle an 1 Tag | Antelope Canyon + Horseshoe Bend + Grand Canyon | Premium-Kleingruppe',
    },
    slogans: {
      slogan1: {
        ja: '要点だけ、スピーディーに：アンテロープ＋ホースシュー＋グランドキャニオン東縁・南縁',
        'zh-CN': '精华速览：一天打卡羚羊峡谷 + 马蹄湾 + 大峡谷东缘·南缘',
        'zh-TW': '精華速覽：一天打卡羚羊峽谷 + 馬蹄灣 + 大峽谷東緣·南緣',
        es: 'Lo esencial, sin rodeos: Antelope Canyon + Horseshoe Bend + East & South Rim del Gran Cañón',
        fr: 'L’essentiel, sans détour : Antelope Canyon + Horseshoe Bend + East & South Rim du Grand Canyon',
        de: 'Das Wesentliche, kompakt: Antelope Canyon + Horseshoe Bend + East & South Rim',
      },
      slogan2: {
        ja: '混雑を避ける早朝出発で、効率よく回る最適ルート',
        'zh-CN': '清晨出发避开人潮，路线高效优化',
        'zh-TW': '清晨出發避開人潮，路線高效優化',
        es: 'Salida temprano para evitar multitudes y un recorrido optimizado',
        fr: 'Départ tôt pour éviter la foule, itinéraire optimisé',
        de: 'Früher Start gegen Menschenmassen – optimierte Route',
      },
      slogan3: {
        ja: '少人数プレミアム——安全・快適・フォトタイムをしっかり確保',
        'zh-CN': '精品小团体验——安全舒适，充足拍照时间',
        'zh-TW': '精品小團體驗——安全舒適，充足拍照時間',
        es: 'Experiencia premium en grupo reducido: seguridad, confort y tiempo para fotos',
        fr: 'Expérience premium en petit groupe : sécurité, confort et temps photo',
        de: 'Premium-Kleingruppe: Sicherheit, Komfort und Zeit für Fotos',
      },
    },
  },

  MDGCSUNRISE: {
    name: {
      ja: 'ナイトゴブリン',
      'zh-CN': '夜精灵',
      'zh-TW': '夜精靈',
      es: 'Night Goblin',
      fr: 'Night Goblin',
      de: 'Night Goblin',
    },
    customer_name: {
      ja: 'ラスベガス発｜グランドキャニオン日の出＋アンテロープキャニオン＆ホースシューベンド｜プレミアムグループツアー',
      'zh-CN': '拉斯维加斯出发｜大峡谷日出 + 羚羊峡谷 & 马蹄湾｜精品小团游',
      'zh-TW': '拉斯維加斯出發｜大峽谷日出 + 羚羊峽谷 & 馬蹄灣｜精品小團旅遊',
      es: 'Las Vegas > Amanecer en el Gran Cañón + Antelope Canyon y Horseshoe Bend | Tour premium en grupo',
      fr: 'Las Vegas > Lever de soleil au Grand Canyon + Antelope Canyon & Horseshoe Bend | Circuit premium en groupe',
      de: 'Las Vegas > Grand-Canyon-Sonnenaufgang + Antelope Canyon & Horseshoe Bend | Premium-Gruppentour',
    },
    summary: {
      ja: '出発地：ラスベガス\n所要時間：18時間\n出発時間：午前0時（日の出時刻により変動）\nピックアップ：ツアー日前日の夜（23:00 ±30分）\n含まれるもの：入場料、ミネラルウォーター、ホテルピックアップ\n含まれないもの：ガイドチップ／食事',
      'zh-CN': '出发地：拉斯维加斯\n行程时长：18小时\n出发时间：凌晨00:00（随日出时间调整）\n接送时间：行程日前一晚（约23:00 ±30分钟）\n包含：门票、瓶装水、酒店接送\n不包含：导游小费 / 餐食',
      'zh-TW': '出發地：拉斯維加斯\n行程時長：18小時\n出發時間：凌晨00:00（依日出時間調整）\n接送時間：行程日前一晚（約23:00 ±30分鐘）\n包含：門票、瓶裝水、飯店接送\n不包含：導遊小費 / 餐食',
      es: 'Salida: Las Vegas\nDuración: 18 horas\nHora de salida: 00:00 (puede variar según el amanecer)\nRecogida: la noche anterior a la fecha del tour (alrededor de las 23:00 ± 30 min)\nIncluye: entradas, agua embotellada, recogida en hotel\nNo incluye: propina al guía / comidas',
      fr: 'Départ : Las Vegas\nDurée : 18 heures\nHeure de départ : 00 h 00 (selon l’heure du lever du soleil)\nPrise en charge : la veille au soir (vers 23 h 00 ± 30 min)\nInclus : droits d’entrée, eau en bouteille, prise en charge à l’hôtel\nNon inclus : pourboire du guide / repas',
      de: 'Abfahrt: Las Vegas\nDauer: 18 Stunden\nAbfahrtzeit: 00:00 Uhr (je nach Sonnenaufgang)\nAbholung: am Vorabend des Tourdatums (ca. 23:00 ± 30 Min.)\nInklusive: Eintrittsgelder, Mineralwasser, Hotelabholung\nNicht inklusive: Guide-Trinkgeld / Mahlzeiten',
    },
    slogans: {
      slogan1: {
        ja: 'ラスベガス発、1日で巡るグランドキャニオン日の出ツアー',
        'zh-CN': '拉斯维加斯出发，一天看尽大峡谷日出',
        'zh-TW': '拉斯維加斯出發，一天看盡大峽谷日出',
        es: 'Tour al amanecer en el Gran Cañón desde Las Vegas en un día',
        fr: 'Lever de soleil au Grand Canyon au départ de Las Vegas en une journée',
        de: 'Grand-Canyon-Sonnenaufgang ab Las Vegas an einem Tag',
      },
      slogan2: {
        ja: '宿泊なしで楽しむ、夜出発のナイトゴブリン・グランドキャニオンツアー',
        'zh-CN': '无需住宿——夜精灵大峡谷日出一日游',
        'zh-TW': '無需住宿——夜精靈大峽谷日出一日遊',
        es: 'Tour Night Goblin: Gran Cañón desde Las Vegas sin alojamiento',
        fr: 'Tour Night Goblin : Grand Canyon depuis Las Vegas sans hébergement',
        de: 'Night-Goblin-Tour: Grand Canyon ab Las Vegas ohne Übernachtung',
      },
      slogan3: {
        ja: '夜空から日の出まで。グランドサークルを1日で完結',
        'zh-CN': '从夜空到日出，一天走完大环线精华',
        'zh-TW': '從夜空到日出，一天走完大環線精華',
        es: 'Grand Circle en un día: cielo nocturno y amanecer incluidos',
        fr: 'Grand Circle en une journée : ciel nocturne et lever du soleil',
        de: 'Grand Circle an einem Tag – Sternenhimmel und Sonnenaufgang',
      },
      slogan4: {
        ja: 'ラスベガス発、宿泊なしの夜のグランドキャニオン旅行',
        'zh-CN': '拉斯维加斯夜间出发大峡谷之旅——无需住宿',
        'zh-TW': '拉斯維加斯夜間出發大峽谷之旅——無需住宿',
        es: 'Excursión nocturna al Gran Cañón desde Las Vegas, sin alojamiento',
        fr: 'Excursion de nuit au Grand Canyon au départ de Las Vegas, sans hébergement',
        de: 'Nachtabfahrt zum Grand Canyon ab Las Vegas – ohne Unterkunft',
      },
      slogan5: {
        ja: '夜空と日の出まで——1日で完結するグランドサークル日帰りツアー',
        'zh-CN': '一天走完大环线精华，夜空与日出尽在其中',
        'zh-TW': '一天走完大環線精華，夜空與日出盡在其中',
        es: 'Grand Circle en un día: del cielo estrellado al amanecer',
        fr: 'Grand Circle en une journée : du ciel étoilé au lever du soleil',
        de: 'Grand Circle an einem Tag – vom Sternenhimmel bis zum Sonnenaufgang',
      },
    },
  },

  MDGWEST: {
    name: {
      ja: 'ウェ스트림 ツアー',
      'zh-CN': '西缘之旅',
      'zh-TW': '西緣之旅',
      es: 'Tour West Rim',
      fr: 'Tour West Rim',
      de: 'West-Rim-Tour',
    },
    customer_name: {
      ja: 'グランドキャニオン・ウェ스트림 ツアー',
      'zh-CN': '大峡谷西缘一日游',
      'zh-TW': '大峽谷西緣一日遊',
      es: 'Tour al Gran Cañón West Rim',
      fr: 'Excursion au Grand Canyon West Rim',
      de: 'Grand-Canyon-West-Rim-Tour',
    },
    slogans: {
      slogan1: {
        ja: 'ラスベガスから約2.5時間——グランドキャニオンの感動をVIPスタイルで',
        'zh-CN': '距拉斯维加斯约2.5小时——以VIP体验感受大峡谷震撼',
        'zh-TW': '距拉斯維加斯約2.5小時——以VIP體驗感受大峽谷震撼',
        es: 'A solo 2,5 horas de Las Vegas: la emoción del Gran Cañón con estilo VIP',
        fr: 'À seulement 2 h 30 de Las Vegas : l’émotion du Grand Canyon en mode VIP',
        de: 'Nur 2,5 Stunden von Las Vegas – Grand-Canyon-Staunen im VIP-Stil',
      },
      slogan2: {
        ja: '少人数プレミアムで、ゆったり楽しむウェ스트림日帰り',
        'zh-CN': '精品小团，从容享受西缘一日游',
        'zh-TW': '精品小團，從容享受西緣一日遊',
        es: 'Día relajado en el West Rim con experiencia premium en grupo reducido',
        fr: 'Journée détendue au West Rim en petit groupe premium',
        de: 'Entspannter West-Rim-Tagestour in Premium-Kleingruppe',
      },
      slogan3: {
        ja: 'ラスベガスから最も近いグランドキャニオン——ウェ스트림の絶景を1日で',
        'zh-CN': '离拉斯维加斯最近的大峡谷——一天尽览西缘绝景',
        'zh-TW': '離拉斯維加斯最近的大峽谷——一天盡覽西緣絕景',
        es: 'El Gran Cañón más cercano a Las Vegas: disfrute del West Rim en un día',
        fr: 'Le Grand Canyon le plus proche de Las Vegas : le West Rim en une journée',
        de: 'Der Grand Canyon am nächsten zu Las Vegas – West Rim an einem Tag',
      },
    },
  },

  MDLVN: {
    name: {
      ja: 'ナイトツアー',
      'zh-CN': '夜游',
      'zh-TW': '夜遊',
      es: 'Tour nocturno',
      fr: 'Tour nocturne',
      de: 'Nachttour',
    },
    customer_name: {
      ja: 'ラスベガス夜景シティツアー｜ウェルカムサイン・ベラージオ噴水・フリーモントストリート',
      'zh-CN': '拉斯维加斯夜景城市游｜欢迎牌·贝拉吉奥喷泉·弗里蒙特街',
      'zh-TW': '拉斯維加斯夜景城市遊｜歡迎牌·貝拉吉歐噴泉·弗里蒙特街',
      es: 'Tour nocturno por Las Vegas | Welcome Sign, fuentes del Bellagio y Fremont Street',
      fr: 'Tour nocturne de Las Vegas | Welcome Sign, fontaines du Bellagio et Fremont Street',
      de: 'Las-Vegas-Nachtstadt-Tour | Welcome Sign, Bellagio-Brunnen & Fremont Street',
    },
    slogans: {
      slogan1: {
        ja: 'ラスベガス・ストリップ夜景ツアー——まばゆいネオンと息をのむ夜の景色',
        'zh-CN': '拉斯维加斯大道夜景游——闪耀霓虹与醉人夜色',
        'zh-TW': '拉斯維加斯大道夜景遊——閃耀霓虹與醉人夜色',
        es: 'Tour nocturno por el Strip: luces de neón y una vista nocturna impresionante',
        fr: 'Tour nocturne du Strip : néons éclatants et panorama de nuit à couper le souffle',
        de: 'Strip-Nachttour: gleißende Neonlichter und atemberaubende Nachtkulisse',
      },
      slogan2: {
        ja: 'ラスベガスの夜——ベラージオ噴水からフリーモントストリートまで',
        'zh-CN': '拉斯维加斯夜生活——从贝拉吉奥喷泉到弗里蒙特街',
        'zh-TW': '拉斯維加斯夜生活——從貝拉吉歐噴泉到弗里蒙特街',
        es: 'Noche en Las Vegas: de las fuentes del Bellagio a Fremont Street',
        fr: 'Nuit à Las Vegas : des fontaines du Bellagio à Fremont Street',
        de: 'Las-Vegas-Nacht: Von den Bellagio-Fontänen zur Fremont Street',
      },
      slogan3: {
        ja: '少人数プレミアム夜景ツアー——ベストフォトスポットと輝く光の街',
        'zh-CN': '精品小团夜景游——最佳拍照点与璀璨灯火',
        'zh-TW': '精品小團夜景遊——最佳拍照點與璀璨燈火',
        es: 'Tour nocturno premium en grupo reducido: mejores spots fotográficos y luces deslumbrantes',
        fr: 'Tour nocturne premium en petit groupe : meilleurs spots photo et lumières éclatantes',
        de: 'Premium-Nachtour in Kleingruppe: beste Fotospots und strahlende Lichter',
      },
    },
  },

  MNGC1N: {
    name: {
      ja: 'グランドサークル 1泊2日',
      'zh-CN': '大环线两日一夜',
      'zh-TW': '大環線兩日一夜',
      es: 'Grand Circle 2D/1N',
      fr: 'Grand Circle 2J/1N',
      de: 'Grand Circle 2T/1N',
    },
    customer_name: {
      ja: 'ラスベガス発｜グランドサークル1泊2日｜グランドキャニオン・ザイオン・ブライス・ホースシューベンド・アンテロープ｜プレミアム少人数',
      'zh-CN': '拉斯维加斯出发｜大环线两日一夜｜大峡谷·锡安·布莱斯·马蹄湾·羚羊峡谷｜精品小团',
      'zh-TW': '拉斯維加斯出發｜大環線兩日一夜｜大峽谷·錫安·布萊斯·馬蹄灣·羚羊峽谷｜精品小團',
      es: 'Las Vegas > Grand Circle 2 días | Gran Cañón · Zion · Bryce · Horseshoe Bend · Antelope Canyon | Grupo reducido premium',
      fr: 'Las Vegas > Grand Circle 2 jours | Grand Canyon · Zion · Bryce · Horseshoe Bend · Antelope Canyon | Petit groupe premium',
      de: 'Las Vegas > Grand Circle 2 Tage | Grand Canyon · Zion · Bryce · Horseshoe Bend · Antelope Canyon | Premium-Kleingruppe',
    },
    summary: {
      ja: '所要時間：1泊2日\n出発時間：午前5時\n含まれるもの：入場料、ミネラルウォーター、ホテルピックアップ\n含まれないもの：ガイドチップ／食事\n予約：事前予約必須',
      'zh-CN': '行程时长：两日一夜\n出发时间：上午5:00\n包含：门票、瓶装水、酒店接送\n不包含：导游小费 / 餐食\n预订：需提前预约',
      'zh-TW': '行程時長：兩日一夜\n出發時間：上午5:00\n包含：門票、瓶裝水、飯店接送\n不包含：導遊小費 / 餐食\n預訂：需提前預約',
      es: 'Duración: 2 días / 1 noche\nSalida: 5:00 a. m.\nIncluye: entradas, agua embotellada, recogida en hotel\nNo incluye: propina al guía / comidas\nReserva: anticipada obligatoria',
      fr: 'Durée : 2 jours / 1 nuit\nDépart : 5 h 00\nInclus : droits d’entrée, eau en bouteille, prise en charge à l’hôtel\nNon inclus : pourboire du guide / repas\nRéservation : obligatoire à l’avance',
      de: 'Dauer: 2 Tage / 1 Nacht\nAbfahrt: 5:00 Uhr\nInklusive: Eintritt, Mineralwasser, Hotelabholung\nNicht inklusive: Guide-Trinkgeld / Mahlzeiten\nBuchung: Vorabreservierung erforderlich',
    },
    slogans: {
      slogan1: {
        ja: 'アメリカ南西部の絶景を2日で——グランドキャニオンからザイオン・ブライスまで、忘れられない1泊2日',
        'zh-CN': '两天尽览美国西南部精华——从壮丽大峡谷到锡安与布莱斯，难忘过夜之旅',
        'zh-TW': '兩天盡覽美國西南部精華——從壯麗大峽谷到錫安與布萊斯，難忘過夜之旅',
        es: 'Lo mejor del suroeste en 2 días: del majestuoso Gran Cañón a Zion y Bryce Canyon',
        fr: 'Le meilleur du Sud-Ouest en 2 jours : du majestueux Grand Canyon à Zion et Bryce Canyon',
        de: 'Das Beste des Südwestens in 2 Tagen: vom Grand Canyon bis Zion und Bryce Canyon',
      },
      slogan2: {
        ja: 'ラスベガス発ロードトリップ——アンテロープ・ホースシューベンド・グランドキャニオンを1日で',
        'zh-CN': '拉斯维加斯出发公路之旅——一天打卡羚羊峡谷、马蹄湾与大峡谷',
        'zh-TW': '拉斯維加斯出發公路之旅——一天打卡羚羊峽谷、馬蹄灣與大峽谷',
        es: 'Road trip desde Las Vegas: Antelope Canyon, Horseshoe Bend y Gran Cañón en un día',
        fr: 'Road trip depuis Las Vegas : Antelope Canyon, Horseshoe Bend et Grand Canyon en une journée',
        de: 'Roadtrip ab Las Vegas: Antelope Canyon, Horseshoe Bend & Grand Canyon an einem Tag',
      },
      slogan3: {
        ja: '満天の星空とグランドキャニオンの威容——砂漠の夜から始まるプレミアム少人数1泊2日',
        'zh-CN': '满天繁星与大峡谷的壮阔——沙漠之夜开启的精品小团两日一夜',
        'zh-TW': '滿天繁星與大峽谷的壯闊——沙漠之夜開啟的精品小團兩日一夜',
        es: 'Cielo estrellado y la majestuosidad del Gran Cañón en una aventura premium de 2 días',
        fr: 'Ciel étoilé et majesté du Grand Canyon — aventure premium de 2 jours en petit groupe',
        de: 'Sternenhimmel und Grand-Canyon-Majestät — Premium-Kleingruppe in 2 Tagen',
      },
    },
  },

  MNGC2N: {
    name: {
      ja: 'グランドサークル 2泊3日ツアー',
      'zh-CN': '大环线三日两夜游',
      'zh-TW': '大環線三日兩夜遊',
      es: 'Tour Grand Circle 3D/2N',
      fr: 'Circuit Grand Circle 3J/2N',
      de: 'Grand-Circle-Tour 3T/2N',
    },
    customer_name: {
      ja: 'ラスベガス発｜グランドサークル2泊3日（モニュメントバレー含む）｜プレミアム少人数',
      'zh-CN': '拉斯维加斯出发｜大环线三日两夜（含纪念碑谷）｜精品小团',
      'zh-TW': '拉斯維加斯出發｜大環線三日兩夜（含紀念碑谷）｜精品小團',
      es: 'Las Vegas > Grand Circle 3 días incl. Monument Valley | Grupo reducido premium',
      fr: 'Las Vegas > Grand Circle 3 jours incl. Monument Valley | Petit groupe premium',
      de: 'Las Vegas > Grand Circle 3 Tage inkl. Monument Valley | Premium-Kleingruppe',
    },
    summary: {
      ja: '出発地：ラスベガス\n所要時間：2泊3日\n出発時間：午前5時\n含まれるもの：3つ星ホテル（2泊）、ミネラルウォーター、入場料、ホテルピックアップ\n含まれないもの：食事、ガイドチップ',
      'zh-CN': '出发地：拉斯维加斯\n行程时长：三日两夜\n出发时间：上午5:00\n包含：三星级酒店（2晚）、瓶装水、门票、酒店接送\n不包含：餐食、导游小费',
      'zh-TW': '出發地：拉斯維加斯\n行程時長：三日兩夜\n出發時間：上午5:00\n包含：三星級飯店（2晚）、瓶裝水、門票、飯店接送\n不包含：餐食、導遊小費',
      es: 'Salida: Las Vegas\nDuración: 3 días / 2 noches\nSalida: 5:00 a. m.\nIncluye: hotel 3 estrellas (2 noches), agua embotellada, entradas, recogida en hotel\nNo incluye: comidas, propina al guía',
      fr: 'Départ : Las Vegas\nDurée : 3 jours / 2 nuits\nDépart : 5 h 00\nInclus : hôtel 3 étoiles (2 nuits), eau en bouteille, droits d’entrée, prise en charge à l’hôtel\nNon inclus : repas, pourboire du guide',
      de: 'Abfahrt: Las Vegas\nDauer: 3 Tage / 2 Nächte\nAbfahrt: 5:00 Uhr\nInklusive: 3-Sterne-Hotel (2 Nächte), Mineralwasser, Eintritt, Hotelabholung\nNicht inklusive: Mahlzeiten, Guide-Trinkgeld',
    },
    slogans: {
      slogan1: {
        ja: '息をのむアメリカ南西部——2泊3日グランドサークル・ロードトリップ',
        'zh-CN': '壮美美国西南——三日两夜大环线公路之旅',
        'zh-TW': '壯美美國西南——三日兩夜大環線公路之旅',
        es: 'Road trip Grand Circle de 3 días por los paisajes del suroeste americano',
        fr: 'Road trip Grand Circle de 3 jours à travers les paysages du Sud-Ouest américain',
        de: '3-tägiger Grand-Circle-Roadtrip durch den atemberaubenden Südwesten',
      },
      slogan2: {
        ja: '3日間のタイムトラベル——何百万年もの地球の歴史を歩く旅',
        'zh-CN': '三日时间之旅——走过数百万年的地球史诗',
        'zh-TW': '三日時間之旅——走過數百萬年的地球史詩',
        es: 'Un viaje de 3 días en el tiempo: camine por millones de años de historia de la Tierra',
        fr: 'Un voyage de 3 jours dans le temps : marchez à travers des millions d’années d’histoire terrestre',
        de: '3 Tage Zeitreise: Millionen Jahre Erdgeschichte zu Fuß erleben',
      },
      slogan3: {
        ja: 'ラスベガス発、究極のグランドサークル探検 2泊3日',
        'zh-CN': '拉斯维加斯出发——终极大环线探险三日两夜',
        'zh-TW': '拉斯維加斯出發——終極大環線探險三日兩夜',
        es: 'La aventura definitiva Grand Circle de 3 días desde Las Vegas',
        fr: 'L’aventure ultime Grand Circle de 3 jours au départ de Las Vegas',
        de: 'Das ultimative 3-Tage-Grand-Circle-Abenteuer ab Las Vegas',
      },
    },
  },

  MNGC3N: {
    name: {
      ja: 'グランドサークル 3泊4日ツアー',
      'zh-CN': '大环线四日三夜游',
      'zh-TW': '大環線四日三夜遊',
      es: 'Tour Grand Circle 4D/3N',
      fr: 'Circuit Grand Circle 4J/3N',
      de: 'Grand-Circle-Tour 4T/3N',
    },
    customer_name: {
      ja: 'ラスベガス発｜グランドサークル3泊4日｜ブライス・ザイオン・アンテロープ・グランドキャニオン・モニュメントバレー・アーチーズ・キャニオンランズ・ホースシューベンド',
      'zh-CN': '拉斯维加斯出发｜大环线四日三夜｜布莱斯·锡安·羚羊峡谷·大峡谷·纪念碑谷·拱门·峡谷地·马蹄湾',
      'zh-TW': '拉斯維加斯出發｜大環線四日三夜｜布萊斯·錫安·羚羊峽谷·大峽谷·紀念碑谷·拱門·峽谷地·馬蹄灣',
      es: 'Las Vegas > Grand Circle 4 días | Bryce · Zion · Antelope · Gran Cañón · Monument Valley · Arches · Canyonlands · Horseshoe Bend',
      fr: 'Las Vegas > Grand Circle 4 jours | Bryce · Zion · Antelope · Grand Canyon · Monument Valley · Arches · Canyonlands · Horseshoe Bend',
      de: 'Las Vegas > Grand Circle 4 Tage | Bryce · Zion · Antelope · Grand Canyon · Monument Valley · Arches · Canyonlands · Horseshoe Bend',
    },
    summary: {
      ja: 'ラスベガス発のプレミアム少人数ツアー。3泊4日でグランドキャニオン・モニュメントバレー・アーチーズ・キャニオンランズ・ブライス・ザイオン・アンテロープキャニオン・ホースシューベンドをスムーズに巡ります。',
      'zh-CN': '拉斯维加斯出发精品小团：四日三夜一站式走完大峡谷、纪念碑谷、拱门、峡谷地、布莱斯、锡安、羚羊峡谷与马蹄湾。',
      'zh-TW': '拉斯維加斯出發精品小團：四日三夜一站式走完大峽谷、紀念碑谷、拱門、峽谷地、布萊斯、錫安、羚羊峽谷與馬蹄灣。',
      es: 'Viaje premium en grupo reducido de 4 días / 3 noches desde Las Vegas: Gran Cañón, Monument Valley, Arches, Canyonlands, Bryce, Zion, Antelope Canyon y Horseshoe Bend en una sola ruta.',
      fr: 'Circuit premium en petit groupe de 4 jours / 3 nuits au départ de Las Vegas : Grand Canyon, Monument Valley, Arches, Canyonlands, Bryce, Zion, Antelope Canyon et Horseshoe Bend en un seul itinéraire.',
      de: 'Premium-Kleingruppe 4 Tage / 3 Nächte ab Las Vegas: Grand Canyon, Monument Valley, Arches, Canyonlands, Bryce, Zion, Antelope Canyon und Horseshoe Bend in einer Route.',
    },
    slogans: {
      slogan1: {
        ja: 'ラスベガス発グランドサークル3泊4日——グランドキャニオン・ブライス・ザイオン・アンテロープなど南西部のベストを網羅',
        'zh-CN': '拉斯维加斯出发大环线四日三夜——大峡谷、布莱斯、锡安、羚羊峡谷等西南精华一次收齐',
        'zh-TW': '拉斯維加斯出發大環線四日三夜——大峽谷、布萊斯、錫安、羚羊峽谷等西南精華一次收齊',
        es: 'Grand Circle 4 días desde Las Vegas: Gran Cañón, Bryce, Zion, Antelope Canyon y lo mejor del suroeste',
        fr: 'Grand Circle 4 jours depuis Las Vegas : Grand Canyon, Bryce, Zion, Antelope Canyon et le meilleur du Sud-Ouest',
        de: '4-Tage-Grand-Circle ab Las Vegas: Grand Canyon, Bryce, Zion, Antelope Canyon & Südwest-Highlights',
      },
      slogan2: {
        ja: 'アメリカ南西部ハイライト、グランドサークル3泊4日｜サウスリム・イーストリム・モニュメントバレー・ホースシューベンド込み',
        'zh-CN': '美国西南亮点之旅，大环线四日三夜｜含南缘·东缘·纪念碑谷·马蹄湾',
        'zh-TW': '美國西南亮點之旅，大環線四日三夜｜含南緣·東緣·紀念碑谷·馬蹄灣',
        es: 'Highlights del suroeste: Grand Circle 4 días / 3 noches | Incluye South Rim, East Rim, Monument Valley y Horseshoe Bend',
        fr: 'Highlights du Sud-Ouest : Grand Circle 4 jours / 3 nuits | Inclut South Rim, East Rim, Monument Valley et Horseshoe Bend',
        de: 'Südwest-Highlights: Grand Circle 4 Tage / 3 Nächte | inkl. South Rim, East Rim, Monument Valley & Horseshoe Bend',
      },
      slogan3: {
        ja: 'アンテロープとホースシューからブライス・ザイオンまで｜ラスベガス発グランドサークル3泊4日オールインワン',
        'zh-CN': '从羚羊峡谷、马蹄湾到布莱斯与锡安｜拉斯维加斯出发大环线四日三夜一价全含体验',
        'zh-TW': '從羚羊峽谷、馬蹄灣到布萊斯與錫安｜拉斯維加斯出發大環線四日三夜一次打包',
        es: 'De Antelope Canyon y Horseshoe Bend a Bryce y Zion | Grand Circle 4 días all-in-one desde Las Vegas',
        fr: 'D’Antelope Canyon et Horseshoe Bend à Bryce et Zion | Grand Circle 4 jours all-in-one au départ de Las Vegas',
        de: 'Von Antelope Canyon & Horseshoe Bend bis Bryce und Zion | Grand Circle 4 Tage all-in-one ab Las Vegas',
      },
    },
  },

  MSGOLFT: {
    name: {
      ja: 'ラスベガス｜ゴルフツアー＋18ホール｜クラブレンタル可',
      'zh-CN': '拉斯维加斯｜高尔夫之旅 + 18洞｜可租球杆',
      'zh-TW': '拉斯維加斯｜高爾夫之旅 + 18洞｜可租球桿',
      es: 'Las Vegas > Tour de golf + 18 hoyos | Opción de alquiler de palos',
      fr: 'Las Vegas > Tour de golf + 18 trous | Option location de clubs',
      de: 'Las Vegas > Golf-Tour + 18 Loch | Schlägerverleih optional',
    },
    customer_name: {
      ja: 'ラスベガス｜ゴルフツアー＋18ホール｜クラブレンタル可',
      'zh-CN': '拉斯维加斯｜高尔夫之旅 + 18洞果岭费·球车｜精品小团',
      'zh-TW': '拉斯維加斯｜高爾夫之旅 + 18洞果嶺費·球車｜精品小團',
      es: 'Las Vegas > Tour de golf + 18 hoyos | Green fee y carrito | Grupo reducido premium',
      fr: 'Las Vegas > Tour de golf + 18 trous | Green fee et voiturette | Petit groupe premium',
      de: 'Las Vegas > Golf-Tour + 18 Loch | Greenfee & Cart | Premium-Kleingruppe',
    },
    slogans: {
      slogan1: {
        ja: 'ラスベガスでラウンドを一気に——ティータイム・ピックアップ・レンタルまでワンストップ',
        'zh-CN': '拉斯维加斯一站式开球——开球时间、接送与租杆一次搞定',
        'zh-TW': '拉斯維加斯一站式開球——開球時間、接送與租桿一次搞定',
        es: 'Complete su ronda en Las Vegas de una vez: tee time, recogida y alquiler en un solo lugar',
        fr: 'Votre partie à Las Vegas en un seul geste : tee time, prise en charge et location',
        de: 'Ihre Runde in Las Vegas komplett: Tee-Zeit, Abholung und Verleih aus einer Hand',
      },
      slogan2: {
        ja: '少人数プレミアムゴルフ——コース・時間・グレードを好みに合わせて',
        'zh-CN': '精品小团高尔夫——球场、时段与级别随心定制',
        'zh-TW': '精品小團高爾夫——球場、時段與級別隨心訂製',
        es: 'Golf premium en grupo reducido: campo, horario y nivel a su medida',
        fr: 'Golf premium en petit groupe : parcours, horaires et niveau sur mesure',
        de: 'Premium-Golf in Kleingruppe: Platz, Zeit und Niveau nach Wunsch',
      },
      slogan3: {
        ja: 'モーニングからトワイライトまで——予算とレベルに合わせた18ホール体験',
        'zh-CN': '从晨间到黄昏——按预算与水平量身定制的18洞体验',
        'zh-TW': '從晨間到黃昏——按預算與水平量身訂製的18洞體驗',
        es: 'De la mañana al twilight: experiencia de 18 hoyos según presupuesto y nivel',
        fr: 'Du matin au twilight : expérience 18 trous selon budget et niveau',
        de: 'Von morgens bis Twilight: 18-Loch-Erlebnis nach Budget und Können',
      },
    },
  },

  MSPICKUP: {
    name: {
      ja: '空港送迎サービス',
      'zh-CN': '机场接送服务',
      'zh-TW': '機場接送服務',
      es: 'Servicio de traslados al aeropuerto',
      fr: 'Service de transfert aéroport',
      de: 'Flughafentransfer-Service',
    },
    customer_name: {
      ja: '空港ピックアップ・ドロップサービス',
      'zh-CN': '机场接送服务',
      'zh-TW': '機場接送服務',
      es: 'Servicio de recogida y bajada en el aeropuerto',
      fr: 'Service de prise en charge et dépose à l’aéroport',
      de: 'Flughafen-Abhol- und Bring-Service',
    },
  },

  MSPICKUPLIMO: {
    name: {
      ja: '空港送迎（リムジン）',
      'zh-CN': '机场接送（礼宾车）',
      'zh-TW': '機場接送（禮賓車）',
      es: 'Recogida en aeropuerto (limusina)',
      fr: 'Prise en charge aéroport (limousine)',
      de: 'Flughafenabholung (Limousine)',
    },
    customer_name: {
      ja: '空港ピックアップ・ドロップ リムジンサービス',
      'zh-CN': '机场接送礼宾车服务',
      'zh-TW': '機場接送禮賓車服務',
      es: 'Servicio de limusina para recogida y bajada en el aeropuerto',
      fr: 'Service limousine de prise en charge et dépose à l’aéroport',
      de: 'Limousinen-Service für Flughafenabholung und -rückfahrt',
    },
    summary: {
      ja: '快適で安全な移動のために、多彩な車両オプションをご用意しています。コンパクトセダンから大型リムジンSUV・バンまで、ご目的と人数に合わせてお選びいただけます。',
      'zh-CN': '我们提供多种车型选择，确保您舒适安全出行。从小轿车到大型礼宾SUV/面包车，可按用途与人数自由选择。',
      'zh-TW': '我們提供多種車型選擇，確保您舒適安全出行。從小轎車到大型禮賓SUV/廂型車，可依用途與人數自由選擇。',
      es: 'Ofrecemos varias opciones de vehículo para un traslado cómodo y seguro. Desde sedanes compactos hasta limusinas SUV y vans grandes, elija según su propósito y número de pasajeros.',
      fr: 'Nous proposons plusieurs options de véhicules pour un transfert confortable et sûr. Du berline compacte au SUV limousine et au grand van, choisissez selon votre besoin et le nombre de passagers.',
      de: 'Wir bieten verschiedene Fahrzeugoptionen für komfortablen und sicheren Transfer. Vom Kompaktsedan bis zur großen Limousinen-SUV und zum Van – passend zu Zweck und Personenanzahl.',
    },
    slogans: {
      slogan1: {
        ja: '相乗りなし、待ち時間なし——専用車両でVIPのように移動',
        'zh-CN': '不拼车、不等待——专车出行，尊享VIP体验',
        'zh-TW': '不共乘、不等待——專車出行，尊享VIP體驗',
        es: 'Sin compartir, sin esperas: muévase como VIP con vehículo privado',
        fr: 'Sans partage, sans attente : déplacez-vous comme un VIP en véhicule privé',
        de: 'Kein Sharing, kein Warten – VIP-Transfer mit Privatfahrzeug',
      },
      slogan2: {
        ja: '出張も旅行も——空港到着と同時に出発できる専用ピックアップ',
        'zh-CN': '商务或旅行皆宜——抵达机场即可出发的专车接机',
        'zh-TW': '商務或旅行皆宜——抵達機場即可出發的專車接機',
        es: 'Negocios o viaje: recogida privada lista al aterrizar',
        fr: 'Affaires ou voyage : prise en charge privée dès l’atterrissage',
        de: 'Geschäft oder Urlaub: Privatabholung direkt nach der Landung',
      },
      slogan3: {
        ja: 'ラスベガス空港送迎は、専用車両で上品にスタート',
        'zh-CN': '拉斯维加斯机场接送，从专车开始尽显品质',
        'zh-TW': '拉斯維加斯機場接送，從專車開始盡顯品質',
        es: 'Empiece con estilo en el aeropuerto de Las Vegas con vehículo dedicado',
        fr: 'Commencez avec élégance à l’aéroport de Las Vegas en véhicule dédié',
        de: 'Starten Sie stilvoll am Flughafen Las Vegas mit Privatfahrzeug',
      },
    },
  },

  'MW1-EN': {
    name: {
      ja: 'ミューアウッズ国定公園＆ソーサリート 1日ツアー',
      'zh-CN': '缪尔森林国家纪念地 & 索萨利托一日游',
      'zh-TW': '繆爾森林國家紀念地 & 索薩利托一日遊',
      es: 'Excursión de un día: Muir Woods y Sausalito',
      fr: 'Excursion d’une journée : Muir Woods et Sausalito',
      de: '1-Tages-Tour: Muir Woods & Sausalito',
    },
    customer_name: {
      ja: 'ミューアウッズ＆ソーサリート プレミアム1日ツアー',
      'zh-CN': '缪尔森林 & 索萨利托精品一日游',
      'zh-TW': '繆爾森林 & 索薩利托精品一日遊',
      es: 'Tour premium de un día: Muir Woods y Sausalito',
      fr: 'Excursion premium d’une journée : Muir Woods et Sausalito',
      de: 'Premium-1-Tages-Tour: Muir Woods & Sausalito',
    },
    summary: {
      ja: '何百年ものレッドウッドの森と美しい海岸の街ソーサリートを1日で巡る、サンフランシスコ屈指のネイチャー＆ヒーリングツアーです。',
      'zh-CN': '一天打卡百年红杉林与美丽海岸小镇索萨利托——旧金山代表性自然疗愈之旅。',
      'zh-TW': '一天打卡百年紅杉林與美麗海岸小鎮索薩利托——舊金山代表性自然療癒之旅。',
      es: 'Tour de naturaleza y relax por San Francisco: bosques de secuoyas centenarias y el encantador pueblo costero de Sausalito en un día.',
      fr: 'Tour nature et détente à San Francisco : forêt de séquoias centenaires et charmant village côtier de Sausalito en une journée.',
      de: 'Natur- und Erholungstour in San Francisco: jahrhundertealte Redwoods und das reizende Küstenstädtchen Sausalito an einem Tag.',
    },
  },

  ZN1: {
    name: {
      ja: 'ザイオン国立公園ハイキング 1日ツアー',
      'zh-CN': '锡安国家公园徒步一日游',
      'zh-TW': '錫安國家公園健行一日遊',
      es: 'Tour de senderismo de un día en el Parque Nacional Zion',
      fr: 'Excursion randonnée d’une journée au parc national de Zion',
      de: '1-Tages-Wandertour im Zion-Nationalpark',
    },
    customer_name: {
      ja: 'ザイオン国立公園ハイキング 1日ツアー',
      'zh-CN': '锡安国家公园徒步一日游',
      'zh-TW': '錫安國家公園健行一日遊',
      es: 'Tour de senderismo de un día en el Parque Nacional Zion',
      fr: 'Excursion randonnée d’une journée au parc national de Zion',
      de: '1-Tages-Wandertour im Zion-Nationalpark',
    },
  },
}

async function loadProducts() {
  let q = sb
    .from('products')
    .select(
      'id, product_code, name, name_en, name_ko, customer_name_en, customer_name_ko, summary_en, summary_ko'
    )
    .eq('status', 'active')
    .eq('is_published', true)
    .order('product_code')
  const { data, error } = await q
  if (error) throw error
  let list = data || []
  if (ONLY) list = list.filter((p) => p.product_code === ONLY || p.id === ONLY)
  return list
}

function hasBasicSource(product, fieldKey, fieldRows) {
  const fromTable = fieldRows.filter(
    (r) => r.field_key === fieldKey && (r.locale === 'en' || r.locale === 'ko') && filled(r.value)
  )
  if (fromTable.length) return true
  if (fieldKey === 'name') {
    return filled(product.name_en) || filled(product.name_ko) || filled(product.name)
  }
  if (fieldKey === 'customer_name') {
    return filled(product.customer_name_en) || filled(product.customer_name_ko)
  }
  if (fieldKey === 'summary') {
    return filled(product.summary_en) || filled(product.summary_ko)
  }
  return false
}

function hasSloganSource(detailEn, detailKo, key) {
  return filled(detailEn?.[key]) || filled(detailKo?.[key])
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  const products = await loadProducts()
  console.log(`Loaded ${products.length} active+published products${DRY ? ' (dry-run)' : ''}`)

  const ids = products.map((p) => p.id)
  const { data: fieldRows, error: fErr } = await sb
    .from('product_field_translations')
    .select('product_id, field_key, locale, value')
    .in('product_id', ids)
    .in('field_key', BASIC)
    .in('locale', ['en', 'ko', ...TARGETS])
  if (fErr) throw fErr

  const { data: detailRows, error: dErr } = await sb
    .from('product_details_multilingual')
    .select('id, product_id, language_code, slogan1, slogan2, slogan3, slogan4, slogan5')
    .in('product_id', ids)
    .in('language_code', ['en', 'ko', ...TARGETS])
    .is('channel_id', null)
  if (dErr) throw dErr

  let productsPolished = 0
  let fieldsUpdated = 0
  const samples = []
  const report = []

  for (const product of products) {
    const code = product.product_code
    const pack = POLISH[code]
    if (!pack) {
      console.warn(`No polish pack for ${code} — skip`)
      continue
    }

    const pFields = (fieldRows || []).filter((r) => r.product_id === product.id)
    const pDetails = (detailRows || []).filter((r) => r.product_id === product.id)
    const detailByLocale = Object.fromEntries(pDetails.map((r) => [r.language_code, r]))

    let touched = 0
    const fieldUpserts = []

    for (const fieldKey of BASIC) {
      if (!pack[fieldKey]) continue
      if (!hasBasicSource(product, fieldKey, pFields)) {
        console.log(`  skip ${code}.${fieldKey} (no EN/KO source)`)
        continue
      }
      for (const locale of TARGETS) {
        const value = pack[fieldKey][locale]
        if (!filled(value)) continue
        fieldUpserts.push({
          product_id: product.id,
          field_key: fieldKey,
          locale,
          value,
        })
      }
    }

    if (fieldUpserts.length) {
      if (!DRY) {
        const { error } = await sb
          .from('product_field_translations')
          .upsert(fieldUpserts, { onConflict: 'product_id,field_key,locale' })
        if (error) throw new Error(`${code} field upsert: ${error.message}`)
      }
      fieldsUpdated += fieldUpserts.length
      touched += fieldUpserts.length
    }

    // slogans
    if (pack.slogans) {
      for (const locale of TARGETS) {
        const row = detailByLocale[locale]
        if (!row?.id) {
          console.warn(`  missing details row for ${code} ${locale}`)
          continue
        }
        const patch = {}
        for (const key of SLOGANS) {
          if (!pack.slogans[key]?.[locale]) continue
          if (!hasSloganSource(detailByLocale.en, detailByLocale.ko, key)) {
            continue
          }
          patch[key] = pack.slogans[key][locale]
        }
        if (!Object.keys(patch).length) continue
        if (!DRY) {
          const { error } = await sb
            .from('product_details_multilingual')
            .update(patch)
            .eq('id', row.id)
          if (error) throw new Error(`${code} detail ${locale}: ${error.message}`)
        }
        const n = Object.keys(patch).length
        fieldsUpdated += n
        touched += n
      }
    }

    if (touched > 0) {
      productsPolished += 1
      report.push({ code, touched })
      if (pack.customer_name) {
        samples.push({
          code,
          ja: pack.customer_name.ja,
          es: pack.customer_name.es,
        })
      }
      console.log(`✓ ${code}: ${touched} fields`)
    } else {
      console.log(`· ${code}: nothing to update`)
    }
  }

  const out = {
    at: new Date().toISOString(),
    dry: DRY,
    productsPolished,
    fieldsUpdated,
    report,
    samples: samples.slice(0, 5),
  }
  fs.writeFileSync(path.join(root, 'tmp-polish-short-result.json'), JSON.stringify(out, null, 2))
  console.log('\n==== RESULT ====')
  console.log(`Products polished: ${productsPolished}`)
  console.log(`Fields updated: ${fieldsUpdated}`)
  console.log('Sample customer_name (ja / es):')
  for (const s of samples.slice(0, 3)) {
    console.log(`  [${s.code}]`)
    console.log(`    ja: ${s.ja}`)
    console.log(`    es: ${s.es}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
