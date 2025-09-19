// 번역 관련 유틸리티 함수들

export interface TranslationResult {
  originalText: string
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
}

// 지원하는 언어 목록
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' }
] as const

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code']

// 언어 감지 함수 (간단한 휴리스틱)
export function detectLanguage(text: string): string {
  // 한글 문자 범위: \uAC00-\uD7AF, \u1100-\u11FF, \u3130-\u318F
  const koreanRegex = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/
  
  // 일본어 문자 범위: \u3040-\u309F (히라가나), \u30A0-\u30FF (가타카나), \u4E00-\u9FAF (한자)
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/
  
  // 중국어 문자 범위: \u4E00-\u9FFF (한자)
  const chineseRegex = /[\u4E00-\u9FFF]/
  
  // 아랍어 문자 범위: \u0600-\u06FF
  const arabicRegex = /[\u0600-\u06FF]/
  
  // 태국어 문자 범위: \u0E00-\u0E7F
  const thaiRegex = /[\u0E00-\u0E7F]/
  
  // 베트남어 문자 범위: \u0100-\u017F (라틴 확장)
  const vietnameseRegex = /[\u0100-\u017F]/
  
  // 키릴 문자 범위: \u0400-\u04FF (러시아어)
  const cyrillicRegex = /[\u0400-\u04FF]/
  
  // 영어 문자 범위: A-Z, a-z
  const englishRegex = /[A-Za-z]/
  
  const hasKorean = koreanRegex.test(text)
  const hasJapanese = japaneseRegex.test(text)
  const hasChinese = chineseRegex.test(text)
  const hasArabic = arabicRegex.test(text)
  const hasThai = thaiRegex.test(text)
  const hasVietnamese = vietnameseRegex.test(text)
  const hasCyrillic = cyrillicRegex.test(text)
  const hasEnglish = englishRegex.test(text)
  
  // 우선순위에 따라 언어 감지
  if (hasKorean && !hasJapanese && !hasChinese) return 'ko'
  if (hasJapanese) return 'ja'
  if (hasChinese) return 'zh'
  if (hasArabic) return 'ar'
  if (hasThai) return 'th'
  if (hasVietnamese) return 'vi'
  if (hasCyrillic) return 'ru'
  if (hasEnglish) return 'en'
  
  return 'en' // 기본값
}

// Google Translate API를 사용한 번역 함수
export async function translateText(
  text: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<TranslationResult> {
  try {
    const detectedSource = sourceLanguage || detectLanguage(text)
    
    if (detectedSource === targetLanguage) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage: detectedSource,
        targetLanguage
      }
    }
    
    // Google Translate API 사용
    return await translateWithGoogleAPI(text, detectedSource, targetLanguage)
  } catch (error) {
    console.error('Translation error:', error)
    return {
      originalText: text,
      translatedText: text, // 에러 시 원본 텍스트 반환
      sourceLanguage: sourceLanguage || detectLanguage(text),
      targetLanguage
    }
  }
}

// 모의 번역 함수 (Google Translate API 키가 없을 때 사용)
async function mockTranslate(text: string, from: string, to: string): Promise<string> {
  // 실제로는 Google Translate API를 호출해야 함
  // 여기서는 간단한 모의 번역을 제공
  
  // 기본 투어 관련 단어들
  const tourWords = {
    '안녕하세요': { en: 'Hello', ja: 'こんにちは', zh: '你好', es: 'Hola', fr: 'Bonjour', de: 'Hallo', it: 'Ciao', pt: 'Olá', ru: 'Привет', ar: 'مرحبا', th: 'สวัสดี', vi: 'Xin chào', id: 'Halo', ms: 'Halo' },
    '감사합니다': { en: 'Thank you', ja: 'ありがとう', zh: '谢谢', es: 'Gracias', fr: 'Merci', de: 'Danke', it: 'Grazie', pt: 'Obrigado', ru: 'Спасибо', ar: 'شكرا', th: 'ขอบคุณ', vi: 'Cảm ơn', id: 'Terima kasih', ms: 'Terima kasih' },
    '네': { en: 'Yes', ja: 'はい', zh: '是', es: 'Sí', fr: 'Oui', de: 'Ja', it: 'Sì', pt: 'Sim', ru: 'Да', ar: 'نعم', th: 'ใช่', vi: 'Có', id: 'Ya', ms: 'Ya' },
    '아니요': { en: 'No', ja: 'いいえ', zh: '不', es: 'No', fr: 'Non', de: 'Nein', it: 'No', pt: 'Não', ru: 'Нет', ar: 'لا', th: 'ไม่', vi: 'Không', id: 'Tidak', ms: 'Tidak' },
    '픽업': { en: 'Pickup', ja: 'ピックアップ', zh: '接机', es: 'Recogida', fr: 'Ramassage', de: 'Abholung', it: 'Ritiro', pt: 'Buscagem', ru: 'Встреча', ar: 'الاستلام', th: 'รับ', vi: 'Đón', id: 'Penjemputan', ms: 'Penjemputan' },
    '시간': { en: 'Time', ja: '時間', zh: '时间', es: 'Hora', fr: 'Heure', de: 'Zeit', it: 'Ora', pt: 'Hora', ru: 'Время', ar: 'الوقت', th: 'เวลา', vi: 'Thời gian', id: 'Waktu', ms: 'Masa' },
    '장소': { en: 'Location', ja: '場所', zh: '地点', es: 'Ubicación', fr: 'Lieu', de: 'Ort', it: 'Posizione', pt: 'Localização', ru: 'Место', ar: 'المكان', th: 'สถานที่', vi: 'Địa điểm', id: 'Lokasi', ms: 'Lokasi' },
    '투어': { en: 'Tour', ja: 'ツアー', zh: '旅游', es: 'Tour', fr: 'Tour', de: 'Tour', it: 'Tour', pt: 'Tour', ru: 'Тур', ar: 'جولة', th: 'ทัวร์', vi: 'Tour', id: 'Tur', ms: 'Pelancongan' },
    '가이드': { en: 'Guide', ja: 'ガイド', zh: '导游', es: 'Guía', fr: 'Guide', de: 'Führer', it: 'Guida', pt: 'Guia', ru: 'Гид', ar: 'دليل', th: 'ไกด์', vi: 'Hướng dẫn viên', id: 'Pemandu', ms: 'Pemandu' },
    '고객': { en: 'Customer', ja: 'お客様', zh: '客户', es: 'Cliente', fr: 'Client', de: 'Kunde', it: 'Cliente', pt: 'Cliente', ru: 'Клиент', ar: 'عميل', th: 'ลูกค้า', vi: 'Khách hàng', id: 'Pelanggan', ms: 'Pelanggan' }
  }
  
  // 번역 수행
  let translated = text
  
  Object.entries(tourWords).forEach(([ko, translations]) => {
    const targetTranslation = translations[to as keyof typeof translations]
    if (targetTranslation) {
      translated = translated.replace(new RegExp(ko, 'g'), targetTranslation)
    }
  })
  
  // 영어에서 다른 언어로 번역하는 경우
  if (from === 'en' && to !== 'en') {
    Object.entries(tourWords).forEach(([, translations]) => {
      const englishWord = translations.en
      const targetTranslation = translations[to as keyof typeof translations]
      if (targetTranslation) {
        translated = translated.replace(new RegExp(englishWord, 'gi'), targetTranslation)
      }
    })
  }
  
  return translated
}

// 실제 Google Translate API 구현 (API 키가 있을 때 사용)
export async function translateWithGoogleAPI(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<TranslationResult> {
  // Google Translate API 키가 필요함
  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY
  
  if (!API_KEY) {
    console.warn('Google Translate API key not found, using mock translation')
    return await mockTranslate(text, sourceLanguage, targetLanguage).then(translatedText => ({
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage
    }))
  }
  
  try {
    console.log('Calling Google Translate API:', { text, sourceLanguage, targetLanguage })
    
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: targetLanguage,
          source: sourceLanguage || detectLanguage(text),
          format: 'text'
        })
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Translate API error:', response.status, errorText)
      throw new Error(`Translation API error: ${response.status} - ${errorText}`)
    }
    
    const data = await response.json()
    console.log('Google Translate API response:', data)
    
    const translation = data.data.translations[0]
    
    return {
      originalText: text,
      translatedText: translation.translatedText,
      sourceLanguage: translation.detectedSourceLanguage || sourceLanguage || detectLanguage(text),
      targetLanguage
    }
  } catch (error) {
    console.error('Google Translate API error:', error)
    // API 실패 시 모의 번역 사용
    console.log('Falling back to mock translation')
    return await mockTranslate(text, sourceLanguage, targetLanguage).then(translatedText => ({
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage
    }))
  }
}
