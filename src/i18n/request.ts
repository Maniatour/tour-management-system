import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 서버 사이드용 Supabase 클라이언트
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/** DB에 인코딩 깨짐 등으로 `?` 위주 문자열만 들어온 경우 파일 번역을 유지 */
function shouldKeepFileStringInsteadOfDb(fileValue: unknown, dbValue: unknown): boolean {
  if (typeof fileValue !== 'string' || typeof dbValue !== 'string') return false
  if (!dbValue.includes('?')) return false
  const fileHasLetters = /\p{L}/u.test(fileValue)
  const dbLetters = dbValue.replace(/[^\p{L}]/gu, '')
  const dbLooksCorrupted = dbLetters.length === 0 || /^[?]+$/u.test(dbLetters)
  return fileHasLetters && dbLooksCorrupted
}

function isPlainMessageObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * DB 번역 병합 후에도 locale JSON에만 있는 키를 유지합니다.
 * DB에 오래된 namespace 스냅샷만 있거나 중간 노드가 문자열로 덮여 MISSING_MESSAGE가 나는 경우를 막습니다.
 */
function restoreMissingMessageKeysFromFile(fileBranch: unknown, dbBranch: unknown): unknown {
  if (!isPlainMessageObject(fileBranch)) return dbBranch
  if (!isPlainMessageObject(dbBranch)) return structuredClone(fileBranch)
  const out: Record<string, unknown> = { ...dbBranch }
  for (const key of Object.keys(fileBranch)) {
    const f = fileBranch[key]
    const d = out[key]
    if (!(key in out) || d === undefined || d === null) {
      out[key] = isPlainMessageObject(f) ? structuredClone(f) : f
    } else if (isPlainMessageObject(f) && isPlainMessageObject(d)) {
      out[key] = restoreMissingMessageKeysFromFile(f, d)
    }
  }
  return out
}

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
    
    // 2. DB에서 커스터마이징된 번역 가져오기 (느린 DB는 레이아웃·NextIntl 컨텍스트를 막으므로 짧은 상한 + 옵션으로 스킵)
    try {
      const skipDb =
        process.env.I18N_SKIP_DB_TRANSLATIONS === '1' ||
        process.env.I18N_SKIP_DB_TRANSLATIONS === 'true'
      if (skipDb) {
        return { locale, messages: fileMessages }
      }

      // 개발에서도 2초는 Supabase/네트워크 지연에 쉽게 걸려 콘솔이 오염됨 → 프로덕션과 동일 상한 사용
      const defaultMs = 8000
      const DB_TRANSLATIONS_TIMEOUT_MS =
        Number(process.env.I18N_DB_TRANSLATIONS_TIMEOUT_MS) > 0
          ? Number(process.env.I18N_DB_TRANSLATIONS_TIMEOUT_MS)
          : defaultMs

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
        // 정상 폴백(파일 메시지)이므로 warn 대신 debug — StripeErrorHandler 등 전역 warn 후킹과도 겹치지 않게
        if (process.env.NODE_ENV === 'development') {
          console.debug(
            `[i18n] translation_values query exceeded ${DB_TRANSLATIONS_TIMEOUT_MS}ms, using file messages only`
          )
        }
      } else if (!dbError && dbTranslations && dbTranslations.length > 0) {
        // DB 번역을 messages에 병합 (DB 우선). 깊은 복사로 locale JSON 모듈 객체를 오염시키지 않음
        const dbMessages = structuredClone(fileMessages) as typeof fileMessages

        for (const dbTrans of dbTranslations) {
          const trans = dbTrans.translations as any
          if (trans && trans.namespace && trans.key_path) {
            // namespace 생성이 없으면 생성
            if (!dbMessages[trans.namespace]) {
              dbMessages[trans.namespace] = {} as (typeof dbMessages)[string]
            }

            // key_path가 점(.)으로 구분된 경우 중첩 객체 생성
            const keys = trans.key_path.split('.')
            let current = dbMessages[trans.namespace] as Record<string, unknown>

            // 마지막 키를 제외하고 중첩 객체 생성
            for (let i = 0; i < keys.length - 1; i++) {
              if (!current[keys[i]]) {
                current[keys[i]] = {}
              }
              current = current[keys[i]] as Record<string, unknown>
            }

            const leafKey = keys[keys.length - 1]
            const existing = current[leafKey]
            const incoming = dbTrans.value
            if (typeof incoming === 'string' && incoming.trim() === '' && typeof existing === 'string' && existing.length > 0) {
              continue
            }
            if (shouldKeepFileStringInsteadOfDb(existing, incoming)) {
              continue
            }
            current[leafKey] = incoming
          }
        }

        const fileRoot = fileMessages as Record<string, unknown>
        const mergedRoot = dbMessages as Record<string, unknown>
        for (const ns of Object.keys(fileRoot)) {
          mergedRoot[ns] = restoreMissingMessageKeysFromFile(fileRoot[ns], mergedRoot[ns])
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
