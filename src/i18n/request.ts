import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 서버 사이드용 Supabase 클라이언트
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default getRequestConfig(async ({ locale }) => {
  // 지원하는 언어 목록
  const supportedLocales = ['ko', 'en']
  
  // locale facing 없거나 지원하지 않는 언어인 경우 기본값 사용
  if (!locale || !supportedLocales.includes(locale)) {
    // 쿠키에서 언어 설정 확인
    const headersList = await headers()
    const cookieHeader = headersList.get('cookie')
    const cookieLocale = cookieHeader?.match(/NEXT_LOCALE=([^;]+)/)?.[1]
    
    if (cookieLocale && supportedLocales.includes(cookieLocale)) {
      locale = cookieLocale
    } else {
      locale = 'ko' // 기본 언어로 설정
    }
  }
  
  try {
    // 1. 기본 JSON 파일 로드
    const fileMessages = (await import(`./locales/${locale}.json`)).default
    
    // 2. DB에서 커스터마이징된 번역 가져오기 (PGRST002 스키마 캐시 재시도 등으로 수 분 걸릴 수 있어 상한 두고 파일만 사용)
    try {
      const DB_TRANSLATIONS_TIMEOUT_MS = 8000
      const query = supabase
        .from('translation_values')
        .select(`
          locale,
          value,
          translations!inner(namespace, key_path)
        `)
        .eq('locale', locale)

      const { data: dbTranslations, error: dbError } = await Promise.race([
        query,
        new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(
            () => resolve({ data: null, error: { message: 'translation_db_timeout' } }),
            DB_TRANSLATIONS_TIMEOUT_MS
          )
        ),
      ])

      if (dbError?.message === 'translation_db_timeout') {
        console.warn(
          `[i18n] translation_values query exceeded ${DB_TRANSLATIONS_TIMEOUT_MS}ms, using file messages only`
        )
      } else if (!dbError && dbTranslations && dbTranslations.length > 0) {
        // DB 번역을 messages 객체에 병합 (DB 번역이 우선순위 높음)
        const dbMessages = { ...fileMessages }
        
        for (const dbTrans of dbTranslations) {
          const trans = dbTrans.translations as any
          if (trans && trans.namespace && trans.key_path) {
            // namespace 생성이 없으면 생성
            if (!dbMessages[trans.namespace]) {
              dbMessages[trans.namespace] = {}
            }
            
            // key_path가 점(.)으로 구분된 경우 중첩 객체 생성
            const keys = trans.key_path.split('.')
            let current = dbMessages[trans.namespace]
            
            // 마지막 키를 제외하고 중첩 객체 생성
            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) {
                current[keys[i]] = {}
              }
              current = current[keys[i]]
            }
            
            // 마지막 키에 값 설정
            current[keys[keys.length - 1]] = dbTrans.value
          }
        }
        
        return {
          locale,
          messages: dbMessages
        }
      }
    } catch (dbError) {
      console.error('Failed to load DB translations:', dbError)
      // DB 로드 실패 시 기본 파일 사용
    }
    
    return {
      locale,
      messages: fileMessages
    }
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error)
    // 에러 발생 시 기본 언어(한국어) 사용
    const fallbackMessages = (await import(`./locales/ko.json`)).default
    return {
      locale: 'ko',
      messages: fallbackMessages
    }
  }
})
