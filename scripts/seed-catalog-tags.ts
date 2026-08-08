/**
 * Seed catalog tags + ko/en translations for Kovegas tour products.
 * Idempotent: skips existing keys, upserts missing translations.
 *
 * Usage: npx tsx scripts/seed-catalog-tags.ts
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

const supabase = createClient(url, key)

type SeedTag = {
  key: string
  ko: string
  en: string
  pronunciation?: string
}

/** Destinations, styles, transport, marketing — aligned with home cards + product filters */
const SEED_TAGS: SeedTag[] = [
  // Destinations (home 인기 목적지)
  { key: 'las_vegas', ko: '라스베이거스', en: 'Las Vegas', pronunciation: '라스베이거스|라스베가스|시티' },
  { key: 'grand_canyon', ko: '그랜드캐년', en: 'Grand Canyon', pronunciation: '그랜드캐년|그랜드 캐니언' },
  { key: 'antelope_canyon', ko: '앤텔롭캐년', en: 'Antelope Canyon', pronunciation: '앤텔롭|앤텔롭캐년' },
  { key: 'zion', ko: '자이언', en: 'Zion', pronunciation: '자이언|자이언캐년' },
  { key: 'bryce_canyon', ko: '브라이스캐년', en: 'Bryce Canyon', pronunciation: '브라이스|브라이스캐년' },
  { key: 'horseshoe_bend', ko: '홀슈밴드', en: 'Horseshoe Bend', pronunciation: '홀슈|홀슈밴드' },
  { key: 'death_valley', ko: '데스밸리', en: 'Death Valley', pronunciation: '데스밸리' },
  { key: 'valley_of_fire', ko: '불의계곡', en: 'Valley of Fire', pronunciation: '불의|불의계곡' },
  { key: 'monument_valley', ko: '모뉴먼트밸리', en: 'Monument Valley', pronunciation: '모뉴먼트|모뉴먼트밸리' },
  { key: 'sedona', ko: '세도나', en: 'Sedona', pronunciation: '세도나' },
  { key: 'page', ko: '페이지', en: 'Page', pronunciation: '페이지' },
  { key: 'lake_powell', ko: '파월호수', en: 'Lake Powell', pronunciation: '파월|파월호수' },
  { key: 'hoover_dam', ko: '후버댐', en: 'Hoover Dam', pronunciation: '후버댐|후버' },
  { key: 'red_rock', ko: '레드락', en: 'Red Rock Canyon', pronunciation: '레드락' },
  { key: 'moab', ko: '모아브', en: 'Moab', pronunciation: '모아브' },
  { key: 'arches', ko: '아치스', en: 'Arches National Park', pronunciation: '아치스' },
  { key: 'yosemite', ko: '요세미티', en: 'Yosemite', pronunciation: '요세미티' },
  { key: 'san_francisco', ko: '샌프란시스코', en: 'San Francisco', pronunciation: '샌프란|샌프란시스코' },
  { key: 'los_angeles', ko: '로스앤젤레스', en: 'Los Angeles', pronunciation: 'LA|엘에이|로스앤젤레스' },
  { key: 'grand_canyon_west', ko: '웨스트림', en: 'Grand Canyon West', pronunciation: '웨스트림|그랜드캐년웨스트' },
  { key: 'grand_canyon_south', ko: '사우스림', en: 'Grand Canyon South Rim', pronunciation: '사우스림' },
  { key: 'lower_antelope', ko: '로워앤텔롭', en: 'Lower Antelope Canyon', pronunciation: '로워앤텔롭|로워' },
  { key: 'upper_antelope', ko: '어퍼앤텔롭', en: 'Upper Antelope Canyon', pronunciation: '어퍼앤텔롭|어퍼' },

  // Travel styles (home 여행 스타일)
  { key: 'day_tour', ko: '당일투어', en: 'Day Tour', pronunciation: '당일|당일투어' },
  { key: 'overnight_tour', ko: '숙박투어', en: 'Overnight Tour', pronunciation: '숙박|숙박투어' },
  { key: 'suburban_tour', ko: '근교투어', en: 'Nearby Tour', pronunciation: '근교|근교투어' },
  { key: 'city_tour', ko: '시티투어', en: 'City Tour', pronunciation: '시티|시티투어' },
  { key: 'helicopter', ko: '헬리콥터', en: 'Helicopter', pronunciation: '헬기|헬리콥터' },
  { key: 'light_aircraft', ko: '경비행기', en: 'Light Aircraft', pronunciation: '경비행기' },
  { key: 'bus_tour', ko: '버스투어', en: 'Bus Tour', pronunciation: '버스|버스투어' },
  { key: 'premium_tour', ko: '프리미엄', en: 'Premium Small Group', pronunciation: '프리미엄|소그룹' },
  { key: 'show_ticket', ko: '쇼티켓', en: 'Show Ticket', pronunciation: '공연|쇼|쇼티켓' },
  { key: 'attraction', ko: '어트랙션', en: 'Attraction', pronunciation: '어트랙션' },
  { key: 'event', ko: '이벤트', en: 'Event', pronunciation: '이벤트' },
  { key: 'coupon', ko: '쿠폰', en: 'Coupon', pronunciation: '쿠폰' },
  { key: 'travel_insurance', ko: '여행자보험', en: 'Travel Insurance', pronunciation: '여행자보험|보험' },
  { key: 'convention', ko: '컨벤션', en: 'Convention Support', pronunciation: '컨벤션' },

  // Transport / experience
  { key: 'van_tour', ko: '밴투어', en: 'Van Tour', pronunciation: '밴|밴투어' },
  { key: 'private_tour', ko: '단독투어', en: 'Private Tour', pronunciation: '단독|단독투어|프라이빗' },
  { key: 'small_group', ko: '소그룹', en: 'Small Group', pronunciation: '소그룹' },
  { key: 'sunrise', ko: '일출', en: 'Sunrise', pronunciation: '일출' },
  { key: 'sunset', ko: '일몰', en: 'Sunset', pronunciation: '일몰' },
  { key: 'night_view', ko: '야경', en: 'Night View', pronunciation: '야경|nightlife' },
  { key: 'photo_tour', ko: '포토투어', en: 'Photo Tour', pronunciation: '포토|사진' },
  { key: 'skywalk', ko: '스카이워크', en: 'Skywalk', pronunciation: '스카이워크' },
  { key: 'rafting', ko: '래프팅', en: 'Rafting', pronunciation: '래프팅' },
  { key: 'hiking', ko: '하이킹', en: 'Hiking', pronunciation: '하이킹|트레킹' },
  { key: 'jeep_tour', ko: '지프투어', en: 'Jeep Tour', pronunciation: '지프|지프투어' },
  { key: 'boat_tour', ko: '보트투어', en: 'Boat Tour', pronunciation: '보트|유람선' },
  { key: 'hotel_pickup', ko: '호텔픽업', en: 'Hotel Pickup', pronunciation: '픽업|호텔픽업' },
  { key: 'multi_day', ko: '연박투어', en: 'Multi-Day', pronunciation: '연박|여러날|multi_day' },
  { key: 'half_day', ko: '반나절', en: 'Half Day', pronunciation: '반나절' },
  { key: 'full_day', ko: '하루종일', en: 'Full Day', pronunciation: '하루종일|종일' },

  // Audience / marketing
  { key: 'popular', ko: '인기', en: 'Popular' },
  { key: 'new', ko: '신규', en: 'New' },
  { key: 'hot', ko: '인기순위', en: 'Trending' },
  { key: 'recommended', ko: '추천', en: 'Recommended' },
  { key: 'sale', ko: '할인', en: 'Sale' },
  { key: 'limited', ko: '한정', en: 'Limited' },
  { key: 'best', ko: '베스트', en: 'Best' },
  { key: 'premium', ko: '프리미엄', en: 'Premium' },
  { key: 'budget', ko: '가성비', en: 'Budget-Friendly' },
  { key: 'family', ko: '가족', en: 'Family' },
  { key: 'couple', ko: '커플', en: 'Couple' },
  { key: 'group', ko: '단체', en: 'Group' },
  { key: 'solo', ko: '솔로', en: 'Solo' },
  { key: 'romantic', ko: '로맨틱', en: 'Romantic' },
  { key: 'adventure', ko: '모험', en: 'Adventure' },
  { key: 'nature', ko: '자연', en: 'Nature' },
  { key: 'culture', ko: '문화', en: 'Culture' },
  { key: 'history', ko: '역사', en: 'History' },
  { key: 'food', ko: '음식', en: 'Food' },
  { key: 'shopping', ko: '쇼핑', en: 'Shopping' },
  { key: 'desert', ko: '사막', en: 'Desert' },
  { key: 'easy', ko: '쉬움', en: 'Easy' },
  { key: 'moderate', ko: '보통', en: 'Moderate' },
  { key: 'hard', ko: '어려움', en: 'Hard' },
  { key: 'morning', ko: '아침', en: 'Morning' },
  { key: 'afternoon', ko: '오후', en: 'Afternoon' },
  { key: 'evening', ko: '저녁', en: 'Evening' },
  { key: 'korean_guide', ko: '한국어가이드', en: 'Korean Guide', pronunciation: '한국어|한글가이드' },
  { key: 'english_guide', ko: '영어가이드', en: 'English Guide', pronunciation: '영어가이드' },
  { key: 'free_cancellation', ko: '무료취소', en: 'Free Cancellation', pronunciation: '무료취소|취소가능' },
  { key: 'instant_confirm', ko: '즉시확정', en: 'Instant Confirmation', pronunciation: '즉시확정' },
]

async function main() {
  const { data: existing, error: listError } = await supabase.from('tags').select('id, key')
  if (listError) throw listError

  const byKey = new Map((existing ?? []).map((row) => [row.key as string, row.id as string]))
  let created = 0
  let translationsUpserted = 0

  for (const tag of SEED_TAGS) {
    let tagId = byKey.get(tag.key)
    if (!tagId) {
      tagId = randomUUID()
      const { error } = await supabase.from('tags').insert({
        id: tagId,
        key: tag.key,
        is_system: true,
      })
      if (error) {
        if (error.code === '23505') {
          const { data: again } = await supabase.from('tags').select('id').eq('key', tag.key).maybeSingle()
          tagId = again?.id as string | undefined
          if (!tagId) throw error
        } else {
          throw error
        }
      } else {
        created += 1
        byKey.set(tag.key, tagId)
      }
    }

    for (const locale of ['ko', 'en'] as const) {
      const label = locale === 'ko' ? tag.ko : tag.en
      const pronunciation = locale === 'ko' ? tag.pronunciation ?? null : null

      const { data: existingTr } = await supabase
        .from('tag_translations')
        .select('id, label, pronunciation')
        .eq('tag_id', tagId)
        .eq('locale', locale)
        .maybeSingle()

      if (!existingTr?.id) {
        const { error } = await supabase.from('tag_translations').insert({
          id: randomUUID(),
          tag_id: tagId,
          locale,
          label,
          pronunciation,
        })
        if (error && error.code !== '23505') throw error
        translationsUpserted += 1
      } else if (!existingTr.label?.trim()) {
        const { error } = await supabase
          .from('tag_translations')
          .update({ label, pronunciation })
          .eq('id', existingTr.id)
        if (error) throw error
        translationsUpserted += 1
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        existingBefore: existing?.length ?? 0,
        seedDefined: SEED_TAGS.length,
        tagsCreated: created,
        translationsAddedOrFilled: translationsUpserted,
        totalKeysNow: byKey.size,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
