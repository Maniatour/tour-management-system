/**
 * 가이드 언어 감지 테스트 스크립트
 * 브라우저 콘솔에서 실행하여 테스트할 수 있습니다.
 */

// 테스트 데이터
const testTeamData = [
  {
    email: 'guide@tour.com',
    name_ko: '김가이드',
    position: '투어 가이드',
    languages: ['ko', 'en'],
    description: '한국어와 영어를 지원하는 가이드'
  },
  {
    email: 'english-guide@tour.com',
    name_ko: '영어가이드',
    position: 'Tour Guide',
    languages: ['en'],
    description: '영어만 지원하는 가이드'
  },
  {
    email: 'japanese-guide@tour.com',
    name_ko: '일본어가이드',
    position: 'tour guide',
    languages: ['ja', 'ko'],
    description: '일본어와 한국어를 지원하는 가이드'
  },
  {
    email: 'no-lang-guide@tour.com',
    name_ko: '언어없는가이드',
    position: 'guide',
    languages: null,
    description: '언어 정보가 없는 가이드'
  },
  {
    email: 'empty-lang-guide@tour.com',
    name_ko: '빈언어가이드',
    position: 'guide',
    languages: [],
    description: '빈 언어 배열을 가진 가이드'
  },
  {
    email: 'invalid-lang-guide@tour.com',
    name_ko: '잘못된언어가이드',
    position: 'guide',
    languages: ['invalid', 'unknown'],
    description: '잘못된 언어 코드를 가진 가이드'
  }
]

// 언어 감지 함수 테스트
function testLanguageDetection() {
  console.log('=== 가이드 언어 감지 테스트 시작 ===')
  
  testTeamData.forEach((guide, index) => {
    console.log(`\n--- 테스트 ${index + 1}: ${guide.description} ---`)
    console.log(`이메일: ${guide.email}`)
    console.log(`포지션: ${guide.position}`)
    console.log(`언어 배열:`, guide.languages)
    
    try {
      // 실제 함수 호출 (브라우저 환경에서만 작동)
      if (typeof window !== 'undefined' && window.detectGuidePreferredLanguage) {
        const preferredLocale = window.detectGuidePreferredLanguage(guide, guide.email)
        console.log(`✅ 감지된 선호 언어: ${preferredLocale}`)
      } else {
        // 수동 테스트
        const preferredLocale = manualLanguageDetection(guide)
        console.log(`✅ 수동 감지된 선호 언어: ${preferredLocale}`)
      }
    } catch (error) {
      console.error(`❌ 오류 발생:`, error)
    }
  })
  
  console.log('\n=== 테스트 완료 ===')
}

// 수동 언어 감지 함수 (테스트용)
function manualLanguageDetection(teamData) {
  if (!teamData || !teamData.languages) {
    return 'ko'
  }

  const languages = teamData.languages
  if (!Array.isArray(languages) || languages.length === 0) {
    return 'ko'
  }

  const firstLanguage = languages[0]
  const normalizedCode = firstLanguage.trim().toUpperCase()
  
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
      return 'ko'
  }
}

// 가이드 포지션 감지 테스트
function testGuidePositionDetection() {
  console.log('\n=== 가이드 포지션 감지 테스트 ===')
  
  const testPositions = [
    '투어 가이드',
    'Tour Guide', 
    'tour guide',
    'guide',
    'tourguide',
    'TourGuide',
    '가이드',
    '매니저',
    'Manager',
    'driver',
    'Driver'
  ]
  
  testPositions.forEach(position => {
    const isGuide = position.toLowerCase().includes('guide') || 
                   position.toLowerCase().includes('tour guide') || 
                   position.toLowerCase().includes('tourguide')
    console.log(`포지션: "${position}" -> 가이드 여부: ${isGuide}`)
  })
}

// 브라우저에서 실행할 수 있도록 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.testLanguageDetection = testLanguageDetection
  window.testGuidePositionDetection = testGuidePositionDetection
  window.testTeamData = testTeamData
  window.manualLanguageDetection = manualLanguageDetection
  
  console.log('가이드 언어 감지 테스트 함수가 로드되었습니다.')
  console.log('테스트를 실행하려면 다음 명령어를 사용하세요:')
  console.log('- testLanguageDetection()')
  console.log('- testGuidePositionDetection()')
}

export { testLanguageDetection, testGuidePositionDetection, testTeamData }
