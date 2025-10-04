/**
 * 한글을 알파벳으로 음성학적 변환하는 유틸리티 함수들
 * 한국인 고객 이름을 미국인 가이드가 읽기 쉽도록 도움
 */

/**
 * 한글 음성학적 변환 (McCune-Reischauer 방식 기반)
 */
export function transliterateKorean(text: string): string {
  if (!text || typeof text !== 'string') return ''
  
  // 한글이 아닌 문자는 그대로 반환
  if (!/[가-힣]/.test(text)) return text
  
  let result = ''
  
  for (const char of text) {
    if (char.match(/[가-힣]/)) {
      result += transliterateKoreanChar(char)
    } else {
      result += char
    }
  }
  
  return result
}

/**
 * 단일 한글 문자를 음성학적으로 변환
 */
function transliterateKoreanChar(char: string): string {
  const code = char.charCodeAt(0) - 0xAC00
  if (code < 0 || code >= 11172) return char

  const initial = Math.floor(code / 588) // 초성
  const medial = Math.floor((code % 588) / 28) // 중성
  const final = code % 28 // 종성

  const consonants = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('')
  const vowels = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'.split('')
  const finalConsonants = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

  const initialChar = consonants[initial]
  const medialChar = vowels[medial]
  const finalChar = finalConsonants[final]

  // 기본 변환
  let transliterated = ''
  
  // 초성 변환
  switch (initialChar) {
    case 'ㄱ': transliterated += 'k'; break
    case 'ㄲ': transliterated += 'kk'; break
    case 'ㄴ': transliterated += 'n'; break
    case 'ㄷ': transliterated += 't'; break
    case 'ㄸ': transliterated += 'tt'; break
    case 'ㄹ': transliterated += 'r'; break
    case 'ㅁ': transliterated += 'm'; break
    case 'ㅂ': transliterated += 'p'; break
    case 'ㅃ': transliterated += 'pp'; break
    case 'ㅅ': transliterated += 's'; break
    case 'ㅆ': transliterated += 'ss'; break
    case 'ㅇ': transliterated += ''; break // 초성 'ㅇ'은 발음하지 않음
    case 'ㅈ': transliterated += 'ch'; break
    case 'ㅉ': transliterated += 'tch'; break
    case 'ㅊ': transliterated += 'ch'; break
    case 'ㅋ': transliterated += 'k'; break
    case 'ㅌ': transliterated += 't'; break
    case 'ㅍ': transliterated += 'p'; break
    case 'ㅎ': transliterated += 'h'; break
  }

  // 중성 변환
  switch (medialChar) {
    case 'ㅏ': transliterated += 'a'; break
    case 'ㅐ': transliterated += 'ae'; break
    case 'ㅑ': transliterated += 'ya'; break
    case 'ㅒ': transliterated += 'yae'; break
    case 'ㅓ': transliterated += 'o'; break
    case 'ㅔ': transliterated += 'e'; break
    case 'ㅕ': transliterated += 'yo'; break
    case 'ㅖ': transliterated += 'ye'; break
    case 'ㅗ': transliterated += 'o'; break
    case 'ㅘ': transliterated += 'wa'; break
    case 'ㅙ': transliterated += 'wae'; break
    case 'ㅚ': transliterated += 'oe'; break
    case 'ㅛ': transliterated += 'yo'; break
    case 'ㅜ': transliterated += 'u'; break
    case 'ㅝ': transliterated += 'wo'; break
    case 'ㅞ': transliterated += 'we'; break
    case 'ㅟ': transliterated += 'wi'; break
    case 'ㅠ': transliterated += 'yu'; break
    case 'ㅡ': transliterated += 'u'; break
    case 'ㅢ': transliterated += 'ui'; break
    case 'ㅣ': transliterated += 'i'; break
  }

  // 종성 변환
  if (finalChar && finalChar !== '') {
    switch (finalChar) {
      case 'ㄱ': transliterated += 'k'; break
      case 'ㄲ': transliterated += 'kk'; break
      case 'ㄳ': transliterated += 'ks'; break
      case 'ㄴ': transliterated += 'n'; break
      case 'ㄵ': transliterated += 'nch'; break
      case 'ㄶ': transliterated += 'nh'; break
      case 'ㄷ': transliterated += 't'; break
      case 'ㄹ': transliterated += 'l'; break
      case 'ㄺ': transliterated += 'lk'; break
      case 'ㄻ': transliterated += 'lm'; break
      case 'ㄼ': transliterated += 'lp'; break
      case 'ㄽ': transliterated += 'ls'; break
      case 'ㄾ': transliterated += 'lt'; break
      case 'ㄿ': transliterated += 'lp'; break
      case 'ㅀ': transliterated += 'lh'; break
      case 'ㅁ': transliterated += 'm'; break
      case 'ㅂ': transliterated += 'p'; break
      case 'ㅄ': transliterated += 'ps'; break
      case 'ㅅ': transliterated += 't'; break
      case 'ㅆ': transliterated += 't'; break
      case 'ㅇ': transliterated += 'ng'; break
      case 'ㅈ': transliterated += 't'; break
      case 'ㅊ': transliterated += 't'; break
      case 'ㅋ': transliterated += 'k'; break
      case 'ㅌ': transliterated += 't'; break
      case 'ㅍ': transliterated += 'p'; break
      case 'ㅎ': transliterated += 't'; break
    }
  }

  return transliterated
}

/**
 * 고객 이름을 다국어로 표시하는 헬퍼 함수
 */
interface CustomerWithNames {
  name?: string
  name_ko?: string
  name_en?: string
}

export function formatCustomerName(customer: CustomerWithNames | null | undefined, locale: string): string {
  if (!customer) return locale === 'ko' ? '정보 없음' : '정보 없음'
  
  // 현재 고객 테이블에는 name 필드만 있을 수 있으므로 안전하게 처리
  const customerData = customer as CustomerWithNames & { name?: string }
  const customerName = customerData.name_ko || customerData.name || ''
  const englishName = customerData.name_en || ''
  
  if (locale === 'ko') {
    // 한국어 페이지: 한국어 이름만 표시
    return customerName || '정보 없음'
  } else {
    // 영어 페이지: 음성학적 변환된 이름 표시
    if (englishName && englishName !== customerName) {
      return englishName
    }
    
    if (customerName) {
      const transliterated = transliterateKorean(customerName)
      return transliterated ? `${transliterated} (${customerName})` : customerName
    }
    
    return locale === 'ko' ? '정보 없음' : '정보 없음'
  }
}

/**
 * 일반적인 한국인 이름들에 대한 특별 변환 규칙
 */
export function getEnhancedKoreanTransliteration(name: string): string {
  const specialCases: Record<string, string> = {
    '민수': 'Minsu',
    '지혜': 'Jiye',
    '현우': 'Hyunwoo', 
    '승현': 'Seunghyeon',
    '하늘': 'Haneul',
    '다은': 'Daeun',
    '서준': 'Seojun',
    '윤서': 'Yunseo',
    '수호': 'Suho',
    '지민': 'Jimin',
    '나연': 'Nayeon',
    '재현': 'Jaehyun',
    '태양': 'Taeyang',
    '진영': 'Jinyeong',
    '민호': 'Minho'
  }
  
  // 특별한 경우가 있으면 사용
  if (specialCases[name]) {
    return specialCases[name]
  }
  
  // 일반 변환 사용
  return transliterateKorean(name)
}
