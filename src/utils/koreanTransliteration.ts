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
  language?: string
}

export function formatCustomerName(customer: CustomerWithNames | null | undefined, locale: string): string {
  if (!customer) return locale === 'ko' ? '정보 없음' : '정보 없음'
  
  const customerData = customer as CustomerWithNames & { name?: string; language?: string }
  const customerName = customerData.name_ko || customerData.name || ''
  const englishName = customerData.name_en || ''
  const customerLanguage = customerData.language || ''
  
  // 고객 언어가 한국어가 아니면 원래 이름 그대로 표시
  if (customerLanguage && !isKoreanLanguage(customerLanguage)) {
    return customerName || '정보 없음'
  }
  
  if (locale === 'ko') {
    // 한국어 페이지: 한국어 이름만 표시
    return customerName || '정보 없음'
  } else {
    // 영어 페이지: 한글 이름일 때만 음성학적 변환된 이름 표시
    if (englishName && englishName !== customerName) {
      return englishName
    }
    
    if (customerName && isKoreanName(customerName)) {
      const transliterated = transliterateKorean(customerName)
      return transliterated ? `${transliterated} (${customerName})` : customerName
    }
    
    // 한글이 아닌 이름은 그대로 표시
    return customerName || '정보 없음'
  }
}

/**
 * 한국어 이름을 성과 이름으로 분리해서 영어식 순서로 변환
 * 예: "허유림" -> "Yurim Heo"
 */
export function getKoreanNameInEnglishOrder(fullName: string): string {
  if (!fullName || fullName.length < 2) return transliterateKorean(fullName)
  
  // 1글자 성인지 판단 (일반적으로 한국 이름은 성 1글자 + 이름)
  let surname = ''
  let givenName = ''
  
  if (fullName.length >= 3) {
    // 3글자 이상이면 일반적으로 성 1글자, 이름 나머지
    surname = fullName.substring(0, 1)
    givenName = fullName.substring(1)
  } else if (fullName.length === 2) {
    // 2글자면 성 1글자, 이름 1글자
    surname = fullName.substring(0, 1)
    givenName = fullName.substring(1)
  }
  
  // 성씨 변환
  const surnameEnglish = surnameMap[surname] || transliterateKorean(surname)
  const givenNameEnglish = transliterateKorean(givenName)
  
  // 영어식 순서: 이름 성씨로 반환
  return `${givenNameEnglish} ${surnameEnglish}`.trim()
 }

/**
 * 한국 성씨의 영어 표기 맵
 */
const surnameMap: Record<string, string> = {
  '김': 'Kim',
  '이': 'Lee', 
  '박': 'Park',
  '최': 'Choi',
  '정': 'Jeong',
  '강': 'Kang',
  '조': 'Jo',
  '윤': 'Yoon',
  '장': 'Jang',
  '임': 'Im',
  '한': 'Han',
  '오': 'Oh',
  '서': 'Seo',
  '신': 'Shin',
  '권': 'Kwon',
  '황': 'Hwang',
  '안': 'An',
  '송': 'Song',
  '전': 'Jeon',
  '류': 'Ryu',
  '유': 'Yoo',
  '고': 'Ko',
  '문': 'Moon',
  '양': 'Yang',
  '백': 'Beak',
  '남': 'Nam',
  '심': 'Shim',
  '노': 'No',
  '구': 'Gu',
  '함': 'Ham',
  '배': 'Bae',
  '부': 'Boo',
  '표': 'Pyo',
  '마': 'Ma',
  '왕': 'Wang',
  '도': 'Do',
  '주': 'Joo',
  '하': 'Ha',
  '모': 'Mo',
  '변': 'Byun',
  '염': 'Yeom',
  '차': 'Cha',
  '위': 'Wee',
  '소': 'So',
  '선': 'Seon',
  '민': 'Min',
  '허': 'Heo', // 허유림의 허
  '현': 'Hyeon'
}

/**
 * 고객 이름을 다국어로 표시하는 헬퍼 함수 (향상된 버전)
 * 고객 언어가 한국어가 아니면 번역하지 않고 그대로 표시
 */
export function formatCustomerNameEnhanced(customer: CustomerWithNames | null | undefined, locale: string): string {
  if (!customer) return locale === 'ko' ? '정보 없음' : '정보 없음'
  
  const customerData = customer as CustomerWithNames & { name?: string; language?: string }
  const customerName = customerData.name_ko || customerData.name || ''
  const englishName = customerData.name_en || ''
  const customerLanguage = customerData.language || ''
  
  // 고객 언어가 한국어가 아니면 원래 이름 그대로 표시
  if (customerLanguage && !isKoreanLanguage(customerLanguage)) {
    return customerName || '정보 없음'
  }
  
  if (locale === 'ko') {
    // 한국어 페이지: 한국어 이름만 표시
    return customerName || '정보 없음'
  } else {
    // 영어 페이지: 한글 이름일 때만 음성학적 변환된 이름 표시
    if (englishName && englishName !== customerName) {
      return englishName
    }
    
    if (customerName && isKoreanName(customerName)) {
      const englishOrderName = getKoreanNameInEnglishOrder(customerName)
      return englishOrderName ? `${englishOrderName} (${customerName})` : customerName
    }
    
    // 한글이 아닌 이름은 그대로 표시
    return customerName || '정보 없음'
  }
}

/**
 * 언어가 한국어인지 확인하는 함수
 */
function isKoreanLanguage(language: string): boolean {
  const koreanLanguageCodes = ['kr', 'ko', '한국어', 'korean']
  return koreanLanguageCodes.includes(language.toLowerCase())
}

/**
 * 이름이 한글인지 확인하는 함수
 */
function isKoreanName(name: string): boolean {
  return /[가-힣]/.test(name)
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
