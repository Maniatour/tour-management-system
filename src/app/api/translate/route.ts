import { NextRequest, NextResponse } from 'next/server'

// Google Translate API 사용
async function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  
  if (!apiKey) {
    throw new Error('Google Translate API key not found')
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: text,
      source: fromLang,
      target: toLang,
      format: 'text'
    })
  })

  if (!response.ok) {
    throw new Error(`Translation API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data.translations[0].translatedText
}

function detectLanguage(text: string): 'ko' | 'en' {
  // 한국어 문자(한글)가 포함되어 있으면 한국어로 판단
  const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/
  return koreanRegex.test(text) ? 'ko' : 'en'
}

export async function POST(request: NextRequest) {
  try {
    console.log('번역 API 호출됨')
    
    const body = await request.json()
    const { text } = body

    console.log('번역 요청 텍스트:', text)

    if (!text || typeof text !== 'string') {
      console.log('번역 텍스트 검증 실패:', text)
      return NextResponse.json({ error: '번역할 텍스트가 필요합니다' }, { status: 400 })
    }

    const detectedLang = detectLanguage(text)
    const targetLang = detectedLang === 'ko' ? 'en' : 'ko'
    
    console.log('감지된 언어:', detectedLang, '-> 목표 언어:', targetLang)
    
    // API 키 확인
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
    if (!apiKey) {
      console.error('Google Translate API 키가 설정되지 않음')
      return NextResponse.json({ 
        error: '번역 서비스가 설정되지 않았습니다' 
      }, { status: 500 })
    }
    
    const translatedText = await translateText(text, detectedLang, targetLang)
    console.log('번역 완료:', translatedText)

    return NextResponse.json({
      originalText: text,
      translatedText,
      fromLang: detectedLang,
      toLang: targetLang
    })
  } catch (error) {
    console.error('번역 오류 상세:', error)
    return NextResponse.json({ 
      error: '번역 중 오류가 발생했습니다', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
