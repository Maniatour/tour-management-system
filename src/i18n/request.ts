import { getRequestConfig } from 'next-intl/server'

export default getRequestConfig(async ({ locale }) => {
  // locale이 없거나 지원하지 않는 언어인 경우 기본값 사용
  if (!locale || !['ko', 'en'].includes(locale)) {
    locale = 'ko' // 기본 언어로 설정
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
