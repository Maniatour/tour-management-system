import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'

export default getRequestConfig(async ({ locale }) => {
  // 지원하는 언어 목록
  const supportedLocales = ['ko', 'en']
  
  // locale이 없거나 지원하지 않는 언어인 경우 기본값 사용
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
    const messages = (await import(`./locales/${locale}.json`)).default
    return {
      locale,
      messages
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
