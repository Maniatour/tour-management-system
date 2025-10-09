/**
 * 가이드 언어 감지 및 변환 유틸리티
 */

export type SupportedLocale = 'ko' | 'en' | 'ja' | 'zh'

export interface TeamLanguageData {
  languages?: string[] | null
}

/**
 * 언어 코드를 locale로 변환하는 함수
 * @param languageCode 언어 코드 (예: 'ko', 'en', 'KR', 'EN' 등)
 * @returns 지원되는 locale 또는 기본값 'ko'
 */
export function convertLanguageCodeToLocale(languageCode: string): SupportedLocale {
  if (!languageCode || typeof languageCode !== 'string') {
    return 'ko'
  }

  const normalizedCode = languageCode.trim().toUpperCase()
  
  switch (normalizedCode) {
    case 'KR':
    case 'KO':
    case 'KOREAN':
      return 'ko'
    case 'EN':
    case 'ENG':
    case 'ENGLISH':
      return 'en'
    case 'JP':
    case 'JA':
    case 'JAPANESE':
      return 'ja'
    case 'CN':
    case 'ZH':
    case 'CHINESE':
      return 'zh'
    default:
      console.warn(`Unknown language code: ${languageCode}, using default 'ko'`)
      return 'ko'
  }
}

/**
 * 팀 데이터에서 가이드의 선호 언어를 감지하는 함수
 * @param teamData 팀 테이블 데이터
 * @param email 가이드 이메일 (디버깅용)
 * @returns 선호 언어 locale
 */
export function detectGuidePreferredLanguage(
  teamData: TeamLanguageData | null | undefined,
  email?: string
): SupportedLocale {
  try {
    console.log(`[GuideLanguageDetection] Detecting language for guide: ${email || 'unknown'}`)
    
    if (!teamData) {
      console.log('[GuideLanguageDetection] No team data provided, using default language')
      return 'ko'
    }

    const languages = teamData.languages
    console.log(`[GuideLanguageDetection] Team languages:`, languages)

    // languages가 배열이고 비어있지 않은 경우
    if (Array.isArray(languages) && languages.length > 0) {
      const firstLanguage = languages[0]
      console.log(`[GuideLanguageDetection] First language: ${firstLanguage}`)
      
      const preferredLocale = convertLanguageCodeToLocale(firstLanguage)
      console.log(`[GuideLanguageDetection] Converted to locale: ${preferredLocale}`)
      
      return preferredLocale
    }

    // languages가 문자열인 경우 (잘못된 데이터 타입)
    if (typeof languages === 'string' && languages.trim()) {
      console.warn(`[GuideLanguageDetection] Languages field is string instead of array: ${languages}`)
      const preferredLocale = convertLanguageCodeToLocale(languages)
      console.log(`[GuideLanguageDetection] Converted string to locale: ${preferredLocale}`)
      return preferredLocale
    }

    console.log('[GuideLanguageDetection] No valid languages found, using default')
    return 'ko'
  } catch (error) {
    console.error(`[GuideLanguageDetection] Error detecting guide language for ${email || 'unknown'}:`, error)
    return 'ko'
  }
}

/**
 * 가이드가 특정 언어를 지원하는지 확인하는 함수
 * @param teamData 팀 테이블 데이터
 * @param targetLocale 확인할 언어
 * @returns 해당 언어를 지원하는지 여부
 */
export function doesGuideSupportLanguage(
  teamData: TeamLanguageData | null | undefined,
  targetLocale: SupportedLocale
): boolean {
  try {
    if (!teamData || !teamData.languages) {
      return false
    }

    const languages = teamData.languages
    if (!Array.isArray(languages)) {
      return false
    }

    // 각 언어 코드를 locale로 변환하여 비교
    return languages.some(lang => {
      const convertedLocale = convertLanguageCodeToLocale(lang)
      return convertedLocale === targetLocale
    })
  } catch (error) {
    console.error('[GuideLanguageDetection] Error checking language support:', error)
    return false
  }
}

/**
 * 가이드의 지원 언어 목록을 locale 배열로 반환하는 함수
 * @param teamData 팀 테이블 데이터
 * @returns 지원하는 언어 locale 배열
 */
export function getGuideSupportedLocales(
  teamData: TeamLanguageData | null | undefined
): SupportedLocale[] {
  try {
    if (!teamData || !teamData.languages) {
      return ['ko'] // 기본값
    }

    const languages = teamData.languages
    if (!Array.isArray(languages)) {
      return ['ko'] // 기본값
    }

    const locales = languages
      .map(lang => convertLanguageCodeToLocale(lang))
      .filter((locale, index, array) => array.indexOf(locale) === index) // 중복 제거

    return locales.length > 0 ? locales : ['ko']
  } catch (error) {
    console.error('[GuideLanguageDetection] Error getting supported locales:', error)
    return ['ko']
  }
}
