'use client'

// 번역 서비스 인터페이스
export interface TranslationResult {
  success: boolean
  translatedText?: string
  error?: string
}

// 번역 서비스 클래스
export class TranslationService {
  private static instance: TranslationService
  private apiKey: string | null = null

  private constructor() {
    // 환경변수에서 API 키 가져오기
    this.apiKey = process.env.NEXT_PUBLIC_GOOGLE_TRANSLATE_API_KEY || null
  }

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService()
    }
    return TranslationService.instance
  }

  // Google Translate API를 사용한 번역
  async translateWithGoogle(text: string, targetLanguage: string = 'en'): Promise<TranslationResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Google Translate API 키가 설정되지 않았습니다.'
      }
    }

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: '번역할 텍스트가 없습니다.'
      }
    }

    try {
      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: targetLanguage,
          source: 'ko', // 한국어에서 번역
          format: 'text'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: `번역 API 오류: ${errorData.error?.message || response.statusText}`
        }
      }

      const data = await response.json()
      const translatedText = data.data?.translations?.[0]?.translatedText

      if (!translatedText) {
        return {
          success: false,
          error: '번역 결과를 받을 수 없습니다.'
        }
      }

      return {
        success: true,
        translatedText: translatedText
      }
    } catch (error) {
      console.error('번역 오류:', error)
      return {
        success: false,
        error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      }
    }
  }

  // 무료 번역 서비스 (LibreTranslate) 사용
  async translateWithLibreTranslate(text: string, targetLanguage: string = 'en'): Promise<TranslationResult> {
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: '번역할 텍스트가 없습니다.'
      }
    }

    try {
      // LibreTranslate 공개 서버 사용 (제한적이지만 무료)
      const response = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          source: 'ko',
          target: targetLanguage,
          format: 'text'
        })
      })

      if (!response.ok) {
        return {
          success: false,
          error: `번역 서비스 오류: ${response.statusText}`
        }
      }

      const data = await response.json()
      const translatedText = data.translatedText

      if (!translatedText) {
        return {
          success: false,
          error: '번역 결과를 받을 수 없습니다.'
        }
      }

      return {
        success: true,
        translatedText: translatedText
      }
    } catch (error) {
      console.error('번역 오류:', error)
      return {
        success: false,
        error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      }
    }
  }

  // 기본 번역 메서드 (Google Translate 우선, 실패 시 LibreTranslate 사용)
  async translate(text: string, targetLanguage: string = 'en'): Promise<TranslationResult> {
    // 먼저 Google Translate 시도
    if (this.apiKey) {
      const googleResult = await this.translateWithGoogle(text, targetLanguage)
      if (googleResult.success) {
        return googleResult
      }
      console.warn('Google Translate 실패, LibreTranslate로 대체:', googleResult.error)
    }

    // Google Translate 실패 시 LibreTranslate 사용
    return await this.translateWithLibreTranslate(text, targetLanguage)
  }

  // 여러 텍스트를 한 번에 번역
  async translateMultiple(texts: string[], targetLanguage: string = 'en'): Promise<TranslationResult[]> {
    const results: TranslationResult[] = []
    
    for (const text of texts) {
      const result = await this.translate(text, targetLanguage)
      results.push(result)
      
      // API 제한을 고려하여 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return results
  }
}

// 편의 함수들
export const translateText = async (text: string, targetLanguage: string = 'en'): Promise<TranslationResult> => {
  const service = TranslationService.getInstance()
  return await service.translate(text, targetLanguage)
}

export const translateMultipleTexts = async (texts: string[], targetLanguage: string = 'en'): Promise<TranslationResult[]> => {
  const service = TranslationService.getInstance()
  return await service.translateMultiple(texts, targetLanguage)
}

// 투어 스케줄 관련 번역 유틸리티
export interface ScheduleTranslationFields {
  title_ko?: string
  description_ko?: string
  location_ko?: string
  transport_details_ko?: string
  notes_ko?: string
  guide_notes_ko?: string
}

export interface ScheduleTranslationResult {
  success: boolean
  translatedFields?: {
    title_en?: string
    description_en?: string
    location_en?: string
    transport_details_en?: string
    notes_en?: string
    guide_notes_en?: string
  }
  error?: string
}

// 상품 세부정보 관련 번역 유틸리티
export interface ProductDetailsTranslationFields {
  slogan1?: string
  slogan2?: string
  slogan3?: string
  description?: string
  included?: string
  not_included?: string
  pickup_drop_info?: string
  luggage_info?: string
  tour_operation_info?: string
  preparation_info?: string
  small_group_info?: string
  notice_info?: string
  private_tour_info?: string
  cancellation_policy?: string
  chat_announcement?: string
}

export interface ProductDetailsTranslationResult {
  success: boolean
  translatedFields?: ProductDetailsTranslationFields
  error?: string
}

// FAQ 관련 번역 유틸리티
export interface FaqTranslationFields {
  question?: string
  answer?: string
}

export interface FaqTranslationResult {
  success: boolean
  translatedFields?: FaqTranslationFields
  error?: string
}

// 픽업 호텔 관련 번역 유틸리티
export interface PickupHotelTranslationFields {
  hotel?: string
  pick_up_location?: string
  description_ko?: string
  address?: string
}

export interface PickupHotelTranslationResult {
  success: boolean
  translatedFields?: PickupHotelTranslationFields
  error?: string
}

// 문서 템플릿 관련 번역 유틸리티
export interface DocumentTemplateTranslationFields {
  subject?: string
  content?: string
}

export interface DocumentTemplateTranslationResult {
  success: boolean
  translatedFields?: DocumentTemplateTranslationFields
  error?: string
}

// 스케줄 필드들을 한 번에 번역
export const translateScheduleFields = async (fields: ScheduleTranslationFields): Promise<ScheduleTranslationResult> => {
  try {
    const textsToTranslate: string[] = []
    const fieldKeys: (keyof ScheduleTranslationFields)[] = []
    
    // 번역할 텍스트가 있는 필드들만 수집
    Object.entries(fields).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        textsToTranslate.push(value.trim())
        fieldKeys.push(key as keyof ScheduleTranslationFields)
      }
    })

    if (textsToTranslate.length === 0) {
      return {
        success: false,
        error: '번역할 내용이 없습니다.'
      }
    }

    // 모든 텍스트를 한 번에 번역
    const results = await translateMultipleTexts(textsToTranslate, 'en')
    
    // 번역 결과를 필드별로 매핑
    const translatedFields: any = {}
    fieldKeys.forEach((key, index) => {
      const result = results[index]
      if (result.success && result.translatedText) {
        // 필드명을 한국어에서 영어로 변경
        const englishKey = key.replace('_ko', '_en') as keyof typeof translatedFields
        translatedFields[englishKey] = result.translatedText
      }
    })

    return {
      success: true,
      translatedFields
    }
  } catch (error) {
    console.error('스케줄 필드 번역 오류:', error)
    return {
      success: false,
      error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}

// 상품 세부정보 필드들을 한 번에 번역
export const translateProductDetailsFields = async (fields: ProductDetailsTranslationFields): Promise<ProductDetailsTranslationResult> => {
  try {
    const textsToTranslate: string[] = []
    const fieldKeys: (keyof ProductDetailsTranslationFields)[] = []
    
    // 번역할 텍스트가 있는 필드들만 수집
    Object.entries(fields).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        textsToTranslate.push(value.trim())
        fieldKeys.push(key as keyof ProductDetailsTranslationFields)
      }
    })

    if (textsToTranslate.length === 0) {
      return {
        success: false,
        error: '번역할 내용이 없습니다.'
      }
    }

    // 모든 텍스트를 한 번에 번역
    const results = await translateMultipleTexts(textsToTranslate, 'en')
    
    // 번역 결과를 필드별로 매핑
    const translatedFields: ProductDetailsTranslationFields = {}
    fieldKeys.forEach((key, index) => {
      const result = results[index]
      if (result.success && result.translatedText) {
        translatedFields[key] = result.translatedText
      }
    })

    return {
      success: true,
      translatedFields
    }
  } catch (error) {
    console.error('상품 세부정보 필드 번역 오류:', error)
    return {
      success: false,
      error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}

// FAQ 필드들을 한 번에 번역
export const translateFaqFields = async (fields: FaqTranslationFields): Promise<FaqTranslationResult> => {
  try {
    const textsToTranslate: string[] = []
    const fieldKeys: (keyof FaqTranslationFields)[] = []
    
    // 번역할 텍스트가 있는 필드들만 수집
    Object.entries(fields).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        textsToTranslate.push(value.trim())
        fieldKeys.push(key as keyof FaqTranslationFields)
      }
    })

    if (textsToTranslate.length === 0) {
      return {
        success: false,
        error: '번역할 내용이 없습니다.'
      }
    }

    // 모든 텍스트를 한 번에 번역
    const results = await translateMultipleTexts(textsToTranslate, 'en')
    
    // 번역 결과를 필드별로 매핑
    const translatedFields: FaqTranslationFields = {}
    fieldKeys.forEach((key, index) => {
      const result = results[index]
      if (result.success && result.translatedText) {
        translatedFields[key] = result.translatedText
      }
    })

    return {
      success: true,
      translatedFields
    }
  } catch (error) {
    console.error('FAQ 필드 번역 오류:', error)
    return {
      success: false,
      error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}

// 픽업 호텔 필드들을 한 번에 번역
export const translatePickupHotelFields = async (fields: PickupHotelTranslationFields): Promise<PickupHotelTranslationResult> => {
  try {
    const textsToTranslate: string[] = []
    const fieldKeys: (keyof PickupHotelTranslationFields)[] = []
    
    // 번역할 텍스트가 있는 필드들만 수집
    Object.entries(fields).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        textsToTranslate.push(value.trim())
        fieldKeys.push(key as keyof PickupHotelTranslationFields)
      }
    })

    if (textsToTranslate.length === 0) {
      return {
        success: false,
        error: '번역할 내용이 없습니다.'
      }
    }

    // 모든 텍스트를 한 번에 번역
    const results = await translateMultipleTexts(textsToTranslate, 'en')
    
    // 번역 결과를 필드별로 매핑
    const translatedFields: PickupHotelTranslationFields = {}
    fieldKeys.forEach((key, index) => {
      const result = results[index]
      if (result.success && result.translatedText) {
        translatedFields[key] = result.translatedText
      }
    })

    return {
      success: true,
      translatedFields
    }
  } catch (error) {
    console.error('픽업 호텔 필드 번역 오류:', error)
    return {
      success: false,
      error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}

// 문서 템플릿 필드들을 한 번에 번역
export const translateDocumentTemplateFields = async (fields: DocumentTemplateTranslationFields): Promise<DocumentTemplateTranslationResult> => {
  try {
    const textsToTranslate: string[] = []
    const fieldKeys: (keyof DocumentTemplateTranslationFields)[] = []
    
    // 번역할 텍스트가 있는 필드들만 수집
    Object.entries(fields).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        textsToTranslate.push(value.trim())
        fieldKeys.push(key as keyof DocumentTemplateTranslationFields)
      }
    })

    if (textsToTranslate.length === 0) {
      return {
        success: false,
        error: '번역할 내용이 없습니다.'
      }
    }

    // 모든 텍스트를 한 번에 번역
    const results = await translateMultipleTexts(textsToTranslate, 'en')
    
    // 번역 결과를 필드별로 매핑
    const translatedFields: DocumentTemplateTranslationFields = {}
    fieldKeys.forEach((key, index) => {
      const result = results[index]
      if (result.success && result.translatedText) {
        translatedFields[key] = result.translatedText
      }
    })

    return {
      success: true,
      translatedFields
    }
  } catch (error) {
    console.error('문서 템플릿 필드 번역 오류:', error)
    return {
      success: false,
      error: `번역 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    }
  }
}
