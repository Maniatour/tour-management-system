/**
 * Craft native short summaries for products lacking summary_ko/en,
 * then fill all SITE locales including KO/EN + targets.
 * node scripts/craft-missing-summaries.mjs
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })

const LOCALES = ['en', 'ko', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/** Hand-crafted native summaries keyed by product_code */
const SUMMARIES = {
  MSGOLFT: {
    en: 'Play 18 holes near Las Vegas with green fees and cart included. Small-group premium golf tour.',
    ko: '라스베가스 근교 18홀 라운딩. 그린피와 카트 포함, 소규모 프리미엄 골프 투어.',
    ja: 'ラスベガス近郊で18ホール。グリーンフィーとカート込みの少人数プレミアム・ゴルフツアー。',
    'zh-CN': '拉斯维加斯近郊打满 18 洞。含果岭费与球车，精品小团高尔夫一日游。',
    'zh-TW': '拉斯維加斯近郊打滿 18 洞。含果嶺費與球車，精品小團高爾夫一日遊。',
    es: 'Juegue 18 hoyos cerca de Las Vegas con green fee y carro incluidos. Tour de golf premium en grupo reducido.',
    fr: 'Jouez 18 trous près de Las Vegas avec green fee et voiturette inclus. Circuit golf premium en petit groupe.',
    de: '18 Loch bei Las Vegas – Greenfee und Cart inklusive. Premium-Golftour in kleiner Gruppe.',
  },
  MSPICKUP: {
    en: 'Reliable Las Vegas airport pickup and drop-off. Clear pricing and on-time service.',
    ko: '라스베가스 공항 픽업·드롭 서비스. 요금이 명확하고 정시 운행합니다.',
    ja: 'ラスベガス空港の送迎サービス。料金が分かりやすく、時間通りに運行します。',
    'zh-CN': '拉斯维加斯机场接送服务。价格清晰，准时到达。',
    'zh-TW': '拉斯維加斯機場接送服務。價格清楚，準時抵達。',
    es: 'Traslado fiable al aeropuerto de Las Vegas. Precio claro y puntualidad.',
    fr: 'Transfert fiable aéroport de Las Vegas. Tarif clair et ponctualité.',
    de: 'Zuverlässiger Flughafentransfer in Las Vegas. Klare Preise und pünktlicher Service.',
  },
  AG2: {
    en: '2-day Las Vegas tour: Grand Canyon South & East Rim, Horseshoe Bend, and Antelope Canyon. Overnight included.',
    ko: '라스베가스 출발 1박 2일. 그랜드캐년 사우스·이스트림, 홀슈밴드, 앤텔롭캐년을 한 번에.',
    ja: 'ラスベガス発1泊2日。グランドキャニオン（サウス／イーストリム）、ホースシューベンド、アンテロープキャニオンを巡ります。',
    'zh-CN': '拉斯维加斯出发 1 晚 2 天：大峡谷南缘与东缘、马蹄湾与羚羊峡谷。',
    'zh-TW': '拉斯維加斯出發 1 晚 2 天：大峽谷南緣與東緣、馬蹄灣與羚羊峽谷。',
    es: 'Tour de 2 días desde Las Vegas: Gran Cañón (South y East Rim), Horseshoe Bend y Antelope Canyon. Incluye noche.',
    fr: 'Circuit 2 jours au départ de Las Vegas : Grand Canyon (South & East Rim), Horseshoe Bend et Antelope Canyon. Nuit incluse.',
    de: '2-Tage-Tour ab Las Vegas: Grand Canyon (South & East Rim), Horseshoe Bend und Antelope Canyon. Übernachtung inklusive.',
  },
  MDGC1D: {
    en: 'One-day Grand Circle highlights from Las Vegas: Antelope Canyon, Horseshoe Bend, and the Grand Canyon. Small-group premium.',
    ko: '라스베가스 출발 당일 그랜드서클. 앤텔롭캐년·홀슈밴드·그랜드캐년, 소규모 프리미엄.',
    ja: 'ラスベガス発グランドサークル日帰り。アンテロープキャニオン、ホースシューベンド、グランドキャニオンを少人数で巡るプレミアムツアー。',
    'zh-CN': '拉斯维加斯出发大环线一日游：羚羊峡谷、马蹄湾与大峡谷。精品小团。',
    'zh-TW': '拉斯維加斯出發大環線一日遊：羚羊峽谷、馬蹄灣與大峽谷。精品小團。',
    es: 'Grand Circle en un día desde Las Vegas: Antelope Canyon, Horseshoe Bend y el Gran Cañón. Grupo reducido premium.',
    fr: 'Grand Circle en une journée depuis Las Vegas : Antelope Canyon, Horseshoe Bend et Grand Canyon. Petit groupe premium.',
    de: 'Grand Circle an einem Tag ab Las Vegas: Antelope Canyon, Horseshoe Bend und Grand Canyon. Premium in kleiner Gruppe.',
  },
  MDDEATH: {
    en: 'Day trip from Las Vegas to Death Valley and the Rhyolite ghost town. Small-group premium experience.',
    ko: '라스베가스 출발 데스밸리·라이올라이트 유령도시 당일 투어. 소규모 프리미엄.',
    ja: 'ラスベガス発。デスバレーとライオライト・ゴーストタウンを巡る1日ツアー。少人数プレミアム。',
    'zh-CN': '拉斯维加斯出发：死亡谷与莱奥莱特鬼城一日游。精品小团。',
    'zh-TW': '拉斯維加斯出發：死亡谷與萊奧萊特鬼城一日遊。精品小團。',
    es: 'Excursión de un día desde Las Vegas al Valle de la Muerte y el pueblo fantasma de Rhyolite. Grupo reducido premium.',
    fr: 'Excursion d’une journée depuis Las Vegas vers la Vallée de la Mort et la ville fantôme de Rhyolite. Petit groupe premium.',
    de: 'Tagesausflug ab Las Vegas nach Death Valley und zur Geisterstadt Rhyolite. Premium in kleiner Gruppe.',
  },
  MDLVN: {
    en: 'Las Vegas night tour: Welcome Sign, Bellagio Fountains, Sphere, and Downtown lights.',
    ko: '라스베가스 야경 투어. 웰컴사인·벨라지오 분수쇼·스피어·다운타운을 둘러봅니다.',
    ja: 'ラスベガス夜景ツアー。ウェルカムサイン、ベラージオ噴水ショー、Sphere、ダウンタウンを巡ります。',
    'zh-CN': '拉斯维加斯夜游：欢迎牌、贝拉吉奥喷泉、Sphere 与市中心夜景。',
    'zh-TW': '拉斯維加斯夜遊：歡迎牌、貝拉吉歐噴泉、Sphere 與市中心夜景。',
    es: 'Tour nocturno en Las Vegas: Welcome Sign, fuentes del Bellagio, Sphere y el centro.',
    fr: 'Tour nocturne à Las Vegas : Welcome Sign, fontaines du Bellagio, Sphere et Downtown.',
    de: 'Las-Vegas-Nachttour: Welcome Sign, Bellagio-Brunnen, Sphere und Downtown.',
  },
  MDGWEST: {
    en: 'Grand Canyon West day tour from Las Vegas — dramatic canyon views on the West Rim.',
    ko: '라스베가스 출발 그랜드캐년 웨스트림 당일 투어. 서부 가장자리의 장관을 만납니다.',
    ja: 'ラスベガス発グランドキャニオン・ウェスト日帰り。ウェストリムの雄大な景色を満喫。',
    'zh-CN': '拉斯维加斯出发大峡谷西缘一日游，尽览西缘壮丽景色。',
    'zh-TW': '拉斯維加斯出發大峽谷西緣一日遊，盡覽西緣壯麗景色。',
    es: 'Tour de un día al Gran Cañón West desde Las Vegas: vistas espectaculares del West Rim.',
    fr: 'Journée Grand Canyon West au départ de Las Vegas — vues spectaculaires du West Rim.',
    de: 'Tagesausflug Grand Canyon West ab Las Vegas – eindrucksvolle Ausblicke am West Rim.',
  },
  ZN1: {
    en: 'Full-day Zion National Park hiking tour from Las Vegas. Trails, red cliffs, and scenic stops.',
    ko: '라스베가스 출발 자이언 국립공원 하이킹 1일 투어. 붉은 절벽과 명소 트레일을 걷습니다.',
    ja: 'ラスベガス発ザイオン国立公園ハイキング1日ツアー。赤い断崖と絶景トレイルを歩きます。',
    'zh-CN': '拉斯维加斯出发锡安国家公园徒步一日游。红岩峭壁与经典步道。',
    'zh-TW': '拉斯維加斯出發錫安國家公園健行一日遊。紅岩峭壁與經典步道。',
    es: 'Tour de senderismo de un día al Parque Nacional Zion desde Las Vegas. Acantilados rojos y miradores.',
    fr: 'Randonnée d’une journée au parc national de Zion depuis Las Vegas. Falaises rouges et belvédères.',
    de: 'Ganztägige Wandertour im Zion-Nationalpark ab Las Vegas. Rote Felsen und Aussichtspunkte.',
  },
}

let updated = 0
for (const [code, map] of Object.entries(SUMMARIES)) {
  const { data: product, error } = await sb
    .from('products')
    .select('id, summary_ko, summary_en')
    .eq('product_code', code)
    .maybeSingle()
  if (error) throw error
  if (!product) {
    console.log('missing product', code)
    continue
  }

  // Keep legacy columns in sync for KO/EN
  const { error: pErr } = await sb
    .from('products')
    .update({
      summary_en: map.en,
      summary_ko: map.ko,
    })
    .eq('id', product.id)
  if (pErr) throw pErr

  for (const locale of LOCALES) {
    const value = map[locale]
    if (!value) continue
    const { error: upErr } = await sb.from('product_field_translations').upsert(
      {
        product_id: product.id,
        field_key: 'summary',
        locale,
        value,
      },
      { onConflict: 'product_id,field_key,locale' }
    )
    if (upErr) throw upErr
    updated++
  }
  console.log('crafted', code)
}

console.log('done updated=', updated)
